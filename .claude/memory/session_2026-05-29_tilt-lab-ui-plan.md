---
name: tilt-lab playground UI plan (Plan 3)
description: Wrote Plan 3 - the Vite + React playground UI for tilt-lab. 9 tasks: vite/react tooling, catalog loader+filter, validity-gated stack store, manifest-driven param controls, browse grid, preview canvas (bridges React to runtime Compositor), view components, app shell, and a cmux + sidecoach QA-gate verification task.
type: project
relates_to: [session_2026-05-29_tilt-lab-foundation-exec.md, session_2026-05-29_tilt-lab-brainstorm.md]
---

Collaborator: Jonah. 2026-05-29. Via writing-plans (user chose "draft Plan 3 UI now" while recon runs). Plan independent of recon - it is catalog-driven, fully exercisable with just the gradient reference effect.

## Structure
tilt-lab/app/ (Vite root, port 5180) -> dist/app. State modules are framework-free + unit-tested: catalog.ts (loadCatalog via import.meta.glob of runtime/effects/*/manifest.json + filterCatalog), stackStore.ts (createStackStore: add/remove/reorder/setParam, add gated by runtime validateStack, returns reason on reject, subscribe for useSyncExternalStore). Components: ParamControls (manifest-driven range/color/toggle/select), BrowseGrid (search+role filter), PreviewCanvas (mounts runtime Compositor, RAF, setLayers on change - the React<->runtime bridge), LayerStack, TopBar, ProjectPicker, AddShaderModal, App shell (3-col grid: browse | preview | layers).

## Test strategy
Logic unit-tested with vitest + @testing-library/react (jsdom via environmentMatchGlobs; runtime stays happy-dom). Visual/interactive correctness via cmux screenshots + real-input interaction + sidecoach QA gate (audit->critique->polish + make-interfaces-feel-better), NOT unit asserts - can't unit-test that a gradient renders.

## Seams to Plan 4 (documented, not placeholders)
TopBar onSend + AddShaderModal onSubmit + ProjectPicker projects[] are no-op/empty now; server enumeration, package write, handoff signal wired in Plan 4.

## Files
- docs/superpowers/plans/2026-05-29-tilt-lab-playground-ui.md (new)
