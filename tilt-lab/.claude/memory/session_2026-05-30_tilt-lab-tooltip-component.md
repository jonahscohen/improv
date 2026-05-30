---
name: tilt-lab styled Tooltip - replaces native `title` on all icon-only buttons
description: New Tooltip component (portal, hover-delay + focus-visible, viewport clamp); applied to IconButton, TopBar, App shell controls; native title removed
type: project
relates_to: [session_2026-05-30_tilt-lab-layer-cards-eye-collapse.md, session_2026-05-30_tilt-lab-header-and-dnd.md]
---

Collaborator: Jonah

Built an on-brand Tooltip to replace the slow, OS-styled native `title` on every
icon-only button, and wired the App shell controls (which had no tooltip at all).

## What changed
- NEW app/src/components/Tooltip.tsx + Tooltip.css. Wrapper-span API:
  `<Tooltip label="..." placement="bottom|top|left"><button .../></Tooltip>`.
- IconButton.tsx: removed `title={label}`, now wraps its button in `<Tooltip>`;
  kept `aria-label`. Added optional `tooltipPlacement` prop. All layer-card
  actions (move up/down, eye, trash) get the styled tooltip automatically.
- TopBar.tsx: Add shader / Download config / Copy config wrapped in `<Tooltip>`,
  `title` removed, `aria-label` kept. Disabled export buttons pass the
  explanatory reason ("Add a layer to the stack to export") as the tooltip label
  when `!canExport`, else the richer action description.
- App.tsx: rail-collapse buttons + fullscreen toggle wrapped in `<Tooltip>`
  reusing their aria-label text. Left collapse button was refactored: its
  `position:absolute` moved off the button onto a new wrapper `<div>` so the
  Tooltip trigger span measures the button at its real on-screen position.

## Key technical decisions
- Show timing. Hover opens after a 400ms delay (default, configurable via
  `delay`); keyboard focus opens immediately. Why: native title is ~1s and
  feels dead; 400ms is responsive without firing on pass-through. How: a
  setTimeout on mouseenter, immediate setOpen on focus.
- Hover uses mouseenter/mouseleave, NOT pointerenter/pointerleave. Why (revision
  after team-lead Chrome verify): the button's :hover CSS fired but the tooltip
  never appeared - automated/synthetic mouse input and some input paths emit
  mouse events but never pointer events, so onPointerEnter never fired.
  mouseenter is the conventional tooltip trigger and fires reliably for real
  mice and in automated browser testing. (The pointerdown modality tracker on
  document is unrelated and stays.)
- focus-visible without the pseudo-class. Module-level input-modality tracker:
  document keydown arms keyboard mode, pointerdown disarms it; focus only opens
  the tooltip when armed. Why: jsdom/happy-dom support for `:focus-visible` in
  `.matches()` is unreliable, and we must not show a tooltip on the focus a
  mouse click leaves on a button. Default armed = programmatic/test focus is
  treated as keyboard (accessible default + testable).
- Portal + fixed positioning. Tooltip renders into document.body via
  createPortal, position:fixed, measured from the trigger's
  getBoundingClientRect in a useLayoutEffect. Why: panels use overflow auto/
  hidden and would clip an in-flow tooltip.
- Edge collision. Computed left/top are clamped to [MARGIN, viewport - size -
  MARGIN] (MARGIN 8px, GAP 6px). Why: the far-right Copy config button's
  centered-below tooltip would otherwise clip the right edge. Bottom placement +
  clamp is used everywhere; it stays on-screen without per-button tuning.
- Disabled-button tooltip. A disabled `<button>` swallows pointer events, so the
  hover listeners live on the Tooltip's wrapper span (not the button) - the
  disabled-reason tooltip still appears on hover. (Focus path is N/A: disabled
  buttons aren't focusable, acceptable.)
- a11y. Trigger keeps its aria-label as the accessible name; the visual tooltip
  is `aria-hidden="true"` so there is no doubled SR announcement.
- Motion. Flat per the system (solid --surface-2 fill + 1px --line-2 border, no
  shadow). 0.12s opacity+1px-translate entrance gated behind
  `prefers-reduced-motion: no-preference`; reduced motion = instant show/hide.
  Tokens only, no hardcoded hex.
- Repositions: closes on scroll/resize (capture) rather than chasing a moved
  trigger.

## Verify
- `npx tsc --noEmit` -> 0 errors.
- `npx vitest run` -> 166/166 pass (43 files). Added Tooltip.test.tsx (5 tests:
  hidden by default, shows on focus, aria-hidden + aria-label intact, hover-
  after-delay + hide-on-leave with fake timers, hide-on-Escape). IconButton's
  existing 4 tests still pass (none asserted on `title`).
- Did NOT run dev server / screenshot - team-lead verifies in Claude-in-Chrome.

## Files touched
- app/src/components/Tooltip.tsx (new)
- app/src/components/Tooltip.css (new)
- app/src/components/Tooltip.test.tsx (new)
- app/src/components/IconButton.tsx
- app/src/components/TopBar.tsx
- app/src/App.tsx
