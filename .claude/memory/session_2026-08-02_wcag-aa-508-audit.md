---
name: A real WCAG 2.1 AA / Section 508 audit of the installer GUI - axe-core found 4 real contrast failures, and manual keyboard testing found every toggle strands focus at the top of the page
description: Jonah asked whether the installer is AA/508 compliant. Answered with real tooling (axe-core injected into the live app across both themes and multiple states) rather than eyeballing, then fixed everything it and manual keyboard testing found. Section 508 and WCAG AA are the same technical standard for web content since the 2018 Refresh - one audit answers both.
type: project
relates_to: [session_2026-08-02_display-labels-vs-install-keys.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations across both themes x {default, staged-install, staged-remove, enabled Apply, toast} = 8 distinct states scanned; keyboard focus-retention fix confirmed behaviorally (toggle, then toggle again with no re-tab, correctly reverts - proving real focus, not the sel-index fallback); component-browser suite 147/0; all disk state restored
confidence: high
---

# Answering with tooling, not judgment (2026-08-02)

Jonah: "is the installer gui...AA compliant? 508 compliant? commit our work and let's see how we
can address both."

**508 and WCAG AA are not two audits.** Since the 2018 Section 508 Refresh, the federal standard
for web content IS WCAG 2.0 Level AA (2.1 AA is a superset). One real audit against WCAG 2.1 AA
answers both questions at once - there is no separate 508 checklist for web content.

## Real tooling, not eyeballing

`@axe-core/cli` ran clean (0 violations) against the DEFAULT page load - but that is one static
snapshot of a single-page app with many states. Injected the real axe-core bundle (found cached
from the CLI's own npx install) into the LIVE, already-open browser tab via a `<script src>` tag -
the sanctioned "bundle setup" pattern, not a validation shortcut - so `axe.run()` could scan actual
post-interaction DOM: staged installs, staged removals, the enabled Apply button, a live toast, and
both themes. 8 distinct states scanned this way.

## What axe found: 4 real color-contrast failures

    .rail__label (light theme)              3.23:1, need 4.5:1
    .btn--danger text (both themes)          4.22 / 4.37:1, need 4.5:1
    .is-staged.will-remove badge text (both) 3.45 / 3.59:1, need 4.5:1
    #btnApply enabled, white-on-red (dark)   3.61:1, need 4.5:1

The badge-text failure only showed up because axe scanned the ACTUAL composited background (the
translucent red tint sitting over a selected/hovered row), not the flat token value alone - a case
none of this session's earlier manual contrast checks had caught, because they never scanned that
specific composite.

## Fixed with new tokens, not by touching --red globally

`--red` itself is used all over (borders, rings, fills) where 3:1 is the real requirement, so
darkening or lightening it globally would have been the wrong lever - a border or ring failing
nothing yet doesn't mean it has room to spare. Two new tokens instead:

- `--red-text` - a variant calibrated for red rendered AS text (darker in light theme, lighter in
  dark, since text needs to stand OUT from its ground in opposite directions per theme). Used by
  `.btn--danger` and the staged-remove badge.
- `--red-solid` - a variant for red used as a FILL behind white text. Identical to `--red` in
  light theme (which already passed as a fill), but darker in dark theme specifically, since the
  SAME light-theme-legible-as-text red is too pale to hold white text on top of it as a button
  surface. Two different failure directions needed two different tokens, not one "more accessible
  red" - a single fix would have overcorrected one and undershot the other.

`--text-tertiary` (rail section labels) was simply too light in light theme; darkened directly,
verified with axe until it cleared 4.5:1 (first attempt landed at 4.43, short by a hair - nudged
again).

## The keyboard finding axe cannot see at all

Real Tab-key navigation (not synthetic DOM reads) confirmed keyboard operability works - 14 real
Tab presses landed exactly where expected, Enter activated the checkbox. But `render()` wipes and
rebuilds `#rows` on every single toggle, which destroys whatever had real focus. Confirmed the loss
with a definitive behavioral test: toggle a checkbox, then Tab once and Enter without knowing where
focus landed - neither of the two predicted outcomes happened (the theme didn't flip, the next row
didn't toggle), and checking the ORIGINAL row showed it had reverted - proving focus fell to
`<body>` and the GLOBAL keydown handler's `sel`-index fallback (a mechanism entirely separate from
real DOM focus) was doing the work instead. Every toggle was silently returning a keyboard user to
the top of the page.

Fixed with `refocusCheck(i)`: after a toggle rebuilds the row list, refocus the checkbox at the
same index, since toggling never changes row count or order - same fix applied to the Install
all/Remove all bulk buttons, which rebuild the SAME way. Verified behaviorally again: toggle, then
toggle again with no Tab in between - it correctly reverted, which only happens if real focus is
genuinely on the new element (the `sel`-fallback would have produced the identical-looking result
either way, which is exactly why the first test wasn't conclusive on its own).

## A testing-environment artifact worth naming so it isn't mistaken for a defect

Tab-key presses dispatched by this browser automation harness never rendered a visible
`:focus-visible` ring in any screenshot, even though focus demonstrably worked (confirmed by the
Enter-activation behavior above). Using `cmux browser focus` (a different underlying mechanism)
on the same element DID show the ring correctly. This is a known class of limitation with
CDP-dispatched synthetic key events versus genuine hardware input, not a product defect - the CSS
has exactly one `outline` declaration in the whole file, with nothing overriding it. Recorded so a
future session doesn't re-diagnose the same non-issue.

## Verified clean, nothing left staged

axe: 0 violations across all 8 scanned states. `test-component-browser.sh`: 147/0. All disk state
restored - nothing was actually installed, removed, or applied to the real machine during testing.

## Files touched

- `claude/installer-gui/styles.css` (`--text-tertiary`, `--red-text`, `--red-solid`, four consumers)
- `claude/installer-gui/index.html` (`refocusCheck`, wired into the toggle and bulk-action handlers)
