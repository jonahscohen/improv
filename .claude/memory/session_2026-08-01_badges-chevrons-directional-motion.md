---
name: Badges replace switches, drillable rows get a chevron, and navigation animates directionally - after an animation that hid the content for 9 seconds
description: The switch promised a directness the staged/apply model does not have. Status is a badge now, a row that opens says so with a verbatim Lucide chevron, and moving through the tree slides forward or back. The first animation used fill-mode both and left the pane invisible.
type: project
relates_to: [session_2026-08-01_side-stripe-dodge.md, session_2026-08-01_installer-redundancy-pass.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: both slide directions caught MID-FLIGHT and measured by pixel offset (forward +18px, back -19px) with content legible throughout; chevrons confirmed on drillable rows and hidden on leaves; all three audits clean
confidence: high
---

# Badges, chevrons, and motion that says which way (2026-08-01)

Commit stamp at authoring: 110d88a7.

Jonah: "those toggles aren't helping to create a clear visual language, use a proper badge to
indicate status. also if there's a sub nav, show an arrow! once clicked, use transition animations
to indicate moving forward or backward in the tree."

## The switch was promising something the model does not do

A switch means flip it and it takes effect. This installer STAGES and then APPLIES. So the
control was making a promise the system does not keep, which is why it never settled into a clear
language - I had already had to invent a dashed border to mean "moved but not really".

Status is a badge now: one shape, colour carrying the whole reading. Quiet when a thing is as
expected (`installed`, `not installed`), coloured only when it is not (`4 of 5`), and a dashed
outline for pending, because nothing has happened yet.

## The affordance that was simply missing

Nothing distinguished a row that TOGGLES from a row that NAVIGATES. Drillable rows now carry a
`lucide:chevron-right`, path verbatim from the marketing site's own copy, with its
`data-icon-source` marker. Leaf rows get an invisible spacer so the badge column stays aligned.

## Directional motion, and the version of it that had to be thrown away

Forward enters from the right, back enters from the left. The rail is deliberately EXEMPT -
switching between siblings is lateral, not forward or backward, and animating it would say
something untrue about where you went.

**The first implementation hid the content.** It faded from `opacity:0` with
`animation-fill-mode: both`, and `both` applies the from-state whenever the animation is not
actively advancing. A stretched test showed the pane **blank for nine seconds**. An animation
whose failure mode is "the content is gone" is not a cue, it is an outage waiting for a slower
machine.

Rewritten to animate the TRANSFORM ONLY, no opacity and no fill-mode. Worst case is now content
sitting 20px off-centre, which is a blemish rather than a disappearance.

**Both directions verified mid-flight**, which is the only way to check motion. Forward: title at
x=317 against a settled x=299. Back: title at x=280. Opposite offsets, content fully legible in
both.

## A bug the verification caught

`navDir='fwd'` was never set - my edit had not matched the real line in `activate()`, so drilling
IN never animated while every back path did. The stretched capture is what exposed it; at 190ms it
would have looked like a slightly abrupt transition and nothing more.

## Audits

    rendered   clean
    ban sweep  0 violations
    static     0 blocking, 2 warnings

Icon provenance markers: 4 (two Lucide icons, the chevron, the wordmark).

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css`
