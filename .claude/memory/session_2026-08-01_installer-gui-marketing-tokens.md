---
name: The GUI installer now wears the marketing site's tokens, with real wayfinding - and the craft floor caught itself contradicting the detector
description: Lifted improv-site's tokens verbatim into the installer GUI, replaced the fake-terminal chrome with a real app shell, and made status readable as shape not just hue. Verified in both themes and across four interaction states. Found that scale-on-press was taught one way and enforced another.
type: project
relates_to: [session_2026-08-01_sidecoach-hooks-installed-but-unwired.md, session_2026-07-17_gui-installer-design.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: rendered in a real browser at 4 states (root dark, root light, nested, staged) and every screenshot opened and read; markup integrity checked for tag balance and for all 7 JS-bound IDs plus 32 class hooks; sidecoach detection engine run before and after
confidence: high
---

# The installer wears the brand now (2026-08-01)

Commit stamp at authoring: 762ab095.

Jonah: "redesign the GUI installer to look more like the marketing site... lift the tokens
specifically, nothing else... cleaner, more sturdy interface, more clear markers/wayfinding."

## What was there

323 lines on a Tokyo Night palette (`#16161e`, `#7aa2f7`), monospace throughout, and dressed as a
fake terminal window with red/amber/green traffic-light dots. **Zero semantic sections** - no
header, main, nav or section elements at all. That is why it had no wayfinding: there was nothing
to find your way between.

## What was lifted, and what was not

Tokens copied VERBATIM from `improv-site/styles.css`: the brand red `#DC2618`, ink `#02272B`,
cream `#F4EFE4`, paper `#FAF7EE`, the full text/surface/border/accent ramps, the MADE Awelier /
Hanken Grotesk / JetBrains Mono stacks, and the 4pt spacing, radius, shadow and motion scales.
All three faces are installed locally, so they resolve natively.

**One addition, declared in the file rather than smuggled in:** semantic status colours. The
marketing palette has none because a marketing page never needed them, and install state is this
screen's entire subject. They are derived to sit in the same world - the green carries the ink's
green undertone, the ochre sits with the cream - and are kept deliberately distinct from
`--color-red`, which stays reserved for the brand mark and destructive intent, so "installed" can
never read as "danger".

## The four wayfinding layers

1. **Header** - a real app shell. The traffic lights are gone; they read as a screenshot OF a tool
   rather than the tool, which is the opposite of "sturdy". Wordmark plus "You are here: <path>".
2. **Trail** - the breadcrumb reads as a path, with the current segment in a chip.
3. **Landmarks** - section labels with a rule running off them, so CORE and MORE read as two
   places rather than one long list.
4. **State as SHAPE** - status was a coloured word, depending on hue alone. It is now a pill, so
   the difference is legible before the colour is.

Sturdiness came from a grid. The rows were flex with `ch`-width columns and `white-space:pre`, so
columns drifted whenever a name ran long. Columns now actually line up down the whole list, which
is most of what "sturdy" means here.

**Not touched: the JavaScript.** Every one of the 7 bound IDs and 32 class hooks was verified
present after the rewrite. The behaviour is byte-identical apart from two label strings.

## Verified by rendering it, four states

Root dark, root light, nested (`Setup › Foundation`), and staged. Every screenshot was opened and
read, not just captured.

The first render exposed a real defect the CSS alone did not show: the description column was
crushed to "rules, settin..." and "design orch..." because three fixed columns to its right were
reserving space they rarely use. That column is the only text explaining what a component IS.
Rebalanced so it takes the slack. Also fixed a header reading "setup · setup", a static prefix
duplicating the live path.

## THE FLOOR AND THE DETECTOR DISAGREED

Running the QA gate found `polish.scale-on-press` failing on CSS that follows the craft floor
exactly. The predicate was:

    hasScaleOnPress = (css) => css.includes('scale(0.96)')

A literal substring for the LEGACY function form `transform: scale(0.96)`. The craft floor - the
thing that loads before every UI edit and that I wired up this morning - teaches the modern
property: `.button:active { scale: 0.96; }` with `transition-property: scale`. **A page built
exactly to the floor failed the rule enforcing the floor.**

Fixed to accept both, with the press range bounded to 0.90-0.99 (below that is an animation, not
a press). Verified on four cases: legacy form passes, property form passes, an over-subtle 0.994
still fails, no-press still fails.

Same class as this morning's finding, and the third today: a rule documented one way and enforced
another.

## Judgement calls left standing, with reasons

- `icon-swap-compound` fires on `css.includes('opacity') && css.includes('scale')` - any stylesheet
  containing both words, with no check for an icon or a transition. A false positive by
  construction. Reported, not worked around.
- `staggered-enter` and `subtle-exit` want enter/exit animation patterns. This UI has none.
  Complying would mean ADDING motion that does not exist to satisfy a checker.
- `state-completeness` reports 4/8. A list row has no loading, error or success state. Four is the
  true count for this component.
- The press scale is applied at 0.96 to the ACTION rows, which are genuinely buttons, and at 0.994
  to full-width item rows - 0.96 across 900px is 36px of travel and reads as a glitch. The rule's
  geometry does not hold at that width; the rule is not wrong.

## Files touched

- `claude/installer-gui/index.html` (tokens, shell, wayfinding, grid; JS untouched)
- `sidecoach/src/polish-standard-validator.ts` (`hasScaleOnPress` accepts the property form)
