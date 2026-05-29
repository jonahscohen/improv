import type { Effect, EffectOpts } from '../../types';

/**
 * ASCII - Canvas2D post-process that resamples the composited canvas beneath it
 * into a grid of glyphs / tiles / dots chosen by per-cell luminance.
 *
 * REIMPLEMENTED (not verbatim): ascii-magic.com ships proprietary, all-rights-
 * reserved inline source, so this is a clean reimplementation of the standard
 * luminance-ramp ASCII algorithm it uses - Rec.601 luma, min/max auto-normalize,
 * Sobel edge boost, and charIdx = floor((1 - charScore) * pool.length). The
 * character ramps are conventional.
 *
 * As a `post` layer the runtime composites the layers beneath into this effect's
 * canvas before calling frame(); we snapshot that into an offscreen sampler, then
 * clear and redraw the ASCII art. Headless-safe: with no 2D context or no
 * getImageData support the effect goes dead and all methods no-op.
 */

const CHAR_PRESETS: Record<string, string> = {
  standard: '@#S08Xx+=-;:,.',
  detailed: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ',
  minimal: '@#*+=-:. ',
  blocks: '█▓▒░ ',
};

// Per-style character pools (bright -> dark, trailing char is space = skip).
const STYLE_POOLS: Record<string, string> = {
  'block-chars': '█▓▒░ ',
  lines: '┃|│╏┆ ',
  diagonal: '╲╱/⁄ ',
  cross: '╋┼+× ',
  diamond: '⬥◆◇⋄ ',
};

const MIXED_POOLS = [
  STYLE_POOLS['block-chars'], STYLE_POOLS.lines, STYLE_POOLS.diagonal,
  STYLE_POOLS.cross, STYLE_POOLS.diamond,
];

interface AsciiState {
  renderMode: string;
  charSet: string; // preset name
  fontSize: number;
  coverage: number;
  edgeEmphasis: number;
  darkThreshold: number;
  brightness: number;
  contrast: number;
  invert: boolean;
  randomChars: boolean;
  charOpacity: number;
  mosaicShape: string;
  overlayColor: string;
  overlayOpacity: number;
  overlayBlend: string;
}

export function createAsciiEffect(): Effect {
  let dead = false;
  let canvasRef: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let offscreen: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let w = 1;
  let h = 1;

  const s: AsciiState = {
    renderMode: 'characters',
    charSet: 'standard',
    fontSize: 11,
    coverage: 85,
    edgeEmphasis: 60,
    darkThreshold: 30,
    brightness: 0,
    contrast: 100,
    invert: false,
    randomChars: false,
    charOpacity: 100,
    mosaicShape: 'square',
    overlayColor: '#ff0000',
    overlayOpacity: 0,
    overlayBlend: 'multiply',
  };

  function readParams(params: Record<string, unknown>) {
    for (const key of Object.keys(s) as (keyof AsciiState)[]) {
      const v = params[key];
      if (v == null) continue;
      if (key === 'invert' || key === 'randomChars') {
        (s as unknown as Record<string, unknown>)[key] = Boolean(v);
      } else if (
        key === 'renderMode' || key === 'charSet' || key === 'mosaicShape' ||
        key === 'overlayColor' || key === 'overlayBlend'
      ) {
        (s as unknown as Record<string, unknown>)[key] = String(v);
      } else {
        (s as unknown as Record<string, unknown>)[key] = Number(v);
      }
    }
  }

  function lumaAt(d: Uint8ClampedArray, i: number): number {
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  // Sobel edge magnitude map (normalized 0..1) over the sampled buffer.
  function computeEdges(data: Uint8ClampedArray, iw: number, ih: number): Float32Array {
    const gray = new Float32Array(iw * ih);
    for (let i = 0; i < iw * ih; i++) gray[i] = lumaAt(data, i * 4);
    const edges = new Float32Array(iw * ih);
    let maxEdge = 0;
    for (let y = 1; y < ih - 1; y++) {
      for (let x = 1; x < iw - 1; x++) {
        const idx = y * iw + x;
        const gx = -gray[(y - 1) * iw + (x - 1)] + gray[(y - 1) * iw + (x + 1)]
          - 2 * gray[y * iw + (x - 1)] + 2 * gray[y * iw + (x + 1)]
          - gray[(y + 1) * iw + (x - 1)] + gray[(y + 1) * iw + (x + 1)];
        const gy = -gray[(y - 1) * iw + (x - 1)] - 2 * gray[(y - 1) * iw + x] - gray[(y - 1) * iw + (x + 1)]
          + gray[(y + 1) * iw + (x - 1)] + 2 * gray[(y + 1) * iw + x] + gray[(y + 1) * iw + (x + 1)];
        const mag = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = mag;
        if (mag > maxEdge) maxEdge = mag;
      }
    }
    if (maxEdge > 0) for (let i = 0; i < edges.length; i++) edges[i] /= maxEdge;
    return edges;
  }

  function activePoolFor(col: number, row: number): string {
    switch (s.renderMode) {
      case 'block-chars':
      case 'lines':
      case 'diagonal':
      case 'cross':
      case 'diamond':
        return STYLE_POOLS[s.renderMode];
      case 'mixed': {
        const hsh = ((col * 73856093) ^ (row * 19349663)) >>> 0;
        return MIXED_POOLS[hsh % MIXED_POOLS.length];
      }
      default:
        return CHAR_PRESETS[s.charSet] ?? CHAR_PRESETS.standard;
    }
  }

  function brailleChar(d: Uint8ClampedArray, iw: number, ih: number, cx: number, cy: number, cw: number, ch: number, thresh: number): string {
    // 2x4 dot grid -> braille code point U+2800 + bit pattern.
    const bits = [0x1, 0x2, 0x4, 0x40, 0x8, 0x10, 0x20, 0x80]; // dot order (col,row)
    let code = 0;
    let k = 0;
    for (let dc = 0; dc < 2; dc++) {
      for (let dr = 0; dr < 4; dr++) {
        const sx = Math.min(iw - 1, Math.floor(cx + ((dc + 0.5) / 2) * cw));
        const sy = Math.min(ih - 1, Math.floor(cy + ((dr + 0.5) / 4) * ch));
        const l = lumaAt(d, (sy * iw + sx) * 4);
        if (l > thresh) code |= bits[k];
        k++;
      }
    }
    return String.fromCharCode(0x2800 + code);
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      readParams(opts.params);
      canvasRef = canvas;
      ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.getImageData !== 'function' || typeof ctx.fillText !== 'function') {
        dead = true;
        return;
      }
      offscreen = document.createElement('canvas');
      offCtx = offscreen.getContext('2d');
      if (!offCtx) {
        dead = true;
      }
    },
    frame(_t: number) {
      if (dead || !ctx || !canvasRef || !offscreen || !offCtx) return;
      const cw = Math.max(2, Math.floor(s.fontSize * 0.6));
      const ch = Math.max(2, Math.floor(s.fontSize));
      const iw = Math.max(1, Math.floor(w));
      const ih = Math.max(1, Math.floor(h));

      // Snapshot the composited-beneath content (currently on our canvas) into the
      // offscreen sampler, then read its pixels.
      offscreen.width = iw;
      offscreen.height = ih;
      let img: ImageData;
      try {
        offCtx.drawImage(canvasRef, 0, 0, iw, ih);
        img = offCtx.getImageData(0, 0, iw, ih);
      } catch {
        return; // tainted or unsupported (headless) -> skip this frame
      }
      const px = img.data;

      const cols = Math.max(1, Math.floor(iw / cw));
      const rows = Math.max(1, Math.floor(ih / ch));
      const edges = s.edgeEmphasis > 0 ? computeEdges(px, iw, ih) : null;

      // Luminance auto-normalize prepass over a coarse grid.
      let minLum = 255;
      let maxLum = 0;
      const lumStep = Math.max(1, Math.floor(Math.min(rows, cols) / 40));
      for (let r0 = 0; r0 < rows; r0 += lumStep) {
        for (let c0 = 0; c0 < cols; c0 += lumStep) {
          const sx = Math.min(iw - 1, Math.floor((c0 + 0.5) * cw));
          const sy = Math.min(ih - 1, Math.floor((r0 + 0.5) * ch));
          const l = lumaAt(px, (sy * iw + sx) * 4);
          if (l < minLum) minLum = l;
          if (l > maxLum) maxLum = l;
        }
      }
      const lumRange = maxLum - minLum || 1;

      const edgeWeight = s.edgeEmphasis / 100;
      const brightnessAdj = s.brightness / 100;
      const contrastFactor = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast));
      const alpha = Math.max(0, Math.min(1, s.charOpacity / 100));
      const darkCut = (s.darkThreshold / 100) * 255;
      const coverageCut = (100 - s.coverage) / 100; // higher coverage -> lower cut

      ctx.clearRect(0, 0, iw, ih);
      ctx.font = `${s.fontSize}px "Courier New", Courier, monospace`;
      ctx.textBaseline = 'top';

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const sx = Math.min(iw - 1, Math.floor((col + 0.5) * cw));
          const sy = Math.min(ih - 1, Math.floor((row + 0.5) * ch));
          const pi = (sy * iw + sx) * 4;
          const rawR = px[pi];
          const rawG = px[pi + 1];
          const rawB = px[pi + 2];
          const rawLum = 0.299 * rawR + 0.587 * rawG + 0.114 * rawB;

          if (rawLum < darkCut) continue;

          let normLum = Math.max(0, Math.min(1, (rawLum - minLum) / lumRange));
          if (s.invert) normLum = 1 - normLum;

          const r = Math.max(0, Math.min(255, contrastFactor * (rawR - 128) + 128 + brightnessAdj * 255));
          const g = Math.max(0, Math.min(255, contrastFactor * (rawG - 128) + 128 + brightnessAdj * 255));
          const b = Math.max(0, Math.min(255, contrastFactor * (rawB - 128) + 128 + brightnessAdj * 255));

          const edgeVal = edges ? edges[sy * iw + sx] : 0;
          const amplifiedEdge = Math.pow(edgeVal, 0.3);
          const edgeBoost = amplifiedEdge * edgeWeight * 4.0;

          let charScore = normLum + edgeBoost * 0.15;
          charScore = Math.max(0, Math.min(1, charScore));

          if (charScore < coverageCut) continue;

          const fill = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
          const cellX = col * cw;
          const cellY = row * ch;

          if (s.renderMode === 'dots') {
            const radius = (cw * 0.5) * charScore;
            if (radius <= 0.1) continue;
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.arc(cellX + cw / 2, cellY + ch / 2, radius, 0, Math.PI * 2);
            ctx.fill();
          } else if (s.renderMode === 'pixel' || s.renderMode === 'mosaic') {
            ctx.fillStyle = fill;
            if (s.renderMode === 'mosaic' && s.mosaicShape === 'circle') {
              ctx.beginPath();
              ctx.arc(cellX + cw / 2, cellY + ch / 2, Math.min(cw, ch) / 2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillRect(cellX, cellY, cw, ch);
            }
          } else if (s.renderMode === 'braille') {
            const char = brailleChar(px, iw, ih, cellX, cellY, cw, ch, minLum + lumRange * 0.5);
            if (char === '⠀') continue;
            ctx.fillStyle = fill;
            ctx.fillText(char, cellX, cellY);
          } else {
            const pool = activePoolFor(col, row);
            let char: string;
            if (s.randomChars) {
              char = pool[Math.floor(Math.random() * pool.length)];
            } else {
              const idx = Math.min(pool.length - 1, Math.floor((1 - charScore) * pool.length));
              char = pool[idx];
            }
            if (char === ' ') continue;
            ctx.fillStyle = fill;
            ctx.fillText(char, cellX, cellY);
          }
        }
      }

      // Optional overlay tint.
      if (s.overlayOpacity > 0) {
        const prevOp = ctx.globalCompositeOperation;
        const prevAlpha = ctx.globalAlpha;
        ctx.globalCompositeOperation = s.overlayBlend as GlobalCompositeOperation;
        ctx.globalAlpha = Math.max(0, Math.min(1, s.overlayOpacity / 100));
        ctx.fillStyle = s.overlayColor;
        ctx.fillRect(0, 0, iw, ih);
        ctx.globalCompositeOperation = prevOp;
        ctx.globalAlpha = prevAlpha;
      }
    },
    resize(nw: number, nh: number) {
      w = Math.max(1, Math.floor(nw));
      h = Math.max(1, Math.floor(nh));
      if (dead || !canvasRef) return;
      canvasRef.width = w;
      canvasRef.height = h;
    },
    setParam(key: string, value: unknown) {
      if (key in s) {
        const obj: Record<string, unknown> = { [key]: value };
        readParams(obj);
      }
    },
    dispose() {
      ctx = null;
      offCtx = null;
      offscreen = null;
      canvasRef = null;
      dead = true;
    },
  };
}
