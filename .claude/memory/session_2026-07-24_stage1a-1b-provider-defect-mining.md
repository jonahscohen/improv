---
name: Stage 1a/1b provider defect-mining + two open probes (eval-side)
description: provider-sample.mjs + defect-distribution.mjs + prose-ablation-power (Probe 1) + concept-sameness (Probe 2), all eval-side, single-source scanner
type: project
relates_to: [session_2026-07-24_autonomous-wave1-dispatched.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Built the TOP-RANKED untouched stage of the sidecoach upgrade plan (2026-07-23), Stage 1a + 1b, plus the two
open measurement questions the lead flagged and never answered. All work is eval-side NEW files only (three
other teammates share this tree; did not touch src/, bin/, package.json, scripts/, claude/).

## What was built
- `eval/provider-sample.mjs` (Stage 1a) - generate N UI pages per target model from the FIXED NEUTRAL HELD-OUT
  briefs. Provider adapters behind ONE interface: Claude (`@anthropic-ai/sdk`, `claude-opus-4-8`), gpt
  (`gpt-5.4`, OpenAI REST via global fetch), Gemini (Google Generative Language REST). Each adapter key-gated;
  a missing key exits 2 and writes NOTHING. Output = HTML files + manifest (provider, brief-id, model-id,
  capture-utc, content SHA-256). `--dry-run` proves the pipeline with a MOCKED generator (no key, no network,
  zero cost), stamped mode:"dry-run" + synthetic:true so it can never be mistaken for a measurement.
- `eval/defect-distribution.mjs` (Stage 1b) - per-provider, per-rule fire-rate distribution
  `{provider:{rule:{fired,total,rate}}}`. SINGLE-SOURCE: imports `scanRenderedLive` UNMODIFIED from
  `dist/validators/rendered-live-scan.js` (the exact function audit-rendered.ts ships) and the rule universe
  from the exported OBJECTIVE_RULES + SUBJECTIVE_RULES arrays (9 rules incl. marketing-buzzword +
  default-typeface). Fail-closed: a page where NEITHER lens renders is inconclusive, EXCLUDED from denominators,
  reported separately; a per-rule denominator counts only pages whose OWN lens ran. Schema self-check gate.
- `eval/fixtures/provider-sample-alldefect/` - 2 hand-authored self-contained pages that each plant
  justified-text (WCAG 1.4.8) + skipped-heading + tiny-text, so the planted classes report rate ~1.0 (verify 3).
- `eval/prose-ablation-power.mjs` (PROBE 1) - the power question blocking Stage 1d. Two-proportion normal-approx
  sizing (power-analysis.mjs precedent). Answer with the NUMBER + method below.
- `eval/concept-sameness.mjs` (PROBE 2) - our own concept sameness. Renders repeated generations, reduces each
  to a coarse aesthetic signature (dominant typeface + quantized bg/fg + heading/section bands), reports
  pairwiseSameness = P(two repeats share a concept). No key, no network.

## Design decisions (Why)
- Single-source: 1b runs `scanRenderedLive`, not a reimplementation. This is the buzzword-calibrate integrity
  rule; it keeps the eval measuring exactly what the audit ships.
- Gemini has NO default model id on purpose: the repo carries no authoritative current-Gemini id and a guessed
  or stale id would silently break the no-legacy-models team rule. The adapter REQUIRES SIDECOACH_GEMINI_MODEL
  (or --model) and exits 3 otherwise. Refusing to guess is the fail-closed behavior.
- --dry-run is deliberately key-independent (its whole purpose is a zero-cost pipeline proof on a keyless box).

## Probe results (this environment has NO provider keys)
- PROBE 1 NUMBER (method: two-proportion normal-approx power, conservative worst-side variance, alpha=0.05,
  80% power, 20-brief pool, $0.20/page, $200/line budget): at a 0.30 baseline the smallest ablation effect
  detectable within budget is 10pp (N=354/condition, 18 reps/brief, $142/line; ~$1699 for a 12-line pass). A
  subtle 2pp effect needs N=8391/condition = $3356/line = ~$40k across 12 lines -> INFEASIBLE at any affordable
  N. VERDICT: Stage 1d is feasible ONLY for coarse (>=10-15pp) priming effects; fine tuning is not
  distinguishable from generation noise. Gate 1d on coarse effects or treat fine ablation as infeasible.
- PROBE 2 NUMBER: real-model sameness CANNOT be answered here (no provider key). Method proven on the dry-run
  mock set (pairwiseSameness 2% - explicitly a PIPELINE PROOF, not a model signal). The real number needs a
  live `provider-sample --brief X --repeats N` then `concept-sameness --in <dir>`; the headline is
  pairwiseSameness = P(two repeats share a concept), with >= 0.5 meaning Stage 2c earns its effort.

## Cross-model review (Codex 0.142.5 via the deterministic codex-review.py wrapper, exit 0, 170s)
6 findings; folded 5 + the NOTE, pushed back on 1:
- FOLDED (BLOCKER) defect-distribution: an all-inconclusive sample (pages exist, none rendered) exited 0 with a
  success summary -> now exits 3 "scan did not run", writes the artifact as evidence, no success line.
- FOLDED (MAJOR) prose-ablation-power: nPerArm computed p2=p1-d always, clamping a 20pp move from a 0.10
  baseline to 0.001 and UNDERSTATING N (biasing toward "feasible") -> now sizes the conservative worst-side
  variance (p2 closest to 0.5). N(0.10,20pp,80%) went 18 -> 59.
- FOLDED (MAJOR) concept-sameness: multi-brief samples mixed should-differ pages into the pairwise count
  (biasing toward "diverges") -> refuses >1 brief by default (exit 1), --allow-cross-brief to override.
- FOLDED (MAJOR) prose-ablation-power: numeric args unvalidated -> --pool/--usd-per-page/--budget/--lines now
  reject NaN/non-positive/non-integer with exit 1.
- FOLDED (MAJOR, proportionately) provider-sample: self-containment unenforced -> record selfContained +
  selfContainmentIssues per page in the manifest + stderr warning, NOT a hard reject (the scanner is hermetic,
  so an external ref cannot invalidate measurement; discarding would lose a valid page).
- FOLDED (NOTE) defect-distribution validate was too weak (total <= pagesConclusive) -> tightened to
  total === pages where the rule's OWN lens ran (lensOf added to the artifact).
- PUSHED BACK (BLOCKER "stale model IDs"): Codex web-searched claude-opus-5 / gemini-3.6-flash. Kept
  claude-opus-4-8 (the exact ID the bundled claude-api skill mandates: "ALWAYS use claude-opus-4-8") and
  gpt-5.4 (the explicit value in the user's CLAUDE.md team rule). Those in-environment sources are the
  authoritative catalog; adopting an ID not in the catalog would violate "use exact model IDs listed". --model
  stays an intentional operator escape hatch (no brittle allowlist). Gemini already refuses to guess (exit 3).

## Verification (all real, this session)
- check1: provider-sample --provider claude --n 3 --dry-run -> 3 html + manifest, exit 0, pages==filecount (3).
- check2: same, no key, live -> exit 2 "no key", wrote NOTHING (dir not created).
- check3: defect-distribution on the all-defect fixture -> 9 rules present, all rates in [0,1], planted classes
  (justified-text/tiny-text/skipped-heading/default-typeface) rate 1.0; a missing-file page is inconclusive and
  excluded from the denominator (total 1, not 2).
- check4: npm test -> 76 suite(s) passed (baseline 75; the +1 is a concurrent teammate's suite in run-tests.ts's
  EXPLICIT list, commit 5ec15b1f - not mine; my eval .mjs are not in the runner's list). Green.
- check5: both probes emit a NUMBER + method (Probe 2 the mock number + an explicit "real needs a live key").

## Files touched (ALL mine, eval/ NEW + beats only)
- eval/provider-sample.mjs, eval/defect-distribution.mjs, eval/prose-ablation-power.mjs,
  eval/concept-sameness.mjs, eval/fixtures/provider-sample-alldefect/{manifest.json,2 html}.
- No src/bin/package.json/scripts/claude touched (three other teammates own concurrent edits there).
