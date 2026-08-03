---
name: Review changes breadcrumb and navigation fixes
description: Jonah caught three real bugs from a live screenshot - breadcrumb showed the full nav trail under Review changes instead of sitting flat under Home, and both Home and every other rail link silently failed to leave review mode. Fixed all three plus the one the screenshot didn't show (rail bucket links had the identical bug).
type: project
relates_to: [session_2026-08-03_review-changes-redesign.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: test-component-browser.sh 147/0; axe-core 0 violations across Home (34 passes), the Hooks tree page (34 passes), and the Review page with a nested-origin item (33 passes); confirmed live - breadcrumb now reads flat "Home > Review changes" regardless of which bucket/subpage the item came from; clicking the rail's Home exits review mode and shows Home with staged state preserved; clicking a rail bucket link (Foundation) while reviewing exits review mode and navigates there, staged state preserved; clicking the breadcrumb's own Home does the same; the review page's own Back button still returns to the exact page you opened it from (Sidecoach > Hooks), unaffected by any of the above
confidence: high
---

# Home wasn't clearing review mode, and the crumb lied about nesting (2026-08-03)

Jonah, from a live screenshot: "breadcrumbs are all wrong. Review changes should sit
at top level underneath Home. Clicking 'home' doesn't work. Back button should take
you back to where you came from." Then, mid-fix: "Additionally, clicking links in the
left hand nav from the review changes screen should close review changes and show
you that page."

## The crumb was telling a true-sounding lie

`renderCrumb()` always rendered the full `nav` trail (e.g. "Home > Sidecoach >
Hooks") and only appended "> Review changes" at the end. That's technically accurate
- `nav` really was sitting at Sidecoach/Hooks when Review was opened - but it reads
as "this page is nested inside Hooks," which is false: Review changes can list staged
items from any bucket at once (each row already shows its own full trail for exactly
this reason). Fixed by giving `reviewMode` its own early-return branch in
`renderCrumb()`: always "Home > Review changes", flat, regardless of where `nav`
actually points. `nav` itself is left completely untouched - it still has to know
where "back to where you came from" is.

## Home (and everything else in the rail) was silently a no-op

Neither the rail's Home button nor any bucket button ever cleared `reviewMode` on
click - both just reset `nav` and re-rendered. Since `render()` checks `reviewMode`
before it looks at `nav` at all, resetting `nav` while `reviewMode` stayed `true`
just re-rendered the SAME review list again, with a crumb that was now broken too
(`nav.length<1` hits the early-return in the old `renderCrumb()` before it ever
reached the code that appended "Review changes", so the whole crumb bar vanished).
From the outside this reads as "clicking Home does nothing" - the correct diagnosis,
though the actual failure was reviewMode never turning off, not Home's own logic
being wrong.

Fixed both call sites (`home.addEventListener` and the per-bucket
`b.addEventListener` in `renderRail()`) to clear `reviewMode` before setting `nav`.
Jonah's follow-up message named the bucket-link case explicitly, which was already
being fixed as the same root cause - one gap, not two.

## What was already correct and stayed that way

The review page's own "‹ Back" button, and the ArrowLeft/Backspace keyboard path,
both already cleared `reviewMode` WITHOUT touching `nav` - so "back to where you came
from" was already the real behavior for that specific control. The bug was scoped to
the rail and crumb Home links, not Back. Verified this stayed true after the crumb
rewrite: Back from a Sidecoach/Hooks-opened review still lands on Sidecoach/Hooks,
not Home.

## Files touched

- `claude/installer-gui/index.html` (`renderCrumb()` given a `reviewMode` early
  branch rendering a flat "Home > Review changes"; `renderRail()`'s Home and bucket
  click handlers both now clear `reviewMode` before navigating)
