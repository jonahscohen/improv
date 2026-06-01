// Mesh-gradient scene presets, verbatim from the regent original
// (app/(app)/tools/mesh-gradient/presets.ts). Each scene is a 5-stop palette.
//
// Single source of truth: imported by the effect (init/setParam scene -> palette,
// for the standalone JSON path) AND by runtime/effect-presets.ts (so the
// playground store expands a `scene` selection into color1..color5, keeping the
// per-color pickers in sync). This file carries no `three` import, so the central
// registry and the app store can reference it without pulling the renderer in.

export const MESH_SCENE_NAMES = ['Default', 'Aurora', 'Deep Ocean', 'Regent', 'Molten'] as const;

export const MESH_SCENE_PALETTES: string[][] = [
  ['#8ecae6', '#219ebc', '#023047', '#ffb703', '#fb8500'],
  ['#1de9b6', '#0d6b4e', '#7c4dff', '#00e5ff', '#0a0f1a'],
  ['#0e4d64', '#0d2f5c', '#1a6b7a', '#0a3d6b', '#020408'],
  ['#00d4ff', '#003366', '#0088cc', '#66bbdd', '#010108'],
  ['#e64a19', '#8b0000', '#ff8f00', '#ffeb3b', '#050000'],
];

export const DEFAULT_MESH_COLORS = MESH_SCENE_PALETTES[0].slice();

/**
 * Each scene name as a plain {color1..color5} value-set keyed by manifest param
 * name. This is what the store expands a `scene` selection into so the five color
 * pickers reflect the chosen palette.
 */
export const MESH_SCENE_PRESETS: Record<string, Record<string, unknown>> = Object.fromEntries(
  MESH_SCENE_NAMES.map((name, i) => {
    const palette = MESH_SCENE_PALETTES[i];
    return [
      name,
      {
        color1: palette[0],
        color2: palette[1],
        color3: palette[2],
        color4: palette[3],
        color5: palette[4],
      },
    ];
  }),
);
