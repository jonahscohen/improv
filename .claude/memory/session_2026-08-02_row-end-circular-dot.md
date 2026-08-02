---
name: A circular checkbox at the end of every toggleable row - deliberate visual redundancy, not a second control
description: Direct order, explicitly countering this session's own "avoid redundancy" instinct - Jonah wanted a second, purely decorative on/off indicator at the row's far end, distinct in shape from the existing pill badge, while the row's own click/Enter behavior stays exactly as it was.
type: project
relates_to: [session_2026-08-02_screenreader-aria-audit.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered on the Foundation (leaf-only) and Sidecoach (has a drillable group) pages in both states; clicking the row body (not the badge) confirmed unchanged toggle behavior; the dot flips in sync with a staged change; the chevron on group rows is untouched; axe 0 violations/33 passes, detector 0 blocking, suite 147/0, machine state restored
confidence: high
---

# Redundancy, on purpose (2026-08-02)

Jonah: "We should put a circular checkbox at the end of every toggleable row to clearly provide an
on/off interactive. we'll leave the click/enter event on the whole row as it is, the checkbox is
merely a visual cue... redundancy in UI isn't a bad thing in UX."

This runs directly against a rule this session had been applying all along - the second slop pass
explicitly removed doubled state indicators ("a coloured dot AND a coloured pill saying the same
thing"). The direct order here is not a contradiction of that rule so much as a different case: a
dot repeating state SOMEWHERE ELSE ON THE SAME ROW in an identical way was decoration; a second
shape, in a different position, doing a different job (confirming the row itself is a toggle,
independent of what the badge already says in words) is what he is asking for, and an explicit,
current instruction outranks a prior aesthetic default regardless.

## What was built

A circular indicator (`lucide:circle-check` filled when on, bare `lucide:circle` outline when off)
in the row's END column - the same grid slot the chevron occupies for a drillable row. It reuses
the EXACT `on` boolean the pill badge already computes, so the two readings of a row's state can
never disagree, including mid-staging (the dot goes hollow the instant a row is staged for
removal, exactly matching the badge's own immediate "will remove" read).

**Purely decorative, deliberately.** `aria-hidden="true"`, a plain `<span>` not a button, no click
handler of its own. The row's existing click handler (and the badge's own, separate, real toggle
control) are completely unchanged - this is additive, not a replacement, and it must never become a
second thing a screen reader announces as operable, since it isn't one.

## Rows that navigate keep the chevron, unchanged

A drillable row (e.g. "Hooks") does not toggle on click - it opens. Putting a circular on/off dot
there would have been actively misleading, implying the row toggles when it does not. The split is
exactly the leaf/non-leaf branch already used for the "Open" button added last turn: leaf rows get
the dot, non-leaf rows keep the real, separately-focusable chevron button exactly as it was.

## Files touched

- `claude/installer-gui/index.html` (`DOT_ON`/`DOT_OFF` constants, the leaf branch of the row-end slot)
- `claude/installer-gui/styles.css` (`.row__dot`, hover-slide scoped back to the real chevron button only)
