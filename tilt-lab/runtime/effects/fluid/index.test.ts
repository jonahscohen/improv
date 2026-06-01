import { describe, it, expect } from 'vitest';
import { createFluidEffect, fluidClipFromPixel } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('fluidClipFromPixel (pointer pixel -> sim clip space)', () => {
  it('maps center pixel to clip origin', () => {
    const [cx, cy] = fluidClipFromPixel(50, 50, 100, 100);
    expect(cx).toBeCloseTo(0, 6);
    expect(cy).toBeCloseTo(0, 6);
  });

  it('maps corners to clip extents with y flipped to y-up', () => {
    expect(fluidClipFromPixel(0, 0, 100, 100)).toEqual([-1, 1]); // top-left
    expect(fluidClipFromPixel(100, 100, 100, 100)).toEqual([1, -1]); // bottom-right
  });

  it('guards a zero-sized canvas (no divide-by-zero)', () => {
    const [cx, cy] = fluidClipFromPixel(10, 10, 0, 0);
    expect(Number.isFinite(cx)).toBe(true);
    expect(Number.isFinite(cy)).toBe(true);
  });
});

describe('fluid effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createFluidEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    e.onPointer?.(32, 32, false);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('exposes the full pointer surface (hover, drag, release)', () => {
    const e = createFluidEffect();
    expect(typeof e.onPointer).toBe('function');
    expect(typeof e.onPointerDown).toBe('function');
    expect(typeof e.onPointerUp).toBe('function');
    expect(typeof e.onPointerLeave).toBe('function');
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    // hover -> drag -> release sequence must not throw (drag = pressed true).
    expect(() => {
      e.onPointer?.(10, 10, false);
      e.frame(16);
      e.onPointerDown?.(20, 20);
      e.onPointer?.(24, 24, true);
      e.frame(32);
      e.onPointerUp?.(24, 24);
      e.onPointer?.(30, 30, false);
      e.frame(48);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createFluidEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
