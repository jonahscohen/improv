---
name: sidecoach-nested-cards-precision-miss
description: nested-cards milestone FAILED precision (1.00 dev -> 0.267 eval) - dev had only 2 negatives = precision unestimable; lead gate-miss owned; precision-developability now a gate criterion
type: decision
relates_to: [session_2026-06-24_sidecoach-motion-relabel-and-nested-cards.md, session_2026-06-24_sidecoach-tiny-text-labeler-adjudication.md]
---

Collaborator: Jonah Cohen.

nested-cards one-shot milestone (frozen-90): TP=4 FN=3 FP=11, present=7 -> recall 0.571, PRECISION 0.267. The dev precision (1.00) did NOT hold. NOT the clean win I gated.

## Root cause (held-out did its job)
Dev had only 2 nested-cards NEGATIVES (mintlify/fly). A ~13%-FP detector shows 0 FP on 2 negatives by chance most of the time - so dev precision 1.00 was statistically meaningless. The frozen-90's ~83 negatives exposed the true ~13% FP rate. Likely cause: the bg-distinct recall refinement catches incidental tinted-panel nesting, not the "layered cards" idiom. Architect did NOT peek at the 11 FP pages (no contamination) and won't tune to the 90 - exemplary held-out discipline.

## LEAD SELF-ANALYSIS (my gate miss) - per the failure protocol
I gated nested-cards as a "first uncontested win" on precision 1.00 measured over only 2 dev negatives, without flagging that 2 negatives cannot estimate a ~10% FP rate. I HAD the relevant lesson (I flagged tiny-text's 0-dev-negatives precision problem at ST0) but did NOT transfer it to nested-cards (2 negatives is barely better than 0). WHY: I anchored on the recall verification (13/19, which I reproduced) + the perfect-LOOKING precision (0 FP) and didn't scrutinize the SAMPLE SIZE of the precision estimate. FIX/NEW GATE CRITERION: a precision number is only valid with ENOUGH negatives (dev or synthetic) - rule of thumb >=~10-15; precision on <10 negatives is NOT an estimate and must be flagged + backed by synthetic precision fixtures or a negative top-up before a class is called a win. I reported this to Jonah as a win and must walk it back honestly.

## Strategic refinement (architect's, accepted)
Prioritize classes with ENOUGH DEV NEGATIVES to DEVELOP precision, not just dev presence. Coverage: nested-cards 2 neg (bad); icon-tile-stack 11, repeated-section-kickers 14, hero-eyebrow-chip 13 (good - precision-developable). This is now a build-priority + gate criterion.

## Ruling
- nested-cards: NOT a win (0.267 precision fails the precision-first bar). Recall 0.571 genuinely beats oracle 0/7 but precision governs. Keep it in the eval as the honest current measurement; it is NOT product-shippable at 0.267 and NOT banked as a win. DEFER it (architect option 2) for a later negative-top-up + principled tighten (require strong card treatment for BOTH cards, constrain/drop bg-distinct - the diagnosed over-fire source).
- NEXT BUILDS (precision-developable, enough dev negatives): icon-tile-stack (11 neg), repeated-section-kickers (14 neg), hero-eyebrow-chip (13 neg) - ground feature-vs-label first, develop precision against the real dev negatives + synthetic fixtures, then one milestone.
- Motion-coverage measurement (part 2) running - resolves the (a)/(b) scripts question.

Verified via: architect's eval milestone (will independently re-check on a future collect); the precision-sample-size statistics.
