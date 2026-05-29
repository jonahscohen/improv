import { describe, it, expect } from 'vitest';
import { createGradientEffect } from './index';

describe('createGradientEffect', () => {
  it('init reads params and resize updates dimensions without throwing', () => {
    const effect = createGradientEffect();
    const canvas = document.createElement('canvas');
    effect.init(canvas, {
      params: { speed: 2, colorA: '#000000', colorB: '#ffffff' },
      assets: {},
    });
    effect.resize(100, 50);
    expect(() => effect.frame(0)).not.toThrow();
  });

  it('setParam updates a live param', () => {
    const effect = createGradientEffect();
    const canvas = document.createElement('canvas');
    effect.init(canvas, {
      params: { speed: 1, colorA: '#000000', colorB: '#ffffff' },
      assets: {},
    });
    effect.setParam('speed', 4);
    effect.resize(10, 10);
    expect(() => effect.frame(100)).not.toThrow();
  });

  it('dispose is idempotent', () => {
    const effect = createGradientEffect();
    const canvas = document.createElement('canvas');
    effect.init(canvas, { params: { speed: 1, colorA: '#000', colorB: '#fff' }, assets: {} });
    expect(() => {
      effect.dispose();
      effect.dispose();
    }).not.toThrow();
  });
});
