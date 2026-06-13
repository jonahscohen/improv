---
name: tilt-lab interactive-grid reclassified midground -> post (hero overlay)
description: Made the Interactive Grid effect a post layer that distorts the composited scene beneath it, per user request to overlay an entire hero section
type: project
---

Collaborator: Jonah. 2026-06-08. Repo now at ~/Documents/Github/improv.

User: "interactive grid should be post - i want it to overlay an entire hero section."

**What changed (2 files in tilt-lab/runtime/effects/interactive-grid/):**
1. `manifest.json`: `layerRole` midground -> **post**; `requiredAssets` `["image"]` -> `[]` (overlay needs no upload - input is the beneath composite); tags `"midground"` -> `"post","overlay"`.
2. `index.ts`: added `onBeneath(source)` mirroring the proven sibling **water-ripple** (same OGL `uTexture`/`uTextureSize`/`getCoverUV` shader). It uploads the compositor's beneath-composite canvas into `imageTexture` each frame and sets `uTextureSize` from it, so the cursor-driven grid warps the real hero content below instead of the bundled `assets/image.jpg`.

**Why this works:** the Compositor (runtime/compositor.ts ~L200) feeds a `post` layer the composited scene beneath via `effect.onBeneath(canvas)` for WebGL effects (the Canvas2D blit path can't reach a GL surface). interactive-grid had no `onBeneath`, so flipping the flag alone would have rendered nothing useful. water-ripple is the exact template (OGL distortion post). At rest the grid passes the beneath through; cursor velocity injects displacement.

**Verified (live, real input):** vite HMR reloaded clean (no error overlay). UI card + stack panel show `Interactive Grid POST`. Stacked Aurora (background) + Interactive Grid (post): live preview renders **Aurora through the grid** (not the old bundled photo, not black) = onBeneath sampling the beneath confirmed. Rebuilt `dist/tilt-runtime.js` (npm run build, exit 0): bundle has `layerRole:post` for interactive-grid and `onBeneath` (7 effects). So Copy-embed exports carry the overlay.

**Test-safety:** catalog.test.ts post-filter assertion uses a fixture (not real manifests); interactive-grid/index.test.ts only validates the manifest + pointer handlers - both still pass.

Status: DONE in working tree on `main` (uncommitted). Tilt-lab dev server live on :5180 (pane surface:18).

Files: tilt-lab/runtime/effects/interactive-grid/manifest.json, index.ts; rebuilt tilt-lab/dist/tilt-runtime.js.
