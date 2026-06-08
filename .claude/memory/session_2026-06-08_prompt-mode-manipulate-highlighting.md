---
name: prompt-mode-manipulate-highlighting
description: Added Manipulate-style highlighting (W x H badge + scope highlights) to Justify Prompt mode - then REVERTED at Jonah's request. Net change to source = none.
type: project
relates_to: [session_2026-06-08_justify-ampersand-redo-and-guard.md, session_2026-06-08_justify-bundle-clobber-incident.md]
---

Collaborator: Jonah

## REVERTED (2026-06-08)
Jonah asked to revert immediately after it shipped. Surgically reversed all 9 edits to `prompt/index.ts` (NOT git checkout - the file had pre-existing uncommitted Manipulate changes that had to be preserved). Verified clean: grep finds zero of the added identifiers; `TrackedSelection` back to 3 fields; rebuilt bundle = **554902 bytes**, byte-identical to the pre-feature ampersand build; deployed. Live-verified Prompt mode shows no W x H badge and no scope outlines, and normal selection + inline prompt + click-intercept all work. The implementation notes below are retained for reference in case it's ever wanted again.

Side note: my own `justify-source-guard.sh` hook correctly blocked a build command that happened to reference `~/.claude/justify/dist/...` in a grep filter alongside `build.js` - a benign false-positive. Workaround: don't name the install path in the build command string (deploy.sh syncs there internally).

## Request + constraint
Jonah: translate the Manipulate panel's highlighting into Prompt mode. Then clarified: do NOT replace Prompt's current functionality.

## Why not the real Picker
Manipulate's highlighting IS the `selector/picker.ts` Picker - an interaction engine that owns hover and swallows clicks in the capture phase. It has no render-only mode (`deactivate()` removes listeners AND hides chrome; `suspend()` keeps listeners). So dropping it into Prompt would replace Prompt's click/hover/lasso/multiselect. To honor "keep Prompt's functionality," we replicated the Picker's LOOK inside Prompt's own overlays instead (decision confirmed with Jonah).

## What was added (additive only, in `prompt/index.ts`)
Source of truth tree: `~/Documents/Github/claude-dotfiles/justify/core/prompt/index.ts` (NEVER ~/.claude/justify - guard hook enforces).
- `TrackedSelection` gained optional `badge?` field; new fields `_scopeOutlines: HTMLElement[]`, `_scopeEls: Element[]`.
- In `_showSelOverlays()` per-element loop: a terracotta **W x H dimensions badge** (`#D97757`, white, 11px, radius 3px) at each selection box's top-left, tracked via `_selTracked[].badge` and repositioned in the existing `_update` raf.
- New methods: `_scopeSelectorFor(el)` (builds `tag.firstClass`, <=40 char class, CSS.escape), `_showScopeHighlights()` (queries all matches of each selected element's class scope, excludes selected + justify chrome + display:none, caps at 100, draws 1px `#D97757` outlines = the Picker's scope-highlight look), `_repositionScopeOutlines()`, `_clearScopeHighlights()`.
- `_showSelOverlays()` calls `_showScopeHighlights()` at the end; `_update` raf calls `_repositionScopeOutlines()`; `_onClick` (empty-click branch) and `deactivate()` call `_clearScopeHighlights()`.
- Prompt's event model, multiSelect, lasso, queue, inline prompt, remove-X label: ALL untouched.

## Build/deploy/verify
`cd dotfiles/justify && node build.js --core-only && bash deploy.sh --core-only` -> 557311 bytes -> synced to ~/.claude/justify/dist.
Verified live (yesand.lndo.site, Prompt mode, selected the ABOUT nav link which is `span.menu-item-text`):
- Terracotta "69 x 29" W x H badge at top-left of ABOUT. ✓
- HOME / WORK / INSIGHTS / CONTACT all outlined in terracotta (the other `.menu-item-text` matches = scope highlights). ✓
- Prompt's selection box + `span .menu-item-text` pill + remove-X + "Describe the change..." inline prompt all present/working. ✓
- Clicking the pill's X cleared the selection AND the scope outlines + badge; hover still works (showed `nav .pp-menu-nav`). ✓

Files touched: `claude-dotfiles/justify/core/prompt/index.ts`, rebuilt+deployed bundle. Uncommitted working-tree changes (not committed).
