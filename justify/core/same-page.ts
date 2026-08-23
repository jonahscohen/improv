// Cross-page highlight (Jonah 2026-08-20): decide what a Review-panel click should
// do with a task's recorded `pageUrl` - highlight in place, change a hash route, or
// navigate to another document first (then highlight after load).
//
// Pure (no window, no `this`) so the whole decision is unit-testable directly.

export type PageNavDecision =
  // Same document (same origin + pathname): highlight the target in place now.
  | { kind: 'highlight' }
  // Same document but a DIFFERENT hash route (hash-router SPA): set the hash (no
  // page reload) and highlight after the route settles. No cross-load relay needed.
  | { kind: 'hash'; hash: string }
  // A different document: navigate there. `relay` is true only when the destination
  // is SAME-ORIGIN - sessionStorage is origin-scoped, so the on-load highlight relay
  // can only be read back after a same-origin navigation. Cross-origin still
  // navigates (lands the user on the right page) but cannot carry the highlight.
  | { kind: 'navigate'; href: string; relay: boolean };

// A task's pageUrl is always captured as window.location.href, so only an absolute
// http(s) URL is ever navigable; anything else (missing, relative, malformed) means
// "just highlight in place" so a click never sends the browser to a junk URL.
export function decidePageNav(pageUrl: string | undefined, currentHref: string): PageNavDecision {
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return { kind: 'highlight' };
  let target: URL;
  let here: URL;
  try {
    target = new URL(pageUrl, currentHref);
    here = new URL(currentHref);
  } catch {
    return { kind: 'highlight' };
  }
  const sameDoc = target.origin === here.origin && target.pathname === here.pathname;
  if (sameDoc) {
    // A query-string difference is still the same page (view state, not a route);
    // highlight in place. ANY hash difference is a hash-router route change - incl.
    // a hashless target from a hashed current URL (clears the hash), so a click from
    // one hash route to another (or back to base) always routes before highlighting.
    if (target.hash !== here.hash) return { kind: 'hash', hash: target.hash };
    return { kind: 'highlight' };
  }
  return { kind: 'navigate', href: target.href, relay: target.origin === here.origin };
}

// True when `pageUrl` points at the document we are already on (origin + pathname).
// Used to VALIDATE the on-load relay - only highlight if we actually arrived at the
// page the click meant to reach, so a stale/cross-origin/hand-mutated relay key can
// never fire a highlight on an unrelated refresh. A malformed/unparseable target
// returns FALSE (we cannot confirm arrival, so the stale key is dropped, not fired).
export function isSamePageUrl(pageUrl: string, currentHref: string): boolean {
  try {
    const target = new URL(pageUrl, currentHref);
    const here = new URL(currentHref);
    return target.origin === here.origin && target.pathname === here.pathname;
  } catch {
    return false;
  }
}
