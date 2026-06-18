import { Renderer, Program, Mesh, Triangle, Texture, Vec2, Vec3 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';
import { rgba01 } from '../../color';

/**
 * Dithered Image - ordered-dithering post effect: pixelate to a grid, sample a
 * Bayer threshold map, step() against luminance, then map to a two-color
 * (fg/bg) output. Verbatim fragment shader from motion-core's DitheredImageScene
 * (lane-8a recon). OGL. MIT.
 *
 * As a tilt-lab `post` layer this dithers the LAYERS BENEATH it (the same role
 * ascii plays): the compositor composites the beneath-scene and hands it to
 * onBeneath() each frame, which we upload to uTexture - so the dither tracks
 * whatever is stacked below. Standalone (<tilt-dithered-image>, no compositor)
 * it falls back to its `src` upload / bundled sample image, or a generated test
 * pattern, so the effect still works on its own.
 *
 * The threshold map (Bayer 4x4 / 8x8) is generated procedurally from the
 * canonical Bayer recurrence - no binary asset shipped.
 *
 * Headless-safe: if no WebGL context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform sampler2D uThresholdMap;
uniform vec2 uResolution;
uniform vec2 uMapSize;
uniform vec2 uCoverScale;
uniform vec2 uCoverOffset;
uniform float uPixelSize;
uniform float uThreshold;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uColorAlpha;
uniform float uBackgroundColorAlpha;

varying vec2 vUv;

float getLuminance(vec3 colorValue) {
  return dot(colorValue, vec3(0.299, 0.587, 0.114));
}

vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}

void main() {
  float pixel = max(1.0, uPixelSize);
  vec2 pixelCoord = floor(gl_FragCoord.xy / pixel);
  vec2 centerPixel = pixelCoord * pixel + (pixel * 0.5);
  vec2 centerUv = centerPixel / uResolution;

  vec2 coverScale = max(uCoverScale, vec2(0.00001));
  vec2 imageUv = coverScale * centerUv + uCoverOffset;
  vec4 texColor = texture2D(uTexture, imageUv);

  vec2 mapUv = mod(pixelCoord, uMapSize) / uMapSize;
  mapUv += (0.5 / uMapSize);
  float thresholdValue = texture2D(uThresholdMap, mapUv).r;

  float lum = getLuminance(texColor.rgb);
  float dither = step(thresholdValue + uThreshold, lum);
  vec3 ditheredColor = mix(uBackgroundColor, uColor, dither);
  // Alpha: off-pixels take the background alpha, on-pixels the foreground alpha.
  // A post layer with a transparent background lets the layers beneath show
  // through. Premultiplied output (canvas premultipliedAlpha defaults true), so
  // a fully transparent background (a=0) yields vec4(0) with no colour fringe.
  float a = mix(uBackgroundColorAlpha, uColorAlpha, dither);
  gl_FragColor = vec4(linearToSrgb(ditheredColor) * a, a);
}`;

function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
// Parses a hex colour to linear RGB + 0..1 alpha, carrying the picker's alpha
// through (the shared parser handles 8-digit #rrggbbaa and `transparent`) so a
// transparent background/foreground reaches the shader instead of being dropped.
function hexToLinearRgba(hex: string): [number, number, number, number] {
  const [r, g, b, a] = rgba01(hex, { r: 0, g: 0, b: 0, a: 1 });
  return [srgbToLinearChannel(r), srgbToLinearChannel(g), srgbToLinearChannel(b), a];
}

// Canonical Bayer ordered-dither matrix via the standard recurrence.
function bayerMatrix(order: number): number[][] {
  function gen(size: number): number[][] {
    if (size <= 1) return [[0]];
    const half = gen(size / 2);
    const h = size / 2;
    const m: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < h; x++) {
        const v = half[y][x];
        m[y][x] = 4 * v;
        m[y][x + h] = 4 * v + 2;
        m[y + h][x] = 4 * v + 3;
        m[y + h][x + h] = 4 * v + 1;
      }
    }
    return m;
  }
  return gen(order);
}

// Pack a rank matrix (values 0..total-1) into RGBA threshold-map bytes
// (normalized (rank+0.5)/total replicated into r,g,b; a=255).
function packRanks(ranks: number[][], order: number): Uint8Array {
  const total = order * order;
  const data = new Uint8Array(total * 4);
  for (let y = 0; y < order; y++) {
    for (let x = 0; x < order; x++) {
      const v = Math.round(((ranks[y][x] + 0.5) / total) * 255);
      const i = (y * order + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

// RGBA byte data for the Bayer threshold map.
function bayerTextureData(order: number): Uint8Array {
  return packRanks(bayerMatrix(order), order);
}

// Clustered-dot "halftone" screen: rank cells by distance from the cell centre
// so the dot grows radially outward as luminance rises (classic AM halftone).
// A tiny angular tie-breaker keeps equidistant cells from forming hard rings.
function halftoneMatrix(order: number): number[][] {
  const c = (order - 1) / 2;
  const cells: { x: number; y: number; key: number }[] = [];
  for (let y = 0; y < order; y++) {
    for (let x = 0; x < order; x++) {
      const dx = x - c;
      const dy = y - c;
      const dist = dx * dx + dy * dy;
      const angle = Math.atan2(dy, dx); // -PI..PI tie-breaker
      cells.push({ x, y, key: dist * 1000 + (angle + Math.PI) });
    }
  }
  cells.sort((a, b) => a.key - b.key);
  const ranks: number[][] = Array.from({ length: order }, () => new Array(order).fill(0));
  cells.forEach((cell, rank) => {
    ranks[cell.y][cell.x] = rank;
  });
  return ranks;
}

function halftoneTextureData(order: number): Uint8Array {
  return packRanks(halftoneMatrix(order), order);
}

// Void-and-cluster (Ulichney 1993) blue-noise dither array. Produces a
// toroidal threshold matrix whose set points are maximally spread (blue noise),
// so dithering with it has no visible structured artifacts. Energy is a wrapped
// Gaussian; we maintain it incrementally and scan for the tightest cluster /
// largest void each step. Deterministic via a seeded LCG (stable across runs).
function voidAndClusterMatrix(order: number): number[][] {
  const N = order;
  const total = N * N;
  const sigma = 1.9;
  const inv2s2 = 1 / (2 * sigma * sigma);

  // Wrapped-distance Gaussian LUT indexed by [dy * N + dx].
  const gauss = new Float64Array(total);
  for (let dy = 0; dy < N; dy++) {
    const wy = Math.min(dy, N - dy);
    for (let dx = 0; dx < N; dx++) {
      const wx = Math.min(dx, N - dx);
      gauss[dy * N + dx] = Math.exp(-(wx * wx + wy * wy) * inv2s2);
    }
  }

  const binary = new Uint8Array(total); // 1 = set
  const energy = new Float64Array(total);

  function toggle(p: number, add: boolean) {
    const py = Math.floor(p / N);
    const px = p - py * N;
    const sign = add ? 1 : -1;
    for (let y = 0; y < N; y++) {
      const dy = ((y - py) % N + N) % N;
      const row = y * N;
      const grow = dy * N;
      for (let x = 0; x < N; x++) {
        const dx = ((x - px) % N + N) % N;
        energy[row + x] += sign * gauss[grow + dx];
      }
    }
    binary[p] = add ? 1 : 0;
  }

  function tightestCluster(): number {
    let best = -1;
    let bestE = -Infinity;
    for (let p = 0; p < total; p++) {
      if (binary[p] === 1 && energy[p] > bestE) {
        bestE = energy[p];
        best = p;
      }
    }
    return best;
  }

  function largestVoid(): number {
    let best = -1;
    let bestE = Infinity;
    for (let p = 0; p < total; p++) {
      if (binary[p] === 0 && energy[p] < bestE) {
        bestE = energy[p];
        best = p;
      }
    }
    return best;
  }

  // Seeded LCG for a deterministic initial sprinkle.
  let seed = 0x9e3779b9 ^ total;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  // Initial pattern: ~1/10 of cells set at random.
  let ones = Math.max(1, Math.round(total / 10));
  const order0: number[] = [];
  for (let p = 0; p < total; p++) order0.push(p);
  for (let i = order0.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order0[i], order0[j]] = [order0[j], order0[i]];
  }
  for (let k = 0; k < ones; k++) toggle(order0[k], true);

  // Relax to a homogeneous "prototype" pattern: move tightest cluster -> largest void.
  for (let iter = 0; iter < total * 4; iter++) {
    const c = tightestCluster();
    toggle(c, false);
    const v = largestVoid();
    if (v === c) {
      toggle(c, true);
      break;
    }
    toggle(v, true);
  }

  const ranks = new Int32Array(total).fill(-1);

  // Phase 1: remove tightest clusters from the prototype, ranks (ones-1)..0.
  // Work on a copy so the prototype is preserved for phases 2/3.
  const proto = binary.slice();
  let rank = ones - 1;
  for (let k = 0; k < ones; k++) {
    const c = tightestCluster();
    ranks[c] = rank--;
    toggle(c, false);
  }

  // Restore the prototype for phase 2.
  for (let p = 0; p < total; p++) {
    if (proto[p] === 1 && binary[p] === 0) toggle(p, true);
    else if (proto[p] === 0 && binary[p] === 1) toggle(p, false);
  }

  // Phase 2: insert into largest voids, ranks ones..(total/2 - 1).
  const half = Math.floor((total + 1) / 2);
  for (rank = ones; rank < half; rank++) {
    const v = largestVoid();
    ranks[v] = rank;
    toggle(v, true);
  }

  // Phase 3: invert the measure - largest void of the complement (tightest
  // cluster of the holes) gets the next rank. ranks (total/2)..(total-1).
  for (rank = half; rank < total; rank++) {
    // Tightest cluster of zeros == the zero with the highest energy.
    let best = -1;
    let bestE = -Infinity;
    for (let p = 0; p < total; p++) {
      if (binary[p] === 0 && energy[p] > bestE) {
        bestE = energy[p];
        best = p;
      }
    }
    if (best < 0) break;
    ranks[best] = rank;
    toggle(best, true);
  }

  // Reshape to 2D.
  const out: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let p = 0; p < total; p++) {
    const py = Math.floor(p / N);
    out[py][p - py * N] = ranks[p] < 0 ? 0 : ranks[p];
  }
  return out;
}

function voidAndClusterTextureData(order: number): Uint8Array {
  return packRanks(voidAndClusterMatrix(order), order);
}

// A generated default source (diagonal luminance ramp + soft color) so the
// effect renders standalone when no `src` asset is supplied.
function fallbackImageData(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * (size - 1));
      const i = (y * size + x) * 4;
      data[i] = Math.round(255 * t);
      data[i + 1] = Math.round(255 * (1 - Math.abs(0.5 - t) * 2));
      data[i + 2] = Math.round(255 * (1 - t));
      data[i + 3] = 255;
    }
  }
  return data;
}

export function createDitheredImageEffect(): Effect {
  let dead = false;
  let renderer: Renderer | null = null;
  let mesh: Mesh | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uniforms: Record<string, { value: any }> | null = null;
  let sourceTexture: Texture | null = null;
  let thresholdTexture: Texture | null = null;

  let viewW = 1;
  let viewH = 1;
  let imgW = 1;
  let imgH = 1;

  function makeThreshold(map: string) {
    if (!renderer || !uniforms) return;
    let order: number;
    let data: Uint8Array;
    switch (map) {
      case 'bayer8x8':
        order = 8;
        data = bayerTextureData(8);
        break;
      case 'halftone':
        order = 8;
        data = halftoneTextureData(8);
        break;
      case 'voidAndCluster':
        order = 32;
        data = voidAndClusterTextureData(32);
        break;
      case 'bayer4x4':
      default:
        order = 4;
        data = bayerTextureData(4);
        break;
    }
    const gl = renderer.gl;
    thresholdTexture = new Texture(gl, {
      image: data,
      width: order,
      height: order,
      generateMipmaps: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      flipY: false,
    });
    uniforms.uThresholdMap.value = thresholdTexture;
    uniforms.uMapSize.value.set(order, order);
  }

  function recomputeCover() {
    if (!uniforms) return;
    const imageAspect = imgW / Math.max(1, imgH);
    const canvasAspect = viewW / Math.max(1, viewH);
    let scaleX: number;
    let scaleY: number;
    if (canvasAspect > imageAspect) {
      scaleX = 1;
      scaleY = imageAspect / canvasAspect;
    } else {
      scaleY = 1;
      scaleX = canvasAspect / imageAspect;
    }
    uniforms.uCoverScale.value.set(scaleX, scaleY);
    uniforms.uCoverOffset.value.set((1 - scaleX) / 2, (1 - scaleY) / 2);
  }

  function loadSource(url: string) {
    if (!renderer || !sourceTexture) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead || !sourceTexture) return;
      sourceTexture.image = img;
      sourceTexture.needsUpdate = true;
      imgW = img.width || 1;
      imgH = img.height || 1;
      recomputeCover();
    };
    img.src = url;
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      const p = opts.params;
      const color = hexToLinearRgba(String(p.color ?? '#ff6900'));
      const bg = hexToLinearRgba(String(p.backgroundColor ?? '#17181A'));

      renderer = new Renderer({ canvas, dpr: 1, alpha: true });
      const rgl = renderer.gl;
      viewW = Math.max(1, canvas.width || 1);
      viewH = Math.max(1, canvas.height || 1);

      // Default source: generated test pattern, replaced if a `src` asset loads.
      const fb = fallbackImageData(256);
      imgW = 256;
      imgH = 256;
      sourceTexture = new Texture(rgl, {
        image: fb,
        width: 256,
        height: 256,
        generateMipmaps: false,
        flipY: false,
      });

      uniforms = {
        uTexture: { value: sourceTexture },
        uThresholdMap: { value: null },
        uResolution: { value: new Vec2(viewW, viewH) },
        uMapSize: { value: new Vec2(4, 4) },
        uCoverScale: { value: new Vec2(1, 1) },
        uCoverOffset: { value: new Vec2(0, 0) },
        uPixelSize: { value: Number(p.pixelSize ?? 1) },
        uThreshold: { value: Number(p.threshold ?? 0) },
        uColor: { value: new Vec3(color[0], color[1], color[2]) },
        uBackgroundColor: { value: new Vec3(bg[0], bg[1], bg[2]) },
        uColorAlpha: { value: color[3] },
        uBackgroundColorAlpha: { value: bg[3] },
      };

      makeThreshold(String(p.ditherMap ?? 'bayer4x4'));
      recomputeCover();

      const geometry = new Triangle(rgl);
      const program = new Program(rgl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
      mesh = new Mesh(rgl, { geometry, program });

      // Prefer a user-uploaded image (the `src` file param yields an object URL)
      // over the bundled default asset; fall back to the generated test pattern.
      const src = (typeof p.src === 'string' && p.src) || opts.assets.src;
      if (src) loadSource(src);
    },

    onBeneath(source: HTMLCanvasElement) {
      // Dither the composited scene beneath this post layer. Upload it as the
      // source texture with flipY so the canvas's top row maps to screen-top
      // (the dither samples via gl_FragCoord, which is bottom-origin in GL).
      if (dead || !sourceTexture) return;
      const sw = source.width || viewW;
      const sh = source.height || viewH;
      if (sw < 1 || sh < 1) return;
      sourceTexture.image = source;
      sourceTexture.flipY = true;
      sourceTexture.needsUpdate = true;
      imgW = sw;
      imgH = sh;
      recomputeCover();
    },

    frame() {
      if (dead || !renderer || !mesh) return;
      renderer.render({ scene: mesh });
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !uniforms) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      renderer.setSize(viewW, viewH);
      uniforms.uResolution.value.set(viewW, viewH);
      recomputeCover();
    },

    setParam(key: string, value: unknown) {
      if (dead || !uniforms) return;
      switch (key) {
        case 'pixelSize':
          uniforms.uPixelSize.value = Number(value);
          break;
        case 'threshold':
          uniforms.uThreshold.value = Number(value);
          break;
        case 'color': {
          const c = hexToLinearRgba(String(value));
          uniforms.uColor.value.set(c[0], c[1], c[2]);
          uniforms.uColorAlpha.value = c[3];
          break;
        }
        case 'backgroundColor': {
          const c = hexToLinearRgba(String(value));
          uniforms.uBackgroundColor.value.set(c[0], c[1], c[2]);
          uniforms.uBackgroundColorAlpha.value = c[3];
          break;
        }
        case 'ditherMap':
          makeThreshold(String(value));
          break;
        case 'src':
          if (value) loadSource(String(value));
          break;
        default:
          break;
      }
    },

    dispose() {
      if (renderer) {
        const lose = renderer.gl?.getExtension('WEBGL_lose_context');
        lose?.loseContext();
        renderer = null;
      }
      mesh = null;
      uniforms = null;
      sourceTexture = null;
      thresholdTexture = null;
      dead = true;
    },
  };
}
