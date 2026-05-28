---
name: Property panel complete port from dist
description: Full rewrite of property-panel.ts to match dist class Le (lines 2565-4630) character-for-character
type: project
relates_to: [session_2026-05-04_improv-manipulate-reference-tool.md, session_2026-05-04_reference-tool-panel-rewrite.md]
---

## Task
Port the complete `Le` class from improv-formatted.js (lines 2565-4630) to property-panel.ts.
The source file was 733 lines but the dist class spans ~2065 lines of beautified JS.

## Key Findings
- The dist theme `jn` uses `color-mix` values; the source `darkTheme` had slightly different values
- Icon function name mapping confirmed by path data comparison (e.g., `mt`=`radiusTopLeft`, `ne`=`chevronDown`, etc.)
- The dist `makeSectionHeader` method includes a plus (+) button with hover show/hide behavior for addable sections
- All design sections present: Position, Layout, Spacing, Size, Typography, Appearance, Fill, Border, Shadow, Filters
- Alignment grid uses `iconPositionLeft`/`iconPositionCenterH`/`iconPositionRight` with `iconDot` for inactive cells

## Changes Made
- Complete rewrite of property-panel.ts to match dist 1:1
- Updated `darkTheme` to use the dist's `color-mix` based theme values
- Preserved all method signatures, event handlers, style objects, and pixel values from dist
- Source went from 733 lines to 2,840 lines (dist class `Le` spans ~2,065 lines of beautified JS)
- makeSectionHeader now includes the plus (+) button with hover show/hide from dist

## Files Touched
- improv/core/manipulate/property-panel.ts (complete rewrite)

Collaborator: Jonah
