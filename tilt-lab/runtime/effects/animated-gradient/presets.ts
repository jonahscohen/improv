// Spell's 6 built-in presets (verbatim values from @spell/animated-gradient
// registry). Each is a full config the preset selector applies wholesale.
//
// Single source of truth: imported BOTH by the effect (init/applyPreset, for the
// standalone <tilt-stack> JSON path) AND by runtime/effect-presets.ts (so the
// playground store can expand a preset selection into its full param value-set).
// Keeping the data here - free of any WebGL/heavy import - lets the central
// registry and the app store reference it without dragging the effect runtime in.

export type PatternShape = 'Checks' | 'Stripes' | 'Edge';

export interface AnimatedGradientPreset {
  color1: string;
  color2: string;
  color3: string;
  // spell's light-theme palette variant - preserved for fidelity to the source;
  // tilt-lab has no theme switch so only the dark `color*` set is applied.
  lightColors?: [string, string, string];
  rotation: number;
  proportion: number;
  scale: number;
  speed: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  softness: number;
  offset: number;
  shape: PatternShape;
  shapeSize: number;
}

export const ANIMATED_GRADIENT_PRESETS: Record<string, AnimatedGradientPreset> = {
  Prism: {
    color1: '#050505', color2: '#66B3FF', color3: '#FFFFFF', lightColors: ['#FAFAFA', '#66B3FF', '#050505'],
    rotation: -50, proportion: 1, scale: 0.01, speed: 30, distortion: 0,
    swirl: 50, swirlIterations: 16, softness: 47, offset: -299, shape: 'Checks', shapeSize: 45,
  },
  Lava: {
    color1: '#FF9F21', color2: '#FF0303', color3: '#000000', lightColors: ['#FF9F21', '#FF0303', '#FAFAFA'],
    rotation: 114, proportion: 100, scale: 0.52, speed: 30, distortion: 7,
    swirl: 18, swirlIterations: 20, softness: 100, offset: 717, shape: 'Edge', shapeSize: 12,
  },
  Plasma: {
    color1: '#B566FF', color2: '#000000', color3: '#000000', lightColors: ['#B566FF', '#FAFAFA', '#FAFAFA'],
    rotation: 0, proportion: 63, scale: 0.75, speed: 30, distortion: 5,
    swirl: 61, swirlIterations: 5, softness: 100, offset: -168, shape: 'Checks', shapeSize: 28,
  },
  Pulse: {
    color1: '#66FF85', color2: '#000000', color3: '#000000', lightColors: ['#66FF85', '#FAFAFA', '#FAFAFA'],
    rotation: -167, proportion: 92, scale: 0, speed: 20, distortion: 54,
    swirl: 75, swirlIterations: 3, softness: 28, offset: -813, shape: 'Checks', shapeSize: 79,
  },
  Vortex: {
    color1: '#000000', color2: '#FFFFFF', color3: '#000000', lightColors: ['#FAFAFA', '#000000', '#FAFAFA'],
    rotation: 50, proportion: 41, scale: 0.4, speed: 20, distortion: 0,
    swirl: 100, swirlIterations: 3, softness: 5, offset: -744, shape: 'Stripes', shapeSize: 80,
  },
  Mist: {
    color1: '#050505', color2: '#FF66B8', color3: '#050505', lightColors: ['#FAFAFA', '#FF66B8', '#FAFAFA'],
    rotation: 0, proportion: 33, scale: 0.48, speed: 39, distortion: 4,
    swirl: 65, swirlIterations: 5, softness: 100, offset: -235, shape: 'Edge', shapeSize: 48,
  },
};

/**
 * The same presets as plain param value-sets keyed by manifest param name
 * (lightColors stripped - it is not a control). This is what the store expands a
 * `preset` selection into, so every slider/color control reflects the preset.
 */
export const ANIMATED_GRADIENT_PRESET_PARAMS: Record<string, Record<string, unknown>> =
  Object.fromEntries(
    Object.entries(ANIMATED_GRADIENT_PRESETS).map(([name, preset]) => {
      const { lightColors: _lightColors, ...params } = preset;
      void _lightColors;
      return [name, params];
    }),
  );
