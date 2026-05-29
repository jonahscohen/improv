# tilt-lab asset-delivery - team brief

The functional gap: 9 effects declare `requiredAssets` but the runtime hardcodes `assets: {}` (compositor.ts ~lines 85/87, and element.ts), so they render PROCEDURAL FALLBACKS instead of real content. Wire real asset delivery so every effect FUNCTIONS with real ingredients. "Leave nothing out."

Read first: .claude/memory/session_2026-05-29_tilt-lab-asset-gap-FAILURE.md (the gap + plan).

## The asset-delivery CONVENTION (implement exactly this)
1. Each effect with requiredAssets gets `runtime/effects/<id>/assets.ts`:
   ```ts
   // resolves to a real URL in BOTH Vite (playground) and esbuild (bundle)
   export const assets: Record<string, string> = {
     <assetKey>: new URL('./assets/<file>', import.meta.url).href,
     // ...one entry per requiredAssets key, exact key names
   };
   ```
2. `runtime/index.ts`: build `export const effectAssets: Record<string, Record<string,string>>` by importing each effect's assets module (effects without assets.ts simply have no entry).
3. `runtime/compositor.ts` + `runtime/element.ts`: replace `assets: {}` with `assets: effectAssets[config.effectId] ?? {}` (compositor) and the manifest id (element wrapper). Effects already load opts.assets[key] and fall back if absent - so delivering real URLs makes them use real content.
4. `build.js` (esbuild): add `loader: { '.png': 'dataurl', '.jpg': 'dataurl' }` so the runtime bundle inlines assets (Vite handles `new URL(...import.meta.url)` natively - no Vite change needed).

## requiredAssets per effect (exact keys) + current assets/ state
- cursor-trail [item1,item2] - HAS item1.png,item2.png
- grain-gradient [noiseTexture] - HAS noise.png
- mc-globe [landTexture] - HAS land-texture.png
- water-ripple [image, water-ripple-brush] - HAS water-ripple-brush.png; MISSING `image`
- dithered-image [src] - EMPTY (need a sample photo-like image)
- fake-3d-image [colorSrc, depthSrc] - EMPTY (need a color image + a grayscale depth map)
- interactive-grid [image] - EMPTY (need a sample image)
- glass-slideshow [image0, image1] - EMPTY (need 2 distinct sample images)
- infinite-gallery [image0, image1, image2] - EMPTY (need 3 distinct sample images)

## Generating the missing sample images
Generate real raster PNGs (do NOT leave dirs empty). Acceptable: render colorful gradient/photo-like test images via a tiny node script (node canvas / sharp / or hand-built PNG), distinct per slot. depthSrc = a radial/linear grayscale gradient (near=white far=black). Keep them small (e.g. 512x512, <100KB). Commit the PNGs into each effect's assets/.

## Rules
- Use hyphens, never em dashes. Headless-guard stays intact.
- Verify: `cd tilt-lab && npx tsc --noEmit` + `npx vitest run` + `node build.js` (bundle must still build with the png loader) all green.
- Report precisely what you wired + which assets you generated.
