---
name: The WILL INSTALL badge got a real marching-ants border, after two techniques that could not trace a curved pill and a stray specificity rule that made the third one look identical to both
description: A diagonal-stripe mask clipped badly on the pill's rounded ends. Four sliding gradients traced a rectangle correctly but only by giving up the pill shape entirely. The SVG-stroke fix that actually works was invisible for three iterations because .check svg{width:13px;height:13px} - written for the checkbox icon - was silently overriding it.
type: project
relates_to: [session_2026-08-01_badge-becomes-the-checkbox.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: two full-page screenshots 250ms apart cropped to the identical region and diffed with imagemagick compare - 64.9 differing pixels, proving real motion; shape confirmed as a true traced capsule at 4x pixel-zoom; machine state restored and detector/suite re-run clean
confidence: high
---

# Real ants, eventually (2026-08-02)

Direct order: "will install badge should have animated marching ants border."

## Why a border can't do this

CSS has no property that animates a border's own dash phase - `border-style:dashed` is static.
Every approach here is some way of faking motion with something that CAN animate.

## Two attempts that could not trace a curve

**Attempt 1 - diagonal stripe under a mask.** A `::before` sized to the pill, a
`repeating-linear-gradient(-45deg, ...)` background, masked down to a thin ring via
`mask-composite:exclude`. Reads fine on a plain rectangle. On a genuine capsule (`border-radius:
var(--r-full)`, fully rounded ends) it clipped into a lopsided blob - Jonah: "that looks bad."

**Attempt 2 - four sliding gradients, one per edge.** Jonah handed over the exact standard
technique for this (a real production CSS pattern: four `linear-gradient` layers, `repeat-x`/
`repeat-y`, each animated along its own axis). It traces a RECTANGLE correctly - each side gets an
actual straight run to slide along - but a pill's left and right edges are pure curve, nothing for
a straight-sliding strip to trace. Making it look right meant dropping the badge to a small rounded
rect instead of a pill: "it stopped looking like a pill and its too thick."

Both are real, working techniques for the shape they're built for. Neither can trace a genuinely
curved outline while staying thin, because a background is a flat plane sliding under a mask, not
a path - and the badge needed to STAY a pill.

## The technique that actually traces a curve

A path is what an SVG stroke is. `ANTS_RING` is a `<rect>` with `rx`/`ry` set to the SAME absolute
value (8.5px, half the badge's fixed 19px height), `stroke-dasharray:2.5 2.5`, and `stroke-dashoffset`
animated by exactly one dash-pair (5px) so the loop restarts with no visible jump. `rx`/`ry` can't
both be percentages here: an SVG percentage on `rx` resolves against the rect's WIDTH and on `ry`
against its HEIGHT independently, and on a pill far wider than tall those clamp to wildly different
radii - `rx:50%` gave a corner radius roughly matching half the badge's WIDTH, `ry:50%` gave one
matching half its height, and the mismatch between them is what produced a lopsided partial arc, not
a stadium. Because the badge's height never varies (only the text width does), hardcoding the SAME
absolute radius for both axes sidesteps the whole percentage-reference problem.

## Three iterations of the SAME visual bug, from an unrelated rule

The first SVG version STILL looked exactly like the earlier broken attempts - a small arc bunched
near the icon. Two different theories were tried and both produced byte-for-byte identical
screenshots: first assuming the SVG's own percentage children needed real `width`/`height`
ATTRIBUTES rather than CSS (a genuine, separate correctness fix, worth keeping), then suspecting
browser HTTP caching and forcing a cache-busted navigation. Neither changed the render at all,
which was itself the signal that the bug wasn't where either theory was looking.

The actual cause: `.check svg{width:13px; height:13px; display:block; flex:0 0 auto;}` - written
for the checkbox glyphs - matches EVERY svg inside `.check`, including the ants ring, and beats a
bare `.ants-ring` on specificity ((0,1,1) vs (0,1,0)). It was silently shrinking the whole ring to
13x13px the entire time. The tiny arc that survived three different geometry rewrites was that
13x13 box, not the pill's outline - the geometry was never the problem after the first fix; the
sizing rule fighting it was. Fixed by scoping the ring's rule to `.check svg.ants-ring`, which
outranks the icon rule on specificity.

**Confirmed by identical output across genuinely different code**, which is worth naming as a
signal in its own right: when two real changes to two different properties produce pixel-identical
screenshots, the bug is almost never in either change - it's something upstream overriding both.

## Verifying the motion itself

A single screenshot cannot prove an animation is running, only that a frame looks right. Two full
screenshots taken 250ms apart, cropped to the identical pixel region with `magick -crop`, and diffed
with `magick compare -metric AE`: 64.9 differing pixels. A frozen ring would read 0.

## Files touched

- `claude/installer-gui/index.html` (ANTS_RING constant, appended only to a will-install badge)
- `claude/installer-gui/styles.css` (`.check svg.ants-ring`, `.ants-ring rect`, `@keyframes ants-march`)
