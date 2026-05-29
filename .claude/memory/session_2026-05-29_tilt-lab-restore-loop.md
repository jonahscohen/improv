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

## Progress (loop iterations)
DONE: #5 paper+ascii (neuro 10->15, grain 14->23, ascii restored lego/3d/disco/shapes modes 11->15), #6 motion-core 9 (dithered-image restored halftone+voidAndCluster maps; other 8 ok), #7 globe/particles/cursor-trail/aurora (globe had FABRICATED colors -> restored real cobe palette + offset + markers; particles +morphSpeed; cursor-trail fixed 2 behavioral bugs; aurora faithful), #2 glass-slideshow + infinite-gallery BUILT (OGL, need registration; assets under image0/image1.. keys w/ fallbacks).
PENDING: #1 tool-dev (verifier, added playwright dep), #3 fx-missing-2 (mc-globe + animated-gradient + DELETE swirl), #4 fx-regent (restore regent; swarm has unused SWARM_PRESETS tsc error + fluid errors - in progress).

## CONTRACT-GAP FLAGS to handle in integration pass (additive)
1. cursor-trail: original wipes trail on mouseLEAVE; Effect contract has no onPointerLeave. ADD optional onPointerLeave?() to Effect + wire in element.ts + compositor.ts (mirrors onPointer). Then cursor-trail uses it. Keeps 1:1 fidelity.
2. globe markers: functionally wired (drivable via params) but no manifest ParamType (markers = array of {location,size,color}). For UI control, add a `marker-list` ParamType (touches types.ts ParamType union + ParamControls). Lower priority than core effects; do if time, else markers still drivable programmatically.

## INTEGRATION PASS (team-lead, after #3 + #4 land) - do ONCE
runtime/index.ts: ADD glass-slideshow, infinite-gallery, mc-globe, animated-gradient; REMOVE swirl; EXCLUDE gradient from builtinManifests (keep dir as test fixture). Add onPointerLeave to contract. Update integration test (24->25 catalog count). Full vitest + tsc. Then validate: verifier tool (when #1 done) + Claude-in-Chrome visual sweep (tabId 1827119023) of every effect, esp ascii 3d/disco/shapes (reimplemented from prose) + the 4 newly-built.

## Notes
- expect override: user authorized leveraging expect + removing accreditation for personal local use (see decision beat).
- dev server: localhost:5180 (bg bash bszkd9n62). cmux dropped; Claude-in-Chrome is the preview.
