import { describe, it, expect } from 'vitest';
import { FluidSolver, noise } from './fluid-solver';

describe('FluidSolver', () => {
  it('constructs at the requested grid size', () => {
    const s = new FluidSolver({ width: 32, height: 16 });
    expect(s.width).toBe(32);
    expect(s.height).toBe(16);
  });

  it('stepping a quiescent field stays finite and at rest', () => {
    const s = new FluidSolver({ width: 24, height: 24, curlStrength: 0 });
    for (let i = 0; i < 5; i++) s.step(1 / 60, i / 60);
    expect(Number.isFinite(s.maxSpeed())).toBe(true);
    expect(s.maxSpeed()).toBeLessThan(1e-3);
  });

  it('pointer injection raises velocity, then it decays back down', () => {
    const s = new FluidSolver({ width: 32, height: 32, curlStrength: 0, velocityDecay: 4 });
    s.addPointer(0.6, 0.5, 0.4, 0.5, true);
    const injected = s.maxSpeed();
    expect(injected).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) s.step(1 / 60, i / 60);
    expect(s.maxSpeed()).toBeLessThan(injected);
  });

  it('a down=false pointer injects nothing', () => {
    const s = new FluidSolver({ width: 16, height: 16, curlStrength: 0 });
    s.addPointer(0.6, 0.5, 0.4, 0.5, false);
    expect(s.maxSpeed()).toBe(0);
  });

  it('projection keeps total divergence finite and bounded', () => {
    const s = new FluidSolver({ width: 32, height: 32, iterations: 20 });
    s.addPointer(0.7, 0.3, 0.2, 0.8, true);
    s.step(1 / 60, 0);
    const div = s.totalDivergence();
    expect(Number.isFinite(div)).toBe(true);
  });

  it('color field decays toward the background', () => {
    const s = new FluidSolver({ width: 16, height: 16, colorDecay: 6 });
    s.setBackground(0.5, 0.25, 0.75);
    for (let i = 0; i < 60; i++) s.step(1 / 60, i / 60);
    const rgba = s.colorRGBA;
    expect(rgba[0]).toBeGreaterThan(0.3);
    expect(rgba[3]).toBe(1);
    expect(rgba.length).toBe(16 * 16 * 4);
  });

  it('setBackgroundField fills per-cell colors', () => {
    const s = new FluidSolver({ width: 8, height: 8, colorDecay: 10 });
    s.setBackgroundField((u) => [u, 0, 1 - u]);
    for (let i = 0; i < 40; i++) s.step(1 / 60, i / 60);
    const rgba = s.colorRGBA;
    // right-most cells should be redder than left-most
    const left = rgba[0];
    const right = rgba[(7 * 8 + 7) * 4];
    expect(right).toBeGreaterThan(left);
  });

  it('reset clears velocity and color', () => {
    const s = new FluidSolver({ width: 16, height: 16 });
    s.addPointer(0.6, 0.5, 0.4, 0.5, true);
    s.reset();
    expect(s.maxSpeed()).toBe(0);
  });

  it('ported simplex noise is finite and roughly in [-1,1]', () => {
    for (let i = 0; i < 50; i++) {
      const v = noise.snoise(i * 0.13, i * 0.27, i * 0.41);
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(1.5);
    }
  });

  it('ported curl noise returns a finite 2D vector', () => {
    const out: [number, number] = [0, 0];
    noise.curlNoise2D(0.3, 0.7, 0.1, out);
    expect(Number.isFinite(out[0])).toBe(true);
    expect(Number.isFinite(out[1])).toBe(true);
  });
});
