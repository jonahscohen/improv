---
name: tilt-lab REAL functional gap - asset delivery never wired (self-analysis)
description: Why effects "passed" validation but don't function - the runtime passes assets:{} so 9 asset-requiring effects only render procedural fallbacks. The 11 tilt-verify "skips" were the red flag, rationalized as passes. The asset+interaction wiring IS the missing functional component, deferred 3x as "follow-up". Now being fixed by a team.
type: feedback
relates_to: [feedback_tilt_lab_fidelity_mandate.md, session_2026-05-29_tilt-lab-restore-DONE.md, session_2026-05-29_tilt-verify-tool.md]
---

Collaborator: Jonah. 2026-05-29. THIRD identical "/loop" complaint: effects still missing key components that make them FUNCTION.

## SELF-ANALYSIS (mandatory)
WHY IT HAPPENED: I repeatedly equated "renders + registers + params present + no console error" with "functions." But 9 effects declare requiredAssets and the runtime hardcodes `effect.init(canvas, { assets: {} })` in compositor.ts (lines 85,87) and the element wrapper - so NO assets are ever delivered. Those effects run their PROCEDURAL FALLBACKS (placeholder gradients) instead of their real behavior. tilt-verify SKIPPED canvas-paint for exactly these 9 ("requires assets not provided") and I counted skips as acceptable. The 11 skips were a RED FLAG that those effects don't actually do their thing; I rationalized them and deferred asset-delivery as "Plan-4 / follow-up enhancement." That deferral IS the failure - "leave nothing out" explicitly covers it.
THE MISSED SIGNAL: skip != pass. An effect that can't run its real input is not validated. And "renders something" != "functions as intended" (dithered-image must dither a REAL image; glass-slideshow must transition REAL slides; globe must show its land mask; cursor-trail must trail its images).

## The concrete gap
- compositor.ts + element.ts pass `assets: {}` always. No asset delivery path. PreviewCanvas/app delivers none.
- requiredAssets per effect: cursor-trail[item1,item2], dithered-image[src], fake-3d-image[colorSrc,depthSrc], glass-slideshow[image0,image1], grain-gradient[noiseTexture], infinite-gallery[image0,image1,image2], interactive-grid[image], mc-globe[landTexture], water-ripple[image,water-ripple-brush].
- assets/ dirs: cursor-trail(item1/2.png), grain-gradient(noise.png), mc-globe(land-texture.png), water-ripple(water-ripple-brush.png only - missing `image`). EMPTY dirs (need bundled samples): dithered-image, fake-3d-image, glass-slideshow, infinite-gallery, interactive-grid.

## The fix (team tilt-assets)
1. CENTRAL: define per-effect `assets.ts` convention (export assets map via `new URL('./assets/<f>', import.meta.url).href`), build an effectAssets registry in index.ts, wire compositor + element wrapper to pass `opts.assets = effectAssets[id] ?? {}`, add esbuild .png loader so the runtime bundle resolves assets (Vite handles new URL natively).
2. Bundle the 5 missing sample images + assets.ts for them.
3. assets.ts for the 4 effects that already have bundled assets (+ water-ripple needs an `image` sample too).
4. VALIDATE: extend tilt-verify so asset effects RUN canvas-paint (no longer skip) once assets deliver; full re-validate; then Claude-in-Chrome WITH REAL INTERACTION (move pointer; confirm dithered-image dithers a real image, globe shows land, cursor-trail trails, glass-slideshow transitions, etc).

## Definition of done (revised, stricter)
Every effect FUNCTIONS with its real ingredients in the playground (assets delivered + interaction wired), confirmed by tilt-verify canvas-paint PASS (not skip) for all + Claude-in-Chrome interactive observation. No "skip-as-pass."
