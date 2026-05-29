import { describe, it, expect } from 'vitest';
import { registerBuiltins, effectFactories } from './index';

describe('runtime index', () => {
  it('registerBuiltins defines tilt-gradient and tilt-stack', () => {
    registerBuiltins();
    expect(customElements.get('tilt-gradient')).toBeDefined();
    expect(customElements.get('tilt-stack')).toBeDefined();
  });

  it('exposes a factory for each built-in effect id', () => {
    expect(typeof effectFactories.gradient).toBe('function');
  });
});
