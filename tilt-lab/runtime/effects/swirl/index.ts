import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from @paper-design/shaders (0.0.76), swirl. This is the
// canonical Paper Design swirl shader (the spell.sh "animated-gradient" is a
// re-expression of this family; we port Paper's source, not spell's).
// Paper's ShaderMount owns a RAF loop and drives u_time; tilt-lab drives
// frame(t) externally, so u_time is written here from the host clock.

const MAX_COLOR_COUNT = 10;

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

// swirl fragment shader (verbatim from packages/shaders/src/shaders/swirl.ts),
// with declarePI, simplexNoise, rotation2 and colorBandingFix injected verbatim
// from shader-utils.ts.
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colors[${MAX_COLOR_COUNT}];
uniform float u_colorsCount;
uniform float u_bandCount;
uniform float u_twist;
uniform float u_center;
uniform float u_proportion;
uniform float u_softness;
uniform float u_noise;
uniform float u_noiseFrequency;

in vec2 v_objectUV;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

void main() {
  vec2 shape_uv = v_objectUV;

  float l = length(shape_uv);
  l = max(1e-4, l);

  float t = u_time;

  float angle = ceil(u_bandCount) * atan(shape_uv.y, shape_uv.x) + t;
  float angle_norm = angle / TWO_PI;

  float twist = 3. * clamp(u_twist, 0., 1.);
  float offset = pow(l, -twist) + angle_norm;

  float shape = fract(offset);
  shape = 1. - abs(2. * shape - 1.);
  shape += u_noise * snoise(15. * pow(u_noiseFrequency, 2.) * shape_uv);

  float mid = smoothstep(.2, .2 + .8 * u_center, pow(l, twist));
  shape = mix(0., shape, mid);

  float proportion = clamp(u_proportion, 0., 1.);
  float exponent = mix(.25, 1., proportion * 2.);
  exponent = mix(exponent, 10., max(0., proportion * 2. - 1.));
  shape = pow(shape, exponent);

  float mixer = shape * u_colorsCount;
  vec4 gradient = u_colors[0];
  gradient.rgb *= gradient.a;

  float outerShape = 0.;
  for (int i = 1; i < ${MAX_COLOR_COUNT + 1}; i++) {
    if (i > int(u_colorsCount)) break;

    float m = clamp(mixer - float(i - 1), 0., 1.);
    float aa = fwidth(m);
    m = smoothstep(.5 - .5 * u_softness - aa, .5 + .5 * u_softness + aa, m);

    if (i == 1) {
      outerShape = m;
    }

    vec4 c = u_colors[i - 1];
    c.rgb *= c.a;
    gradient = mix(gradient, c, m);
  }

  float midAA = .1 * fwidth(pow(l, -twist));
  float outerMid = smoothstep(.2, .2 + midAA, pow(l, twist));
  outerShape = mix(0., outerShape, outerMid);

  vec3 color = gradient.rgb * outerShape;
  float opacity = gradient.a * outerShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_colorBack.a * (1.0 - opacity);

  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  fragColor = vec4(color, opacity);
}`;

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

export function createSwirlEffect(): Effect {
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
    color1: '#ffd1d1',
    color2: '#ff8a8a',
    color3: '#660000',
    colorBack: '#330000',
    bandCount: 4,
    twist: 0.1,
    center: 0.2,
    proportion: 0.5,
    softness: 0,
    noise: 0.2,
    noiseFrequency: 0.4,
    speed: 0.32,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  };

  function readParams(params: Record<string, unknown>) {
    for (const key of Object.keys(p)) {
      if (params[key] == null) continue;
      if (key.startsWith('color')) (p as Record<string, unknown>)[key] = String(params[key]);
      else (p as Record<string, unknown>)[key] = Number(params[key]);
    }
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
        'u_colorBack', 'u_colors', 'u_colorsCount', 'u_bandCount', 'u_twist',
        'u_center', 'u_proportion', 'u_softness', 'u_noise', 'u_noiseFrequency',
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
      // object sizing defaults (fit: contain)
      gl.uniform1f(u.u_originX, 0.5);
      gl.uniform1f(u.u_originY, 0.5);
      gl.uniform1f(u.u_worldWidth, 0);
      gl.uniform1f(u.u_worldHeight, 0);
      gl.uniform1f(u.u_fit, 1);
      gl.uniform1f(u.u_scale, p.scale);
      gl.uniform1f(u.u_rotation, p.rotation);
      gl.uniform1f(u.u_offsetX, p.offsetX);
      gl.uniform1f(u.u_offsetY, p.offsetY);

      const colors = [p.color1, p.color2, p.color3];
      const flat = new Float32Array(MAX_COLOR_COUNT * 4);
      for (let i = 0; i < colors.length; i++) {
        const c = hexToRgba(colors[i]);
        flat[i * 4] = c[0];
        flat[i * 4 + 1] = c[1];
        flat[i * 4 + 2] = c[2];
        flat[i * 4 + 3] = c[3];
      }
      gl.uniform4fv(u.u_colors, flat);
      gl.uniform1f(u.u_colorsCount, colors.length);

      const cb = hexToRgba(p.colorBack);
      gl.uniform4f(u.u_colorBack, cb[0], cb[1], cb[2], cb[3]);
      gl.uniform1f(u.u_bandCount, p.bandCount);
      gl.uniform1f(u.u_twist, p.twist);
      gl.uniform1f(u.u_center, p.center);
      gl.uniform1f(u.u_proportion, p.proportion);
      gl.uniform1f(u.u_softness, p.softness);
      gl.uniform1f(u.u_noise, p.noise);
      gl.uniform1f(u.u_noiseFrequency, p.noiseFrequency);

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
      if (key in p) {
        if (key.startsWith('color')) (p as Record<string, unknown>)[key] = String(value);
        else (p as Record<string, unknown>)[key] = Number(value);
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
