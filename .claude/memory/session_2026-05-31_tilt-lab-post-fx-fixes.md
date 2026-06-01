---
name: tilt-lab post-fx fixes (dithered-image, fake-3d-image, water-ripple)
description: Fixed 3 broken effects against motion-core originals - WebGL post beneath-sampling, flip fix, pointer ripples
type: project
---

Collaborator: Jonah. Graphics-engineer pass (fx-mc-post) over three tilt-lab effects that failed QA.

## Core architecture addition: WebGL post effects can now sample the beneath-scene
Problem: the compositor only fed the composited beneath-layers to **Canvas2D** post effects
(it draws lower layers straight into the post effect's own 2D canvas). WebGL post effects
(`getContext('2d')` returns null) got nothing, so they could only render a standalone source.

Fix (runtime/compositor.ts + runtime/types.ts):
- New optional Effect hook `onBeneath(source: HTMLCanvasElement)`. For a `post` layer whose
  effect implements it, the compositor composites all enabled beneath layers into a
  compositor-owned 2D scratch canvas (`composeBeneath()`, honors per-layer opacity) and hands
  it over once per frame, just before frame(). The effect uploads it as a texture. This is the
  WebGL analogue of the existing Canvas2D blit path. Headless-safe (returns null with no 2D ctx).
- Why: keeps shaders verbatim; mirrors how ascii (Canvas2D) consumes the beneath-scene.

## Per-effect fixes
- **dithered-image** (was FAIL: "should be POST like ascii"): added `onBeneath` -> dithers the
  layers beneath (flipY:true on upload so canvas-top maps to screen-top; gl_FragCoord is
  bottom-origin). layerRole was already `post`. `src` upload kept as labelled alternate (standalone).
- **fake-3d-image** (was UPSIDE DOWN): root cause was `flipY:false` on both color + depth
  textures -> first data row landed at v=0 (bottom) while cover-UV/vUv increase upward. Changed
  both to `flipY:true`. Labelled the two file params (colorSrc="Color image",
  depthSrc="Depth map (grayscale)") + placeholders so the depth pairing is obvious. Real
  384x384 color.png + depth.png already shipped as defaults; mouse parallax (onPointer) intact.
- **water-ripple** (was FAIL: "POST, doesn't work"): added `onBeneath` so it ripples the beneath
  composite (was sampling its own image asset). Added `onPointerDown` to drop a ripple on press;
  refactored the move-threshold spawn into a shared `spawnWave()`. Brush->displacement two-pass
  shader kept verbatim. `image` asset retained as standalone fallback.

## Supporting changes
- ParamSpec gained optional `label`; manifest validator threads it; ParamControls renders
  `label ?? name`; FileDrop shows a "Drop <placeholder> or click" hint.

## How to verify live (team-lead, Chrome)
- water-ripple / dithered-image: stack the effect as the top (post) layer over any image or
  generative layer; move/click the cursor -> ripples (or dither tracks) the content beneath.
- fake-3d-image: load standalone; image is now upright; move cursor -> depth parallax shift.

## Verification
- `cd tilt-lab/app && npx tsc --noEmit`: clean for all my files. ONE unrelated pre-existing
  error remains in runtime/effects/mesh-gradient/index.ts (unused import MESH_SCENE_NAMES) -
  that's another teammate's in-flight WIP (untracked presets.ts), NOT touched here. Flag to
  whoever owns mesh-gradient.
- `cd tilt-lab && npm test`: 190/190 green (40 files). New tests: compositor onBeneath delivery
  (+2), water-ripple press/beneath (+3), dithered onBeneath (+3), fake-3d labels/parallax (+2).

Files: runtime/types.ts, runtime/compositor.ts, runtime/compositor.test.ts, runtime/manifest.ts,
runtime/effects/dithered-image/{index.ts,index.test.ts,manifest.json},
runtime/effects/fake-3d-image/{index.ts,index.test.ts,manifest.json},
runtime/effects/water-ripple/{index.ts,index.test.ts},
app/src/components/ParamControls.tsx, app/src/components/controls/FileDrop.tsx.
