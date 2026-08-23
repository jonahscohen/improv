import { describe, it, expect } from 'vitest';
import { decidePageNav, isSamePageUrl } from '../../core/same-page.js';

// Cross-page highlight (Jonah 2026-08-20): a Review-panel click highlights in place
// when the task's change is on the page we are on, changes the hash for a hash-route
// SPA, and navigates first for a different document (carrying the highlight only when
// the destination is same-origin). These exercise the pure decision + arrival guard.
describe('decidePageNav: what a Review-panel click does with a task pageUrl', () => {
  const here = 'https://app.test/dashboard?tab=1';

  it('same origin + pathname -> highlight in place', () => {
    expect(decidePageNav('https://app.test/dashboard', here)).toEqual({ kind: 'highlight' });
  });

  it('a differing query string is still the same page -> highlight', () => {
    expect(decidePageNav('https://app.test/dashboard?tab=9', here)).toEqual({ kind: 'highlight' });
  });

  it('same document, different hash -> hash-route change (no reload)', () => {
    expect(decidePageNav('https://app.test/dashboard#/settings', here)).toEqual({ kind: 'hash', hash: '#/settings' });
  });

  it('a hashless target from a hashed current url -> hash-route change that clears the hash', () => {
    expect(decidePageNav('https://app.test/dashboard', 'https://app.test/dashboard#/settings'))
      .toEqual({ kind: 'hash', hash: '' });
  });

  it('different pathname, same origin -> navigate WITH relay', () => {
    expect(decidePageNav('https://app.test/settings', here)).toEqual({
      kind: 'navigate', href: 'https://app.test/settings', relay: true,
    });
  });

  it('different origin -> navigate WITHOUT relay (sessionStorage cannot cross origins)', () => {
    expect(decidePageNav('https://other.test/dashboard', here)).toEqual({
      kind: 'navigate', href: 'https://other.test/dashboard', relay: false,
    });
  });

  it('missing / relative / non-absolute pageUrl -> highlight in place (never navigate to junk)', () => {
    expect(decidePageNav(undefined, here)).toEqual({ kind: 'highlight' });
    expect(decidePageNav('', here)).toEqual({ kind: 'highlight' });
    expect(decidePageNav('/settings', here)).toEqual({ kind: 'highlight' });
    expect(decidePageNav('app.test/settings', here)).toEqual({ kind: 'highlight' });
  });

  it('an unparseable url -> highlight in place', () => {
    expect(decidePageNav('http://\n bad', here)).toEqual({ kind: 'highlight' });
  });
});

describe('isSamePageUrl: on-load relay arrival guard', () => {
  it('true only when we actually landed on the intended document', () => {
    const arrived = 'https://app.test/settings?ref=x';
    expect(isSamePageUrl('https://app.test/settings', arrived)).toBe(true); // arrived (query ignored)
    expect(isSamePageUrl('https://app.test/dashboard', arrived)).toBe(false); // wrong path -> drop stale key
    expect(isSamePageUrl('https://other.test/settings', arrived)).toBe(false); // wrong origin -> drop
  });

  it('a malformed stored target fails the guard (dropped, never fires a highlight)', () => {
    // Cannot confirm arrival -> false; the caller has already removed the key, so a
    // corrupted/hand-mutated relay value can never fire a highlight on a refresh.
    expect(isSamePageUrl('http://\n bad', 'https://app.test/x')).toBe(false);
  });
});
