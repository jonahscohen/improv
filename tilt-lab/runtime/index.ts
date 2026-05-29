import { defineEffectElement } from './element';
import { defineStackElement, setStackFactory } from './compositor';
import { validateManifest } from './manifest';
import type { Effect, EffectFactory } from './types';
import { createGradientEffect } from './effects/gradient/index';
import gradientManifest from './effects/gradient/manifest.json';

/** Registry of effect-id -> factory. Acquisition adds entries here. */
export const effectFactories: Record<string, EffectFactory> = {
  gradient: createGradientEffect,
};

export function registerBuiltins(): void {
  defineEffectElement(validateManifest(gradientManifest), createGradientEffect);
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
export type { Effect, Manifest, LayerConfig, LayerRole } from './types';
