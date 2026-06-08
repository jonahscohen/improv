---
name: prompt-scroll-jam-fix
description: Fixed Justify Prompt mode jamming the selection label + inline input against the top of the viewport when the selected element scrolls out of view.
type: project
relates_to: [session_2026-06-08_prompt-mode-manipulate-highlighting.md]
---

Collaborator: Jonah

## Bug
In Prompt mode, scrolling the selected element above the viewport jammed the selection label pill AND the "Describe the change..." inline input against the top edge (they stayed fully visible / pinned) instead of scrolling away with the element. Pre-existing behavior (not from the reverted highlighting work). Reported with a screenshot.

## Root cause (two separate floors/clamps in the `_update` raf reposition loop, `prompt/index.ts`)
1. Inline input: `var _mb = 0` (max element-bottom) was floored at 0, so when the element's real bottom went negative (scrolled above viewport) the input pinned to `_mb + 12 = 12px`. The selection BOX (line ~820 `tr.box.style.top = rect.top`) had no such floor and scrolled away correctly - that was the tell.
2. Label pill: explicit clamp `if (_lbY < 4) _lbY = 4;` + `if (_lbY + 24 > innerHeight) _lbY = innerHeight - 28;` pinned the label to the top/bottom edge.

## Fix (make label + input behave like the box: track true position, scroll off)
- `_update`: `var _mb = 0` -> `var _mb = -Infinity` (input follows real bottom, off-screen when negative); removed the two `_lbY` clamps; `_botBot = 0` -> `-Infinity` (bottom-most element found even off-screen, for horizontal centering).
- `_boundScroll` (scroll handler): `var _mb2 = 0` -> `var _mb2 = -Infinity` for consistency (avoids a 1-frame flicker before the raf corrects).

## Build/deploy/verify
Dotfiles source (`claude-dotfiles/justify/core/prompt/index.ts`), `node build.js --core-only` + `bash deploy.sh --core-only`. Verified live (yesand.lndo.site): selected HOME, scrolled down -> input + label scrolled off the top with the element (top clean, no jam); scrolled back up -> box + `span .menu-item-text` pill + input re-anchored correctly to HOME. Round-trip clean.

Files touched: `claude-dotfiles/justify/core/prompt/index.ts` (4 edits), rebuilt+deployed bundle. Uncommitted working-tree changes.
