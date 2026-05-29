---
name: tilt-lab scope reconciliation vs ORIGINAL task (authoritative target set)
description: Re-anchored on Jonah's original shader list. Identifies exactly what was DROPPED (must add), what was ADDED unrequested (must reconcile), and the precise 25-effect catalog target. Drives the autonomous restore team.
type: project
relates_to: [feedback_tilt_lab_fidelity_mandate.md, session_2026-05-29_tilt-lab-acquisition-exec.md, session_2026-05-29_brainstorm? ]
---

Collaborator: Jonah. 2026-05-29. After "/loop" directive: effects missing key components, some included that weren't requested, dropped some that were. Re-verified against the ORIGINAL first-message list. "Leave nothing out. Do not fail me again."

## ORIGINAL requested list (verbatim intent)
1. regent: fluid, fractal-glass, halftone, mesh-gradient, swarm (5)
2. paper.design: grain-gradient, neuro-noise (2) -- ONLY these two from paper
3. spell.sh: animated gradient (1)
4. cobe.vercel.app: globe (1)
5. particles.casberry.in: particles (1)
6. unlumen: cursor-image-trail (1)
7. unlumen: aurora (aurora-card background) (1)
8. motion-core.dev (ALL 12): dithered-image, fake-3d-image, glass-slideshow, globe, halo, infinite-gallery, interactive-grid, lava-lamp, neural-noise, plasma-grid, specular-band, water-ripple
9. ascii-magic.com: ascii (1)
TOTAL = 25 effects (note: TWO globes - cobe's AND motion-core's, both requested; TWO noises - paper neuro-noise AND motion-core neural-noise, both requested).
Plus: "the ability to add a shader to the collection."

## What I shipped (23 dirs) vs target
DROPPED (must BUILD - these were explicitly requested):
- spell.sh animated-gradient (I substituted paper "swirl" instead - WRONG)
- motion-core glass-slideshow (I called it out-of-scope - WRONG)
- motion-core infinite-gallery (out-of-scope - WRONG)
- motion-core globe (I deduped against cobe - WRONG; user listed both)
ADDED UNREQUESTED (must reconcile):
- "swirl" (paper) - user only asked paper for grain-gradient + neuro-noise. Reconcile: spell's animated-gradient IS a swirl (recon: spell = reimpl of paper swirl); REBUILD as id "animated-gradient" sourced from spell lane-3, REMOVE the paper "swirl" id.
- "gradient" (Animated Gradient reference) - not from any source; it's the contract test fixture. Keep the DIR for foundation tests, but EXCLUDE from the catalog registry (builtinManifests) so it is not user-facing.

## PRECISE TARGET CATALOG (25 effects, ids)
fluid, fractal-glass, halftone, mesh-gradient, swarm, grain-gradient, neuro-noise, animated-gradient (spell), globe (cobe), particles, cursor-trail, aurora, dithered-image, fake-3d-image, glass-slideshow, mc-globe (motion-core globe), halo, infinite-gallery, interactive-grid, lava-lamp, neural-noise, plasma-grid, specular-band, water-ripple, ascii.
(gradient stays as a non-catalog test fixture.)

## FIDELITY (all effects, the mandate)
Every effect must expose its ORIGINAL's full param/uniform set with REAL defaults - nothing dropped/simplified/fabricated. Ground truth: recon reports docs/superpowers/tilt-lab-recon/lane-*.md + local regent /tools/<effect>/ + upstream (paper/motion-core/cobe/unlumen). mesh-gradient already restored as exemplar (had fabricated colors + dropped scene presets). Known suspects: ascii (dropped 3d/disco/shapes render modes), fluid (GPU particle layer unwired).

## VALIDATION
Build our own expect-inspired tool (leverage /tmp/expect-src; FSL but user authorized for personal local use, remove expect branding). Validate each effect with that tool (Playwright functional checks) + Claude-in-Chrome visual (tabId 1827119023, localhost:5180). cmux dropped.

## Plan: autonomous team (tilt-restore)
Pre-assigned distinct tasks (no spawn-race): (A) build the verification tool, (B) build 4 missing effects, (C) fidelity-audit + restore existing effects per lane, (D) reconcile swirl->animated-gradient + gradient out of catalog. Then validate. /loop keeps coordinating until complete.
