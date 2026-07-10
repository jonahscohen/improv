---
name: Justify settings color picker - theme row + marker swatches dispatched
description: Jonah wants the color picker back in the justify settings panel - two rows (Light/Dark/System theme + Yes& Red/Claude Orange/Codex Blue marker swatches); grounded the spec (marker plumbing exists end to end with no UI; NO theme system exists - net-new palette mechanism; brand tokens sourced from DESIGN.md); dispatched to an Opus executor
type: project
relates_to: [session_2026-07-04_justify-settings-cleanup.md]
---

Collaborator: Jonah. 2026-07-04.

Jonah: "add the color picker back into the settings panel. Two rows: 1) Light/Dark/System 2) Yes& Red/Claude Orange/Codex Blue."

## Grounding (verified before dispatch)
- History check: no prior theme/color rows existed in this toolbar incarnation (both recent commits checked) - "back" is net-new here.
- Marker color: full plumbing already live (markerColor field, callbacks, getMarkerColor/onMarkerColorChange; core/index.ts propagates to overlay highlight, screen glow, prompt color). Only the UI is missing.
- Theme: NO system exists; all chrome hardcoded dark. Spec'd a palette module (dark = current values; light = brand cream/ink from marketing DESIGN.md), resolveTheme with system via prefers-color-scheme, themed-surface registry for live re-skin, localStorage persistence for BOTH settings (current settings reset per load - same defect class as the toggle-seeding bug, so persistence is part of doing this right).
- Colors: Yes& Red #DC2618 (DESIGN.md brand token), Claude Orange #D97757 (justify's existing default), Codex Blue - NO in-repo token exists; provisional #3B82F6 chosen and FLAGGED to Jonah for correction.
- Executor constraints: must not touch clampPromptTop/show positioning (just fixed, unit-tested) or the rAF writers; default theme 'dark' so nothing changes until touched; tsc pre-existing errors catalogued, no new ones allowed; suite baseline 2 pre-existing failed files.

## SHIPPED (same day) - executor delivered, Codex gate folded, live-verified both directions
- Executor built: exported palette module (resolveTheme/PALETTES/currentPalette/registerThemedSurface), Theme segmented row + Marker Color swatch row above the toggles, localStorage persistence (justify.theme / justify.markerColor) restored at construction, matchMedia listener only while theme=system, made the previously-stubbed marker infra functional, 16 new unit tests (pure fakes). It self-caught 2 bugs pre-report (stale swatch ring, stale toggle track) and correctly flagged that marker restore relies on getMarkerColor() reads at activation since callbacks register later.
- LABEL RULING: executor had renamed swatches to satisfy the no-external-names constraint; lead ruled that rule guards SOURCE ATTRIBUTION, not naming tools the product integrates with - literal spec names restored (Yes& Red / Claude Orange / Codex Blue).
- CODEX GATE: 1 HIGH + 2 MEDIUM + 1 LOW, all folded by the lead (crossed into core/index.ts outside executor ownership): (H) marker restore never reached prompt surfaces - activate() now seeds _selColor from the color getter, _showSelOverlays/lasso use _selColor, inline glow/typing/focus-border use _markerColor; (M1) live prompt labels missed theme changes - PromptMode.applyTheme() restyles the hover label + re-renders overlays, wired via onThemeChange in the guarded block; (M2) light-theme leaks in transient resets - toolbar mouseleave, settings-active accent (now markerColor), inline clear/hide resets all read live palette; (L) duplicate onMarkerColorChange registration removed (was inert while the setter was stubbed, became a double-fire once functional).
- VERIFIED: tsc 162 errors (baseline 164 pre-unit; NET -2, zero new); suite 2 pre-existing failed files | 11 passed (+16 theme tests, +6 flip tests intact); live in-browser: both rows render to spec, Light theme re-skins panel/toolbar/tooltip/input/labels, red swatch propagates to toggle tracks/gear/glow, HARD RELOAD restores Light+Red (pill cream before any interaction), restored marker reaches the screen glow + prompt surfaces (the HIGH fix observed: red glow from persisted state), reverse Dark+Orange transition re-skins everything live including the open panel and existing selection label. Defaults restored after testing.
- Codex Blue #3B82F6 remains PROVISIONAL - flagged to Jonah, one-line swap.

Files touched (unit total): justify/core/toolbar.ts; justify/core/prompt/inline-prompt.ts; justify/core/prompt/index.ts; justify/core/index.ts (lead folds); justify/__tests__/core/toolbar-theme.test.ts (NEW); deployed bundles; this beat + MEMORY.md.
