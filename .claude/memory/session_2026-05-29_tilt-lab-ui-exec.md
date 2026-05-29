---
name: tilt-lab UI execution (Plan 3)
description: Building the Vite + React playground inline per Plan 3. Progress log; UI is catalog-driven over the 23 registered effects.
type: project
relates_to: [session_2026-05-29_tilt-lab-ui-plan.md, session_2026-05-29_tilt-lab-acquisition-exec.md]
---

Collaborator: Jonah. 2026-05-29. User chose "execute Plan 3 (build the UI)" after acquisition completed (23 effects, 106 tests green).

## Progress
- [x] Task 1 tooling: package.json +react/react-dom/vite/@vitejs/plugin-react/@testing-library/react/jsdom; scripts dev (vite app --port 5180) + build:app. app/vite.config.ts (no root: line - config lives in app/ so root defaults there; outDir ../dist/app). app/index.html. vitest.config.ts: include app/**/*.test.tsx + environmentMatchGlobs app/**->jsdom (runtime stays happy-dom). npm install OK; runtime suite still 106/106.
- [ ] Task 2 catalog loader+filter (use runtime builtinManifests instead of import.meta.glob - already validated)
- [ ] Task 3 stackStore
- [ ] Task 4 ParamControls
- [ ] Task 5 BrowseGrid
- [ ] Task 6 PreviewCanvas (React<->Compositor bridge)
- [ ] Task 7 LayerStack/TopBar/ProjectPicker/AddShaderModal
- [ ] Task 8 App shell + main + styles
- [ ] Task 9 cmux visual verification + sidecoach QA gate

## Deviation from plan (improvement)
loadCatalog will return runtime's exported builtinManifests (added during acquisition) rather than import.meta.glob - simpler, pre-validated, no glob. filterCatalog unchanged (the testable part).

## Files
- tilt-lab/package.json, app/vite.config.ts, app/index.html, vitest.config.ts
