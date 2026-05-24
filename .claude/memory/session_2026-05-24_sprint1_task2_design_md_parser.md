---
name: Sprint 1 Task 2 - design-md-parser (in progress)
description: TDD implementation of DESIGN.md frontmatter parser for sidecoach Sprint 1
type: project
relates_to: [session_2026-05-24_sprint1_plan_approved.md]
---

# Sprint 1 Task 2: design-md-parser

Collaborator: Jonah

## Status: COMPLETE

## What happened

TDD cycle completed in full:

1. Test written at `sidecoach/src/__tests__/design-md-parser.test.ts` - 6 assertions against real DESIGN.md fixture (colors.brand.red, colors.brand.ink, typography.display.family, rounded.sm, motion.ease.out, bodyLineNumbers.bodyStart type)
2. Test ran and failed with `Cannot find module '../design-md-parser'` - confirmed before implementing
3. Parser implemented at `sidecoach/src/design-md-parser.ts` - uses js-yaml to parse YAML frontmatter between --- delimiters; returns typed DesignTokens struct; also exports findTokenLine() helper for dotted path -> line number lookup
4. Test ran and passed: `design-md-parser test PASS` exit 0
5. `npm run build` - zero TypeScript errors
6. Committed as `feat(sidecoach): parse DESIGN.md frontmatter via js-yaml` - only the two src files staged

## Key details

- FRONTMATTER_RE regex handles both LF and CRLF line endings
- bodyLineNumbers tracks frontmatterStart/End/bodyStart as line numbers (1-indexed) for future citation use in Task 6
- findTokenLine() finds last key segment of a dotted path (e.g. "motion.ease.out" -> searches for "out:") - good enough for DESIGN.md's flat-ish structure
- Fixture: `/Users/spare3/Documents/Github/claude-dotfiles/reference/DESIGN.md`

## Files touched

- `sidecoach/src/__tests__/design-md-parser.test.ts` (created)
- `sidecoach/src/design-md-parser.ts` (created)
