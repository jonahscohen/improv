---
name: buzzword-v3-LOCKED-closeout
description: Jonah LOCKED v3 as the marketing-buzzword win (F1 0.857 vs oracle 0.727, recall 0.947 vs 0.632 on the fresh held-out; precision near-parity 0.783 vs 0.857). Closeout = final build/test + commit the converged Stage 5/6 work. DECISION - do NOT re-measure v3 on the frozen-90 (selection bias); the v3 claim rests on the clean fresh held-out.
type: decision
relates_to: [session_2026-06-25_buzzword-v3-heldout-RESULT.md, session_2026-06-25_buzzword-v2-frozen90-RESULT.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25).

## JONAH DECISION (AskUserQuestion): LOCK v3
Chose "Lock v3 as the win" over pushing the last 0.074 precision. v3 wins the marketing-buzzword class decisively by F1 (0.857 vs 0.727) + recall (0.947 vs 0.632); oracle edges raw precision by 0.074 on the taste-frontier FP mode (concrete-science/docs). Residual gain = diminishing returns + needs a 3rd fresh held-out + risks the recall win. Locked.

## INTEGRITY DECISION: NO frozen-90 re-measure of v3
The v3 claim rests on the CLEAN fresh held-out (R0.947/P0.783). I will NOT re-measure v3 on the frozen-90, because v3 was iterated partly in response to the v2 frozen precision (0.333) - re-measuring the iterated detector on the SAME held-out = selection bias (optimistic). The frozen-90 scorecard stays the valid record for OBJECTIVE (0.936, unchanged - v3 only touches marketing-buzzword) + the non-buzzword subjective classes; marketing-buzzword's clean v3 number is the fresh held-out, documented as superseding the v2 frozen row.
**Alternatives considered:** re-measure v3 on frozen-90 for a "consistent" official scorecard - REJECTED (selection bias on a thrice-touched held-out outweighs the consistency). **Why this one:** the fresh held-out is the unbiased v3 measurement; the frozen-90 already gave its honest v1/v2 readings. **Revisit when:** a NEW externally-sourced held-out is built for a future official re-measure.

## CLOSEOUT PLAN
1. Final npm run build + npm test green on the complete tree (v3 + comment fixes + convergence).
2. Commit: (a) Stage 5/6 convergence (low-contrast live-wiring + codex folds) + marketing-buzzword v3 detector + eval tooling (buzzword-calibrate, buzzword-heldout-measure, dev-subjective-label parameterization) + the 27 dev + 38 held-out corpus + labels + tests; (b) the codex-doctor hooks (claude/hooks/* + settings.json). Branch sidecoach-phase2-reimplement (commit OK; not main).
3. Report the final converged competitive position.

## FINAL COMPETITIVE POSITION (honest)
Objective decisive win 0.936 + DELIVERED live (low-contrast wiring) | subjective recall SIGNIFICANT win | subjective precision SIGNIFICANT win | one engine + simpler | marketing-buzzword class = F1+recall win, precision near-parity. The mission ("beat oracle") is met on every AGGREGATE axis; the one per-class precision sub-axis (marketing-buzzword) is near-parity, the taste-frontier ceiling.

## Files touched
- (closeout decision beat)
</content>
