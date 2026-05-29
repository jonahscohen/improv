import type { Effect, EffectOpts } from '../../types';

export function createGradientEffect(): Effect {
  let ctx: CanvasRenderingContext2D | null = null;
  let w = 1;
  let h = 1;
  let speed = 1;
  let colorA = '#5b8cff';
  let colorB = '#b15bff';

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      ctx = canvas.getContext('2d');
      speed = Number(opts.params.speed ?? 1);
      colorA = String(opts.params.colorA ?? colorA);
      colorB = String(opts.params.colorB ?? colorB);
    },
    frame(t: number) {
      if (!ctx?.createLinearGradient) return;
      const phase = (Math.sin((t / 1000) * speed) + 1) / 2;
      const grad = ctx.createLinearGradient(0, 0, w * phase, h);
      grad.addColorStop(0, colorA);
      grad.addColorStop(1, colorB);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
    },
    setParam(key: string, value: unknown) {
      if (key === 'speed') speed = Number(value);
      else if (key === 'colorA') colorA = String(value);
      else if (key === 'colorB') colorB = String(value);
    },
    dispose() {
      ctx = null;
    },
  };
}
