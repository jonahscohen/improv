import { describe, it, expect } from 'vitest';
import {
  buildStackConfig,
  serializeStackConfig,
  STACK_CONFIG_FORMAT,
  STACK_CONFIG_VERSION,
} from './export';
import type { LayerConfig } from '../../../runtime/types';

// Build loosely-typed test layers so the suite is robust whether or not the
// runtime LayerConfig already declares enabled/opacity.
const base = {
  effectId: 'grid',
  layerRole: 'background',
  params: { speed: 2, color: '#fff' },
  blendMode: 'source-over',
} as unknown as LayerConfig;

describe('export', () => {
  it('builds a versioned config and defaults enabled/opacity', () => {
    const cfg = buildStackConfig([base]);
    expect(cfg.format).toBe(STACK_CONFIG_FORMAT);
    expect(cfg.version).toBe(STACK_CONFIG_VERSION);
    expect(cfg.layers).toHaveLength(1);
    expect(cfg.layers[0]).toMatchObject({
      effectId: 'grid',
      layerRole: 'background',
      blendMode: 'source-over',
      enabled: true,
      opacity: 1,
    });
    expect(cfg.layers[0].params).toEqual({ speed: 2, color: '#fff' });
  });

  it('preserves explicit enabled/opacity from the layer', () => {
    const composed = { ...base, enabled: false, opacity: 0.5 } as unknown as LayerConfig;
    const cfg = buildStackConfig([composed]);
    expect(cfg.layers[0].enabled).toBe(false);
    expect(cfg.layers[0].opacity).toBe(0.5);
  });

  it('serializes to valid JSON containing the layer fields', () => {
    const parsed = JSON.parse(serializeStackConfig([base]));
    expect(parsed.format).toBe(STACK_CONFIG_FORMAT);
    expect(parsed.layers[0].effectId).toBe('grid');
    expect(parsed.layers[0].opacity).toBe(1);
  });

  it('clones params so later mutation does not leak into the config', () => {
    const cfg = buildStackConfig([base]);
    (cfg.layers[0].params as Record<string, unknown>).speed = 999;
    expect((base.params as Record<string, unknown>).speed).toBe(2);
  });
});
