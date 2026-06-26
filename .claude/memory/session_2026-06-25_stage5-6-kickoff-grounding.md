---
name: stage5-6-kickoff-grounding
description: Stage 5/6 kickoff - grounded the converged-engine state, the honest scorecard baseline, and the two clean "oracle beats us" subjective classes (side-stripe-borders recall, marketing-buzzword) that are the real precision-disciplined Stage 5 targets.
type: project
relates_to: [session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, session_2026-06-25_stage4-absorption-review-folded.md, session_2026-06-24_sidecoach-motion-flip-verification.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Jonah directed: "continue the Option B plan, work autonomously to finish stage 5 and stage 6, work with Codex to build and review, maintain previous standards, spin off agents - you're the manager." Teams mode CONFIRMED on (flag=1, session-bef88f21).

## STATE AT KICKOFF (verified from code + beats, not inherited self-report)
- Stages 1-4 of Option B convergence = DONE. Registry is THE engine; all standalone validators (ExtendedDomain, PolishStandard, AntiPattern) are registry-backed shims. 64 suites green at HEAD 44f37d68 (running a fresh build+test to confirm).
- Official scorecard `eval/corpus/scorecard.json` (2026-06-24, PRE Stage 2-4 but convergence was DETECTION-PRESERVING - the scanner/detector modules are unchanged, only their live callers were added). Honest competitive position:
  - OBJECTIVE: sidecoach R0.936/P0.917 vs oracle R0.064/P0.545 = DECISIVE win.
  - SUBJECTIVE: sidecoach R0.139/P0.426 vs oracle R0.111/P0.104. Point-estimate win BOTH axes, BUT bootstrap CI: recall diff [-0.041, 0.106] CROSSES ZERO (statistical TIE); precision diff [0.187,0.467] SIGNIFICANT.
  - Overall recall+precision both significant sidecoach wins.

## EVAL COLLECTION MAP (how sidecoach findings reach the scorecard - eval/sidecoach-scan.mjs)
- objective mode -> objective-rendered-scanner (broken-image/skipped-heading/low-contrast/gray-on-color/justified) + subjective-rendered-scanner (tiny-text, nested-cards ONLY).
- subjective mode -> taste-validator.validateTaste + absolute-ban-detector (scanSideStripeBorders/scanGradientText/scanGlassmorphism/scanHeroMetricTemplate/scanModalAsFirstThought). These are STATIC (string/regex). They are PRODUCT dist modules so eval measures shipping code.

## THE TWO CLEAN STAGE-5 TARGETS (oracle beats us on a NON-artifact basis)
Per-class subjective where oracle recall > sidecoach AND it's not pure over-fire:
1. **side-stripe-borders**: imp R0.556 (5TP/38FP, P0.116) vs sc R0.222 (2TP/17FP, P0.105). Structural CSS feature (border-left/inline-start accent). sc UNDER-detects. Detector = absolute-ban-detector.ts:78 scanSideStripeBorders (static). Improve recall WITHOUT blowing precision.
2. **marketing-buzzword**: imp R0.5/P0.4 (8 present) vs sc 0/0 - NO sidecoach detector exists (grep buzzword in src/ = 0 hits). Linguistic class. Build an OWN buzzword-density detector (reimplement-and-own: do NOT copy oracle's wordlist).
DO-NOT-CHASE (locked): motion (layout-transition/bounce-easing) + numbered-section-markers - oracle's recall there is over-fire artifact (P0.06-0.13); a coupled detector = the exact fake-win we exposed in oracle. Document as artifact in final scorecard, do not build.

## DISCIPLINE (carry forward)
Develop on dev corpus only (never frozen-90); precision needs >=10 negatives; author != labeler for taste; milestone-measure ONCE per fix-batch; Codex adversarial review every unit; detection-preserving (objective 0.936 + render-robustness banked). Stage 6 = full frozen-90 re-collect on the CONVERGED engine + Codex final gate + lead gate, honest framing (recall tie unless Stage 5 pushes the CI off zero).

## PLAN
Stage 5: close side-stripe recall + add marketing-buzzword detector (precision-disciplined) -> push subjective recall CI off zero so oracle beats NO real axis. Stage 6: converged-engine full scorecard + Codex final gate.

## Files touched
- (kickoff beat; build/test running in bg /tmp/sc-baseline.log)
</content>
</invoke>
