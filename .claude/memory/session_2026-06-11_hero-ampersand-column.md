---
name: Hero ampersand moved to a reserved right column (no text contact, container-right aligned)
description: Jonah - ampersand must never touch the text and must align horizontal-right with the theme toggle; FX host now lives inside the hero container as a right-anchored column with reserved padding; intro-zoom path found broken (camera ignores configured zoom), switched to fade
type: project
relates_to: [session_2026-06-11_shade-alternation-system.md, session_2026-06-10_hero-canvas-fullbleed.md]
---

Collaborator: Jonah. 2026-06-11. Screenshot showed the ampersand overlapping the hero lede; "i dont want the ampersand to touch the text at all and want it aligned at the horizontal right with the light/dark button always".

## Mechanism
- .hero__fx moved INSIDE .container.hero__inner (markup) and anchored: absolute right 0, top 50% translateY(-50%), width clamp(360px, 34vw, 460px), height min(640px, 110%). Its right edge = container right edge = the topbar/theme-toggle line at every width (both share .container).
- .hero__inner reserves the column: padding-right calc(clamp(...) + space-8) - text geometrically CANNOT enter the ampersand zone.
- <=1024px: .hero__fx display none, padding removed (effect hidden rather than risk contact on narrow screens). NOTE: resize_window verification didn't apply (known cmux/chrome quirk) - rule is in CSS, untested visually.
- svg-3d params: offsetX 0.22 -> 0.1 (right-flush within the column), zoom 8 -> 5, intro 'zoom' -> 'fade'.

## BUG FOUND - svg-3d intro:'zoom' ignores configured zoom (vendored runtime)
With intro 'zoom', changing zoom (8 -> 3 -> 1.5) produced pixel-identical renders; with intro 'none' the camera respects zoom immediately (3 = overcropped huge, as math predicts). The intro path never hands the camera off to p.zoom in the built runtime (grep-for-identifier diagnosis is useless on the minified bundle - identifiers mangle; only param-name strings survive). WORKAROUND: use intro 'fade' (or 'none') whenever a non-default zoom matters. Upstream fix in tilt-lab/runtime/effects/svg-3d source is a follow-up ticket.

## Sizing math (for future tuning)
Mesh normalized to 4 world units (baseScale 4/maxDim). Visible height at distance z: vH = 2*tan(fov/2)*z*responsiveFactor (factor = 1/aspect for portrait canvases). zoom 5 on the ~460x505 column -> glyph ~78% of column height with float-bob headroom; offsetX is a fraction of visible width, +right.

VERIFIED (both themes, real toggle click): glyph fills the column, clear gap to the lede, right edge flush with the container/toggle line; fade entrance plays; no text contact at 1527w. styles.css v25.

Files: marketing-site/index.html (host into container, params, v25 + runtime ?v=3 import), marketing-site/styles.css (hero__fx column, hero__inner reserve, <=1024 hide).
