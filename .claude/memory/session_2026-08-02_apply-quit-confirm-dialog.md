---
name: Apply and Quit both require confirmation now - button, and their keyboard shortcuts
description: Direct order - "Need a confirmation dialog when using apply or quit, too easy to install/uninstall something important." One shared confirmAction() modal used by both, wired into every path to each action (button click AND the A/Q keyboard shortcuts), not just the buttons.
type: project
relates_to: [session_2026-08-02_keyboard-shortcuts-panel.md, session_2026-08-02_quit-button-topbar-icon.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations closed (35 passes) and open (36 passes); test-component-browser.sh 147/0; drove the full real flow live - staged an install, confirmed, watched it actually apply ("One change applied"), then staged the matching removal, confirmed, watched it revert (back to the real pre-test baseline); confirmed Cancel preserves staged state and returns focus to the button that opened the dialog; confirmed Escape does the same; confirmed the 'q' keyboard shortcut opens the SAME dialog rather than quitting instantly; confirmed ArrowDown and 'a' do nothing to the page while the dialog is open (no stacking, no background action)
confidence: high
---

# One shared confirm dialog, wired into every path (2026-08-02)

Jonah: "Need a confirmation dialog when using apply or quit, too easy to install/uninstall
something important."

## Every path, not just the buttons

Apply and Quit are each reachable two ways: the footer/topbar button, and a keyboard
shortcut (`A` and `Q`) that calls the same underlying function directly, bypassing any
button-click wiring entirely. The keyboard shortcuts panel added earlier this session
made these MORE discoverable, not less - if confirmation only guarded the buttons, the
shortcut would still be the single easiest way to accidentally trigger either action.
Introduced `confirmedApply()`/`confirmedQuit()` wrappers around the real `runApply()`/
`doQuit()`, and pointed BOTH the button click listeners and the `A`/`Q` keydown branches
at the wrappers - there is no remaining path to either action that skips confirmation.

## One modal, not two

`confirmAction({title, body, confirmLabel})` is a single reusable Promise-based dialog -
content swapped per call, resolves `true`/`false` on Confirm/Cancel/backdrop-click/Escape.
Apply's body names exactly what will happen (`"This makes 2 installs and 1 removal real
on your machine."`, built from the actual staged plan, not a generic warning); Quit's
names the real consequence for THIS moment - staged changes lost, or nothing since none
are staged.

Default focus lands on Cancel, not the button that does something - a reflex Enter press
should land on the safe option. Focus returns to whatever was focused before the dialog
opened (the triggering button) once it closes, matching this project's established
focus-restoration pattern from `focusPaneTitle()`/`refocusCheck()`.

## Background shortcuts fully suppressed while open

The dialog's own keydown listener is registered with `{capture: true}` and calls
`e.stopPropagation()` on every key - since capture-phase listeners on `document` always
run before bubble-phase ones on the same element, this reaches the event before the
page's global keydown handler ever sees it, regardless of registration order. Verified
live: with the Quit dialog open, ArrowDown and `A` both did nothing (no row selection
change, no second dialog stacked on top) - the page underneath is fully inert until the
dialog is resolved.

## A real design-system mismatch, caught by looking at the actual render

First pass reused this codebase's `.btn--danger` class for the Apply confirm button
whenever the staged plan included a removal, assuming it meant "make the risky action
look bolder." Wrong assumption: in this design system `.btn--danger` is the QUIETER
outline treatment (used for "Remove all" sitting next to a bold "Install all", where the
two need to read as different weights side by side) - not a bold warning color. Using it
here would have made a real, consequential confirm action look LESS prominent than a
routine one. Caught by actually looking at the rendered dialog, not by reading the CSS in
isolation. Fixed by dropping the distinction entirely: the confirm button is always the
bold `.btn--primary` fill, matching the real Apply button itself; the body text carries
the stakes, not the button color.

## Codex review, folded

Independent review (read-only, given the diff plus surrounding files) before this
shipped. Two real findings, both folded:

- **Folded** - `stopPropagation()` on the modal's capture-phase keydown listener blocks
  the page's SHORTCUT branches (arrows, A, Q) but does nothing about Tab moving real
  focus onto a background button - and that button's own Enter/Space activation is a
  browser default action stopPropagation never touches. Nothing was trapping focus
  inside the two dialog buttons, so a stray Tab could reach Apply/Quit again and open a
  SECOND `confirmAction()` call sharing the same `#confirmOk`/`#confirmCancel` DOM
  elements - two sets of listeners, two pending Promises, one OK press resolving both.
  Added a Tab/Shift+Tab trap cycling between exactly the two buttons (only two exist
  here, so this is a plain wrap, not a general focusable-elements query) - verified live
  that Tab moves Cancel -> Quit -> Cancel and never escapes to the page underneath.
- **Folded** - `confirmedApply()` never checked the existing `applying` in-flight guard
  before opening a dialog, so a second Apply press (or the `A` shortcut) during a real
  apply would show ANOTHER "Apply staged changes?" prompt whose eventual OK then
  silently no-ops against `runApply()`'s own guard, instead of visibly doing nothing.
  Added the same `if (applying) return;` check `confirmedApply()` was missing.

## Files touched

- `claude/installer-gui/index.html` (`#confirmModal` markup, `confirmAction()`,
  `confirmedApply()`/`confirmedQuit()`, button + keydown wiring updated)
- `claude/installer-gui/styles.css` (`.modal`/`.modal__backdrop`/`.modal__card`/
  `.modal__title`/`.modal__body`/`.modal__actions`, reusing the existing `toast-in`
  keyframe for the card's entrance)
