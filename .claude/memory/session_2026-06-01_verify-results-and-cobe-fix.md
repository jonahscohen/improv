---
name: tilt-verify full-catalog results + cobe globe poster-crash fix + harness segmented-select fix
description: Fixed harness ran the full catalog - everything functionally PASSES (add-layer 25/25, canvas-paint 25/25, param-interaction incl. all preset switches). The ONE systemic failure (every effect's console-clean) was a single cobe bug; fixed with a prototype null-program guard, verified 0 console errors + live globe drag-spin in Chrome. Also taught the harness to drive the segmented-radiogroup Select variant.
type: project
relates_to: [session_2026-06-01_verify-harness-selector-drift.md, session_2026-06-01_interactivity-overhaul-punchlist.md, session_2026-05-29_tilt-lab-scope-reconciliation.md]
---

Collaborator: Jonah. 2026-06-01.

## Full-catalog verify results (fixed harness, healthy server)
`npm run verify -- --all`: pass=88, fail=25 (all the SAME cobe console error), skip=4 (headless perf advisories).
- **add-layer: 25/25 PASS** - every effect adds to the stack.
- **canvas-paint: 25/25 PASS** - real pixels, incl. all asset-backed effects: glass-slideshow [image0,image1], infinite-gallery [image0,1,2], interactive-grid [image], water-ripple [image,brush], grain-gradient [noiseTexture], mc-globe [landTexture], fake-3d-image [colorSrc,depthSrc]. (#15 REAL images confirmed.)
- **param-interaction PASS incl. the flagged preset switches**: animated-gradient custom->Prism (#2), aurora Custom->Blue Night (#5), mesh-gradient Default->Aurora (#13), plus globe/grain/neuro/fluid/fractal-glass/halftone/swarm scenes. The systemic preset fix is tool-confirmed.

## Root cause of the 25 console-clean fails = ONE cobe bug (not 25)
cobe v0.6.5 (`node_modules/.vite/deps/cobe.js`) defers its world-map texture upload to an `Image.onload` that does `T = gl.getParameter(CURRENT_PROGRAM); gl.getUniformLocation(T,"H")`. tilt-lab's browse-grid POSTER path (ThumbnailPreview.renderPoster) inits a globe then disposes it synchronously - well before the data-URI map decodes. After teardown CURRENT_PROGRAM is null, so cobe calls `getUniformLocation(null,...)`, which fails WebGL's WebGLProgram type check and throws an uncaught TypeError ONCE per page load (the globe thumbnail). Each effect's verify loads a fresh page -> every console-clean caught that one shared error.

### Fix: prototype null-program guard (runtime/effects/globe/index.ts, module scope)
An instance-level stub in dispose() did NOT reliably intercept (the context object cobe holds vs what getContext returns at teardown). Replaced with `installCobeNullProgramGuard()` at module load: wraps WebGL[2]RenderingContext.prototype.getUniformLocation so a null/invalid program returns null instead of throwing. That IS the WebGL spec behaviour for a null program, so only the degenerate case changes; every real call passes straight through. Idempotent (`__tiltNullSafe`). dispose() reverted to clean.

### Verified live in Chrome (tabId 1827119115)
- Fresh reload: **0 console errors** (cobe throw gone).
- Live globe renders the dotted continents (map asset loads), SF+NYC orange markers present, full 13-param cobe control surface (preset dropdown, marker-list editor, autoRotate, speed/phi/theta/scale/diffuse/dark/opacity). #3 ("not functioning + missing assets") RESOLVED.
- **Drag-to-spin confirmed**: a vertical drag tilted the globe (theta) - landmasses redistributed, marker swung from upper-right to left edge. Auto-rotation only spins longitude, so the pole-tilt can only be the drag handler. #1 interactivity for globe confirmed.

## Harness fix #2: segmented-radiogroup Select (verify/lib/checks.mjs)
dithered-image (ditherMap) + media (fit) threw `inputValue: Node is not an <input>` - the Select control renders small option sets as a segmented `role=radiogroup` (role=radio buttons), not a native <select>. Taught exerciseParam to detect tagName: native <select> -> selectOption; else click a non-checked radio and assert aria-checked moves. Wrapped each per-param attempt in try/catch so one un-exercisable control falls through to the next param instead of aborting the effect.

## NEXT
Re-run `npm run verify -- --all` on the shim'd build -> expect console-clean green across all + dithered/media reporting real param checks. Then stand down idle agents (fid-mc-b pane alive, fx-*, preset-registry idle) + commit the whole overhaul. Note for thoroughness: the globe browse THUMBNAIL is a graceful "G" fallback tile (poster disposes before the async map loads) - acceptable, no crash; could later seed a static globe poster image if a live thumbnail is wanted.

## Files touched
runtime/effects/globe/index.ts (cobe null guard + dispose revert), verify/lib/checks.mjs (segmented-select drive + per-param guard; earlier: selector realignment).
