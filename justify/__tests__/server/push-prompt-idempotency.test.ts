import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// The browser outbox retries `push_prompt` FOREVER (core/outbox.ts), because no
// clock may drop a user's prompt. That is only safe if the daemon refuses to
// enqueue the same prompt twice.
//
// Two lost-ack scenarios must both be idempotent:
//   1. the prompt is still sitting in the queue when the retry arrives
//   2. the worker already applied it and cleared it from the queue
//
// (2) is the dangerous one: without a ledger that outlives the queue entry, a
// retry would re-apply a change the user already has.

const dir = mkdtempSync(join(tmpdir(), 'jf-idem-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { registerTools } = await import('../../server/mcp-tools.js');

const PROMPT_FILE = join(dir, 'prompts.json');
const CLIENT_FILE = join(dir, 'served-clients.json');

type Handler = (connectionId: string, params: Record<string, unknown>) => Record<string, unknown>;

function harness() {
  const handlers = new Map<string, Handler>();
  const ws = {
    onMessage: (m: string, h: Handler) => handlers.set(m, h),
    recordMcpActivity: () => {},
    getConnections: () => [],
    getPort: () => 9223,
    broadcastToClients: () => {},
    onClientMessage: () => {},
  };
  const mcp = { tool: () => {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTools(mcp as any, ws as any);
  const push = handlers.get('push_prompt');
  if (!push) throw new Error('push_prompt handler not registered');
  return push;
}

const readQueue = () => JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'));

describe('push_prompt is idempotent on clientId, so a forever-retry cannot double-queue', () => {
  let push: Handler;

  beforeEach(() => {
    writeFileSync(PROMPT_FILE, '[]');
    writeFileSync(CLIENT_FILE, '[]');
    writeFileSync(join(dir, 'prompt-seq.json'), JSON.stringify({ next: 1 }));
    writeFileSync(join(dir, 'responses.json'), '[]');
    writeFileSync(join(dir, 'responses-cleared.json'), '[]');
    push = harness();
  });

  it('accepts a prompt once and records its clientId', () => {
    const res = push('c1', { prompt: 'make it lime', clientId: 'cid-abc' });
    expect(res.accepted).toBe(1);
    expect(readQueue()).toHaveLength(1);
    expect(readQueue()[0].clientId).toBe('cid-abc');
    expect(existsSync(CLIENT_FILE)).toBe(true);
  });

  // Folded from cross-model review (2026-08-08). A clear now tombstones the TASK
  // (base id `prompt-<N>`), and that tombstone OUTLIVES the response it removed
  // from responses.json. So the id allocator must also high-water the tombstones:
  // a stale-low prompt-seq.json must not reissue a prompt-<N> that a surviving
  // base tombstone would then wrongly drop.
  it('a task tombstone raises the id high-water so a cleared prompt-N is never reissued', () => {
    // prompt-seq is stale-low (next:1), queue + responses empty, but task 50 was
    // cleared (base tombstone) and task 49 has a precise-key tombstone.
    writeFileSync(
      join(dir, 'responses-cleared.json'),
      JSON.stringify(['prompt-50', 'prompt-49-1786000000000|1786000000000']),
    );
    const res = push('cNew', { prompt: 'fresh task', clientId: 'cid-new' });
    const seq = parseInt(String(res.promptId).replace('prompt-', ''), 10);
    expect(seq).toBeGreaterThan(50); // never prompt-1..50, which a tombstone would drop
  });

  it('a retry while the prompt is STILL QUEUED acks without enqueueing a second copy', () => {
    const first = push('c1', { prompt: 'make it lime', clientId: 'cid-abc' });
    const retry = push('c1', { prompt: 'make it lime', clientId: 'cid-abc' });

    expect(retry.accepted).toBe(0);
    expect(retry.duplicate).toBe(true);
    expect(retry.promptId).toBe(first.promptId);
    expect(readQueue()).toHaveLength(1);
  });

  it('a retry AFTER the worker applied and cleared it does not re-queue the work', () => {
    const first = push('c1', { prompt: 'delete the hero', clientId: 'cid-xyz' });
    expect(readQueue()).toHaveLength(1);

    // The worker answers it and justify-done clears it, exactly as in production.
    writeFileSync(PROMPT_FILE, '[]');

    // The browser never saw the ack, so the outbox knocks again.
    const retry = push('c1', { prompt: 'delete the hero', clientId: 'cid-xyz' });

    expect(retry.accepted).toBe(0);
    expect(retry.duplicate).toBe(true);
    expect(retry.promptId).toBe(first.promptId);
    expect(readQueue()).toHaveLength(0); // the change is NOT applied twice
  });

  it('two DIFFERENT prompts both land, even with identical text', () => {
    push('c1', { prompt: 'same words', clientId: 'cid-1' });
    push('c1', { prompt: 'same words', clientId: 'cid-2' });
    expect(readQueue()).toHaveLength(2);
  });

  it('a prompt with no clientId still works (older core, no dedupe)', () => {
    const a = push('c1', { prompt: 'legacy' });
    const b = push('c1', { prompt: 'legacy' });
    expect(a.accepted).toBe(1);
    expect(b.accepted).toBe(1);
    expect(readQueue()).toHaveLength(2);
  });

  it('the ledger is bounded by SIZE, not by age - an old clientId is still deduped', () => {
    // An age-based expiry would be a clock deciding when a duplicate becomes a
    // double-apply. Push the original, then 400 others, then retry the original.
    const first = push('c1', { prompt: 'the original', clientId: 'cid-old' });
    writeFileSync(PROMPT_FILE, '[]'); // it gets answered and cleared

    for (let i = 0; i < 400; i++) {
      push('c1', { prompt: `filler ${i}`, clientId: `cid-f${i}` });
      writeFileSync(PROMPT_FILE, '[]');
    }

    const retry = push('c1', { prompt: 'the original', clientId: 'cid-old' });
    expect(retry.duplicate).toBe(true);
    expect(retry.promptId).toBe(first.promptId);
    expect(readQueue()).toHaveLength(0);
  });

  // ---- folded in from the Codex cross-model review, 2026-07-09 ----

  it('does NOT ack a prompt it could not durably write (the outbox must keep its copy)', () => {
    // Make prompts.json unwritable: writePrompts throws, so the ws layer returns a
    // JSON-RPC error, so the outbox never deletes its entry. Before this fix,
    // writePrompts swallowed the error and the handler answered {accepted: 1}.
    const roDir = mkdtempSync(join(tmpdir(), 'jf-ro-'));
    chmodSync(roDir, 0o500);
    const prevStateDir = process.env.JUSTIFY_STATE_DIR;
    try {
      // A fresh registerTools bound to the read-only dir.
      process.env.JUSTIFY_STATE_DIR = roDir;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      expect(() => {
        const handlers = new Map<string, Handler>();
        const ws = { onMessage: (m: string, h: Handler) => handlers.set(m, h), recordMcpActivity: () => {}, getConnections: () => [], getPort: () => 9223, broadcastToClients: () => {}, onClientMessage: () => {} };
        // registerTools captures STATE_DIR at call time.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        registerTools({ tool: () => {} } as any, ws as any);
        handlers.get('push_prompt')!('c1', { prompt: 'undurable', clientId: 'cid-ro' });
      }).toThrow();
    } finally {
      chmodSync(roDir, 0o700);
      process.env.JUSTIFY_STATE_DIR = prevStateDir;
    }
  });

  it('a STILL-QUEUED prompt is deduped by the queue lookup, even once the ledger has evicted its id', () => {
    // This is the primary defense, and it does not depend on the ledger at all.
    const first = push('c1', { prompt: 'still waiting', clientId: 'cid-queued' });

    // Push 600 others (past the 500 cap), clearing each so only the original stays
    // queued. `cid-queued` is the oldest ledger entry, so it gets evicted.
    for (let i = 0; i < 600; i++) {
      const q = readQueue();
      push('c1', { prompt: `filler ${i}`, clientId: `cid-g${i}` });
      writeFileSync(PROMPT_FILE, JSON.stringify(q));
    }
    const ledger: Array<[string, string]> = JSON.parse(readFileSync(CLIENT_FILE, 'utf-8'));
    expect(ledger.some(([cid]) => cid === 'cid-queued')).toBe(false); // really evicted

    const retry = push('c1', { prompt: 'still waiting', clientId: 'cid-queued' });
    expect(retry.duplicate).toBe(true); // the QUEUE caught it
    expect(retry.promptId).toBe(first.promptId);
    expect(readQueue().filter((p: { clientId?: string }) => p.clientId === 'cid-queued')).toHaveLength(1);
  });

  it('the ledger covers a SERVED-AND-CLEARED id for the full 500-entry window', () => {
    // This is the window the ledger exists for: the worker applied and cleared the
    // prompt, and only then does the browser retry. 499 later prompts must not
    // push it out.
    const first = push('c1', { prompt: 'applied already', clientId: 'cid-served' });
    writeFileSync(PROMPT_FILE, '[]'); // worker applied + cleared it

    for (let i = 0; i < 499; i++) {
      push('c1', { prompt: `filler ${i}`, clientId: `cid-h${i}` });
      writeFileSync(PROMPT_FILE, '[]');
    }

    const retry = push('c1', { prompt: 'applied already', clientId: 'cid-served' });
    expect(retry.duplicate).toBe(true);
    expect(retry.promptId).toBe(first.promptId);
    expect(readQueue()).toHaveLength(0); // NOT re-applied
  });
});
