import { Renderer, Transform, Triangle, Program, Mesh, Vec2, Vec3 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from Motion Core (github.com/motion-core/motion-core), specular-band.
// Original Svelte/OGL Scene owns a requestAnimationFrame tick; tilt-lab drives
// frame(t) externally. 3-band specular field with hue-shifted palette, lens
// distortion, and adaptive blend. MIT-licensed; ok here.

const VERTEX = `attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uSpeed;
uniform float uDistortion;
uniform float uHueShift;
uniform float uIntensity;

mat3 hueRot(float a) {
  float c = cos(a), s = sin(a), t = 1.0 - c;
  return mat3(
  t*.333+c,      t*.333-s*.577, t*.333+s*.577,
  t*.333+s*.577, t*.333+c,      t*.333-s*.577,
  t*.333-s*.577, t*.333+s*.577, t*.333+c);
}
float colorLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 hueFromColor(vec3 c, vec3 fallback) {
  float m = max(max(c.r, c.g), c.b);
  if (m < 1e-5) return fallback;
  return clamp(c / m, 0.0, 1.0);
}
vec3 blendAdaptive(vec3 bg, vec3 effect, float softness) {
  float bgLum = colorLuma(bg);
  float lightBg = smoothstep(0.45, 0.95, bgLum);
  float edge = clamp(softness, 0.0, 1.0);
  vec3 additive = bg + effect;
  vec3 effectHue = hueFromColor(effect, vec3(1.0));
  vec3 tintTarget = mix(bg, effectHue, 0.9);
  vec3 tint = mix(bg, tintTarget, edge);
  return mix(additive, tint, lightBg);
}
vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0/2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}
void mainImage(out vec4 o, vec2 uv) {
  vec2 u = (uv * 2.0 - 1.0);
  u.x *= uResolution.x / uResolution.y;
  float time = uTime * uSpeed;
  u /= 0.5 + uDistortion * dot(u, u);
  u += 0.2 * cos(time) - 7.56;
  vec3 baseColor = uColor;
  vec3 palette[3];
  palette[0] = baseColor;
  palette[1] = hueRot(radians(uHueShift)) * baseColor;
  palette[2] = hueRot(radians(-uHueShift)) * baseColor;
  vec3 col = vec3(0.0);
  float edgeField = 0.0;
  for(int i = 0; i < 3; i++) {
    vec2 uv_loop = sin(1.5 * u.yx + 2.0 * cos(u -= 0.01));
    float val = 1.0 - exp(-6.0 / exp(6.0 * length(uv_loop + sin(5.0 * uv_loop.y - 3.0 * time) / 4.0)));
    val = pow(clamp(val, 0.0, 1.0), 1.4);
    edgeField += val;
    col += val * palette[i];
  }
  vec3 bands = col * uIntensity;
  float softMask = 1.0 - exp(-0.85 * edgeField * uIntensity);
  vec3 rgb = blendAdaptive(uBackgroundColor, bands, softMask);
  o = vec4(rgb, 1.0);
}
void main() {
  vec4 fragColor;
  mainImage(fragColor, vUv);
  fragColor.rgb = linearToSrgb(fragColor.rgb);
  gl_FragColor = fragColor;
}`;

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function hexToLinear(hex: string): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (typeof hex === 'string' && hex.startsWith('#')) {
    const c = hex.slice(1);
    if (c.length === 3) {
      r = parseInt(c[0] + c[0], 16) / 255;
      g = parseInt(c[1] + c[1], 16) / 255;
      b = parseInt(c[2] + c[2], 16) / 255;
    } else if (c.length >= 6) {
      r = parseInt(c.slice(0, 2), 16) / 255;
      g = parseInt(c.slice(2, 4), 16) / 255;
      b = parseInt(c.slice(4, 6), 16) / 255;
    }
  }
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

export function createSpecularBandEffect(): Effect {
  let renderer: Renderer | null = null;
  let scene: Transform | null = null;
  let mesh: Mesh | null = null;
  let program: Program | null = null;
  let dead = false;
  let speed = 1;
  const uniforms: Record<string, { value: unknown }> = {
    uTime: { value: 0 },
    uResolution: { value: new Vec2(1, 1) },
    uColor: { value: new Vec3(...hexToLinear('#FF6900')) },
    uBackgroundColor: { value: new Vec3(...hexToLinear('#17181A')) },
    uSpeed: { value: 1 },
    uDistortion: { value: 0.2 },
    uHueShift: { value: 30 },
    uIntensity: { value: 1 },
  };

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const probe = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!probe) {
        dead = true;
        return;
      }
      const pr = opts.params;
      if (pr.speed != null) {
        speed = Number(pr.speed);
        uniforms.uSpeed.value = speed;
      }
      if (pr.color != null) (uniforms.uColor.value as Vec3).set(...hexToLinear(String(pr.color)));
      if (pr.backgroundColor != null) (uniforms.uBackgroundColor.value as Vec3).set(...hexToLinear(String(pr.backgroundColor)));
      if (pr.distortion != null) uniforms.uDistortion.value = Number(pr.distortion);
      if (pr.hueShift != null) uniforms.uHueShift.value = Number(pr.hueShift);
      if (pr.intensity != null) uniforms.uIntensity.value = Number(pr.intensity);

      const dpr = Math.min(2, (typeof globalThis !== 'undefined' && (globalThis as { devicePixelRatio?: number }).devicePixelRatio) || 1);
      renderer = new Renderer({ canvas, alpha: true, dpr });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      scene = new Transform();
      const geometry = new Triangle(gl);
      program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms, transparent: true });
      mesh = new Mesh(gl, { geometry, program });
      mesh.setParent(scene);
    },
    frame(t: number) {
      if (dead || !renderer || !scene) return;
      // uTime accumulates; the shader applies uSpeed internally, so feed raw seconds.
      uniforms.uTime.value = t / 1000;
      renderer.render({ scene });
    },
    resize(w: number, h: number) {
      if (dead || !renderer) return;
      renderer.setSize(w, h);
      const gl = renderer.gl;
      (uniforms.uResolution.value as Vec2).set(gl.drawingBufferWidth, gl.drawingBufferHeight);
    },
    setParam(key: string, value: unknown) {
      if (key === 'speed') {
        speed = Number(value);
        uniforms.uSpeed.value = speed;
      } else if (key === 'color') (uniforms.uColor.value as Vec3).set(...hexToLinear(String(value)));
      else if (key === 'backgroundColor') (uniforms.uBackgroundColor.value as Vec3).set(...hexToLinear(String(value)));
      else if (key === 'distortion') uniforms.uDistortion.value = Number(value);
      else if (key === 'hueShift') uniforms.uHueShift.value = Number(value);
      else if (key === 'intensity') uniforms.uIntensity.value = Number(value);
    },
    dispose() {
      if (mesh) mesh.setParent(null);
      mesh = null;
      program = null;
      scene = null;
      renderer = null;
    },
  };
}
