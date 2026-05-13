---
name: Improv hints/tooltip clip-path fix
description: Fixed toolbar hints not showing because clip-path was clipping the tooltip positioned above the toolbar
type: project
relates_to: [session_2026-05-12_improv-pipeline-fix.md]
---

Toolbar hints (tooltip showing button names on hover) were invisible because the toolbar's collapse/expand mechanism used `clip-path: inset(0 round 22px)` which clipped all content to the toolbar's rectangle. The tooltip is positioned above the toolbar via `bottom: calc(100% + 8px)` and was being clipped.

**Root cause:** The collapse animation uses `clip-path: inset(0 0 0 calc(100% - 44px) round 22px)` to show only the close button. When expanded, it set `clip-path: inset(0 round 22px)` which showed the full toolbar width but still clipped overflow above/below - exactly where the tooltip renders.

**Fix:** Moved `_tt` tooltip from child of `this.el` (clipped by clip-path) to sibling in the shadow root, appended AFTER `this.el` so it renders on top. Changed from `position: absolute` (relative to toolbar) to `position: fixed` (viewport-relative). Hover handler now calculates position using `getBoundingClientRect()` on the hovered button. Clip-path animation preserved intact.

**Also in this session:**
- Screen glow: removed `data-improv` attribute (was causing `[data-improv] { pointer-events: auto !important }` freeze sheet to make the full-viewport glow capture all mouse events, breaking prompt/manipulate tools)
- Screen glow pulse: changed from opacity animation to `filter: brightness()` animation so opacity is free for the 1.2s fade in/out transition
- Screen glow hide: simplified back to just `opacity: 0` (transition handles the fade)

**Collapsed toolbar: clip-path replaced with width-based collapse:**
- `clip-path` cannot show border/shadow (clips the border-box). Replaced entirely with `width: 44px` + `overflow: hidden` + `border-radius: 22px` (already on the element) = perfect circle.
- Close button gets `position: absolute; right: 6px; top: 6px` when collapsed so it stays visible at the right edge. Reset to `position: static` on expand.
- Transition changed from `clip-path 0.3s` to `width 0.3s` for the expand/collapse animation.
- Non-close children use `display:none` when collapsed (not `opacity:0` which was overridden by animation fill mode, causing icon overlap). Expand resets `display:""` before opacity transition.
- Verified via Chrome MCP zoom: clean circle showing only the "I" icon, no overlapping elements, border and shadow fully visible.

**Queuebar tooltips added:**
- Created `_apTip` tooltip element (fixed position, appended to overlay container after action pill)
- Added `_showApTip(text, btn)` and `_hideApTip()` methods to prompt mode class
- Wired into mouseenter/mouseleave on all three action pill buttons: Queue, Send All, Clear All
- Respects `_showHints` setting

**Files touched:**
- improv/dist/improv-core.js
- ~/.claude/improv/dist/improv-core.js
