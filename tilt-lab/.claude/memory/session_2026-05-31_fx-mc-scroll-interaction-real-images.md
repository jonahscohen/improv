---
name: fx-mc-scroll - interaction contract + real images for 3 motion-core effects
description: interactive-grid role/pointer honesty, glass-slideshow + infinite-gallery scroll/drag wiring, real royalty-free photo defaults
type: project
relates_to: [session_2026-05-31_motion-core-b-control-parity.md]
---

Collaborator: Jonah. Role: fx-mc-scroll (graphics engineer).

Fixed three motion-core effects against the new interaction contract (runtime/types.ts
onPointer/onPointerDown/onPointerUp/onWheel/onPointerLeave, driven by compositor.ts +
pointer.ts; effects own no RAF/listeners). User complaints: wrong role, missing
scroll/pointer interaction, placeholder images.

Verified original behavior via motion-core.dev docs (real Svelte 5 / OGL repo, MIT):
- interactive-grid = standalone single-image cursor distortion (NOT post, NOT scroll).
- glass-slideshow = slide transitions (docs say autoplay; team directive: add scroll/drag).
- infinite-gallery = scroll-driven 3D tunnel (wheel is the canonical input).

### interactive-grid (#12 "is POST and doesn't behave like it")
Role was already honest: manifest layerRole=midground, which matches the original
(self-contained image-distortion widget, not a post-over-content overlay). It read as a
"broken post effect" only because it shipped an abstract procedural placeholder, so the
displacement was invisible.
- Why: a real photo makes the grid displacement plainly visible -> behaves like the demo.
- How: replaced assets/image with a real royalty-free photo (Lorem Picsum / Unsplash).
- Pointer math made verbatim: was injecting velocity then relaxing the same cell in one
  loop and used a non-canonical /aspect divisor. Rewrote to the canonical two-pass OGL
  grid distortion: (1) relax every cell, (2) inject cursor velocity within the brush
  radius; distance is now verbatim (gridMouseX-i)^2+(gridMouseY-j)^2. onPointer keeps
  normalized cursor + per-move velocity. Added onPointerLeave() to zero velocity + reset
  pointerSeen so re-entry computes a fresh delta (no phantom jump).

### glass-slideshow (#15 real images + missing interaction)
Had autoplay + setParam('index') only; no scroll/drag.
- Added onWheel(deltaY): accumulates to a one-slide threshold (WHEEL_STEP 120) -> queues
  pendingDir; scroll down = next, up = prev.
- Added drag-through: onPointerDown captures x; onPointer(x,y,pressed) only advances while
  pressed (hover does nothing), accumulating horizontal drag to DRAG_STEP 130 px/slide;
  onPointerUp/onPointerLeave reset the drag. Drag left = next, right = prev.
- frame(t) drains pendingDir one slide per idle frame via beginTransition(current±1, t) so
  each gesture resolves as a clean one-slide glass-bubble transition anchored to host clock.
  Autoplay preserved. No internal listeners/RAF.
- Shipped real defaults for all 4 upload slots (image0..image3), keeping the file params.

### infinite-gallery (#15 real images + missing scroll)
Scroll-driven original but onWheel was MISSING (only a hover-drag existed).
- Added onWheel(deltaY): scrollVelocity += deltaY*0.01, feeding the existing integrator
  (0.95 friction in frame); scroll down = tunnel forward. This is the primary input.
- Gated drag on pressed (was scrubbing on bare hover); added onPointerLeave() to reset
  lastPointerY (no jump on re-entry).
- Shipped real defaults for all 6 upload slots (image0..image5), keeping the file params.

### Real images
Downloaded varied real royalty-free photos (Lorem Picsum, Unsplash license, free,
no attribution required) via curl, recompressed to JPEG (sips, q72, 56-124K each to match
the repo asset-weight norm). Switched assets.ts imports png->jpg (the *.jpg ambient module
+ esbuild .jpg dataurl loader already existed). effect-assets.ts needs no change (it
re-exports each effect's assets map). gen-sample-assets.mjs is not run by build/test, so it
won't clobber these.

Verify: tilt-lab/app `npx tsc --noEmit` -> my 3 effects clean (only pre-existing halftone/
globe TS6133 unused-var errors from other lanes remain). tilt-lab `npm test` -> 40 files /
195 tests pass. `node build.js` -> bundle builds, 11 real JPEG data URLs inlined (4+6+1).
In-browser: scroll wheel over glass-slideshow advances slides; over infinite-gallery scrolls
the tunnel; click-drag scrubs both; interactive-grid distorts the real photo under the cursor.

Files touched:
- runtime/effects/interactive-grid/{index.ts, index.test.ts, assets.ts, assets/image.jpg}
- runtime/effects/glass-slideshow/{index.ts, index.test.ts, assets.ts, assets/image0..3.jpg}
- runtime/effects/infinite-gallery/{index.ts, index.test.ts, assets.ts, assets/image0..5.jpg}
(removed the old procedural .png placeholders in all three asset dirs)
