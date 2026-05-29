import { describe, it, expect } from 'vitest';
import { createCursorTrailEffect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('cursor-trail effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createCursorTrailEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('mount + onPointer build and cap the DOM trail without throwing', () => {
    const e = createCursorTrailEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    const assets = { item1: 'item1.png', item2: 'item2.png' };
    e.init(canvas, { params, assets });
    const host = document.createElement('div');
    document.body.appendChild(host);
    expect(() => {
      e.mount?.(host, { params, assets });
      // Walk far enough each step to pass the distance gate and overflow trailLength.
      for (let i = 0; i < 15; i++) e.onPointer?.(i * 200, i * 200);
    }).not.toThrow();
    // Trail is capped at trailLength live nodes (exiting nodes removed via timer).
    expect(host.querySelectorAll('img').length).toBeLessThanOrEqual(15);
    host.remove();
  });

  it('dispose is idempotent', () => {
    const e = createCursorTrailEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
