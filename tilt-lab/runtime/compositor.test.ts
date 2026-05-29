import { describe, it, expect } from 'vitest';
import { Compositor } from './compositor';
import type { Effect, EffectOpts, LayerConfig } from './types';

class RecordingEffect implements Effect {
  static log: string[] = [];
  constructor(private id: string) {}
  init(_c: HTMLCanvasElement, _o: EffectOpts) {
    RecordingEffect.log.push(`init:${this.id}`);
  }
  frame(_t: number) {
    RecordingEffect.log.push(`frame:${this.id}`);
  }
  resize(_w: number, _h: number) {
    RecordingEffect.log.push(`resize:${this.id}`);
  }
  setParam() {}
  dispose() {
    RecordingEffect.log.push(`dispose:${this.id}`);
  }
}

function layer(effectId: string, role: LayerConfig['layerRole']): LayerConfig {
  return { effectId, layerRole: role, params: {}, blendMode: 'source-over' };
}

describe('Compositor', () => {
  it('inits layers in render order (background first, post last)', () => {
    RecordingEffect.log = [];
    const root = document.createElement('div');
    const c = new Compositor(root, (id) => new RecordingEffect(id));
    c.setLayers([layer('ascii', 'post'), layer('grad', 'background'), layer('globe', 'midground')]);
    const inits = RecordingEffect.log.filter((l) => l.startsWith('init:'));
    expect(inits).toEqual(['init:grad', 'init:globe', 'init:ascii']);
  });

  it('sizes layers by calling resize after setLayers', () => {
    RecordingEffect.log = [];
    const root = document.createElement('div');
    const c = new Compositor(root, (id) => new RecordingEffect(id));
    c.setLayers([layer('grad', 'background')]);
    expect(RecordingEffect.log).toContain('resize:grad');
  });

  it('appends one stacked surface per layer to the host', () => {
    const root = document.createElement('div');
    const c = new Compositor(root, (id) => new RecordingEffect(id));
    c.setLayers([layer('grad', 'background'), layer('ascii', 'post')]);
    const canvases = root.querySelectorAll('canvas');
    expect(canvases.length).toBe(2);
    expect(root.style.position).toBe('relative');
  });

  it('renders a frame for every layer in order', () => {
    RecordingEffect.log = [];
    const root = document.createElement('div');
    const c = new Compositor(root, (id) => new RecordingEffect(id));
    c.setLayers([layer('grad', 'background'), layer('ascii', 'post')]);
    RecordingEffect.log = [];
    c.renderFrame(16);
    expect(RecordingEffect.log).toEqual(['frame:grad', 'frame:ascii']);
  });

  it('disposes all layers and removes their surfaces on clear', () => {
    RecordingEffect.log = [];
    const root = document.createElement('div');
    const c = new Compositor(root, (id) => new RecordingEffect(id));
    c.setLayers([layer('grad', 'background')]);
    RecordingEffect.log = [];
    c.clear();
    expect(RecordingEffect.log).toEqual(['dispose:grad']);
    expect(root.querySelectorAll('canvas').length).toBe(0);
  });
});
