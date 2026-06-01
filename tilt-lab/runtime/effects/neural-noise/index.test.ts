import { describe, it, expect } from 'vitest';
import { createNeuralNoiseEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('neural-noise effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createNeuralNoiseEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createNeuralNoiseEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });

  it('exposes interactivity + appearance customization params', () => {
    const names = manifest.params.map((p) => p.name);
    for (const expected of ['speed', 'scale', 'brightness', 'contrast', 'tint', 'tintStrength', 'warp', 'pointerStrength']) {
      expect(names).toContain(expected);
    }
    // tint is a color control; the rest are numeric ranges.
    const tint = manifest.params.find((p) => p.name === 'tint');
    expect(tint?.type).toBe('color');
  });

  it('implements the pointer contract', () => {
    const e = createNeuralNoiseEffect();
    expect(typeof e.onPointer).toBe('function');
    expect(typeof e.onPointerLeave).toBe('function');
  });

  it('pointer + customization params do not throw (headless)', () => {
    const e = createNeuralNoiseEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => {
      e.onPointer?.(32, 32, false);
      e.onPointer?.(10, 50, true);
      e.onPointerLeave?.();
      for (const p of ['scale', 'brightness', 'contrast', 'tintStrength', 'warp', 'pointerStrength', 'speed']) {
        e.setParam(p, 0.5);
      }
      e.setParam('tint', '#ff8800');
      e.frame(32);
    }).not.toThrow();
  });
});
