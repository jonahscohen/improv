import type { Effect, LayerConfig } from './types';
import { orderLayers } from './stack';
import { PointerTracker } from './pointer';

type FactoryById = (effectId: string) => Effect;

interface MountedLayer {
  config: LayerConfig;
  effect: Effect;
  /** The per-layer surface stacked in the host (canvas for GL/2d effects, div for mount() effects). */
  surface: HTMLElement;
  canvas: HTMLCanvasElement | null;
}

/**
 * Orchestrates an ordered set of layers. Each layer renders into its OWN
 * absolutely-positioned surface stacked inside the host (background lowest,
 * post highest), composited by the browser via stacking order + mix-blend-mode.
 * The host is sized via a ResizeObserver; every layer's drawing buffer is kept
 * in sync and effect.resize() is called. Pointer-driven layers receive moves
 * from a shared PointerTracker.
 */
export class Compositor {
  private layers: MountedLayer[] = [];
  private pointer: PointerTracker;
  private ro?: ResizeObserver;

  constructor(private root: HTMLElement, private factory: FactoryById) {
    if (!this.root.style.position) this.root.style.position = 'relative';
    this.pointer = new PointerTracker(this.root);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);
    }
  }

  setLayers(configs: LayerConfig[]): void {
    this.clear();
    const ordered = orderLayers(configs);
    const w = this.root.clientWidth || 1;
    const h = this.root.clientHeight || 1;
    ordered.forEach((config, i) => {
      const effect = this.factory(config.effectId);
      let surface: HTMLElement;
      let canvas: HTMLCanvasElement | null = null;

      if (effect.mount) {
        surface = document.createElement('div');
      } else {
        canvas = document.createElement('canvas');
        surface = canvas;
      }

      surface.style.position = 'absolute';
      surface.style.inset = '0';
      surface.style.width = '100%';
      surface.style.height = '100%';
      surface.style.zIndex = String(i);
      if (config.blendMode && config.blendMode !== 'source-over') {
        surface.style.mixBlendMode = config.blendMode;
      }
      this.root.appendChild(surface);

      // Size the drawing buffer BEFORE init so WebGL/OGL effects configure their
      // viewport and uniforms against the real size, not a detached 0x0 canvas.
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
        effect.init(canvas, { params: config.params, assets: {} });
      } else {
        effect.mount!(surface, { params: config.params, assets: {} });
      }
      effect.resize(w, h);

      this.layers.push({ config, effect, surface, canvas });
    });
  }

  /** Sync every layer's drawing buffer to the host size and notify effects. */
  resize(): void {
    const w = this.root.clientWidth || 1;
    const h = this.root.clientHeight || 1;
    for (const { effect, canvas } of this.layers) {
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }
      effect.resize(w, h);
    }
  }

  renderFrame(t: number): void {
    const p = this.pointer.position();
    for (const { effect } of this.layers) {
      if (effect.onPointer) effect.onPointer(p.x, p.y);
      effect.frame(t);
    }
  }

  clear(): void {
    for (const { effect, surface } of this.layers) {
      effect.dispose();
      surface.remove();
    }
    this.layers = [];
  }

  /** Tear down the compositor entirely (observers + pointer + layers). */
  dispose(): void {
    this.clear();
    this.ro?.disconnect();
    this.pointer.dispose();
  }
}

/**
 * <tilt-stack config-src="..."> renders a full layered stack from a manifest URL.
 * Drives the Compositor with a RAF loop. The effect factory is injected by the
 * built bundle's registry (set via setStackFactory) so this file stays decoupled
 * from the concrete effect set.
 */
let stackFactory: FactoryById | null = null;
export function setStackFactory(f: FactoryById): void {
  stackFactory = f;
}

export class TiltStackElement extends HTMLElement {
  private compositor?: Compositor;
  private raf = 0;

  async connectedCallback() {
    const src = this.getAttribute('config-src');
    if (!src || !stackFactory) return;
    const res = await fetch(src);
    const config = (await res.json()) as { layers: LayerConfig[] };
    this.compositor = new Compositor(this, stackFactory);
    this.compositor.setLayers(config.layers);
    const loop = (t: number) => {
      this.compositor?.renderFrame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    this.compositor?.clear();
  }
}

export function defineStackElement(): void {
  if (!customElements.get('tilt-stack')) {
    customElements.define('tilt-stack', TiltStackElement);
  }
}
