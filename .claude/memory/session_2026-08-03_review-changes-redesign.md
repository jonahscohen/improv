---
name: Review changes redesigned - two labeled sections, descriptions, no badge
description: Direct reversal, mid-turn - "Changed my mind. Remove the badges entirely. Separate them into two sections: 'To be installed' and 'To be removed', show descriptions, match the row-name font, make the minus buttons small like the checkmark icons." Also closed the one pre-existing axe 'region' violation the page carried, found during this pass's verification.
type: project
relates_to: [session_2026-08-03_review-changes-page.md, session_2026-08-03_apply-bar-in-panel-not-window.md]
supersedes: session_2026-08-03_review-changes-page.md
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations/33 passes on both the review page (2 items split across both sections) and the ordinary tree page (apply bar visible); test-component-browser.sh 147/0; confirmed live - staged one install + one removal, opened Review changes, saw both sections with real description text and mono-font names, removed the sole item in "To be removed" and watched that whole section disappear (not just its row) while focus landed on the surviving section's remove button, removed the last item and watched both sections vanish for "Nothing staged" with focus falling back to Back; confirmed real disk state never drifted (unstaged both test changes rather than actually applying them, Foundation stayed 4/5 throughout)
confidence: high
---

# Two sections, real descriptions, small circular buttons (2026-08-03)

Jonah, interrupting mid-turn on the just-shipped badge/circular-button revision:
"Changed my mind. Remove the badges from the review changes screen entirely.
Separate them into two sections with headings: 'To be installed' and 'To be removed'
and show the descriptions for each line item. set the line item title in the same
font as the rows. Make the minus sign buttons small like the checkmark icons,
please."

## What the badge was doing, and why it could just go

The `.check` badge (reused from `session_2026-08-03_review-changes-page.md`) was
carrying exactly one bit of information per row: install or remove. Once rows are
grouped under "To be installed"/"To be removed" headings, the section a row sits in
already carries that same bit - the badge became redundant with its own container,
not a second source of truth to keep in sync. Dropped entirely; `toggleLeaf(p)` is
now called only from the remove button.

## Grouping by literally partitioning the entries

`renderReview()` now filters `Object.entries(pending)` into `installs` and `removes`
arrays and renders each as its own `.review-section` (tagged `data-group="install"` /
`"uninstall"`), only appending a section to the DOM when its array is non-empty - an
empty "To be removed" after the last removal is unstaged doesn't leave a bare heading
over nothing.

## Descriptions and name font, pulled from the same source every other row uses

Each row now shows `nodeAt(path).desc || .tag` - the exact fallback pattern the
ordinary tree rows already use for their own `.row__desc` line, so a staged item
describes itself identically whether it's sitting in the tree or in this list. The
item's own title uses `font-family:var(--font-mono); font-size:var(--sm)`, copied
literally from `.row__name`'s declaration (direct order: "same font as the rows").

## Focus tracking had to become group-aware

The prior single flat list's `refocusReviewRemove(i)` (a numeric index into the whole
list) stopped making sense once the list split into two independently-shrinking
sections - index 2 in a flat list of 5 might now mean "the third install" or "the
first removal" depending on which section the removed row came from. Replaced with
`refocusReviewRemove(group, idx)`: focus the remove button at `idx` within THAT
section if it still reaches that far, else the OTHER section's first remove button,
else the page's own Back button once both sections are empty. Verified all three
branches live, not just the common case.

## A pre-existing accessibility gap, closed while here

An axe-core scan of the page (unchanged from earlier in this session) still flagged
one "region" violation: `#pendfoot` (inside `.pane__foot`, the div holding the toasts
and the apply bar) sits as a sibling of `<main class="pane">`, not a descendant, a
side effect of the fixed-positioning fix in
`session_2026-08-03_apply-bar-in-panel-not-window.md` that moved it out of `.pane` to
escape a transformed-ancestor bug. That left it outside every ARIA landmark on the
page. Fixed with `role="region" aria-label="Staged changes"` directly on
`.pane__foot` rather than promoting it to a `<footer>` (which would claim persistent,
page-level footer semantics for a region that's transient and often entirely hidden)
or moving it inside `<main>` (which would reintroduce the exact fixed-inside-
transformed-ancestor bug the earlier fix escaped). Confirmed the violation is gone on
both the review page and the ordinary tree page, since `.pane__foot` renders on
every page identically.

## Codex review

Independent review (read-only, given the diff plus context on both this pass and the
prior badge/circular-button pass it replaces) run before this shipped.

## Files touched

- `claude/installer-gui/index.html` (`renderReview()` rewritten to drop the `.check`
  badge, partition into `installs`/`removes`, build `.review-section` wrappers with
  `data-group`, include descriptions; `refocusReviewRemove()` rewritten to take
  `(group, idx)`; `role="region" aria-label="Staged changes"` added to
  `.pane__foot`)
- `claude/installer-gui/styles.css` (`.review-section`/`.review-section__title`
  added; `.review-row__name` given the mono/`--sm` font pair; `.review-row__desc`
  added; `.review-row__remove` shrunk from a 44px to a 22px circle with an 11px icon;
  dead `.review-row__remove`/badge rules from the prior pass replaced in place, none
  left orphaned)
