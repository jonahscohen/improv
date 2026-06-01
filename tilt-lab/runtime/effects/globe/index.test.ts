import { describe, it, expect } from 'vitest';
import { createGlobeEffect, createGlobeRotation } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('globe effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it('ships cobe true-library defaults (not the README demo values)', () => {
    const byName = Object.fromEntries(manifest.params.map((p) => [p.name, p]));
    expect(byName.preset.default).toBe('Cobe Default');
    expect(byName.mapSamples.default).toBe(10000);
    expect(byName.mapBrightness.default).toBe(1);
    expect(byName.diffuse.default).toBe(1);
    expect(byName.dark.default).toBe(0);
    expect(byName.baseColor.default).toBe('#ffffff');
    expect(byName.markerColor.default).toBe('#ff8000');
  });

  it('exposes markers as an editable marker-list param', () => {
    const markers = manifest.params.find((p) => p.name === 'markers');
    expect(markers?.type).toBe('marker-list');
    expect(Array.isArray(markers?.default)).toBe(true);
  });

  it('accepts a live marker-list edit via setParam without throwing', () => {
    const e = createGlobeEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() =>
      e.setParam('markers', [{ location: [12, 34], size: 0.08 }]),
    ).not.toThrow();
    expect(() => e.frame(16)).not.toThrow();
  });

  it('init + resize + frame run without throwing', () => {
    const e = createGlobeEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });

  it('drag rotates the globe: horizontal drag advances phi, vertical changes theta', () => {
    const rot = createGlobeRotation({ basePhi: 0, baseTheta: 0.3, autoRotate: false });
    const phi0 = rot.phi();
    const theta0 = rot.theta();

    rot.pointerDown(100, 100);
    expect(rot.isDragging()).toBe(true);
    // A pointer move without a press must NOT rotate (hover, not drag).
    const rotHover = createGlobeRotation({ autoRotate: false });
    const hoverPhi = rotHover.phi();
    rotHover.pointerMove(200, 100, false);
    expect(rotHover.phi()).toBe(hoverPhi);

    // Drag right + down -> phi increases, theta changes.
    rot.pointerMove(180, 140, true);
    expect(rot.phi()).toBeGreaterThan(phi0);
    expect(rot.theta()).not.toBe(theta0);
  });

  it('auto-rotation advances phi over time and freezes during a drag', () => {
    const rot = createGlobeRotation({ basePhi: 0, speed: 0.3, autoRotate: true });
    const start = rot.phi();
    rot.tick(1000); // 1s at 0.3 rad/s
    expect(rot.phi()).toBeGreaterThan(start);

    // While dragging, ticks must not advance the base rotation.
    rot.pointerDown(0, 0);
    const held = rot.phi();
    rot.tick(1000);
    expect(rot.phi()).toBe(held);
  });

  it('release carries inertia that advances then decays toward rest', () => {
    const rot = createGlobeRotation({ autoRotate: false });
    rot.pointerDown(0, 0);
    rot.pointerMove(60, 0, true); // a flick to the right
    const atRelease = rot.phi();
    rot.pointerUp();

    rot.tick(16); // first inertial step
    const afterOne = rot.phi();
    expect(afterOne).toBeGreaterThan(atRelease); // momentum keeps spinning

    // Inertia decays: each subsequent step adds less than the previous one.
    const step1 = afterOne - atRelease;
    rot.tick(16);
    const step2 = rot.phi() - afterOne;
    expect(step2).toBeLessThan(step1);
    expect(step2).toBeGreaterThan(0);
  });

  it('theta drag is clamped so the poles never flip', () => {
    const rot = createGlobeRotation({ baseTheta: 0, autoRotate: false });
    rot.pointerDown(0, 0);
    // A huge vertical drag must not push theta past the safe band.
    rot.pointerMove(0, 100000, true);
    expect(Math.abs(rot.theta())).toBeLessThanOrEqual(1.4 + 1e-9);
  });

  it('effect forwards pointer drag without throwing (headless-safe)', () => {
    const e = createGlobeEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => {
      e.onPointerDown?.(10, 10);
      e.onPointer?.(40, 24, true);
      e.onPointerUp?.(40, 24);
      e.onPointerLeave?.();
      e.frame(16);
    }).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const e = createGlobeEffect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => {
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
});
