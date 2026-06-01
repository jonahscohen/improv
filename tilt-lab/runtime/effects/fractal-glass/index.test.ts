import { describe, it, expect } from 'vitest';
import { createFractalGlassEffect, createFractalGlassPostEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('fractal-glass effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createFractalGlassEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    e.onPointer?.(32, 32, false);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('post variant exposes onBeneath and survives a beneath -> frame cycle', () => {
    const e = createFractalGlassPostEffect();
    expect(typeof e.onBeneath).toBe('function');
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    const beneath = document.createElement('canvas');
    beneath.width = 64;
    beneath.height = 64;
    expect(() => {
      e.onBeneath?.(beneath);
      e.onPointer?.(20, 20, false);
      e.frame(16);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createFractalGlassEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
