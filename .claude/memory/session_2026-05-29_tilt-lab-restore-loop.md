---
name: tilt-lab restore - autonomous /loop state
description: Autonomous /loop running the tilt-restore team to bring all 25 effects to 1:1 fidelity, build the 4 dropped effects, build our own expect-inspired verifier, validate with it + Claude-in-Chrome. Coordination state across loop iterations.
type: project
relates_to: [session_2026-05-29_tilt-lab-scope-reconciliation.md, feedback_tilt_lab_fidelity_mandate.md, decision_behavioral_verifier_build_own.md]
---

Collaborator: Jonah. 2026-05-29. /loop autonomous: "do not come back until that work is complete. work autonomously."

## Team tilt-restore (7 pre-assigned tasks, all in_progress)
- #1 tool-dev: build our own expect-inspired verifier (leverage /tmp/expect-src, no expect branding, Playwright vs localhost:5180) -> tilt-lab/verify/.
- #2 fx-missing-1: build glass-slideshow + infinite-gallery (dropped).
- #3 fx-missing-2: build mc-globe + animated-gradient(spell); DELETE swirl (team-lead deregisters).
- #4 fx-regent: restore fluid(+wire GPU particle layer)/fractal-glass/halftone/swarm vs local regent.
- #5 fx-paper-ascii: restore grain-gradient/neuro-noise + ascii (restore 3d/disco/shapes modes).
- #6 fx-mc: restore 9 existing motion-core effects.
- #7 fx-misc: restore globe(cobe)/particles/cursor-trail/aurora.

## Team-lead (me) responsibilities across iterations
1. As agents report, review each summary.
2. CENTRAL registration in runtime/index.ts: add mc-globe, animated-gradient, glass-slideshow, infinite-gallery; REMOVE swirl; EXCLUDE gradient from catalog (keep as test fixture). Update integration test.
3. Run full vitest + tsc.
4. Validate functionally with the new verifier tool (once tool-dev ships it).
5. Validate visually in Claude-in-Chrome (tabId 1827119023, localhost:5180) - eyes-on each effect renders + matches original.
6. Commit per logical chunk (agents don't commit). Beats per task.
7. Loop until: 25-effect catalog complete + all fidelity-restored + all validated (tool + Chrome) green.

## Definition of done
All 25 requested effects present + 1:1 faithful (full original params, real defaults, nothing dropped/fabricated), gradient demoted to non-catalog fixture, swirl removed, verifier tool built + passing, every effect visually confirmed in Claude-in-Chrome. THEN report.

## Notes
- expect override: user authorized leveraging expect + removing accreditation for personal local use (see decision beat).
- dev server: localhost:5180 (bg bash bszkd9n62). cmux dropped; Claude-in-Chrome is the preview.
