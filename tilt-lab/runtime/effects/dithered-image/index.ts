import { Renderer, Program, Mesh, Triangle, Texture, Vec2, Vec3 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

/**
 * Dithered Image - ordered-dithering post effect: pixelate to a grid, sample a
 * Bayer threshold map, step() against luminance, then map to a two-color
 * (fg/bg) output. Verbatim fragment shader from motion-core's DitheredImageScene
 * (lane-8a recon). OGL. MIT.
 *
 * post caveat (from recon): this dithers a SOURCE IMAGE bound to uTexture, not
 * the live framebuffer beneath it. As a tilt-lab `post` layer a host would swap
 * uTexture for the composited render target; here it dithers its `src` asset (or
 * a generated test pattern when no asset is supplied).
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

  gl_FragColor = vec4(linearToSrgb(ditheredColor), 1.0);
}`;

function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexToLinearRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [
    srgbToLinearChannel(((n >> 16) & 255) / 255),
    srgbToLinearChannel(((n >> 8) & 255) / 255),
    srgbToLinearChannel((n & 255) / 255),
  ];
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

// RGBA byte data for the threshold map (value replicated into r,g,b; a=255).
function bayerTextureData(order: number): Uint8Array {
  const m = bayerMatrix(order);
  const total = order * order;
  const data = new Uint8Array(order * order * 4);
  for (let y = 0; y < order; y++) {
    for (let x = 0; x < order; x++) {
      const v = Math.round(((m[y][x] + 0.5) / total) * 255);
      const i = (y * order + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
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
    const order = map === 'bayer8x8' ? 8 : 4;
    const data = bayerTextureData(order);
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
      const color = hexToLinearRgb(String(p.color ?? '#ff6900'));
      const bg = hexToLinearRgb(String(p.backgroundColor ?? '#17181A'));

      renderer = new Renderer({ canvas, dpr: 1, alpha: false });
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
      };

      makeThreshold(String(p.ditherMap ?? 'bayer4x4'));
      recomputeCover();

      const geometry = new Triangle(rgl);
      const program = new Program(rgl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
      mesh = new Mesh(rgl, { geometry, program });

      const src = opts.assets.src;
      if (src) loadSource(src);
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
          const c = hexToLinearRgb(String(value));
          uniforms.uColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'backgroundColor': {
          const c = hexToLinearRgb(String(value));
          uniforms.uBackgroundColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'ditherMap':
          makeThreshold(String(value));
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
