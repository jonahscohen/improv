import { describe, it, expect } from 'vitest';
import { createPixelEffect } from './index';

describe('createPixelEffect', () => {
  it('init + resize builds the grid and frame draws without throwing', () => {
    const effect = createPixelEffect();
    const canvas = document.createElement('canvas');
    effect.init(canvas, {
      params: { gap: 8, speed: 40, pattern: 'center', colors: '#fff,#ccc', backgroundColor: '#17181A' },
      assets: {},
    });
    effect.resize(120, 80);
    expect(() => effect.frame(0)).not.toThrow();
    expect(() => effect.frame(16)).not.toThrow();
  });

  it('every reveal pattern resizes + frames without throwing', () => {
    for (const pattern of ['center', 'top', 'bottom', 'left', 'right', 'diagonal', 'ascend', 'random', 'spiral']) {
      const effect = createPixelEffect();
      const canvas = document.createElement('canvas');
      effect.init(canvas, { params: { gap: 10, speed: 50, pattern, colors: '#fff' }, assets: {} });
      effect.resize(60, 40);
      expect(() => effect.frame(0)).not.toThrow();
    }
  });

  it('setParam updates live params and dispose is idempotent', () => {
    const effect = createPixelEffect();
    const canvas = document.createElement('canvas');
    effect.init(canvas, { params: { gap: 8, speed: 40, pattern: 'center', colors: '#fff' }, assets: {} });
    effect.resize(50, 50);
    effect.setParam('gap', 12);
    effect.setParam('pattern', 'spiral');
    effect.setParam('colors', '#ff6900,#ffffff');
    effect.setParam('backgroundColor', '#000000');
    expect(() => effect.frame(32)).not.toThrow();
    expect(() => { effect.dispose(); effect.dispose(); }).not.toThrow();
  });
});
