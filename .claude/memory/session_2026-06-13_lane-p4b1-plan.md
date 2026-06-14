---
name: Lane P4b-1 plan drafted (validator gating + async execution durability)
description: No-placeholder TDD plan - sequence-lane product-validator gating run as async EXECUTE inside the operation-lease durability protocol (folds P3)
type: project
relates_to: [session_2026-06-13_lane-p3-plan-v2.md, session_2026-06-13_p4-decomposition.md, session_2026-06-13_p4a2-COMPLETE.md]
---

Collaborator: Jonah

Drafted `docs/superpowers/plans/2026-06-13-lane-p4b1-validator-execution-durability.md` (v1, 1180 lines, ASCII-only, 0 unicode dashes / 0 NUL). Not executed, not committed (planner-only).

## What P4b-1 builds (scope)
SEQUENCE-lane validator gating + the full async durability that gives the P3 lease machinery a purpose:
- (A) Gating: at a sequence step's completion, run product validators BOUND to that step's flow(s) via FLOW_CAPABILITIES, aggregate worst-status, map clean->proceed / findings->validation_failed / inconclusive->validation_inconclusive / error->validation_error (step stays current on any non-clean; only skip/stop bypass, recorded with reason).
- (B) Durability (folds P3): CLAIM (O_EXCL lock + expectedRevision + lease + fencing + revision bump) -> async EXECUTE the validators under an AbortSignal derived from the lease, heartbeat-refreshed, side effects buffered -> FINALIZE (full-identity owner check, write step result + outbox record keyed by (checkpointId, committedRevision) carrying fencingToken, clear lease) -> PUBLISH idempotently via a fencing-conditional sink. Guarantee = AT-MOST-ONE COMMITTED transition.

## 11 TDD tasks (failing-first)
1 schema v2 (fencingCounter/lease/typed sideEffectOutbox) + v1->v2 migration; 2 O_EXCL lock (verbatim P3); 3 claimLease/finalizeLease/refreshHeartbeat + concurrent-start lock; 4 validators async w/ cooperative abort; 5 step validator discovery + worst-status (pure); 6 advanceLane(complete/skip) async CLAIM/EXECUTE/FINALIZE + barrier-seam concurrency; 7 outbox record + LaneSideEffectSink + idempotent publish; 8 composed AbortSignal + heartbeat; 9 interrupt/stop fence live lease + abort controller; 10 engine laneDeps wiring + crash/timeout-retry recovery; 11 final integration (27 baseline -> 33 suites).

## Resolved spec ambiguities (reported to team-lead)
1. Multi-flow step gating = de-duplicated UNION of getFlowCapability(flowId).productValidatorIds across step.flowIds (validatorsForStep). lane_build "craft" (flowI/flowM advisory + flowJ) gates on polish-standard alone.
2. Cross-validator worst-status total order (spec leaves it implicit): error > findings > inconclusive > clean. Rationale: an unevaluable gate is loudest; confirmed defect outranks unverified gap.
3. Outbox vs flow-history: KEY FINDING - the lane path writes NO flow-history today (FlowHistory singleton is non-lane process() only). So the outbox does NOT wrap an existing writer; P4b-1 introduces a DEDICATED LaneSideEffectSink (fencing-conditional upsert) as the publisher and leaves the global FlowHistory untouched (avoids regressing the non-lane engine). Future phase can add FlowHistory as a 2nd publisher of the same committed record.

## Why / How
Why fold P3 into P4b-1: P3's lease/outbox/heartbeat/AbortSignal is untestable when EXECUTE is synchronous (protects nothing); the async validators are the long EXECUTE body + the real side effect to protect. How: reuse P3's Codex-reviewed lock/lease/fencing/schema-v2 verbatim, change finalizeLease to bump revision BEFORE mutate so committedRevision is available for the outbox key, add refreshHeartbeat + an in-process AbortController registry (LIVE_OPERATIONS keyed by checkpointId) so a same-process interrupt aborts the in-flight EXECUTE while cross-process ops observe ownership loss on heartbeat.

## Files touched
docs/superpowers/plans/2026-06-13-lane-p4b1-validator-execution-durability.md (created)
