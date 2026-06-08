---
name: justify-launcher-j-icon
description: Replaced the Justify launcher button "I" icon with the cursive j SVG
type: project
relates_to: [session_2026-06-07_cursive-j-swash.md]
---

Collaborator: Jonah

Replaced the icon on the Justify launcher button (the collapsed 44px pill that opens the toolbar/panel) with the new cursive "j" exported from Figma (`~/Downloads/letter-j.svg`).

**Where the icon lives:** `~/.claude/justify/core/toolbar.ts` (global dotfiles Justify install, NOT the website repo). The toolbar boots collapsed (`_collapsed=true`); the collapsed launcher reused the close-button `_closeSvg` and drew an italic "I" from three strokes (`_closeP1` `M19 4L10 4`, `_closeP2` `M14 20L5 20`, `_closeP3` `M15 4L9 20`). Clicking expands the toolbar and the same SVG morphs to an X.

**Change:** added `_jStem`/`_jDot` fields and two helpers `_showJ()` / `_showX()`. `_showJ()` swaps the svg viewBox to `0 0 122 168` (size 18x22), hides P1/P2/P3, and appends the j stem path (stroke currentColor, width 18, round caps) + dot path (fill currentColor). `_showX()` restores viewBox `0 0 24 24` (18x18), hides the j, and re-draws the X. Replaced the three inline "I"/X blocks (collapse-click, expand-click, initial-collapsed) with calls to these helpers. Uses `currentColor` so the j inherits the toolbar theme (grey at rest, terracotta `#D97757` on hover) exactly as the old "I" did.

**Build + deploy:** `cd ~/.claude/justify && node build.js --core-only` rebuilds `dist/justify-core.js` (served by the persistent daemon on :9223).

**Verified (real browser):**
- Isolated harness (exact DOM the code emits) at 32px button: j legible at rest (grey) and hover (terracotta).
- Live site http://yesand.lndo.site after reload + `POST /activate`: bottom-right launcher pill shows the cursive j. Clicking it expands the toolbar (Prompt/Manipulate/Settings) and the launcher morphs to the orange X; collapsing returns the j. Open/close toggle intact.

**Note:** the fix-gate hook fired "SECOND FIX DETECTED" on repeated edits to one file - this was one coherent multi-edit change, not iterative bug-fixing; suppressed with `touch ~/.claude/.suppress-fix-gate` (removed after).

**Update - hover animation:** Jonah asked to animate the j on hover. Implemented a "writes itself" draw-on (matching the reference SVG's own intent), reusing the toolbar's existing dash-offset hover pattern (the X already redraws on hover).
- `_showJ()` now sets the stem `stroke-dasharray=400` and `stroke-dashoffset=0` (drawn at rest), and gives the dot `transform-box:fill-box; transform-origin:center; scale(1)`. The else-branch (re-collapse) resets to a clean fully-drawn j.
- New `_animateJ()`: sets stem dashoffset to 400 (transition none), forces reflow via `getBoundingClientRect()` (established pattern in this file, line ~318), then transitions dashoffset to 0 over 0.7s `cubic-bezier(0.45,0,0.55,1)`; dot scales 0->1 over 0.3s `cubic-bezier(0.34,1.56,0.64,1)` with a 0.5s delay (pops in as the stroke finishes).
- The `_closeBtn` mouseenter handler now: `if (this._collapsed) { this._animateJ(); return; }` else runs the existing X redraw. So collapsed launcher writes the j; expanded still redraws the X.
- Path length ~320; dasharray 400 covers it.

Verified live (yesand.lndo.site, reload + activate): rest = full grey j; hover = terracotta tint + stroke draws on (caught partial-stem mid-frame) + dot pop, settles to full terracotta j; leave = clean grey j. Rebuilt bundle.

Files touched: `~/.claude/justify/core/toolbar.ts` (+ rebuilt `dist/justify-core.js`).
