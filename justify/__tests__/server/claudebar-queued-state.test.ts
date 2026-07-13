import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// THE CLAUDEBAR MUST NEVER SAY "Sending to Claude." ABOUT A PROMPT THAT ALREADY LANDED.
//
// The bug (measured live 2026-07-12, reported repeatedly by Jonah): the browser had
// NO state for "accepted and queued, waiting for an owner to claim it". Its only
// exit from 'sending' was the `justify_working` broadcast, which the daemon fires
// from the GET /prompts poll and from the dispatcher spawning a worker.
//
// In HEADLESS mode that gap was invisible - the dispatcher claimed the batch about
// a tick after it landed. In OWNER mode (the default since 2026-07-09) the daemon
// deliberately does NOT apply the batch: it waits, unclaimed, for the attached
// owner. Nothing polls on its own. So the bar sat on "Sending to Claude." for the
// entire wait - which is FALSE (the send completed, was acked, and is on disk) and
// is indistinguishable from a lost send.
//
// `justify_queued` closes that gap. These tests pin the property that makes it
// trustworthy: it is emitted ONLY for a prompt that is durably on disk. An
// announcement that outruns the write would be the same class of lie as the ack
// that `writePrompts` was hardened to never give.

const dir = mkdtempSync(join(tmpdir(), 'jf-queued-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { registerTools } = await import('../../server/mcp-tools.js');

const PROMPT_FILE = join(dir, 'prompts.json');

type Handler = (connectionId: string, params: Record<string, unknown>) => Record<string, unknown>;
type Broadcast = { method: string; params?: Record<string, unknown> };

// Captures broadcasts, and - critically - snapshots the QUEUE AS IT WAS at the
// instant of each broadcast. That is what lets us assert ordering: the prompt must
// already be durable when the daemon announces it is queued.
function harness() {
  const handlers = new Map<string, Handler>();
  const sent: Array<Broadcast & { queueAtBroadcast: unknown[] }> = [];
  const ws = {
    onMessage: (m: string, h: Handler) => handlers.set(m, h),
    recordMcpActivity: () => {},
    getConnections: () => [],
    getPort: () => 9223,
    broadcastToClients: (method: string, params?: Record<string, unknown>) => {
      let queueAtBroadcast: unknown[] = [];
      try { queueAtBroadcast = JSON.parse(readFileSync(PROMPT_FILE, 'utf-8')); } catch { /* not written yet */ }
      sent.push({ method, params, queueAtBroadcast });
    },
    onClientMessage: () => {},
  };
  const mcp = { tool: () => {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTools(mcp as any, ws as any);
  const push = handlers.get('push_prompt');
  if (!push) throw new Error('push_prompt handler not registered');
  return { push, sent };
}

const queued = (sent: Broadcast[]) => sent.filter((b) => b.method === 'justify_queued');

describe('the Claudebar gets a truthful "queued" signal the moment a prompt is durable', () => {
  beforeEach(() => {
    writeFileSync(PROMPT_FILE, '[]');
    chmodSync(dir, 0o755);
  });

  it('broadcasts justify_queued, carrying the server-assigned promptId, when a prompt is accepted', () => {
    const { push, sent } = harness();
    const res = push('c1', { prompt: 'make it red', clientId: 'cid-1' });

    const q = queued(sent);
    expect(q).toHaveLength(1);
    expect(q[0].params?.promptId).toBe(res.promptId);
  });

  it('announces the prompt ONLY AFTER it is durable on disk - never before', () => {
    // The whole point. If the broadcast could outrun writePrompts(), the browser
    // would leave 'sending' for a prompt that might never have landed - trading a
    // bar that lies pessimistically for one that lies optimistically. Far worse:
    // the user would believe the batch was safe.
    // A DISTINCT clientId: the served-clients ledger is deliberately durable and
    // outlives the queue, so reusing an id from an earlier test would be deduped
    // (correctly) and never announced.
    const { push, sent } = harness();
    const res = push('c1', { prompt: 'make it red', clientId: 'cid-durable' });

    const q = queued(sent);
    expect(q).toHaveLength(1);
    const idsOnDiskWhenAnnounced = (q[0] as any).queueAtBroadcast.map((p: any) => p.id);
    expect(idsOnDiskWhenAnnounced).toContain(res.promptId);
  });

  it('does NOT announce a prompt whose durable write FAILED', () => {
    // writePrompts throws on a failed write (deliberately - "an ack is a promise
    // that the work is durable. Never lie about it."). The queued broadcast lives
    // after that throw, so a prompt that never reached disk is never announced, and
    // the outbox keeps retrying against a bar still honestly showing "Sending".
    const { push, sent } = harness();
    chmodSync(dir, 0o500); // read-only: the atomic tmp-write cannot land
    try {
      expect(() => push('c1', { prompt: 'make it red', clientId: 'cid-boom' })).toThrow();
      expect(queued(sent)).toHaveLength(0);
    } finally {
      chmodSync(dir, 0o755);
    }
  });

  it('RE-announces a still-queued prompt when the browser re-sends it (a lost ack must not strand the bar)', () => {
    // The outbox retries forever on a lost ack. The re-send is a duplicate and must
    // not enqueue twice - but the browser that missed the first broadcast is still
    // sitting on "Sending". Re-announcing the state (while refusing to re-queue the
    // work) is what lets that bar catch up.
    const { push, sent } = harness();
    const first = push('c1', { prompt: 'make it red', clientId: 'cid-dup' });
    const again = push('c1', { prompt: 'make it red', clientId: 'cid-dup' });

    expect(again.duplicate).toBe(true);
    expect(again.accepted).toBe(0);
    expect(again.promptId).toBe(first.promptId);
    expect(JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'))).toHaveLength(1); // not double-queued

    const q = queued(sent);
    expect(q).toHaveLength(2); // announced both times
    expect(q[1].params?.promptId).toBe(first.promptId);
  });

  it('re-announces an already-CLAIMED prompt as working, never walking the bar back to queued', () => {
    // A retry that lands AFTER an owner claimed the prompt must not drag the bar
    // backwards into "Queued for Claude". The claim's justify_working has already
    // been and gone, so a bar knocked back to 'queued' would strand there until
    // justify-done. Announce what is TRUE of the prompt right now: it is claimed.
    const { push, sent } = harness();
    const res = push('c1', { prompt: 'make it red', clientId: 'cid-claimed' });

    // The owner claims it (what POST /prompts/claim writes).
    const q = JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'));
    q[0].claimedBy = 'justify-watch-owner';
    q[0].claimedAt = Date.now();
    writeFileSync(PROMPT_FILE, JSON.stringify(q));

    const retry = push('c1', { prompt: 'make it red', clientId: 'cid-claimed' });
    expect(retry.duplicate).toBe(true);
    expect(retry.promptId).toBe(res.promptId);

    const methods = sent.map((b) => b.method);
    expect(methods).toEqual(['justify_queued', 'justify_working']);
    expect(queued(sent)).toHaveLength(1); // NOT re-announced as queued
  });

  it('does not re-announce a prompt that was already SERVED AND CLEARED', () => {
    // That prompt is done, not queued. Announcing it as queued would drag a bar
    // showing "Review Changes" backwards into a pending state for finished work.
    const { push, sent } = harness();
    push('c1', { prompt: 'make it red', clientId: 'cid-done' });
    writeFileSync(PROMPT_FILE, '[]'); // the owner applied it and cleared the queue

    const replay = push('c1', { prompt: 'make it red', clientId: 'cid-done' });
    expect(replay.duplicate).toBe(true);

    // Exactly the ONE announcement from the original accept, none from the replay.
    expect(queued(sent)).toHaveLength(1);
  });

  it('gives every accepted prompt in a multi-prompt batch its own announcement', () => {
    const { push, sent } = harness();
    const a = push('c1', { prompt: 'red', clientId: 'cid-a' });
    const b = push('c1', { prompt: 'blue', clientId: 'cid-b' });

    const q = queued(sent);
    expect(q.map((x) => x.params?.promptId)).toEqual([a.promptId, b.promptId]);
    expect(existsSync(PROMPT_FILE)).toBe(true);
    expect(JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'))).toHaveLength(2);
  });
});
