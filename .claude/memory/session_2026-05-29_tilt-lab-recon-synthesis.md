---
name: tilt-lab recon synthesis - acquisition blueprint
description: Cross-lane synthesis of all 10 tilt-recon reports (5293 lines). The driver-kind taxonomy, license reconciliation, dedup/out-of-scope decisions, shared primitives, and per-effect inventory that ground Plan 2 acquisition.
type: decision
relates_to: [session_2026-05-29_tilt-lab-recon-team.md, session_2026-05-29_tilt-lab-pointer-contract-gap.md, session_2026-05-29_tilt-lab-foundation-exec.md]
---

Collaborator: Jonah. 2026-05-29. All 10 lanes complete (docs/superpowers/tilt-lab-recon/lane-*.md, 5293 lines). Recon team tilt-recon shut down after this synthesis.

## 1. Driver-kind taxonomy (the Plan-1 contract addendum)
Recon proved effects come in 3 drive shapes, not just frame(t):
- **frame(t)-driven** (fits the contract as-is): regent fluid/halftone/fractal-glass/mesh-gradient/swarm, paper grain-gradient/neuro-noise, spell swirl, ascii post, casberry particles, motion-core shaders, aurora (if we pump u_time).
- **self-driven** (lib owns its RAF): motion-core OGL Scenes, aurora R3F useFrame, cobe v1 onRender. BUT cobe@2.0.1 (published) REMOVED onRender+internal RAF -> render-on-demand via update(), already externally drivable (recon-b correction). Most "self-driven" cases are really "parametrized on time" and can be pumped by our frame(t) calling their update/tick.
- **pointer/DOM event-driven**: cursor-image-trail (DOM + Framer Motion, distance-gated on pointermove).
RESOLUTION for Plan 2 task 1 (backward-compatible, keeps 24/24 green): add OPTIONAL `onPointer(e)` to Effect + a shared pointer-position the wrapper maintains; add an OPTIONAL `mount(host)` DOM escape hatch for DOM/R3F effects that render to a subtree instead of the canvas. Canvas/frame(t) effects ignore both. Self-driven libs get wrapped so frame(t) -> their update().

## 2. License reconciliation (manifest redistribution flag; capture is verbatim per user posture regardless)
- regent = ok (owned). cobe = MIT -> ok. motion-core (8a AND 8b) = actually MIT -> ok (brief said personal-only; corrected). paper.design = PolyForm Shield 1.0.0 -> ok for non-competing tilt-lab use. spell.sh = no OSS license + is a reimplementation of paper's swirl -> personal-only (or just use paper's). casberry = proprietary/live-Firebase -> reimplemented. unlumen cursor-trail + aurora = commercial license-gated -> personal-only. ascii-magic = proprietary all-rights-reserved -> reimplemented.

## 3. Dedup + out-of-scope
- DUPLICATES (keep one canonical, tag the rest): globe (cobe == motion-core globe; keep cobe MIT), neural/neuro noise (paper neuro-noise ~ motion-core neural-noise), swirl (paper grain/swirl == spell animated-gradient). 
- OUT-OF-SCOPE content widgets (not stack layers): motion-core glass-slideshow + infinite-gallery. Salvage their shaders as primitives only, do not ship as effects.
- HYBRID: fake-3d-image = background+pointer. dithered-image = post BUT dithers an image, not the framebuffer (our post pipeline samples the composite canvas - adapt or scope as image-input).
- Net unique shippable effects: ~20-22 (from ~25 raw across lanes).

## 4. Shared primitives to extract ONCE
- Stam fluid solver: shared by regent halftone + fractal-glass (advect/divergence/pressure); unlumen bundle also carries one. Extract a single runtime/lib/fluid-solver.
- motion-core shared color.ts helper.
- Assets (requiredAssets): grain-gradient needs a noise texture; cobe needs a land/map texture; cursor-trail needs the image items[]. Bundle assets into the effect dir + handoff package assets/.

## 5. Tech stacks seen (for the acquisition adapter work)
raw WebGL1 (regent fluid), three.js (regent mesh-gradient/halftone/fractal-glass, casberry +InstancedMesh/UnrealBloom), Canvas2D (regent swarm, ascii), WebGL2 GLSL (paper, spell), OGL+Svelte5 (motion-core), GLSLX frag+vert (cobe), react-three-fiber (unlumen aurora), DOM+Framer-Motion (unlumen cursor-trail). The runtime must host raw-GL, three.js, OGL, and Canvas2D effects behind the one Effect contract - acquisition agents bring the minimal renderer dep per effect.

## Next
Plan 2 acquisition: task 1 = contract addendum (above) + tests; then one task/agent per lane reading its report, writing runtime/effects/<id>/{index.ts,manifest.json} + a conformance test mirroring effects/gradient, registering in effectFactories. Dedup canonicals, skip oos widgets, extract shared fluid solver first. Three.js/OGL become runtime deps.
