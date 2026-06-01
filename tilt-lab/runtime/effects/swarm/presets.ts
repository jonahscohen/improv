// Swarm's 5 built-in scene presets, verbatim from the regent original
// (app/(app)/tools/swarm/presets.ts). Each scene selects a 3-color + 3-alpha
// palette (idle/swarm/bg colors, idle/swarm/glow alphas).
//
// Single source of truth: imported by the effect (index.ts setParam('scene'),
// indexed by scene order) AND by runtime/effect-presets.ts (so the playground
// store expands a `scene` selection into its full color + alpha value-set).

export const SWARM_SCENE_NAMES = [
  'Ghost Grid',
  'Regent',
  'Ember',
  'Phosphor',
  'Violet Haze',
] as const;

export interface SwarmScenePreset {
  idleColor: string;
  swarmColor: string;
  bgColor: string;
  idleAlpha: number;
  swarmAlpha: number;
  glowAlpha: number;
}

export const SWARM_PRESETS: SwarmScenePreset[] = [
  { idleColor: '#ffffff', swarmColor: '#ffffff', bgColor: '#060608', idleAlpha: 0.08, swarmAlpha: 0.55, glowAlpha: 0.15 }, // Ghost Grid
  { idleColor: '#66bbdd', swarmColor: '#00d4ff', bgColor: '#010102', idleAlpha: 0.08, swarmAlpha: 0.6, glowAlpha: 0.2 }, // Regent
  { idleColor: '#cc6644', swarmColor: '#ff4422', bgColor: '#0a0404', idleAlpha: 0.08, swarmAlpha: 0.55, glowAlpha: 0.18 }, // Ember
  { idleColor: '#44cc66', swarmColor: '#00ff66', bgColor: '#020804', idleAlpha: 0.06, swarmAlpha: 0.55, glowAlpha: 0.2 }, // Phosphor
  { idleColor: '#9966cc', swarmColor: '#cc44ff', bgColor: '#060410', idleAlpha: 0.07, swarmAlpha: 0.55, glowAlpha: 0.18 }, // Violet Haze
];

/**
 * Each scene name as a plain value-set keyed by manifest param name (3 colors +
 * 3 alphas). This is what the store expands a `scene` selection into, so the
 * color pickers and alpha sliders reflect the chosen scene 1:1 with the
 * effect's own selectScene logic.
 */
export const SWARM_SCENE_PRESETS: Record<string, Record<string, unknown>> = Object.fromEntries(
  SWARM_SCENE_NAMES.map((name, i) => [name, { ...SWARM_PRESETS[i] }]),
);
