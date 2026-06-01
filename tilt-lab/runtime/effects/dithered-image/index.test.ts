import { describe, it, expect } from 'vitest';
import { createDitheredImageEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('dithered-image effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('is a post effect that dithers the layers beneath (onBeneath hook present)', () => {
    expect(manifest.layerRole).toBe('post');
    const e = createDitheredImageEffect();
    expect(typeof e.onBeneath).toBe('function');
  });

  it('accepts a beneath-composite canvas via onBeneath without throwing', () => {
    const e = createDitheredImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    const beneath = document.createElement('canvas');
    beneath.width = 64;
    beneath.height = 64;
    expect(() => {
      e.onBeneath?.(beneath);
      e.frame(16);
    }).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createDitheredImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('exposes every dither map and builds each without throwing', () => {
    const ditherParam = manifest.params.find((p) => p.name === 'ditherMap');
    expect(ditherParam?.options).toEqual(['bayer4x4', 'bayer8x8', 'halftone', 'voidAndCluster']);

    const e = createDitheredImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      for (const map of ditherParam!.options!) {
        e.setParam('ditherMap', map);
        e.frame(16);
      }
    }).not.toThrow();
  });

  it('exposes a src image-upload file param and accepts it via setParam', () => {
    expect(manifest.params.find((p) => p.name === 'src')?.type).toBe('file');

    const e = createDitheredImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.setParam('src', 'blob:mock-upload');
      e.frame(16);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createDitheredImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
