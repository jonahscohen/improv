---
name: Independent lead Codex gate FAILED the "converged" Sidecoach plan (echo-chamber caught) - 6 gaps -> v7
description: The architect's 6-round Codex loop reached APPROVE. The lead's INDEPENDENT fresh-framing Codex pass returned NOT-APPROVED with 6 material gaps the loop converged past. Core flaw - the plan proves SUPERSET + FRESHNESS + INFLUENCE, not BETTER OUTCOMES. Validates the two-level Codex engagement. Sent back to fold into v7; loop continues.
type: project
relates_to: [feedback_sidecoach_mission_beat_oracle.md, session_2026-06-23_sidecoach-evolution-plan-draft.md, session_2026-06-23_sidecoach-plan-codex-log.md]
---

Collaborator: Jonah Cohen

## Why this matters
Per the mission's two-level Codex engagement, the lead runs an INDEPENDENT Codex gate after the architect's own loop. The architect's loop converged to APPROVE over 6 rounds - but a fresh adversarial Codex pass (cold framing, deliberately to break the echo chamber of Codex approving a plan Codex co-shaped) returned NOT-APPROVED. The echo-chamber risk was real and the independent gate earned its place: it found 6 material gaps the loop missed. This is exactly the value of "you AND Codex, at two levels."

## The one unifying flaw
The plan proves Sidecoach has oracle's rules + more, is current, and the corpus INFLUENCES output - i.e. SUPERSET + FRESHNESS + INFLUENCE. It does NOT prove BETTER OUTCOMES. The mission bar ("better in every way") requires MEASURED comparative superiority, not superset logic. The plan's line 13 even claims "outcome superiority PROVEN by a head-to-head eval" but no such harness is specified - an overclaim.

## The 6 gaps (independent Codex, agreed by lead)
1. No real head-to-head OUTCOME eval (Sidecoach vs oracle on same briefs, judged blind, pass thresholds). Stage 0 only diffs old/new Sidecoach. THE deepest gap.
2. Detector "rule superset" = false-positive trap; plan verifies findings EXIST, not precision / FP-rate / non-regression on known-GOOD designs.
3. Taste canary proves INFLUENCE, not QUALITY/superiority vs oracle.
4. Weakest "beats oracle" claim = taste depth/currency (freshness != better taste).
5. Execution coupling reduced not eliminated - Stage 2/3/5 converge through scan --report exit codes + BuildReport semantics; a coupled rewrite with staged deletion. Need per-subsystem rollback points + compatibility contracts + deletion criteria.
6. MCP removal approved BEFORE the consumer audit (deferred to Stage 1); "OUT OF SCOPE" dev tooling dropped with no equivalence argument.

## Must-fix for v7 (sent to architect)
- Real head-to-head outcome eval as the SPINE of the proof + a stage.
- Detector PRECISION tests (negative/known-good corpus, FP budget, severity calibration, suppression/appeal); replace "superset beats" with measured recall+precision+blocking-accuracy.
- Comparative taste-quality check vs oracle (not influence).
- Explicit Stage 2/3/5 rollback points + compatibility contracts + deletion criteria.
- Do not approve MCP removal pre-audit; shim mandatory until proven unnecessary; equivalence argument for dropped tooling.

## Status
Task #9 reopened (NOT converged). Architect folds -> v7 -> re-runs its Codex loop -> reports -> lead independent gate re-runs. Loop continues until BOTH pass. No Sidecoach code touched.

## ROUND 2 (v9) - independent re-gate: NOT-APPROVED (eval methodology gameable)
Architect folded the 6 round-1 gaps into v9 with CONTRACT 6 (a blind, thresholded head-to-head outcome eval as the proof spine) + the honest 3-part simplicity claim + vendoring-for-Jonah + deletion discipline. Its self-loop re-converged to APPROVE; per the echo-chamber lesson it handed back for the lead gate. The lead's fresh Codex pass (focused on eval methodology) = NOT-APPROVED. The lead's own 4 attack vectors all landed; Codex confirmed + extended them and added a 6th. An eval is only as honest as its corpus + judge protocol - until then "beats oracle" is unprovable. The 6 v10 fixes:
1. CORPUS INDEPENDENCE: locked heldout separate from dev/regression; freeze labels before rules; rule-author != label-author; known-good = real clean designs incl. adversarial-borderline; tuning-after-heldout = disqualify/refresh. (Kills circularity on axes 1/2/4.)
2. AXIS-5 LEAKAGE: output normalization (same template/schema/context, strip tool phrasing+metadata+command traces, randomize A/B); judge rendered results separately from guidance prose.
3. JUDGE INDEPENDENCE: pre-registered judge, independent model family, >=2 model judges + human adjudication, calibration briefs (oracle-should-win / Sidecoach-should-win / tie).
4. STATISTICAL VALIDITY: paired per-brief comparison; CI / permutation-bootstrap lower-bound > 0 OR win-rate >= 70% non-tied, no severe losses; n > 10 unless large effect.
5. EVAL-AS-TRAINING-SET: committed corpora = regression tests; periodically-refreshed independent challenge set for the superiority CLAIM.
6. "BETTER IN EVERY WAY" operationalization (Jonah's call): parity on correctness/floor axes (can't beat correct contrast) + strictly-better on differentiators. Surfaced to Jonah via AskUserQuestion; v10 built on this honest framing pending his ruling.
Status: task back in the loop -> v10; architect re-runs its loop; lead gate re-runs. Both must pass the same version. No Sidecoach code touched.

## ROUND 3 (v11/v12) - independent re-gate: NOT-APPROVED, NARROWLY (converging)
Architect folded the 6 methodology gaps + Jonah's success-bar into v11/v12 (locked heldout, frozen labels, author!=labeler, leakage control, mandatory independent judge family, paired bootstrap CI lower-bound>0 at pre-registered n>=20, eval-as-regression-vs-claim-on-refreshed-set). Lead's fresh Codex pass = NOT-APPROVED but narrowly: "defensible after" 3 protocol fixes. The objection trajectory (strategic -> methodological -> narrow protocol) = genuine convergence, not goalpost-moving; each round found something real. The 3:
1. CORPUS EXTERNAL SOURCING (the crux): freezing labels before OUR rule work does not prove independence from the VENDORED oracle base. Require externally-sourced real designs/briefs selected without reference to either tool's rules/outputs, provenance per case. "Frozen before rules" honest only for our extension rules.
2. POWER ANALYSIS locks N (n>=20 is a floor, not power); pre-register A5 scoring endpoint + aggregation (rendered vs prose weighting, model+human aggregation, subcriteria diagnostic-only to avoid multiple-comparisons).
3. CLOSE REFRESH OPTIONAL-STOPPING: fix the challenge-set cadence + replacement rule + seed before results so it can't be regenerated-until-pass.
PASSED at round 3: the statistical machine, the mission framing (matches Jonah's ruling, honest), no dropped-capability/complexity blocker. Status: fold the 3 -> next version; if clean + nothing new, lead expects to APPROVE and take to Jonah with the vendoring blessing. No Sidecoach code touched.

## ROUND 4 (v13) - independent re-gate: APPROVE = TRUE CONVERGENCE
v13 folded the 3 round-3 protocol fixes. Lead verified by reading v13 in full (all 3 present, precisely; nothing regressed) AND ran a fresh final Codex pass (calibrated to approve-if-sound, not manufacture): verdict APPROVE - all 3 line-cited as addressed (external corpus sourcing line 150, power-locked N + A5 scoring lines 166-167, refresh hatch closed line 151); "no genuinely material plan-level blocker remains; remaining risks are implementation discipline, not plan approval blockers."
CONVERGENCE CRITERION MET: both levels agree on the SAME version (v13) - architect self-loop round 13 APPROVE + lead independent gate round 4 APPROVE - AND Jonah's success bar (parity-on-floors + strictly-better-on-differentiators) is encoded and met. Phase 1 is DONE. The loop earned its keep: across 4 independent gates, gates 1 and 2 each FAILED a self-loop "converged" plan and gates 3-4 narrowed to protocol then approved - no rubber-stamp, no perpetual skepticism.
GATED NEXT: the VENDORING bet (build on vendored oracle Apache-2.0 base + extensions) needs Jonah's explicit blessing; then Phase 2 (staged 0-5 implementation loop, each stage Codex-gated). No Sidecoach code touched in Phase 1.

## FOUNDATION PIVOT + ROUND 5 (v15) - CONVERGENCE on reimplement-and-own; PHASE 2 authorized
At the v13 vendoring-blessing gate Jonah HELD and chose REIMPLEMENT-AND-OWN (oracle = oracle/reference, not vendored code; own the floor from public W3C/CSS specs; copy nothing). Architect turned v14/v15 (foundation swap: CONTRACT 4 owned engine-floor.mjs from public specs; A1-A4 validate OUR floor vs oracle-run-as-external-oracle on every sub-metric; named verbatim-copy guard = screen + human idea-vs-expression signoff; dropped Apache/vendor-sync; OUR taste corpus). Everything vendoring-independent kept verbatim.
Round-5 independent gate (fresh Codex, calibrated approve-if-sound) on v15: APPROVE-WITH-NOTES, NO material blockers. The re-foundation is defensible; the owned floor is counted; the verbatim guard is correctly shaped; the simplicity claim stays honest. Two NON-BLOCKING notes folding to v16: (1) make the comparator CI-split explicit (A1-A4 run oracle detect.mjs headless as a pinned dev-dep in CI; A5 = periodic agent-judged eval, not per-commit); (2) scrub stale vendoring-implying wording.
CONVERGENCE: both levels APPROVE the same version on Jonah's chosen foundation + his success bar. Phase 1 (plan) DONE. The independent gate's full arc: vendoring-v13 (gates 1-4: fail/fail/narrow/approve) -> Jonah pivots to reimplement-and-own -> v15 (round 5: approve-with-notes). No rubber-stamp at any step.
PHASE 2 AUTHORIZED (per Jonah's "then loop until it changes Sidecoach"): architect begins Stage 0 (NON-DESTRUCTIVE: harness + externally-sourced frozen eval corpus + detect.mjs comparator smoke test + power-locked N + baseline scorecard), then Stage 1; HARD CHECKPOINT before Stage 2's first DESTRUCTIVE deletion (lead takes to Jonah; rollback-tag/flag/compatibility-fixtures confirmed first). Each stage produce-and-verify + Codex (item 8) + independent lead gate. Deletion discipline (rollback tag + SIDECOACH_LEGACY flag + compatibility-fixture-as-contract) makes every destructive step reversible.

## Files
- .claude/memory/session_2026-06-23_sidecoach-plan-independent-gate.md (this)
