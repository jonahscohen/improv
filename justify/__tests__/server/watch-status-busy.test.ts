import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Regression test for the "Retry Send" lie (2026-07-09, Jonah).
//
// The browser claudebar used to flip to "Retry Send" after a flat 60 seconds,
// while the daemon was still applying the batch. A `claude -p` worker routinely
// runs for MINUTES. Hitting Retry then double-queued the same change.
//
// `/watch-status` must therefore tell the browser whether the daemon is holding
// the user's work, so the browser can keep saying "Working" instead of offering a
// destructive retry.

const dir = mkdtempSync(join(tmpdir(), 'jf-busy-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { WsServer } = await import('../../server/ws-server.js');
const { WatchStateStore } = await import('../../server/watch-state.js');

const BASE_PORT = 49600;
let cursor = 0;
const nextPort = () => BASE_PORT + cursor++ * 4;

const get = async (port: number, path: string) => {
  const res = await fetch(`http://localhost:${port}${path}`, { headers: { connection: 'close' } });
  return (await res.json()) as Record<string, unknown>;
};

const dispatcherWith = (workerRunning: boolean) => ({
  kick: () => {},
  status: () => ({ dispatcherRunning: true, workerRunning, pendingCount: 0, stalled: false }),
});

describe('GET /watch-status tells the browser when the daemon is busy', () => {
  let server: InstanceType<typeof WsServer>;
  let store: InstanceType<typeof WatchStateStore>;
  let port: number;
  const promptFile = join(dir, 'prompts.json');

  beforeEach(async () => {
    server = new WsServer();
    port = await server.start(nextPort());
    store = new WatchStateStore(join(dir, `watch-${port}.json`));
    writeFileSync(promptFile, '[]');
  });

  afterEach(async () => {
    await server.stop();
  });

  it('busy is TRUE while a worker is applying, so the browser must not offer Retry', async () => {
    store.arm('/proj', 'jonah');
    server.attachWatch(store, dispatcherWith(true));

    const s = await get(port, '/watch-status');
    expect(s.armed).toBe(true);
    expect(s.workerRunning).toBe(true);
    expect(s.busy).toBe(true);
  });

  it('busy is TRUE while a prompt sits queued but no worker has claimed it yet', async () => {
    store.arm('/proj', 'jonah');
    writeFileSync(promptFile, JSON.stringify([{ id: 'prompt-1', prompt: 'make it blue' }]));
    server.attachWatch(store, dispatcherWith(false));

    const s = await get(port, '/watch-status');
    expect(s.pendingCount).toBe(1);
    expect(s.workerRunning).toBe(false);
    expect(s.busy).toBe(true);
  });

  it('busy is FALSE when armed and idle - a send that never landed SHOULD offer Retry', async () => {
    store.arm('/proj', 'jonah');
    server.attachWatch(store, dispatcherWith(false));

    const s = await get(port, '/watch-status');
    expect(s.armed).toBe(true);
    expect(s.pendingCount).toBe(0);
    expect(s.busy).toBe(false);
  });

  it('busy is FALSE when the watch is disarmed, even with a queued prompt', async () => {
    writeFileSync(promptFile, JSON.stringify([{ id: 'prompt-1', prompt: 'x' }]));
    server.attachWatch(store, dispatcherWith(false));

    const s = await get(port, '/watch-status');
    expect(s.armed).toBe(false);
    expect(s.busy).toBe(false); // nothing will dispatch it; Retry is the honest answer
  });

  it('busy is FALSE when no dispatcher is attached (an old/MCP-only daemon)', async () => {
    store.arm('/proj', 'jonah');
    // no attachWatch dispatcher at all
    const s = await get(port, '/watch-status');
    expect(s.workerRunning).toBe(false);
    expect(s.busy).toBe(false);
  });
});
