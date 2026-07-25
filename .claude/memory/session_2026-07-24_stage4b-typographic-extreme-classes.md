---
name: Stage 4b - typographic-extreme taste classes (5 rendered subjective detectors)
description: Five rendered SUBJECTIVE classes (extreme-negative-tracking, tight-leading, all-caps-body, oversized-h1, sub-11px-ui) added to subjective-rendered-scanner.ts as a single-source scorer + Node thresholds, registered AUDIT-ONLY (like nested-cards). Dev-calibrated, A5a-pending per class.
type: project
relates_to: [session_2026-07-23_sidecoach-upgrade-plan.md, session_2026-07-24_stage4b-groundb-live-wiring.md, session_2026-07-24_autonomous-wave1-dispatched.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - typography-extremes.test.ts 33 asserted OK + registry no-orphan/behaviour-lock OK; full npm test 77 suites passed (pre-wiring run); calibration exit 0 (P=1.000 all 5 on 48 dev pages); detect audit surfaces oversized-h1 as warning + known-good clean (A2). Authoritative full re-run + Codex pending at this append.
confidence: high
---

Collaborator: Jonah. 2026-07-24. HEAD 3be6dd62 (plan stamped a22d41fc, drifted - 4a already landed; re-verified current state). Teammate "stage4b". Builds Stage 4b of docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md.

## The 5 classes (all rendered SUBJECTIVE, precision-first, single-source score+threshold split like buzzword/typeface)
- extreme-negative-tracking: letter-spacing/font-size (em-normalised) <= -0.05em on a substantial share of content text.
- tight-leading: line-height/font-size <= 1.10 on running BODY text (non-heading, <=28px, run>=40 chars); line-height:normal never counted.
- all-caps-body: long (>=40 char) body-scale (<=28px) runs rendered all-caps (text-transform:uppercase OR source caps via \p{Lu}/\p{Ll}).
- oversized-h1: largest visible h1 rendered px / viewport width >= 0.11.
- sub-11px-ui: ALL visible text (chrome INCLUDED) below 11px, >= 60 chars total.

## Design (matches 4a default-typeface exactly)
ONE in-page scorer `inPageTypographyExtremes()` walks the tree once, returns a rich `TypographyExtremesScore`; Node-side `typographyExtremesFindingsFromScore(s)` applies the frozen thresholds -> 0-5 findings. Calibration harness imports the SHIPPING scorer + thresholds from dist and sweeps exactly what ships (integrity rule). Self-contained in-page helpers (visuallyVisible / ownText / paintedInvisible / peripheral) verbatim-copied from inPageTypeface. sub-11px-ui is the one class that does NOT exclude peripheral chrome (11px floor is universal; measured before the peripheral guard). oversized-h1 uses a separate pass (max font-size over h1 + text-bearing descendants) so `<h1><span>` is measured.

## FINAL frozen thresholds + rationale (on PRINCIPLE + dev signal, never held-out - confirmed by calibration exit 0)
- extreme-negative-tracking: per-elem TRACKING_EXTREME_EM=-0.05 (below tasteful -0.02/-0.03em display tracking, into crowding); page TRACKING_SHARE_MIN=0.15. Dev max share 0.004 (resend) = 37x headroom; P=1.000 R=1.000.
- tight-leading: per-elem LEADING_TIGHT_RATIO=1.10 (below browser-default `normal` ~1.2, which is SKIPPED as the keyword; lines crowd), LEADING_MIN_RUN_CHARS=40, LEADING_MAX_BODY_PX=28, headings excluded; page LEADING_SHARE_MIN=0.10 (LOWERED from 0.15: numerator is running-text subset, so the tiny-text-0.15 equivalent is lower; gains dev recall at ZERO precision cost). Dev P=1.000 R=0.176 (caught arstechnica/nasa/polygon; 14 Codex-positives MISSED = precision-first cost - they set leading 1.2-1.4 or use `normal`, not the <1.10 crowding bar).
- all-caps-body: per-elem ALLCAPS_MIN_RUN_CHARS=40 / ALLCAPS_MAX_BODY_PX=28 / ALLCAPS_MIN_CASED=20 (\p{Lu}/\p{Ll}); page ALLCAPS_SHARE_MIN=0.15 (RAISED from 0.10: 0.10 false-fired on polygon 0.107). Dev P=1.000 R=1.000.
- oversized-h1: page H1_VW_RATIO=0.11 (~141px at 1280; above tasteful-hero band). Dev max 0.100 (upstash). Separate h1 pass takes max font-size over h1 + text-bearing descendants (handles `<h1><span>`). Dev 0/48 fire; fixture 0.148 fires.
- sub-11px-ui: per-elem SUB11_MAX_PX=10 (LOWERED from 11: dev proved 10px/0.625rem is common competent micro-UI - clerk 1421, dub 252, linear 113 chars; <10px is unambiguously too small); page SUB11_MIN_CHARS=150 (RAISED from 60: clears calcom's 113 Framer-mockup timestamps). Dev 0/48 fire; fixture 303 fires.
- SVG-namespace text (`<text>`/`<tspan>`) EXCLUDED globally (el.namespaceURI===SVG_NS): railway's 5.8px diagram-label tspans are graphic content, not interface copy (DOM cousin of the raster-art honest exclusion). Dropped clerk 1421->0, railway 357->0 through the guard.
- TYPO_MIN_CONTENT_CHARS=200 (page-level guard for the 3 proportion classes; h1/sub-11px use absolute measures).

## Calibration result (eval/typography-extremes-calibrate.mjs, imports SHIPPING scorer+thresholds from dist, exit 0)
All 5 classes: PRECISION 1.000 on 48 real dev pages (0 false positives), all fixtures fire, all negatives clean. tight-leading is the only class with dev POSITIVES to measure recall (17/48 Codex-labeled); the other 4 have 0 dev positives (extreme-tracking/all-caps) or no dev label (oversized-h1/sub-11px). Fail-loud exit contract (2 exclusion / 3 infra / 4 dev precision failure / 5 fixture failure).

## Live audit wiring (needed for audit-only to surface)
rendered-live-scan.ts evaluates inPageSubjective+inPageBuzzword+inPageTypeface separately from analyzeHtmlOnBrowserSubjective; without wiring my scorer there too, the 5 classes surfaced via the eval/test path (setContent) but NOT via the live detect/audit path (page.goto). Added inPageTypographyExtremes + typographyExtremesFindingsFromScore call parallel to the Stage 4a inPageTypeface line. VERIFIED: detect on p01-oversized-h1 over http -> verdict "warnings-only", oversized-h1 warning surfaces; known-good clean-page -> verdict "clean", 0 typography findings (A2).

## Dev-label reality (found in eval/corpus/dev-subjective-labels.json, Codex-labeled, author!=labeler)
- tight-leading: 17/48 dev pages present -> REAL P/R on dev labels.
- extreme-negative-tracking: 0/48 present -> dev = precision-only; recall from fixtures.
- all-caps-body: 0/48 present -> dev = precision-only; recall from fixtures.
- oversized-h1, sub-11px-ui: NOT in the 22-class rubric (postdate it, like default-typeface) -> dev as pure negatives (precision) + fixtures (recall). A5a-pending, same honest limit as 4a.

## Registration decision (audit-only)
All 5 registered AUDIT-ONLY in product-rule-registry (manifest entry ruleId:null + inline minor/polish descriptor, like nested-cards). NO RAW_RULE, NOT in RENDERED_BACKED_RULE_IDS, NO RENDERED_CHECKS entry - so the required-promotion invariant (validator-generation) is NOT tripped and run-validator behaviour is unchanged. Reason: all 5 are A5a-pending taste classes; promoting unvalidated taste to required decision rules that gate convergence is not intended at this stage (task instruction: "do NOT trip the required-promotion invariant unless intended").

## Codex cross-model review (deterministic wrapper codex-review.py, gpt-5.4, 165s, exit 0) - 2 findings, both FOLDED
- P1 (over-fire): tight-leading excluded only the element itself when it is a heading, not descendants (`<h2><span>...</span></h2>` counted as body); all-caps-body excluded headings NOT AT ALL. FOLD: replaced isHeadingEl with ancestor-walking inHeading(el) on BOTH classes. Effect: tight-leading dev recall 0.176->0.118 because arstechnica's tight leading was in heading descendants (a partial FP correctly removed - precision-first).
- P2 (over-fire): all-caps `text-transform:uppercase` bypassed the cased-letter guard, so long CJK/numeric/punctuation in an uppercase wrapper counted as caps. FOLD: cased>=ALLCAPS_MIN_CASED now gates BOTH branches (renderedCaps = cased>=20 && (textTransform===uppercase || lower/cased<=0.05)).
- Added 3 negative fixtures for the flagged gaps: n03-tight-leading-heading-descendant, n02-all-caps-body-heading, n03-all-caps-body-uncased-uppercase. (First draft of the numeric one wrongly contained English words that DO cap-transform -> detector correctly fired -> fixed to pure digits/CJK.) Codex confirmed the score/threshold split correct, registry audit-only pinned like nested-cards, no validator-path A2 regression. Codex could not run the browser test (sandbox EPERM); I ran it (green).
Re-verify post-fold: calibration exit 0 (62/62 pages, 0 dev precision failures, all fixtures at frozen op point); typography-extremes.test 36 asserted OK; subjective-calibration/rendered-scan-integration/audit-rendered/detect-cli/product-rule-registry all OK; build generate-validators --check no drift.

## Verify checks (all satisfied)
1. Per-class fixture fires, known-good clean: YES (calibration + my test; clean-page.html fires 0/5).
2. Calibration P/R per class on dev labels at frozen op point: YES (precision 1.000 all 5 on 48 dev pages; tight-leading R=0.118 the only dev-positive recall).
3. npm run build clean, generate-validators --check no drift: YES.
4. npm test: my unit fully green (all my + all live-path + registry suites pass). Suite count 77 (task-stated 75 baseline + already-committed default-typeface-ground-b-wiring.test.ts + my typography-extremes.test.ts). Sole full-suite failure is palette-recipe.test.ts ("expected 8 hard pairs, got 13") - a CONCURRENT Stage 2a teammate's uncommitted test in the shared working tree, provably outside my diff/ownership, unrelated to typography. No golden drift from my changes.
5. A2 non-regression: detect audit on clean-page.html -> verdict clean, 0 typography findings; positive fixture -> warnings-only (audit-only warning surfaces, not blocking).

## Files
Modified (owned): src/validators/subjective-rendered-scanner.ts (scorer + type + array + wiring + Codex folds), src/validators/rendered-live-scan.ts (live-audit wiring, parallel to Stage 4a inPageTypeface), src/product-rule-registry.ts (5 audit-only manifest entries + comment), src/__tests__/product-rule-registry.test.ts (behaviour-lock + audit-only assertions), eval/corpus/rule-authors.json (stage4b author x5 + note), scripts/run-tests.ts (1 registration line), .claude/memory/MEMORY.md (pointer).
Created (owned): eval/typography-extremes-calibrate.mjs, eval/fixtures/typography-extremes/ (14 fixtures: 5 positive + 9 negative), src/__tests__/typography-extremes.test.ts.
NOT touched (respected do-not-touch): bin/**, src/audit-rendered.ts, src/project-context.ts, src/sidecoach-orchestrator.ts, src/slash-command-router.ts, src/modes.ts. rendered-checks.ts NOT changed (audit-only classes need no check - correct, like nested-cards).
A5a status: PENDING for ALL 5 (the closure step; not faked). extreme-tracking/tight-leading/all-caps carry Codex DEV labels; oversized-h1/sub-11px are unlabeled (postdate the 22-rubric, like 4a).
