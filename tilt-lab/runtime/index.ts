import { defineEffectElement } from './element';
import { Compositor, defineStackElement, setStackFactory } from './compositor';
import { validateManifest } from './manifest';
import type { Effect, EffectFactory, LayerConfig } from './types';

// Effect factories + manifests (one import pair per effect).
import { createGradientEffect } from './effects/gradient/index';
import gradientManifest from './effects/gradient/manifest.json';
import { createAsciiEffect } from './effects/ascii/index';
import asciiManifest from './effects/ascii/manifest.json';
import { createAuroraEffect } from './effects/aurora/index';
import auroraManifest from './effects/aurora/manifest.json';
import { createDitheredImageEffect } from './effects/dithered-image/index';
import ditheredImageManifest from './effects/dithered-image/manifest.json';
import { createFake3DImageEffect } from './effects/fake-3d-image/index';
import fake3dImageManifest from './effects/fake-3d-image/manifest.json';
import { createFluidEffect } from './effects/fluid/index';
import fluidManifest from './effects/fluid/manifest.json';
import { createFractalGlassEffect, createFractalGlassPostEffect } from './effects/fractal-glass/index';
import fractalGlassManifest from './effects/fractal-glass/manifest.json';
import fractalGlassPostManifest from './effects/fractal-glass-post/manifest.json';
import { createGlobeEffect } from './effects/globe/index';
import globeManifest from './effects/globe/manifest.json';
import { createGrainGradientEffect } from './effects/grain-gradient/index';
import grainGradientManifest from './effects/grain-gradient/manifest.json';
import { createHalftoneEffect, createHalftonePostEffect } from './effects/halftone/index';
import halftoneManifest from './effects/halftone/manifest.json';
import halftonePostManifest from './effects/halftone-post/manifest.json';
import { createHaloEffect } from './effects/halo/index';
import haloManifest from './effects/halo/manifest.json';
import { createInteractiveGridEffect } from './effects/interactive-grid/index';
import interactiveGridManifest from './effects/interactive-grid/manifest.json';
import { createSvg3dEffect } from './effects/svg-3d/index';
import svg3dManifest from './effects/svg-3d/manifest.json';
import { createLavaLampEffect } from './effects/lava-lamp/index';
import lavaLampManifest from './effects/lava-lamp/manifest.json';
import { createMeshGradientEffect } from './effects/mesh-gradient/index';
import meshGradientManifest from './effects/mesh-gradient/manifest.json';
import { createNeuralNoiseEffect } from './effects/neural-noise/index';
import neuralNoiseManifest from './effects/neural-noise/manifest.json';
import { createNeuroNoiseEffect } from './effects/neuro-noise/index';
import neuroNoiseManifest from './effects/neuro-noise/manifest.json';
import { createSpecularBandEffect } from './effects/specular-band/index';
import specularBandManifest from './effects/specular-band/manifest.json';
import { createSwarmEffect } from './effects/swarm/index';
import swarmManifest from './effects/swarm/manifest.json';
import { createWaterRippleEffect } from './effects/water-ripple/index';
import waterRippleManifest from './effects/water-ripple/manifest.json';
// Restored / previously-dropped effects (re-anchored on the original task list).
import { createAnimatedGradientEffect } from './effects/animated-gradient/index';
import animatedGradientManifest from './effects/animated-gradient/manifest.json';
import { createGlassSlideshowEffect } from './effects/glass-slideshow/index';
import glassSlideshowManifest from './effects/glass-slideshow/manifest.json';
import { createInfiniteGalleryEffect } from './effects/infinite-gallery/index';
import infiniteGalleryManifest from './effects/infinite-gallery/manifest.json';
import { createMcGlobeEffect } from './effects/mc-globe/index';
import mcGlobeManifest from './effects/mc-globe/manifest.json';
import { createMediaEffect } from './effects/media/index';
import mediaManifest from './effects/media/manifest.json';
import { createPixelEffect } from './effects/pixel/index';
import pixelManifest from './effects/pixel/manifest.json';

/** Every built-in effect: a raw manifest + its factory. Acquisition adds entries here. */
const RAW: Array<[unknown, EffectFactory]> = [
  [gradientManifest, createGradientEffect],
  [asciiManifest, createAsciiEffect],
  [auroraManifest, createAuroraEffect],
  [ditheredImageManifest, createDitheredImageEffect],
  [fake3dImageManifest, createFake3DImageEffect],
  [fluidManifest, createFluidEffect],
  [fractalGlassManifest, createFractalGlassEffect],
  [fractalGlassPostManifest, createFractalGlassPostEffect],
  [globeManifest, createGlobeEffect],
  [grainGradientManifest, createGrainGradientEffect],
  [halftoneManifest, createHalftoneEffect],
  [halftonePostManifest, createHalftonePostEffect],
  [haloManifest, createHaloEffect],
  [interactiveGridManifest, createInteractiveGridEffect],
  [svg3dManifest, createSvg3dEffect],
  [lavaLampManifest, createLavaLampEffect],
  [meshGradientManifest, createMeshGradientEffect],
  [neuralNoiseManifest, createNeuralNoiseEffect],
  [neuroNoiseManifest, createNeuroNoiseEffect],
  [specularBandManifest, createSpecularBandEffect],
  [swarmManifest, createSwarmEffect],
  [waterRippleManifest, createWaterRippleEffect],
  [animatedGradientManifest, createAnimatedGradientEffect],
  [glassSlideshowManifest, createGlassSlideshowEffect],
  [infiniteGalleryManifest, createInfiniteGalleryEffect],
  [mcGlobeManifest, createMcGlobeEffect],
  [mediaManifest, createMediaEffect],
  [pixelManifest, createPixelEffect],
];

/**
 * `gradient` is the built-in reference/test fixture (not one of the requested
 * sources), so it stays registered for tests but is excluded from the user-facing
 * catalog. CATALOG_EXCLUDE holds any such non-catalog built-ins.
 */
const CATALOG_EXCLUDE = new Set(['gradient']);

const builtins = RAW.map(([manifest, factory]) => ({
  manifest: validateManifest(manifest),
  factory,
}));

/** Registry of effect-id -> factory. */
export const effectFactories: Record<string, EffectFactory> = Object.fromEntries(
  builtins.map((b) => [b.manifest.id, b.factory]),
);

/** Every built-in manifest shown in the playground catalog (excludes reference fixtures). */
export const builtinManifests = builtins
  .filter((b) => !CATALOG_EXCLUDE.has(b.manifest.id))
  .map((b) => b.manifest);

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

/** Options for {@link mountStack}. */
export interface MountStackOptions {
  /**
   * Honor `prefers-reduced-motion: reduce` by rendering a single static frame
   * instead of running the animation loop. Defaults to `true`; pass `false` to
   * always animate. (The <tilt-stack> element does NOT guard reduced-motion;
   * this is the accessible mount path the embed snippet uses.)
   */
  respectReducedMotion?: boolean;
}

/**
 * Imperatively mount an exported stack config into a host element, no hosting or
 * custom-element wiring required. This is the portable entry point the embed
 * snippet uses: it inlines the config and calls mountStack, so a stack renders
 * wherever the runtime bundle is served - the preview IS the export.
 *
 * Registers the built-in effects (idempotent), composites the layers into
 * `host`, and drives a RAF loop - unless reduced-motion is requested, in which
 * case it paints one static frame. Returns a disposer that stops the loop and
 * tears the compositor down.
 */
export function mountStack(
  host: HTMLElement,
  config: { layers: LayerConfig[] },
  opts: MountStackOptions = {},
): () => void {
  registerBuiltins();
  const compositor = new Compositor(host, (id: string): Effect => {
    const factory = effectFactories[id];
    if (!factory) throw new Error(`unknown effect id: ${id}`);
    return factory();
  });
  compositor.setLayers(config.layers);

  const reduced =
    opts.respectReducedMotion !== false &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  if (reduced) {
    compositor.renderFrame(0); // single static frame; no animation loop
    return () => compositor.dispose();
  }

  let raf = 0;
  const loop = (t: number) => {
    compositor.renderFrame(t);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    compositor.dispose();
  };
}

export { effectAssets } from './effect-assets';
export { validateManifest } from './manifest';
export { validateStack, orderLayers } from './stack';
export { defineEffectElement } from './element';
export { Compositor } from './compositor';
export { PointerTracker } from './pointer';
export type { Effect, Manifest, LayerConfig, LayerRole } from './types';
