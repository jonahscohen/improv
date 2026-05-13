---
name: Improv detail view wiring in index.ts
description: Wired setOnItemClick for detail view, removed setOnPreviewToggle callback
type: project
---

Collaborator: Jonah

## Changes

- Removed `setOnPreviewToggle` callback from `activate()` in `improv/core/index.ts` (Preview button removed from panel)
- Added `setOnItemClick` callback after `setOnSelect` - filters change history to completed-with-changes or needsInfo entries, calls `showDetail()` on the panel with the matching entry
- Verified `setOnSelect` callback remains intact and unmodified
- Built with `node build.js --core-only` and deployed to `~/.claude/improv/dist/improv-core.js`

## Files touched
- `/Users/spare3/Documents/Github/claude-dotfiles/improv/core/index.ts`
- `/Users/spare3/Documents/Github/claude-dotfiles/improv/dist/improv-core.js` (built output)
- `~/.claude/improv/dist/improv-core.js` (deployed copy)
