---
name: Review Changes code-review findings folded (two HIGH bugs, four lower)
description: Independent teammate review plus a genuine Codex CLI pass converged on two real HIGH-severity bugs in the Review Changes feature - the remove button could flip an install into a removal after a partial-failure apply, and a stale pending path could throw and break the page. Both fixed, plus four lower-severity findings; a third HIGH (rail/crumb not exiting review mode) was found genuinely broken by the reviewer, fixed independently in response to the user's own live bug report, then re-verified clean by the same reviewer - a found-and-fixed, not a stale finding.
type: project
relates_to: [session_2026-08-03_review-changes-redesign.md, session_2026-08-03_review-changes-nav-fixes.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: test-component-browser.sh 147/0; axe-core 0 violations/33 passes on the review page both empty and populated; confirmed live - remove button now deletes the pending entry directly and fires a toast ("Foundation / ampersand removed from staged changes."), confirmed the review round-trip (stage a row, note its sel index, open Review, Back) leaves the SAME row selected rather than jumping to row 0
confidence: high
---

# Two independent reviewers, two real HIGH bugs (2026-08-03)

Spawned a teammate (`codex-review`) to run an independent review of the Review
Changes diff. It ran its own static trace first, then handed the same diff to a
genuine `codex exec --sandbox read-only` CLI run. The two converged almost
completely - six shared findings, three lows only the teammate's own pass caught,
zero found by Codex alone.

## Real HIGH #1: the remove button could stage the OPPOSITE of what it promised

The remove button called `toggleLeaf(p)`, which recomputes its target from
`installed[p]===true ? 'uninstall' : 'install'` every time - it is a toggle, not an
unstage. `runApply()` always calls `buildTreeFromManifest(m)` after every apply
attempt, including failed ones, while deliberately preserving `pending` on failure
(the existing comment there says why: clearing it would silently drop the user's
staged changes). So a run that installs several things successfully and fails on one
removal leaves `installed[p]===true` for everything that installed cleanly, while
`pending[p]` still says `'install'` for anything not yet applied. Clicking the button
labeled "Remove X from staged changes" would then compute `t='uninstall'` fresh,
see it disagrees with `pending[p]`, and SET `pending[p]='uninstall'` instead of
deleting it - moving X into "To be removed" instead of taking it off the list.

Fixed by having the button just `delete pending[p]` directly. Its one job is "take
this out of the list," not "flip it," so it has no business consulting
`installed[p]` at all.

## Real HIGH #2 (call it MEDIUM/HIGH depending which reviewer): a stale pending path could throw and blank the page

`nodeAt()`/`labelFor()` walk `path` with no guard - `n=n.children[s]` throws the
moment an intermediate segment is missing. `renderReview()` was the only caller that
ever ran these against an arbitrary `pending` key rather than a path built from a
live tree traversal. Since `buildTreeFromManifest` can genuinely change `T` out from
under a preserved `pending` (same mechanism as bug #1), a component dropped from the
manifest mid-session leaves a `pending` key that no longer resolves - opening Review
Changes at that point would throw inside `buildRow` and blank the whole page.

Fixed with a new `resolvesInTree(path)` helper (same traversal as `nodeAt`, but
returns `false` on a missing segment instead of throwing), called at the very top of
`renderReview()` to purge any dead `pending` entries before anything downstream reads
`pendingCount()` or `Object.entries(pending)`. This clears the entry from `pending`
itself, not just from this one render, so a phantom "+1 change staged" can't outlive
the page that would have shown it.

## Real HIGH #3: rail and breadcrumb clicks not exiting review mode - found, then fixed, then re-verified

This one is a found-and-fixed, not a stale finding, and it's worth being precise
about the order since it looked at first glance like the reviewer was reporting
something already resolved. It wasn't: the reviewer read the diff at the point I
first asked it to look, before any nav fix existed, and correctly flagged that
neither the rail's Home button, nor its per-bucket buttons, nor the breadcrumb's own
Home ever cleared `reviewMode` - `render()` checks `reviewMode` before `nav`, so
changing `nav` without clearing the flag just re-rendered the same review list, with
a broken breadcrumb on top (the old `renderCrumb()`'s `nav.length<1` early return hid
the whole crumb bar once `nav` was reset to `[]`).

The actual fix, though, came from Jonah's own live bug report (a screenshot showing
the broken breadcrumb) landing in the same session, independently of the review - I
fixed it (`reviewMode=false` added to all three handlers, `renderCrumb()` given a
`reviewMode` branch), verified it live via cmux screenshots, and wrote
`session_2026-08-03_review-changes-nav-fixes.md` for it, all before the reviewer's
report on this specific point reached me. The reviewer then re-pulled the diff,
confirmed the fix with the same line numbers, and called it clean - a real bug, found
independently by two sources, fixed once, verified twice. Recording it as "already
fixed, stale" in an earlier draft of this beat was the wrong frame; corrected here at
the reviewer's own accurate, evidence-backed request, so a future session reads this
as a review that caught something real rather than one that produced noise.

## Four lower-severity findings, also folded

- **24px, not 22px, on the remove button** - 22px sits below WCAG 2.5.8's 24px
  target-size minimum; bumped by 2px, imperceptible next to the icon it wraps but
  closes the gap exactly.
- **sel was reset to 0 on every review round-trip** - new `selBeforeReview` variable
  snapshots `sel` when Review Changes opens; the two "return to where you came from"
  exits (the page's own Back button, and ArrowLeft/Backspace) restore it instead of
  zeroing it, so the row you had selected is still selected. The nav-changing exits
  (rail Home, rail bucket, crumb Home) correctly still reset to 0, since those land on
  a genuinely different row list.
- **Partition style divergence** - `entries.filter(([,a])=>a!=='install')` was a
  catch-all where `renderTail()`'s own partition of the same object uses precise
  `a==='uninstall'`. Aligned to match; today's behavior is identical since only two
  values are ever written, but the two partitions of the same data no longer read
  differently.
- **No live-region announcement on removal** - a screen-reader user pressing the
  remove button got a silently-updated list and a refocused button, nothing spoken.
  Added a `toast(trail+' removed from staged changes.', 'info')` call, reusing the
  existing toast component (role="status", already a live region) rather than
  building anything new.

## Two findings considered and deliberately left as-is

- **The shortcuts panel advertises arrow-key/Enter shortcuts that are gated off
  during review mode** - true, but the panel is a static, page-agnostic reference
  that was never scoped to "what works on the page you're currently on" even before
  Review Changes existed (Home has no rows to move between either). Making it
  dynamically review-mode-aware is a real feature, not a one-line fix, and the lowest
  priority item both reviewers flagged. Left for a future pass if it matters enough
  to build.
- **`.pane__foot`'s `role="region"` can be an empty landmark** when nothing is staged
  and no toast is showing - true, but moving the role onto `.apply-bar` alone (the
  teammate's suggested alternative) would drop `#toasts` out of landmark coverage
  entirely, trading one cosmetic nit for a real regression. Left as-is.

## Files touched

- `claude/installer-gui/index.html` (`resolvesInTree()` added next to `nodeAt`;
  `renderReview()` purges stale `pending` entries at its top; remove button now
  `delete`s directly and fires a toast; `selBeforeReview` added and wired through
  entry/exit; `removes` partition aligned to `a==='uninstall'`)
- `claude/installer-gui/styles.css` (`.review-row__remove` 22px to 24px)
