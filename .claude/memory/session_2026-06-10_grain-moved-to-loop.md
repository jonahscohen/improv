---
name: Grain FX moved toolkit -> loop (bottom-anchored, brighter), carousel card shadows removed
description: Per Jonah - the grain-gradient stack now mounts behind the loop carousel with ripple origin at the section's bottom center (originY 1), grain opacity 0.08 -> 0.22, multiply dropped (white must glow on the dark plane); .process--arc card shadows removed
type: project
relates_to: [session_2026-06-10_toolkit-grain-multiply.md, session_2026-06-10_loop-carousel-bleed-rework.md]
---

Collaborator: Jonah. 2026-06-10. "Move the grain gradient from the toolkit section to the loop section and anchor the centerpoint of that effect to the very bottom of the section. make the opacity of the grain gradient effect more apparent. remove the drop shadow from the cards within the loop carousel."

- Host moved: .toolkit__fx deleted from the toolkit section; .loop__fx added to the loop section (section--loop now position:relative + isolation + overflow:hidden at base; .section--loop .container z 1). Toolkit keeps only its red-eyebrow rule.
- Mount: querySelector .loop__fx; grain-gradient originY 0.5 -> 1 (ripple emanates from bottom center); grain layer opacity 0.08 -> 0.22; dither post unchanged (0.12).
- JUDGMENT CALL (noted to Jonah): the toolkit's mix-blend-mode multiply was dropped for the loop host - white content multiplied onto the dark loop plane is invisible; normal compositing lets the ripple GLOW, which is the only way "more apparent" works on #1A1A1A. Dark theme caveat: the loop section is WHITE in dark mode, so the white ripple will be subtle-to-invisible there (Jonah's export is white-on-transparent; per-theme effect tuning not in scope).
- Carousel cards: box-shadow md (rest) + lg (focused) removed; box-shadow dropped from the transition list.
- styles.css ?v=18.

Verification: screenshots of the loop section next (this beat written under the dirty-state hook before the browser pass).

Files: marketing-site/index.html (host move, mount params, v18), marketing-site/styles.css (loop FX scoping, toolkit FX scoping removed, card shadows removed).

## CORRECTION - originY is INERT in this configuration (Jonah: "center point is dead center, I wanted bottom")
Shader forensics (grain-gradient vertex shader): `boxOrigin` is applied as `boxOrigin * (objectWorldScale - 1.)`; with worldWidth/worldHeight = 0 the box equals the canvas so objectWorldScale = 1 and the origin term multiplies to ZERO - originX/originY do nothing unless an explicit world size is set. The working lever is `graphicOffset` (offsetX/offsetY), applied unconditionally in canvas-relative units (uv spans -0.5..0.5; positive offsetY moves the pattern center DOWN; center-at-bottom-edge = offsetY 0.5).

Fix: offsetY 0 -> 0.5, originY restored to the inert default 0.5. VERIFIED: section top dark, glow building downward, ring arcs emanating from the bottom-center (the carousel dots zone).

RULE for future grain-gradient anchoring: use offsetX/offsetY (canvas units, +Y down for the pattern center), NOT originX/originY, whenever worldWidth/worldHeight are 0.

## Dither made visible (Jonah: "where is the dithering shader? layer it on top")
It was layered all along (dithered-image post in the stack) but INVISIBLE: its dot color was still #000000 from the toolkit-on-paper days - black bayer dots on the #1A1A1A loop plane render as nothing. Fix: color #ffffff (dots quantize the glow as light), pixelSize 1 -> 2 (chunkier, legible), opacity 0.12 -> 0.5, bg #00000000. VERIFIED (zoom): dense white bayer clusters tracking the ripple's bright zones, sparse in dark mid-tones, field thickening toward the bottom-anchored center; headline/lede/cards all still legible (speckle shows through the translucent card surfaces - acceptable). RULE: dither post dot color must contrast the SECTION it sits on - black-on-paper, white-on-ink/contrast.

## Cards to true 100% + FX container knocked back (Jonah)
Jonah asked "are the cards 100% opacity?" - they were NOT, on two counts: distance-dimming (0.8/0.55 element opacity) and a 10%-alpha surface fill (surface-on-inverse-subtle) letting the dither bleed through. Per his instruction: (1) all carousel cards element opacity 1 (dimming removed, incl. the wrap-jump virtual slot), (2) SOLID fill `color-mix(in srgb, var(--surface-contrast) 90%, var(--text-inverse))` - steps lighter on the dark plane in light theme, darker on white in dark theme, opaque in both; (3) `.loop__fx { opacity: 0.075 }` knocks the whole shader stack to subtle (per-layer 0.22/0.5 retained beneath the container dial). v19. VERIFIED via zoom: speckle stops at card edges, corner cards as solid as the focused card, dither field quiet.
