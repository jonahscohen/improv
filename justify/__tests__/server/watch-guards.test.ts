import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WatchStateStore } from '../../server/watch-state.js';
import { Dispatcher } from '../../server/dispatcher.js';
import { DisarmConsentStore } from '../../server/consent.js';

// The two guarantees Jonah asked for, tested as behaviour:
//
//   1. Justify never silently STOPS watching / receiving.
//   2. Nothing disarms the watch without the user's consent.
//
// These are regression tests for a real incident (2026-07-09): an agent killed
// the running worker and then ran `justify-watch-disarm` to "unblock" itself.
// The user's queued changes stopped being applied and nothing told him.

describe('guarantee 2: the watch cannot be disarmed without human consent', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jf-guards-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('an agent calling disarm() directly is refused and the watch keeps running', () => {
    const store = new WatchStateStore(join(dir, 'watch-state.json'));
    store.arm('/proj', 'jonah');

    const res = store.disarm('claude');

    expect(res.refused).toBe(true);
    expect(store.isArmed()).toBe(true);
  });

  it('a consent token minted for one disarm cannot be replayed for a second', () => {
    const store = new WatchStateStore(join(dir, 'watch-state.json'));
    const consent = new DisarmConsentStore(join(dir, 'consent.json'));

    store.arm('/proj', 'jonah');
    const token = consent.issue('jonah').token;

    // first (legitimate) disarm
    expect(consent.verifyAndConsume(token).ok).toBe(true);
    expect(store.disarm('jonah', { granted: true }).refused).toBe(false);

    // user re-arms; the OLD token must not work again
    store.arm('/proj', 'jonah');
    expect(consent.verifyAndConsume(token)).toEqual({ ok: false, reason: 'consent_required' });
    expect(store.disarm('claude').refused).toBe(true);
    expect(store.isArmed()).toBe(true);
  });

  it('an expired consent cannot disarm', () => {
    const store = new WatchStateStore(join(dir, 'watch-state.json'));
    const consent = new DisarmConsentStore(join(dir, 'consent.json'), 1000);
    store.arm('/proj', 'jonah');

    const token = consent.issue('jonah', 0).token;
    const verdict = consent.verifyAndConsume(token, 5000);

    expect(verdict).toEqual({ ok: false, reason: 'consent_expired' });
    expect(store.disarm('jonah', { granted: verdict.ok }).refused).toBe(true);
    expect(store.isArmed()).toBe(true);
  });
});

describe('guarantee 1: an armed watch never silently stops receiving', () => {
  let dir: string;
  let promptFile: string;
  let store: WatchStateStore;

  const writePrompts = (prompts: unknown[]) => writeFileSync(promptFile, JSON.stringify(prompts));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jf-guards-disp-'));
    promptFile = join(dir, 'prompts.json');
    store = new WatchStateStore(join(dir, 'watch-state.json'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const makeDispatcher = () =>
    new Dispatcher(store, { port: 1, stateDir: dir, workerScript: undefined, tickMs: 999999 });

  it('running() reports whether the dispatch loop is actually alive', () => {
    const d = makeDispatcher();
    expect(d.running()).toBe(false);
    d.start();
    expect(d.running()).toBe(true);
    d.stop();
    expect(d.running()).toBe(false);
  });

  it('armed + queued + dispatcher stopped == STALLED (not a quiet green light)', () => {
    store.arm('/proj', 'jonah');
    writePrompts([{ id: 'prompt-1', prompt: 'make it blue' }]);

    const d = makeDispatcher(); // never started
    expect(d.running()).toBe(false);
    expect(d.stalled()).toBe(true);
    expect(d.status().stalled).toBe(true);
    expect(d.status().dispatcherRunning).toBe(false);
  });

  it('armed + queued + dispatcher running is also stalled until a worker claims it', () => {
    store.arm('/proj', 'jonah');
    writePrompts([{ id: 'prompt-1', prompt: 'make it blue' }]);

    const d = makeDispatcher();
    d.start();
    try {
      // claimable work sitting there with no worker running
      expect(d.stalled()).toBe(true);
    } finally {
      d.stop();
    }
  });

  it('is NOT stalled when the queue is empty', () => {
    store.arm('/proj', 'jonah');
    writePrompts([]);

    const d = makeDispatcher();
    d.start();
    try {
      expect(d.stalled()).toBe(false);
      expect(d.pendingCount()).toBe(0);
    } finally {
      d.stop();
    }
  });

  it('is NOT stalled when disarmed (disarmed is a separate, visible state)', () => {
    writePrompts([{ id: 'prompt-1', prompt: 'make it blue' }]);
    const d = makeDispatcher();
    d.start();
    try {
      expect(store.isArmed()).toBe(false);
      expect(d.stalled()).toBe(false);
    } finally {
      d.stop();
    }
  });

  it('a prompt already claimed by a live worker is not counted as stalled', () => {
    store.arm('/proj', 'jonah');
    writePrompts([{ id: 'prompt-1', prompt: 'x', claimedBy: 'daemon-worker:1', claimedAt: Date.now() }]);

    const d = makeDispatcher();
    d.start();
    try {
      expect(d.stalled()).toBe(false);
      expect(d.pendingCount()).toBe(1);
    } finally {
      d.stop();
    }
  });

  it('a STALE claim (dead worker) is reclaimable, so it counts as stalled', () => {
    store.arm('/proj', 'jonah');
    // claimTtlMs default is 2400000; back-date the claim well past it
    writePrompts([{ id: 'prompt-1', prompt: 'x', claimedBy: 'daemon-worker:dead', claimedAt: 1 }]);

    const d = makeDispatcher();
    d.start();
    try {
      expect(d.stalled()).toBe(true);
    } finally {
      d.stop();
    }
  });
});
