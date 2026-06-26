---
name: Honest final scorecard - Sidecoach vs oracle (sound eval)
description: The honest Stage-1 outcome - objective + subjective-precision wins, subjective recall a tie, oracle's lead exposed as artifact
type: reference
relates_to: [session_2026-06-24_sidecoach-stage1-plan.md, reference_motion_instrument_design.md]
---

# Honest final scorecard (Stage 1) - Sidecoach vs oracle, sound eval

Collaborator: Jonah Cohen. 89 un-peeked pages (ed_csstricks contaminated-excluded). Held-out discipline intact
throughout (never tuned to the 90; never peeked at FP pages; operating points set on dev + synthetic, milestone
one-shot). The MISSION: beat oracle as the baseline, simpler, no regressions. OUTCOME below is framed
HONESTLY - we claim only what the data supports.

## HEADLINE (what we DO claim)
- OBJECTIVE recall: sidecoach 0.936 vs oracle 0.064 - DECISIVE WIN. (broken-image 5/5, skipped-heading 32/32,
  low-contrast 40/40, gray-on-color 11/17, justified-text n/a). Lead-verified independently (exact match, errs=0).
- SUBJECTIVE PRECISION: sidecoach 0.436 vs oracle 0.112 - DECISIVE WIN. Sidecoach is precision-disciplined
  (55 detections); oracle over-fires (170 detections for 19 TP).
- ORACLE'S SUBJECTIVE-RECALL "LEAD" WAS A MEASUREMENT ARTIFACT - exposed + corrected. Its apparent 0.277 was
  74% speculative-motion over-firing: the Codex labeler guessed motion from CSS declarations, oracle reads the
  same CSS declarations, so they "agreed" by shared method, not truth. Under an observation-based motion GT (the
  motion-observe instrument, Jonah's re-label ruling), oracle's motion precision collapses: layout-transition
  P 0.63->0.07 (3 TP / 43 FP), bounce-easing P 0.63->0.13. Demonstrated, not inferred.

## TIE (what we do NOT overclaim)
- SUBJECTIVE RECALL: a TIE. sidecoach 0.163 vs oracle 0.129 - both WEAK. 63% of sidecoach's subjective recall
  (15 of 24 TP) is the tiny-text precision-safe partial; WITHOUT tiny-text sidecoach recall = 0.061, BELOW
  oracle's 0.129. So the recall edge is carried by one low-recall detector + the motion-denominator shrink, not
  a robust capability lead. We do NOT claim taste-recall superiority. Both tools have low taste recall; the
  difference that matters is sidecoach's is precision-disciplined while oracle's is over-fired.

## PRE- vs POST-Stage-2 accounting (lead-required)
icon-tile-stack's 3 TP ride the EXISTING identical-card-grids detector (Codex-semantic-mapped to icon-tile-stack),
which is the Stage-2 ReDoS DELETION target (Jonah pre-blessed the deletion; sequenced after a replacement we
decided NOT to build since a new icon-tile-stack detector ground-tested marginal). So:
- PRE-Stage-2 (identical-card-grids present, current state): sidecoach subjective R=0.163, P=0.436 (TP 24, det 55).
- POST-Stage-2 (identical-card-grids deleted -> icon-tile-stack 0): sidecoach subjective R=0.143, P=0.457 (TP 21,
  det 46). Recall dips slightly (still a TIE vs oracle 0.129); PRECISION IMPROVES (0.436->0.457) because the
  deleted detector was a net precision DRAG (3 TP / 9 det = P 0.33 on that class). So the Stage-2 deletion is
  net-positive for precision, recall-neutral-ish (tie holds), and removes the ReDoS pathology - a clean
  simplification. oracle unchanged either way (R 0.129, P 0.112).

## Reconciliation (0.163 vs 0.139)
Architect 0.163 (committed effectiveMapping, includes sidecoach:identical-card-grids -> icon-tile-stack semantic
mapping = 3 TP, Codex high-conf, lead-reviewed Stage 0). Lead's manual 0.139 omitted those 3. Both present=147
(class-sum; lead's 144 a minor basis diff). EITHER WAY recall is a TIE (~0.13-0.16) - the reconciliation does not
change the honest framing.

## Per-class taste detectors (sidecoach), observed-GT
- tiny-text: precision-safe PARTIAL - 15 TP / 0 FP over ~79 negatives = P 1.00, R 0.23 (SMALL_PX=13). Catches the
  genuinely-<=13px-dense subset; does NOT solve holistic tiny-text (labels span 13-18px). Promoted deferred ->
  precision-safe partial (clears the >=10-negative gate).
- nested-cards: marginal precision-VALID win - R 0.286, P 0.40 on the 90's ~83 real negatives, oracle 0/7.
  Tightened (dropped the bg-distinct over-fire that gave P 0.27; require border|shadow both cards).
- icon-tile-stack: 3 TP via the existing identical-card-grids detector (semantic-mapped); a NEW detector was
  ground-tested MARGINAL (holistic gestalt) and not built.
- side-stripe-borders 3 TP (over-fires), gradient-text 1 TP - existing detectors.
- DEFERRED (verify-before-build proved non-separable / speculative-GT): tight-leading (line-height present 1.51 =
  absent 1.51), hero-eyebrow-chip (0.50/0.57), repeated-section-kickers (0.29/0.67), motion (speculative GT).

## Integrity notes
- PRODUCT MOTION DETECTOR: NOT built (lead+architect call). A product detector observing motion the same way as
  the GT instrument would match the GT by shared method = the EXACT fake-win we exposed in oracle. Motion is a
  referee-only fix (GT corrected); sidecoach scoring 0 on motion is HONEST. (An independent detector's upside is
  tiny: only 6 lt / 3 be observed-present on the 90, 3 of 6 lt near-threshold 3-7px.)
- OFFICIAL GT SWAP (observed-motion into candidates.json): HELD - Jonah's frozen-GT authority. The numbers above
  are the corrected measurement; making them official awaits his blessing. Caveat to document: 3 of 6 observed
  layout-transition positives are marginal (3-7px near-threshold reflows).
- The owned objective scanner is INDEPENDENT of the eval referee (import-graph guard); the decouple harness fix
  recovered contention-timeout false-negatives (eval-safe, not eval-tuning).
