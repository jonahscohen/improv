---
name: Second slop pass - the real signature was redundancy and a control that lied
description: Foundation appeared three times on one screen, the count twice, state twice. The rail drew switches that navigate rather than toggle. The footer echoed the selected row's own text. None of it moved a single audit number.
type: project
relates_to: [session_2026-08-01_installer-slop-removed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: rendered and read at each step in both themes; all three audits re-run and unchanged
confidence: high
---

# The second slop pass (2026-08-01)

Commit stamp at authoring: 96f0c466.

Jonah, again: "I still see slop." The card stack was already gone. This is what was under it.

## Redundancy was the signature

**"Foundation" appeared three times on one screen** - highlighted in the rail, chipped in the
breadcrumb, and set as the H1. **The count appeared twice** - `4/5` in the rail and "4 of 5
installed" in the pane meta. **State appeared twice** - the rail switch and the row switch. **The
footer echoed the selected row's name and description**, both already on screen two inches above.

Saying the same thing in several visual languages reads as design, because each piece looks
considered on its own. It is the opposite: nothing had been decided about where a fact belongs.

Each fact now has ONE home. Group name: the H1. Count: the rail, where it is scannable across all
groups side by side. Item state: the row switch. The breadcrumb appears only at depth 2 or more,
because there is nothing to retrace at the top level.

## A control that lied

The rail drew the same switch used for real toggles, but clicking a rail row NAVIGATES - it never
toggled anything. An affordance that looks operable and is not is worse than no affordance at all.
Removed; the rail carries identity and progress only.

## Also

- The topbar divider floated with nothing after it once the breadcrumb went silent at depth 1.
- "nothing staged" announced that nothing was happening. It is silent now, which makes the count
  appearing the signal.
- Section actions floated as a button pair between the heading and the list, pushing the content
  down. They sit on the header row now, against the thing they act on, and quieter.
- "Remove all" carried the same visual weight as "Install all". Removing should not look like
  adding.

## The part worth keeping

    rendered   clean
    ban sweep  0 violations
    static     0 blocking, 2 warnings

**Identical before and after this pass. None of these defects moved a single audit number.** The
tooling measures contrast and banned properties. Redundancy, and an affordance that lies, are
judgements - and no rule in the registry makes them. Two rounds of "I still see slop" against
three green audits is the clearest evidence yet that a clean audit is evidence about the rules
that exist, not about the design.

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css`
