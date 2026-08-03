---
name: A Review Changes page, reachable from the apply bar
description: Direct order, then a follow-up correction - "add a Review Changes button that lists every staged change with minus buttons to remove them," then "use the same badges elsewhere, circular red minus button." Superseded same day by session_2026-08-03_review-changes-redesign.md.
type: project
relates_to: [session_2026-08-03_apply-bar-in-panel-not-window.md]
supersedes: null
superseded_by: session_2026-08-03_review-changes-redesign.md
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: test-component-browser.sh 147/0; confirmed live end-to-end (stage an install and a removal, open Review changes, see correct badges and trail names, remove one item, confirm the other survives with correct singular/plural staged-count text, Back returns to the real tree state)
confidence: high
---

# Review changes: a page listing every staged item (2026-08-03)

Jonah: "make it say +2 -1 changes staged, then add a button to the left of Apply
Changes that says 'Review Changes' which takes you to a page that lists all of your
changes with (-) minus buttons at right to remove changes from the list."

Then, mid-turn, with a screenshot: "Use the same badges found elsewhere within
installer, and make the minus button circular, same theme as the circular
checkboxes, make them red."

## An overlay, not a real tree destination

`reviewMode` is a plain boolean, deliberately NOT folded into `nav` (the array that
tracks where the tree-view actually is). Review Changes sits on top of wherever `nav`
already points rather than being a destination `nav` moves to reach - so leaving it
(Back, or any keyboard path) always lands exactly back where the user was, with zero
extra state to restore. `render()` now branches on `reviewMode` before falling into
the normal tree-rendering path; both paths converge on a shared `renderTail()`
(extracted from `render()`'s previously-inline ending) for the staged-count pill,
Apply button label, and the pane's transition class.

## Reused the real badge, not a lookalike

First pass invented its own "Will install"/"Will remove" text pill. Jonah's
correction pointed at the existing `.check` badge every ordinary row already uses for
a staged item - not a new component. Reusing it meant the review row's badge could
call the SAME `toggleLeaf(p)` function every other staged-item control already calls,
which correctly un-stages an already-staged leaf with no new logic: one function, two
places that call it, not two things to keep in sync.

## Circular, red, and small enough to hit precisely

The remove button became a true 44x44px circle (`border-radius:var(--r-full)`),
red-themed throughout (`--red-text`/`--red-border`/`--red-subtle` on hover) - matching
"same theme as the circular checkboxes" (the row-end `.row__dot` status echoes)
without literally reusing that class, since a dot that's always red would say
something different than a dot whose color already carries install/remove meaning
elsewhere.

## Files touched

- `claude/installer-gui/index.html` (`reviewMode`, `renderReview()`,
  `refocusReviewRemove()`, `renderTail()` extraction, `MINUS_ICON` constant sourced
  from `~/Documents/Github/lucide/icons/minus.svg`, `#btnReview` wiring, keyboard
  handler gated on `!reviewMode`)
- `claude/installer-gui/styles.css` (`.review-row`, `.review-row__remove` as a
  44px red circle, `.apply-bar__actions`)
