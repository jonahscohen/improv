// Grain-gradient's 6 built-in presets, verbatim from @paper-design/shaders-react
// (grainGradientPresets). The preset selector applies the whole set: a
// variable-length color list (-> color1..colorN + colorsCount), colorBack,
// shape, softness, intensity, noise, scale.
//
// Single source of truth: imported by the effect (index.ts applyPreset) AND by
// runtime/effect-presets.ts (so the playground store expands a `preset`
// selection into its full param value-set). No GL import here.

// Mirrors MAX_COLOR_COUNT in index.ts: the shader exposes 7 color slots.
export const GRAIN_MAX_COLOR_COUNT = 7;

export interface GrainGradientPreset {
  colors: string[];
  colorBack: string;
  shape: string;
  softness: number;
  intensity: number;
  noise: number;
  scale: number;
}

export const PRESETS: Record<string, GrainGradientPreset> = {
  Default: { colors: ['#7300ff', '#eba8ff', '#00bfff', '#2a00ff'], colorBack: '#000000', shape: 'corners', softness: 0.5, intensity: 0.5, noise: 0.25, scale: 1 },
  Wave: { colors: ['#c4730b', '#bdad5f', '#d8ccc7'], colorBack: '#000a0f', shape: 'wave', softness: 0.7, intensity: 0.15, noise: 0.5, scale: 1 },
  Dots: { colors: ['#6f0000', '#0080ff', '#f2ebc9', '#33cc33'], colorBack: '#0a0000', shape: 'dots', softness: 1, intensity: 1, noise: 0.7, scale: 0.6 },
  Truchet: { colors: ['#6f2200', '#eabb7c', '#39b523'], colorBack: '#0a0000', shape: 'truchet', softness: 0, intensity: 0.2, noise: 1, scale: 1 },
  Ripple: { colors: ['#6f2d00', '#88ddae', '#2c0b1d'], colorBack: '#140a00', shape: 'ripple', softness: 0.5, intensity: 0.5, noise: 0.5, scale: 0.5 },
  Blob: { colors: ['#3e6172', '#a49b74', '#568c50'], colorBack: '#0f0e18', shape: 'blob', softness: 0, intensity: 0.15, noise: 0.5, scale: 1.3 },
};

/**
 * The presets as plain param value-sets keyed by manifest param name. The
 * variable-length color list is flattened to color1..colorN (only the slots the
 * preset defines, so higher slots keep their live value, exactly as the effect's
 * applyPreset does) plus colorsCount. This is what the store expands a `preset`
 * selection into so the color pickers + count + shape/softness/etc. controls all
 * reflect the chosen preset 1:1 with the effect's apply logic.
 */
export const GRAIN_GRADIENT_PRESET_PARAMS: Record<string, Record<string, unknown>> =
  Object.fromEntries(
    Object.entries(PRESETS).map(([name, preset]) => {
      const values: Record<string, unknown> = {};
      preset.colors.forEach((hex, i) => {
        if (i < GRAIN_MAX_COLOR_COUNT) values[`color${i + 1}`] = hex;
      });
      values.colorsCount = Math.min(GRAIN_MAX_COLOR_COUNT, preset.colors.length);
      values.colorBack = preset.colorBack;
      values.shape = preset.shape;
      values.softness = preset.softness;
      values.intensity = preset.intensity;
      values.noise = preset.noise;
      values.scale = preset.scale;
      return [name, values];
    }),
  );
