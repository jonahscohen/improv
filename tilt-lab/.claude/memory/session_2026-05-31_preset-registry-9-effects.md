---
name: Preset registry closed for 9 remaining effects
description: Registered fluid, fractal-glass(+post), halftone(+post), globe, grain-gradient, neuro-noise, swarm in runtime/effect-presets.ts so preset/scene selectors apply on switch
type: project
---

Collaborator: Jonah

# What

Closed the systemic "selecting a preset does nothing" bug for the 9 effects fx-presets had not yet covered. The playground rebuilds effects via init(opts.params) with no per-param setParam path, so a preset selection only wrote the selector key and init's default loop clobbered it. The fix (built by fx-presets) routes store.setParam through expandPresetParams in runtime/effect-presets.ts, merging a preset's FULL value-set into the layer params.

Registered 9 entries (param + custom sentinel + preset count):
- fluid            scene / 'Custom' / 5 scenes -> {colorLow,colorHigh,colorGlow,bgColor}
- fractal-glass    scene / 'Custom' / 5 scenes -> 4 base + 3 env colors
- fractal-glass-post scene / 'Custom' / 5 scenes (shares fractal-glass set)
- halftone         scene / 'Custom' / 5 scenes -> 4 base colors ONLY (handler seeds base only; no env control)
- halftone-post    scene / 'Custom' / 5 scenes (shares halftone set)
- globe            preset / 'Custom' / 12 looks -> baseColor,markerColor,glowColor,dark,diffuse,mapBrightness,mapBaseBrightness,theta,scale,opacity
- grain-gradient   preset / 'Custom' / 6 presets -> color1..colorN + colorsCount + colorBack + shape + softness + intensity + noise + scale
- neuro-noise      preset / 'Custom' / 4 presets -> colorFront/Mid/Back + brightness + contrast + scale
- swarm            scene / 'Custom' / 5 scenes -> 3 colors + 3 alphas

# How

Why: registry value-set MUST match each effect's own preset handler 1:1 so the merged params reproduce the preset exactly. To avoid data drift, made each effect's preset data the single source of truth (the pattern the 3 done effects use): created a sibling presets.ts per effect, moved the inline data there, and refactored index.ts to import it. effect-presets.ts imports the param-keyed records from those same files.

- Regent array-based (fluid/fractal-glass/halftone/swarm): presets.ts exports the raw array + a NAMES tuple + a name->valueset record. index.ts setParam now does NAMES.indexOf(sval as (typeof NAMES)[number]).
- Record-based (globe/grain/neuro): PRESETS already keyed by name; presets.ts spreads each into a plain Record<string,unknown> for the registry (interfaces lack index signatures, so a direct alias fails tsc).
- halftone value-set is base-only on purpose: its scene handler seeds baseColor1-4 only and the manifest has no env control (fractal-glass DOES apply + expose env).
- grain/neuro had NO Custom option. Added "Custom" to both manifests (consistent with all 7 other preset effects; applyPreset('Custom') no-ops -> keeps live edits) so the flip-on-edit has a valid select landing. Updated the two existing index.test.ts option-equality assertions accordingly.

# Verify
- app: npx tsc --noEmit -> 0. root: tsc --noEmit -> 0.
- root npm test -> 228 passed (was 219; +9 new registry tests in effect-presets.test.ts, each asserts real preset values + flip-to-custom). All pre-existing effect tests still green.

# Ambiguity flagged
- Task brief said fluid = "6 named scenes"; actual data has 5 named (Cosmic/Regent/Inferno/Void/Monochrome) + Custom = 6 options. Registered the 5 real scenes. Same shape for globe ("13 looks" = 12 named + Custom).

# Files
- NEW: runtime/effects/{fluid,fractal-glass,halftone,globe,grain-gradient,neuro-noise,swarm}/presets.ts
- runtime/effect-presets.ts (9 entries + imports)
- runtime/effect-presets.test.ts (9 new tests)
- runtime/effects/*/index.ts (7 files: import preset data, drop inline consts)
- runtime/effects/{grain-gradient,neuro-noise}/manifest.json (+ "Custom" option)
- runtime/effects/{grain-gradient,neuro-noise}/index.test.ts (option assertions)
