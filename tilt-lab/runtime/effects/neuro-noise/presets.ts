// Neuro-noise's 4 built-in presets, verbatim from @paper-design/shaders-react
// (neuroNoisePresets). The preset selector applies colorFront/Mid/Back +
// brightness + contrast + scale. Every field name matches a manifest param, so
// the record doubles as the store's expansion value-set.
//
// Single source of truth: imported by the effect (index.ts applyPreset) AND by
// runtime/effect-presets.ts (so the playground store expands a `preset`
// selection into its full value-set). No GL import here.

export interface NeuroNoisePreset {
  colorFront: string;
  colorMid: string;
  colorBack: string;
  brightness: number;
  contrast: number;
  scale: number;
}

export const PRESETS: Record<string, NeuroNoisePreset> = {
  Default: { colorFront: '#ffffff', colorMid: '#47a6ff', colorBack: '#000000', brightness: 0.05, contrast: 0.3, scale: 1 },
  Sensation: { colorFront: '#00c8ff', colorMid: '#fbff00', colorBack: '#8b42ff', brightness: 0.19, contrast: 0.12, scale: 3 },
  Bloodstream: { colorFront: '#ff0000', colorMid: '#ff0000', colorBack: '#ffffff', brightness: 0.24, contrast: 0.17, scale: 0.7 },
  Ghost: { colorFront: '#ffffff', colorMid: '#000000', colorBack: '#ffffff', brightness: 0.0, contrast: 1.0, scale: 0.55 },
};

/**
 * The presets as plain param value-sets keyed by manifest param name. Every
 * field already matches a manifest param, so each value-set is just the preset
 * spread into a plain object for the central preset registry.
 */
export const NEURO_NOISE_PRESET_PARAMS: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(PRESETS).map(([name, preset]) => [name, { ...preset }]),
);
