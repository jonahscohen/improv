---
name: Stage 4a A5a RESULT - gate NOT cleared; independent labeling exposed a construct mismatch
description: A5a head-to-head ran with real Codex labels. OURS R=0.417 P=1.000 (0 FP on 11 real pages); ORACLE generous R=0.500 P=0.375 with 90.9% FP, strict R=0.000. Gate exit 4 = NOT PASSED. Root cause is NOT a detector bug - the detector scores the DECLARED font stack while the screenshot labeler scores the PAINTED face, so 6 author-built negatives got flipped to positive. Lead ship call - 4a does NOT clear A5a.
type: decision
relates_to: [session_2026-07-23_stage4a-a5a-closure.md, session_2026-07-23_sidecoach-stage4a-default-typeface.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - real A5a run, 23/23 Codex-labeled pages graded (12 pos / 11 neg), oracle pinned via SIDECOACH_ORACLE_DETECT=/tmp/oracle-v4/skill/scripts/detect.mjs; grader exit 4
confidence: high
---

Collaborator: Jonah. 2026-07-24. The A5a taste-detection gate for `default-typeface` RAN with real independent Codex ground truth. **Lead ship call: 4a does NOT clear A5a.** The numbers are real and the failure is informative, so it is recorded rather than retried until green.

## What actually happened operationally (Jonah could not see progress - he was right to ask)
The labeling was NOT stalled: it had COMPLETED 23/23 (12 positive / 11 negative, every label `labeledBy=codex`) by 02:22. The a5a-label teammate simply never got re-invoked to run the grader, so the numbers sat unrun. The first grader run then FAILED CLOSED (exit 2, "INCONCLUSIVE, not OK") because the comparator resolves from `$SIDECOACH_ORACLE_DETECT` or a plugin-cache default, and the pinned clone lives at `/tmp/oracle-v4` (neither). Setting `SIDECOACH_ORACLE_DETECT=/tmp/oracle-v4/skill/scripts/detect.mjs` graded all 23. **The fail-closed behavior worked exactly as designed** - it refused to report a head-to-head it could not actually run.

## THE NUMBERS (graded vs the SAME independent Codex labels)
```
OURS (shipping)      R=0.417 (5/12)  P=1.000  FP=0/11 (0.0%)    [TP5 FP0 FN7 TN11]
ORACLE generous-map  R=0.500 (6/12)  P=0.375  FP=10/11 (90.9%)  [TP6 FP10 FN6 TN1]
ORACLE strict-map    R=0.000 (0/12)  P=n/a    FP=0/11 (0.0%)    [TP0 FP0 FN12 TN11]
```
Grader exit 4: OURS missed 7 Codex-positives.

## ROOT CAUSE: a construct mismatch, not a detector bug (the load-bearing finding)
Of the 7 "misses", SIX are the n01-n06 fixtures the rule author BUILT AS NEGATIVES, which the independent labeler flipped to POSITIVE. Codex's own notes give it away:
- n01-branded-body: "Text reads as generic system sans." (present=true, 0.75)
- n03-brand-with-system-fallback: "Plain system sans throughout." (present=true, 0.78)
- martinfowler (real): "Body resembles default Times serif" (present=true, 0.82)

Those fixtures declare FICTIONAL families (`"Alluvium Sans"`, `"Tessellate Grotesk"`) which paint as a generic system sans. So:
- **Our detector scores the DECLARED font-family stack** -> sees a deliberately chosen face -> clean. (This is a deliberate 4a design choice: the hermetic render aborts webfonts, so painted-face scoring would fire on nearly every real page.)
- **The A5a labeler scores the PAINTED SCREENSHOT** (the harness hands Codex an image) -> sees system sans -> present.

They are measuring two different constructs: *was a typeface deliberately chosen* vs *does the rendered text look default*. On a page that declares a chosen face but paints as a system font, those legitimately disagree - and the fixtures are exactly that case. On the 5 fixtures actually DESIGNED as positives we are 5/5 (100%).

## Why this is a WIN for the independence discipline (worth keeping)
An author-labeled ground truth would have scored this a clean pass: font-class would have labeled its own negatives negative, yielding 5/5 recall + perfect precision. The independent Codex pass is what exposed that the CLASS DEFINITION is ambiguous between declared-intent and painted-appearance. This is precisely the failure mode `author != labeler` exists to catch, and it caught one on its first real use for a new class.

## What the numbers DO establish (honest positives)
- **Our precision is perfect: P=1.000, 0 FP across 11 REAL shipped pages.** We never false-fire on a real design.
- **The oracle is unusable at this task**: its generous map false-fires on 10 of 11 real shipped pages (90.9% FP, P=0.375) because `overused-font` fires on nearly everything; its strict map catches ZERO positives (R=0.000). Neither map is a credible detector for this class.
- So the coverage claim ("a class the oracle does not truly cover") holds. The GATE still does not certify us, and we do not get to claim it does.

## Ship call + what must happen before A5a can certify this class
NOT CLEARED. Do not report 4a as plan-"shipped". To close it honestly, resolve the construct FIRST, then re-label:
1. Decide the class's construct explicitly - DECLARED stack (current detector) or PAINTED face - and write that into the rubric definition, which currently says only "left in a default browser or operating-system font" (ambiguous between the two).
2. Match the LABELING SIGNAL to the construct. If declared-stack is the construct, the labeler must be given the declared font-family (not only a screenshot), or the fixtures must embed fonts that actually paint distinctly.
3. Re-run the labeling + head-to-head after that, and re-verify.
The fixtures are not "wrong" - they are a fair test that surfaced the ambiguity.

## Files touched
- this beat + MEMORY.md index. No code changed by this run. `eval/typeface-a5a.mjs`, the extended rubric, and `eval/corpus/typeface-a5a-labels.json` were produced by the a5a-label teammate earlier; nothing was tuned to make the gate pass.
