import { describe, it, expect } from 'vitest';
import { createGlassSlideshowEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('glass-slideshow effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createGlassSlideshowEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('exposes image0..image3 slide-upload file params and accepts them via setParam', () => {
    const uploads = manifest.params.filter((p) => p.type === 'file');
    expect(uploads.map((p) => p.name)).toEqual(['image0', 'image1', 'image2', 'image3']);

    const e = createGlassSlideshowEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.setParam('image2', 'blob:mock-slide-2');
      e.frame(16);
    }).not.toThrow();
  });

  it('exposes scroll + drag navigation handlers', () => {
    const e = createGlassSlideshowEffect();
    expect(typeof e.onWheel).toBe('function');
    expect(typeof e.onPointer).toBe('function');
    expect(typeof e.onPointerDown).toBe('function');
    expect(typeof e.onPointerUp).toBe('function');
  });

  it('advances via wheel + drag without throwing', () => {
    const e = createGlassSlideshowEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => {
      e.onWheel?.(120, 32, 32);
      e.onWheel?.(120, 32, 32);
      e.frame(16);
      e.onPointerDown?.(50, 50);
      e.onPointer?.(10, 50, true);
      e.onPointer?.(-180, 50, true);
      e.onPointerUp?.(0, 50);
      e.onPointerLeave?.();
      e.frame(32);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createGlassSlideshowEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
