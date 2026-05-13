---
name: Improv toolbar collapse/expand rewrite
description: Replaced clip-path with width transition; simplified to opacity+pointerEvents only; animation fill-mode was blocking all transitions
type: project
relates_to: [session_2026-05-12_improv-hints-fix.md, session_2026-05-12_improv-pipeline-fix.md]
---

Rewrote the toolbar collapse/expand mechanism. Multiple failed approaches before landing on the simple solution.

**Root cause of non-animating transitions:** The toolbar's entry animation `improv-pill-in` with `fill-mode: both/forwards` permanently locks the element's computed styles to the animation's final keyframe, blocking ALL CSS transitions. Fixed by adding `animationend` listener that sets `animation: none`.

**Final approach (simple):**
- `width` transitions between `44px` (collapsed) and `157px` (expanded)
- Non-close children: `opacity: 0/1` + `pointer-events: none/all` + `transition: opacity` - nothing else
- Close button: always in normal flow, `z-index: 1` so it renders above siblings during width transition
- No `position: absolute`, no `visibility: hidden`, no `width: 0` on children, no `max-width`, no `clip-path`
- Badge element removed from DOM (blue number section)
- `overflow: hidden` on toolbar clips children during width transition

**Failed approaches this session (do not repeat):**
1. `clip-path: inset()` - clips border and box-shadow, can't show a proper circle
2. `max-width` transition - `max-width` doesn't actively size an element, only constrains it
3. Dynamic `scrollWidth` measurement - unreliable when children are transitioning
4. `display: none` on children - removes from flow, breaks width calculation
5. `visibility: hidden + width: 0` on children - collapses toolbar below target width

**Source reconstruction completed.** Build pipeline restored. All changes now go through TypeScript source.

**Close button fixes:**
- `box-sizing: border-box` + `padding: 6px` symmetric (was `6px 40px 6px 6px`)
- `top: 50%; transform: translateY(-50%)` for vertical centering (was `top: 6px`)
- `right: 5px` for horizontal positioning
- `outline: none` to remove focus ring
- mousedown/mouseup transforms include `translateY(-50%)` to preserve centering

**Current status (unresolved):**
- Collapsed circle with "I" icon works correctly
- Width transition 44px -> 157px is set but does not visually animate (animation fill-mode cleared but computed styles still locked)
- Children opacity on expand stays at 0 despite inline opacity="1"
- Chrome MCP clicks cannot penetrate shadow DOM for coordinate-based testing
- This needs a proper dev environment with source files and browser devtools, not blind dist patching

**Lesson:** Stop patching minified dist. Reconstruct source files and use the build pipeline. Every fix in this session took 3-5 attempts because there's no way to inspect, debug, or set breakpoints on a 215KB minified file.

**Files touched:**
- improv/dist/improv-core.js
- ~/.claude/improv/dist/improv-core.js
