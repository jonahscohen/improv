---
name: Flow domain-validation coverage + ordering fix (live path)
description: Closed the coverage + memory-before-validation gaps Codex found during the flow-domain-integration deletion; orchestrator-only, additive memory field, 3 Codex findings folded, 1 declined as out-of-scope
type: project
relates_to: [session_2026-07-25_flow-domain-deleted-lead.md, decision_2026-07-25_flow-domain-integration-superseded.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + codex-review (2 foreground rounds)
confidence: high
---

Fixed the live flow domain-validation path in `sidecoach/src/sidecoach-orchestrator.ts`
(the gap Codex filed during the flow-domain-integration deletion, e75cf20f). NOT committed.
Collaborator: Jonah.

## The two gaps (both real, both closed)
- COVERAGE: `getValidatorsForFlow` -> `validateMultipleDomains` was attached in only 2 of the
  4 memory-persisting `handler.execute` branches. The command-match chain (`/sidecoach polish`
  etc.) and the special-cased flowA brand-verify PREFIX step ran with NO domain validation.
- ORDERING: `runCompositeLoop` (the composite path) called `recordFlowWithMemory(result)` BEFORE
  attaching domain validation, so a composite persisted memory WITHOUT its domain outcomes.

## Data-model finding that shaped the fix
Two DIFFERENT `validationResults` exist. `recordFlowWithMemory` persisted only
`result.memory.validationResults` (the `{check,result,details}` handler channel, read by
`session-memory-writer.ts` via `v.result==='fail'` and by build-report's memory reader). The
DOMAIN outcomes live on top-level `result.validationResults` (`{domain,status,passedRules,
failedRules}`) and were never persisted. So merging domain outcomes INTO `entry.validationResults`
would shape-corrupt the memory channel. Fix persists them under a NEW distinct key
`entry.domainValidationResults` - additive, invisible to existing consumers.

## Branch audit (every execute site)
- L270 runCompositeLoop (composite step): COVERED (L291) + ORDERING FIXED (record moved after validation; failOnError halt records-then-returns, once).
- L978 command-match chain: COVERED - was the gap; added getValidatorsForFlow (L997), APPEND not overwrite.
- L1315 flowA brand-verify prefix: COVERED - was the gap; added design_system validators, PERSISTENCE-ONLY (no user-facing warning).
- L1457 natural-language while-loop: already COVERED (L1486) + ordering already correct.
- L711 teach / L732 document: intentional skip (setup commands, not FlowId design flows, no mapping, no memory persist).
- L1685 laneDeps.runFlow: intentional skip (lane subsystem owns validation/attestation; out of ownership per the lanes carve-out).
- L1837 rendered-audit synthesized flowK result: intentional skip (Ground B audit region, out of ownership; synthesized result, not a handler.execute).

## Codex (2 foreground rounds, deterministic codex-review.py 0.142.5)
Round 1 (166.8s): HIGH - branch-2 `= validations` OVERWROTE handler-pushed results (flowJ
PolishStandard/ban) that the command-match path used to keep -> FOLDED to append. MEDIUM - flowA
appended a misleading soft-fail warning to the user-facing brand-verify message -> FOLDED to
persistence-only (attach+persist, no message append; Codex's own suggested path). LOW - new test
not in run-tests.ts (spec forbids editing it; reported the line). Codex confirmed no double-record
on the halt path and the additive field is safe.
Round 2 (103.5s): HIGH - append invariant "incomplete" because branches 1/3 still overwrite;
MEDIUM - branch-1 records before its post-push ClaudemdMandate. DECLINED both: proven pre-existing
via `git show HEAD` (overwrites at HEAD L282/298/1432, untouched by my diff). Changing them would
violate the spec's "a flow that WAS validated must still validate identically" (flowJ-via-composite
currently validates as [performance]; appending changes it) - a scope/design call that belongs to
the lead, not an executor improvisation. Folded the in-scope half: made the recordFlowWithMemory
comment precise (post-record validators are intentionally not mirrored).

## Verify (all from src/ via ts-node, unaffected by the concurrent dist rebuild)
- `npx tsc --noEmit` -> exit 0.
- New `src/__tests__/domain-validation-coverage.test.ts` 8/8: both-places proof (a composite step
  failing the performance domain has that failure in result.validationResults AND persisted
  memory.domainValidationResults, agreeing on failedRules) + passing-path persists + memory-channel
  isolation guard. NEGATIVE CONTROL: reverting only the ordering made it fail 4/8 (entryDomainVrs=[]).
- Coupled suites standalone all exit 0: t20-convergence-loop 43/43, lane-convergence OK,
  sprint1-integration PASS, orchestrator-slash-command PASS, phase-h-block5 10/10, sprint4-build-report-* (7 suites) PASS.
- phase-h-block7 unchanged at 16/20 (4 PRE-EXISTING validator-behavior failures - constructed
  results lack checklist/artifacts; exits 0; not in run-tests.ts).

## Left for Jonah (per spec constraints)
- run-tests.ts line to ADD (I was forbidden to edit it):
  `{ rel: 'src/__tests__/domain-validation-coverage.test.ts', required: true },`
- dist NOT rebuilt/committed by me. NOTE: a CONCURRENT teammate built the shared tree at 09:58
  (dist/* dirty) and edited src/validators/subjective-rendered-scanner.ts at 09:44 - NEITHER is
  mine; left untouched.
- FOLLOW-UP (lead decision): branches 1/3 (composite + natural-language) still OVERWRITE
  result.validationResults, dropping handler-pushed results (flowJ PolishStandard) before
  build-report. Pre-existing; making it uniform-append is a behavior change beyond this task's
  named gaps. Codex flagged it; declined here on scope grounds.

## Self-analysis (Codex round-1 HIGH was a regression I introduced)
Why: adding domain validation to branch 2, I copied the `result.validationResults = validations`
idiom from sibling branches 1/3 without checking that branch 2's PRIOR behavior was different -
branches 1/3 already overwrote (accepted, pre-existing), but branch 2 had no domain validation, so
flowJ's handler-pushed PolishStandard survived there. The overwrite idiom, transplanted, newly
dropped them. Failure mode: pattern-matching an existing idiom into a new context without verifying
what that context previously preserved. Lesson: when reusing an assignment idiom in a branch that
lacked the operation before, check the branch's prior invariant, not just the sibling's shape.

## Files touched
- src/sidecoach-orchestrator.ts (handler.execute / validation-attach / memory-persist regions only)
- src/__tests__/domain-validation-coverage.test.ts (new)
- flow-domain-validators.ts: NOT touched (no change needed - the map + validators were correct;
  the gaps were all orchestrator-side wiring).
