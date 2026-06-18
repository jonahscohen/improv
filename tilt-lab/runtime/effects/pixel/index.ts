import type { Effect, EffectOpts } from '../../types';

// Ported from React Bits "Pixel Card" (https://github.com/DavidHDev/react-bits,
// MIT, by David Haz). The unlumen UI "Pixel Background" that prompted this is a
// paid, license-gated recreation of this same MIT original (the unlumen page
// itself credits React Bits), so we port the free original rather than the paid
// source. Adapted to tilt-lab's frame(t) contract and made ALWAYS-ON: pixels
// ripple in from the chosen pattern origin and then shimmer forever - no hover
// gate, no disappear. The original owned its own RAF loop and only animated on
// mouseenter; tilt-lab drives frame(t), so the loop is dropped and every frame
// advances the reveal + shimmer. The Pixel growth/shimmer math is verbatim.

const DEFAULT_COLORS = '#f8fafc,#f1f5f9,#cbd5e1';

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// React Bits maps a 0..100 speed onto the per-frame shimmer step. 0 (or
// reduced-motion) freezes the field; 100 is the fastest shimmer.
function effectiveSpeed(value: number, reduced: boolean): number {
  const throttle = 0.001;
  if (value <= 0 || reduced) return 0;
  if (value >= 100) return 100 * throttle;
  return value * throttle;
}

// Per-pixel reveal delay. React Bits only did "center" (distance from center);
// the extra patterns mirror the unlumen variant's headline feature - they just
// change which pixels light up first. reduced-motion -> 0 (everything appears at
// once, then sits static because the shimmer speed is also 0).
function patternDelay(pattern: string, x: number, y: number, w: number, h: number, reduced: boolean): number {
  if (reduced) return 0;
  const cx = w / 2;
  const cy = h / 2;
  switch (pattern) {
    case 'top': return y;
    case 'bottom': return h - y;
    case 'left': return x;
    case 'right': return w - x;
    case 'diagonal': return (x + y) * 0.6;
    case 'ascend': return ((w - x) + (h - y)) * 0.6;
    case 'random': return Math.random() * Math.hypot(w, h) * 0.5;
    case 'spiral': {
      const angle = (Math.atan2(y - cy, x - cx) + Math.PI) / (Math.PI * 2); // 0..1
      return Math.hypot(x - cx, y - cy) * 0.5 + angle * (w + h) * 0.35;
    }
    case 'center':
    default: return Math.hypot(x - cx, y - cy);
  }
}

class Pixel {
  private ctx: CanvasRenderingContext2D;
  private x: number;
  private y: number;
  private color: string;
  private speed: number;
  private size = 0;
  private readonly sizeStep: number;
  private readonly minSize = 0.5;
  private readonly maxSizeInteger = 2;
  private readonly maxSize: number;
  private readonly delay: number;
  private counter = 0;
  private readonly counterStep: number;
  private isShimmer = false;
  private isReverse = false;

  constructor(ctx: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, color: string, speed: number, delay: number) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = rand(0.1, 0.9) * speed;
    this.sizeStep = Math.random() * 0.4;
    this.maxSize = rand(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (w + h) * 0.01;
  }

  private draw(): void {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  // Grow in (after this pixel's delay), then shimmer forever. Always-on: there
  // is no disappear() - the field never reverses out.
  appear(): void {
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) this.isShimmer = true;
    if (this.isShimmer) this.shimmer();
    else this.size += this.sizeStep;
    this.draw();
  }

  private shimmer(): void {
    if (this.size >= this.maxSize) this.isReverse = true;
    else if (this.size <= this.minSize) this.isReverse = false;
    if (this.isReverse) this.size -= this.speed;
    else this.size += this.speed;
  }
}

export function createPixelEffect(): Effect {
  let ctx: CanvasRenderingContext2D | null = null;
  let w = 1;
  let h = 1;
  let gap = 8;
  let speed = 40;
  let pattern = 'center';
  let colors = DEFAULT_COLORS;
  let backgroundColor = '#17181A';
  let pixels: Pixel[] = [];

  const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  function build(): void {
    pixels = [];
    if (!ctx || w < 1 || h < 1) return;
    const parsed = colors.split(',').map((c) => c.trim()).filter(Boolean);
    const palette = parsed.length > 0 ? parsed : DEFAULT_COLORS.split(',');
    const g = Math.max(1, Math.floor(gap));
    const sp = effectiveSpeed(speed, reduced);
    for (let x = 0; x < w; x += g) {
      for (let y = 0; y < h; y += g) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        const delay = patternDelay(pattern, x, y, w, h, reduced);
        pixels.push(new Pixel(ctx, w, h, x, y, color, sp, delay));
      }
    }
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      ctx = canvas.getContext('2d');
      gap = Number(opts.params.gap ?? gap);
      speed = Number(opts.params.speed ?? speed);
      pattern = String(opts.params.pattern ?? pattern);
      colors = String(opts.params.colors ?? colors);
      backgroundColor = String(opts.params.backgroundColor ?? backgroundColor);
      // Grid is (re)built on resize, once real dimensions arrive.
    },
    frame(_t: number) {
      if (!ctx) return;
      // Always clear first so the canvas starts transparent every frame. This is
      // what lets the user drop the background alpha to 0 (ColorField emits
      // #RRGGBBAA) and still see the dots animate over whatever is behind - and
      // it kills the old smear where a non-cleared canvas never wiped prior dots.
      // The background is then an OPTIONAL fill on the cleared canvas; a fully
      // transparent backgroundColor paints nothing, leaving dots-on-transparent.
      ctx.clearRect(0, 0, w, h);
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < pixels.length; i++) pixels[i].appear();
    },
    resize(nw: number, nh: number) {
      w = Math.max(1, Math.floor(nw));
      h = Math.max(1, Math.floor(nh));
      build();
    },
    setParam(key: string, value: unknown) {
      if (key === 'gap') gap = Number(value);
      else if (key === 'speed') speed = Number(value);
      else if (key === 'pattern') pattern = String(value);
      else if (key === 'colors') colors = String(value);
      else if (key === 'backgroundColor') { backgroundColor = String(value); return; }
      else return;
      build();
    },
    dispose() {
      ctx = null;
      pixels = [];
    },
  };
}
