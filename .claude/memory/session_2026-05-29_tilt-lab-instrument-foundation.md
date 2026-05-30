---
name: tilt-lab instrument redesign - foundation (fonts + tokens)
description: design-team Phase 2 build foundation for the instrument-not-dashboard redesign. Self-hosted justify (Anthropic) fonts into app/public/fonts; rewriting styles.css token system to warm near-black ladder + Yes& red #DC2618 + JustifySans/JustifyMono. Builders fan out on disjoint verticals after.
type: project
relates_to: [session_2026-05-29_tilt-lab-design-direction.md, session_2026-05-29_tilt-lab-taste-DONE.md]
---

Collaborator: Jonah. 2026-05-29. tilt-design team, build phase. Direction locked + 2 forks resolved by user.

## Done
- Copied justifysans-400.woff2, justifysans-700.woff2, justifymono-400.woff2 from justify/fonts/ -> tilt-lab/app/public/fonts/ (served at /fonts/ by Vite). These ARE the Anthropic faces (justify rename).

## Done (me / CD, main thread - owns styles.css)
- styles.css FULL REWRITE complete: @font-face (3 faces, /fonts/), warm near-black surface ladder (--bg #0c0b0a, --surface-1/2/3, --preview-bg #000), 2-tier hairlines, Yes& red #dc2618 accent (hover #b01f15), --font-sans JustifySans / --font-mono JustifyMono. Shared primitives builders compose: .module (hairline-ruled group, border-top), .module__label/.meta (10px tracked uppercase mono), .value (tabular-mono readout), .btn/.btn--accent, .icon-btn (40x40), .field. Canvas-dominant .app__body grid with [data-rail-left/right=collapsed] (animated grid-template-columns) + .app[data-fullscreen] (hides topbar+rails). Tight radii (3/5/6px). Removed ALL old component rules (top-bar internals, browse-grid, layer-stack, param-controls, modal) - builders re-own co-located. Wordmark "&" glows accent via .top-bar__brand b.
- CONTRACT for builders: data attrs (data-fullscreen on .app; data-rail-left/right on .app__body), classes (.module/.module__label/.meta/.value/.btn/.btn--accent/.icon-btn/.field), tokens (--font-sans/-mono, --accent, surface ladder, --line/-2). Builders write co-located component CSS, NEVER edit styles.css.

## Build decomposition (disjoint files, no styles.css contention - only CD writes styles.css)
- Builder A (shell+browse): App.tsx (rail collapse + fullscreen state), BrowseGrid.tsx + browse-grid.css, NEW ThumbnailPreview.tsx (live mini-canvas per card).
- Builder B (layers+composition): LayerStack.tsx+css, stackStore.ts, compositor.ts, runtime/types.ts (add enabled+opacity to LayerConfig), PreviewCanvas.tsx, ParamControls.
- Builder C (controls+export): controls/Slider.tsx+css (scrub-to-edit numerics), TopBar.tsx, ProjectPicker.tsx, NEW export module (server-free download/copy JSON), AddShaderModal.tsx.

## Dev server: localhost:5180 (200). Verify in Claude-in-Chrome at end.
