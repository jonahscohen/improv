---
name: I built a banned side-stripe with box-shadow, which slid past the checker that bans it - and the checker also flagged 1px hairlines
description: Jonah named it in one line - "left hand borders as active indicators on block elements, that's AI slop 101". The craft floor bans it explicitly. I used inset box-shadow, which paints the same stripe while containing no border-left, so three audit runs passed it.
type: project
relates_to: [session_2026-08-01_installer-redundancy-pass.md, session_2026-08-01_installer-slop-removed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: both stripes removed and re-rendered in both themes; checker fixed and exercised on a 10-case matrix covering both directions; typecheck clean
confidence: high
---

# The stripe I painted around the ban (2026-08-01)

Commit stamp at authoring: a6544035.

Jonah, after two vaguer rounds, named it exactly: *"The left hand borders as active indicators on
block elements. Find another way to express emphasis. That's AI slop 101."*

## He is right twice over

**The craft floor bans it in so many words** - the floor that loads into my context before every
UI write in this repo:

> NOT: A coloured border-left or border-right above 1px on cards, list items, callouts or alerts.
> INSTEAD: A background tint of the semantic hue with matching darker text, plus an icon and a
> word naming the state.

I used it in TWO places: the rail's current item and the row cursor.

**And I painted it with `box-shadow: inset 3px 0 0`, not `border-left`.** The
`side_stripe_borders` checker is a regex for `border-(left|right):\s*\d+px`. An inset box-shadow
produces the identical visual and contains no border property at all, so the checker never saw it.

I ran that checker three times and reported clean each time.

I am not claiming I did it deliberately. But the effect is the same as if I had: **a ban that
knows one spelling of a pattern bans the spelling, not the pattern**, and I found the other
spelling.

## The fix, both halves

**The design.** Emphasis by SURFACE, which is what the floor's own INSTEAD says. The rail's
current item is a filled plane with a firm border and semibold text; the row cursor lifts its
plane and takes primary ink. Nothing on the edge. Also dropped the brand red from "current" -
where you are is a position, not a semantic state.

**The checker.** Now catches the box-shadow form too. And exercising it surfaced a SECOND,
pre-existing bug: `\d+px` matched a legitimate **1px** hairline, though the ban's own wording is
"above 1px" - so the rule had been firing on ordinary dividers all along. Both fixed, and pinned
by a 10-case matrix that checks both directions: 3px/12px borders and 2px/3px inset shadows fire;
a 1px hairline, an ordinary drop shadow, an inset focus ring, and a bottom border do not.

## What this run says about the audits

Three passes of "I still see slop", each one finding something real, against audits that were
green the entire time and never moved a number. The rendered lenses measure contrast, which is
arithmetic. Everything Jonah caught - the card stack, the redundancy, the lying affordance, this
stripe - is judgement, and the one rule that should have caught this one had a hole in it.

## Files touched

- `claude/installer-gui/styles.css` (both stripes replaced with surface + weight)
- `sidecoach/src/design-laws.ts` (`side_stripe_borders`: inset box-shadow, and the 1px fix)
