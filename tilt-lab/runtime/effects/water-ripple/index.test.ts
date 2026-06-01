import { describe, it, expect } from 'vitest';
import { createWaterRippleEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('water-ripple effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('is a post effect that ripples the layers beneath', () => {
    expect(manifest.layerRole).toBe('post');
  });

  it('init + resize + frame run without throwing', () => {
    const e = createWaterRippleEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    e.onPointer?.(20, 20);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('exposes pointer + press + beneath hooks for the post interaction contract', () => {
    const e = createWaterRippleEffect();
    expect(typeof e.onPointer).toBe('function');
    expect(typeof e.onPointerDown).toBe('function');
    expect(typeof e.onBeneath).toBe('function');
  });

  it('press and beneath-composite delivery run without throwing', () => {
    const e = createWaterRippleEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    const beneath = document.createElement('canvas');
    beneath.width = 64;
    beneath.height = 64;
    expect(() => {
      e.onPointerDown?.(10, 10);
      e.onBeneath?.(beneath);
      e.frame(16);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createWaterRippleEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
