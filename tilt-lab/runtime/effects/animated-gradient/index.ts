import type { Effect, EffectOpts } from '../../types';
import { ANIMATED_GRADIENT_PRESETS, type PatternShape } from './presets';

/**
 * Animated Gradient (spell) - a WebGL2 swirl/mesh gradient. Verbatim fragment
 * shader and uniform transforms from spell.sh's `@spell/animated-gradient`
 * shadcn-registry component (lane-3 recon). Single full-screen triangle pair;
 * one fragment shader does noise -> distortion -> swirl-iteration -> shape
 * (Checks / Stripes / Edge) -> 3-color blend.
 *
 * Loop adaptation: the spell component owns its own requestAnimationFrame loop
 * driving `elapsed = (now - start)/1000` into u_time. tilt-lab drives frame(t)
 * externally, so u_time is computed straight from the host clock
 * (u_time = (t/1000) * speedScaled + offset * 0.01) and exactly one draw runs
 * per host frame - no internal RAF.
 *
 * License: spell.sh ships no OSS license, so redistribution is personal-only
 * (the shader is a re-expression of paper.design's MIT swirl family; a clean
 * reimplementation off paper would be shippable - see the separately-ported
 * paper "swirl" effect). Shader text here is from spell's published source.
 *
 * Headless-safe: if no WebGL2 context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`;

// Verbatim from spell.sh animated-gradient.tsx FRAGMENT_SHADER.
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}`;

// Inline noise tile (verbatim from spell.sh source) - used only by the optional
// DOM overlay when noiseOpacity > 0; not part of the WebGL pass.
const NOISE_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAAAAAAAAAAAAAAAAAAAAADgKxmiAAAABnRSTlMCCgkGBAVJOAVJAAAASklEQVQ4y2NgGAWjYBSMglEwCgY/YGRgZBQUYmJiZGQEkYwMjIyMgoKCjIyMIJKBgRFIMjIyAklGRkYGRkFBYEcwMDIyMjAOUQAA1I4HwVwZAkYAAAAASUVORK5CYII=';

const PatternShapes: Record<string, number> = { Checks: 0, Stripes: 1, Edge: 2 };

// Presets live in ./presets (single source, shared with the playground store's
// preset-expansion). `applyPreset` reads them for the standalone JSON path.
const PRESETS = ANIMATED_GRADIENT_PRESETS;

function hexToRgba(hex: string): [number, number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 1;
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
      if (c.length === 8) a = parseInt(c.slice(6, 8), 16) / 255;
    }
  }
  return [r, g, b, a];
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createAnimatedGradientEffect(): Effect {
  let gl: WebGL2RenderingContext | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let program: WebGLProgram | null = null;
  let vs: WebGLShader | null = null;
  let fs: WebGLShader | null = null;
  let buffer: WebGLBuffer | null = null;
  let dead = false;
  let w = 1;
  let h = 1;
  let dpr = 1;
  const u: Record<string, WebGLUniformLocation | null> = {};

  const p = {
    preset: 'custom',
    color1: '#050505',
    color2: '#66B3FF',
    color3: '#FFFFFF',
    speed: 25,
    rotation: 0,
    proportion: 35,
    scale: 1,
    distortion: 12,
    swirl: 80,
    swirlIterations: 10,
    softness: 100,
    offset: 0,
    shape: 'Checks' as PatternShape,
    shapeSize: 10,
    noiseOpacity: 0,
    noiseScale: 1,
  };

  // Apply a named preset's full param set wholesale (the preset selector's
  // "apply logic"). 'custom' / unknown names leave the current values alone.
  function applyPreset(name: string) {
    p.preset = name;
    const preset = PRESETS[name];
    if (!preset) return;
    p.color1 = preset.color1;
    p.color2 = preset.color2;
    p.color3 = preset.color3;
    p.rotation = preset.rotation;
    p.proportion = preset.proportion;
    p.scale = preset.scale;
    p.speed = preset.speed;
    p.distortion = preset.distortion;
    p.swirl = preset.swirl;
    p.swirlIterations = preset.swirlIterations;
    p.softness = preset.softness;
    p.offset = preset.offset;
    p.shape = preset.shape;
    p.shapeSize = preset.shapeSize;
  }

  function readParams(params: Record<string, unknown>) {
    // Preset first, so explicit individual params can override it.
    if (params.preset != null) applyPreset(String(params.preset));
    for (const key of Object.keys(p)) {
      if (key === 'preset') continue;
      if (params[key] == null) continue;
      if (key === 'color1' || key === 'color2' || key === 'color3' || key === 'shape') {
        (p as Record<string, unknown>)[key] = String(params[key]);
      } else {
        (p as Record<string, unknown>)[key] = Number(params[key]);
      }
    }
  }

  function syncOverlay() {
    if (!overlay) return;
    if (p.noiseOpacity > 0) {
      overlay.style.display = 'block';
      overlay.style.backgroundImage = `url("${NOISE_TILE}")`;
      overlay.style.backgroundSize = `${(p.noiseScale || 1) * 200}px`;
      overlay.style.backgroundRepeat = 'repeat';
      overlay.style.opacity = String(p.noiseOpacity / 2);
    } else {
      overlay.style.display = 'none';
    }
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      readParams(opts.params);
      canvasRef = canvas;
      gl = canvas.getContext('webgl2', {
        premultipliedAlpha: true,
        alpha: true,
        antialias: true,
      });
      if (!gl) {
        dead = true;
        return;
      }

      vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program || !vs || !fs) {
        dead = true;
        return;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      for (const name of [
        'u_time', 'u_resolution', 'u_pixelRatio', 'u_scale', 'u_rotation',
        'u_color1', 'u_color2', 'u_color3', 'u_proportion', 'u_softness',
        'u_shape', 'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations',
      ]) {
        u[name] = gl.getUniformLocation(program, name);
      }

      // Optional DOM noise overlay (verbatim spell behavior). Only built when a
      // positioned parent exists; guarded for headless (no parent / no document).
      const parent = canvas.parentElement;
      if (parent && typeof document !== 'undefined') {
        overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'none';
        parent.appendChild(overlay);
        syncOverlay();
      }
    },

    frame(t: number) {
      if (dead || !gl || !program) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const tSec = t / 1000;
      const speed = (p.speed / 100) * 5;
      gl.uniform1f(u.u_time, tSec * speed + p.offset * 0.01);
      gl.uniform2f(u.u_resolution, w * dpr, h * dpr);
      gl.uniform1f(u.u_pixelRatio, dpr);
      gl.uniform1f(u.u_scale, p.scale);
      gl.uniform1f(u.u_rotation, (p.rotation * Math.PI) / 180);

      const c1 = hexToRgba(p.color1);
      const c2 = hexToRgba(p.color2);
      const c3 = hexToRgba(p.color3);
      gl.uniform4f(u.u_color1, c1[0], c1[1], c1[2], c1[3]);
      gl.uniform4f(u.u_color2, c2[0], c2[1], c2[2], c2[3]);
      gl.uniform4f(u.u_color3, c3[0], c3[1], c3[2], c3[3]);

      gl.uniform1f(u.u_proportion, p.proportion / 100);
      gl.uniform1f(u.u_softness, p.softness / 100);
      gl.uniform1f(u.u_shape, PatternShapes[p.shape] ?? 0);
      gl.uniform1f(u.u_shapeScale, p.shapeSize / 100);
      gl.uniform1f(u.u_distortion, p.distortion / 50);
      gl.uniform1f(u.u_swirl, p.swirl / 100);
      gl.uniform1f(u.u_swirlIterations, p.swirl === 0 ? 0 : p.swirlIterations);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
      dpr = (typeof globalThis !== 'undefined' && (globalThis as { devicePixelRatio?: number }).devicePixelRatio) || 1;
      if (dead || !gl || !canvasRef) return;
      canvasRef.width = Math.max(1, Math.floor(w * dpr));
      canvasRef.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvasRef.width, canvasRef.height);
    },

    setParam(key: string, value: unknown) {
      if (key === 'preset') {
        applyPreset(String(value));
        return;
      }
      if (key in p) {
        if (key === 'color1' || key === 'color2' || key === 'color3' || key === 'shape') {
          (p as Record<string, unknown>)[key] = String(value);
        } else {
          (p as Record<string, unknown>)[key] = Number(value);
        }
        if (key === 'noiseOpacity' || key === 'noiseScale') syncOverlay();
      }
    },

    dispose() {
      if (gl) {
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (buffer) gl.deleteBuffer(buffer);
      }
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      program = null;
      vs = null;
      fs = null;
      buffer = null;
      gl = null;
      canvasRef = null;
    },
  };
}
