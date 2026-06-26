---
name: buzzword-v2-fold2-visibility-p0
description: Re-Codex on the v2 fold caught a P0 - the extracted inPageBuzzword uses a WEAKER visuallyVisible than inPageSubjective (dropped the sr-only clip / text-indent / 1px-overflow / clipPath exclusions), so hidden/screen-reader buzzword text skews density+word counts. Caught before the frozen-90 measure. Routed to buzzword.
type: project
relates_to: [session_2026-06-25_buzzword-v2-fold-verified.md, session_2026-06-25_buzzword-v2-codex-harness-divergence.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25).

## RE-CODEX P0 (verified against the code)
The fold extracted inPageBuzzword out of inPageSubjective with a DUPLICATED but WEAKER visuallyVisible (subjective-rendered-scanner.ts:218-228): it has visibility/opacity/getClientRects/box>=1px/box-right-bottom, but DROPPED inPageSubjective's hardened exclusions (lines 55-70): the 1px-overflow `(w<=1||h<=1)&&overflow!=visible`, `textIndent<=-999`, the sr-only `clip: rect(...)` parse, and `clipPath: inset(100%/50%)`. => inPageBuzzword counts sr-only / clipped / off-screen text toward both the buzzword weight (numerator) AND the word count (denominator). On real frozen-90 pages with a11y sr-only text, density is wrong = potential FP/FN. A genuine correctness P0.
- (Note: inPageBuzzword also lacks inPageSubjective's paintedInvisible transparent-fill check - fold that too for parity, since transparent/invisible text shouldn't count.)

## WHY GOOD PROCESS (again)
3rd Codex pass on the buzzword detector (v2 review found harness-divergence + MILD; this re-Codex found the visibility regression). Each caught a REAL bug. The frozen-90 is STILL untouched - the gate is doing its job before the irreversible last shot. Iteration count on the buzzword detector: v1, v2, fold1, fold2 (~4-5) - NOT near the 10-version Codex-handoff threshold yet, so buzzword keeps the implementation.

## ROUTED TO BUZZWORD
Replace inPageBuzzword's visuallyVisible (218-228) with inPageSubjective's FULL hardened predicate (55-70) - copy it verbatim (each in-page fn must be self-contained for page.evaluate, so a duplicate identical copy is correct; a future refactor can string-inject a shared helper). Add the paintedInvisible transparent-fill exclusion for parity. Re-calibrate (dev may shift slightly if dev pages have hidden text), build+test green, hand back. Then lead: re-Codex (3rd) + ONE frozen-90 measure.

## Files touched
- (P0 finding beat; fix in flight by buzzword)
</content>
