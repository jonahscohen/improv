// The real, unpatched timing functions, captured ONCE per page and cached on the
// window.
//
// freeze-animations.ts monkey-patches window.setTimeout / setInterval /
// requestAnimationFrame so the HOST PAGE's animation loops can be frozen. Justify's
// own chrome must never be caught by that patch - a toolbar whose tooltips, icon
// hovers, panel renders and daemon polling all stop the moment you press pause is a
// toolbar you cannot press pause OFF with.
//
// WHY THE CACHE IS ON THE WINDOW, not just a module const:
// Justify's bundle can be evaluated MORE THAN ONCE in the same page (ppai's own dev
// setup does exactly that - the core logs "Initializing..." twice). A second copy
// re-runs this module AFTER the first copy has already patched the globals, so a
// naive `window.setTimeout.bind(window)` would capture the PATCHED wrapper as its
// "original". Justify's escape hatch would then be no escape at all: the toolbar
// would freeze with the page, and - much worse - the freeze watchdog would schedule
// itself on the patched rAF, get queued, never run, and stop driving the scroll
// driver, leaving the page unscrollable while paused. Caching on the window means
// every copy shares the FIRST, pristine capture.
//
// core/timers-shim.ts re-exports these under the bare global names and is fed to
// esbuild's `inject`, which rewrites every free `setTimeout` / `requestAnimationFrame`
// identifier in the WHOLE bundle (Justify's call sites AND bundled Preact's
// scheduler) to point here. Only `window.setTimeout(...)` - an explicit member
// expression, which the host page uses and Justify deliberately does not - goes
// through the patch.

interface OriginalTimers {
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
  requestAnimationFrame: typeof requestAnimationFrame;
  cancelAnimationFrame: typeof cancelAnimationFrame;
}

const CACHE_KEY = '__justify_original_timers';

function capture(): OriginalTimers {
  const g = globalThis as unknown as Window & Record<string, unknown>;

  const existing = g[CACHE_KEY] as OriginalTimers | undefined;
  if (existing) return existing;

  const st: typeof setTimeout = g.setTimeout.bind(g);
  const ct: typeof clearTimeout = g.clearTimeout.bind(g);

  const timers: OriginalTimers = {
    setTimeout: st,
    setInterval: g.setInterval.bind(g),
    clearTimeout: ct,
    clearInterval: g.clearInterval.bind(g),
    // The fallbacks close over the ALREADY-CAPTURED originals. Re-reading
    // g.setTimeout at call time would resolve the patched wrapper, so the fallback
    // would schedule itself through the very freeze it exists to escape and hang
    // the moment the page is paused.
    requestAnimationFrame:
      typeof g.requestAnimationFrame === 'function'
        ? g.requestAnimationFrame.bind(g)
        : ((cb: FrameRequestCallback) => st(() => cb(Date.now()), 16) as unknown as number),
    cancelAnimationFrame:
      typeof g.cancelAnimationFrame === 'function'
        ? g.cancelAnimationFrame.bind(g)
        : ((id: number) => ct(id)),
  };

  try {
    g[CACHE_KEY] = timers;
  } catch {
    // A frozen/sealed global is survivable: this copy still holds a valid capture.
  }
  return timers;
}

const _t = capture();

export const originalSetTimeout = _t.setTimeout;
export const originalSetInterval = _t.setInterval;
export const originalClearTimeout = _t.clearTimeout;
export const originalClearInterval = _t.clearInterval;
export const originalRequestAnimationFrame = _t.requestAnimationFrame;
export const originalCancelAnimationFrame = _t.cancelAnimationFrame;
