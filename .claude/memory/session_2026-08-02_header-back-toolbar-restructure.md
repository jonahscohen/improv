---
name: Back and the bulk actions get their own row above the title now, with a real divider before the list
description: Direct order with a reference screenshot - Back moved out of the same right-aligned group as Enable all/Disable all into the far left of a new toolbar row, the title dropped to its own line underneath, and a divider now marks where the header ends and the row list begins.
type: project
relates_to: [session_2026-08-02_screenreader-aria-audit.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered all three toolbar states (Back+bulk together on Hooks, bulk-only on a top-level bucket, neither on a leaf self-row where the row hides entirely); Back and Enable/Disable all confirmed still functional by driving them; both themes read; axe 0 violations/34 passes, detector 0 blocking, suite 147/0; staged-but-unapplied test changes discarded by reload, real disk state (sidecoach-detect, Sidecoach's install count) confirmed untouched
confidence: high
---

# Buttons on their own row, Back on the left (2026-08-02)

Jonah, with a reference screenshot of the desired layout: "Buttons on their own row up top, with
'Back' in the top left. Title on another line right under. Then description, then HR underneath
the description."

## What moved

Back had been appended into the SAME `#bulk` container as Enable all/Disable all, so all three sat
together in one right-aligned group next to the title - matching the "before" state in his
screenshot. Split into two independent slots in a new `.pane__toolbar` row: `#paneBack` on the
left, `#bulk` on the right, both above the title rather than beside it. The title, description and
meta line now stack in the header's ordinary block flow instead of sharing a flex row with the
buttons.

## The toolbar disappears when there is nothing in it

A leaf you have drilled into (tilt-lab, lotus) has neither bulk actions nor a Back button. Both
slot divs are always present in the DOM (so `render()` has somewhere to write into), which means
CSS `:empty` cannot detect "both children empty" - checked in JS instead
(`bulk.children.length || paneBack.children.length`) and toggled the row's `display` directly, so
it collapses to nothing rather than sitting there as blank space above the title.

## The divider

`.pane__head` gained a real `border-bottom` + `padding-bottom`, marking where the header - now
taller, with the toolbar row added above the title - actually ends and the row list begins.

## Verified across all three shapes the toolbar can take

Rendered Hooks (both Back and bulk present, matching the reference exactly), a top-level bucket
(bulk only, confirmed the row doesn't look lopsided with an empty left side), and a leaf self-row
(neither, confirmed the row vanishes entirely). Drove Back and Enable all/Disable all for real
rather than assuming the relocated markup kept working. One incidental catch: testing bulk actions
left several items staged; a page reload discards anything staged-but-not-applied (it is pure
client memory), confirmed by checking the real install count and `sidecoach-detect`'s file state
were unchanged afterward.

## Files touched

- `claude/installer-gui/index.html` (`.pane__toolbar`/`#paneBack` markup; `render()` split into two
  populate steps plus the empty-row hide)
- `claude/installer-gui/styles.css` (`.pane__toolbar`, `.pane__back`, `.pane__head` divider, removed
  the now-unused `.pane__headline` flex row)
