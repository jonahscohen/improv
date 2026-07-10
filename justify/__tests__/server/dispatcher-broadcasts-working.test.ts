import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Jonah, 2026-07-09: "You're still not getting my prompts."
//
// His prompt WAS arriving and a worker WAS applying it. But the claudebar sat on
// "Sending to Claude." for the whole apply, because the only code that ever
// broadcast `justify_working` lived in the MCP tools - which the daemon-owned
// dispatcher does not use. The browser was never told the daemon had the work.
//
// Silence is indistinguishable from a dropped prompt. The dispatcher must speak.

const dir = mkdtempSync(join(tmpdir(), 'jf-bcast-'));
const projectRoot = mkdtempSync(join(tmpdir(), 'jf-bcast-root-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { Dispatcher } = await import('../../server/dispatcher.js');
const { WatchStateStore } = await import('../../server/watch-state.js');

const PROMPT_FILE = join(dir, 'prompts.json');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (pred: () => boolean, ms = 6000) => {
  const stop = Date.now() + ms;
  while (Date.now() < stop) { if (pred()) return true; await sleep(25); }
  return false;
};

describe('the dispatcher tells the browser when it starts applying', () => {
  let dispatcher: InstanceType<typeof Dispatcher>;
  let watch: InstanceType<typeof WatchStateStore>;
  let events: Array<{ event: string; payload?: Record<string, unknown> }>;

  beforeEach(() => {
    writeFileSync(PROMPT_FILE, JSON.stringify([
      { id: 'prompt-15', prompt: 'hover state transition font weight .2s ease in out', timestamp: Date.now() },
    ]));
    watch = new WatchStateStore(join(dir, 'watch.json'));
    watch.arm(projectRoot, 'jonah');
    events = [];
  });

  afterEach(() => { dispatcher?.stop(); delete process.env.JUSTIFY_WORKER_CMD; });

  it('broadcasts justify_working the moment a worker is spawned', async () => {
    process.env.JUSTIFY_WORKER_CMD = 'sleep 0.4';
    dispatcher = new Dispatcher(watch, {
      port: 9223, stateDir: dir, tickMs: 50, headless: true,
      broadcast: (event, payload) => events.push({ event, payload }),
    });
    dispatcher.start();

    const spoke = await waitFor(() => events.some((e) => e.event === 'justify_working'));
    expect(spoke).toBe(true);

    const ev = events.find((e) => e.event === 'justify_working')!;
    expect(ev.payload?.promptId).toBe('prompt-15');
    expect(typeof ev.payload?.timestamp).toBe('number');
  }, 20000);

  it('broadcasts once per claimed prompt in the batch', async () => {
    writeFileSync(PROMPT_FILE, JSON.stringify([
      { id: 'prompt-1', prompt: 'a', timestamp: Date.now() },
      { id: 'prompt-2', prompt: 'b', timestamp: Date.now() },
    ]));
    process.env.JUSTIFY_WORKER_CMD = 'sleep 0.4';
    dispatcher = new Dispatcher(watch, {
      port: 9223, stateDir: dir, tickMs: 50, headless: true,
      broadcast: (event, payload) => events.push({ event, payload }),
    });
    dispatcher.start();

    await waitFor(() => events.filter((e) => e.event === 'justify_working').length >= 2);
    const ids = events.filter((e) => e.event === 'justify_working').map((e) => e.payload?.promptId);
    expect(ids).toEqual(['prompt-1', 'prompt-2']);
  }, 20000);

  it('a dispatcher with no broadcast wired still runs (never throws)', async () => {
    process.env.JUSTIFY_WORKER_CMD = 'sleep 0.2';
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 50, headless: true });
    dispatcher.start();
    const claimed = await waitFor(() => {
      const q = JSON.parse(require('fs').readFileSync(PROMPT_FILE, 'utf-8'));
      return q[0]?.claimedBy !== undefined;
    });
    expect(claimed).toBe(true);
  }, 20000);
});
