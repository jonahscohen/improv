---
name: Port 3dsvg into tilt-lab as a background effect (1:1)
description: Adding renatoworks/3dsvg (SVG->3D extrusion, Three.js) as a tilt-lab background effect, faithful 1:1
type: project
relates_to: [session_2026-06-08_tiltlab-interactive-grid-post.md]
---

Collaborator: Jonah. 2026-06-08 (late night). Repo: ~/Documents/Github/improv.

User: "Add this as a shader in tilt-lab, it's a background and it must be a 1:1" -> https://github.com/renatoworks/3dsvg

**What 3dsvg is:** "turn SVGs into interactive React 3D components." TypeScript + react-three-fiber/Three.js. NOT a GLSL shader - it's an SVG->3D EXTRUSION engine (SVGLoader -> ExtrudeGeometry, material presets, lighting, camera, cursor-orbit, intro/loop animations). Homepage 3dsvg.design. **LICENSE: MIT, (c) 2026 Renato Costa** (verified root + packages/engine/LICENSE) -> OK to port WITH the copyright + permission notice carried in the effect (manifest origin/license/attribution like other ported effects).

**Source pulled to /tmp/3dsvg/** (engine package): scene.tsx (655L, the r3f extrusion - core), materials.ts (67L, 10 presets), types.ts (config surface), index.tsx, use-font.ts (text path), controls.tsx.

**Config surface (types.ts defaultProps = the 1:1 look):** svg (markup or URL) / text+font; depth 1, smoothness 0.2, color #fff; material preset (default/plastic/metal/glass/rubber/chrome/gold/clay/emissive/holographic) + metalness .15 roughness .35 opacity 1; rotationX/Y, zoom 8, fov 50; cursorOrbit true orbitStrength .15; light [5,8,5] intensity 1.2 ambient .3 shadow true; animate none/spin/float/pulse/wobble/spinFloat/swing; intro zoom/fade/none.

**Port plan:** new tilt-lab effect `runtime/effects/svg-3d/` (manifest.json layerRole BACKGROUND + index.ts). Translate r3f JSX -> imperative Three (init/frame/resize/dispose Effect interface, like fractal-glass which already uses THREE). Use three SVGLoader + ExtrudeGeometry. Expose key params (source svg, depth, smoothness, color, material, metalness, roughness, zoom, fov, light, animate, cursorOrbit->onPointer). Register in runtime/index.ts. Default to 3dsvg defaultProps for the faithful look. requiredAssets: source svg (default sample).

## DONE + verified (2026-06-08)
Built effect `tilt-lab/runtime/effects/svg-3d/` (manifest.json BACKGROUND + index.ts), registered in runtime/index.ts RAW array. three 0.170 + SVGLoader confirmed present.
- index.ts = imperative port of scene.tsx + materials.ts + controls.tsx: parseShapesFromSVG, ExtrudeGeometry pipeline, triplanar UVs, 10 PBR presets + resolveMaterial, meshPhysicalMaterial settings, 6-light rig, procedural env cubemap (4-sphere scene -> PMREM, scene.environmentIntensity 1.5), ACES tone mapping exp 1.2, cursor-orbit + drag + momentum (wired to onPointer/onPointerDown/Up), intro zoom (easeOutQuart), loop animations (spin/float/pulse/wobble/swing/spinFloat). Default SVG inlined (5-pt star) -> no asset-pipeline/effect-assets change needed (esbuild only dataurl-loads png/jpg, not svg).
- Params (manifest, defaults = 3dsvg defaultProps = 1:1 look): source(file) depth smoothness color material metalness roughness opacity wireframe rotationX/Y zoom fov cursorOrbit orbitStrength lightIntensity ambientIntensity animate animateSpeed intro.
- ONE honest simplification: drei `ContactShadows` -> a soft radial-gradient shadow plane (everything else verbatim). drei `Environment` replicated via PMREMGenerator from the same child-sphere scene.
- Typecheck clean (removed 1 unused var). Vite HMR no errors.
- VERIFIED LIVE: catalog shows "SVG 3D" BACKGROUND; default star renders extruded w/ bevel + PBR lighting + shadow. Then the USER drove the dev UI in parallel - loaded their 8-bit ampersand as `source` + color #E32400 -> renders as a clean RED 3D EXTRUDED AMPERSAND. Proves arbitrary multi-shape SVG extrusion + source/color params work live.
- Attribution: user said personal project, no attribution needed; kept a 1-line credit comment + manifest origin/license/attribution to match how EVERY other tilt-lab effect tags its origin (interactive-grid->motion-core etc.); trivial to strip. MIT license permits the port regardless.

Status: DONE. Rebuilding dist/tilt-runtime.js so Copy-embed exports carry svg-3d. Working tree on `main`, uncommitted.

## UPDATE 2026-06-09: reclassified background -> MIDGROUND (user request)
Changed manifest.json layerRole background->midground (+ the "background" tag -> "midground"). Grounded: compositor.ts only special-cases `layerRole === 'post'` (the onBeneath path); background/midground/pointer composite identically by DOM/stacking order, so this is a pure CATALOG-classification change with zero rendering impact. Validator LAYER_ROLES includes midground; BrowseGrid renders mft.layerRole verbatim and filters by it. Rebuilt dist + re-vendored marketing-site/tilt-runtime.js; also synced the hero stack config layer `layerRole: 'background' -> 'midground'` for coherence (no visual change - single non-post layer). VERIFIED: tilt-lab catalog card now reads "SVG 3D MIDGROUND" (interactive snapshot). Hero unaffected by construction.

Files: tilt-lab/runtime/effects/svg-3d/manifest.json + index.ts; tilt-lab/runtime/index.ts; rebuilt tilt-lab/dist/tilt-runtime.js.
