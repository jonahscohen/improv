import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Jonah, 2026-07-09: "I also don't want a silent worker clanging away in private.
// I want the session that I called the watch from to own the thread and the
// process [...] I want to be able to see the work getting done."
//
// The daemon owns the QUEUE. It does not own the WORK. By default it must never
// spawn a detached, stdio-ignored `claude -p` worker: the prompt stays queued and
// unclaimed until the attached owner claims it.

const dir = mkdtempSync(join(tmpdir(), 'jf-owner-'));
const projectRoot = mkdtempSync(join(tmpdir(), 'jf-owner-root-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { Dispatcher } = await import('../../server/dispatcher.js');
const { WatchStateStore } = await import('../../server/watch-state.js');

const PROMPT_FILE = join(dir, 'prompts.json');
const readQueue = () => JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('the daemon never runs the work in private', () => {
  let dispatcher: InstanceType<typeof Dispatcher>;
  let watch: InstanceType<typeof WatchStateStore>;
  let ran: string;

  beforeEach(() => {
    writeFileSync(PROMPT_FILE, JSON.stringify([{ id: 'prompt-1', prompt: 'make it lime', timestamp: Date.now() }]));
    watch = new WatchStateStore(join(dir, 'watch.json'));
    watch.arm(projectRoot, 'jonah');
    ran = join(dir, `ran-${Math.random().toString(36).slice(2)}.log`);
    writeFileSync(ran, '');
    process.env.JUSTIFY_WORKER_CMD = `echo spawned >> ${ran}; exit 0`;
  });

  afterEach(() => { dispatcher?.stop(); delete process.env.JUSTIFY_WORKER_CMD; delete process.env.JUSTIFY_HEADLESS; });

  it('DEFAULT: no worker is ever spawned, and the prompt waits UNCLAIMED for its owner', async () => {
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 25 });
    dispatcher.start();
    await sleep(500); // ~20 ticks

    expect(readFileSync(ran, 'utf-8')).toBe('');       // nothing ran
    expect(dispatcher.workerRunning()).toBe(false);
    const q = readQueue();
    expect(q).toHaveLength(1);                          // and nothing was lost
    expect(q[0].claimedBy).toBeUndefined();             // left for the owner to claim
  });

  it('an unclaimed prompt IS reported as stalled - nobody is going to do it', () => {
    // Honest, and it is what the user needs to see when no owner is attached.
    // An attached owner claims within one poll interval, so this clears itself.
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 25 });
    dispatcher.start();
    expect(dispatcher.stalled()).toBe(true);
    expect(dispatcher.status().headless).toBe(false);
  });

  it('the watch stays armed while the prompt waits - the queue never gives up', async () => {
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 25 });
    dispatcher.start();
    await sleep(400);
    expect(watch.isArmed()).toBe(true);
    expect(dispatcher.pendingCount()).toBe(1);
  });

  it('JUSTIFY_HEADLESS=1 is an explicit opt-in for an unattended machine', async () => {
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 25, headless: true });
    dispatcher.start();
    const stop = Date.now() + 4000;
    while (Date.now() < stop && readFileSync(ran, 'utf-8') === '') await sleep(25);
    expect(readFileSync(ran, 'utf-8')).toContain('spawned');
  }, 12000);
});
