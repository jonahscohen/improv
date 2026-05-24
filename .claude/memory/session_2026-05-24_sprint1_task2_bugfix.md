---
name: Sprint1-T2 bugfix - design-md-parser correctness fixes
description: Fixed two correctness bugs in design-md-parser.ts flagged by code review of commit 4246aa4
type: project
relates_to: [session_2026-05-24_sprint1_task2_design_md_parser.md, session_2026-05-24_sprint1_execution.md]
---

## What was fixed

### Bug 1: bodyLineNumbers math off-by-N
- Old formula: `frontmatterEnd = frontmatterStart + yamlText.split('\n').length - 1`
- This counted only YAML content lines, not the opening and closing `---` markers
- New formula: `frontmatterEnd = frontmatterStart + yamlText.split('\n').length + 1`
- For `---\ncolors:\n  red: "#FF0000"\n---\n\nLine 6`: now correctly produces frontmatterStart=1, frontmatterEnd=4, bodyStart=5

### Bug 2: findTokenLine leaf-only match caused collisions
- Old code used only `dottedPath.split('.').pop()` (the last segment) and scanned for any matching line
- `findTokenLine(yaml, 'colors.brand.red')` and `findTokenLine(yaml, 'colors.text.red')` both returned the first `red:` line
- New implementation traverses the full dotted path with indent tracking (2-space steps)
- Descends only when indent matches expected depth; exits early if indent recedes past parent

## Files touched
- `sidecoach/src/design-md-parser.ts` - both bug fixes applied
- `sidecoach/src/__tests__/design-md-parser.test.ts` - regression tests appended

## Regression tests added
- `design-md-parser.test.ts`: import updated to include `findTokenLine`
- Appended bodyLineNumbers regression: synthetic 6-line DESIGN.md, asserts frontmatterStart=1, frontmatterEnd=4, bodyStart=5
- Appended findTokenLine collision regression: nested YAML with two `red:` keys under different parents; asserts brand.red=line 4, text.red=line 6
- Both original and regression suites print PASS; build exits 0

## Status
COMPLETE. Both fixes verified by test run and TypeScript build. Ready to commit.
