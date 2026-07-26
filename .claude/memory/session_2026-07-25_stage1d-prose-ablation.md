---
name: Stage 1d prose-ablation loop built + verified (harness), pilot pending
description: eval/prose-ablation.mjs - ablate skill-prose lines, rank by defect-rate delta, flag priming lines for human-reviewed deletion; dry-run + self-test green
type: project
relates_to: [session_2026-07-24_stage1a-1b-provider-defect-mining.md, session_2026-07-25_stage1-real-data-1c.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (dry-run + self-test + fail-closed matrix) + Codex review folded (1 BLOCKER/2 HIGH/3 MEDIUM/1 LOW); live pilot running
confidence: high
---

# Stage 1d - Skill-prose ablation loop

Built `sidecoach/eval/prose-ablation.mjs` (upgrade plan 2026-07-23, Stage 1d). Teammate task under the autonomous
wave; NOT committed, run-tests.ts + dist NOT touched (lead owns integration). Collaborator: Jonah.

## LEAD INTEGRATION (2026-07-25)
Re-verified independently: `--self-test` exit 0 ("seeded priming +50pp on nested-cards, protective -50pp on tiny-text (ordering holds)"), `--dry-run` exit 0 (full ranked table + deletion recs). Registered the self-test as a gated suite in scripts/run-tests.ts: `{ rel: 'eval/prose-ablation.mjs', runner: 'node', args: ['--self-test'], required: true }` (the run-tests SUITES type already supports node+args, same as the migration-harness goldens). Full gate re-run to confirm (expect 88 suites). A's 2 Codex passes (11 findings folded) + my re-verify satisfy the produce/verify gate - no 3rd redundant Codex pass. Pilot still running detached (24 calls, ~55 min); monitoring pilot-work/ myself so its ranked findings + deletion recs are not orphaned. Commit: harness + run-tests entry + this beat (no dist - it's an eval .mjs).

## What it does
For each candidate guidance line, generate the HELD-OUT briefs WITH the line injected into the generation prompt
and WITHOUT it (the Stage 1a mechanism), measure each condition's per-rule defect fire-rate through the SHIPPING
scanner (Stage 1b `measure()`), and rank lines by the target-rule defect DELTA (with - without). A positive delta
= the line PRIMES the defect it names -> flagged as a DELETION CANDIDATE. A negative delta = the line earns its
place. Deletion is RECOMMEND-only; the tool never edits prose.

## Key decisions (Why / How)
- **Candidate set = the Stage 1c counter-rule lines (verbatim from `src/counter-rules.generated.ts`).** Why:
  those are the ONE piece of prose sidecoach actually injects into a build per-provider, so ablating them is the
  sharpest self-improving-prose test - does "watch default-typeface ... counter it deliberately" REDUCE
  default-typeface or ironically PRIME it? 3 real named candidates (default-typeface, nested-cards, low-contrast)
  + 2 synthetic seeded probes (dry-run/self-test only, REFUSED live).
- **Shared oracle single-sourced via Stage 1b `measure()`.** Why: the buzzword-calibrate integrity rule - the
  eval must measure the exact scanner the audit ships. How: `import { measure } from './defect-distribution.mjs'`.
- **Adapters + prompt are a faithful MIRROR of Stage 1a, not an import.** Why: provider-sample.mjs does not
  export its adapters/prompt constants, and I must not edit committed Stage 1a. How: re-implemented
  generateClaude/gpt/gemini + PROMPT_SYSTEM/PROMPT_RULES locally with a provenance comment; only the pure helpers
  (`PROVIDERS`, `loadHeldoutBriefs`, `extractHtml`, `selfContainmentIssues`) are imported. FLAGGED to lead:
  exporting these from Stage 1a would collapse the two copies to one (single-source improvement, lead's call).
- **Shared baseline is the default; `--independent-baseline` for 2N/line.** Why: the WITHOUT condition is the
  un-injected prompt, identical for every candidate, so generating it once per brief and reusing it is a TIGHTER
  pairing (baseline draw held fixed) and ~halves cost - correct for a RANKING tool. Independent baseline matches
  the power-probe's 2N cost model when independent per-line deltas are wanted.
- **Injection-aware mock, GROUNDED not guessed.** Why: --dry-run must prove the whole pipeline at zero API cost,
  and the self-test must deterministically assert ordering. How: a scratchpad probe first confirmed a planted
  page fires all six controllable rules (default-typeface, nested-cards, tiny-text, low-contrast, gray-on-color,
  skipped-heading) and a clean page fires none, THROUGH the real scanner. The mock plants/suppresses the target
  rule by `dryDelta`; baseline plants a fixed ~50% reference set. Caught + fixed a cross-contamination: the
  scanner emits low-contrast AS WELL AS gray-on-color for gray-on-chromatic text, so gray-on-color was dropped
  from the shared baseline plant set (it masked the low-contrast candidate's delta); it stays renderable for a
  gray-on-color-targeted candidate.
- **Honesty about power (from Probe 1 / prose-ablation-power.mjs).** Why: only coarse effects (>=~15pp) are
  distinguishable from generation noise at an affordable N; a small pilot is a plumbing + coarse-signal proof.
  How: the report prints the run's approximate minimum-detectable-effect and labels sub-MDE deltas "within
  noise"; the deletion gate is coarse (|delta| >= DELETION_DELTA=0.15 AND above the run MDE) so a tiny pilot
  never over-claims a deletion on noise.

## Fail-closed exit matrix (mirrors provider-sample.mjs)
0 ok | 1 usage (bad arg / unknown provider / unknown candidate / synthetic-live) | 2 no key | 3 no model id |
4 generation failed/empty (never a partial ranking) | 5 measurement unusable (no conclusive page in a condition)
| 6 corpus. VERIFIED: no-key=2, bad-arg=1, synthetic-live=1, unknown-candidate=1.

## Verification so far (zero API cost)
- `--help` / `--list` exit 0; imports resolve.
- `--self-test` GREEN: seeded priming +50pp on nested-cards, protective -50pp on tiny-text, ordering holds,
  exit 0. This is the registered regression gate (renders ~12 mock pages through the real scanner).
- `--dry-run --n 6` GREEN: ranked table, seed-primes-nested-cards +50pp (top), counter-nested-cards -33pp,
  counter-low-contrast -33pp, counter-default-typeface -50pp, seed-protects-tiny-text -50pp; MDE ~81pp at N=6 so
  all correctly labeled "within noise (underpowered)". No false deletion recommendation.
- Fail-closed exits confirmed (above).

## Codex review (foreground, codex-cli 0.142.5) - ALL 8 findings folded + re-verified
Independent-model review over eval/prose-ablation.mjs. Verdict: "I found blocking issues" - all legitimate,
all about fail-closed integrity (the property that matters for a measurement tool). Folded:
- **BLOCKER** measureCondition only failed on pagesConclusive===0, so a PARTIAL scan reached the ranked table.
  Fix: require pagesTotal === pagesConclusive === expected (every page rendered conclusively) or throw exit 5.
- **HIGH** a null target rate produced targetDelta:null yet the report still said "no deletions" = false-clean.
  Fix: a candidate whose target rule is unmeasurable in either condition fails the whole run (exit 5).
- **HIGH** generation/measurement exceptions propagated as uncaught Node errors (exit 1), not the promised 4/5.
  Fix: typed errors ({generation}/{measure}) + a top-level mapper around the run -> die(4)/die(5).
- **MEDIUM** die() inside the work-dir bypassed withWorkDir's finally cleanup. Fix: throw, catch OUTSIDE (cleanup
  runs first), then die.
- **MEDIUM** aggregate delta averaged whatever rules were numeric per side, so nulls could compare different
  rule sets. Fix: pairedAggregateDelta over only rules numeric in BOTH conditions.
- **MEDIUM** candidates-file entries unvalidated + cand.id used as a path. Fix: validateRegistry - required
  string fields, safe-basename id regex, duplicate-id rejection, finite dryDelta.
- **MEDIUM** dry-run accepted an arbitrary --provider used as a filename. Fix: SAFE_ID regex on provider in
  dry-run too.
- **LOW** missing flag values swallowed the next flag / threw. Fix: next() rejects end-of-args or a --value.
- **NOTE** (no change): Codex confirmed the shared-baseline reuse is SOUND (baseline generated/measured once,
  same rate object reused; independent mode regenerates per candidate).
Also moved the target-rule-in-universe check to preflight (via loadScanner - no render, no key) so a bogus
target fails as exit 1 BEFORE any generation spend.

SECOND Codex pass (over the folded file) - verified the 8 fixes are correctly implemented, found + folded 3 MORE:
- **HIGH** measure() counts a page conclusive when EITHER lens rendered, and skips a rule's denominator on
  pages where that rule's lens failed - so a SUBJECTIVE rule (default-typeface/nested-cards/tiny-text) could
  carry a SHORT denominator (total < expected) with a still-numeric rate and slip past the null check. Fix:
  measureCondition now also requires BOTH lens-availability counts === expected, guaranteeing every rule's
  denominator is exactly `expected` (target delta AND aggregate over complete, matched denominators).
- **MEDIUM** `source` was documented + used in the report but not required by validateRegistry. Fix: added to
  required string fields.
- **LOW** self-test caught ALL errors as exit 5, masking an unexpected bug as a measurement failure. Fix: map
  typed generation/measure errors, RETHROW unknown ones (surface the stack).
Re-verified after BOTH folds: node --check OK; --self-test GREEN (the new both-lens gate does NOT false-trip the
mock - both lenses render on every mock page); --dry-run --n 6 ranked table unchanged; fail-closed matrix all
correct incl. new guards (missing-value=1, unsafe-provider=1, bad-target-in-file=1, unsafe-id=1, duplicate-id=1,
missing-source=1). TOTAL 11 Codex findings folded across 2 passes (1 BLOCKER + 3 HIGH + 5 MEDIUM + 2 LOW).

## LIVE PILOT (running, background pid at run time)
claude / claude-opus-4-8, 3 real counter-rule candidates x 6 held-out briefs, shared baseline = 24 calls.
Each claude call ~2min (adaptive thinking + high effort + 32k max_tokens; the 1c beat also noted "claude slow"),
so the run is ~45-50min in the background. Results + token spend + deletion recommendations appended on landing.

## Lead integration notes
- New harness: `sidecoach/eval/prose-ablation.mjs`.
- Suggested run-tests.ts SUITES line (lead adds; I must not edit it):
  `{ rel: 'eval/prose-ablation.mjs', runner: 'node', args: ['--self-test'], required: true },  // Stage 1d ablation: seeded priming/protective ordering through the real scanner`
- Samples are written to a temp dir under eval/.ablation-work and cleaned up unless `--out` is given (no repo
  pollution).

## Files touched
- sidecoach/eval/prose-ablation.mjs (NEW)
