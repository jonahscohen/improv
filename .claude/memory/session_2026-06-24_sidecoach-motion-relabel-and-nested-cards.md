---
name: sidecoach-motion-relabel-and-nested-cards
description: Jonah chose RE-LABEL MOTION PROPERLY (dynamic observation); nested-cards gate-PASSED (lead-verified, first taste win); tight-leading deferred (holistic)
type: decision
relates_to: [session_2026-06-24_sidecoach-subjective-validity-crisis.md]
---

Collaborator: Jonah Cohen.

## JONAH DECISION: re-label the motion classes properly (AskUserQuestion answer)
Of {drop-motion-from-metric, keep-as-is-dual-report, re-label-motion-properly}, Jonah chose RE-LABEL MOTION PROPERLY - the most rigorous option. So layout-transition + bounce-easing get SOUND ground truth from OBSERVED motion (dynamic render), not the labeler's CSS-declaration guesses. Touches the frozen GT, Jonah-approved.

PLAN (architect to scope a DESIGN before building - it's a new measurement instrument, design-review like the objective referee):
- A DYNAMIC-MOTION PROBE (Playwright): render the page, TRIGGER animations/transitions (load, hover, scroll, in-view), SAMPLE element bounding boxes over time.
- layout-transition = OBSERVED layout shift: an animation/transition that actually moves/resizes elements such that SURROUNDING content shifts (not in-place transform/opacity). Measure sibling/neighbor box displacement during the animation.
- bounce-easing = OBSERVED overshoot: sample the animated value over time, detect overshoot-and-return (elastic/spring), or a timing-function with overshoot (cubic-bezier y>1 / spring). Observation over CSS-name.
- Re-label dev + frozen-90 motion classes BLIND (not to make a tool win) = a measurement-instrument upgrade applied uniformly; re-measure BOTH sidecoach + oracle.
KEY EXPECTED EFFECT: once motion GT is OBSERVATION-based (decoupled from CSS-reading), oracle's method-coupled 74% artifact should COLLAPSE (its CSS-reading no longer matches observation labels), and motion becomes a class an OBSERVATION-based detector can win honestly. Determinism/reproducibility required (like the objective referee). This is a substantial new instrument - architect brings the design for my gate before building.

## nested-cards GATE: PASS (lead-verified) - FIRST UNCONTESTED TASTE WIN
Committed a368300c. I independently ran analyzeHtmlOnBrowserSubjective on the 21 dev pages: recall 13/19=0.68, precision 1.00 (0 FP on mintlify/fly), same 6 misses (retool/supabase/neon/trigger raster-bound, inngest/hightouch borderline-DOM) -> reproduces the architect EXACTLY. DOM-reachable recall ~0.87. Calibration 14/14. oracle 0/7 (verified: no rule). Codex wedged a 3RD time (SIGKILLed, deferred per the standing infra guidance; architect self-reviewed precision concerns; my independent gate is the cross-check). GATE-PASS. Detector: card-like container (rounded + border|shadow|distinct-opaque-bg + >=100x60 + children) holding a DESCENDANT card <0.85x area; the bg-distinct signal was a principled recall refinement, not page-fit. NOD the one-shot milestone (operating point frozen by dev+calibration).

## tight-leading: DEFER (accepted)
Architect grounded it (verify-before-build): line-height does NOT separate (present avg 1.51 = absent avg 1.51, full overlap, mintlify present at the LOOSEST 1.71). Holistic, entangled with font SIZE - same failure as tiny-text. Accepted defer (low-risk: deferring, not shipping). REVISIT note: a COMBINED signal (line-height AND small font-size together) might separate it later - the labeler reads "small lines look closely stacked"; not now.

## PATTERN (3 classes deep, established)
TYPOGRAPHIC-PERCEPTION classes (tiny-text, tight-leading) don't reduce to their obvious CSS metric; MOTION classes are speculative-from-CSS; but STRUCTURAL-VISUAL classes (nested-cards) DO reduce to a DOM feature. Buildable taste frontier = structural-visual classes the labeler sees as DISCRETE patterns. Next: icon-tile-stack (5), repeated-section-kickers (5), hero-eyebrow-chip (8) - ground-first each.

## Motion-instrument DESIGN gate (reference_motion_instrument_design.md)
CORE DESIGN APPROVED: layout-transition = a NEIGHBOR's box displaces while the element animates (transform/opacity don't reflow neighbors; width/height/top/margin/grid do) = correct, rubric-faithful, referee-grade. bounce-easing = observed overshoot-and-return (fallback to overshoot easing curve only when too-fast-to-sample) = correct. Triggers (load+scroll+hover/focus sample), fixed rAF schedule, reducedMotion=no-preference, blind+uniform re-label = sound.

OPEN DECISION (architect's (a) scripts-stripped CSS-observable vs (b) re-capture scripts-on): DON'T pick blind. VALIDITY RISK: modern SaaS (the corpus) drives most motion via JS (framer-motion/GSAP/IO-reveal); scripts-stripped capture can't run it -> if motion is JS-DOMINATED, (a) systematically labels motion-heavy pages "absent" = a skewed GT, not just narrow. RULING: MEASURE coverage FIRST - run the instrument scripts-stripped on dev + detect JS-motion frameworks in the original pages; report, of motion-present pages, how many have CSS-native-observable layout-shift/bounce vs JS-only.
- If CSS-native covers MOST -> (a) valid (deterministic, label "CSS-observable motion"); proceed.
- If JS-DOMINATED -> real scope call (re-capture scripts-on = forks corpus + determinism risk, vs accept motion out-of-scope) -> bring to JONAH with the data. Note: (b)'s non-determinism may be surmountable (frozen clock + fixed triggers on self-contained captures); don't assume impossible.
Both tools are equally blind to JS under (a), so the COMPARISON is fair either way - the question is whether the GT is MEANINGFUL, which the coverage measurement answers.

## COVERAGE MEASURED -> OPTION (a) APPROVED
16/17 motion-present dev pages have OBSERVABLE CSS-native motion; only calcom is JS-only. So scripts-stripped is NOT systematically blind (16/17) -> (a) VIABLE. APPROVED (a): build the instrument scripts-stripped, label GT "CSS-observable motion," document the calcom 1/17 JS-only gap, re-label dev+frozen-90 blind, re-measure BOTH tools. No Jonah escalation - data cleanly supports (a). Expected: oracle's method-coupled motion lead collapses under observed (not CSS-read) GT = the real test of Jonah's "re-label properly."

## icon-tile-stack DEFER (grounded marginal): loose R1.00/P0.48, spec-refined R0.50/P0.56 = holistic gestalt, not clean DOM feature.

## STRATEGIC PICTURE -> Jonah reassessment coming
Buildability survey: NON-separable = tiny-text, tight-leading, icon-tile-stack (holistic gestalts), motion (speculative, re-labeling). SEPARABLE = nested-cards ONLY (R0.571>imp 0/7, P0.267 fixable). Codex-VISION labels are holistic gestalts resisting clean DOM-feature reduction -> precision-disciplined lightweight detectors hit a LOW CEILING on most taste classes. Honest read: neither tool has strong REAL taste detection (oracle fakes it w/ motion-speculation+over-firing; Sidecoach can do a FEW clean structural classes w/ precision). Sidecoach's honest edge = OBJECTIVE axis (0.936) + a few clean taste classes + PRECISION; oracle's taste lead is noise. REMAINING SURVEY before reassessing: ground-test repeated-section-kickers (14 neg) + hero-eyebrow-chip (13 neg) + the motion re-label result -> THEN grounded taste-strategy reassessment to Jonah.

Verified via: my independent analyzeHtmlOnBrowserSubjective run on dev (nested-cards 13/19, P1.00); oracle rule-vocabulary check (0 rules for clean classes).
