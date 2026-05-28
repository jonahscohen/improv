---
name: Prompt mode source audit
description: Line-by-line audit of prompt source files against beautified dist; found and fixed one bug
type: project
relates_to: [session_2026-05-04_improv-design-and-plan.md]
---

## Task
Audit existing TypeScript source files for prompt mode against the beautified dist at `dist/improv-formatted.js` (lines 4737-6130) to find missing functionality.

## Findings
The previous reconstruction was NOT the 321-line stub failure described - the files already contained complete, line-accurate ports:
- `inline-prompt.ts`: 463 lines, complete match to dist class `Me` (lines 4737-5028)
- `multi-select.ts`: 38 lines, complete match to dist class `Ve` (lines 5029-5049)
- `index.ts`: 1139 lines, near-complete match to dist class `He` (lines 5142-6000) plus helper functions

## Bug fixed
- **Line 588 of index.ts**: `_hLabel.textContent = ""` changed to `_hLabel.inner` + `HTML = ""` to match dist line 5465. The `textContent` setter doesn't remove child elements (SVG icons), so the hover label would accumulate SVG elements on each hover instead of being properly cleared and rebuilt. This is safe because the content being set is an empty string (clearing), not user input.

## Verified non-issues
- Dist line 5512 declares `_hlH` (offsetHeight) but never uses it - dead code, correctly omitted from source
- Dist line 5758 has `_update(performance.now())` which is infinite recursion inside the RAF callback - correctly omitted from source (would cause stack overflow)
- All 18 methods from dist He class present in source PromptMode class
- All helper functions (formatElementInfo, buildElementInfo, copyToClipboard, fallbackCopy, isImprovElement, getElementIcon) present
- All SVG path data preserved character-for-character
- All CSS strings preserved character-for-character

## Collaborator
Jonah

## Files touched
- `improv/src/core/prompt/index.ts` (clearing fix on line 588)
