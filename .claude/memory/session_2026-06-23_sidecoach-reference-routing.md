---
name: Sidecoach reference integration - Deliverable A (routing flowC/flowD into lanes/verbs)
description: Wired orphaned font (flowC) + design-ref (flowD) flows into lane_build/craft, typeset, colorize (covers lane_delight/lane_live); proven firing via before/after harness
type: project
relates_to: [session_2026-06-23_sidecoach-reference-integration-plan.md, reference_sidecoach_reference_routing_map.md]
---

Collaborator: Jonah Cohen

Deliverable A of the "make Sidecoach reference systems fire more aggressively" task. flowC_font_research (fontshare) and flowD_reference_inspiration (live design-references) were orphaned from every lane and verb. Now routed in.

## What changed
- `sidecoach/src/verb-command-registry.ts` (SOURCE):
  - `craft.flowIds`: inserted `flowC_font_research` + `flowD_reference_inspiration` right after `flowB_component_research` (research tier grouped before flowF/flowG; flowG's required prereq flowB still precedes it; flowC/flowD carry no required prereqs).
  - `typeset.flowIds`: `['flowC_font_research', 'flowS_typography_excellence']` (typeset's parityPlus already claimed "fontshare reference" but never ran flowC).
  - `colorize.flowIds`: `['flowD_reference_inspiration', 'flowF_design_tokens']`.
- Regenerated via `npm run generate-lanes` -> `lanes.generated.ts` + `LANES.generated.md`. NEVER hand-edited the generated file.
- `sidecoach/src/__tests__/lane-derivation.test.ts`: updated GOLDEN map for lane_build, lane_delight, lane_live from the real regenerated output.
- Added `sidecoach/scripts/prove-references-fire.ts` proof harness (kept; reused for deliverable #4).

## Why
Routing in sidecoach is verb-driven: each lane's `flowSequence` is DERIVED from `verbChain` -> `VERB_REGISTRY[verb].flowIds` (lane-derivation.ts). There is NO per-lane flow override, so the only way to wire a flow into a lane is to add it to a verb the lane's chain uses. `craft` is unique to lane_build; `colorize` is shared by lane_delight + lane_live, so one colorize edit wires flowD into both refinement lanes.

## How (key decisions)
- Scoping judgment (approved by lead): flowD into lane_delight + lane_live (via colorize) because reference palettes/visual inspiration genuinely inform a color/personality/live pass; flowC (fonts) NOT forced into those lanes - fonts do not materially serve a color/personality/live-iteration pass and would add noise. flowC stays scoped to craft (build) + typeset (type work).

## Proof (before/after, diff-style)
Harness drives lane_build through the REAL flow handlers (engine.getHandlers()) + a clean runValidator stub (same legitimate pattern as the committed lane-execution-e2e suite; the flows, not the validators, produce the reference artifacts). Captured BEFORE by pathspec `git stash` of only my 4 files, AFTER on the restored tree.
- ROUTING: craft flowC/flowD false/false -> true/true; typeset flowC false->true; colorize flowD false->true; lane_build/lane_delight/lane_live flowD false->true.
- FIRING: craft step flowIds gained flowC_font_research + flowD_reference_inspiration; new rows `flowC_font_research success artifacts=1 [Font Candidates]` and `flowD_reference_inspiration success`. flowC fired false->true, flowD fired false->true.
- Gotcha logged: the guidance-string marker for "design references" is a false positive (matches the static craft guidance "design references vetted for AI-slop") - the per-flow firing log is the honest signal. flowD shows 0 artifacts in a throwaway temp project because the LIVE ~/.claude/design-references catalog has no matching entry (correct live behavior; deliverable B surfaces live matches).

## Gates
`npm run build` exit 0; `npm test` = 56/56 suites pass (lane-derivation green).

## Files touched
- sidecoach/src/verb-command-registry.ts
- sidecoach/src/lanes.generated.ts (regenerated)
- sidecoach/LANES.generated.md (regenerated)
- sidecoach/src/__tests__/lane-derivation.test.ts
- sidecoach/scripts/prove-references-fire.ts (new harness)
- sidecoach/dist/* (build output)
