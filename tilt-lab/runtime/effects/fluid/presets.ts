// Fluid's 5 built-in scene presets, verbatim from the regent original
// (app/(app)/tools/fluid/presets.ts). Each scene retints the four fluid colors.
//
// Single source of truth: imported by the effect (index.ts setParam('scene'),
// which selects a scene by index) AND by runtime/effect-presets.ts (so the
// playground store expands a `scene` selection into its full color value-set,
// keeping the color pickers in sync). No GL imports here, so the central
// registry and the app store can reference it without dragging the renderer in.

export const FLUID_SCENE_NAMES = ['Cosmic', 'Regent', 'Inferno', 'Void', 'Monochrome'] as const;

export interface FluidScenePreset {
  colorLow: string;
  colorHigh: string;
  colorGlow: string;
  bgColor: string;
}

export const FLUID_PRESETS: FluidScenePreset[] = [
  { colorLow: '#3D1545', colorHigh: '#2299FF', colorGlow: '#BBECFF', bgColor: '#000000' }, // Cosmic
  { colorLow: '#0D3050', colorHigh: '#00D4FF', colorGlow: '#FFFFFF', bgColor: '#010102' }, // Regent
  { colorLow: '#401000', colorHigh: '#FF7722', colorGlow: '#FFEE99', bgColor: '#050000' }, // Inferno
  { colorLow: '#2A1050', colorHigh: '#DD66FF', colorGlow: '#FFCCFF', bgColor: '#000005' }, // Void
  { colorLow: '#252525', colorHigh: '#AAAAAA', colorGlow: '#FFFFFF', bgColor: '#000000' }, // Monochrome
];

/**
 * Each scene name as a plain {colorLow, colorHigh, colorGlow, bgColor} value-set
 * keyed by manifest param name. This is what the store expands a `scene`
 * selection into so the four color pickers reflect the chosen palette.
 */
export const FLUID_SCENE_PRESETS: Record<string, Record<string, unknown>> = Object.fromEntries(
  FLUID_SCENE_NAMES.map((name, i) => [name, { ...FLUID_PRESETS[i] }]),
);
