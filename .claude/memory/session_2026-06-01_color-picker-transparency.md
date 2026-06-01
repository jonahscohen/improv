---
name: color picker transparency (alpha) - picker + shared parser + parser hardening
description: User: "color picker should allow for transparent values." Native <input type=color> can't do alpha, so added an alpha fader + checkerboard swatch emitting #rrggbbaa. Created a shared color parser and routed the 8 effect parsers that mis-read 8-digit hex (>>16 on the full int) through it so transparency never corrupts a color. Chrome-verified the picker. Scope chosen by user: picker + background colors (bg-alpha rendering is the next stage).
type: project
relates_to: [session_2026-06-01_layer-order-honored.md]
---

Collaborator: Jonah. 2026-06-01.

## Ask + chosen scope
"color picker should allow for transparent values." Via AskUserQuestion the user chose **picker + background colors** (vs picker-only or all-effects). So: full alpha in the picker, harden every parser, and (next stage) honor alpha on background-color params.

## Stage A (this commit) - picker + safe parsing
- runtime/color.ts (NEW, shared): parseHexColor(input) -> {r,g,b,a} 0..1, tolerant of #rgb/#rgba/#rrggbb/#rrggbbaa + "transparent" + missing #; plus rgb01/rgb255/rgba01/toCssRgba/splitHexAlpha/combineHexAlpha. 11 unit tests (incl. the "naive parseInt mis-reads 8-digit" regression). The key bug class: `parseInt(hex,16) >> 16` reads GREEN from an 8-digit #rrggbbaa, not RED.
- ColorField.tsx/.css: native <input type=color> (RGB only) overlaid invisibly on an alpha-aware preview over a CHECKERBOARD, plus an alpha range fader (track = transparent->color over checker). Emits #rrggbb when opaque, #rrggbbaa when translucent (keeps defaults/presets clean).
- Hardened the 8 parsers that mis-read 8-digit hex by delegating to the shared parser: globe.hexToRgb, swarm.hexToRgb(0..255), fluid.hexToVec3, lib/fluid-solver.hexToLinearRGB (feeds fractal-glass/halftone/fluid base colors), halo/dithered-image/mc-globe.hexToLinearRgb (keep srgb->linear), fractal-glass.hexToHSL. Slice-based parsers (aurora/neural-noise/ascii/specular-band/lava-lamp) and the hexToRgba ones (animated-gradient/neuro-noise/grain-gradient) already handled 8-digit and were left as-is.
- tsc 0, 239 tests (228 + 11 color).

## Verified in Chrome (tabId 1827119115)
Added Lava Lamp -> color row shows swatch + alpha fader + #17181A. Dragged the fader to ~45% -> hex became #17181A73 and the swatch shows the checkerboard through the translucent colour. Lava Lamp still renders (its parser safely drops alpha). Picker "allows transparent values" CONFIRMED.

## Stage B (NEXT, same scope) - honor alpha on background colors
Wire alpha so a transparent background color lets the layer beneath show through, for: fluid.bgColor, swarm.bgColor, dithered-image.backgroundColor, halo.backgroundColor, specular-band.backgroundColor, grain-gradient.colorBack, neuro-noise.colorBack, aurora.skyColor1/2. Per-shader (fragment output alpha / rgba fill). Verify one end-to-end over a lower layer.
