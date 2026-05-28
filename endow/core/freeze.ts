// Module-level singleton state
let frozen = false;

// Layer 1: JS timer/rAF originals
let origSetTimeout: typeof window.setTimeout | null = null;
let origSetInterval: typeof window.setInterval | null = null;
let origRAF: typeof window.requestAnimationFrame | null = null;

// Queued callbacks while frozen
interface QueuedTimeout {
  fn: TimerHandler;
  delay: number | undefined;
  args: unknown[];
}
let timeoutQueue: QueuedTimeout[] = [];
let rafQueue: FrameRequestCallback[] = [];

// Dummy interval IDs to clear on unfreeze
let dummyIntervalIds: any[] = [];

// Layer 2: CSS style element
let freezeStyleEl: HTMLStyleElement | null = null;

// Layer 3: WAAPI animations and videos
let pausedAnimations: Animation[] = [];
interface VideoState {
  el: HTMLVideoElement;
  wasPaused: boolean;
}
let videoStates: VideoState[] = [];

export function freeze(): void {
  if (frozen) return;
  frozen = true;

  // --- Layer 1: JS timers and rAF ---
  origSetTimeout = window.setTimeout;
  origSetInterval = window.setInterval;
  origRAF = window.requestAnimationFrame;

  (window as unknown as Record<string, unknown>).setTimeout = function (
    fn: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ): ReturnType<typeof setTimeout> {
    timeoutQueue.push({ fn, delay, args });
    // Return a dummy ID that won't conflict with real timers
    return -1 as unknown as ReturnType<typeof setTimeout>;
  };

  (window as unknown as Record<string, unknown>).setInterval = function (
    fn: TimerHandler,
    _delay?: number,
    ..._args: unknown[]
  ): any {
    // Use a very long delay so the interval effectively never fires
    const id = origSetInterval!(fn, 2147483647);
    dummyIntervalIds.push(id);
    return id;
  };

  (window as unknown as Record<string, unknown>).requestAnimationFrame = function (
    cb: FrameRequestCallback
  ): number {
    rafQueue.push(cb);
    return -1;
  };

  // --- Layer 2: CSS pause ---
  freezeStyleEl = document.createElement('style');
  freezeStyleEl.setAttribute('data-endow-freeze', '');
  freezeStyleEl.textContent =
    '*:not([data-endow]):not([data-endow] *) { animation-play-state: paused !important; transition: none !important; }';
  document.head.appendChild(freezeStyleEl);

  // --- Layer 3: WAAPI animations ---
  pausedAnimations = [];
  for (const anim of document.getAnimations()) {
    if (anim.playState === 'running') {
      anim.pause();
      pausedAnimations.push(anim);
    }
  }

  // --- Layer 3: Videos ---
  videoStates = [];
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  for (const video of videos) {
    const wasPaused = video.paused;
    videoStates.push({ el: video, wasPaused });
    if (!wasPaused) {
      video.pause();
    }
  }
}

export function unfreeze(): void {
  if (!frozen) return;
  frozen = false;

  // --- Layer 1: Restore originals ---
  if (origSetTimeout) {
    (window as unknown as Record<string, unknown>).setTimeout = origSetTimeout;
  }
  if (origSetInterval) {
    (window as unknown as Record<string, unknown>).setInterval = origSetInterval;
  }
  if (origRAF) {
    (window as unknown as Record<string, unknown>).requestAnimationFrame = origRAF;
  }

  // Replay queued timeouts
  const timeoutsToRun = timeoutQueue.splice(0);
  for (const { fn, delay, args } of timeoutsToRun) {
    window.setTimeout(fn, delay, ...args);
  }

  // Replay queued rAFs
  const rafsToRun = rafQueue.splice(0);
  const now = performance.now();
  for (const cb of rafsToRun) {
    window.requestAnimationFrame(cb);
    void now; // rAF will supply the real timestamp; we just re-queue
  }

  // Clear dummy intervals
  for (const id of dummyIntervalIds) {
    window.clearInterval(id);
  }
  dummyIntervalIds = [];

  origSetTimeout = null;
  origSetInterval = null;
  origRAF = null;

  // --- Layer 2: Remove CSS style element ---
  if (freezeStyleEl && freezeStyleEl.parentNode) {
    freezeStyleEl.parentNode.removeChild(freezeStyleEl);
  }
  freezeStyleEl = null;

  // --- Layer 3: Resume WAAPI animations ---
  for (const anim of pausedAnimations) {
    anim.play();
  }
  pausedAnimations = [];

  // --- Layer 3: Resume videos that were playing ---
  for (const { el, wasPaused } of videoStates) {
    if (!wasPaused) {
      el.play().catch(() => {
        // Autoplay policy may block resume - non-fatal
      });
    }
  }
  videoStates = [];
}

export function isFrozen(): boolean {
  return frozen;
}
