---
name: Changes panel polish - clear dismiss, numbered circles, task highlights
description: Three fixes to improv changes panel - clear hides panel+button, numbered circles replace dots, element highlighting on task selection
type: project
relates_to: [session_2026-05-13_improv-changes-panel.md, session_2026-05-13_improv-claude-button-restyle.md]
---

Jonah requested three changes to the improv changes panel:

## Task 1: Clear dismisses button + panel
- In `changes-panel.ts`: when "Clear Completed Tasks" is clicked and no filteredEntries remain, call `this.hide()` to slide-fade the panel away
- In `index.ts`: the `setOnClearReviewed` callback now checks if `_changeHistory.length === 0` after filtering, and if so removes `_claudeBtn` from DOM and sets it to null

## Task 2: Numbered circles instead of green dots
- In `changes-panel.ts` `render()`: replaced the 8x8 green dot with a 20x20 circle, background `#D97757`, containing a bold white number span (1-based index from filteredEntries)
- Removed the `margin-top:4px` the old dot had
- Uses `font-variant-numeric:tabular-nums` for consistent width

## Task 3: Element highlighting on task selection
- Added `onSelectCallback` private property and `setOnSelect()` setter to `ChangesPanel`
- Click handler on entries now extracts unique selectors from `entry.changes` and calls the callback
- `hide()` calls `onSelectCallback([])` to clear highlights
- In `index.ts`: added `_taskHighlights: HTMLElement[]` array
- Wired `setOnSelect` callback that creates fixed-position highlight divs with `border:2px solid #D97757`, `border-radius:4px`, positioned via `getBoundingClientRect()`
- Each highlight gets a small tooltip label showing the selector text, styled with `#D97757` background, white monospace text
- All highlight elements have `data-improv` attribute so improv tools skip them
- When selectors is empty, all stored highlights are removed from DOM and array cleared

## Files touched
- `core/changes-panel.ts` - all three tasks
- `core/index.ts` - tasks 1 and 3
- `dist/improv-core.js` - rebuilt with `node build.js --core-only`
- `~/.claude/improv/dist/improv-core.js` - deployed copy
