---
name: tilt-lab pixel effect (always-on, ported from React Bits)
description: added a "Pixel" always-on canvas effect to tilt-lab, ported from the free React Bits Pixel Card (not the paid unlumen source)
type: project
relates_to: [feedback_tilt_lab_fidelity_mandate.md, decision_behavioral_verifier_build_own.md]
---

Collaborator: Jonah

Jonah asked to add the unlumen UI "Pixel" shader (https://ui.unlumen.com/components/pixel) to
tilt-lab, always-on (no hover), for personal use.

## Licensing pivot (important)
The unlumen "Pixel Background" is a PAID Pro component ($149), source-gated behind
UNLUMEN_LICENSE_KEY - the page only exposes API docs, not pixel.tsx. I could not (and would not)
extract the paid source. BUT the unlumen page itself credits the origin: "Inspired by React Bits
and their Pixel Card component." React Bits (github.com/DavidHDev/react-bits) is FREE + MIT. So I
ported the free MIT original instead - same effect, properly licensable (manifest redistribution
"ok" + attribution). Verified it on the page (get_page_text) before deciding, not from a summary.

## What was built
New effect `tilt-lab/runtime/effects/pixel/` (manifest.json + index.ts + index.test.ts), registered
in runtime/index.ts (import pair + RAW entry). Canvas-2D, fits tilt-lab's init/frame(t)/resize/
setParam/dispose contract (the wrapper owns the RAF, so the original's internal RAF + hover gate are
dropped). Pixel growth/shimmer math is verbatim from React Bits. Made ALWAYS-ON: every frame all
pixels run appear() -> ripple in from the pattern origin, then shimmer forever (no disappear).
Params: gap, speed (0-100 mapped like the original), pattern (center/top/bottom/left/right/diagonal/
ascend/random/spiral - the extra patterns mirror unlumen's headline feature), colors (comma hex),
backgroundColor. reduced-motion -> static field (delay 0 + shimmer speed 0).

## Verified
- tsc --noEmit clean; `vitest run runtime/effects/pixel` 3/3 pass.
- tilt-lab dev (vite, :5180): "Pixel" appears in the catalog (BACKGROUND); clicking it loads it,
  the live preview renders the center-ripple reveal then a full shimmering pixel grid on #17181A,
  ALWAYS-ON with no hover (cursor was on the side panel). All params exposed + wired in the
  Composition panel. Zoomed the preview to confirm the pixel grid + shimmer.

Note: tilt-lab catalog count excludes the `gradient` reference fixture (CATALOG_EXCLUDE), so the
"27 effects" label = 27 RAW - gradient + pixel; pixel IS registered (was a counting red herring).

Files: tilt-lab/runtime/effects/pixel/{manifest.json,index.ts,index.test.ts},
tilt-lab/runtime/index.ts. Dev server left running at localhost:5180.

## Fix (Jonah): background + dot colors, and "turn background opacity off -> dots still animate"
Root cause: frame() only `fillRect`ed the background and never `clearRect`ed when backgroundColor
was truthy. tilt-lab's ColorField is alpha-aware (emits #RRGGBBAA), so dragging the bg alpha to 0
sent "#17181A00" - still a truthy string, so my code took the fill branch, painted a transparent
fill (no-op), and NEVER cleared -> the previous frame's dots were never wiped -> smear, and no way
to get dots-on-transparent. Fix: frame() ALWAYS `clearRect` first, THEN fill backgroundColor only
if set (a fully-transparent bg now paints nothing, leaving clean dots-on-transparent each frame).
Also: empty `colors` now falls back to the DEFAULT_COLORS palette instead of plain white.
Verified live: bg alpha -> 0 (#17181A00, checkerboard swatch) leaves the dots shimmering cleanly;
typing colors "#ff6900,#ffb380" turns the dots orange. tsc clean, 3/3 tests still pass.
