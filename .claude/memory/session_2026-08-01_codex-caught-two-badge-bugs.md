---
name: Codex found two real defects in the badge-as-checkbox change, and fixing one exposed a third the review had not seen
description: A focused badge pressing Enter navigated instead of toggling, and a group staging one install plus one removal rendered as fully checked. Fixing the first revealed that Enter was not activating the button at all - the keyboard path was dead in both directions.
type: project
relates_to: [session_2026-08-01_badge-becomes-the-checkbox.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: both findings reproduced live before fixing and re-driven with real keypresses after; mixed-state group built by hand in the UI; Space and Enter each confirmed to fire exactly once; detector 0 blocking
confidence: high
---

# What the cross-model review caught (2026-08-01)

Commit stamp at authoring: 65d6ad4e.

Turning the status badge into the install control added a second interactive element to a row that
already had a click handler. Codex reviewed that diff and returned two defects. Both were real.

## 1. The keyboard path went to the wrong place

The global `keydown` handler exempted a focused BUTTON only inside `.topbar,.actionbar,.bulk,.rail`.
The new badge lives in `.rows`, which is in none of them. **Tab to a group badge, press Enter, and
it drilled into the group instead of staging it.**

I widened the exemption to any focused button, since the rows are now divs and nothing in the list
depends on the global handler.

**That fix uncovered a third bug the review had not seen.** With the exemption in place Enter did
nothing at all: no navigation, and no toggle either. Driving Space instead worked, which is what
isolated it - the two keys take different paths through Chromium's button activation, and only
Space was arriving. The button had a dead keyboard path in both directions; the original bug was
merely hiding it behind the navigation it triggered.

Made deterministic rather than left to the native default action: the badge handles Enter itself,
calling `preventDefault` and `stopPropagation` so it fires exactly once and can never fall through
to navigation. Space still activates natively through `click`, and is deliberately not intercepted,
so it also fires once.

**A misread on the way through, worth recording.** My first Enter test after the fix appeared to
still navigate. It did - but because `render()` rebuilds every row on each toggle, the previously
focused button no longer existed and focus had fallen back to `body`. The key was going to the
document because there was nothing focused, not because the exemption failed. Re-testing from a
freshly focused badge is what separated the two.

## 2. A checked box that was lying about the outcome

`on = !!und.ins` meant a group read as CHECKED whenever ANY install was staged under it. Stage one
removal on an installed child and one install on an absent child and the group showed a filled
green box reading `+1 −1 staged` - while remaining partial after Apply. The same value drove the
click, so the next press chose `uninstall` purely because an install existed somewhere below.

The rule this design rests on is that **a filled box means every child will be installed after
Apply**. So the answer is to compute the projection rather than inspect the staging:

    willBeOn(p)      = pending[p] ? pending[p]==='install' : installed[p]
    willAllBeOn(path)= leafPaths(path).every(willBeOn)

Verified in both directions in the live UI: the mixed group renders an EMPTY box with `+1 −1
staged`, and once the last absent child is staged for install the same group flips to
`aria-pressed=true`.

## Why an eyeball pass would not have found either

Both defects need a state you have to go and build: a group holding one staged install and one
staged removal at the same time, and a keyboard focus on a control most people click. Neither shows
up in a screenshot of the default state, and the rendered audit lenses were clean through both.

The audits measure contrast and banned properties. These were logic.

## Files touched

- `claude/installer-gui/index.html`
