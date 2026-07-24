---
name: A5a declared-stack relabel WORKED (recall 0.417 -> 1.000); three ground-truth defects found and fixed
description: The declared-stack construct fix flipped all six branded fixtures to correct and took OURS to R=1.000 P=0.800 vs oracle P=0.063 with 78.9% FP. One residual FP (p04) traced to MY extractor conflating @font-face definitions with applications; also caught the extractor leaking a fixture's own CSS comment stating the answer (independence contamination) and a stale signal-provenance map. All three fixed; re-run in flight.
type: project
relates_to: [session_2026-07-24_a5a-rubric-declared-stack-fix.md, session_2026-07-24_stage4a-a5a-RESULT-construct-mismatch.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - real A5a run on 23 Codex-labeled pages (declared-stack basis); extractor fixes probe-verified on p04/n01/p01 incl. an explicit leak check. Final numbers PENDING the re-run.
confidence: high
---

Collaborator: Jonah. 2026-07-24. The declared-stack construct fix was RIGHT and the numbers moved hard. Then the run exposed three further defects, all mine, all in the ground-truth extractor - none in the detector.

## Result of the declared-stack relabel (basis 1: flat declaration list)
```
OURS (shipping)      R=1.000 (4/4)  P=0.800  FP=1/19 (5.3%)    [TP4 FP1 FN0 TN18]
ORACLE generous-map  R=0.250 (1/4)  P=0.063  FP=15/19 (78.9%)  [TP1 FP15 FN3 TN4]
ORACLE strict-map    R=0.000 (0/4)  P=n/a    FP=0/19 (0.0%)    [TP0 FP0 FN4 TN19]
```
**The construct fix worked.** All SIX branded n0* fixtures flipped from wrongly-present to correctly-absent, and martinfowler with them. Codex's notes prove it now reasons about declared stacks: "Inter, SF Pro, Geist declared." (absent), "Only system and generic stacks requested." (present). Recall went 0.417 -> 1.000; we catch every Codex-positive. **Zero false positives across all 12 REAL shipped pages.** The oracle got WORSE under correct ground truth: generous-map precision 0.063 with 15/19 false fires; strict-map still detects nothing at all.

Gate still exit 4 on ONE false positive: `p04-webfont-declared-never-applied`.

## DEFECT 1 - extractor conflated @font-face DEFINITION with APPLICATION (cause of the lone FP)
p04's source: two `@font-face { font-family: "Brackish ..." }` blocks (which only DEFINE font resources), then `body { font-family: system-ui, sans-serif }` - the only rule that actually puts a font on content text, and it is a default stack. Our detector fires (share=100% default) and is CORRECT. My extractor flattened every `font-family:` occurrence into one list, so Codex saw the Brackish names and answered "Custom Brackish font families are requested." -> absent. The ground truth was wrong, not the detector.
FIX: report APPLIED rules (with their selectors) separately from `@font-face` DEFINED families, and state in the prompt that a defined face does not apply to any text unless an APPLIED rule names it. Probe-verified: p04 now shows APPLIED `body { font-family: system-ui, sans-serif }` vs DEFINED "Brackish Grotesk", "Brackish Mono"; n01 shows APPLIED `body { font-family: "Alluvium Sans", sans-serif }`; p01 shows none/none.

## DEFECT 2 - the extractor LEAKED the fixture author's answer (independence contamination)
p04's CSS carries a comment: "The brand face is loaded, then never referenced by any content selector - the commitment does not reach the copy. This is the ground-A case...". My extractor passed it straight into the labeling prompt, which would have had Codex reading the AUTHOR'S INTENT instead of judging independently - destroying the exact author!=labeler independence this gate exists to enforce, while producing a confidently "correct" label.
FIX: strip `/* ... */` from the CSS before extraction. Leak-check assertion added to the probe; p04 now returns CLEAN (no author hint). This is the most dangerous of the three - it would have produced a PASSING gate built on contaminated ground truth.

## DEFECT 3 - stale signal provenance
`dev-subjective-label.mjs` keeps its OWN duplicate VISUAL/TEXTUAL/MOTION map used only to stamp the recorded `signal` field. I updated the harness's map but not this one, so the declared-stack labels recorded `signal:"screenshot"` while the prompt correctly used TYPEFACE - the provenance misstated how the label was obtained.
FIX: added the TYPEFACE set there too, with a comment that the two maps must stay in lockstep.

## Hook false positive (Jonah ruled: rewrite + fix the hook)
`security_reminder_hook.py` blocked an edit containing a RegExp string-matching call, warning about child_process shell-execution injection. No shell call existed anywhere in the edit. Per the Hook Override Protocol I did NOT silently rephrase - asked Jonah, who chose: rewrite using `String.prototype.match` (semantically identical, unblocks now) AND spawn a durable hook fix. Task spawned. The real damage of this FP is that it trains people to bypass a security hook, so it gets ignored when it is right. NOTE: the same hook then blocked THIS BEAT for quoting the token while documenting the incident; per the CLAUDE.md beat mandate ("treat that as a configuration bug, do the write anyway and flag it") the beat was written with the literal token avoided, and the bug is flagged to Jonah.

## Status
Re-label of all 23 pages + A5a re-grade running (basis 2: applied-vs-defined, comment-stripped). Prior-basis labels preserved at `typeface-a5a-labels.screenshot-basis.json` and `typeface-a5a-labels.flat-declarations.json` so all three bases stay auditable. NO ship call yet; nothing tuned to force a pass - each change corrected a demonstrable defect in the ground-truth SIGNAL, never a threshold in the detector. **The detector has not been touched at any point in this A5a work.**

## Files touched
- sidecoach/eval/subjective-label-harness.mjs (applied-vs-defined split, CSS-comment stripping)
- sidecoach/eval/dev-subjective-label.mjs (TYPEFACE signal provenance)
- sidecoach/eval/corpus/typeface-a5a-labels.{screenshot-basis,flat-declarations}.json (preserved evidence)
