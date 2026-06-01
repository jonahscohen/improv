import { Renderer, Program, Mesh, Triangle, Texture, Vec2 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

/**
 * Fake 3D Image - depth-map parallax: displaces the color image UV by
 * (depth - 0.5) * mouse / threshold. Verbatim fragment shader from motion-core's
 * Fake3DImageScene (lane-8a recon). OGL. MIT.
 *
 * Pointer-driven (background + pointer): onPointer(x, y) sets a target offset
 * from canvas-relative coords; frame(t) smooths uMouse toward it by
 * `sensitivity`. Not time-driven, but we still render each frame so pointer
 * smoothing and late-loading textures take effect.
 *
 * Falls back to generated color + radial-depth textures when no colorSrc /
 * depthSrc assets are supplied, so the effect renders standalone.
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
precision mediump float;

uniform sampler2D uOriginalTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uMouse;
uniform vec2 uThreshold;
uniform vec2 uResolution;
uniform vec2 uOriginalTextureSize;
uniform vec2 uDepthTextureSize;
varying vec2 vUv;

vec2 mirrored(vec2 value) {
  vec2 m = mod(value, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

vec2 getCoverUV(vec2 uv, vec2 textureSize) {
  vec2 safeTexture = max(textureSize, vec2(1.0));
  vec2 s = uResolution / safeTexture;
  float scale = max(s.x, s.y);
  vec2 scaledSize = safeTexture * scale;
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  vec2 baseUv = mirrored(getCoverUV(vUv, uOriginalTextureSize));
  vec2 depthUv = mirrored(getCoverUV(vUv, uDepthTextureSize));
  float depth = texture2D(uDepthTexture, depthUv).r;

  vec2 safeThreshold = max(uThreshold, vec2(0.00001));
  vec2 fake3d = vec2(
    baseUv.x + (depth - 0.5) * uMouse.x / safeThreshold.x,
    baseUv.y + (depth - 0.5) * uMouse.y / safeThreshold.y
  );

  gl_FragColor = texture2D(uOriginalTexture, mirrored(fake3d));
}`;

function fallbackColorData(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = Math.round((x / (size - 1)) * 255);
      data[i + 1] = Math.round((y / (size - 1)) * 255);
      data[i + 2] = 160;
      data[i + 3] = 255;
    }
  }
  return data;
}

// Radial depth: near (1.0) at center falling to far (0.0) at edges.
function fallbackDepthData(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const maxD = Math.hypot(c, c);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / maxD;
      const v = Math.round((1 - d) * 255);
      const i = (y * size + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

export function createFake3DImageEffect(): Effect {
  let dead = false;
  let renderer: Renderer | null = null;
  let mesh: Mesh | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uniforms: Record<string, { value: any }> | null = null;
  let colorTexture: Texture | null = null;
  let depthTexture: Texture | null = null;

  let viewW = 1;
  let viewH = 1;
  let sensitivity = 0.25;

  // Smoothed pointer offset and its target (range ~[-1, 1] from canvas center).
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  function loadImage(url: string, tex: Texture, sizeUniform: string) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead || !uniforms) return;
      tex.image = img;
      tex.needsUpdate = true;
      uniforms[sizeUniform].value.set(img.width || 1, img.height || 1);
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
      sensitivity = Math.min(1, Math.max(0.001, Number(p.sensitivity ?? 0.25)));

      renderer = new Renderer({ canvas, dpr: 1, alpha: false });
      const rgl = renderer.gl;
      viewW = Math.max(1, canvas.width || 1);
      viewH = Math.max(1, canvas.height || 1);

      // flipY: true so screen-up samples image-up. With flipY:false the texture's
      // first data row lands at v=0 (bottom) while the cover UV / vUv have v
      // increasing upward, which renders the photo and its depth map upside down
      // (the reported bug). Both textures must share the orientation or the
      // parallax displacement pushes against an inverted depth field.
      colorTexture = new Texture(rgl, {
        image: fallbackColorData(256),
        width: 256,
        height: 256,
        generateMipmaps: false,
        flipY: true,
      });
      depthTexture = new Texture(rgl, {
        image: fallbackDepthData(256),
        width: 256,
        height: 256,
        generateMipmaps: false,
        flipY: true,
      });

      uniforms = {
        uOriginalTexture: { value: colorTexture },
        uDepthTexture: { value: depthTexture },
        uMouse: { value: new Vec2(0, 0) },
        uThreshold: { value: new Vec2(Number(p.xThreshold ?? 8), Number(p.yThreshold ?? 8)) },
        uResolution: { value: new Vec2(viewW, viewH) },
        uOriginalTextureSize: { value: new Vec2(256, 256) },
        uDepthTextureSize: { value: new Vec2(256, 256) },
      };

      const geometry = new Triangle(rgl);
      const program = new Program(rgl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
      mesh = new Mesh(rgl, { geometry, program });

      // Prefer user-uploaded images (the colorSrc / depthSrc file params yield
      // object URLs) over the bundled defaults; fall back to generated textures.
      const colorSrc = (typeof p.colorSrc === 'string' && p.colorSrc) || opts.assets.colorSrc;
      const depthSrc = (typeof p.depthSrc === 'string' && p.depthSrc) || opts.assets.depthSrc;
      if (colorSrc && colorTexture) loadImage(colorSrc, colorTexture, 'uOriginalTextureSize');
      if (depthSrc && depthTexture) loadImage(depthSrc, depthTexture, 'uDepthTextureSize');
    },

    frame() {
      if (dead || !renderer || !mesh || !uniforms) return;
      mouseX += (targetX - mouseX) * sensitivity;
      mouseY += (targetY - mouseY) * sensitivity;
      uniforms.uMouse.value.set(mouseX, mouseY);
      renderer.render({ scene: mesh });
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !uniforms) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      renderer.setSize(viewW, viewH);
      uniforms.uResolution.value.set(viewW, viewH);
    },

    setParam(key: string, value: unknown) {
      if (dead || !uniforms) return;
      switch (key) {
        case 'xThreshold':
          uniforms.uThreshold.value.set(Number(value), uniforms.uThreshold.value.y);
          break;
        case 'yThreshold':
          uniforms.uThreshold.value.set(uniforms.uThreshold.value.x, Number(value));
          break;
        case 'sensitivity':
          sensitivity = Math.min(1, Math.max(0.001, Number(value)));
          break;
        case 'colorSrc':
          if (value && colorTexture) loadImage(String(value), colorTexture, 'uOriginalTextureSize');
          break;
        case 'depthSrc':
          if (value && depthTexture) loadImage(String(value), depthTexture, 'uDepthTextureSize');
          break;
        default:
          break;
      }
    },

    onPointer(x: number, y: number) {
      if (dead) return;
      if (isNaN(x) || isNaN(y)) {
        targetX = 0;
        targetY = 0;
        return;
      }
      targetX = (x / viewW - 0.5) * 2;
      targetY = -(y / viewH - 0.5) * 2;
    },

    dispose() {
      if (renderer) {
        const lose = renderer.gl?.getExtension('WEBGL_lose_context');
        lose?.loseContext();
        renderer = null;
      }
      mesh = null;
      uniforms = null;
      colorTexture = null;
      depthTexture = null;
      dead = true;
    },
  };
}
