import { Renderer, Transform, Triangle, Program, Mesh, Vec3 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from Motion Core (github.com/motion-core/motion-core), plasma-grid.
// Original Svelte/OGL Scene owns a requestAnimationFrame tick; tilt-lab drives
// frame(t) externally. Value-noise plasma with domain warping masked by a 2px
// checkerboard grid. MIT-licensed; treated personal-only by posture, ok here.

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
uniform vec3 uResolution;
uniform vec3 uBaseColor;
uniform vec3 uGradientColor;

float rand(vec2 p) { return fract(sin(dot(p, vec2(12.543,514.123)))*4732.12); }
float noise(vec2 p) {
  vec2 f = smoothstep(0.0, 1.0, fract(p));
  vec2 i = floor(p);
  float a = rand(i);
  float b = rand(i+vec2(1.0,0.0));
  float c = rand(i+vec2(0.0,1.0));
  float d = rand(i+vec2(1.0,1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  float n = 2.0;
  vec2 uv = fragCoord/uResolution.y;
  vec2 uvp = fragCoord/uResolution.xy;
  uv += 0.75*noise(uv*3.0+uTime/2.0+noise(uv*7.0-uTime/3.0)/2.0)/2.0;
  float grid = (mod(floor((uvp.x)*uResolution.x/n),2.0)==0.0?1.0:0.0) *
               (mod(floor((uvp.y)*uResolution.y/n),2.0)==0.0?1.0:0.0);
  vec3 col = mix(uBaseColor, uGradientColor,
               5.0 * vec3(pow(1.0-noise(uv*4.0-vec2(0.0, uTime/2.0)), 5.0)));
  col = pow(col, vec3(1.0));
  float alpha = grid;
  fragColor = vec4(col, alpha);
}
vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0/2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}
void main() {
  vec4 fragColor;
  vec2 fragCoord = vUv * uResolution.xy;
  mainImage(fragColor, fragCoord);
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

export function createPlasmaGridEffect(): Effect {
  let renderer: Renderer | null = null;
  let scene: Transform | null = null;
  let mesh: Mesh | null = null;
  let program: Program | null = null;
  let dead = false;
  // Original loop accumulates delta * 0.5; exposed as a speed param (default 0.5).
  let speed = 0.5;
  const uniforms: Record<string, { value: unknown }> = {
    uTime: { value: 0 },
    uResolution: { value: new Vec3(1, 1, 1) },
    uBaseColor: { value: new Vec3(...hexToLinear('#17181A')) },
    uGradientColor: { value: new Vec3(...hexToLinear('#FF6900')) },
  };

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const probe = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!probe) {
        dead = true;
        return;
      }
      if (opts.params.speed != null) speed = Number(opts.params.speed);
      if (opts.params.color != null) (uniforms.uBaseColor.value as Vec3).set(...hexToLinear(String(opts.params.color)));
      if (opts.params.highlightColor != null) (uniforms.uGradientColor.value as Vec3).set(...hexToLinear(String(opts.params.highlightColor)));

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
      (uniforms.uResolution.value as Vec3).set(gl.drawingBufferWidth, gl.drawingBufferHeight, 1);
    },
    setParam(key: string, value: unknown) {
      if (key === 'speed') speed = Number(value);
      else if (key === 'color') (uniforms.uBaseColor.value as Vec3).set(...hexToLinear(String(value)));
      else if (key === 'highlightColor') (uniforms.uGradientColor.value as Vec3).set(...hexToLinear(String(value)));
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
