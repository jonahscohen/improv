---
name: tilt-lab acquisition plan (Plan 2)
description: Wrote Plan 2 - acquisition. Code-complete tasks for the contract addendum (optional onPointer + mount host), renderer deps (three/ogl/cobe), shared Stam fluid solver, and a conformance-test template; then a TEAM fan-out (one agent per recon lane porting verbatim source into the contract) and central registration + integration verification.
type: project
relates_to: [session_2026-05-29_tilt-lab-recon-synthesis.md, session_2026-05-29_tilt-lab-pointer-contract-gap.md, session_2026-05-29_tilt-lab-foundation-exec.md]
---

Collaborator: Jonah. 2026-05-29. Via writing-plans, grounded in the recon synthesis. Recon team already torn down (TeamDelete tilt-recon).

## Plan 2 shape
Tasks 1-4 sequential + code-complete (unblock the fan-out): (1) backward-compatible Effect addendum - optional onPointer(x,y) + mount(host) + a shared PointerTracker, wired into element.ts, keeps existing 24/24 green (becomes 25). (2) add three ^0.170, ogl ^1.0.11, cobe ^0.6.3 deps. (3) extract the shared Stam fluid-solver (halftone + fractal-glass share it) into runtime/lib, CPU/Float32Array so unit-testable. (4) _TEMPLATE.test.ts.md conformance test every acquired effect copies.
Task 5 = TEAM fan-out (tilt-acquire), one agent per lane reading its recon report + porting verbatim into runtime/effects/<id>/{index.ts,manifest.json,index.test.ts}; agents do NOT edit the shared registry (avoid write conflicts). Task 6 = central registration in index.ts + integration test (every factory registers an element; a bg+mid+post stack composites without throwing) + build + smoke.

## Canonical inventory (~20-22 effects after dedup/scope)
Kept: fluid, mesh-gradient, halftone, fractal-glass, swarm (L1); grain-gradient, neuro-noise, swirl (L2); globe (L4 cobe@2 update-driven); particles (L5); cursor-trail (L6 DOM+pointer); aurora (L7); dithered-image, halo, fake-3d-image (L8a); interactive-grid, lava-lamp, plasma-grid, specular-band, water-ripple, neural-noise-if-distinct (L8b); ascii (L9).
SKIPPED: spell animated-gradient (dup of swirl), motion-core globe (dup of cobe), glass-slideshow + infinite-gallery (out-of-scope content widgets).

## Driver kinds handled
frame(t) (most), self-driven libs pumped via frame->update (cobe@2, OGL scenes), pointer/DOM (cursor-trail via mount+onPointer). fake-3d-image + interactive-grid are frame+pointer.

## Status / next FORK
4 implementation plans now exist (spec, Plan1 foundation [BUILT], Plan3 UI, Plan2 acquisition). Foundation is built + green. NEXT is dispatching the tilt-acquire team (Task 5) = ~10 agents writing ~20 effects + adding deps - a big code-writing commit. Per autonomy-pause-for-forks: check in with Jonah before spawning it.

## Files
- docs/superpowers/plans/2026-05-29-tilt-lab-acquisition.md (new)
