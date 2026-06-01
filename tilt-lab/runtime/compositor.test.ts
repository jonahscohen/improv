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
  it("renders in the user's explicit stack order (not re-sorted by role)", () => {
    RecordingEffect.log = [];
    const root = document.createElement('div');
    const c = new Compositor(root, (id) => new RecordingEffect(id));
    // Deliberately "out of role order": a post first, then background, then
    // midground. The compositor must honor THIS order so reordering in the
    // composition panel is meaningful - it must NOT shuffle to bg/mid/post.
    c.setLayers([layer('ascii', 'post'), layer('grad', 'background'), layer('globe', 'midground')]);
    const inits = RecordingEffect.log.filter((l) => l.startsWith('init:'));
    expect(inits).toEqual(['init:ascii', 'init:grad', 'init:globe']);
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

  it('delivers the composited beneath-scene to a WebGL post effect via onBeneath', () => {
    // happy-dom has no real 2D context, so stub getContext('2d') with a recorder.
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (id: string) => unknown;
    };
    const original = proto.getContext;
    const drawn: unknown[] = [];
    proto.getContext = function (id: string) {
      if (id === '2d') {
        return {
          clearRect() {},
          drawImage(src: unknown) {
            drawn.push(src);
          },
          set globalAlpha(_v: number) {},
          get globalAlpha() {
            return 1;
          },
        };
      }
      return null;
    };

    try {
      const received: HTMLCanvasElement[] = [];
      class BeneathEffect extends RecordingEffect {
        onBeneath(source: HTMLCanvasElement) {
          received.push(source);
        }
      }
      const root = document.createElement('div');
      const c = new Compositor(root, (id) =>
        id === 'post' ? new BeneathEffect(id) : new RecordingEffect(id),
      );
      c.setLayers([layer('bg', 'background'), layer('post', 'post')]);
      c.renderFrame(16);

      // The post effect was handed a canvas, and the beneath (bg) layer's canvas
      // was composited into it (one drawImage of the lower layer).
      expect(received.length).toBe(1);
      expect(received[0]).toBeInstanceOf(HTMLCanvasElement);
      expect(drawn.length).toBeGreaterThanOrEqual(1);
    } finally {
      proto.getContext = original;
    }
  });

  it('does not blit onto a WebGL post effect that uses onBeneath (no own-canvas 2D draw)', () => {
    // With no 2D context available (headless), the onBeneath branch must stay
    // crash-free and still render the post layer's frame.
    RecordingEffect.log = [];
    const received: unknown[] = [];
    class BeneathEffect extends RecordingEffect {
      onBeneath(source: HTMLCanvasElement) {
        received.push(source);
      }
    }
    const root = document.createElement('div');
    const c = new Compositor(root, (id) =>
      id === 'post' ? new BeneathEffect(id) : new RecordingEffect(id),
    );
    c.setLayers([layer('bg', 'background'), layer('post', 'post')]);
    RecordingEffect.log = [];
    expect(() => c.renderFrame(16)).not.toThrow();
    expect(RecordingEffect.log).toEqual(['frame:bg', 'frame:post']);
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
