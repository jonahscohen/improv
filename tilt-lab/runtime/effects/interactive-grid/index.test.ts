import { describe, it, expect } from 'vitest';
import { createInteractiveGridEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('interactive-grid effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createInteractiveGridEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    e.onPointer?.(32, 32);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('exposes the pointer interaction handlers', () => {
    const e = createInteractiveGridEffect();
    expect(typeof e.onPointer).toBe('function');
    expect(typeof e.onPointerLeave).toBe('function');
  });

  it('handles pointer move + leave + frame without throwing', () => {
    const e = createInteractiveGridEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => {
      e.onPointer?.(10, 10);
      e.onPointer?.(30, 25);
      e.frame(16);
      e.onPointerLeave?.();
      e.frame(32);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createInteractiveGridEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
