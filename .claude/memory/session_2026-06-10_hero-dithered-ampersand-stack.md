---
name: Hero retrofit - svg-3d ampersand + dithered-image post (transparent bg)
description: Two-layer tilt-lab stack into the hero; the dither post layer now uses a transparent background (the fix shipped earlier today)
type: project
relates_to: [session_2026-06-10_dithered-image-transparent-bg.md, session_2026-06-09_svg3d-offset-param-hero-fullbleed.md]
---

Collaborator: Jonah. 2026-06-10. Repo: ~/Documents/Github/improv.

User pasted a 2-layer tilt-lab stack to retrofit as the hero bg: svg-3d (midground, 8-bit ampersand, material default, metalness 0.6, roughness 0.35, color #e32400, zoom 8, fov 50, lightIntensity 1.1, ambient 0.45, spinFloat speed 1, intro zoom) + dithered-image (post, bayer4x4, threshold -0.02, color #e32400, backgroundColor **#17181a00 = TRANSPARENT**). The transparent dither bg only works because of the dithered-image alpha fix shipped earlier today ([[session_2026-06-10_dithered-image-transparent-bg.md]]).

**Two swaps from the raw export (both flagged to user):**
1. svg-3d.source `blob:http://localhost:5180/...` (dead session handle) -> vendored `./assets/ampersand.svg`.
2. svg-3d.offsetX kept at **0.22** (export had 0 = centered; tilt-lab always centers its preview, so 0 is "didn't touch it" not "center in hero"; a centered ampersand collides with the left-set "Improv" headline). Right-quadrant preserved. One value to flip to 0 if the user actually wants centered.

Everything else applied verbatim. Hero CSS unchanged (.hero__fx inset:0 full-bleed). Runtime already re-vendored today with both svg-3d + the dither alpha fix (verified: svg-3d x1, uBackgroundColorAlpha x3 in marketing-site/tilt-runtime.js).

Compositor note: dithered-image (post) samples the svg-3d (midground) beneath via onBeneath; transparent svg-3d areas -> luminance ~0 -> dither off -> now transparent (page shows through), so the result is a dithered red ampersand over the page, not a solid dark field.

Status: DONE + verified.
- VERIFIED (Chrome desktop, fresh load): the red 3D ampersand renders DITHERED (visible bayer4x4 grain), the dither background is TRANSPARENT (dark teal page shows through the off-pixels, NOT a solid #17181A block - confirms today's dither alpha fix works end-to-end in the hero), ampersand held in the right quadrant (offsetX 0.22), text/lede/CTA clean on the left. Bleeds off the right edge.
- Closes the loop: the dithered-image transparent-bg fix is exactly what makes this hero composition possible.

Files: marketing-site/index.html (hero mount script). Working tree on main, uncommitted.
