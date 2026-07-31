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

  it('distinguishes two entries sharing a promptId by timestamp', async () => {
    await postClear([key(A2)]);           // clear only the 1500 one
    const left = await getResponses();
    const ones = left.filter(e => e.promptId === 'prompt-1');
    expect(ones.length).toBe(1);
    expect(ones[0].timestamp).toBe(1000);
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
