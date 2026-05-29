import { defineEffectElement } from './element';
import { defineStackElement, setStackFactory } from './compositor';
import { validateManifest } from './manifest';
import type { Effect, EffectFactory } from './types';

// Effect factories + manifests (one import pair per effect).
import { createGradientEffect } from './effects/gradient/index';
import gradientManifest from './effects/gradient/manifest.json';
import { createAsciiEffect } from './effects/ascii/index';
import asciiManifest from './effects/ascii/manifest.json';
import { createAuroraEffect } from './effects/aurora/index';
import auroraManifest from './effects/aurora/manifest.json';
import { createCursorTrailEffect } from './effects/cursor-trail/index';
import cursorTrailManifest from './effects/cursor-trail/manifest.json';
import { createDitheredImageEffect } from './effects/dithered-image/index';
import ditheredImageManifest from './effects/dithered-image/manifest.json';
import { createFake3DImageEffect } from './effects/fake-3d-image/index';
import fake3dImageManifest from './effects/fake-3d-image/manifest.json';
import { createFluidEffect } from './effects/fluid/index';
import fluidManifest from './effects/fluid/manifest.json';
import { createFractalGlassEffect } from './effects/fractal-glass/index';
import fractalGlassManifest from './effects/fractal-glass/manifest.json';
import { createGlobeEffect } from './effects/globe/index';
import globeManifest from './effects/globe/manifest.json';
import { createGrainGradientEffect } from './effects/grain-gradient/index';
import grainGradientManifest from './effects/grain-gradient/manifest.json';
import { createHalftoneEffect } from './effects/halftone/index';
import halftoneManifest from './effects/halftone/manifest.json';
import { createHaloEffect } from './effects/halo/index';
import haloManifest from './effects/halo/manifest.json';
import { createInteractiveGridEffect } from './effects/interactive-grid/index';
import interactiveGridManifest from './effects/interactive-grid/manifest.json';
import { createLavaLampEffect } from './effects/lava-lamp/index';
import lavaLampManifest from './effects/lava-lamp/manifest.json';
import { createMeshGradientEffect } from './effects/mesh-gradient/index';
import meshGradientManifest from './effects/mesh-gradient/manifest.json';
import { createNeuralNoiseEffect } from './effects/neural-noise/index';
import neuralNoiseManifest from './effects/neural-noise/manifest.json';
import { createNeuroNoiseEffect } from './effects/neuro-noise/index';
import neuroNoiseManifest from './effects/neuro-noise/manifest.json';
import { createParticlesEffect } from './effects/particles/index';
import particlesManifest from './effects/particles/manifest.json';
import { createPlasmaGridEffect } from './effects/plasma-grid/index';
import plasmaGridManifest from './effects/plasma-grid/manifest.json';
import { createSpecularBandEffect } from './effects/specular-band/index';
import specularBandManifest from './effects/specular-band/manifest.json';
import { createSwarmEffect } from './effects/swarm/index';
import swarmManifest from './effects/swarm/manifest.json';
import { createSwirlEffect } from './effects/swirl/index';
import swirlManifest from './effects/swirl/manifest.json';
import { createWaterRippleEffect } from './effects/water-ripple/index';
import waterRippleManifest from './effects/water-ripple/manifest.json';

/** Every built-in effect: a raw manifest + its factory. Acquisition adds entries here. */
const RAW: Array<[unknown, EffectFactory]> = [
  [gradientManifest, createGradientEffect],
  [asciiManifest, createAsciiEffect],
  [auroraManifest, createAuroraEffect],
  [cursorTrailManifest, createCursorTrailEffect],
  [ditheredImageManifest, createDitheredImageEffect],
  [fake3dImageManifest, createFake3DImageEffect],
  [fluidManifest, createFluidEffect],
  [fractalGlassManifest, createFractalGlassEffect],
  [globeManifest, createGlobeEffect],
  [grainGradientManifest, createGrainGradientEffect],
  [halftoneManifest, createHalftoneEffect],
  [haloManifest, createHaloEffect],
  [interactiveGridManifest, createInteractiveGridEffect],
  [lavaLampManifest, createLavaLampEffect],
  [meshGradientManifest, createMeshGradientEffect],
  [neuralNoiseManifest, createNeuralNoiseEffect],
  [neuroNoiseManifest, createNeuroNoiseEffect],
  [particlesManifest, createParticlesEffect],
  [plasmaGridManifest, createPlasmaGridEffect],
  [specularBandManifest, createSpecularBandEffect],
  [swarmManifest, createSwarmEffect],
  [swirlManifest, createSwirlEffect],
  [waterRippleManifest, createWaterRippleEffect],
];

const builtins = RAW.map(([manifest, factory]) => ({
  manifest: validateManifest(manifest),
  factory,
}));

/** Registry of effect-id -> factory. */
export const effectFactories: Record<string, EffectFactory> = Object.fromEntries(
  builtins.map((b) => [b.manifest.id, b.factory]),
);

/** Every built-in manifest, for the playground catalog and tooling. */
export const builtinManifests = builtins.map((b) => b.manifest);

export function registerBuiltins(): void {
  for (const b of builtins) {
    defineEffectElement(b.manifest, b.factory);
  }
  setStackFactory((id: string): Effect => {
    const factory = effectFactories[id];
    if (!factory) throw new Error(`unknown effect id: ${id}`);
    return factory();
  });
  defineStackElement();
}

export { validateManifest } from './manifest';
export { validateStack, orderLayers } from './stack';
export { defineEffectElement } from './element';
export { Compositor } from './compositor';
export { PointerTracker } from './pointer';
export type { Effect, Manifest, LayerConfig, LayerRole } from './types';
