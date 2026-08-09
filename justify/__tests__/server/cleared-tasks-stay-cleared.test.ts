import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Jonah, 2026-07-31: "When I click 'Clear All Completed' on tasks marked done, or
// when I click 'Clear All Tasks' - they are removed from the review queue. When I
// submit a new task and it is completed, the old items come back."
//
// ROOT CAUSE. Every history write was an unawaited `fetch(...).catch(()=>{})` with
// no keepalive, and a completed task calls window.location.reload() 1200ms later.
// A request still in flight at teardown is discarded. So a clear could be reverted
// by its own page reload, and the next GET served the stale file back. The same
// lost write explains why every entry persisted at the time read reviewed=false
// despite having been marked done.
//
// The client fix is keepalive. The fix THIS file guards is the server one: a clear
// is a TOMBSTONE, so a cleared entry can never be served or appended again no
// matter what a later stale write claims. That holds even if a write is lost,
// which is the property a timing fix alone cannot give.

const dir = mkdtempSync(join(tmpdir(), 'jf-clear-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { WsServer } = await import('../../server/ws-server.js');

const RESP = join(dir, 'responses.json');
const TOMB = join(dir, 'responses-cleared.json');

let server: InstanceType<typeof WsServer>;
let port: number;
const base = () => `http://127.0.0.1:${port}`;

const entry = (promptId: string, timestamp: number, reviewed = false) => ({
  promptId, timestamp, reviewed, status: 'completed', changes: [], diffs: [],
});
const key = (e: { promptId: string; timestamp: number }) => `${e.promptId}|${e.timestamp}`;

const A = entry('prompt-1', 1000, true);
const B = entry('prompt-2', 2000, true);
const C = entry('prompt-3', 3000, false);
// A real duplicate promptId at a different timestamp - the live file held
// prompt-54 twice and prompt-57 three times, so identity cannot be promptId alone.
const A2 = entry('prompt-1', 1500, true);

const getResponses = async (): Promise<Array<Record<string, unknown>>> => {
  const r = await fetch(`${base()}/responses`);
  return r.json() as Promise<Array<Record<string, unknown>>>;
};
const postResponses = (arr: unknown[]) =>
  fetch(`${base()}/responses`, { method: 'POST', body: JSON.stringify(arr) });
const postClear = (ids: string[]) =>
  fetch(`${base()}/responses/clear`, { method: 'POST', body: JSON.stringify({ ids }) });

beforeAll(async () => {
  server = new WsServer();
  // A port well away from the live daemon's 9224 so this suite can never talk to
  // the real install, and away from the other e2e suite's 49900.
  port = await server.start(49960);
});

afterAll(async () => {
  try { await server.stop?.(); } catch {}
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
});

beforeEach(() => {
  writeFileSync(RESP, JSON.stringify([A, A2, B, C]));
  if (existsSync(TOMB)) rmSync(TOMB);
});

describe('cleared tasks stay cleared', () => {
  it('serves everything when nothing has been cleared', async () => {
    expect((await getResponses()).length).toBe(4);
  });

  it('Clear All Tasks removes every entry and GET stays empty', async () => {
    await postClear([A, A2, B, C].map(key));
    expect(await getResponses()).toEqual([]);
  });

  it('Clear All Completed removes only the reviewed ones, keeping the rest', async () => {
    await postClear([A, A2, B].map(key));
    const left = await getResponses();
    expect(left.map(e => e.promptId)).toEqual(['prompt-3']);
  });

  // THE REPORTED BUG. Before the fix this failed: the stale array won and the
  // cleared entries were written straight back to disk.
  it('a stale client array cannot resurrect cleared entries', async () => {
    await postClear([A, A2, B].map(key));
    // A client whose clear-write was lost still believes it holds all four, and
    // posts them back when the next task completes.
    await postResponses([A, A2, B, C]);
    const left = await getResponses();
    expect(left.map(e => e.promptId)).toEqual(['prompt-3']);
    // and the file itself must be clean, not merely filtered on read
    expect(JSON.parse(readFileSync(RESP, 'utf-8')).map((e: any) => e.promptId)).toEqual(['prompt-3']);
  });

  it('a NEW task still lands after a clear, and only that task is present', async () => {
    await postClear([A, A2, B, C].map(key));
    const D = entry('prompt-4', 4000, false);
    await postResponses([D]);
    const left = await getResponses();
    expect(left.map(e => e.promptId)).toEqual(['prompt-4']);
  });

  it('the reported sequence end to end: clear, then a new task completes', async () => {
    // 1. everything marked done is cleared
    await postClear([A, A2, B].map(key));
    // 2. a new task is submitted and completes; the client posts its own array
    const D = entry('prompt-4', 4000, false);
    await postResponses([C, D]);
    // 3. the page reloads and re-reads history - the old items must NOT be back
    const afterReload = await getResponses();
    expect(afterReload.map(e => e.promptId).sort()).toEqual(['prompt-3', 'prompt-4']);
    expect(afterReload.some(e => e.promptId === 'prompt-1')).toBe(false);
    expect(afterReload.some(e => e.promptId === 'prompt-2')).toBe(false);
  });

  // 2026-08-08, Jonah: cleared tasks came back INCONSISTENTLY. Root cause was a
  // tombstone-identity gap. emitResponse mints a response id as
  // `${originalPromptId}-${Date.now()}` plus a separate `timestamp: Date.now()`,
  // so the SAME task answered more than once (a retry, a reconnect re-emit, or an
  // in-flight answer that lands after a clear) carries a DIFFERENT precise key
  // each time. Tombstoning only the precise key on screen let the other emission
  // slip back in - the live install held prompt-115 cleared at one epoch and
  // sitting in responses.json under another. A clear now tombstones the TASK
  // (base id = original prompt id), so every emission of a cleared task stays
  // gone regardless of its epoch.
  const R1 = entry('prompt-9-1786000000000', 1786000000000, true);
  const R2 = entry('prompt-9-1786000110000', 1786000110000, true); // same task, +110s

  it('clearing one emission of a task clears every emission of that task', async () => {
    writeFileSync(RESP, JSON.stringify([R1, R2, C]));
    await postClear([key(R1)]);                 // user cleared the one on screen
    const left = await getResponses();
    expect(left.map(e => e.promptId)).toEqual(['prompt-3']); // both prompt-9 gone
  });

  it('a later re-emission of a cleared task cannot resurrect it (stale array)', async () => {
    writeFileSync(RESP, JSON.stringify([R1, C]));
    await postClear([key(R1)]);
    // A new emission of the SAME task lands, e.g. a client posts a fresh full
    // array after a re-answer. Its precise key is new; its base id is tombstoned.
    await postResponses([R1, R2, C]);
    const left = await getResponses();
    expect(left.map(e => e.promptId)).toEqual(['prompt-3']);
    // and the file itself is clean, not merely filtered on read
    expect(JSON.parse(readFileSync(RESP, 'utf-8')).map((e: any) => e.promptId)).toEqual(['prompt-3']);
  });

  it('an in-flight answer landing AFTER a clear (headless emitResponse) does not resurrect', async () => {
    writeFileSync(RESP, JSON.stringify([R1, C]));
    await postClear([key(R1)]);
    // No client is connected in this suite, so emitResponse takes the headless
    // append path - the real code path a worker's late justify_respond hits. It
    // mints prompt-9-<now>, whose base id `prompt-9` is tombstoned.
    server.emitResponse({ promptId: 'prompt-9', summary: 'late answer', status: 'completed' });
    const left = await getResponses();
    expect(left.some(e => (e.promptId as string)?.startsWith('prompt-9'))).toBe(false);
    expect(left.map(e => e.promptId)).toEqual(['prompt-3']);
  });

  it('Clear All Completed tombstones the done task so a re-emit stays gone, keeping not-done', async () => {
    // R1/R2 are the same DONE task; C is a different not-done task.
    writeFileSync(RESP, JSON.stringify([R1, C]));
    await postClear([key(R1)]);                 // Clear All Completed sends done keys
    // the done task re-answers; must not come back
    server.emitResponse({ promptId: 'prompt-9', summary: 're-answer', status: 'completed' });
    const left = await getResponses();
    expect(left.map(e => e.promptId)).toEqual(['prompt-3']); // not-done survives, done stays gone
  });

  // Folded from cross-model review (2026-08-08): the broadcast must be
  // server-authoritative too. A client in ANOTHER tab, or the same client after a
  // hot-refresh reload, has an empty in-session cleared set, so a re-emitted
  // cleared task would re-render there unless the SERVER refuses to broadcast it.
  it('a re-emitted cleared task is not broadcast to clients (server-authoritative)', async () => {
    await postClear([key(R1)]);                 // tombstone base prompt-9
    const methods: string[] = [];
    const orig = server.broadcastToClients.bind(server);
    (server as unknown as { broadcastToClients: typeof server.broadcastToClients }).broadcastToClients =
      (m: string, p?: Record<string, unknown>) => { methods.push(m); return orig(m, p); };
    try {
      // a fresh task DOES broadcast (positive control)
      server.emitResponse({ promptId: 'prompt-77', summary: 'new', status: 'completed' });
      expect(methods.filter(m => m === 'justify_response').length).toBe(1);
      // a re-answer of the CLEARED task does NOT add another broadcast
      server.emitResponse({ promptId: 'prompt-9', summary: 're-answer', status: 'completed' });
      expect(methods.filter(m => m === 'justify_response').length).toBe(1);
    } finally {
      (server as unknown as { broadcastToClients: typeof server.broadcastToClients }).broadcastToClients = orig;
    }
  });

  it('tombstones survive a rewrite of the responses file', async () => {
    await postClear([key(A)]);
    writeFileSync(RESP, JSON.stringify([A, A2, B, C]));   // out-of-band restore
    expect((await getResponses()).some(e => key(e as any) === key(A))).toBe(false);
  });

  it('clearing an already-cleared id is idempotent', async () => {
    await postClear([key(A)]);
    await postClear([key(A)]);
    const tomb = JSON.parse(readFileSync(TOMB, 'utf-8'));
    expect(tomb.filter((t: string) => t === key(A)).length).toBe(1);
  });

  it('an empty clear is a no-op rather than a wipe', async () => {
    await postClear([]);
    expect((await getResponses()).length).toBe(4);
  });

  it('reports what it cleared and what remains', async () => {
    const r = await postClear([A, A2].map(key));
    expect(await r.json()).toMatchObject({ ok: true, cleared: 2, remaining: 2 });
  });

  it('malformed clear bodies are rejected without touching history', async () => {
    const r = await fetch(`${base()}/responses/clear`, { method: 'POST', body: 'not json' });
    expect(r.status).toBe(400);
    expect((await getResponses()).length).toBe(4);
  });

  it('a non-array POST to /responses does not throw the endpoint', async () => {
    const r = await postResponses({ nope: true } as never);
    expect(r.ok).toBe(true);
  });
});
