---
name: sidecoach-motion-flip-verification
description: Lead verification of the motion-relabel "flip" - robust wins confirmed (objective, precision, exposed-artifact) but the recall "flip" is a TIE (sidecoach recall 75% the deferred tiny-text detector); architect overclaim corrected
type: decision
relates_to: [session_2026-06-24_sidecoach-taste-survey-jonah-decision.md, session_2026-06-24_sidecoach-subjective-validity-crisis.md]
---

Collaborator: Jonah Cohen.

Architect claimed the motion re-label FLIPS subjective: sidecoach R0.163/P0.436 > oracle R0.129/P0.112 = "Sidecoach BEATS oracle on both axes." I VERIFIED independently before any Jonah headline.

## VERIFIED ROBUST (solid, defensible)
- oracle fires layout-transition on 46/90 pages (half the corpus) - over-fire is robust regardless of exact GT. Under observed GT its motion TP collapses 39 -> 5 (lt: 3 TP / 46 fires = P0.065; be: 2/16 = P0.125). oracle's subjective recall lead WAS a method-coupled artifact (it + the speculative labeler both read the same CSS declarations). CONFIRMED.
- Instrument logic principled: excludes page-settle (MAG_MAX 400px), jitter (MAG_MIN 3px), marquees (vertical-only), scroll-reveal (LOAD+HOVER windows only); bounce = overshoot timing-fn or observed overshoot. Sound, locked before measuring.
- SUBJECTIVE PRECISION: sidecoach ~0.48 vs oracle ~0.11 = decisive, robust (oracle over-fires everything: side-stripe 419 detections, lt 46, be 16).
- OBJECTIVE: sidecoach 0.936 (verified earlier). Decisive.

## CORRECTED - the recall "FLIP" is a TIE, overclaimed
My recompute (observed-motion GT + non-motion labels, 89 pages): SIDECOACH subjective per-class:
  tiny-text 15 TP / 65 present / 15 det  <- 75% of sidecoach's recall, precision 1.00
  side-stripe-borders 2/9/18 (over-fires); nested-cards 2/7/5; gradient-text 1/1/2
  OVERALL sidecoach R 0.139 P 0.476 (I get 0.139, architect said 0.163 - reconcile; both ~0.14).
oracle ~R 0.129. So recall is a TIE (~0.14 each), NOT a sidecoach win. And 75% of sidecoach's recall is the tiny-text detector we'd DEFERRED. Without tiny-text, sidecoach recall = 5/144 = 0.035 (below oracle). So the "flip on recall" is entirely carried by a deferred detector + the GT correction shrinking the denominator.

## tiny-text status REVISED (frozen-90 milestone honest)
tiny-text SMALL_PX=13 on the frozen-90: 15 TP, 0 FP over ~79 negatives = PRECISION 1.00, recall 0.23. That CLEARS the >=10-negatives gate. So it's NOT broken - it's a legitimate LOW-recall/PERFECT-precision PARTIAL (catches the genuinely-<=13px-dense subset). The dev 3/21 + holistic-labels finding under-sold it. PROMOTE from "deferred/known-broken" to "precision-safe partial (low recall)." Transparent: it does NOT solve tiny-text (the holistic labels span 13-18px); it's a precision-clean partial.

## HONEST MISSION OUTCOME (for Jonah - NOT "we beat them on everything")
On a SOUND eval: Sidecoach wins OBJECTIVE decisively (0.936) + subjective PRECISION decisively (~0.48 vs ~0.11); oracle's subjective recall lead is an EXPOSED measurement artifact (motion method-coupling). On subjective RECALL the two are TIED (~0.14), both weak (taste is hard for lightweight detection) - but sidecoach's recall is precision-disciplined/honest while oracle's was over-fired + artifact-inflated. => Sidecoach is the better + more honest tool: it wins every axis of REAL capability (objective, precision) and exposed the competitor's headline as fake; it does NOT claim a taste-recall superiority the data doesn't support.

## Architect overclaim - pattern noted
"FLIP - beats on both recall and precision" overstated the recall (a tie, carried by a deferred detector). Same pattern as the session-opening "beats oracle +0.119" (rendered-vs-static) overclaim - the verification gate caught it again. Correcting before Jonah.

## Gated-for-Jonah items (architect surfaced)
1. Make observed-motion the OFFICIAL GT (swap candidates.json) - legitimate (original motion GT demonstrably invalid: rubric admits labeler can't see motion, oracle fires 46/90). Frame as "corrected invalid GT," not "changed GT to win." Note instrument positives are marginal (3-7px near-threshold on 3 of 6) - motion becomes very low-prevalence (~9/144).
2. Product motion detector investment - upside small (only 9 motion-present on the 90); architect already flagged it must be INDEPENDENT of the GT instrument (method-coupling trap, commit 202d2bc1). Likely SKIP.

## GATE DECISIONS (mine)
- METHOD-COUPLING FLAG (architect's): STRONGLY AFFIRMED. A product motion detector observing motion the SAME way as the GT instrument would match the GT by shared method = the EXACT fake-win we exposed in oracle. The architect refusing to build a coupled detector, preemptively, applying the very insight that exposed oracle to OURSELVES = the integrity discipline fully internalized. Only an INDEPENDENT implementation (guarded by referee-independence) could honestly win motion.
- PRODUCT MOTION DETECTOR: SKIP. Leave motion as a REFEREE-ONLY fix. Tiny upside (max ~+9 TP, realistically less given marginal positives), the value (exposed artifact + corrected GT) is already captured, an independent detector is high-effort/low-reward, and sidecoach scoring 0 on motion is HONEST. Motion is a non-factor post-correction (only 9 positives).
- nested-cards: ACCEPT the marginal-valid win. My recompute matches (2/7=0.286 recall, 2/5=0.40 precision, validated on ~83 real negatives, oracle 0/7). A genuine modest precision-valid win on a low-weight class (eval 7); don't over-invest in more top-up = diminishing returns.
- OFFICIAL GT SWAP: HOLD for Jonah's blessing (his frozen-GT authority; I put it to him). Once blessed, swap with the marginal-positive caveat documented.
- FINAL SCORECARD: must use the HONEST framing (recall TIE, not a win) - objective decisive + precision decisive + exposed-artifact + recall-tie. Not the overclaimed "beats on both."

Verified via: .scorecard-cache oracle motion fire counts (lt 46, be 16); motion-observed-frozen.json (6 lt / 3 be + evidence); my per-class sidecoach subjective recompute; motion-observe-label.mjs logic review.
