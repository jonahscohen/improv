// =============================================================================
// Freeze Animations
// =============================================================================
//
// PORTED from Agentation (Jonah's own package), which is where this behaviour was
// designed and battle-tested:
//   agentation/package/src/utils/freeze-animations.ts
//
// Kept from the original, deliberately:
//   - setTimeout / setInterval / requestAnimationFrame are monkey-patched. While
//     frozen, timeout + rAF callbacks are QUEUED and replayed on unfreeze; interval
//     callbacks are skipped. Patches install once and the state lives on window so
//     it survives a module re-execution.
//   - CSS injection pauses CSS animations and kills transitions.
//   - WAAPI: only RUNNING animations are paused. This subtlety is load-bearing -
//     pausing a FINISHED animation would restart it on play() and break entrance
//     animations. Do not "simplify" it away.
//   - Videos: paused, and only the ones we actually paused are resumed. (Tracked in
//     a WeakSet rather than Agentation's data-was-paused attribute: writing that
//     attribute onto the host's own <video> is residue, and it collides with a host
//     that already uses the name.)
//   - On unfreeze, WAAPI animations are resumed BEFORE the CSS is removed; removing
//     the CSS first can make the browser replace the animation objects.
//   - Queued callbacks re-check `frozen` before replaying, and re-queue if the page
//     was frozen again in between.
//
// -----------------------------------------------------------------------------
// THE GOVERNING PRINCIPLE (Jonah)
//
//   Pause kills motion the user did not ask for. It leaves motion the user is
//   causing.
//
// What makes a page impossible to annotate is not "animation" - it is motion that
// happens WHILE THE USER IS HOLDING STILL: ambient loops, autoplay, carousels,
// count-ups, entrance reveals firing on their own clock. That is what this kills.
//
// The acceptance test, with pause ON:
//   - Hold perfectly still -> nothing moves. Not one pixel.
//   - Scroll or hover -> the page responds normally.
//
// Four adaptations follow from that principle. Each is measured, not assumed.
// -----------------------------------------------------------------------------
//
// (1) THE EXCLUSION LIST IS JUSTIFY'S, NOT AGENTATION'S.
//     Agentation excludes its own UI by [data-feedback-toolbar] etc. Porting that
//     list verbatim would exclude AGENTATION's elements and merrily freeze
//     JUSTIFY's toolbar - the bar would lock up the instant you pressed pause.
//     Justify's chrome is marked [data-justify]. It also lives in a SHADOW ROOT,
//     and Element.closest() does not climb out of one, so the ownership check walks
//     through ShadowRoot.host rather than using closest().
//
// (2) THE PAGE MUST STAY SCROLLABLE. "Not being able to scroll the page makes
//     review impossible." On an ordinary page native scroll is not rAF-driven, so
//     scrolling keeps working while frozen - that IS Agentation's design. Lenis is
//     the anomaly: it preventDefaults the wheel and drives the real scroll from a
//     rAF loop, so our rAF patch would queue its callback, kill its loop, and leave
//     the page completely unscrollable. Restoring scroll here is not an exception to
//     Agentation's design, it RESTORES it on a Lenis page. See scroll drivers below.
//
// (3) SCROLL-DRIVEN CSS ANIMATIONS ARE LEFT RUNNING (animation-timeline: scroll()
//     / view()). They are USER-driven: they only advance because the user scrolled,
//     they stop when the user stops, and they never move under a still cursor. A
//     scrubbed band frozen at a half-closed offset just reads as broken layout.
//     CSS cannot select "has a scroll timeline", so they are identified at runtime
//     from Animation.timeline and re-started through the WAAPI.
//     MEASURED in Chrome: an explicit WAAPI play() OVERRIDES the declarative
//     `animation-play-state: paused !important` - the scroll-driven bar tracked
//     scroll again while a time-based spinner beside it stayed frozen.
//
// (4) PAUSE MUST NEVER LEAVE CONTENT INVISIBLE. A modern entrance reveal holds its
//     hidden state with `both` fill (from { opacity: 0 }). Scroll down while paused
//     to a section that has not revealed yet and its IntersectionObserver fires -
//     IO is neither timer- nor rAF-driven, so nothing here stops it. The animation
//     is applied, `animation-play-state: paused` freezes it AT ITS FIRST FRAME, and
//     the content is now permanently INVISIBLE: the user is scrolling through blank
//     space, unable to annotate the very thing they scrolled down to look at. That
//     is the pause feature destroying its own purpose.
//     So: an animation ALREADY RUNNING when pause is pressed is FROZEN IN PLACE
//     (that is the point - annotate a specific frame), but an animation that had NOT
//     YET STARTED and is triggered while paused is SETTLED INSTANTLY to its end
//     state via finish(): no motion, content fully visible and annotatable. This is
//     the cousin of Agentation's do-not-pause-finished-animations subtlety - same
//     family, opposite end.
//     MEASURED in Chrome: finish() settles such an animation to its end state even
//     with the CSS pause rule still in the cascade.
//
// Transitions keep Agentation's `transition: none !important`. A transition is
// user-caused (a hover) and instantaneous rather than moving, so it satisfies the
// acceptance test; and it makes a transition-driven reveal settle instantly too,
// which serves (4).
// =============================================================================

import {
  originalSetTimeout,
  originalSetInterval,
  originalClearTimeout,
  originalRequestAnimationFrame,
  originalCancelAnimationFrame,
} from './original-timers';

const EXCLUDE_ATTRS = ['data-justify', 'data-justify-host'];
const NOT_SELECTORS = EXCLUDE_ATTRS.flatMap((a) => [`:not([${a}])`, `:not([${a}] *)`]).join('');

const STYLE_ID = 'justify-freeze-styles';
const STATE_KEY = '__justify_freeze';
const PAUSED_ATTR = 'data-justify-paused';

interface ScrollDriver {
  raf: (time: number) => void;
  reset?: () => void;
}

// A callback parked while frozen, tagged with the id the host page holds. The id is
// what lets a host clearTimeout()/cancelAnimationFrame() still cancel it - without
// it, a component torn down mid-pause would be handed a stale callback on resume.
interface Parked<T> {
  id: number;
  fn: T;
}

interface FreezeState {
  frozen: boolean;
  installed: boolean;
  pausedAnimations: Animation[];
  frozenTimeoutQueue: Array<Parked<() => void>>;
  frozenRAFQueue: Array<Parked<FrameRequestCallback>>;
  // Videos WE paused. A WeakSet rather than a data-was-paused attribute on the host's
  // own <video>: the attribute both writes residue into the page and collides with a
  // host that happens to use that name.
  pausedVideos: WeakSet<HTMLVideoElement>;
  // Bumped on every freeze. The watchdog loop carries the generation it was born in
  // and dies if it is stale, so a fast unfreeze/refreeze cannot leave two loops
  // running - which would double-drive the scroll driver.
  generation: number;
  // Every animation already accounted for. Anything appearing later is, by
  // definition, one the user's own scroll triggered while paused.
  known: Set<Animation>;
  drivers: ScrollDriver[];
  watchdog: number | null;
  // Total ms spent frozen. Subtracted from every rAF timestamp so a paused page's
  // clock does not advance - see the comment on the rAF patch.
  clockOffset: number;
  frozenAt: number;
}

function getState(): FreezeState {
  const w = window as unknown as Record<string, unknown>;
  if (!w[STATE_KEY]) {
    w[STATE_KEY] = {
      frozen: false,
      installed: false,
      pausedAnimations: [],
      frozenTimeoutQueue: [],
      frozenRAFQueue: [],
      pausedVideos: new WeakSet<HTMLVideoElement>(),
      generation: 0,
      known: new Set<Animation>(),
      drivers: [],
      watchdog: null,
      clockOffset: 0,
      frozenAt: 0,
    } as FreezeState;
  }
  return w[STATE_KEY] as FreezeState;
}

const _s: FreezeState = typeof window === 'undefined'
  ? ({
      frozen: false, installed: true, pausedAnimations: [], frozenTimeoutQueue: [],
      frozenRAFQueue: [], pausedVideos: new WeakSet(), generation: 0,
      known: new Set(), drivers: [], watchdog: null, clockOffset: 0, frozenAt: 0,
    } as FreezeState)
  : getState();

// ---------------------------------------------------------------------------
// Install patches (once)
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined' && !_s.installed) {
  // Queue the callback when frozen; replayed on unfreeze.
  (window as unknown as Record<string, unknown>).setTimeout = (
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): ReturnType<typeof setTimeout> => {
    if (typeof handler === 'string') return originalSetTimeout(handler, timeout);
    // `id` is captured by reference: it is assigned before the timer can fire, so the
    // parked entry always carries the id the host page is holding.
    let id: number;
    id = originalSetTimeout(
      (...a: unknown[]) => {
        if (_s.frozen) {
          _s.frozenTimeoutQueue.push({ id, fn: () => (handler as (...x: unknown[]) => void)(...a) });
        } else {
          (handler as (...x: unknown[]) => void)(...a);
        }
      },
      timeout,
      ...args,
    ) as unknown as number;
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  // Skip the callback when frozen.
  (window as unknown as Record<string, unknown>).setInterval = (
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): ReturnType<typeof setInterval> => {
    if (typeof handler === 'string') return originalSetInterval(handler, timeout);
    return originalSetInterval(
      (...a: unknown[]) => {
        if (!_s.frozen) (handler as (...x: unknown[]) => void)(...a);
      },
      timeout,
      ...args,
    );
  };

  // Queue the callback when frozen. Otherwise run it, but on the VIRTUAL clock.
  //
  // The virtual clock (real minus total time spent frozen) is what makes a
  // rAF-driven animation resume EXACTLY where it left off instead of snapping to
  // its end. ppai's stat count-up is the worked example: it does `start = now` on
  // its first frame and `t = (now - start) / DURATION`. Replay its queued callback
  // with a raw timestamp after a 20-second pause and t >= 1, so the number jumps
  // straight to its final value - a restart, not a resume. Subtracting the frozen
  // time makes the elapsed continuous across the pause.
  (window as unknown as Record<string, unknown>).requestAnimationFrame = (
    callback: FrameRequestCallback,
  ): number => {
    let id: number;
    id = originalRequestAnimationFrame((ts: number) => {
      if (_s.frozen) _s.frozenRAFQueue.push({ id, fn: callback });
      else callback(ts - _s.clockOffset);
    });
    return id;
  };

  // Cancellation must still reach a callback that has been PARKED. Without this, a
  // host component torn down mid-pause is handed a stale callback on resume.
  (window as unknown as Record<string, unknown>).clearTimeout = (id?: number): void => {
    originalClearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    if (id === undefined) return;
    const i = _s.frozenTimeoutQueue.findIndex((p) => p.id === id);
    if (i !== -1) _s.frozenTimeoutQueue.splice(i, 1);
  };

  (window as unknown as Record<string, unknown>).cancelAnimationFrame = (id: number): void => {
    originalCancelAnimationFrame(id);
    const i = _s.frozenRAFQueue.findIndex((p) => p.id === id);
    if (i !== -1) _s.frozenRAFQueue.splice(i, 1);
  };

  _s.installed = true;
}

// Re-exported for any Justify code that needs to bypass the patch explicitly.
// (The bundle-wide bypass is core/timers-shim.ts via esbuild `inject`.)
export { originalSetTimeout, originalSetInterval, originalRequestAnimationFrame };

// ---------------------------------------------------------------------------
// Ownership: is this element part of Justify's own chrome?
// ---------------------------------------------------------------------------
// document.getAnimations() reaches into shadow trees, and Justify's toolbar lives
// in one. Element.closest() stops at the shadow boundary, so we climb through
// ShadowRoot.host instead. Getting this wrong freezes the toolbar itself.
function isJustifyOwned(node: Node | null): boolean {
  let n: Node | null = node;
  while (n) {
    if (n.nodeType === 1) {
      const el = n as Element;
      for (const attr of EXCLUDE_ATTRS) {
        if (el.hasAttribute(attr)) return true;
      }
      n = el.parentNode;
    } else if (n.nodeType === 11) {
      n = (n as ShadowRoot).host ?? null;
    } else {
      n = n.parentNode;
    }
  }
  return false;
}

function animationTarget(anim: Animation): Element | null {
  const effect = anim.effect as KeyframeEffect | null;
  const target = effect ? (effect.target as Element | null) : null;
  return target && target.nodeType === 1 ? target : null;
}

// Scroll-driven == its clock is the scroll position, not the wall clock.
function isScrollDriven(anim: Animation): boolean {
  const timeline = anim.timeline as unknown as { constructor?: { name?: string } } | null;
  if (!timeline) return false;
  const w = window as unknown as Record<string, unknown>;
  for (const name of ['ScrollTimeline', 'ViewTimeline']) {
    const Ctor = w[name];
    if (typeof Ctor === 'function' && anim.timeline instanceof (Ctor as new () => object)) return true;
  }
  const n = timeline.constructor && timeline.constructor.name;
  return n === 'ScrollTimeline' || n === 'ViewTimeline';
}

// finish() throws on an endless animation, and an ambient loop has no end state to
// settle to anyway.
function isEndless(anim: Animation): boolean {
  try {
    const timing = anim.effect?.getComputedTiming();
    if (!timing) return true;
    if (timing.iterations === Infinity) return true;
    return !Number.isFinite(Number(timing.activeDuration));
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Classify one animation. `isNew` = it appeared AFTER pause was pressed, which can
// only be the user's own scroll (or hover) triggering it.
// ---------------------------------------------------------------------------
function classify(anim: Animation, isNew: boolean): void {
  if (isJustifyOwned(animationTarget(anim))) return;

  // (3) User-driven. Keep it tracking the scroll. play() overrides the CSS pause.
  if (isScrollDriven(anim)) {
    try {
      anim.play();
    } catch {}
    return;
  }

  if (isNew) {
    // (4) Never leave content invisible. Settle it to its end state: no motion,
    // fully visible, annotatable.
    if (isEndless(anim)) {
      try {
        anim.pause();
        _s.pausedAnimations.push(anim);
      } catch {}
      return;
    }
    try {
      anim.finish();
    } catch {}
    return;
  }

  // Already in flight when pause was pressed -> freeze the frame. Only RUNNING
  // ones: pausing a finished animation would restart it on play().
  if (anim.playState !== 'running') return;
  try {
    anim.pause();
    _s.pausedAnimations.push(anim);
  } catch {}
}

// ---------------------------------------------------------------------------
// Scroll drivers (adaptation 2)
// ---------------------------------------------------------------------------
// A scroll driver is the rAF loop a smooth-scroll library uses to move the page.
// It is USER-driven, so pause must not touch it - but our rAF patch would queue its
// callback and kill its loop, and because Lenis preventDefaults the wheel, native
// scrolling does NOT come back. The page would be completely unscrollable.
//
// We do not try to recognise the library's CALLBACK (brittle, and the callback is
// an anonymous closure we never see). We find its INSTANCE and drive it ourselves
// from the watchdog, on the unpatched rAF, with the REAL clock - a scroll driver
// interpolates in real time, and the frozen virtual clock would hand it dt = 0 and
// it would never move.
function findScrollDrivers(): ScrollDriver[] {
  const w = window as unknown as Record<string, any>;
  const out: ScrollDriver[] = [];

  // Explicit opt-in. Any project or library can register its own scroll loop:
  //   window.__justifyScrollDrivers = [fn]  or  [{ raf(t) {...} }]
  const declared = w.__justifyScrollDrivers;
  if (Array.isArray(declared)) {
    for (const d of declared) {
      if (typeof d === 'function') out.push({ raf: d as (t: number) => void });
      else if (d && typeof d.raf === 'function') out.push(d as ScrollDriver);
    }
  }

  // Lenis. The vendor bundle assigns the CONSTRUCTOR to the global, so any instance
  // can be found by identity rather than by guessing what variable it was stored in
  // (ppai calls it window.ppaiLenis; another project will call it something else).
  if (typeof w.Lenis === 'function') {
    for (const key of Object.getOwnPropertyNames(w)) {
      let v: unknown;
      try {
        v = w[key];
      } catch {
        continue;
      }
      if (v && v instanceof w.Lenis && typeof (v as ScrollDriver).raf === 'function') {
        if (!out.includes(v as ScrollDriver)) out.push(v as ScrollDriver);
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// The watchdog: one loop, on the UNPATCHED rAF, running only while frozen.
// ---------------------------------------------------------------------------
// One pass of the watchdog. Exported so it can be pumped by hand in environments
// with no live rAF: under jsdom, patching window.setInterval starves jsdom's own
// internal frame driver, so even the ORIGINAL rAF stops delivering once the page is
// frozen. That is a jsdom artifact - a real browser's rAF is native and completely
// unaffected - but it means the tests have to drive this directly.
export function pumpFreezeWatchdog(realTs: number): void {
  if (!_s.frozen) return;

  // Keep the page scrollable.
  for (const d of _s.drivers) {
    try {
      d.raf(realTs);
    } catch {}
  }

  // Catch whatever the user's scroll just triggered and settle it (adaptation 4),
  // and keep any newly-created scroll-linked animation tracking (adaptation 3).
  try {
    for (const anim of document.getAnimations()) {
      if (_s.known.has(anim)) continue;
      _s.known.add(anim);
      classify(anim, true);
    }
  } catch {}
}

function startWatchdog(): void {
  // A frame scheduled by the PREVIOUS freeze can still be in flight when the user
  // toggles pause off and straight back on. It would see frozen === true again and
  // start a second loop, double-driving the scroll driver. The generation token
  // makes the stale loop retire instead.
  const gen = _s.generation;
  const step = (realTs: number): void => {
    if (!_s.frozen || _s.generation !== gen) return;
    pumpFreezeWatchdog(realTs);
    _s.watchdog = originalRequestAnimationFrame(step);
  };
  _s.watchdog = originalRequestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// Freeze / Unfreeze
// ---------------------------------------------------------------------------

export function freeze(): void {
  if (typeof document === 'undefined' || _s.frozen) return;
  _s.frozen = true;
  _s.generation++;
  _s.frozenAt = performance.now();
  _s.frozenTimeoutQueue = [];
  _s.frozenRAFQueue = [];
  _s.pausedAnimations = [];
  _s.known = new Set<Animation>();
  _s.drivers = findScrollDrivers();

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
  }
  style.textContent = `
    *${NOT_SELECTORS},
    *${NOT_SELECTORS}::before,
    *${NOT_SELECTORS}::after {
      animation-play-state: paused !important;
      transition: none !important;
    }
  `;
  document.head.appendChild(style);

  try {
    for (const anim of document.getAnimations()) {
      _s.known.add(anim);
      classify(anim, false);
    }
  } catch {
    // getAnimations may not exist in every environment
  }

  document.querySelectorAll('video').forEach((video) => {
    if (isJustifyOwned(video)) return;
    if (!video.paused) {
      _s.pausedVideos.add(video);
      video.pause();
    }
  });

  // The opt-in signal, for the one class of motion nothing above can settle: a JS
  // rAF loop. We freeze such a loop (its callbacks are queued), but we cannot
  // discover its "end state" the way finish() does for an animation - so ppai's
  // stat count-up, triggered by a scroll while paused, holds at 0 rather than at
  // its real number. A page that cares can honour either of these and jump its own
  // counter to the final value. Nothing is required to; nothing breaks if it does not.
  document.documentElement.setAttribute(PAUSED_ATTR, '');
  document.dispatchEvent(new CustomEvent('justify:animations-paused'));

  startWatchdog();
}

export function unfreeze(): void {
  if (typeof document === 'undefined' || !_s.frozen) return;
  _s.frozen = false;

  // Close the virtual clock's gap BEFORE any queued callback replays, so the
  // timestamp they receive is continuous with the one they last saw.
  _s.clockOffset += performance.now() - _s.frozenAt;

  if (_s.watchdog !== null) {
    originalCancelAnimationFrame(_s.watchdog);
    _s.watchdog = null;
  }

  // A scroll driver was being fed the REAL clock by the watchdog; its own loop is
  // about to resume on the virtual clock, which is behind by clockOffset. reset()
  // drops any in-flight glide and re-syncs the driver to the true scroll offset,
  // so that one-frame negative delta lands on a driver with nothing to advance.
  for (const d of _s.drivers) {
    try {
      d.reset?.();
    } catch {}
  }
  _s.drivers = [];

  const timeoutQueue = _s.frozenTimeoutQueue;
  _s.frozenTimeoutQueue = [];
  for (const parked of timeoutQueue) {
    originalSetTimeout(() => {
      if (_s.frozen) {
        _s.frozenTimeoutQueue.push(parked);
        return;
      }
      try {
        parked.fn();
      } catch (e) {
        console.warn('[justify] Error replaying queued timeout:', e);
      }
    }, 0);
  }

  const rafQueue = _s.frozenRAFQueue;
  _s.frozenRAFQueue = [];
  for (const parked of rafQueue) {
    originalRequestAnimationFrame((ts: number) => {
      if (_s.frozen) {
        _s.frozenRAFQueue.push(parked);
        return;
      }
      parked.fn(ts - _s.clockOffset);
    });
  }

  // Resume the exact animations we paused BEFORE removing the CSS - removing the
  // CSS first can make the browser replace the animation objects.
  for (const anim of _s.pausedAnimations) {
    try {
      anim.play();
    } catch (e) {
      console.warn('[justify] Error resuming animation:', e);
    }
  }
  _s.pausedAnimations = [];
  _s.known = new Set<Animation>();

  document.getElementById(STYLE_ID)?.remove();

  document.querySelectorAll('video').forEach((video) => {
    if (_s.pausedVideos.has(video)) {
      _s.pausedVideos.delete(video);
      video.play().catch(() => {});
    }
  });

  document.documentElement.removeAttribute(PAUSED_ATTR);
  document.dispatchEvent(new CustomEvent('justify:animations-resumed'));
}

export function setFrozen(next: boolean): void {
  if (next) freeze();
  else unfreeze();
}

export function isFrozen(): boolean {
  return _s.frozen;
}
