import { describe, it, expect } from 'vitest';
import { registerBuiltins, effectFactories, builtinManifests } from './index';
import { Compositor } from './compositor';
import { validateStack } from './stack';
import type { Effect, LayerConfig } from './types';

describe('acquired effects integration', () => {
  it('registers a tilt-{id} element for every factory', () => {
    registerBuiltins();
    for (const id of Object.keys(effectFactories)) {
      expect(customElements.get(`tilt-${id}`), `tilt-${id}`).toBeDefined();
    }
  });

  it('registers tilt-stack', () => {
    registerBuiltins();
    expect(customElements.get('tilt-stack')).toBeDefined();
  });

  it('every built-in manifest is valid and has a matching factory', () => {
    for (const m of builtinManifests) {
      expect(typeof effectFactories[m.id], m.id).toBe('function');
    }
  });

  it('composites a valid background + midground + pointer + post stack without throwing', () => {
    const role = (id: string) => builtinManifests.find((m) => m.id === id)!.layerRole;
    const layers: LayerConfig[] = [
      { effectId: 'gradient', layerRole: role('gradient'), params: {}, blendMode: 'source-over' },
      { effectId: 'globe', layerRole: role('globe'), params: {}, blendMode: 'source-over' },
      { effectId: 'swarm', layerRole: role('swarm'), params: {}, blendMode: 'source-over' },
      { effectId: 'ascii', layerRole: role('ascii'), params: {}, blendMode: 'source-over' },
    ];
    expect(validateStack(layers).valid).toBe(true);

    const root = document.createElement('div');
    const c = new Compositor(root, (id): Effect => effectFactories[id]());
    expect(() => {
      c.setLayers(layers);
      c.renderFrame(16);
      c.clear();
    }).not.toThrow();
  });
});
