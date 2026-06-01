// Fractal-glass's 5 built-in scene presets, verbatim from the regent original
// (app/(app)/tools/fractal-glass/presets.ts). baseColor1-4 drive the 4-stop
// radial background; envColor1-3 tint the procedural environment map.
//
// Single source of truth: imported by the effect (index.ts setParam('scene'),
// indexed by scene order) AND by runtime/effect-presets.ts (so the playground
// store expands a `scene` selection into all 7 colors, keeping the pickers in
// sync). Shared with the fractal-glass-post variant, which uses the same set.
// No `three` import here, so the registry/app stay light.

export const FRACTAL_GLASS_SCENE_NAMES = [
  'Indicium',
  'Violet Abyss',
  'Emerald Depth',
  'Crimson Forge',
  'Regent',
] as const;

export interface FractalGlassScenePreset {
  baseColor1: string;
  baseColor2: string;
  baseColor3: string;
  baseColor4: string;
  envColor1: string;
  envColor2: string;
  envColor3: string;
}

export const FRACTAL_GLASS_PRESETS: FractalGlassScenePreset[] = [
  { baseColor1: '#030618', baseColor2: '#1040a0', baseColor3: '#78b0dc', baseColor4: '#A0C4E8', envColor1: '#030620', envColor2: '#1248b0', envColor3: '#68a0d0' }, // Indicium
  { baseColor1: '#0a0318', baseColor2: '#2d1054', baseColor3: '#6b2fa0', baseColor4: '#B8A8C8', envColor1: '#0f0520', envColor2: '#3a1570', envColor3: '#9b4dca' }, // Violet Abyss
  { baseColor1: '#011a0a', baseColor2: '#0a4a2a', baseColor3: '#1a8a5a', baseColor4: '#A8C8B8', envColor1: '#021f0e', envColor2: '#0e5535', envColor3: '#2ecc71' }, // Emerald Depth
  { baseColor1: '#1a0505', baseColor2: '#5a0a0a', baseColor3: '#b82020', baseColor4: '#C8B0A8', envColor1: '#200808', envColor2: '#701212', envColor3: '#ff4444' }, // Crimson Forge
  { baseColor1: '#010102', baseColor2: '#061440', baseColor3: '#0c90d0', baseColor4: '#58c0f8', envColor1: '#010204', envColor2: '#062050', envColor3: '#00a0e8' }, // Regent
];

/**
 * Each scene name as a plain value-set keyed by manifest param name (all 4 base
 * + 3 env colors). This is what the store expands a `scene` selection into, so
 * the seven color pickers reflect the chosen scene 1:1 with the effect's own
 * selectScene logic.
 */
export const FRACTAL_GLASS_SCENE_PRESETS: Record<string, Record<string, unknown>> =
  Object.fromEntries(
    FRACTAL_GLASS_SCENE_NAMES.map((name, i) => [name, { ...FRACTAL_GLASS_PRESETS[i] }]),
  );
