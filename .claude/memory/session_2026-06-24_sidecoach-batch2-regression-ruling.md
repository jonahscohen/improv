---
name: sidecoach-batch2-regression-ruling
description: Lead ruling on the batch-2 eval regression (0.894->0.787) - #2 currentSrc revert OK, #3/#4 held on a caught factual error about the referee
type: decision
relates_to: [session_2026-06-24_sidecoach-decoupling-gate.md, session_2026-06-23_sidecoach-stage0-lead-verification.md]
---

Collaborator: Jonah Cohen.

The architect honestly surfaced a batch-2 regression (objective recall 0.894 -> 0.787) BEFORE touching anything (no unilateral eval-tuning) and asked my ruling on two reverts. The discipline worked: the milestone measurement caught what calibration (31/31 green) missed, and the architect did not pocket batch-1's number or silently revert.

## #2 currentSrc -> APPROVED revert
Under the hermetic abort-external render, img.currentSrc is EMPTY for external imgs (load aborted) => ~55 false positives => broken-image precision 1.0 -> 0.083. This is a render-CONFIG bug (currentSrc empty under abort-external for ANY external img), provable on a synthetic fixture independent of the corpus. batch-1's src-attribute basis was correct. Revert approved. REQUIRE: add a calibration fixture (external img + abort-external -> currentSrc empty -> must fall back to src) so it can't regress again. Calibration missed it because fixtures use data: URIs that LOAD (currentSrc populated) - the fixture gap.

## #3/#4 -> HELD. The architect's premise is FACTUALLY WRONG about the referee.
Architect claimed: "the referee computes declared-color contrast and does NOT skip filter/opacity; my code skips ~10 pages it labels." I read the referee (objective-label-rendered.mjs) myself:
- Line 166-167: `if (op > 0.01 && op < 0.999) { contrastIndeterminate++; return; }` - the referee DOES skip partial cumulative opacity -> indeterminate.
- Line 153: background-image anywhere up the chain -> indeterminate (skip).
- NO `filter` handling anywhere in the contrast path (cumOpacity only multiplies opacity; effectiveBg only does bg-image+bg-color). So the referee IGNORES filter and computes declared-color.

So the claim is HALF WRONG: on OPACITY the referee SKIPS (architect AGREES, not diverges); the real divergence is almost certainly FILTER (referee ignores filter -> labels declared-color; architect's #3/#4 skips filtered text -> indeterminate -> miss).

## The ruling + the frame reset
1. The divergence mechanism must be PRECISELY identified per divergent page (filter? opacity threshold? compositing base?) before ANY change. I expect FILTER; the architect must confirm, not assume.
2. JUSTIFY BY THE INDEPENDENT STANDARD, REFEREE INVISIBLE. If it's filter: standard WCAG tooling (axe-core, Lighthouse) ignores CSS filter and computes declared/computed-color contrast; batch-2's skip-on-filter was a non-standard over-conservatism; reverting restores the standard behavior (= what batch-1's independent reimplementation did). That framing is allowed. "Align to GT" is the WRONG frame and is forbidden: changing the product's definition to MATCH THE REFEREE'S manufactures agreement and destroys the independence that makes the eval meaningful - the semantic-coupling analog of the import-coupling the import-guard prevents. Referee-agreement is a CONSEQUENCE of both following the standard, never the goal.
3. VERIFY: spot-check that on the divergent pages the declared-color verdict is genuinely correct (text really fails contrast ignoring filter), so we're not forcing agreement with a wrong referee label.
4. Add a filter calibration fixture encoding the spec behavior.
5. If the divergence is anything OTHER than documented standard-tool behavior, HOLD and surface - do not change.

KEEP the genuine batch-2 wins (#1 ARIA role-token, #6 canvas modern-color, #7 lum 0.04045, #8 visibility, #10 justified block). Revert only the two regressors. Still "capability gain + parity, never beat" (gated on S5b).

## Other items noted
- Condition 7 baseline (the 5 existing detectors): glassmorphism-default, gradient-text, hero-metric-template, side-stripe-borders, identical-card-grids->icon-tile-stack semantic. All get the same calibration+dev-recall+precision bar.
- ST0 capture COMPLETE: self-contained ~1MB styled captures, M1 raw-curl emptiness fixed. Next ST0 step: Codex-label all 22. ST1 held.
- Process lesson reinforced: calibration fixtures must cover the conditions the real corpus exhibits (external-img-abort-external; filter density) or "calibration green" is a false proxy. Extending synthetic fixtures is disjoint from the corpus = NOT eval-tuning.

## UPDATE - the filter hypothesis was REFUTED by the verification I required (the gate working)
The architect spot-checked 3 divergent pages + bisected mk_python: failFilter=0 on all 3 (no filter on the contrast-failing path) -> FILTER IS NOT THE REGRESSOR. Both the architect's "agree it's filter" AND my own filter hypothesis were wrong. The "verify, don't assume" step (my ruling step 1/5) directly caught a wrong diagnosis before any code changed. This is exactly why the verification gate exists - do not let a plausible hypothesis (even the lead's) become a fix without the spot-check.

REAL mechanism (bisect, mk_python low-contrast 15->7->0): canvas #6 INNOCENT (regex-parser 15 == canvas-parser 15). The regressor is #5: Codex's "exclude off-screen right/bottom" was folded as `box.top >= innerHeight` / `box.left >= innerWidth`, but innerHeight is the VIEWPORT (800px) NOT the page height -> it excluded BELOW-THE-FOLD text as if off-screen. The referee has no below-fold exclusion and labels below-fold low-contrast -> #5 drops it -> MISS. Clear BUG (off-screen must mean outside the PAGE bounds / negative-offset hiding, not below the initial fold). The remaining 7->0 is #4 (partial-opacity skip), which the referee ALSO does (line 166) so it's not a miss vs the GT.

REVISED REVERT PLAN (approved): #2 currentSrc->src (bug) + fixture; #5 remove below-fold exclusion, keep genuine off-screen + sr-only/1px/textIndent (bug, synthetic-provable) + fixture - THIS restores the contrast recall; #3 filter-skip revert on STANDARD grounds (axe/Lighthouse ignore filter; referee-invisible) - NOT the regressor, pure spec-alignment + filter fixture; KEEP #4 opacity-skip. My added conditions: (a) #4 KEEP must be justified by the STANDARD (axe returns incomplete/indeterminate when effective contrast under partial opacity is undeterminable), NOT by "matches the referee" - same frame discipline; (b) #3 must be score-NEUTRAL on the full 89 (if un-skipping filter moves any page, surface which + why standard-correct); (c) PROOF = re-measure returns ~0.894; if SHORT, #4 is suspect - surface it. I will independently re-run the 89-page scorecard when it lands.

Files read this ruling: eval/objective-label-rendered.mjs (referee contrast path, lines 140-209).
