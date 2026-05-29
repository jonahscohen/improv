import { Renderer, Program, Mesh, Triangle, Vec2, Vec3 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

/**
 * Halo - procedural Rayleigh + Mie atmospheric-scattering halo with a rotating
 * camera and a sun direction. Verbatim fragment shader from motion-core's
 * HaloScene (lane-8a recon). OGL, fully procedural (no assets). MIT.
 *
 * Loop adaptation: motion-core's Scene owns a requestAnimationFrame `tick` that
 * accumulates uTime. tilt-lab drives frame(t) externally, so we set uTime from
 * the injected clock and render exactly one pass per host frame - no internal
 * RAF.
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
varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uBackgroundColor;
uniform float uRotationSpeed;
uniform float uCameraDistance;
uniform float uFov;
uniform vec3 uSunDir;
uniform float uIntensity;

const float PI = 3.14159265359;
const float MAX = 10000.0;
const float R_INNER = 1.0;
const float R = 1.5;
const int NUM_OUT_SCATTER = 8;
const int NUM_IN_SCATTER = 40;

vec2 ray_vs_sphere(vec3 p, vec3 dir, float r) {
  float b = dot(p, dir);
  float c = dot(p, p) - r * r;
  float d = b * b - c;
  if (d < 0.0) {
    return vec2(MAX, -MAX);
  }
  d = sqrt(d);
  return vec2(-b - d, -b + d);
}

float phase_mie(float g, float c, float cc) {
  float gg = g * g;
  float a = (1.0 - gg) * (1.0 + cc);
  float b = 1.0 + gg - 2.0 * g * c;
  b *= sqrt(b);
  b *= 2.0 + gg;
  return (3.0 / 8.0 / PI) * a / b;
}

float phase_ray(float cc) {
  return (3.0 / 16.0 / PI) * (1.0 + cc);
}

float density(vec3 p, float ph) {
  return exp(-max(length(p) - R_INNER, 0.0) / ph);
}

float colorLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

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
  vec3 tintTarget = mix(bg, effectHue, 0.85);
  vec3 tint = mix(bg, tintTarget, edge);

  return mix(additive, tint, lightBg);
}

vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}

float optic(vec3 p, vec3 q, float ph) {
  vec3 s = (q - p) / float(NUM_OUT_SCATTER);
  vec3 v = p + s * 0.5;
  float sum = 0.0;
  for (int i = 0; i < NUM_OUT_SCATTER; i++) {
    sum += density(v, ph);
    v += s;
  }
  sum *= length(s);
  return sum;
}

vec3 in_scatter(vec3 o, vec3 dir, vec2 e, vec3 l) {
  const float ph_ray = 0.05;
  const float ph_mie = 0.02;
  const vec3 k_ray = vec3(3.8, 13.5, 33.1);
  const vec3 k_mie = vec3(21.0);
  const float k_mie_ex = 1.1;

  vec3 sum_ray = vec3(0.0);
  vec3 sum_mie = vec3(0.0);
  float n_ray0 = 0.0;
  float n_mie0 = 0.0;
  float len = (e.y - e.x) / float(NUM_IN_SCATTER);
  vec3 s = dir * len;
  vec3 v = o + dir * (e.x + len * 0.5);

  for (int i = 0; i < NUM_IN_SCATTER; i++) {
    float d_ray = density(v, ph_ray) * len;
    float d_mie = density(v, ph_mie) * len;
    n_ray0 += d_ray;
    n_mie0 += d_mie;

    vec2 f = ray_vs_sphere(v, l, R);
    vec3 u = v + l * f.y;
    float n_ray1 = optic(v, u, ph_ray);
    float n_mie1 = optic(v, u, ph_mie);
    vec3 att = exp(-(n_ray0 + n_ray1) * k_ray - (n_mie0 + n_mie1) * k_mie * k_mie_ex);
    sum_ray += d_ray * att;
    sum_mie += d_mie * att;
    v += s;
  }
  float c = dot(dir, -l);
  float cc = c * c;
  vec3 scatter = sum_ray * k_ray * phase_ray(cc) + sum_mie * k_mie * phase_mie(-0.78, c, cc);
  return scatter;
}

mat3 rot3xy(vec2 angle) {
  vec2 c = cos(angle);
  vec2 s = sin(angle);
  return mat3(
    c.y, 0.0, -s.y,
    s.y * s.x, c.x, c.y * s.x,
    s.y * c.x, -s.x, c.y * c.x
  );
}

vec3 ray_dir(float fov, vec2 size, vec2 uv) {
  vec2 xy = uv * size - size * 0.5;
  float cot_half_fov = tan(radians(90.0 - fov * 0.5));
  float z = size.y * 0.5 * cot_half_fov;
  return normalize(vec3(xy, -z));
}

void mainImage(out vec4 fragColor, in vec2 uv) {
  vec3 dir = ray_dir(uFov, uResolution.xy, uv);
  vec3 eye = vec3(0.0, 0.0, uCameraDistance);
  mat3 rot = rot3xy(vec2(0.0, uTime * uRotationSpeed));
  dir = rot * dir;
  eye = rot * eye;
  vec3 l = normalize(uSunDir);
  vec2 e = ray_vs_sphere(eye, dir, R);
  if (e.x > e.y) {
    fragColor = vec4(uBackgroundColor, 1.0);
    return;
  }
  vec2 f = ray_vs_sphere(eye, dir, R_INNER);
  e.y = min(e.y, f.x);
  vec3 I = in_scatter(eye, dir, e, l);
  vec3 halo = I * uIntensity * 10.0;
  float softMask = 1.0 - exp(-1.2 * colorLuma(halo));
  vec3 rgb = blendAdaptive(uBackgroundColor, halo, softMask);
  fragColor = vec4(rgb, 1.0);
}

void main() {
  vec4 fragColor;
  mainImage(fragColor, vUv);
  fragColor.rgb = linearToSrgb(fragColor.rgb);
  gl_FragColor = fragColor;
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

export function createHaloEffect(): Effect {
  let dead = false;
  let renderer: Renderer | null = null;
  let mesh: Mesh | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uniforms: Record<string, { value: any }> | null = null;

  let sunX = 0;
  let sunY = 0;
  let sunZ = 1;

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      const p = opts.params;
      sunX = Number(p.sunX ?? 0);
      sunY = Number(p.sunY ?? 0);
      sunZ = Number(p.sunZ ?? 1);
      const bg = hexToLinearRgb(String(p.backgroundColor ?? '#17181A'));

      renderer = new Renderer({ canvas, dpr: 1, alpha: true });
      const rgl = renderer.gl;
      const w = Math.max(1, canvas.width || 1);
      const h = Math.max(1, canvas.height || 1);

      uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new Vec2(w, h) },
        uBackgroundColor: { value: new Vec3(bg[0], bg[1], bg[2]) },
        uRotationSpeed: { value: Number(p.rotationSpeed ?? 0.5) },
        uCameraDistance: { value: Number(p.cameraDistance ?? 3.0) },
        uFov: { value: Number(p.fov ?? 55.0) },
        uSunDir: { value: new Vec3(sunX, sunY, sunZ) },
        uIntensity: { value: Number(p.intensity ?? 1.0) },
      };

      const geometry = new Triangle(rgl);
      const program = new Program(rgl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
      mesh = new Mesh(rgl, { geometry, program });
    },

    frame(t: number) {
      if (dead || !renderer || !mesh || !uniforms) return;
      uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !uniforms) return;
      const ww = Math.max(1, w);
      const hh = Math.max(1, h);
      renderer.setSize(ww, hh);
      uniforms.uResolution.value.set(ww, hh);
    },

    setParam(key: string, value: unknown) {
      if (dead || !uniforms) return;
      switch (key) {
        case 'rotationSpeed':
          uniforms.uRotationSpeed.value = Number(value);
          break;
        case 'backgroundColor': {
          const c = hexToLinearRgb(String(value));
          uniforms.uBackgroundColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'cameraDistance':
          uniforms.uCameraDistance.value = Number(value);
          break;
        case 'fov':
          uniforms.uFov.value = Number(value);
          break;
        case 'sunX':
          sunX = Number(value);
          uniforms.uSunDir.value.set(sunX, sunY, sunZ);
          break;
        case 'sunY':
          sunY = Number(value);
          uniforms.uSunDir.value.set(sunX, sunY, sunZ);
          break;
        case 'sunZ':
          sunZ = Number(value);
          uniforms.uSunDir.value.set(sunX, sunY, sunZ);
          break;
        case 'intensity':
          uniforms.uIntensity.value = Number(value);
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
      dead = true;
    },
  };
}
