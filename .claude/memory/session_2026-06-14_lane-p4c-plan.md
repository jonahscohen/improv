---
name: Lane P4c plan drafted (loop execution + convergence release floor)
description: no-placeholder TDD plan - lane_converge loop runs; iteration-boundary gate; persisted truthful convergence; ralph->convergence rename
type: project
relates_to: [session_2026-06-14_p4-resequence-convergence-first.md, session_2026-06-14_p4b1-COMPLETE.md, feedback_multiagent_verified_implementation_mandate.md]
---

# Lane P4c plan drafted - loop execution + convergence release floor

Collaborator: Jonah. Drafted as a team subagent (planner-p4c) under team-lead; plan only, NOT executed, NOT committed.

OUTPUT: docs/superpowers/plans/2026-06-14-lane-p4c-loops-convergence.md (1762 lines; verified 0 NUL, 0 unicode dashes, fully ASCII; title ends " - v1"). writing-plans format: header + File Structure + Setup (branch lane-p4c-loops-convergence, baseline 33 suites green) + 10 bite-sized TDD tasks (real failing test -> real impl -> exact commands/expected output -> path-specific git add commit) + Deferred + Self-Review.

## What P4c builds (scope)
1. LOOP EXECUTION for lane_converge (was REJECTED at startLane since P2/P4b-1). Walk verb steps once per iteration; at the iteration boundary (after the last verb step) invoke the lane policy's requiredProductValidatorIds EXACTLY ONCE; all clean -> lane CLOSES converged; else persist the required-state signature, increment iteration, reset cursor, return findings + next iteration coaching.
2. CONVERGENCE FLOOR + truthful persisted convergence (the floor is the LaneValidationPolicy, not a verbChain side effect; never claim converged without required-clean; closing summary GENERATED from run coverage).
3. ralph-loop.ts -> convergence-loop.ts rename + t20 rename AND expectation fix (a flow error can no longer "converge").

## 10 tasks
1 convergence types + checkpoint/result fields; 2 getLanePolicy + isLoopLane + requiredValidatorsForLane; 3 pure lane-convergence.ts (signature/evaluateBoundary/decideProgress/seed); 4 enable startLane loop + minimal preflight + seed; 5 loop non-final advisory advance; 6 boundary converge; 7 boundary continue/stall/cap + skip-cannot-bypass; 8 coverage-plan preflight + orchestrator wiring; 9 e2e real CSS+HTML fixture -> converged; 10 ralph->convergence rename + semantic fix + t20. Final gate 43 required suites (33 + 10 new, each required:true).

## Key spec ambiguities resolved (Why/How)
- **No double-run (boundary vs P4b-1 per-step gate):** STRUCTURAL. Loop complete/skip never call validatorsForStep (advisory advance, no validators). The 4 required validators run only at the boundary via requiredValidatorsForLane() (the policy). polish-standard (flowJ binding) runs once per iteration, at the boundary. Matches spec line 958. validatorsForStep stays sequence-only.
- **Required-state signature:** sha256-16 over sorted per-validator tuple {validatorId, status, failedRuleIds(canonicalKeys), inconclusiveRuleIds, coverageGapIdentities(unsupportedSourceKinds+unverifiedScope), validatorErrorCategory, ruleErrorCategories}. Stable identities only; no free-text; no advisory. In checkpoint.convergence.signatures[]; drives consecutiveNoProgress -> stall. Spec 1155-1167.
- **lane_calm is SEQUENCE not loop** (lanes.generated.ts) -> unaffected; lane_converge is the only loop lane.
- **Schema stays v2:** convergence is an additive OPTIONAL checkpoint field; migrate() `...raw` spread passes it through (no bump). Regression-tested.
- **Preflight split:** cheap policy+registration check in laneRunner.startLane (engine unit tests stub runValidator and drive it directly); IO-heavy coverage-plan satisfiability preflight at the orchestrator layer (rejects permanently-inconclusive targets, spec 996-1011).
- **convergence.outcome 'error':** an errored iteration is recorded + stays resumable (running) until stall/cap; never converges. Hard error-termination = deferred.

## Reused (not reimplemented)
P4b-1 lease/lock/durability (claimLease/finalizeLease/heartbeat/LIVE_OPERATIONS/publishOutbox); P4a clean-evaluator + makeProductValidator + project-collector + GENERATED_VALIDATORS coverage plans; aggregateWorstStatus.

## Deferred (out of P4c)
browser collector P4b-2; MCP P4d; copy gating P4e; FlowHistory publisher P4f; target-scoped validator discovery; per-rule preflight granularity; sequence-lane start preflight for other refinement lanes; advisory-failure display-label qualification; dist/* rebuild.

## Open item flagged to team-lead
Task 9 e2e needs one combined CSS+HTML fixture clean on ALL FOUR real validators at once. Plan gives a starting fixture + actionable verify loop (test prints failing canonicalRuleKey:status) and instructs fixing only the fixture; an unprovable required rule = floor-coverage gap to escalate.

## Files touched
- docs/superpowers/plans/2026-06-14-lane-p4c-loops-convergence.md (created)
- .claude/memory/session_2026-06-14_lane-p4c-plan.md (this beat) + MEMORY.md index
