import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WatchStateStore } from '../../server/watch-state.js';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('WatchStateStore', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jf-watch-state-'));
    path = join(dir, 'watch-state.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to disarmed with no file', () => {
    const store = new WatchStateStore(path);
    expect(store.isArmed()).toBe(false);
    expect(store.projectRoot()).toBeNull();
  });

  it('arm persists armed + projectRoot', () => {
    const store = new WatchStateStore(path);
    const state = store.arm('/some/project', 'jonah');
    expect(state.armed).toBe(true);
    expect(state.projectRoot).toBe('/some/project');
    expect(state.armedBy).toBe('jonah');
    expect(store.isArmed()).toBe(true);
  });

  it('RESUMES armed from disk on a fresh load (daemon restart)', () => {
    new WatchStateStore(path).arm('/proj/root', 'jonah');
    // Simulate a daemon restart: a brand new store reading the same file.
    const reloaded = new WatchStateStore(path);
    expect(reloaded.isArmed()).toBe(true);
    expect(reloaded.projectRoot()).toBe('/proj/root');
  });

  it('disarm persists and survives reload (with consent)', () => {
    const store = new WatchStateStore(path);
    store.arm('/proj/root', 'jonah');
    const res = store.disarm('jonah', { granted: true });
    expect(res.refused).toBe(false);
    expect(store.isArmed()).toBe(false);
    const reloaded = new WatchStateStore(path);
    expect(reloaded.isArmed()).toBe(false);
    expect(reloaded.get().disarmedBy).toBe('jonah');
  });

  describe('disarm is consent-gated (the watch must never stop silently)', () => {
    it('REFUSES to disarm with no consent argument, and stays armed', () => {
      const store = new WatchStateStore(path);
      store.arm('/proj/root', 'jonah');

      const res = store.disarm('some-agent');

      expect(res.refused).toBe(true);
      expect(res.reason).toBe('consent_required');
      expect(res.persisted).toBe(false);
      expect(store.isArmed()).toBe(true);
    });

    it('REFUSES when consent.granted is false or truthy-but-not-true', () => {
      const store = new WatchStateStore(path);
      store.arm('/proj/root', 'jonah');

      expect(store.disarm('agent', { granted: false }).refused).toBe(true);
      // guard against a sloppy truthiness check letting a string through
      expect(store.disarm('agent', { granted: 'yes' as unknown as boolean }).refused).toBe(true);
      expect(store.isArmed()).toBe(true);
    });

    it('a refused disarm does not touch disarmedAt/disarmedBy or the disk state', () => {
      const store = new WatchStateStore(path);
      store.arm('/proj/root', 'jonah');

      store.disarm('sneaky-agent');

      expect(store.get().disarmedBy).toBeNull();
      const reloaded = new WatchStateStore(path);
      expect(reloaded.isArmed()).toBe(true);
      expect(reloaded.projectRoot()).toBe('/proj/root');
    });

    it('a refused disarm leaves the watch usable: a later consented disarm works', () => {
      const store = new WatchStateStore(path);
      store.arm('/proj/root', 'jonah');

      expect(store.disarm('agent').refused).toBe(true);
      expect(store.disarm('jonah', { granted: true }).refused).toBe(false);
      expect(store.isArmed()).toBe(false);
    });
  });

  it('arm with empty projectRoot keeps the previous root', () => {
    const store = new WatchStateStore(path);
    store.arm('/proj/root', 'jonah');
    store.arm('', 'jonah');
    expect(store.projectRoot()).toBe('/proj/root');
    expect(store.isArmed()).toBe(true);
  });

  it('a corrupt state file loads as disarmed (safe default)', () => {
    writeFileSync(path, 'not json {{{');
    const store = new WatchStateStore(path);
    expect(store.isArmed()).toBe(false);
  });

  it('coerces a non-boolean armed value to false', () => {
    writeFileSync(path, JSON.stringify({ armed: 'yes', projectRoot: '/x' }));
    const store = new WatchStateStore(path);
    expect(store.isArmed()).toBe(false);
  });
});
