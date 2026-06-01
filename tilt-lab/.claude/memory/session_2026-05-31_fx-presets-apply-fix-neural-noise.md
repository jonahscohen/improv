---
name: Preset selectors fixed (apply path) + neural-noise interactivity/customization
description: Root-caused dead preset selectors (init-time clobber) and fixed via store-level preset expansion; enhanced neural-noise with pointer interactivity + 7 appearance params
type: project
relates_to: [session_2026-06-01_interaction-foundation.md, session_2026-05-31_motion-core-a-control-parity.md]
---

Collaborator: Jonah

## Root cause: preset selectors did nothing (animated-gradient, aurora, mesh-gradient)

The compositor has NO per-param `setParam` path. Every store param change calls
`PreviewCanvas` -> `Compositor.setLayers()` -> full `clear()` + `init()`. So an
effect's own `setParam` is never invoked by the playground; params reach the
effect only through `init(opts.params)`.

`store.setParam(i, 'preset', name)` wrote ONLY the single `preset`/`scene` key,
leaving every other param at its manifest default. On rebuild, each effect's
`readParams`/init applies the preset FIRST, then a loop overwrites every value
with `opts.params[key]` - which still held the defaults. Net: the preset is
applied then immediately clobbered. "Changing the preset does nothing."

## Fix: expand presets at the store level (single source of truth)

Why store-level: it makes the UI controls reflect the preset (the store carries
the real values) AND makes `init` receive the full value-set (no clobber).

How:
- New `runtime/effect-presets.ts`: `effectPresets` registry (effectId ->
  { param, custom, presets }) + `expandPresetParams(effectId, current, key, value)`.
  Selecting a preset merges its full value-set; editing any preset-controlled
  param flips the selector back to its custom sentinel (matches upstream tools).
- `app/src/state/stackStore.ts` `setParam` now routes through `expandPresetParams`.
  Effects with no registry entry are unchanged (`{ ...params, [key]: value }`).
- Preset DATA moved into per-effect sibling `presets.ts` files (no heavy renderer
  imports), imported by BOTH the effect (standalone JSON path) and the registry:
  - `animated-gradient/presets.ts` (6 spell presets, verbatim values)
  - `aurora/presets.ts` (7 retint presets)
  - `mesh-gradient/presets.ts` (5 scene palettes -> color1..color5)

Sentinels: animated-gradient `preset`/`custom`; aurora `preset`/`Custom`;
mesh-gradient `scene`/`Custom`.

Shaders untouched (GLSL verbatim). Fix is purely in apply/state logic.

mesh-gradient audit: scene/colorN/noise*/grain/dither/wireframe/animFreeze all
drive uniforms via init + the effect's switch-based setParam; the only dead path
was the scene preset (same clobber), now fixed by expansion.

## neural-noise: interactivity + appearance customization

CPPN core (`cppn_fn`, ~50 baked mat4 blocks) kept byte-for-byte. Only the wrapper
`main()` changed + new uniforms added around it.

- Interactivity: `onPointer(x,y,pressed)` normalizes the cursor to vUv space and
  sets `uPointer`/`uPointerActive`/`uPressed`; `onPointerLeave()` clears it. In
  the shader the cursor (a) warps the field toward itself with radial falloff and
  (b) brightens the network locally by nudging two CPPN inputs; both stronger
  while pressed.
- New appearance params -> uniforms: `scale` (zoom), `brightness`, `contrast`,
  `tint` (color) + `tintStrength`, `warp` (pointer warp amount), `pointerStrength`
  (pointer brightening). `speed` retained. Defaults preserve the original look at
  rest (tintStrength 0, contrast/brightness/scale 1).
- manifest.json updated (8 params; tags +interactive,+pointer).

## How to verify in browser (team-lead)
- animated-gradient: switch preset across Prism/Lava/Plasma/Pulse/Vortex/Mist ->
  colors + swirl/shape visibly change; sliders/color pickers update to match.
- aurora: switch preset (Blue Night/Sunset/Toxic/...) -> band + sky colors change.
- mesh-gradient: switch scene (Aurora/Deep Ocean/Regent/Molten) -> 5 color pickers
  repopulate and the gradient recolors. Editing a color flips selector to Custom.
- neural-noise: hover the stage -> field warps/brightens toward cursor (stronger on
  press). Move scale/contrast/brightness/tint/tintStrength/warp/pointerStrength.

## Verification
- `cd tilt-lab/app && npx tsc --noEmit` -> 0 errors.
- `cd tilt-lab && npm test` -> 43 files / 219 tests pass. New: effect-presets (8),
  neural-noise (6), stackStore preset-expansion (added).

## Files
- runtime/effect-presets.ts (new) + runtime/effect-presets.test.ts (new)
- runtime/effects/animated-gradient/presets.ts (new), index.ts (import presets)
- runtime/effects/aurora/presets.ts (new), index.ts (import presets)
- runtime/effects/mesh-gradient/presets.ts (new), index.ts (import presets)
- runtime/effects/neural-noise/index.ts (pointer + customization), manifest.json, index.test.ts
- app/src/state/stackStore.ts (expandPresetParams), stackStore.test.ts
