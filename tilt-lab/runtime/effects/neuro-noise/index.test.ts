import { describe, it, expect } from 'vitest';
import { createNeuroNoiseEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('neuro-noise effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createNeuroNoiseEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createNeuroNoiseEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });

  it('exposes a preset selector with the 4 paper presets + a Custom sentinel', () => {
    const preset = manifest.params.find((p) => p.name === 'preset');
    expect(preset).toBeDefined();
    expect(preset?.options).toEqual(['Default', 'Sensation', 'Bloodstream', 'Ghost', 'Custom']);
  });

  it('applying each preset via setParam does not throw', () => {
    const e = createNeuroNoiseEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    for (const name of ['Default', 'Sensation', 'Bloodstream', 'Ghost']) {
      expect(() => {
        e.setParam('preset', name);
        e.frame(16);
      }).not.toThrow();
    }
  });
});
