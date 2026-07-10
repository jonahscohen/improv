import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DisarmConsentStore } from '../../server/consent.js';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('DisarmConsentStore', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jf-consent-'));
    path = join(dir, 'disarm-consent.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('refuses when no consent was ever issued', () => {
    const store = new DisarmConsentStore(path);
    expect(store.verifyAndConsume('anything')).toEqual({ ok: false, reason: 'consent_required' });
  });

  it('accepts the exact issued token exactly once', () => {
    const store = new DisarmConsentStore(path);
    const issued = store.issue('jonah');

    expect(store.verifyAndConsume(issued.token)).toEqual({ ok: true });
    // single use: the replay is refused
    expect(store.verifyAndConsume(issued.token)).toEqual({ ok: false, reason: 'consent_required' });
  });

  it('refuses a wrong token without consuming the real one', () => {
    const store = new DisarmConsentStore(path);
    const issued = store.issue('jonah');

    const wrong = 'f'.repeat(issued.token.length);
    expect(store.verifyAndConsume(wrong)).toEqual({ ok: false, reason: 'consent_mismatch' });
    // the legitimate consent survives a bad guess
    expect(store.verifyAndConsume(issued.token)).toEqual({ ok: true });
  });

  it('refuses a token of a different length (no timingSafeEqual throw)', () => {
    const store = new DisarmConsentStore(path);
    store.issue('jonah');
    expect(store.verifyAndConsume('short')).toEqual({ ok: false, reason: 'consent_mismatch' });
  });

  it('refuses and consumes an expired token', () => {
    const store = new DisarmConsentStore(path, 1000);
    const issued = store.issue('jonah', 0);

    expect(store.verifyAndConsume(issued.token, 1001)).toEqual({ ok: false, reason: 'consent_expired' });
    expect(existsSync(path)).toBe(false); // expired consent is destroyed, never replayable
  });

  it('refuses an empty/absent token even when a consent is live', () => {
    const store = new DisarmConsentStore(path);
    store.issue('jonah');
    expect(store.verifyAndConsume(null)).toEqual({ ok: false, reason: 'consent_required' });
    expect(store.verifyAndConsume('')).toEqual({ ok: false, reason: 'consent_required' });
  });

  it('a new issue supersedes the previous token', () => {
    const store = new DisarmConsentStore(path);
    const first = store.issue('jonah');
    const second = store.issue('jonah');

    expect(store.verifyAndConsume(first.token)).toEqual({ ok: false, reason: 'consent_mismatch' });
    expect(store.verifyAndConsume(second.token)).toEqual({ ok: true });
  });

  it('a corrupt consent file reads as no consent (fail closed)', () => {
    writeFileSync(path, '{ not json');
    const store = new DisarmConsentStore(path);
    expect(store.peek()).toBeNull();
    expect(store.verifyAndConsume('anything')).toEqual({ ok: false, reason: 'consent_required' });
  });

  it('a truncated consent file (no token field) reads as no consent', () => {
    writeFileSync(path, JSON.stringify({ issuedAt: Date.now() }));
    const store = new DisarmConsentStore(path);
    expect(store.verifyAndConsume('anything')).toEqual({ ok: false, reason: 'consent_required' });
  });

  it('tokens are unguessable and unique per issue', () => {
    const store = new DisarmConsentStore(path);
    const a = store.issue('jonah').token;
    const b = store.issue('jonah').token;
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
