---
name: tilt-lab styled tooltips on icon-only buttons
description: Replaced native title tooltips with an on-brand Tooltip component (portal, viewport clamp, mouse-hover + keyboard-focus triggers) on all icon-only buttons - layer-card actions, top-bar actions, App shell controls. Teammate "tooltips", verified in Chrome via focus path.
type: project
relates_to: [session_2026-05-30_tilt-lab-header-and-dnd.md, session_2026-05-30_tilt-lab-layer-cards.md]
superseded_by: session_2026-05-30_tilt-lab-tooltips-justify.md
---

Collaborator: Jonah. 2026-05-30. Task 3 of one-teammate-per-task. Jonah: "You forget my tooltips?" - icon-only buttons relied on weak native title (or had none on shell controls).

## Done (Tooltip.tsx + Tooltip.css + Tooltip.test.tsx new; IconButton.tsx, TopBar.tsx, App.tsx)
- Tooltip component: <Tooltip label placement="bottom|top|left"><trigger/></Tooltip>. Wraps trigger in inline-flex span; renders the tip into document.body via portal (position:fixed) so panel overflow never clips. Measures trigger getBoundingClientRect in useLayoutEffect, clamps left/top to [8px, viewport-size-8px] so far-right (Copy config) never clips. Hides on leave/blur/Escape/scroll/resize.
- Triggers: HOVER via onMouseEnter/Leave (400ms delay) + FOCUS via onFocusCapture (immediate) gated by a document-level input-modality tracker (keydown arms, pointerdown disarms; default armed) - the testable stand-in for :focus-visible. (Originally onPointerEnter; CD had it switched to onMouseEnter - mouseenter is the conventional tooltip trigger and fires for real mice; pointer events also weren't fired by the test harness.)
- Styling: flat per system - --surface-2 fill, 1px --line-2 border, --r-sm, 0.74rem --font-sans --text, no shadow. Tokens only. Reduced-motion: instant.
- a11y: trigger keeps aria-label (accessible name); tooltip aria-hidden (no doubled SR read).
- Applied: IconButton (removed title) -> all layer-card actions (up/down/eye/trash) auto-covered; TopBar add/download/copy (title removed, disabled export keeps explanatory reason via the wrapper-span hover); App shell rail-collapse + fullscreen (left collapse button's absolute positioning moved to a wrapper div so the measuring span isn't zero-sized).

## Verified (Chrome, tab 41): focused Add shader (search -> Shift+Tab) -> styled "Add shader" tooltip renders below the button, on-brand, accent focus ring. tsc 0, 166 tests (npm test - NOT bare `npx vitest run`, which misses the jsdom env from vite.config). 

## Harness note: chrome MCP `hover` updates CSS :hover but does NOT dispatch JS mouse/pointer events, so hover tooltips can't be triggered via synthetic hover - verify the VISUAL via the focus path (focus a sibling input, Shift+Tab onto the target; a keypress arms keyboard mode so the tooltip shows on focus). Hover behavior covered by unit tests (fireEvent.mouseEnter).
