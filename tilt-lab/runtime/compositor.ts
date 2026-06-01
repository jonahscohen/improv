import type { Effect, LayerConfig } from './types';
import { orderLayers } from './stack';
import { PointerTracker } from './pointer';
import { effectAssets } from './effect-assets';

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
  // Shared scratch surface for delivering the beneath-composite to WebGL `post`
  // effects (which cannot receive the Canvas2D blit). Lazily created, reused
  // across post layers and frames - effects must sample it synchronously.
  private beneathCanvas: HTMLCanvasElement | null = null;
  private beneathCtx: CanvasRenderingContext2D | null = null;

  constructor(private root: HTMLElement, private factory: FactoryById) {
    // Layers are absolutely positioned, so the host must be a positioning
    // context. Only force `relative` when the host is otherwise `static` -
    // never clobber an existing absolute/relative/fixed (e.g. a preview host
    // that uses `position:absolute; inset:0` to fill its parent), or it
    // collapses to zero height and effects render into a 1px-tall canvas.
    const pos =
      typeof getComputedStyle === 'function' ? getComputedStyle(this.root).position : '';
    if (pos === '' || pos === 'static') {
      this.root.style.position = 'relative';
    }
    this.pointer = new PointerTracker(this.root);
    this.root.addEventListener('pointerleave', this.onLeave);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);
    }
  }

  private onLeave = () => {
    for (const { effect } of this.layers) {
      effect.onPointerLeave?.();
    }
  };

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
      // Per-layer composition: opacity dims the surface; a disabled layer is
      // hidden so it contributes nothing. `enabled`/`opacity` are optional on
      // LayerConfig, so undefined means the historical default (on, full).
      surface.style.opacity = String(config.opacity ?? 1);
      if (config.enabled === false) {
        surface.style.display = 'none';
      }
      this.root.appendChild(surface);

      // Deliver the effect's real assets (URLs resolved at build/dev time).
      // Effects without registered assets get `{}` and fall back as before.
      const assets = effectAssets[config.effectId] ?? {};

      // Size the drawing buffer BEFORE init so WebGL/OGL effects configure their
      // viewport and uniforms against the real size, not a detached 0x0 canvas.
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
        effect.init(canvas, { params: config.params, assets });
      } else {
        effect.mount!(surface, { params: config.params, assets });
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
    const pressed = this.pointer.isDown();
    // Drain this frame's discrete events ONCE, then dispatch the snapshot to
    // every layer (so each interactive effect sees the same clicks/scroll).
    const ev = this.pointer.consumeFrame();
    this.layers.forEach((layer, i) => {
      const { effect, config, canvas } = layer;
      // A disabled layer contributes nothing: skip its frame entirely (its
      // surface is already hidden). undefined enabled means on (legacy default).
      if (config.enabled === false) return;
      // A post effect transforms "the scene beneath it": composite the lower
      // layers' canvases so the effect samples real content (e.g. an uploaded
      // Image/Video background, or a generative layer below it).
      if (config.layerRole === 'post' && canvas) {
        if (effect.onBeneath) {
          // WebGL post path: the effect's own surface is a GL context, so the
          // Canvas2D blit cannot reach it. Composite the beneath-layers into a
          // compositor-owned 2D scratch canvas and hand it over as a texture
          // source. Sampled synchronously inside frame() below.
          const beneath = this.composeBeneath(i, canvas.width, canvas.height);
          if (beneath) effect.onBeneath(beneath);
        } else {
          const c2d = canvas.getContext('2d');
          if (c2d) {
            c2d.clearRect(0, 0, canvas.width, canvas.height);
            for (let j = 0; j < i; j++) {
              const belowLayer = this.layers[j];
              if (belowLayer.config.enabled === false) continue;
              const below = belowLayer.canvas;
              if (below) {
                // Honor the lower layer's opacity when sampling it into the post
                // canvas - the post path composites in 2D, so CSS opacity on the
                // hidden source canvas does not apply here.
                c2d.globalAlpha = belowLayer.config.opacity ?? 1;
                c2d.drawImage(below, 0, 0, canvas.width, canvas.height);
              }
            }
            c2d.globalAlpha = 1;
          }
        }
      }
      // Discrete press/release (clicks, touch starts) then continuous
      // position+pressed, then scroll - the full interaction surface.
      if (effect.onPointerDown) for (const d of ev.downs) effect.onPointerDown(d.x, d.y);
      if (effect.onPointerUp) for (const u of ev.ups) effect.onPointerUp(u.x, u.y);
      if (effect.onPointer) effect.onPointer(p.x, p.y, pressed);
      if (effect.onWheel && ev.wheel !== 0) effect.onWheel(ev.wheel, p.x, p.y);
      effect.frame(t);
    });
  }

  /**
   * Composite every enabled layer below index `upTo` into the shared 2D scratch
   * canvas (sized w x h) and return it, or null if no 2D context is available
   * (headless). Honors each beneath layer's opacity, mirroring the Canvas2D post
   * path. The returned canvas is reused on the next call - sample it immediately.
   */
  private composeBeneath(upTo: number, w: number, h: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.beneathCanvas) {
      this.beneathCanvas = document.createElement('canvas');
      this.beneathCtx = this.beneathCanvas.getContext('2d');
    }
    const c2d = this.beneathCtx;
    if (!this.beneathCanvas || !c2d) return null;
    if (this.beneathCanvas.width !== w) this.beneathCanvas.width = w;
    if (this.beneathCanvas.height !== h) this.beneathCanvas.height = h;
    c2d.clearRect(0, 0, w, h);
    for (let j = 0; j < upTo; j++) {
      const belowLayer = this.layers[j];
      if (belowLayer.config.enabled === false) continue;
      const below = belowLayer.canvas;
      if (below) {
        c2d.globalAlpha = belowLayer.config.opacity ?? 1;
        try {
          c2d.drawImage(below, 0, 0, w, h);
        } catch {
          // A tainted/zero-size source canvas can throw; skip it.
        }
      }
    }
    c2d.globalAlpha = 1;
    return this.beneathCanvas;
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
    this.root.removeEventListener('pointerleave', this.onLeave);
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
