import type { Effect, EffectOpts } from '../../types';
import { PRESETS } from './presets';

// Ported verbatim from @paper-design/shaders (0.0.76), neuro-noise.
// Original algorithm by @zozuar (x.com/zozuar/status/1625182758745128981).
// The library's ShaderMount owns a RAF loop and drives u_time; tilt-lab drives
// frame(t) externally, so the internal loop is dropped and u_time is written here.

// Shared sizing vertex shader (paper-design/shaders src/vertex-shader.ts, verbatim).
const VERTEX_SHADER = `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) {
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) {
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  v_patternUV *= .01;

  vec2 imageBoxSize;
  if (u_fit == 1.) {
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) {
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`;

// neuro-noise fragment shader (verbatim from packages/shaders/src/shaders/neuro-noise.ts),
// with rotation2 and colorBandingFix helpers injected verbatim from shader-utils.ts.
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform vec4 u_colorFront;
uniform vec4 u_colorMid;
uniform vec4 u_colorBack;
uniform float u_brightness;
uniform float u_contrast;

in vec2 v_patternUV;

out vec4 fragColor;

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float neuroShape(vec2 uv, float t) {
  vec2 sine_acc = vec2(0.);
  vec2 res = vec2(0.);
  float scale = 8.;

  for (int j = 0; j < 15; j++) {
    uv = rotate(uv, 1.);
    sine_acc = rotate(sine_acc, 1.);
    vec2 layer = uv * scale + float(j) + sine_acc - t;
    sine_acc += sin(layer);
    res += (.5 + .5 * cos(layer)) / scale;
    scale *= (1.2);
  }
  return res.x + res.y;
}

void main() {
  vec2 shape_uv = v_patternUV;
  shape_uv *= .13;

  float t = .5 * u_time;

  float noise = neuroShape(shape_uv, t);

  noise = (1. + u_brightness) * noise * noise;
  noise = pow(noise, .7 + 6. * u_contrast);
  noise = min(1.4, noise);

  float blend = smoothstep(0.7, 1.4, noise);

  vec4 frontC = u_colorFront;
  frontC.rgb *= frontC.a;
  vec4 midC = u_colorMid;
  midC.rgb *= midC.a;
  vec4 blendFront = mix(midC, frontC, blend);

  float safeNoise = max(noise, 0.0);
  vec3 color = blendFront.rgb * safeNoise;
  float opacity = clamp(blendFront.a * safeNoise, 0., 1.);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  fragColor = vec4(color, opacity);
}`;

// Paper's sizing `fit` enum maps the string to the shader's u_fit float.
const FIT_MAP: Record<string, number> = { none: 0, contain: 1, cover: 2 };

// PRESETS (paper's neuroNoisePresets) live in ./presets - single source of
// truth, shared with the central preset registry.

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

export function createNeuroNoiseEffect(): Effect {
  let gl: WebGL2RenderingContext | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
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
    preset: 'Default',
    colorFront: '#ffffff',
    colorMid: '#47a6ff',
    colorBack: '#000000',
    brightness: 0.05,
    contrast: 0.3,
    speed: 1,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    // Full ShaderSizingParams set (pattern defaults: fit none, centered origin).
    originX: 0.5,
    originY: 0.5,
    worldWidth: 0,
    worldHeight: 0,
    fit: 'none',
  };

  // Apply a named preset's full param set (the preset selector's apply logic).
  function applyPreset(name: string) {
    p.preset = name;
    const preset = PRESETS[name];
    if (!preset) return;
    p.colorFront = preset.colorFront;
    p.colorMid = preset.colorMid;
    p.colorBack = preset.colorBack;
    p.brightness = preset.brightness;
    p.contrast = preset.contrast;
    p.scale = preset.scale;
  }

  function readParams(params: Record<string, unknown>) {
    // Preset first, so explicit individual params can override it.
    if (params.preset != null) applyPreset(String(params.preset));
    if (params.colorFront != null) p.colorFront = String(params.colorFront);
    if (params.colorMid != null) p.colorMid = String(params.colorMid);
    if (params.colorBack != null) p.colorBack = String(params.colorBack);
    if (params.brightness != null) p.brightness = Number(params.brightness);
    if (params.contrast != null) p.contrast = Number(params.contrast);
    if (params.speed != null) p.speed = Number(params.speed);
    if (params.scale != null) p.scale = Number(params.scale);
    if (params.rotation != null) p.rotation = Number(params.rotation);
    if (params.offsetX != null) p.offsetX = Number(params.offsetX);
    if (params.offsetY != null) p.offsetY = Number(params.offsetY);
    if (params.originX != null) p.originX = Number(params.originX);
    if (params.originY != null) p.originY = Number(params.originY);
    if (params.worldWidth != null) p.worldWidth = Number(params.worldWidth);
    if (params.worldHeight != null) p.worldHeight = Number(params.worldHeight);
    if (params.fit != null) p.fit = String(params.fit);
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      readParams(opts.params);
      canvasRef = canvas;
      gl = canvas.getContext('webgl2');
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
      gl.bindAttribLocation(program, 0, 'a_position');
      gl.linkProgram(program);
      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      for (const name of [
        'u_time', 'u_resolution', 'u_pixelRatio', 'u_imageAspectRatio',
        'u_originX', 'u_originY', 'u_worldWidth', 'u_worldHeight', 'u_fit',
        'u_scale', 'u_rotation', 'u_offsetX', 'u_offsetY',
        'u_colorFront', 'u_colorMid', 'u_colorBack', 'u_brightness', 'u_contrast',
      ]) {
        u[name] = gl.getUniformLocation(program, name);
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    },
    frame(t: number) {
      if (dead || !gl || !program) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(u.u_time, (t / 1000) * p.speed);
      gl.uniform2f(u.u_resolution, w * dpr, h * dpr);
      gl.uniform1f(u.u_pixelRatio, dpr);
      gl.uniform1f(u.u_imageAspectRatio, 1);
      gl.uniform1f(u.u_originX, p.originX);
      gl.uniform1f(u.u_originY, p.originY);
      gl.uniform1f(u.u_worldWidth, p.worldWidth);
      gl.uniform1f(u.u_worldHeight, p.worldHeight);
      gl.uniform1f(u.u_fit, FIT_MAP[p.fit] ?? 0);
      gl.uniform1f(u.u_scale, p.scale);
      gl.uniform1f(u.u_rotation, p.rotation);
      gl.uniform1f(u.u_offsetX, p.offsetX);
      gl.uniform1f(u.u_offsetY, p.offsetY);

      const cf = hexToRgba(p.colorFront);
      const cm = hexToRgba(p.colorMid);
      const cb = hexToRgba(p.colorBack);
      gl.uniform4f(u.u_colorFront, cf[0], cf[1], cf[2], cf[3]);
      gl.uniform4f(u.u_colorMid, cm[0], cm[1], cm[2], cm[3]);
      gl.uniform4f(u.u_colorBack, cb[0], cb[1], cb[2], cb[3]);
      gl.uniform1f(u.u_brightness, p.brightness);
      gl.uniform1f(u.u_contrast, p.contrast);

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
        if (key === 'colorFront' || key === 'colorMid' || key === 'colorBack' || key === 'fit') {
          (p as Record<string, unknown>)[key] = String(value);
        } else {
          (p as Record<string, unknown>)[key] = Number(value);
        }
      }
    },
    dispose() {
      if (gl) {
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (buffer) gl.deleteBuffer(buffer);
      }
      program = null;
      vs = null;
      fs = null;
      buffer = null;
      gl = null;
      canvasRef = null;
    },
  };
}
