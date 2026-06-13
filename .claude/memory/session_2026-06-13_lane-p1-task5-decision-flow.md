---
name: Lane P1 Task 5 - decision flow (classify_intent) with documented precedence
description: Implemented Task 5 via TDD - classify_intent() top-level decision flow (ROUTE/CLASSIFY/CONTEXT_CHECK/OUT_OF_SCOPE/VERB/NUDGE_ELIGIBLE/SILENT) + is_informational/detect_verb; 34/34 incl 4 adversarial precedence/table edges.
type: project
relates_to: [session_2026-06-13_lane-p1-task4-scoring-scope.md]
---

Collaborator: Jonah

Implemented **Task 5 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. TDD; committed only the two modified files.

## What was done

- `claude/hooks/sidecoach_lanes.py` - appended (verbatim from plan Step 3):
  - `is_informational(text, pattern)` - suppresses a verb that appears only inside an informational frame (what/how/explain/define/"X is a").
  - `detect_verb(text, verbs)` - first verb whose word-boundary pattern matches and is not informational.
  - `classify_intent(prompt, reg, verbs, intent_eligible=False)` - the spec-section-5 decision flow. Precedence: literal `/sidecoach` -> SILENT (slash router owns it, Task 8); explicit verb evaluated BEFORE inferred-lane scope (verb never preempted by CONTEXT-CHECK/OUT_OF_SCOPE); a route-grade IN_SCOPE lane competing with a verb -> CLASSIFY, else VERB with the strongest score>0 lane as a non-routing diagnosticLane. No-verb: IN_SCOPE -> ROUTE (route-grade) / CLASSIFY (>=classify_floor) ; SCOPE_UNKNOWN+evidence -> CONTEXT_CHECK; OUT_OF_SCOPE+evidence -> OUT_OF_SCOPE; else NUDGE_ELIGIBLE (if eligible) / SILENT. route_floor=3, route_margin=2.
- `claude/hooks/test_sidecoach_lanes.py` - the plan's 10 tests + 4 adversarial (before `__main__`).

## Result dict shape (TS-mirror parity contract)

`{outcome, winningLane, verbMatch, diagnosticLane, laneScores, schemaVersion}` - locked by `test_result_dict_shape_matches_ts_mirror_contract` (exact key set + each laneScores entry = evaluate_lane shape + schemaVersion == SCHEMA_VERSION). Must match the TS mirror in Task 7.

## Adversarial tests (spec section 5 precedence + outcome table)

Plan tests cover: CONTEXT_CHECK (SCOPE_UNKNOWN+evidence), never-routes-migration (OOS), (3,0)->ROUTE, verb-beats-SCOPE_UNKNOWN (diagnosticLane set), verb+route-grade->CLASSIFY, (2,0)->CLASSIFY, SILENT, NUDGE_ELIGIBLE, /sidecoach->SILENT. Added the gaps:
- `test_explicit_verb_beats_out_of_scope_evidence` - verb + OUT_OF_SCOPE lane evidence -> still VERB, winningLane None (the v8-review fix: verb never preempted by OOS). Note: diagnosticLane is None here because OOS forces score 0 and the diagnostic requires score>0 - documented, not a bug.
- `test_within_margin_competing_lane_is_classify_not_route` - IN_SCOPE top=3 with competing IN_SCOPE=2 (margin 1 < 2) -> CLASSIFY, winner=top (no-silent-expand).
- `test_tie_top_lanes_is_classify_not_route` - two IN_SCOPE lanes tied at 3 (margin 0) -> CLASSIFY.
- `test_result_dict_shape_matches_ts_mirror_contract` - the parity contract above.
- Note: the table's (3,1)->ROUTE cell is not constructible with the real registry (min lexicon weight is 2, so a competing lane can't score exactly 1); locked (3,0)->ROUTE and (3,2)/tie->CLASSIFY instead, which bound the route_margin rule.

## Verification

- TDD red: 13 new tests FAIL with `AttributeError: ... no attribute 'classify_intent'` (right reason); 21 prior pass. (`21 passed, 13 failed`)
- TDD green: `34 passed, 0 failed`, exit 0.
- Runner: `python3 test_sidecoach_lanes.py`. model-router-guard: pure stdlib (re), no LLM/network.
- Perf note (verifier's optional): classify_intent calls evaluate_lane per lane (recomputes sanitize/blank/segment + recompiles regex ~6x). Plan Step-3 code does NOT hoist, so left as written (negligible at hook scale; Python caches compiles).

## Follow-up: route_margin==2 boundary guard (verifier correction)

I was WRONG that the margin==2 boundary wasn't constructible - I only considered single-group lanes (max-per-group), forgetting lane_build has TWO groups (greenfield 3 + build_verb 2) that SUM to 5. The verifier caught it. Added `test_route_margin_boundary_exactly_two_routes`: "build me a dashboard from scratch and make it production-ready" -> lane_build=5 IN_SCOPE, lane_ship=3 IN_SCOPE, margin EXACTLY 2 == route_margin, so `>=` ROUTES (winningLane lane_build). A `>=`->`>` regression would flip it to CLASSIFY. "build" is not in the verb list so the no-verb IN_SCOPE branch is exercised. Verified scores 5/3 directly. Still 35/35. Test-only commit (separate SHA).
Lesson: when reasoning about achievable scores, account for MULTI-group lanes (cross-group sums), not just the per-group max.

## Files touched

- claude/hooks/sidecoach_lanes.py (added is_informational/detect_verb/classify_intent)
- claude/hooks/test_sidecoach_lanes.py (+14 tests; later: +1 route_margin boundary guard)
