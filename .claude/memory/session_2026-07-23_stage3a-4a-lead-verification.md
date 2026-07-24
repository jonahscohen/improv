---
name: Stage 3a + 4a lead verification (combined tree green, combined review pending)
description: Lead re-ran the merged 3a (detect CLI) + 4a (default-typeface class) tree - npm test 73 suites green, all 5 goldens verify, generate-validators --check clean at registry 59->60. Two teammate flags checked (suppress-fix-gate flag already self-cleared; Ground B inert-on-live-path is a follow-up). Combined cross-unit Codex review staged, not yet run. Neither unit committed.
type: project
relates_to: [decision_sidecoach_upgrade_first_units.md, session_2026-07-23_sidecoach-detect-cli-stage3a.md, session_2026-07-23_sidecoach-stage4a-default-typeface.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - npm test 73 suites passed on the merged tree; goldens 5/5 verify; build green. Combined-diff Codex review DONE (real Codex, exit 0, 131s) - NO seam findings, fail-closed composes, no false-clean path. 4a A5a taste gate still NOT RUN (no held-out label).
confidence: high
---

Collaborator: Jonah. 2026-07-23 (into 2026-07-24). Both first-units of the sidecoach upgrade plan (Stage 3a detect CLI via teammate `detect-cli`, Stage 4a default-typeface class via teammate `font-class`) reported done. This beat is the LEAD verification gate over the MERGED tree - not a re-trust of the two teammate reports.

## What I verified myself (not taken on faith)
- **`npm test` = 73 suite(s) passed** on the combined tree (71 baseline + `detect-cli` + `typeface-vocabulary`). npm test runs the build first, so `generate-validators --check` passed clean (registry 59 -> 60 rules, no drift) or the run would have died before tests.
- **All 5 migration goldens VERIFY OK** (scanner/reference/routing/convergence/buildreport). The scanner-snapshot goldens cover the LEGACY taste-validator/absolute-ban modules, not the rendered subjective scanner - which is the structural reason a new rendered class (default-typeface) produced ZERO golden drift. Confirmed, not assumed.
- **Change surface is clean and non-overlapping.** The one shared file, `scripts/run-tests.ts`, has both suite-registration lines on separate lines (no conflict). detect-cli owns bin/sidecoach-detect.js + audit-rendered.ts + absolute-ban-detector.ts + project-collector.ts; font-class owns subjective-rendered-scanner.ts + reference-data.ts + product-rule-registry.ts + validator-generation.ts + rendered-checks.ts. No file was edited by both except run-tests.ts.
- **`dist/` is TRACKED in this repo** (git ls-files dist/ non-empty) - a known pattern; the build regenerates committed output, so dist/ churn in the diff is expected, not a mistake.

## Two teammate flags, checked
1. **suppress-fix-gate flag: already gone.** font-class reported it `touch`ed `~/.claude/.suppress-fix-gate` once (the second-fix gate fired on the coherent multi-file wiring of one class) and warned it "persists". It is ABSENT now - the fix-gate consumes it one-shot, so no persistent suppression lingers. No cleanup needed; verified by `ls`.
2. **Ground B (brand-mismatch) is inert on the live path** - by design, not a defect. The default-typeface class ships Ground A (default/system-stack, >=75% char-weighted content) LIVE + promoted + fail-closed. Ground B (a known committed family carrying <25% of content) is calibrated + unit-tested behind a seam but NOT wired live: activating it needs a committed-family field that does not exist in `project-context.ts`, plus edits to `run-validator.ts` and `audit-rendered.ts`. This is a FOLLOW-UP integration, flagged for scheduling.

## Frozen thresholds (font-class, recorded for future drift checks)
- `DEFAULT_STACK_SHARE = 0.75`. Frozen on PRINCIPLE; the dev-corpus sweep does NOT empirically discriminate 0.75 (the real-vs-unchosen distribution is bimodal: real pages 0.00-0.06, unchosen 1.00, so every threshold 0.30-0.95 scores identically). The code comment states this honestly rather than implying data picked 0.75.
- `BRAND_PRESENCE_MIN = 0.25`. Sweep DOES discriminate: 0.05-0.40 give P/R 1.0, first real-page FP at 0.50. 0.25 sits a full step below the first failure.
- Single-source split `inPageTypeface` (score) + `typefaceFindingFromScore` (threshold), mirroring `inPageBuzzword`/`buzzwordFindingFromScore` so the calibration harness sweeps exactly what ships.

## A5a gate status: NOT RUN (honest, correct)
The comparator binary runs (the /tmp/oracle-v4 clone is present) but the Contract-6 A5a taste gate CANNOT be graded for default-typeface: A5a grades against lead-run Codex subjective labels and no label exists for this class (the 22-class rubric predates it). Creating that label is a LEAD job (author != labeler; font-class is registered as rule-author in `eval/corpus/rule-authors.json`, so the freeze gate rejects any font-class-authored label). Reported NOT RUN, not passed. Detection-level head-to-head on the fixtures: on 5 default-stack positives the rival catches 1 (via its different overused-font rule); on 6 negatives the rival false-fires on 4 - a genuine differentiated niche, but not a graded A5a result.

## Combined cross-unit Codex review: DONE - CLEAN
Ran via the DETERMINISTIC wrapper `~/.claude/hooks/codex-review.py` (diff on stdin, prompt positional, -C repo), NOT the codex-rescue agent - a hook correctly blocked the agent path because it can silently downgrade to a same-model self-review when codex is slow (session_2026-06-30_codex-rescue-silent-downgrade). Real Codex, exit 0, 131.4s. Verdict: **"No seam findings found. I do not see a false-clean path introduced by the interaction."** It traced both seams to lines: (1) the 60th rule `default-typeface` (registry `minor`) flows through both CLI paths as a `warning` (sidecoach-detect.js:264 maps minor-outside-polish-blocking to warning; audit-rendered.ts:117 reports subjective as warning) - no exit-code break; (2) fail-closed COMPOSES - inPageTypeface throw -> subjective family unavailable (rendered-live-scan.ts:113) -> partial-scan inconclusive (audit-rendered.ts:135) -> checkDefaultTypeface inconclusive (rendered-checks.ts:111) -> required-inconclusive stops clean (clean-evaluator.ts:193) -> CLI keeps unavailable attempted lens out of clean (sidecoach-detect.js:314). Nothing to fold. Each teammate had also self-reviewed its own unit (detect-cli: Codex 0.142.5, 5 findings folded; font-class: gpt-5.4, 2 rounds, 7 findings folded).

## Still pending (follow-ups; 3a is fully done, 4a is built+reviewed but not plan-"shipped")
- **A5a label authoring** for default-typeface (lead) before the class can claim a graded taste result.
- **Ground B live wiring** (follow-up).
- Neither unit committed - staged for the combined review outcome.

## Files touched (by the two teammates; lead changed no product code)
- NEW: bin/sidecoach-detect.js, src/__tests__/{detect-cli,typeface-vocabulary}.test.ts, eval/typeface-calibrate.mjs, eval/fixtures/{default-typeface,known-good}/*.html
- MODIFIED: src/validators/{subjective-rendered-scanner,rendered-live-scan,project-collector}.ts, src/validators/checks/rendered-checks.ts, src/{audit-rendered,absolute-ban-detector,reference-data,product-rule-registry,validator-generation}.ts, src/__tests__/{subjective-rendered-calibration,product-rule-registry}.test.ts, eval/corpus/rule-authors.json, scripts/run-tests.ts
