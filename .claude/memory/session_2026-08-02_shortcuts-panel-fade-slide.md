---
name: The keyboard-shortcuts panel now fades and slides open/closed instead of snapping
description: Direct order - "fade slide the shortcuts panel when open/close." Replaced the instant [hidden] toggle with a plain CSS transition (opacity + translateY together, no keyframes, no fill-mode), matching the same slide+fade treatment already applied to tree navigation earlier this session.
type: project
relates_to: [session_2026-08-02_keyboard-shortcuts-panel.md, session_2026-08-02_tree-nav-slide-plus-fade.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations/36 passes; test-component-browser.sh 147/0; confirmed live via a temporarily exaggerated transition duration (180ms -> 1400ms, reverted before shipping) that both open and close show genuine intermediate opacity frames, proving the transition runs and the transform slides in lockstep (both declared in one `transition` shorthand)
confidence: high
---

# Instant toggle to fade+slide (2026-08-02)

Jonah: "fade slide the shortcuts panel when open/close."

## What changed

The panel used to show/hide purely via the `hidden` attribute - an instant, un-animated
cut. Replaced with a plain CSS `transition` (not `@keyframes`) on `opacity` and
`transform` together:

```css
.shortcuts__panel{
  opacity:0; transform:translateY(8px); pointer-events:none;
  transition:opacity 180ms var(--ease), transform 180ms var(--ease);
}
.shortcuts__panel.is-open{opacity:1; transform:none; pointer-events:auto;}
```

A transition (rather than a keyframe animation) was the deliberate choice here: it always
interpolates between two real, persistent states, so there is no fill-mode to configure
and no way to reintroduce the stuck-invisible bug class from earlier this session -
whatever state the panel is actually in IS what renders, mid-transition or not.

`setShortcutsOpen()` now drives it the same way `hideLoader()` already does elsewhere in
this file: on open, clear `hidden` first, force a reflow (`void
shortcutsPanel.offsetWidth`) so the browser paints the closed state before `.is-open` is
added - otherwise both changes land in the same frame and there is nothing to transition
FROM - then add the class. On close, remove the class immediately (starting the
fade-out) and set `hidden = true` on a timer matching the CSS duration, not
`transitionend`, for the same robustness reason as the loader: a dropped event would
leave the panel invisible but still exposed to focus and screen readers forever.

Slides upward (`translateY(8px)` to `0`) as it fades in, matching the direction it
already opens in (`bottom:100%`, rising above the trigger) - the same "rise and fade"
pairing already established for tree navigation.

## Files touched

- `claude/installer-gui/styles.css` (`.shortcuts__panel` closed-state values + transition,
  `.is-open` modifier)
- `claude/installer-gui/index.html` (`setShortcutsOpen()` rewritten to drive the class +
  timed `hidden` toggle instead of setting `hidden` directly)
