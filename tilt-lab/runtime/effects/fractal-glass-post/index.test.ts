import { describe, it, expect } from 'vitest';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('fractal-glass-post manifest', () => {
  it('is a valid post-role manifest with the expected id', () => {
    const m = validateManifest(manifest);
    expect(m.id).toBe('fractal-glass-post');
    expect(m.layerRole).toBe('post');
  });
});
