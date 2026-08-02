---
name: Badges sit flush next to the name now, counts read N/N and 0/N, and lotus/tilt-lab had no way to toggle at all
description: Three direct orders plus one real bug found along the way. The badge moved out of the far-right column to sit beside the title with no letter-spacing. "ALL 2" and "NONE OF 1" became "2/2" and "0/1". Drilling into a single-component bucket showed text pointing at a rail control that no longer exists.
type: project
relates_to: [session_2026-08-01_badge-becomes-the-checkbox.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered both themes; staged and unstaged tilt-lab through its new row and confirmed the plan cleared; detector 0 blocking; suite 147/0
confidence: high
---

# Three quick orders and one dead end (2026-08-02)

Direct orders, executed immediately per the standing protocol: "move status badges to sit flush
next to component title, remove letter spacing from badge caption", then "instead of saying 'ALL
2' or 'ALL 3', they should say '2/2' or '3/3'", then "instead of 'NONE OF 1' use '0/1'".

## Badge placement

The row grid gained a fourth column so the badge sits directly after the name rather than at the
far right next to the chevron: `auto auto minmax(0,1fr) auto` with areas `"name check . go"` /
`"desc desc desc go"`. `row__name` moved from a `1fr` column to `auto`, which meant its ellipsis
safety net could never fire - capped at `max-width:28ch` so a pathological key still cannot stretch
the row on a narrow viewport, though no real name comes close.

## Count wording

Two lines in the badge-text branch:

    all N        -> N/N
    none of N    -> 0/N

Left the partial case ("7 of 8") as it was - not asked for, and changing it would have been
scope the user did not request.

## The dead end this surfaced

Drilling into `tilt-lab` or `lotus` (buckets with no children, i.e. the whole bucket IS the
component) rendered no control at all - just text: *"This component installs as a single unit.
Use the list on the left to turn it on or off."* But the rail stopped being a toggle surface in an
earlier redesign ("a control that lied" - the rail switch navigated, it never toggled). The text
was pointing at a control that no longer exists. There was no way to install or remove either
component from this screen.

Fixed by having a leaf you have drilled into render as a one-row list of itself, reusing the exact
badge/checkbox every child row already has: `rowsCache = isLeaf(n) ? [nav.slice()] : ...`. The row
suppresses its own name and description, since the H1 and the paragraph above it already carry
both - rendering them again would be the same redundancy the second slop pass removed elsewhere.

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css`
