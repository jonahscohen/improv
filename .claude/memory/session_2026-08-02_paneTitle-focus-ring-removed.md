---
name: The red focus ring on the page title after every navigation was pure noise - removed
description: Jonah, from a screenshot - "is this really necessary to select the heading object in red every time we change pages? looks awful." It wasn't necessary: #paneTitle has tabindex="-1", so it can only ever be reached by focusPaneTitle()'s script call, never by a sighted keyboard user's own Tab key - a visible ring there confirms nothing to anyone.
type: project
relates_to: [session_2026-08-02_home-dashboard-view.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations/34 passes; test-component-browser.sh 147/0; confirmed live in a fresh browser surface that navigating to a bucket page no longer shows a ring on the title, while a real Tab-reachable control (the Back button) still shows its ring normally when focused - proving the fix is scoped to #paneTitle only, not a global focus-visible removal
confidence: high
---

# Removing noise, not accessibility (2026-08-02)

Jonah, with a screenshot of the "Improv" hero title wrapped in a red box: "is this really
necessary to select the heading object in red every time we change pages? looks awful."

## Why the ring was never doing anything useful

`#paneTitle` has had `tabindex="-1"` since the focus-management fix earlier this session
(the one that stops keyboard/screen-reader users losing their place to `<body>` after
every navigation). `focusPaneTitle()` calls `.focus()` on it after every route change,
and Chromium/WebKit's `:focus-visible` heuristic treats a script-initiated `.focus()`
call as visible-by-default regardless of whether the user's last input was a mouse click
or a keypress - which is exactly why the ring appeared on every navigation, mouse-driven
included, not just keyboard ones.

But `tabindex="-1"` also means this element is permanently removed from the natural Tab
order - a sighted keyboard user can never land there by pressing Tab themselves. The
actual accessibility win (a screen reader announcing the new page's heading) comes purely
from the DOM focus event firing, which happens with zero dependency on any visual
styling. So the ring was never confirming anything real to a keyboard user (they never
put their focus there on purpose) and was invisible to the screen-reader users the whole
mechanism exists for. Pure noise, loudest on Home where it boxed in 90px display type.

## Fix

```css
#paneTitle:focus-visible{outline:none;}
```

Scoped to exactly this one element - every other focus-visible target on the page
(buttons, checkboxes, the Back button, rail items) keeps the global red ring untouched,
confirmed live by focusing the Back button after the fix and seeing its ring render
normally.

## Files touched

- `claude/installer-gui/styles.css` (`#paneTitle:focus-visible{outline:none;}` added
  right after the global `:focus-visible` rule)
