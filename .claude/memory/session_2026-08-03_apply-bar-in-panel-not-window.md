---
name: The permanent footer is gone - Apply now lives in a bar that fades and slides up inside the content panel only
description: Direct order, then a correction - "Remove the bottom bar. Apply button should only appear in a bar that fadeslides up within the content panel when a component is selected... does not extend leftward over the lefthand nav." First implementation used position:sticky, which left a visible gap on short pages instead of sitting flush with the viewport's bottom edge - corrected to position:fixed anchored to a shared rail-width token after the user flagged it.
type: project
relates_to: [session_2026-08-02_apply-quit-confirm-dialog.md, session_2026-08-02_keyboard-shortcuts-panel.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations bar-hidden (34 passes) and bar-visible (33 passes); test-component-browser.sh 147/0; confirmed live on both a SHORT page (Foundation, 5 rows) and a LONG page (Guardrails, scrolled to its true end) that the bar sits flush with the real viewport bottom edge in both cases, and that the last row is never hidden underneath it; confirmed the bar's left edge lines up exactly with the rail's right edge, never extending over it
confidence: high
---

# No permanent footer - a conditional bar scoped to the panel (2026-08-03)

Jonah: "Remove the bottom bar. Apply button should only appear in a bar that fadeslides
up within the content panel when a component is selected. The slideup should show the
number of changes and then the Apply button at right. Slide up only appears within the
content panel, does not extend leftward over the lefthand nav."

## What came out

The old `<footer class="actionbar">` - a permanent, full-width, always-visible strip
holding the staged-count pill, a keyboard-shortcut hint, and Apply - is gone entirely.
The inline `.keys` hint (`↑↓ move enter toggle ← back`) went with it rather than getting
relocated, since the dedicated keyboard-shortcuts panel added earlier this session
already covers the same ground more completely (it lists Apply and Quit's shortcuts too,
which this old hint never did).

## What replaced it

A new `.apply-bar`, visible only while `pendingCount() > 0` ("a component is selected"
read as "something is staged," matching what Apply actually acts on). Same staged-count
pill as before (green/red install-count breakdown) on the left, Apply on the right - a
straight relocation of existing pieces into a conditional bar, not new content. Fades and
slides up (`opacity` + `translateY`) using the same plain-transition, no-fill-mode
pattern established for the shortcuts panel and the tree-navigation fade - a transition
always interpolates between two real states, so there is no way to end up stuck
half-visible.

## Sticky looked right and wasn't

First pass used `position:sticky; bottom:0` on a wrapper (`.pane__foot`) holding both the
bar and the relocated toasts, reasoning that a sticky child of `.pane` can never render
outside the pane's own width - which is true, and correctly satisfied "never over the
rail." But sticky only holds an element at the visible edge once scrolling would
otherwise carry it past that edge; on a page with too little content to need scrolling
(Foundation, 5 rows), the bar just sat in its natural flow position right after the last
row, with visible empty space below it down to the real bottom of the window - not
"adhere to the bottom of the viewport" as asked.

Fixed with `position:fixed; left:var(--rail-w); right:0; bottom:0`. `--rail-w` is a new
shared token (`268px`) that `.body`'s own grid-template-columns now reads too, so the
bar's left edge and the rail's actual width can never drift out of sync the way two
separately hardcoded `268px` literals could. A `@media (max-width:720px)` override resets
`left:0` at the breakpoint where the rail becomes a horizontal strip above the pane
instead of a side column.

Fixed positioning stopped reserving flow space the way sticky had, which would have let
the last row or two of content sit underneath the bar once it appeared. Fixed with a
`.pane.has-apply-bar` class (toggled alongside the bar's own open/closed state in
`setApplyBarOpen()`) that adds bottom padding only while the bar is actually shown - no
permanently-reserved gap on every page when nothing is staged, but never an overlap when
something is.

## Codex review, folded

Independent review (read-only, given the diff plus surrounding files) before this
shipped. Three findings, all folded:

- **Folded** - `setApplyBarOpen()` checked `bar.hidden` to decide whether to run the open
  sequence, but `hidden` lags up to 220ms behind the real visual state (it only flips
  once the close animation's `setTimeout` fires). Unstaging then restaging within that
  window read as "already open" and silently skipped re-showing a bar that was actually
  still fading OUT - it would finish disappearing despite something being staged again,
  invisible until the next unrelated render(). Switched the check to `is-open` (the
  actual visual truth) instead of `hidden`.
- **Folded** - `.pane__foot` was `position:fixed` but nested INSIDE `.pane`, and `.pane`
  gets a real `transform` applied during its own navigation animations
  (`is-fwd`/`is-back`/`is-lateral`). Any transformed ancestor becomes the containing
  block for a `position:fixed` descendant per the CSS spec, so mid-transition the bar
  (and toasts) would have been positioned relative to the animating pane instead of the
  true viewport - confirmed live that this doesn't happen once `.pane__foot` moved to be
  a sibling of `.pane` instead of a child.
- **Folded** - `revealTargets()` (the first-paint stagger reveal) still queried the
  removed `.actionbar` selector - harmless (`.filter(Boolean)` drops the null), but stale.
  Pointed it at `.pane__foot`, the element that actually replaced that region.

## Files touched

- `claude/installer-gui/index.html` (`.actionbar`/`.keys` footer removed; `.pane__foot` +
  `.apply-bar` added inside `.pane`, `#toasts` relocated there too; `setApplyBarOpen()`
  added, wired from `render()`'s existing pending-count tail; `.pane.has-apply-bar`
  toggle added to the same function)
- `claude/installer-gui/styles.css` (`--rail-w` token; `.body` grid-column reads it;
  `.pane__foot`/`.apply-bar` rules; `.pane.has-apply-bar` padding reserve; mobile
  `.pane__foot{left:0}` override; dead `.actionbar`/`.keys`/`.actions` rules removed;
  `body`'s grid-template-rows dropped its third `auto` row now that the footer sibling
  is gone)
