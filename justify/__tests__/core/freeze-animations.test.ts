// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freeze, unfreeze, setFrozen, isFrozen, pumpFreezeWatchdog } from '../../core/freeze-animations.js';
import {
  originalSetTimeout,
  originalRequestAnimationFrame,
} from '../../core/original-timers.js';

// The test harness itself must bypass the freeze. In the real bundle esbuild's
// `inject` does this for every Justify call site automatically (build.js); vitest
// does not run that transform, so here we reach for the originals by hand. That
// these helpers HANG without this is itself the proof that the patch bites.
const realTimeout = originalSetTimeout;
const realRAF = originalRequestAnimationFrame;

// jsdom has no Web Animations API, so the WAAPI layer is driven through a stub of
// document.getAnimations(). The CSS injection, the <video> handling, the timer
// patches and the scroll-driver discovery are all real and asserted as such.
interface FakeAnim {
  playState: string;
  timeline: object | null;
  effect: { target: Element | null; getComputedTiming: () => { iterations: number; activeDuration: number } } | null;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  finish: ReturnType<typeof vi.fn>;
}

class ScrollTimeline {}
class ViewTimeline {}

function anim(
  target: Element | null,
  opts: { playState?: string; timeline?: object | null; iterations?: number } = {},
): FakeAnim {
  const a: FakeAnim = {
    playState: opts.playState ?? 'running',
    timeline: opts.timeline ?? {},
    effect: {
      target,
      getComputedTiming: () => ({
        iterations: opts.iterations ?? 1,
        activeDuration: opts.iterations === Infinity ? Infinity : 1000,
      }),
    },
    pause: vi.fn(() => {
      a.playState = 'paused';
    }),
    play: vi.fn(() => {
      a.playState = 'running';
    }),
    finish: vi.fn(() => {
      a.playState = 'finished';
    }),
  };
  return a;
}

function setAnimations(list: FakeAnim[]): void {
  (document as unknown as { getAnimations: () => unknown[] }).getAnimations = () => list;
}

function styleEl(): HTMLElement | null {
  return document.getElementById('justify-freeze-styles');
}

// In a real browser the watchdog rides the ORIGINAL rAF. Under jsdom, patching
// window.setInterval starves jsdom's own frame driver, so once the page is frozen
// even the original rAF stops delivering - a jsdom artifact, not a browser one.
// So drive the watchdog directly. The live rAF loop is verified in Chrome instead.
function frames(n = 2): Promise<void> {
  for (let i = 0; i < n; i++) pumpFreezeWatchdog(performance.now());
  return Promise.resolve();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => realTimeout(resolve, ms));
}

describe('freeze-animations (ported from Agentation)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    setAnimations([]);
    (window as any).ScrollTimeline = ScrollTimeline;
    (window as any).ViewTimeline = ViewTimeline;
    delete (window as any).Lenis;
    delete (window as any).__justifyScrollDrivers;
  });

  afterEach(() => {
    unfreeze();
  });

  describe('the CSS layer', () => {
    it('injects the pause+transition rule and removes it on unfreeze, leaving no residue', () => {
      freeze();
      expect(isFrozen()).toBe(true);
      const css = styleEl()!.textContent!;
      expect(css).toContain('animation-play-state: paused !important');
      expect(css).toContain('transition: none !important');

      unfreeze();
      expect(isFrozen()).toBe(false);
      expect(styleEl()).toBeNull();
    });

    it('excludes JUSTIFY chrome, not Agentation chrome (the port trap)', () => {
      freeze();
      const css = styleEl()!.textContent!;
      expect(css).toContain(':not([data-justify])');
      expect(css).toContain(':not([data-justify] *)');
      // Porting Agentation's list verbatim would have frozen Justify's own toolbar.
      expect(css).not.toContain('data-feedback-toolbar');
    });

    it('is idempotent - a second freeze does not stack a second stylesheet', () => {
      freeze();
      freeze();
      expect(document.head.querySelectorAll('#justify-freeze-styles')).toHaveLength(1);
    });
  });

  describe('classification of animations already in flight', () => {
    it('freezes a RUNNING time-based animation in place and resumes it', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const a = anim(el, { playState: 'running' });
      setAnimations([a]);

      freeze();
      expect(a.pause).toHaveBeenCalledTimes(1);

      unfreeze();
      expect(a.play).toHaveBeenCalledTimes(1);
    });

    it('never pauses a FINISHED animation - pausing it would restart it on play() and break entrance anims', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const done = anim(el, { playState: 'finished' });
      setAnimations([done]);

      freeze();
      expect(done.pause).not.toHaveBeenCalled();

      unfreeze();
      expect(done.play).not.toHaveBeenCalled();
    });

    it('LEAVES SCROLL-DRIVEN animations running so they keep tracking the user\'s scroll', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const scrollAnim = anim(el, { timeline: new ScrollTimeline() });
      const viewAnim = anim(el, { timeline: new ViewTimeline() });
      setAnimations([scrollAnim, viewAnim]);

      freeze();
      // They are user-driven: they only advance because the user scrolled. The CSS
      // rule paused them; an explicit play() overrides it (measured in Chrome).
      expect(scrollAnim.play).toHaveBeenCalledTimes(1);
      expect(viewAnim.play).toHaveBeenCalledTimes(1);
      expect(scrollAnim.pause).not.toHaveBeenCalled();
      expect(viewAnim.pause).not.toHaveBeenCalled();
    });

    it('never touches Justify\'s own chrome, including inside its shadow root', () => {
      const host = document.createElement('div');
      host.setAttribute('data-justify', '');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const inner = document.createElement('button');
      shadow.appendChild(inner);

      const onChrome = anim(inner);
      setAnimations([onChrome]);

      freeze();
      // Element.closest() cannot climb out of a shadow root - walking through
      // ShadowRoot.host is what keeps the toolbar alive.
      expect(onChrome.pause).not.toHaveBeenCalled();
    });
  });

  describe('animations TRIGGERED while paused (the invisible-content trap)', () => {
    it('SETTLES a not-yet-started reveal to its end state instead of freezing it invisible', async () => {
      setAnimations([]);
      freeze();

      // The user scrolls down. IntersectionObserver is neither timer- nor rAF-driven,
      // so it fires, the reveal class lands, and a `both`-filled entrance animation
      // appears. Freezing it at frame 0 would mean opacity 0 - blank space.
      const el = document.createElement('div');
      document.body.appendChild(el);
      const reveal = anim(el, { playState: 'running' });
      setAnimations([reveal]);

      await frames();

      expect(reveal.finish).toHaveBeenCalledTimes(1);
      expect(reveal.pause).not.toHaveBeenCalled();
    });

    it('freezes an ENDLESS ambient loop instead of finish()ing it (finish() throws on infinite)', async () => {
      setAnimations([]);
      freeze();

      const el = document.createElement('div');
      document.body.appendChild(el);
      const ambient = anim(el, { iterations: Infinity });
      setAnimations([ambient]);

      await frames();

      expect(ambient.finish).not.toHaveBeenCalled();
      expect(ambient.pause).toHaveBeenCalledTimes(1);
    });

    it('keeps a scroll-driven animation created while paused tracking the scroll', async () => {
      setAnimations([]);
      freeze();

      const el = document.createElement('div');
      document.body.appendChild(el);
      const scrubbed = anim(el, { timeline: new ScrollTimeline() });
      setAnimations([scrubbed]);

      await frames();

      expect(scrubbed.play).toHaveBeenCalled();
      expect(scrubbed.finish).not.toHaveBeenCalled();
      expect(scrubbed.pause).not.toHaveBeenCalled();
    });
  });

  describe('scroll drivers (the page must stay scrollable)', () => {
    it('finds a Lenis instance by IDENTITY, not by guessing its variable name, and drives it while frozen', async () => {
      class Lenis {
        raf = vi.fn();
        reset = vi.fn();
      }
      (window as any).Lenis = Lenis;
      // ppai calls it window.ppaiLenis; another project will call it something else.
      const instance = new Lenis();
      (window as any).someArbitraryName = instance;

      freeze();
      await frames(3);

      // Without this the rAF patch would queue Lenis's callback, kill its loop, and
      // - because Lenis preventDefaults the wheel - leave the page unscrollable.
      expect(instance.raf).toHaveBeenCalled();

      unfreeze();
      // reset() drops any in-flight glide so the driver's one-frame timebase
      // discontinuity lands on a driver with nothing to advance.
      expect(instance.reset).toHaveBeenCalledTimes(1);

      delete (window as any).someArbitraryName;
    });

    it('honours an explicit opt-in driver, for any library or hand-rolled loop', async () => {
      const driver = vi.fn();
      (window as any).__justifyScrollDrivers = [driver];

      freeze();
      await frames(3);

      expect(driver).toHaveBeenCalled();
    });

    it('stops driving once unfrozen', async () => {
      const driver = vi.fn();
      (window as any).__justifyScrollDrivers = [driver];

      freeze();
      await frames(3);
      unfreeze();
      const callsAtUnfreeze = driver.mock.calls.length;

      await frames(3);
      expect(driver.mock.calls.length).toBe(callsAtUnfreeze);
    });
  });

  describe('timer + rAF patches', () => {
    it('queues a page setTimeout while frozen and replays it on unfreeze', async () => {
      const cb = vi.fn();
      freeze();
      window.setTimeout(cb, 0);

      await frames(3);
      expect(cb).not.toHaveBeenCalled(); // frozen: queued, not run

      unfreeze();
      await sleep(20);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('skips a page setInterval tick while frozen', async () => {
      const cb = vi.fn();
      freeze();
      const id = window.setInterval(cb, 1);
      await sleep(30);
      expect(cb).not.toHaveBeenCalled();
      window.clearInterval(id);
    });

    it('queues a page rAF while frozen, and hands the replay a timestamp on the VIRTUAL clock so a count-up resumes instead of snapping', async () => {
      // Both readings come from the page's OWN rAF, so they share a timebase
      // whatever origin the environment happens to use. What is being measured is
      // how much time a page animation BELIEVES passed across the pause - which is
      // exactly the number ppai's count-up divides by (t = (now - start) / DURATION).
      const nextPageFrame = (): Promise<number> =>
        new Promise((resolve) => window.requestAnimationFrame(resolve));

      const before = await nextPageFrame();

      const PAUSE_MS = 300;
      freeze();
      await sleep(PAUSE_MS); // the designer studies the frozen page
      unfreeze();
      await sleep(80); // jsdom's frame driver recovers

      const after = await nextPageFrame();
      const perceivedElapsed = after - before;

      // Hand the page the RAW timestamp and it perceives the whole pause, so the
      // count-up computes t >= 1 and jumps straight to its final value - a restart,
      // not a resume. The virtual clock (real minus time spent frozen) holds it back.
      expect(perceivedElapsed).toBeGreaterThanOrEqual(0);
      expect(perceivedElapsed).toBeLessThan(PAUSE_MS);
    });
  });

  describe('video', () => {
    it('pauses playing video and resumes only what it actually paused', () => {
      const playing = document.createElement('video');
      const alreadyPaused = document.createElement('video');
      document.body.append(playing, alreadyPaused);

      const playingPause = vi.fn();
      const playingPlay = vi.fn(() => Promise.resolve());
      Object.defineProperty(playing, 'paused', { get: () => false, configurable: true });
      playing.pause = playingPause;
      playing.play = playingPlay as unknown as HTMLVideoElement['play'];

      const pausedPlay = vi.fn(() => Promise.resolve());
      Object.defineProperty(alreadyPaused, 'paused', { get: () => true, configurable: true });
      alreadyPaused.pause = vi.fn();
      alreadyPaused.play = pausedPlay as unknown as HTMLVideoElement['play'];

      freeze();
      expect(playingPause).toHaveBeenCalledTimes(1);

      unfreeze();
      expect(playingPlay).toHaveBeenCalledTimes(1);
      // Resuming a video the designer had deliberately paused would be residue.
      expect(pausedPlay).not.toHaveBeenCalled();
    });
  });

  describe('setFrozen', () => {
    it('is an idempotent setter so the toolbar and the engine cannot drift apart', () => {
      setFrozen(true);
      setFrozen(true);
      expect(isFrozen()).toBe(true);
      expect(document.head.querySelectorAll('#justify-freeze-styles')).toHaveLength(1);

      setFrozen(false);
      setFrozen(false);
      expect(isFrozen()).toBe(false);
      expect(styleEl()).toBeNull();
    });
  });

  describe('the opt-in signal for JS rAF loops', () => {
    it('announces pause/resume and flags <html>, so a page can settle its own counter', () => {
      const onPause = vi.fn();
      const onResume = vi.fn();
      document.addEventListener('justify:animations-paused', onPause);
      document.addEventListener('justify:animations-resumed', onResume);

      freeze();
      expect(onPause).toHaveBeenCalledTimes(1);
      expect(document.documentElement.hasAttribute('data-justify-paused')).toBe(true);

      unfreeze();
      expect(onResume).toHaveBeenCalledTimes(1);
      // No residue.
      expect(document.documentElement.hasAttribute('data-justify-paused')).toBe(false);

      document.removeEventListener('justify:animations-paused', onPause);
      document.removeEventListener('justify:animations-resumed', onResume);
    });
  });

  describe('defects Codex found in the first cut', () => {
    it('a parked setTimeout can still be CANCELLED while frozen (a host torn down mid-pause must not get a stale callback)', async () => {
      const cb = vi.fn();
      freeze();
      const id = window.setTimeout(cb, 0);
      await sleep(20); // the timer fires and is PARKED

      window.clearTimeout(id); // the host component tears itself down

      unfreeze();
      await sleep(40);
      expect(cb).not.toHaveBeenCalled();
    });

    // NOT unit-tested here, deliberately: parked-rAF cancellation and the watchdog's
    // generation token both depend on the rAF LOOP actually running while frozen, and
    // under jsdom it cannot - patching window.setInterval starves jsdom's own frame
    // driver, so no rAF fires while frozen and nothing is ever parked. Tests written
    // against them passed even when the fix was reverted (i.e. they were vacuous), so
    // they were removed rather than shipped as fake coverage. Both are verified in a
    // real browser instead; the setTimeout twin below covers the same cancellation
    // logic on a path jsdom CAN exercise.

    it('never writes a data-was-paused attribute onto the host page\'s video (residue + name collision)', () => {
      const video = document.createElement('video');
      document.body.appendChild(video);
      Object.defineProperty(video, 'paused', { get: () => false, configurable: true });
      video.pause = vi.fn();
      video.play = vi.fn(() => Promise.resolve()) as unknown as HTMLVideoElement['play'];

      freeze();
      expect(video.hasAttribute('data-was-paused')).toBe(false);

      unfreeze();
      expect(video.hasAttribute('data-was-paused')).toBe(false);
    });

    it('does NOT resume a host video that merely happens to carry data-was-paused="false"', () => {
      const decoy = document.createElement('video');
      decoy.setAttribute('data-was-paused', 'false'); // the host's own attribute
      document.body.appendChild(decoy);
      const play = vi.fn(() => Promise.resolve());
      Object.defineProperty(decoy, 'paused', { get: () => true, configurable: true });
      decoy.pause = vi.fn();
      decoy.play = play as unknown as HTMLVideoElement['play'];

      freeze();
      unfreeze();
      expect(play).not.toHaveBeenCalled();
    });
  });
});
