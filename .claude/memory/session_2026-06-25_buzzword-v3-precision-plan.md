---
name: buzzword-v3-precision-plan
description: Jonah - "keep working at the precision." v2 won recall (frozen 0.875) but lost precision (0.333 < oracle 0.4). v3 = principled precision fix (concreteness counter-signal) developed on DEV + measured on a FRESH held-out (frozen-90 is spent for this class). Protect the banked recall win.
type: decision
relates_to: [session_2026-06-25_buzzword-v2-frozen90-RESULT.md, session_2026-06-25_buzzword-rebuild-mandate.md, feedback_shortcuts_are_lies.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25). Jonah: "Let's keep working at the precision. You can do this."

## THE GAP
v2 frozen marketing-buzzword: r=0.875 (beats oracle 0.5) BUT p=0.333 (14 FP) < oracle 0.4. F1 0.48 vs 0.44 (we edge it), but precision is the one sub-axis oracle wins. Close it.

## HELD-OUT DISCIPLINE (the hard part)
The frozen-90 is SPENT for marketing-buzzword (2 measurements: v1, v2). Re-measuring it after a precision tune = training-on-test / multiple-comparisons = rots the Contract-6 claim. So:
- Develop the fix on DEV (the dev FP - accenture/flowbite/nasa/neon/onepassword/resend - are the SAME "concrete use of marketing vocab" mode as the frozen FP, and dev is allowed to study).
- Measure on a FRESH held-out (new ~30 diverse pages, disjoint from dev+frozen-90, externally sourced, labeled author!=labeler, frozen before measuring). This is the Contract-6 "refreshed challenge" concept done properly.
- I have NOT looked at the specific 14 v2 frozen FP pages (only the count) - keep it that way; develop purely on the dev FP.

## THE PRINCIPLED FIX (concreteness counter-signal)
FP mode = pages that USE strong vocabulary CONCRETELY (nasa "groundbreaking discoveries"=real science; onepassword "powerful security"=a real feature) vs "leaning on empty fluff." A raw lexical density can't separate them. FIX: discount buzzword density by the page's CONCRETE SUBSTANCE (numbers/stats, proper nouns, specific technical terms, concrete claims) - buzzwords AMID specifics = concrete (don't fire); buzzwords WITHOUT substance = fluff (fire). Complement: PEAK-weighting (pure-hype PEAK terms are harder to use concretely than STRONG/MILD). MUST improve precision while HOLDING recall (the banked significant subjective-recall win - do NOT trade it back).

## STRUCTURE (buzzword builds, lead labels+measures+gates)
buzzword: FP-mode characterization -> principled fix -> dev re-calibrate (precision up, recall held) -> capture the fresh held-out (HTML only). Lead: Codex-label the fresh held-out (author!=labeler) -> measure v3 there + oracle head-to-head -> Codex review. Single-source harness; zero frozen-90 knowledge.

## Files touched
- (decision beat; v3 in flight as Task #7)
</content>
