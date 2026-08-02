---
name: My redundancy call on the leaf self-row was wrong - restored name and description to match how every other single-item row looks
description: Jonah pointed at "memory" inside Beats, a group with one real child that still gets its own name and description on its row. tilt-lab and lotus are single-component buckets rendered as a one-row list of themselves, and I had suppressed both fields on that row reasoning it repeated the H1. He wanted the same pattern every other row uses, not a special case.
type: project
relates_to: [session_2026-08-01_flush-badges-slash-counts-dead-leaf-toggle.md]
supersedes: session_2026-08-01_flush-badges-slash-counts-dead-leaf-toggle.md
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered both tilt-lab and lotus in light theme, toggled each badge and confirmed it still stages/unstages correctly, detector 0 blocking, suite 147/0, machine state restored
confidence: high
---

# The redundancy call I made was the wrong one (2026-08-02)

Jonah, with a screenshot of the Beats group: "You see how Beats has the direct install for just
'memory'? ... THAT is what we want to see in lotus and tilt-lab: the option to select the single
entry in the list. Right now there's no description or title associated with the row."

## What I had built and why

When a leaf bucket (tilt-lab, lotus - a component with no children, where the whole bucket IS the
one thing) gets drilled into, it renders as a one-row list of itself so there is a real control to
press. I suppressed that row's own name and description, reasoning the H1 and paragraph already
above it said the same thing - repeating both would be the exact redundancy the second slop pass
had removed elsewhere ("Foundation" appearing three times on one screen).

## Why that reasoning did not hold here

Beats is the counter-example, and it was sitting in the same screenshot the whole time. Beats has
THREE children (memory, reflect, Hooks), and "memory" gets its own name and full description on its
row even though the bucket-level intro paragraph above already introduces the whole group. Nothing
about that reads as redundant, because a row showing its own identity is simply how every row in
this app works - the suppression was the exception, applied only because there happened to be
exactly one row instead of several, and one row is not a different KIND of case, it just has less
company.

For a single-component bucket the row's description does end up identical to the paragraph above
it, because there is only the one piece of text in the data model. That is real duplication, and it
is fine - it is the same shape "memory" has, just with a shorter list around it.

## The fix

Removed the `selfRow` variable and both places it gated: `row__name` and `row__desc` now render
unconditionally, exactly like a child-of-a-group row does. Three lines came out; nothing else
changed.

## Files touched

- `claude/installer-gui/index.html`
