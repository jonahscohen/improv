---
name: P4d MCP migration execution (lane-p4d branch)
description: TDD execution of the P4d plan - classify_intent/list_lanes replace resolve_keyword/list_modes, new sidecoach_lane tool
type: project
relates_to: [session_2026-06-14_p4d-v2-approved.md, session_2026-06-14_lane-p4d-plan.md]
---

Collaborator: Jonah

Executing the approved P4d v2 plan (docs/superpowers/plans/2026-06-14-lane-p4d-mcp-migration.md) on branch lane-p4d. Migrates the sidecoach lane feature onto the model-facing MCP server: replaces legacy resolve_keyword/list_modes tools with classify_intent/list_lanes, adds a four-operation sidecoach_lane tool, reusing the existing classifier and engine.

Baselines (this host): engine `npm test` = 45 suite(s) passed; mcp-server `npm test` = 254 tests, 253 passed, 1 failed. The ONE failure is the known environmental `python_repl OOM` test (macOS has no cgroup memory enforcement to OOM-kill an over-256m subprocess). Not a P4d concern; success bar = OOM is the ONLY failure anywhere.

Progress (one line per task):
- Task 1 DONE (commit 01616cd): lane + intent registry loaders in registries.ts (loadLaneRegistry uses keyword-resolver loadRegistry, throws->null slot, no silent fallback; loadIntentRegistry plain JSON parse; RegistryBundle gains lanes/intent; all 4 typed fixtures + 2 untyped fixtures migrated). mcp-server 260 tests 259 passed (only OOM). engine 45 suites.
- Task 2 DONE: intentEligible() port (faithful to hook) + 4 divergence corpus rows + computed-eligibility parity loop. Contradiction resolved via team-lead-approved Option 1: corrected the one pre-existing row "The landing page is done. Make the migration production-ready." eligible false->true, expect OUT_OF_SCOPE->NUDGE_ELIGIBLE. Guardrails met: OOS still reached by "butter the migration aside" row (computes eligible=false); Python test_classifier_parity.py PASS (23 cases); no carve-out added. mcp-server 270/269 (only OOM); engine 45 suites incl "classifier-parity: 23 cases OK (declared + computed eligibility)".

- Task 3 DONE (commit 8fb5518): added classifyIntentShape, listLanesShape, laneShape (+ refined LaneInput with 5 .refine cross-field contracts) and types to schemas.ts; TOOL_INPUT_SCHEMAS gained classify_intent/list_lanes/lane ADDITIVELY. schemas.test.ts gained 7 cases. mcp-server 277/276 (only OOM); engine 45 suites.
- Tasks 4-7 DONE (UNCOMMITTED, accumulate to Task 8 atomic cutover): T4 classify-intent.ts replaces resolve-keyword.ts (git rm); T5 list-lanes.ts replaces list-modes.ts (git rm) + cheatsheet section modes->lanes; T6 added signal: AbortSignal to ToolDependencies + server.ts wrapHandler passes controller.signal, migrated all direct-handler deps fixtures; T7 lane.ts (4 ops + raceResponseDeadline). All callers migrated (in-memory, stdio, smoke.sh, tools.test, registry-missing, timeout). Source checks green: tsc clean, unit 229/229, fault 37/38 (only OOM), engine 45 suites. lane-tool-e2e verified directly via ts-node (5/5, real advance round-trip).

- Task 8 DONE (commit 9f0ad55, atomic cutover): pre-dist audits clean, pre-dist audits clean (RegistryBundle typed constructions only in 4 enumerated files w/ lanes+intent; all handler-deps have signal; buildServer options correctly without). README.md + DESIGN.md updated (list_lanes, classify_intent, sidecoach_lane, cheatsheet section lanes, lane/intent registry-loading + signal-as-response-deadline notes). Built mcp-server dist + removed stale resolve-keyword/list-modes dist; regenerated stdio-transcript (7 new names, 0 old) + SMOKE_TRANSCRIPT (4 new, 0 old). Zero-reference gate CLEAN (both rg exit 1). Full suite: mcp-server 295/294 (only OOM), engine 45 suites incl both classifier-parity loops. About to do the atomic cutover commit.
  - Task 8 ORDERING NOTE: built dist + regenerated transcripts BEFORE the zero-ref gate (plan builds after) so transcripts are genuinely generated from the new dist rather than hand-edited; dist is gate-excluded so coverage is unaffected. Atomicity is in the single commit, not build order.
- Task 9 DONE (no final artifact delta): rebuilt dist (byte-identical to committed), regenerated stdio-transcript (7 new/0 old) + SMOKE (0 old), re-ran zero-ref gate (clean), confirmed new dist tools present + stale absent, corpus union = all 7 outcomes present, dash/NUL scan = []. The Task-9 transcript regen produced only run-specific noise (ts/requestId/durationMs), so restored to the Task-8 committed versions -> no churn commit. Final: mcp-server tsc clean, npm test 295 (only OOM env test ever fails, flakes pass/fail), engine 45 suites incl both classifier-parity loops.

PROJECT COMPLETE. Commits main..lane-p4d: 01616cd (T1), 2c2f751 (T2), 8fb5518 (T3), 9f0ad55 (T4-8 atomic cutover). T9 = no artifact delta. All P4d-touched files under sidecoach/mcp-server + sidecoach/parity (0 out-of-scope). The many pre-existing dirty files (justify/, marketing-site/, tilt-lab/, other sidecoach/dist) are NOT ours and were never staged.

Task 4-7 DEVIATIONS (small, obviously-correct, noted for review):
- tools.test.ts null-lane test: plan's `/DOWNSTREAM_UNAVAILABLE/.test(String(e))` can never match (SidecoachToolError.code is not in String(e)); changed to `e instanceof SidecoachToolError && e.code === 'DOWNSTREAM_UNAVAILABLE'`. Same for the new list_lanes null test.
- timeout-and-concurrency.test.ts fakeRegs: added a minimal non-null `lanes` bundle so the (now list_lanes) liveness probe returns non-error.
- lane.ts: plan's SidecoachToolError extra `{ issues: [...strings] }` is not a ToolError field; changed to `validationIssues: [...{path,message,code}]` (the documented INVALID_INPUT field).
- smoke.sh lane call used id:7 (plan's id:5 collided with an existing get_flow_metadata call).

DECISION/CONTRADICTION (Task 2 Step 5): The plan's computed-eligibility loop asserts classification with computed eligibility reproduces every declared outcome. It does for 22/23 rows. One pre-existing OUT_OF_SCOPE row breaks because: (a) my intentEligible port computes true for it (CONFIRMED faithful via independent Python oracle of the actual hook - matched action "make" + standalone "landing page"); (b) classifyIntent evaluates NUDGE_ELIGIBLE BEFORE the OUT_OF_SCOPE fallback (keyword-resolver.ts ~352-354), so a computed-eligible prompt can never yield OUT_OF_SCOPE. Plan author handled the ROUTE/CLASSIFY win cases (5 rows) but missed the OUT_OF_SCOPE tail case. 
Why I escalated not improvised: changing a pre-existing shared-corpus row's asserted outcome is a product-behavior call with cross-consumer reach (engine parity test, Python test_classifier_parity.py [out of scope] - both use DECLARED eligibility so both stay green under either fix). Recommended Option 1: set that row to expect=NUDGE_ELIGIBLE, eligible:true (matches real production hook behavior; OUT_OF_SCOPE coverage retained by the "butter the migration aside" row). Awaiting team-lead.

How: each task is TDD (failing test -> minimal impl -> green), committed at the plan's boundaries (Tasks 1-3 individual; Tasks 4-7 accumulate uncommitted; Task 8 atomic cutover commit after pre-dist zero-reference gate + dist regen; Task 9 dist refresh). Never `git add -A` - working tree has many unrelated dirty files; stage only explicit per-task paths.

Files touched (Task 1):
- mcp-server/src/registries.ts
- mcp-server/__tests__/unit/registries-lane.test.ts (new)
- mcp-server/__tests__/unit/tools.test.ts
- mcp-server/__tests__/fault-injection/{python-repl-faults,state-store-faults,ast-grep-faults,registry-missing,validator-throw}.test.ts
