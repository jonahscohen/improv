---
name: tilt-lab fluid/fractal-glass/halftone interactions ported + post-overlay variants
description: Wired the regent pointer interactions into fluid/fractal-glass/halftone and added fractal-glass-post / halftone-post overlay variants consuming the compositor's onBeneath source
type: project
---

Collaborator: Jonah

Fixed missing pointer INTERACTIONS in three regent-sourced tilt-lab effects and added two post-overlay variants. The verbatim shaders were already ported; the interaction wiring (and a coordinate-units bug) was not.

## Root bug (all three)
The compositor/PointerTracker deliver canvas-relative PIXELS (top-left origin), but all three effects' `onPointer` treated x/y as already-normalized [0,1]. So the pointer mapped to a tiny corner region and injection was effectively dead. Fix: normalize pixels by the canvas CSS size before mapping.

## fluid (#9)
- onPointer now normalizes pixels -> clip via new exported pure `fluidClipFromPixel(px,py,w,h)`.
- Injection gate now matches the original verbatim: the regent shaders gate on `isMouseDown`, so force+dye splat ONLY while pressed (drag), hover just tracks position. `pressed` IS the drag flag. (Team-lead's brief said "continuous on hover" but the verbatim shader is drag-gated; matched the shader.)
- Added onPointerDown (seeds last=current so the press frame starts at zero velocity, no spike - verbatim updateLastMouse), onPointerUp, onPointerLeave.
- Added `mousePointKnown`/`lastMousePointKnown`; uniform gate is now `(lastMousePointKnown && mouseDown)`, verbatim.

## fractal-glass (#10) + halftone (#11)
- onPointer normalizes pixels -> sim uPointer via new shared pure `pointerUVFromPixel(px,py,w,h,pressed)` in lib/fluid-solver.ts. z = pressed?1:0; paintVelocity shader applies force when z<0.5, so hover stirs / press pauses - verbatim regent inversion (opposite of fluid).

## Post-overlay variants (#10/#11)
- Compositor support already existed: team-lead added `Effect.onBeneath(source: HTMLCanvasElement)` + compositor composites the beneath layers into a shared 2D scratch canvas and hands it to WebGL post effects. I CONSUMED it (did not need to build compositor support).
- `createFractalGlassEffect`/`createHalftoneEffect` take `{post?}`. Post mode: the fluid decays its color toward the beneath-scene CanvasTexture (uBackgroundTexture) instead of the generated radial, re-asserted each frame. So the glass refracts / the dots halftone the LIVE layers beneath, and the pointer still stirs them. Falls back to generated bg when run standalone (no onBeneath).
- New `createFractalGlassPostEffect` / `createHalftonePostEffect` + new effect dirs fractal-glass-post/ + halftone-post/ (manifest.json, layerRole 'post', id-match test). Registered in runtime/index.ts.

## Also
- element.ts (single-effect host) now dispatches the full pointer surface (pressed + down/up/wheel), mirroring the compositor, so single <tilt-fluid> etc. get drag too.

## Verify
- cd tilt-lab/app && npx tsc --noEmit -> 0.
- cd tilt-lab && npm test -> 43 files / 219 tests green (added pure-helper + drag-cycle + onBeneath tests).

## Files touched
- runtime/lib/fluid-solver.ts (+ pointerUVFromPixel), runtime/lib/fluid-solver.test.ts
- runtime/effects/fluid/index.ts (+ fluidClipFromPixel, down/up/leave), fluid/index.test.ts
- runtime/effects/fractal-glass/index.ts (post opt, onBeneath, pointer fix, post factory), fractal-glass/index.test.ts
- runtime/effects/halftone/index.ts (same), halftone/index.test.ts
- runtime/effects/fractal-glass-post/{manifest.json,index.test.ts} (new)
- runtime/effects/halftone-post/{manifest.json,index.test.ts} (new)
- runtime/index.ts (register 2 variants), runtime/element.ts (full pointer surface)
