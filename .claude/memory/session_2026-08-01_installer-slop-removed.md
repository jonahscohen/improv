---
name: The audits passed a card-stack because the genericity checker is a keyword grep - Jonah caught the slop by eye
description: Five identical rounded cards with icon plus heading plus text, state double-encoded as a dot AND a pill saying "installed" four times out of five, and counts reading 9/9. All of it passed every audit. Rebuilt as a real preferences list with switches.
type: project
relates_to: [session_2026-08-01_installer-taste-audit.md]
supersedes: session_2026-08-01_installer-taste-audit.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: rendered and read at four states after the rebuild; all three audits re-run; the switch-does-not-move flaw found by driving a real keypress and looking at the result
confidence: high
---

# "I see slop patterns" (2026-08-01)

Commit stamp at authoring: 9ad3538b.

Jonah said it in five words and he was right. The audits had just returned clean.

## What was slop

1. **Five identical rounded cards**, each icon + name + description + badge, stacked as the page
   structure. That is verbatim the shape the craft floor bans, and I built it while the floor was
   loading into my context on every write.
2. **State double-encoded**: a coloured dot AND a coloured pill saying the same thing on the same
   row.
3. **The pill read "installed" on four rows out of five.** Badging the majority state is
   decoration; only the exception carries information.
4. **Rail counts `9/9`, `11/11`, `5/5`, `6/6`** - five of nine groups announcing "all of them".
5. **"MORE"** as a section label, which is a shrug rather than a category.

## Why every audit passed it

`identical_card_grids` in `design-laws.ts` is:

    checker: (code) => /grid|repeat.*card|same.*card/.test(code.toLowerCase())

A keyword grep against raw text. It cannot see that five siblings share a shape, and it fires on
any stylesheet containing the word "grid". `polish.anti-pattern-genericity` came back INCONCLUSIVE
in every run - it never measured at all.

**So the tooling cannot see this class of defect, and I leaned on it instead of looking.** The
rendered lenses caught contrast, which is arithmetic. Genericity is a judgement, and no rule in
the registry makes it.

## What it is now

A preferences list, not a card stack: hairline separators, one shared plane, the eye running down
a single edge. State appears once, as a **switch** - the control you are actually operating -
rather than as a dot plus a badge. Counts appear only on the three groups that are incomplete.
Sections are "The suite" and "Add-ons".

## The flaw I introduced and caught by driving it

The switch showed CURRENT state, so staging a change left it unmoved: I pressed enter, the switch
did not move, and only a small label changed. **A switch that does not move when you flip it is
worse than the badge it replaced.** It now shows what WILL be true, with a dashed border meaning
not-yet-applied, and the label carrying "will remove". Flip it, it moves, the dash says it has not
happened.

Found by pressing the key and looking at the screenshot, not by any checker.

## Also fixed while in there

The narrow-viewport rule still described the OLD row structure (glyph + text + stat), so it
overrode the new grid and stranded the switch mid-row. And the footer's hint held a 16rem
flex-basis, which pushed Apply onto its own line - the primary action falling off the row it
belongs to.

## Audits after

    rendered objective + subjective   clean
    anti-pattern ban sweep            0 violations
    static                            0 blocking, 2 warnings

The two warnings want enter and exit animation patterns this UI does not have.

**The lesson is not "run more audits".** It is that a clean audit is evidence about the rules that
exist, not about the design. Jonah looked at it for two seconds and saw what six audit runs could
not.

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css`
