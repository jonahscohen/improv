import { describe, it, expect } from 'vitest';
import { createFake3DImageEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('fake-3d-image effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createFake3DImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    e.onPointer?.(10, 10);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createFake3DImageEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
