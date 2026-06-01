// Globe's preset library - reproduces the documented cobe demo "looks". Each
// preset is a COBEOptions-shaped value-set; every field name matches a manifest
// param, so the record doubles as the store's expansion value-set.
//
// Single source of truth: imported by the effect (index.ts applyPreset) AND by
// runtime/effect-presets.ts (so the playground store expands a `preset`
// selection into its full color + lighting value-set, keeping every control in
// sync). No cobe/GL import here, so the registry/app stay light.

export interface GlobePreset {
  baseColor: string;
  markerColor: string;
  glowColor: string;
  dark: number;
  diffuse: number;
  mapBrightness: number;
  mapBaseBrightness: number;
  theta: number;
  scale: number;
  opacity: number;
}

export const PRESETS: Record<string, GlobePreset> = {
  // cobe's TRUE library defaults (the createGlobe destructure defaults), not the
  // README demo overrides: white base, orange markers, dark 0, diffuse 1,
  // mapBrightness 1. This is the shipped default-selected preset, so the globe
  // boots to cobe's stock look. (mapSamples 10000 is set via the manifest
  // default since cobe bakes it at creation and it is not a live preset field.)
  'Cobe Default': { baseColor: '#ffffff', markerColor: '#ff8000', glowColor: '#ffffff', dark: 0, diffuse: 1, mapBrightness: 1, mapBaseBrightness: 0, theta: 0.3, scale: 1, opacity: 1 },
  'Day / Light': { baseColor: '#e6e6e6', markerColor: '#1f6feb', glowColor: '#ffffff', dark: 0, diffuse: 3, mapBrightness: 9, mapBaseBrightness: 0.12, theta: 0.25, scale: 1, opacity: 1 },
  'Inverted Dark': { baseColor: '#1a1a2e', markerColor: '#00d4ff', glowColor: '#4361ee', dark: 1, diffuse: 3, mapBrightness: 1.2, mapBaseBrightness: 0, theta: 0.3, scale: 1, opacity: 1 },
  'Tech Blue': { baseColor: '#0f172a', markerColor: '#60a5fa', glowColor: '#93c5fd', dark: 1, diffuse: 1.4, mapBrightness: 6, mapBaseBrightness: 0, theta: 0.35, scale: 1, opacity: 1 },
  Emerald: { baseColor: '#0b3d2e', markerColor: '#34d399', glowColor: '#6ee7b7', dark: 1, diffuse: 1.5, mapBrightness: 5, mapBaseBrightness: 0, theta: 0.3, scale: 1, opacity: 1 },
  Ocean: { baseColor: '#0a2540', markerColor: '#38bdf8', glowColor: '#7dd3fc', dark: 1, diffuse: 1.6, mapBrightness: 5, mapBaseBrightness: 0, theta: 0.3, scale: 1, opacity: 1 },
  Aurora: { baseColor: '#10231f', markerColor: '#a3e635', glowColor: '#22d3ee', dark: 1, diffuse: 2.2, mapBrightness: 4, mapBaseBrightness: 0, theta: 0.4, scale: 1, opacity: 1 },
  Magma: { baseColor: '#2b0a0a', markerColor: '#ff4422', glowColor: '#ff8855', dark: 1, diffuse: 2, mapBrightness: 4, mapBaseBrightness: 0, theta: 0.3, scale: 1, opacity: 1 },
  Sunset: { baseColor: '#2a0e2e', markerColor: '#fb7185', glowColor: '#fbbf24', dark: 1, diffuse: 2, mapBrightness: 4, mapBaseBrightness: 0, theta: 0.35, scale: 1, opacity: 1 },
  Gold: { baseColor: '#3a2e05', markerColor: '#fcd34d', glowColor: '#fde68a', dark: 1, diffuse: 1.8, mapBrightness: 5, mapBaseBrightness: 0, theta: 0.3, scale: 1, opacity: 1 },
  'Neon Night': { baseColor: '#0d0221', markerColor: '#f000ff', glowColor: '#00f0ff', dark: 1, diffuse: 2.5, mapBrightness: 3, mapBaseBrightness: 0, theta: 0.4, scale: 1, opacity: 1 },
  'Mono Wire': { baseColor: '#000000', markerColor: '#ffffff', glowColor: '#888888', dark: 1, diffuse: 0.6, mapBrightness: 8, mapBaseBrightness: 0, theta: 0.25, scale: 1, opacity: 1 },
};

/**
 * The presets as plain param value-sets keyed by manifest param name. Every
 * GlobePreset field already matches a manifest param, so each value-set is just
 * the preset spread into a plain object for the central preset registry.
 */
export const GLOBE_PRESET_PARAMS: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(PRESETS).map(([name, preset]) => [name, { ...preset }]),
);
