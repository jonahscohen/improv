import type { EffectFactory, Manifest, ParamSpec } from './types';
import { PointerTracker } from './pointer';
import { effectAssets } from './effect-assets';

function coerce(spec: ParamSpec, raw: string): unknown {
  switch (spec.type) {
    case 'range':
      return Number(raw);
    case 'toggle':
      return raw === 'true' || raw === '';
    default:
      return raw; // color, select -> string
  }
}

export function defineEffectElement(manifest: Manifest, factory: EffectFactory): void {
  const tag = `tilt-${manifest.id}`;
  if (customElements.get(tag)) return;

  const paramByName = new Map(manifest.params.map((p) => [p.name, p]));

  class TiltEffectElement extends HTMLElement {
    static observedAttributes = manifest.params.map((p) => p.name);

    private effect = factory();
    private canvas!: HTMLCanvasElement;
    private raf = 0;
    private ro?: ResizeObserver;
    private reduced = false;
    private pointer?: PointerTracker;
    private onLeave?: () => void;

    connectedCallback() {
      this.canvas = document.createElement('canvas');
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.style.display = this.style.display || 'block';
      this.appendChild(this.canvas);

      const params: Record<string, unknown> = {};
      for (const p of manifest.params) {
        const attr = this.getAttribute(p.name);
        params[p.name] = attr === null ? p.default : coerce(p, attr);
      }
      // Deliver this effect's real assets (keyed by manifest id); effects with
      // none registered get `{}` and fall back to their procedural content.
      const assets = effectAssets[manifest.id] ?? {};
      this.effect.init(this.canvas, { params, assets });

      // DOM/R3F effects render into this element's subtree instead of the canvas.
      if (this.effect.mount) {
        this.effect.mount(this, { params, assets });
      }
      // Pointer-driven effects get the full pointer surface relative to this
      // element: continuous position+pressed plus discrete press/release/wheel.
      if (
        this.effect.onPointer ||
        this.effect.onPointerDown ||
        this.effect.onPointerUp ||
        this.effect.onWheel
      ) {
        this.pointer = new PointerTracker(this);
      }
      if (this.effect.onPointerLeave) {
        this.onLeave = () => this.effect.onPointerLeave!();
        this.addEventListener('pointerleave', this.onLeave);
      }

      this.ro = new ResizeObserver(() => this.syncSize());
      this.ro.observe(this);
      this.syncSize();

      this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (!this.reduced) this.loop(0);
      else this.effect.frame(0); // render a single static frame
    }

    private syncSize() {
      const w = this.clientWidth || 1;
      const h = this.clientHeight || 1;
      this.canvas.width = w;
      this.canvas.height = h;
      this.effect.resize(w, h);
    }

    private loop = (t: number) => {
      if (this.pointer) {
        // Mirror the Compositor's dispatch order: drain discrete events once,
        // then deliver continuous position + pressed, then scroll.
        const p = this.pointer.position();
        const pressed = this.pointer.isDown();
        const ev = this.pointer.consumeFrame();
        if (this.effect.onPointerDown) for (const d of ev.downs) this.effect.onPointerDown(d.x, d.y);
        if (this.effect.onPointerUp) for (const u of ev.ups) this.effect.onPointerUp(u.x, u.y);
        if (this.effect.onPointer) this.effect.onPointer(p.x, p.y, pressed);
        if (this.effect.onWheel && ev.wheel !== 0) this.effect.onWheel(ev.wheel, p.x, p.y);
      }
      this.effect.frame(t);
      this.raf = requestAnimationFrame(this.loop);
    };

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
      const spec = paramByName.get(name);
      if (!spec) return;
      this.effect.setParam(name, value === null ? spec.default : coerce(spec, value));
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.pointer?.dispose();
      if (this.onLeave) this.removeEventListener('pointerleave', this.onLeave);
      this.ro?.disconnect();
      this.effect.dispose();
    }
  }

  customElements.define(tag, TiltEffectElement);
}
