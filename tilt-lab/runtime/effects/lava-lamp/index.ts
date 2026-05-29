import { Renderer, Transform, Triangle, Program, Mesh, Vec3, Vec4 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from Motion Core (github.com/motion-core/motion-core), lava-lamp.
// Original Svelte/OGL Scene owns a requestAnimationFrame tick; tilt-lab drives
// frame(t) externally, so the internal RAF is dropped and uTime is written here.
// Raymarched metaball SDF with fresnel rim. MIT-licensed; treated personal-only.

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
uniform vec4 uResolution;
uniform vec3 uColor;
uniform vec3 uFresnelColor;
uniform float uFresnelPower;
uniform float uRadius;
uniform float uSmoothness;

float PI = 3.141592653589793238;

mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle); float c = cos(angle); float oc = 1.0 - c;
  return mat4(oc*axis.x*axis.x+c,        oc*axis.x*axis.y-axis.z*s, oc*axis.z*axis.x+axis.y*s, 0.0,
              oc*axis.x*axis.y+axis.z*s, oc*axis.y*axis.y+c,        oc*axis.y*axis.z-axis.x*s, 0.0,
              oc*axis.z*axis.x-axis.y*s, oc*axis.y*axis.z+axis.x*s, oc*axis.z*axis.z+c,        0.0,
              0.0, 0.0, 0.0, 1.0);
}
vec3 rotate(vec3 v, vec3 axis, float angle) {
  mat4 m = rotationMatrix(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}
float smin(float a, float b, float k) {
  k *= 6.0; float h = max(k-abs(a-b), 0.0)/k;
  return min(a,b) - h*h*h*k*(1.0/6.0);
}
float sphereSDF(vec3 p, float r) { return length(p) - r; }
float sdf(vec3 p) {
  vec3 p1 = rotate(p, vec3(0.0, 0.0, 1.0), uTime/5.0);
  vec3 p2 = rotate(p, vec3(1.), -uTime/5.0);
  vec3 p3 = rotate(p, vec3(1., 1., 0.), -uTime/4.5);
  vec3 p4 = rotate(p, vec3(0., 1., 0.), -uTime/4.0);
  float r = uRadius;
  float final = sphereSDF(p1 - vec3(-0.5, 0.0, 0.0), 0.35 * r);
  float nextSphere = sphereSDF(p2 - vec3(0.55, 0.0, 0.0), 0.3 * r);
  final = smin(final, nextSphere, uSmoothness);
  nextSphere = sphereSDF(p2 - vec3(-0.8, 0.0, 0.0), 0.2 * r);
  final = smin(final, nextSphere, uSmoothness);
  nextSphere = sphereSDF(p3 - vec3(1.0, 0.0, 0.0), 0.15 * r);
  final = smin(final, nextSphere, uSmoothness);
  nextSphere = sphereSDF(p4 - vec3(0.45, -0.45, 0.0), 0.15 * r);
  final = smin(final, nextSphere, uSmoothness);
  return final;
}
vec3 getNormal(vec3 p) {
  float d = 0.001;
  return normalize(vec3(
    sdf(p + vec3(d,0,0)) - sdf(p - vec3(d,0,0)),
    sdf(p + vec3(0,d,0)) - sdf(p - vec3(0,d,0)),
    sdf(p + vec3(0,0,d)) - sdf(p - vec3(0,0,d))));
}
float rayMarch(vec3 rayOrigin, vec3 ray) {
  float t = 0.0;
  for (int i = 0; i < 100; i++) {
    vec3 p = rayOrigin + ray * t;
    float d = sdf(p);
    if (d < 0.001) return t;
    t += d;
    if (t > 100.0) break;
  }
  return -1.0;
}
vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0/2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}
void main() {
  vec3 cameraPos = vec3(0.0, 0.0, 5.0);
  vec3 ray = normalize(vec3((vUv - vec2(0.5)) * uResolution.zw, -1));
  float t = rayMarch(cameraPos, ray);
  if (t > 0.0) {
    vec3 p = cameraPos + ray * t;
    vec3 normal = getNormal(p);
    float fresnel = pow(1.0 + dot(ray, normal), uFresnelPower);
    vec3 color = mix(uColor, uFresnelColor, fresnel);
    gl_FragColor = vec4(linearToSrgb(color), 1.0);
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
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

export function createLavaLampEffect(): Effect {
  let renderer: Renderer | null = null;
  let scene: Transform | null = null;
  let mesh: Mesh | null = null;
  let program: Program | null = null;
  let dead = false;
  let speed = 1;
  const uniforms: Record<string, { value: unknown }> = {
    uTime: { value: 0 },
    uResolution: { value: new Vec4(1, 1, 1, 1) },
    uColor: { value: new Vec3(...hexToLinear('#17181A')) },
    uFresnelColor: { value: new Vec3(...hexToLinear('#ff6900')) },
    uFresnelPower: { value: 3 },
    uRadius: { value: 1 },
    uSmoothness: { value: 0.1 },
  };

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const probe = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!probe) {
        dead = true;
        return;
      }
      speed = Number(opts.params.speed ?? 1);
      if (opts.params.color != null) (uniforms.uColor.value as Vec3).set(...hexToLinear(String(opts.params.color)));
      if (opts.params.fresnelColor != null) (uniforms.uFresnelColor.value as Vec3).set(...hexToLinear(String(opts.params.fresnelColor)));
      if (opts.params.fresnelPower != null) uniforms.uFresnelPower.value = Number(opts.params.fresnelPower);
      if (opts.params.radius != null) uniforms.uRadius.value = Number(opts.params.radius);
      if (opts.params.smoothness != null) uniforms.uSmoothness.value = Number(opts.params.smoothness);

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
      uniforms.uTime.value = (t / 1000) * speed;
      renderer.render({ scene });
    },
    resize(w: number, h: number) {
      if (dead || !renderer) return;
      renderer.setSize(w, h);
      const gl = renderer.gl;
      const bw = gl.drawingBufferWidth;
      const bh = gl.drawingBufferHeight;
      const a1 = bh / bw > 1 ? bw / bh : 1;
      const a2 = bh / bw > 1 ? 1 : bh / bw;
      (uniforms.uResolution.value as Vec4).set(bw, bh, a1, a2);
    },
    setParam(key: string, value: unknown) {
      if (key === 'speed') speed = Number(value);
      else if (key === 'color') (uniforms.uColor.value as Vec3).set(...hexToLinear(String(value)));
      else if (key === 'fresnelColor') (uniforms.uFresnelColor.value as Vec3).set(...hexToLinear(String(value)));
      else if (key === 'fresnelPower') uniforms.uFresnelPower.value = Number(value);
      else if (key === 'radius') uniforms.uRadius.value = Number(value);
      else if (key === 'smoothness') uniforms.uSmoothness.value = Number(value);
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
