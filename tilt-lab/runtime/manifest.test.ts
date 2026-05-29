import { describe, it, expect } from 'vitest';
import { validateManifest } from './manifest';

const valid = {
  id: 'gradient',
  name: 'Gradient',
  category: 'gradient',
  layerRole: 'background',
  params: [{ name: 'speed', type: 'range', default: 1, min: 0, max: 5 }],
  requiredAssets: [],
  origin: 'builtin',
  license: 'MIT',
  attribution: 'tilt-lab',
  redistribution: 'ok',
  tags: ['gradient'],
};

describe('validateManifest', () => {
  it('returns a typed manifest for valid input', () => {
    const m = validateManifest(valid);
    expect(m.id).toBe('gradient');
    expect(m.layerRole).toBe('background');
    expect(m.params[0].name).toBe('speed');
  });

  it('throws when id is missing', () => {
    const bad = { ...valid, id: undefined };
    expect(() => validateManifest(bad)).toThrow(/id/);
  });

  it('throws on an unknown layerRole', () => {
    const bad = { ...valid, layerRole: 'foreground' };
    expect(() => validateManifest(bad)).toThrow(/layerRole/);
  });

  it('throws when a param is missing a default', () => {
    const bad = { ...valid, params: [{ name: 'speed', type: 'range' }] };
    expect(() => validateManifest(bad)).toThrow(/default/);
  });
});
