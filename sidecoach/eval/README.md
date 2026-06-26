# Sidecoach Contract-6 Eval Harness (Phase 2, Stage 0)

The ungameable head-to-head OUTCOME eval that carries the "better than oracle" proof.
Foundation: REIMPLEMENT-AND-OWN (Jonah's ruling) - Sidecoach OWNS its detector + taste;
oracle is the studied ORACLE / quality-bar, NEVER vendored code. We ship none of
oracle's code; it is installed only here, in the eval/dev environment, as a pinned
comparator. Full spec: `.claude/memory/session_2026-06-23_sidecoach-evolution-plan-draft.md`
(CONTRACT 6) and the Codex+gate log `..._sidecoach-plan-codex-log.md`.

## Axes (the gate)

PARITY / NON-REGRESSION (correctness floor - we MATCH the oracle, never "beat correct"):
- A1 RECALL on planted defects: ours >= oracle AND >= 0.90.
- A2 PRECISION / FP on known-good: precision >= oracle AND >= 0.85; FP <= oracle AND <= 0.10/page.
- A3 CONTRAST/OKLCH floor: |ours - oracle WCAG ratio| <= 0.01.
- A4 BLOCKING accuracy: decision acc >= oracle AND >= 0.95; misblock <= oracle AND <= 2.5%; severity-mismatch <= oracle AND <= 5%.
- Detector "win" = NON-REGRESSION on A1-A4 + EXTENSION (idiom/drift classes oracle has zero coverage of).

STRICTLY-BETTER differentiator:
- A5 TASTE: has TWO components, BOTH compared vs oracle (see grading spec below) - A5a taste DETECTION (vs Codex subjective labels) and A5b GENERATIVE head-to-head. Moving a class to subjective does NOT drop its head-to-head; it moves the comparison from A1-A4 to A5a.

## Objective / Subjective boundary + grading spec (lead ruling 2026-06-23)
THE TEST (spec-crispness): a class is OBJECTIVE only if its threshold is a SPEC CONSTANT two faithful
implementations must agree on (WCAG 4.5:1 contrast; `text-align: justify` present y/n; heading-level
jump y/n). A taste-calibrated number (1.3 leading, "extreme" tracking, <12px) is SUBJECTIVE - even
"overlap" needs a chosen cutoff, so it is not a spec constant. Rationale: A2 precision needs genuinely
clean pages, which only exist if taste classes are out of the objective set; and this maps onto the
mission - a11y-crisp = parity floor (A1-A4), taste = differentiator (A5) = Jonah's success bar.

KNOWN-GOOD inclusion (Jonah ruling B, 2026-06-23): a corpus page is "known-good" (the A2 precision bucket)
iff it has 0 objective defects in PRIMARY content (main/article/role=main); PERIPHERAL chrome defects
(nav/footer/aside/header/contentinfo/banner/navigation/complementary) do NOT disqualify. No deterministic
primary region -> EXCLUDE-WITH-FLAG. CRITICAL: ground truth stays FULL-PAGE for BOTH A1 and A2 - B refines
only the known-good bucket, not the FP ground truth. FP = (detector flags) MINUS (full-page objective
ground truth), corpus-wide; a real peripheral defect on a known-good page is a TRUE positive, never an FP.
A1 recall is measured on full-page ground truth (catch defects anywhere).

OBJECTIVE (architect spec-math ground truth, graded A1-A4 = PARITY floor):
- STATIC: broken-image (HTML img valid src), justified-text (WCAG 1.4.8 AAA, on body key-selector),
  skipped-heading (WCAG 1.3.1 level jump). [skipped-heading is the softest - revisit if it FP-noises.]
- RENDERED (rendered labeler): low-contrast, gray-on-color (WCAG 1.4.3 spec-constant ratios 4.5:1 / 3:1).

SUBJECTIVE (Codex-labeled ground truth, graded A5 = STRICTLY-BETTER differentiator):
- tiny-text, wide-tracking, all-caps-body, layout-transition, bounce-easing, tight-leading,
  extreme-negative-tracking + the taste-idiom classes (cream-palette, gradient-text, ... 22 total).
- INDEPENDENCE: labeled ONLY by the held lead-run Codex pass (labeledBy=codex). The architect is
  registered as rule-author for ALL of these in `corpus/rule-authors.json`, so the freeze gate REJECTS
  any architect-authored subjective label. The lead's Codex labeling pass spans this full set.

HOW A5 CONSUMES THE SUBJECTIVE CODEX LABELS (so "moved to subjective" != "no longer compared"):
- A5a TASTE-DETECTION head-to-head (per-commit-capable, like A1-A4 but vs Codex labels): run BOTH
  detectors (ours + oracle) over the corpus; grade each tool's findings against the SAME Codex
  subjective ground-truth labels, per class + aggregate (precision/recall/F1). This is where Sidecoach's
  deeper taste rules must out-detect oracle. Bar by the converged sub-distinction:
    * DETERMINISTIC differentiators (a class with a crisp pass/fail detector test, e.g. a specific idiom
      token) -> STRICTLY-BETTER by PASS/FAIL test (we catch it, the gap is demonstrable).
    * GRADED taste (fuzzy detection agreement) -> STRICTLY-BETTER by STATISTICAL SIGNIFICANCE
      (paired bootstrap CI lower bound > 0 at the power-locked N).
- A5b GENERATIVE head-to-head (periodic/release): each tool's design OUTPUT on the neutral briefs,
  blind + paired + normalized, independent Codex judges mandatory + human adjudication; paired bootstrap
  CI lower bound > 0 at the power-locked N; zero severe losses (>=3 pts below on the 0-20 composite).
  A5b does NOT consume corpus labels (fresh generation); A5a does.
- Both A5a and A5b must clear for the strictly-better claim. A5a uses the Codex subjective labels as the
  shared ground truth both tools are graded against; the architect's rule-author registration keeps that
  ground truth independent of the rules the architect writes.

## Comparator CI-split (v16 note 1)
- A1-A4 AND A5a (detection) are PER-COMMIT CI-runnable via `oracle-comparator.mjs` (invokes oracle detect.mjs headless) - A1-A4 vs spec-math labels, A5a vs Codex subjective labels.
- A5b (generative) is a PERIODIC / RELEASE eval workflow (agent-produced builds + model/human judging), not a per-PR gate.

## Corpus structure (Stage 0 builds; labels FROZEN before rule work; author != labeler)
- `corpus/dev/` - DEV/REGRESSION (committed; used during implementation + as permanent non-regression tests). NOT evidence of superiority.
- `corpus/heldout/` - LOCKED HELDOUT: EXTERNALLY SOURCED real shipped designs/briefs chosen without reference to either tool's rules/outputs/examples, PROVENANCE per case; labels frozen; never tuned against.
- `corpus/challenge/` - REFRESHED CHALLENGE: periodically regenerated under a FIXED cadence + replacement rule + RNG seed (no regenerate-until-pass); carries the live superiority CLAIM.
- `corpus/known-good/` - REAL shipped designer-clean designs incl. adversarial-borderline LEGITIMATE uses of flagged patterns (not handcrafted negatives) for A2 FP measurement.
Independence note: "frozen before rules + author != labeler" gives independence from OUR rules only; independence from BOTH oracle-as-oracle AND our implementation comes from EXTERNAL real-world sourcing.

## Sourcing guardrails (Jonah-ruled + lead-tightened; all narrow the default)
1. EXCLUDE the oracle: no oracle pages/demos/docs/outputs, and no page knowingly designed against oracle's or our rules. The oracle must NEVER be in the test set (independence-critical). TOOL-ENFORCED: `corpus-candidate capture` refuses oracle-host URLs (`isExcludedSource`); rule-designed pages are caught at the joint independence review.
2. PUBLIC pages only, NO PII / real user data. Prefer public marketing/landing/editorial/docs/template-gallery/product. For dashboard/app-ui use public product demos / template showcases / OSS app demos - NOT real authed dashboards; captured HTML must carry no embedded personal data.
3. Respect robots.txt + ToS; no circumvention of any access control (reinforces no-auth/no-paywall).
4. DIVERSITY: spread across registers AND quality (intentionally-strong -> intentionally-weak) AND era/trend, so the corpus is NOT biased toward what our rules already detect (source AGAINST us, not for us). Recorded as `diversity.{quality,era}` per case; audited at the review. This is NOT a defect label.
5. PROVENANCE per case: source URL + capture-UTC + register + license/ToS note (`provenance.license`).

## Corpus counts
- Detector cases (A1-A4): >=40 real defect-bearing (heldout) + >=40 known-good.
- Briefs (A5): governed by the PRE-REGISTERED POWER ANALYSIS (n>=20 floor; target >=20-30 so the power-locked N is met with margin), spanning the registers AND the 3 CALIBRATION TYPES (oracle-should-win / Sidecoach-should-win / genuine-tie). Brief count must not become the binding constraint on the headline superiority claim.

## Files (Stage 0)
- `oracle-comparator.mjs` - invokes oracle detect.mjs headless (pinned dev/eval dep), normalizes findings to `{rule, severity, file, line, snippet, contrast}` (contrast `{ratio,threshold}` for A3). FAIL-CLOSED: missing target / oracle stderr / non-2 nonzero exit / bad JSON all return `available:false` (never a false "clean"). DONE + smoke-green.
- `smoke-test.mjs` - asserts the oracle runs + emits a normalizable known-defect finding AND that a missing target fails closed. GREEN. Run: `node eval/smoke-test.mjs`.
- `corpus-tool.mjs` + `corpus-tool.test.mjs` - corpus integrity (add/freeze/verify). Locks a CANONICAL CASE RECORD per claim-bearing case (id, split, labels, file path, file-content SHA-256, provenance); verify enforces bijection + record-integrity + mandatory normalized author!=labeler + provenance. `lock.json` (all claim-bearing splits + challenge cadence/seed). 11 checks, all pass.
- `fixtures/known-defect/gradient-text.html` - SEED dev fixture (smoke only; not the heldout).
- (next) `migration-harness/` - golden-fixture capture of CURRENT outputs (scanner, BuildReport, reference bundle, routing, convergence) for old/new equivalence diffing. TEMP, sunset at Stage 5.
- (next) `power-analysis.mjs` - pre-registered power analysis to LOCK N from pilot/calibration variance.
- (next) `scorecard.mjs` - baseline + per-run scorecard writer (committed artifacts).

## Hardening (Codex Stage-0 review folded)
The integrity tooling was independently reviewed (Codex) and hardened against 3 BLOCKERs + 4 MAJORs: fail-closed oracle errors; freeze locks the whole CASE (file content + split + provenance), not just labels; bijection (no stale/deleted/moved locked cases); ALL claim-bearing splits locked (heldout/known-good/challenge), not heldout only; collision-safe canonical hashing (JSON, not delimiter-joined); mandatory normalized multi-author author!=labeler; A3-capable normalized findings (contrast ratio/threshold retained).

## Verbatim-copy guard
A named gate over `engine-floor.mjs`, `rules-extension.mjs`, scanner docs/messages, SKILL text, and the taste corpus: exact-line + n-gram/fuzzy prose similarity vs studied oracle source AND prose, plus human signoff that shared concepts are issue CLASSES (ideas), not copied expression. Gates Stage 1 (corpus/docs) and Stage 2 (scanner).

## Stage 0 status (NON-DESTRUCTIVE; nothing deleted)
- [x] Oracle comparator + smoke test (this commit) - GREEN.
- [ ] Externally-source + freeze the heldout/challenge/known-good corpora (real designs, provenance).
- [ ] Migration harness: golden fixtures of current outputs.
- [ ] Power analysis -> lock N; register judge protocol + calibration briefs.
- [ ] Baseline scorecard (Sidecoach pieces vs oracle).
HARD CHECKPOINT: PAUSE before Stage 2's first destructive deletion.
