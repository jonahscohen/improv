---
name: PUNCH LIST - interactivity overhaul + per-effect fixes (Jonah, demotion-level)
description: Systemic miss - most shaders are interactive (cursor/click/drag/hover/scroll/touch) and we never ported it; the Effect contract only had onPointer. Plus per-effect failures (roles, presets, assets, flips). Full enumerated list to solve autonomously. New team.
type: project
relates_to: [session_2026-05-31_full-parity-results.md, feedback_tilt_lab_fidelity_mandate.md]
---

Collaborator: Jonah. 2026-06-01. Demotion-level feedback. Work autonomously until EACH is solved. Reference = the live originals (tabs open) + local instances (regent local; cobe local instance exists).

## #1 SYSTEMIC: INTERACTIVITY (the repeated miss)
Most effects need cursor/click/drag/hover/scroll/touch. The contract had only onPointer(x,y)+onPointerLeave; the wrapper (PreviewCanvas/compositor) forwarded only move+leave. FOUNDATION: extend the Effect interaction contract + wrapper event forwarding to pointer down/move/up/leave (with button state + coords), wheel/scroll, and touch normalization. Then EACH effect ports its original's full interaction set. For each effect, SURFACE (document) what interactions the original supports.

## DELETIONS (3)
- #4 particles (casberry) - DELETE entirely (dir + registry + tests).
- #6 cursor-trail (unlumen) - DELETE entirely.
- #16 plasma-grid - DELETE entirely.

## PER-EFFECT FIXES
- #2 animated-gradient (spell): changing preset does NOTHING -> fix preset apply.
- #3 globe (cobe): not functioning to expectation + MISSING ASSETS. Use cobe website + github + LOCAL instance. (cobe needs its map/texture data + proper render.)
- #5 aurora (unlumen): presets DON'T WORK -> fix (I failed to test it).
- #7 dithered-image: doesn't work to spec; must be POST (like ascii). Change layerRole -> post + fix.
- #8 fake-3d-image: renders UPSIDE DOWN; depthSrc usage not explained as in original demo -> fix flip + add depthSrc UX/guidance.
- #9 fluid: NO touch/hover/interactions from original package -> port them (drag = force+dye, etc).
- #10 fractal-glass: failed interactions -> port. ALSO want a POST-overlay variant.
- #11 halftone: failed interactions -> port. ALSO want a more-POST variant.
- #12 interactive-grid: is POST but doesn't BEHAVE like it -> fix role behavior + interaction.
- #13 mesh-gradient: color presets DON'T WORK -> fix; "probably more issues" -> audit.
- #14 neural-noise: ADD more features for interactivity + appearance customization.
- #15 glass-slideshow + infinite-gallery: use REAL images (not procedural/placeholder defaults).
- #15b water-ripple: is POST, FLAT OUT DOESN'T WORK ("most embarrassing") -> rebuild post + working + interactions.

## Process: close tilt-deploy team, start new team, fan out, verify EACH in Chrome (real pointer interaction, not just render), do not report done until the interaction works live.
