---
name: tilt-lab Builder C - scrub numerics + server-free export
description: Slider scrub-to-edit, server-free config export (download/copy), instrument TopBar + modal restyle
type: project
relates_to: [session_2026-05-29_tilt-lab-instrument-foundation.md, session_2026-05-29_tilt-lab-design-direction.md]
---

Collaborator: Jonah. tilt-design team rebuild of tilt-lab playground (INSTRUMENT, NOT DASHBOARD). Builder C task #6.

## Changes
- controls/Slider.tsx + Slider.css: added scrub-to-edit numerics. Readout is now a focusable scrub handle - pointer-drag adjusts (left=down/right=up, step-aware via PX_PER_STEP=4), double-click opens an inline text input (Enter commits, Esc cancels, blur commits), arrow keys nudge when focused. All paths funnel through one quantize() (clamp + snap-to-step + fp-noise kill) then the existing onChange. SliderProps API unchanged (additive only - Builder B's Slider/Switch imports stay safe). Readout uses --font-mono + tabular-nums, cursor ew-resize.
  - **Shift convention chosen: Shift = 10x LARGER step (coarser/faster traverse)**, on scrub drag AND arrow keys. Documented in component doc comment + the readout title tooltip.
  - Bug caught + fixed: focus-return effect would steal focus on initial mount (every mounted Slider grabbing focus). Guarded with prevEditing ref so focus only returns when an actually-open edit closes.
- lib/export.ts (CREATE): server-free export. Pure, no-React. buildStackConfig/serializeStackConfig (versioned envelope: format 'tilt-lab/stack', version 1, ordered layers), downloadStackConfig (Blob + object URL + transient <a download>, revokes on next tick), copyStackConfig (navigator.clipboard). Reads layer.enabled/opacity defensively (?? true / ?? 1) so it is correct whether or not runtime/types.ts has those fields yet (Builder B is adding them).
- TopBar.tsx: replaced dead server-gated "Send to project" with real export controls - "Download config" + "Copy config" .btn buttons, disabled at 0 layers with explanatory title, "Copied" confirmation state. Kept mono "tilt-lab" wordmark + Add shader. **New props additive/optional (layers?, legacy onSend?/canSend? kept optional) so App.tsx (Builder A) keeps compiling until the CD brokers the rewire.**
- ProjectPicker.tsx + ProjectPicker.css (CREATE): de-emphasized (server offline), composed from .meta + .field; co-located css constrains the shared .field (width:100%) to a compact muted select.
- AddShaderModal.tsx + add-shader-modal.css (CREATE): re-homed the .add-shader-modal* rules the CD removed from styles.css into a co-located, restyled sheet - surface-2 panel, hairline border, tight radius, mono kind-chips, .btn/.btn--accent actions, --input-bg + --font-mono source textarea. Scrim is color-mix(in srgb, var(--bg) 72%, transparent) (tokenized, no hardcoded color). Reduced-motion-safe entrance.

## CD revision round 1 (select-all on edit-open)
- BUG (CD-caught in Chrome): double-click into type-edit did not select the existing value, so typed chars MERGED with old digits (1.10 -> type "4.2" -> committed garbage 3.00). My select() lived in the open/close useEffect; the browser's post-dblclick caret placement was clearing it.
- FIX: moved selection onto the edit input itself - `autoFocus` + `onFocus={(e) => e.currentTarget.select()}`. onFocus fires after the dblclick mouseup settles, so the selection survives. Reduced the effect to only return focus to the scrubber on close.
- Rounding (documented): typed values go through the same quantize() - clamp to [min,max] then snap to nearest step via Math.round (round-half-up). So "4.2" at step 0.5 lands on 4.0.
- Test added: entering edit selects the whole value (selectionStart 0 / selectionEnd = length) and a fresh typed number commits stepped/clamped (4.2 -> 4.0), not merged. controls 11/11, full suite 161/161, tsc clean.

## Cross-builder contract (PROPOSED to CD for Builder A to wire in App.tsx)
TopBar should receive the live layer stack so export works with no server:
  `<TopBar ... layers={layers} />`  (drop onSend/canSend)
TopBar computes canExport = layers.length > 0 internally and calls export.ts directly. Until wired, export buttons render disabled (layers defaults to []).

## Verify
- `npm run typecheck` (tsc --noEmit): zero errors.
- `npm test` (vitest run): 160/160 pass. Added 4 Slider scrub tests (arrow nudge + Shift-10x clamp, double-click->type->Enter clamped commit, Esc cancel) + 4 export.ts unit tests.

## Files touched
- app/src/components/controls/Slider.tsx, Slider.css
- app/src/lib/export.ts (new), app/src/lib/export.test.ts (new)
- app/src/components/TopBar.tsx
- app/src/components/ProjectPicker.tsx, ProjectPicker.css (new)
- app/src/components/AddShaderModal.tsx, add-shader-modal.css (new)
- app/src/components/controls/controls.test.tsx (scrub tests)
