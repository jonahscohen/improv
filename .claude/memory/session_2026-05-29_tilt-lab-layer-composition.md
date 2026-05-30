---
name: tilt-lab layer composition (enable/opacity/drag)
description: Builder B - per-layer enable toggle, opacity fader, drag-to-reorder channel strips; compositor honors enable+opacity
type: project
relates_to: [session_2026-05-29_tilt-lab-instrument-foundation.md, session_2026-05-29_tilt-lab-design-direction.md]
---

Builder B (tilt-design team, task #5). Turned the LayerStack "stacking" UI into per-layer "composition" and wired enable/opacity through the runtime. Collaborator: Jonah.

## Changes
- runtime/types.ts: extended LayerConfig with optional `enabled?: boolean` (default true) and `opacity?: number` 0..1 (default 1). Optional so existing call sites and tests with the 4-field shape still typecheck.
- app/src/state/stackStore.ts: add() seeds enabled:true, opacity:1. New methods setEnabled(index, enabled) and setOpacity(index, opacity) following the immutable map+notify pattern; setOpacity clamps to 0..1. Interface updated.
- runtime/compositor.ts: setLayers applies `surface.style.opacity` per layer and sets `display:none` when enabled===false. renderFrame skips frame() for disabled layers, and in the Canvas2D post-compositing path skips disabled lower layers and applies `c2d.globalAlpha = opacity` per source (resets to 1 after). Treats undefined as the legacy default (on/full) so the compositor tests stay green. The static-position guard was left untouched.
- app/src/components/LayerStack.tsx + .css: rebuilt each row as an instrument channel strip - numbered drag handle (doubles as compositing-order index), name, role meta, enable Switch (consumed from controls/, not edited), a native range opacity fader with tabular-mono % readout (.value), keyboard up/down + remove icon-buttons retained for a11y. Native HTML5 drag-to-reorder (handle draggable, li is drop target) calling onReorder; drop target shows a 2-tier hairline + accent edge (no shadow). Disabled channels dim (opacity .55) but stay interactive. "Paint order: background to post" meta caption. New OPTIONAL props onSetEnabled/onSetOpacity.
- app/src/components/ParamControls.css: fixed stale `var(--panel)` token (now --surface-2); section summary labels now tracked-uppercase mono meta. Accordion logic + details.param-group structure untouched (tests green).

## Why optional props
LayerStack needs onSetEnabled/onSetOpacity but App.tsx is Builder A's file. Made the props optional so the shared typecheck stays green now; until App wires them from the store the enable toggle and opacity fader render but are inert. Flagged to the CD to have Builder A wire store.setEnabled/store.setOpacity into the <LayerStack> call site.

## Verify results
- compositor.test.ts 5/5, stackStore.test.ts 7/7, ParamControls.test.tsx 6/6 - all pass under `npm test`.
- Full suite: 149/153 pass. The 4 failures are all in BrowseGrid.test.tsx (Builder A): incomplete Manifest mocks missing `tags`, and `toBeInTheDocument` matcher not registered. Pre-existing, unrelated to LayerConfig.
- App tsc errors are confined to ThumbnailPreview.tsx (Builder A, references nonexistent EffectContext). None of my files error.

## Files touched
- tilt-lab/runtime/types.ts
- tilt-lab/runtime/compositor.ts
- tilt-lab/app/src/state/stackStore.ts
- tilt-lab/app/src/components/LayerStack.tsx
- tilt-lab/app/src/components/LayerStack.css
- tilt-lab/app/src/components/ParamControls.css
