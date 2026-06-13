---
name: dithered-image transparent background fix
description: dithered-image (post layer) ignored the backgroundColor alpha and rendered an opaque canvas; fixed to honor transparency
type: project
relates_to: [session_2026-06-08_tiltlab-3dsvg-port.md, session_2026-06-08_tiltlab-interactive-grid-post.md]
---

Collaborator: Jonah. 2026-06-10. Repo: ~/Documents/Github/improv.

**Bug (user):** "Dithered image in tilt lab doesn't allow me to set background to transparent. This is a post layer." Correct - a post layer should let its "off" pixels show the beneath layer through.

**Root cause (3 conspiring, grounded in source):**
1. `runtime/effects/dithered-image/index.ts:424` renderer `new Renderer({ canvas, dpr:1, alpha:false })` -> canvas can never be transparent.
2. Frag shader hardcoded `gl_FragColor = vec4(linearToSrgb(ditheredColor), 1.0)` -> alpha always 1.
3. `hexToLinearRgb()` DROPS the picker's alpha (`mix(uBackgroundColor, uColor, dither)` paints bg into off-pixels). The ColorField UI DOES expose an alpha slider (checkerboard preview, emits #rrggbbaa via combineHexAlpha) and color.ts has `rgba01()`/`parseHexColor` (handles `transparent`) - so infra existed; the effect just threw alpha away.

**Fix (all in dithered-image/index.ts):**
- import `rgba01`.
- renderer `alpha:false` -> `alpha:true`.
- shader: + `uniform float uColorAlpha; uniform float uBackgroundColorAlpha;`; output `float a = mix(uBackgroundColorAlpha, uColorAlpha, dither); gl_FragColor = vec4(linearToSrgb(ditheredColor) * a, a);` (PREMULTIPLIED - WebGL canvas default premultipliedAlpha:true, so rgb must be *a; a=0 -> vec4(0) clean transparent, no fringe).
- new `hexToLinearRgba()` helper returning [r,g,b,a]; init parses fg+bg via it; uniforms add uColorAlpha/uBackgroundColorAlpha.
- setParam color/backgroundColor cases update the alpha uniforms too.
- Default backgroundColor LEFT opaque (#17181A) so standalone behavior unchanged; user can now drag alpha to 0.

Status: DONE + verified.
- All edits landed: import rgba01 (dropped now-unused rgb01 + hexToLinearRgb); shader uColorAlpha/uBackgroundColorAlpha uniforms + premultiplied output `a = mix(uBackgroundColorAlpha, uColorAlpha, dither); gl_FragColor = vec4(linearToSrgb(ditheredColor)*a, a)`; renderer alpha:true; hexToLinearRgba helper; init + uniforms + setParam carry alpha. typecheck clean. Rebuilt dist + re-vendored (uBackgroundColorAlpha x3 in bundle).
- VERIFIED LIVE (tilt-lab, real input): stacked Aurora (background) + Dithered Image (post). Before = off-pixels solid #17181A, Aurora hidden. Dragged backgroundColor alpha slider to 0 (Home key on the range input) -> off-pixels TRANSPARENT, Aurora shows through with the orange dither dots overlaid. Exactly the requested post-layer behavior.
- Default backgroundColor stays opaque (#17181A) so standalone unchanged; user opts into transparency via the existing ColorField alpha fader.
- Marketing-site re-vendored but does not use dithered-image -> no hero impact.

Files: tilt-lab/runtime/effects/dithered-image/index.ts; tilt-lab/dist/tilt-runtime.js (rebuilt); marketing-site/tilt-runtime.js (re-vendored). Working tree on main, uncommitted.
