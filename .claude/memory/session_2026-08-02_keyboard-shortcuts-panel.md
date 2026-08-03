---
name: A keyboard-shortcuts disclosure pinned at the bottom of the left rail
description: Direct order - "create a panel at the bottom of the lefthand nav that contains keyboard shortcuts. can be clicked to open, marked with (i) info icon." Pinned outside the scrolling rail (renderRail() rebuilds #rail on every render() and would wipe anything placed inside it), floats above its own trigger, closes on second click / click-outside / Escape.
type: project
relates_to: [session_2026-08-02_home-dashboard-view.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations both closed (36 passes) and open (37 passes); test-component-browser.sh 147/0; confirmed live via aria-expanded/hidden attribute checks that all three close paths (second click on the trigger, clicking elsewhere on the page, Escape) correctly toggle state, plus a real console.log trace after an initial false-alarm reproduction that turned out to be a one-off browser-surface flake, not a real bug
confidence: high
---

# Keyboard shortcuts, discoverable without cluttering the rail (2026-08-02)

Jonah: "create a panel at the bottom of the lefthand nav that contains keyboard shortcuts.
can be clicked to open, marked with (i) info icon."

## Where it actually needed to live

`#rail` gets `textContent=''` and fully rebuilt by `renderRail()` on every single
`render()` call - anything appended inside it as a static child would be wiped out the
first time the user navigated anywhere. Wrapped `#rail` in a new `.rail-col` flex column
instead, with the shortcuts trigger + panel as a sibling AFTER it, outside the part that
gets rebuilt. Border and background that used to live directly on `.rail` moved up to
`.rail-col` so they span the whole column (scrolling bucket list and the pinned trigger
both), not just the part that used to be the rail's own box.

## The panel itself

Floats via `position:absolute; bottom:100%` relative to `.shortcuts` (a small
`position:relative` wrapper around just the trigger), opening UPWARD and overlaying the
rail rather than pushing the bucket list around - the trigger already sits at the very
bottom of the viewport, so opening downward would run off-screen, and a disclosure this
small shouldn't reflow a scroll region every time someone checks it. Reuses the same
shadow recipe the toast card already uses (`0 8px 24px rgba(2,39,43,0.16), 0 1px 2px
rgba(2,39,43,0.10)`) rather than inventing a new floating-card treatment.

Lists all 5 REAL shortcuts read directly out of the keydown handler - Up/Down (move),
Enter/Right (open or toggle), Left/Backspace (back), A (apply), Q (quit) - two of which
(A and Q) were never shown anywhere in the UI before this, only discoverable by reading
source. `<kbd>` styling copied verbatim from the existing footer `.keys` hint rather than
inventing new key-cap styling.

Icon: verbatim Lucide "info" (`circle` + two paths), matching the exact SVG already used
for the info-toast in this same file - reused rather than re-sourced, since it was
already present and correct.

## Close behavior: three paths, one state function

`setShortcutsOpen(open)` is the single place that flips both `hidden` on the panel and
`aria-expanded` on the trigger, called from: a second click on the trigger (`e
.stopPropagation()` keeps it from also tripping the outside-click handler on the same
click), a `document`-level click listener that closes it when the click target isn't
inside `.shortcuts`, and an `Escape` branch added to the existing global keydown handler
that also returns focus to the trigger.

## A false alarm, not a real bug

First manual test sequence (open, then click the trigger again) appeared to fail -
`aria-expanded` stayed `"true"` and the panel stayed visually open. Added temporary
`console.log` tracing to the click handler and reproduced the exact same sequence again:
this time it worked correctly, logging the expected before/after `hidden` values on both
clicks. Retried the original failing sequence a third time with the same fresh-reload
setup - toggled correctly. Concluded it was a one-off flake in that browser surface
(consistent with other transient WKWebView oddities hit earlier this same session on a
different surface), not a defect in the toggle logic itself - the logic was correct on
every reproduction once isolated. Removed the diagnostic logging before shipping.

## Files touched

- `claude/installer-gui/index.html` (`.rail-col` wrapper, `.shortcuts` trigger + panel
  markup, `setShortcutsOpen`/click/outside-click/Escape wiring)
- `claude/installer-gui/styles.css` (`.rail-col` takes over `.rail`'s border/background,
  `.shortcuts`/`.shortcuts__trigger`/`.shortcuts__panel`/`.shortcut__row` rules, mobile
  media query updated to match the new wrapper)
