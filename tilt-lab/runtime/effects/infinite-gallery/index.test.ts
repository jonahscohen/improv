import { describe, it, expect } from 'vitest';
import { createInfiniteGalleryEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('infinite-gallery effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createInfiniteGalleryEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('exposes image0..image5 tile-upload file params and accepts them via setParam', () => {
    const uploads = manifest.params.filter((p) => p.type === 'file');
    expect(uploads.map((p) => p.name)).toEqual(['image0', 'image1', 'image2', 'image3', 'image4', 'image5']);

    const e = createInfiniteGalleryEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.setParam('image4', 'blob:mock-tile-4');
      e.frame(16);
    }).not.toThrow();
  });

  it('exposes the scroll (onWheel) + drag handlers', () => {
    const e = createInfiniteGalleryEffect();
    expect(typeof e.onWheel).toBe('function');
    expect(typeof e.onPointer).toBe('function');
    expect(typeof e.onPointerLeave).toBe('function');
  });

  it('scrolls via wheel + drag without throwing', () => {
    const e = createInfiniteGalleryEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => {
      e.frame(0);
      e.onWheel?.(100, 32, 32);
      e.onPointer?.(32, 20, true);
      e.onPointer?.(32, 40, true);
      e.onPointer?.(32, 40, false);
      e.onPointerLeave?.();
      e.frame(16);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createInfiniteGalleryEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
