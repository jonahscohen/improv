// Central preset registry: effect-id -> how its preset selector expands.
//
// Why this exists: the playground store writes a SINGLE changed param key, and
// the compositor rebuilds the effect via init() on every change (it has no
// per-param setParam path). So selecting a preset used to write only the
// `preset`/`scene` key, leaving every other param at its manifest default - and
// init() applied the preset then immediately clobbered it with those defaults.
// The net effect was "changing the preset does nothing".
//
// Fix: when a preset selector changes, expand it into its FULL param value-set
// here, so (a) every slider/color control reflects the preset and (b) init()
// receives the real values and renders them. Conversely, editing any preset-
// controlled param flips the selector back to its "custom" sentinel, matching
// the upstream tools' behavior (touch a control and you are no longer on a preset).
//
// Data lives in each effect's sibling presets.ts (single source of truth, free of
// heavy renderer imports), so this module stays cheap to import from the app.
import { ANIMATED_GRADIENT_PRESET_PARAMS } from './effects/animated-gradient/presets';
import { AURORA_PRESETS } from './effects/aurora/presets';
import { MESH_SCENE_PRESETS } from './effects/mesh-gradient/presets';
import { FLUID_SCENE_PRESETS } from './effects/fluid/presets';
import { FRACTAL_GLASS_SCENE_PRESETS } from './effects/fractal-glass/presets';
import { HALFTONE_SCENE_PRESETS } from './effects/halftone/presets';
import { GLOBE_PRESET_PARAMS } from './effects/globe/presets';
import { GRAIN_GRADIENT_PRESET_PARAMS } from './effects/grain-gradient/presets';
import { NEURO_NOISE_PRESET_PARAMS } from './effects/neuro-noise/presets';
import { SWARM_SCENE_PRESETS } from './effects/swarm/presets';

export interface PresetRegistryEntry {
  /** The select param whose value chooses a preset. */
  param: string;
  /** The "no preset / hand-tuned" sentinel for that param. */
  custom: string;
  /** preset name -> full param value-set (keyed by manifest param name). */
  presets: Record<string, Record<string, unknown>>;
}

export const effectPresets: Record<string, PresetRegistryEntry> = {
  'animated-gradient': { param: 'preset', custom: 'custom', presets: ANIMATED_GRADIENT_PRESET_PARAMS },
  aurora: { param: 'preset', custom: 'Custom', presets: AURORA_PRESETS },
  'mesh-gradient': { param: 'scene', custom: 'Custom', presets: MESH_SCENE_PRESETS },
  // Regent fluid lineage: scene selector -> color (+ alpha) value-set. "Custom"
  // (-1 internally) keeps the live pickers.
  fluid: { param: 'scene', custom: 'Custom', presets: FLUID_SCENE_PRESETS },
  'fractal-glass': { param: 'scene', custom: 'Custom', presets: FRACTAL_GLASS_SCENE_PRESETS },
  // Post-overlay variant shares fractal-glass' scene set (same params, same data).
  'fractal-glass-post': { param: 'scene', custom: 'Custom', presets: FRACTAL_GLASS_SCENE_PRESETS },
  halftone: { param: 'scene', custom: 'Custom', presets: HALFTONE_SCENE_PRESETS },
  'halftone-post': { param: 'scene', custom: 'Custom', presets: HALFTONE_SCENE_PRESETS },
  // cobe globe: preset selector -> full color + lighting set. "Custom" keeps live.
  globe: { param: 'preset', custom: 'Custom', presets: GLOBE_PRESET_PARAMS },
  // Paper-design shaders: preset selector -> color (+ shaping) set. "Custom" is a
  // sentinel added to the manifest options so the flip-on-edit has a landing spot.
  'grain-gradient': { param: 'preset', custom: 'Custom', presets: GRAIN_GRADIENT_PRESET_PARAMS },
  'neuro-noise': { param: 'preset', custom: 'Custom', presets: NEURO_NOISE_PRESET_PARAMS },
  // Regent swarm: scene selector -> 3 colors + 3 alphas. "Custom" keeps live.
  swarm: { param: 'scene', custom: 'Custom', presets: SWARM_SCENE_PRESETS },
};

/** Every param key any preset for this effect controls (cached per entry). */
const controlledCache = new WeakMap<PresetRegistryEntry, Set<string>>();
function controlledKeys(entry: PresetRegistryEntry): Set<string> {
  let keys = controlledCache.get(entry);
  if (!keys) {
    keys = new Set<string>();
    for (const values of Object.values(entry.presets)) {
      for (const k of Object.keys(values)) keys.add(k);
    }
    controlledCache.set(entry, keys);
  }
  return keys;
}

/**
 * Apply a single param change to a layer's param map, expanding preset selectors.
 * Returns a NEW params object (never mutates the input).
 *
 * - Effect has no preset registry entry -> just sets `{ [key]: value }`.
 * - `key` is the preset selector and names a known preset -> merge that preset's
 *   full value-set (so the controls update), keeping the selector = value.
 * - `key` is the preset selector but an unknown / custom value -> set it as-is.
 * - `key` is a preset-controlled param while a real preset is active -> set it
 *   and flip the selector to its custom sentinel.
 */
export function expandPresetParams(
  effectId: string,
  current: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const entry = effectPresets[effectId];
  if (!entry) return { ...current, [key]: value };

  if (key === entry.param) {
    const preset = entry.presets[String(value)];
    if (preset) return { ...current, ...preset, [key]: value };
    return { ...current, [key]: value };
  }

  const next = { ...current, [key]: value };
  if (
    controlledKeys(entry).has(key) &&
    String(current[entry.param]) !== entry.custom
  ) {
    next[entry.param] = entry.custom;
  }
  return next;
}
