// esbuild `inject` target. See build.js.
//
// esbuild substitutes these exports for every FREE identifier of the same name in
// every file in the bundle. So `setTimeout(fn, 100)` written anywhere in Justify -
// or inside bundled Preact's scheduler - compiles to the ORIGINAL, unpatched
// setTimeout, and is therefore immune to the freeze that freeze-animations.ts
// applies to the host page.
//
// This is the whole reason Justify's toolbar keeps working (tooltips, icon hover
// morphs, panel renders, daemon polling) while the page underneath it is frozen.
// It is the same escape hatch Agentation exports as `originalSetTimeout` etc. for
// its own UI, applied once at the bundler instead of at ~100 call sites - which is
// also the only way to reach the timer calls inside bundled Preact.
//
// A member expression (`window.setTimeout(...)`) is NOT a free identifier and is
// left alone, so the host page still goes through the patch.

import {
  originalSetTimeout,
  originalSetInterval,
  originalClearTimeout,
  originalClearInterval,
  originalRequestAnimationFrame,
  originalCancelAnimationFrame,
} from './original-timers';

export const setTimeout = originalSetTimeout;
export const setInterval = originalSetInterval;
export const clearTimeout = originalClearTimeout;
export const clearInterval = originalClearInterval;
export const requestAnimationFrame = originalRequestAnimationFrame;
export const cancelAnimationFrame = originalCancelAnimationFrame;
