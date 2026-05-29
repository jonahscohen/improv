import type { Effect, EffectOpts } from '../../types';

// Ported from unlumen UI's AuroraBlur (aurora-card), reconstructed from the public
// demo bundle. Original ran on react-three-fiber; here it runs on a bare WebGL2
// fullscreen quad with u_time driven externally by frame(t). The aurora fragment
// shader is verbatim; only the three.js-injected vertex shader is replaced with a
// minimal raw-quad equivalent (vUv 0..1, y up - matching the R3F plane uv).
// redistribution: personal-only (unlumen is a license-gated commercial library).

// Minimal raw fullscreen-quad vertex shader (GLSL ES 1.00).
const VERTEX_SHADER = `attribute vec2 a_position;
varying vec2 vUv;
void main() {
  vUv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Aurora fragment shader, verbatim from the unlumen demo bundle (module 30019).
const FRAGMENT_SHADER = `precision highp float;
varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform vec3 u_layer1Color;
uniform float u_layer1Speed;
uniform float u_layer1Intensity;
uniform vec3 u_layer2Color;
uniform float u_layer2Speed;
uniform float u_layer2Intensity;
uniform vec3 u_layer3Color;
uniform float u_layer3Speed;
uniform float u_layer3Intensity;
uniform vec3 u_layer4Color;
uniform float u_layer4Speed;
uniform float u_layer4Intensity;
uniform float u_noiseScale;
uniform float u_movementX;
uniform float u_movementY;
uniform float u_verticalFade;
uniform float u_bloomIntensity;
uniform vec3 u_skyColor1;
uniform vec3 u_skyColor2;
uniform float u_skyBlend1;
uniform float u_skyBlend2;
uniform float u_brightness;
uniform float u_saturation;
uniform float u_opacity;

float hashNoise(float n) { return fract(sin(n) * 43758.5453123); }

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hashNoise(i.x + hashNoise(i.y)), hashNoise(i.x + 1.0 + hashNoise(i.y)), u.x),
    mix(hashNoise(i.x + hashNoise(i.y + 1.0)), hashNoise(i.x + 1.0 + hashNoise(i.y + 1.0)), u.x),
    u.y
  );
}

vec3 aurora(vec2 uv, float layerSpeed, float intensity, vec3 color, float aspect) {
  float time = u_time * u_speed * layerSpeed;
  vec2 scaled = vec2(uv.x * aspect, uv.y) * u_noiseScale;
  vec2 point = scaled + time * vec2(u_movementX, u_movementY);
  float n = noise2d(point + noise2d(color.xy + point + time));
  float alpha = n - uv.y * u_verticalFade;
  return color * alpha * intensity * u_bloomIntensity;
}

vec3 saturateColor(vec3 color, float saturation) {
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(gray), color, saturation);
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;

  vec3 color = vec3(0.0);
  color += aurora(uv, u_layer1Speed, u_layer1Intensity, u_layer1Color, aspect);
  color += aurora(uv, u_layer2Speed, u_layer2Intensity, u_layer2Color, aspect);
  color += aurora(uv, u_layer3Speed, u_layer3Intensity, u_layer3Color, aspect);
  color += aurora(uv, u_layer4Speed, u_layer4Intensity, u_layer4Color, aspect);

  color += u_skyColor2 * (1.0 - smoothstep(u_skyBlend1, 1.0, uv.y));
  color += u_skyColor1 * (1.0 - smoothstep(0.0, u_skyBlend2, uv.y));

  color = saturateColor(color, u_saturation) * u_brightness;

  gl_FragColor = vec4(color, u_opacity);
}`;

function hexToRgb(hex: string): [number, number, number] {
  if (typeof hex === 'string' && hex.startsWith('#')) {
    const c = hex.slice(1);
    if (c.length === 3) {
      return [
        parseInt(c[0] + c[0], 16) / 255,
        parseInt(c[1] + c[1], 16) / 255,
        parseInt(c[2] + c[2], 16) / 255,
      ];
    }
    if (c.length >= 6) {
      return [
        parseInt(c.slice(0, 2), 16) / 255,
        parseInt(c.slice(2, 4), 16) / 255,
        parseInt(c.slice(4, 6), 16) / 255,
      ];
    }
  }
  return [1, 1, 1];
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createAuroraEffect(): Effect {
  let gl: WebGLRenderingContext | null = null;
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
    speed: 1.1,
    layer1Color: '#22d3ee',
    layer1Speed: 0.35,
    layer1Intensity: 0.7,
    layer2Color: '#3b82f6',
    layer2Speed: 0.18,
    layer2Intensity: 0.65,
    layer3Color: '#60a5fa',
    layer3Speed: 0.12,
    layer3Intensity: 0.4,
    layer4Color: '#1d4ed8',
    layer4Speed: 0.08,
    layer4Intensity: 0.22,
    noiseScale: 3.2,
    movementX: -1.4,
    movementY: -2.6,
    verticalFade: 0.5,
    bloomIntensity: 1.9,
    skyColor1: '#020617',
    skyColor2: '#0f172a',
    skyBlend1: 0.78,
    skyBlend2: 0.52,
    brightness: 0.92,
    saturation: 1.12,
    opacity: 1,
  };

  const COLOR_KEYS = new Set([
    'layer1Color', 'layer2Color', 'layer3Color', 'layer4Color', 'skyColor1', 'skyColor2',
  ]);

  function readParams(params: Record<string, unknown>) {
    for (const key of Object.keys(p)) {
      const v = params[key];
      if (v == null) continue;
      if (COLOR_KEYS.has(key)) {
        (p as Record<string, unknown>)[key] = String(v);
      } else {
        (p as Record<string, unknown>)[key] = Number(v);
      }
    }
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      readParams(opts.params);
      canvasRef = canvas;
      gl = (canvas.getContext('webgl2') as WebGLRenderingContext | null)
        ?? (canvas.getContext('webgl') as WebGLRenderingContext | null);
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
        'u_time', 'u_resolution', 'u_speed',
        'u_layer1Color', 'u_layer1Speed', 'u_layer1Intensity',
        'u_layer2Color', 'u_layer2Speed', 'u_layer2Intensity',
        'u_layer3Color', 'u_layer3Speed', 'u_layer3Intensity',
        'u_layer4Color', 'u_layer4Speed', 'u_layer4Intensity',
        'u_noiseScale', 'u_movementX', 'u_movementY', 'u_verticalFade', 'u_bloomIntensity',
        'u_skyColor1', 'u_skyColor2', 'u_skyBlend1', 'u_skyBlend2',
        'u_brightness', 'u_saturation', 'u_opacity',
      ]) {
        u[name] = gl.getUniformLocation(program, name);
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    },
    frame(t: number) {
      if (dead || !gl || !program) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(u.u_time, t / 1000);
      gl.uniform2f(u.u_resolution, Math.max(1, w * dpr), Math.max(1, h * dpr));
      gl.uniform1f(u.u_speed, p.speed);

      const l1 = hexToRgb(p.layer1Color);
      const l2 = hexToRgb(p.layer2Color);
      const l3 = hexToRgb(p.layer3Color);
      const l4 = hexToRgb(p.layer4Color);
      gl.uniform3f(u.u_layer1Color, l1[0], l1[1], l1[2]);
      gl.uniform1f(u.u_layer1Speed, p.layer1Speed);
      gl.uniform1f(u.u_layer1Intensity, p.layer1Intensity);
      gl.uniform3f(u.u_layer2Color, l2[0], l2[1], l2[2]);
      gl.uniform1f(u.u_layer2Speed, p.layer2Speed);
      gl.uniform1f(u.u_layer2Intensity, p.layer2Intensity);
      gl.uniform3f(u.u_layer3Color, l3[0], l3[1], l3[2]);
      gl.uniform1f(u.u_layer3Speed, p.layer3Speed);
      gl.uniform1f(u.u_layer3Intensity, p.layer3Intensity);
      gl.uniform3f(u.u_layer4Color, l4[0], l4[1], l4[2]);
      gl.uniform1f(u.u_layer4Speed, p.layer4Speed);
      gl.uniform1f(u.u_layer4Intensity, p.layer4Intensity);

      gl.uniform1f(u.u_noiseScale, p.noiseScale);
      gl.uniform1f(u.u_movementX, p.movementX);
      gl.uniform1f(u.u_movementY, p.movementY);
      gl.uniform1f(u.u_verticalFade, p.verticalFade);
      gl.uniform1f(u.u_bloomIntensity, p.bloomIntensity);

      const s1 = hexToRgb(p.skyColor1);
      const s2 = hexToRgb(p.skyColor2);
      gl.uniform3f(u.u_skyColor1, s1[0], s1[1], s1[2]);
      gl.uniform3f(u.u_skyColor2, s2[0], s2[1], s2[2]);
      gl.uniform1f(u.u_skyBlend1, p.skyBlend1);
      gl.uniform1f(u.u_skyBlend2, p.skyBlend2);

      gl.uniform1f(u.u_brightness, p.brightness);
      gl.uniform1f(u.u_saturation, p.saturation);
      gl.uniform1f(u.u_opacity, p.opacity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
      dpr = Math.min(2, (typeof globalThis !== 'undefined' && (globalThis as { devicePixelRatio?: number }).devicePixelRatio) || 1);
      if (dead || !gl || !canvasRef) return;
      canvasRef.width = Math.max(1, Math.floor(w * dpr));
      canvasRef.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvasRef.width, canvasRef.height);
    },
    setParam(key: string, value: unknown) {
      if (key in p) {
        if (COLOR_KEYS.has(key)) {
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
