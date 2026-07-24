---
name: A5a construct fixed to DECLARED-STACK + new TYPEFACE labeling signal; re-label running
description: Resolved the construct mismatch that blocked 4a's A5a gate. The rubric now defines default-typeface by what the page REQUESTS (declared font stack), not what it paints, and the labeling harness gained a TYPEFACE signal that hands Codex the page's font-family declarations instead of a screenshot. Re-label + re-grade launched. Also confirms the spawned verify-candidates task landed green.
type: decision
relates_to: [session_2026-07-24_stage4a-a5a-RESULT-construct-mismatch.md, session_2026-07-23_stage4a-a5a-closure.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: dry-run proves the new basis is live (rubric SHA 61a6a246 -> bcd9c4bc17f3, 23 classes); buildPrompt probe shows n01 now surfaces `font-family: "Alluvium Sans"` + @font-face while p01 shows "no font-family declared anywhere". Real numbers PENDING (re-label in flight).
confidence: high
---

Collaborator: Jonah. 2026-07-24. Jonah ruled the construct: **DECLARED-STACK**. Implemented the fix and relaunched the gate.

## Why a wording change alone would have been useless
The 2026-07-24 A5a result failed because the DETECTOR scores the declared font stack while the LABELER scored a screenshot. Editing only the rubric prose would have re-run the identical mismatch, because `subjective-label-harness.mjs` decides what Codex actually SEES from its `VISUAL`/`TEXTUAL`/`MOTION` sets - and `default-typeface` sat in `VISUAL` (screenshot). The signal had to move with the definition. Four coordinated edits, not one.

## What changed
1. **Rubric definition** (`eval/corpus/subjective-rubric.md`) - default-typeface is now about what the page ASKS FOR: "the font stack it requests is only the browser/operating-system default (or a generic websafe family...)", with the disambiguating clause stated outright: *"a page that names a chosen family is ABSENT even if that font is unavailable and the text paints as a plain system face."*
2. **New TYPEFACE labeling signal** (rubric LABELING SIGNAL section) - default-typeface moved OUT of VISUAL into its own TYPEFACE category, with the reason recorded inline (hermetic render blocks webfonts, so screenshots systematically misread branded pages as default).
3. **Harness** (`eval/subjective-label-harness.mjs`) - added a `TYPEFACE` set; added `typefaceDeclarations(html)` which extracts every declared `font-family` from style blocks + inline style attrs plus an `@font-face present` marker; `buildPrompt` now tags the class `[TYPEFACE]`, carries a `FONT-FAMILY DECLARATIONS` section, and instructs the labeler explicitly NOT to use the screenshot for it; `recordLabels` now records `signal: 'typeface'`.
4. **Deliberately NOT applied**: no share threshold, no "which declaration wins" resolution, no selector logic in the extractor. Applying the shipping rule's 0.75 cutoff to the ground truth would make the label a COPY of the detector it is supposed to grade. The labeler is asked only "does the page ever ask for a chosen typeface for its content text".

## Verified before spending the pass
- Rubric SHA moved `61a6a246...` -> `bcd9c4bc17f3`; still 23 classes (signal moved, no class added/removed). Safe because verify does NOT read rubricSha (proven 2026-07-23).
- `buildPrompt` probe: `n01-branded-body` -> `font-family: "Alluvium Sans"` + `@font-face present`; `p01-unstyled` -> "(no font-family declared anywhere...)"; `p03-websafe-monoculture` -> Arial/Georgia/Courier only. Exactly the discriminating signal the screenshot could not provide.
- Old screenshot-basis labels preserved at `eval/corpus/typeface-a5a-labels.screenshot-basis.json` as evidence of the first pass (not deleted).

## Operational lesson folded in
The previous labeling pass stalled because the a5a-label TEAMMATE spawned it as ITS OWN background child, then ended its turn and the child was orphaned - it had actually completed 23/23 but nobody ran the grader. This re-run is launched as a background task from the LEAD session, which the harness tracks and which re-invokes me on completion. Bounded exec (240000ms/page) also guards against a wedged `codex exec`.

## Also confirmed this turn
The spawned **verify-candidates task landed GREEN**: `corpus-tool verify-candidates` now exits 0 ("provenance complete, subjective author!=labeler (codex), bijection + canonical-record freeze intact"), and it modified `corpus-tool.mjs`, `corpus-tool.test.mjs`, and `scripts/run-tests.ts` - so the previously-ungated check is now wired into the suite as tasked. Uncommitted.

## Status
Re-label (11 fixtures + 12 real negatives) + A5a re-grade running in background. NUMBERS NOT IN - no ship call yet, and nothing has been tuned to make the gate pass. The prior result stands until replaced by real output.

## Files touched
- sidecoach/eval/corpus/subjective-rubric.md (definition + LABELING SIGNAL)
- sidecoach/eval/subjective-label-harness.mjs (TYPEFACE set, typefaceDeclarations, buildPrompt, recordLabels)
- sidecoach/eval/corpus/typeface-a5a-labels.screenshot-basis.json (NEW - preserved evidence)
