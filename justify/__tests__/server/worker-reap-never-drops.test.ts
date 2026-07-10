import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// `cli/justify-worker.sh` reaps a `claude -p` that has run past
// JUSTIFY_WORKER_TIMEOUT_SECS (default 1800s) and exits 5.
//
// Jonah's condition for allowing that timer to exist at all: it may kill a hung
// PROCESS, but it must never drop the user's PROMPT or mark it failed. The
// prompt must return to the queue and be dispatched again, forever.
//
// This test drives the real Dispatcher with a worker command that exits 5 without
// answering, which is exactly what the reaper produces.

const dir = mkdtempSync(join(tmpdir(), 'jf-reap-'));
// The dispatcher spawns the worker with `cwd: <projectRoot>`. That directory must
// really exist or spawn fails with ENOENT before the worker ever runs - which
// releases the claim for the WRONG reason and makes this test pass vacuously.
const projectRoot = mkdtempSync(join(tmpdir(), 'jf-reap-root-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { Dispatcher } = await import('../../server/dispatcher.js');
const { WatchStateStore } = await import('../../server/watch-state.js');

const PROMPT_FILE = join(dir, 'prompts.json');
const readQueue = () => JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitFor = async (pred: () => boolean, timeoutMs = 6000): Promise<boolean> => {
  const stop = Date.now() + timeoutMs;
  while (Date.now() < stop) {
    if (pred()) return true;
    await sleep(25);
  }
  return false;
};

describe('a reaped worker releases its claim; the prompt is never dropped', () => {
  let dispatcher: InstanceType<typeof Dispatcher>;
  let watch: InstanceType<typeof WatchStateStore>;

  beforeEach(() => {
    writeFileSync(PROMPT_FILE, JSON.stringify([{ id: 'prompt-1', prompt: 'make the hero lime', timestamp: Date.now() }]));
    watch = new WatchStateStore(join(dir, 'watch.json'));
    watch.arm(projectRoot, 'jonah');
  });

  afterEach(() => {
    dispatcher?.stop();
    delete process.env.JUSTIFY_WORKER_CMD;
  });

  it('a worker that exits 5 without answering leaves the prompt queued and UNCLAIMED', async () => {
    // Exactly what the 1800s reaper produces: non-zero exit, nothing answered.
    const ran = join(dir, 'ran.log');
    writeFileSync(ran, '');
    process.env.JUSTIFY_WORKER_CMD = `echo x >> ${ran}; exit 5`;
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 50, headless: true });
    dispatcher.start();

    // The worker genuinely ran (not an ENOENT spawn failure masquerading as one).
    const dispatched = await waitFor(() => readFileSync(ran, 'utf-8').includes('x'));
    expect(dispatched).toBe(true);

    const released = await waitFor(() => readQueue()[0]?.claimedBy === undefined);
    expect(released).toBe(true);

    const q = readQueue();
    expect(q).toHaveLength(1); // NOT dropped
    expect(q[0].id).toBe('prompt-1'); // the same prompt, intact
    expect(q[0].prompt).toBe('make the hero lime');
    expect(q[0].claimedBy).toBeUndefined(); // free to be dispatched again
  }, 20000);

  it('the watch stays ARMED through a reaped worker - a dead worker never disarms', async () => {
    const ran2 = join(dir, 'ran2.log');
    writeFileSync(ran2, '');
    process.env.JUSTIFY_WORKER_CMD = `echo x >> ${ran2}; exit 5`;
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 50, headless: true });
    dispatcher.start();

    expect(await waitFor(() => readFileSync(ran2, 'utf-8').includes('x'))).toBe(true);
    await waitFor(() => readQueue()[0]?.claimedBy === undefined);
    expect(watch.isArmed()).toBe(true);
  }, 20000);

  it('it re-dispatches the SAME prompt again rather than surrendering', async () => {
    // Count attempts by appending to a file from the fake worker.
    const attempts = join(dir, 'attempts.log');
    writeFileSync(attempts, '');
    process.env.JUSTIFY_WORKER_CMD = `echo x >> ${attempts}; exit 5`;
    dispatcher = new Dispatcher(watch, {
      port: 9223,
      stateDir: dir,
      tickMs: 50,
      headless: true,
      maxBackoffMs: 60, // keep the capped backoff tiny so the test is quick
    });
    dispatcher.start();

    const tried = await waitFor(
      () => readFileSync(attempts, 'utf-8').trim().split('\n').filter(Boolean).length >= 3,
      8000,
    );
    expect(tried).toBe(true); // it kept knocking

    // And after all that failure the prompt is STILL there, waiting.
    expect(readQueue()).toHaveLength(1);
    expect(watch.isArmed()).toBe(true);
  }, 20000);

  it('a worker that ANSWERS the prompt clears it exactly once', async () => {
    // justify-done clears the id; the dispatcher's observed-effect gate sees an
    // empty queue and counts it a success, with no re-dispatch.
    process.env.JUSTIFY_WORKER_CMD = `printf '[]' > ${PROMPT_FILE}; exit 0`;
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 50, headless: true });
    dispatcher.start();

    const done = await waitFor(() => readQueue().length === 0);
    expect(done).toBe(true);

    await sleep(300); // give it several ticks to (wrongly) re-dispatch
    expect(readQueue()).toHaveLength(0);
    expect(watch.isArmed()).toBe(true);
  }, 20000);
});
