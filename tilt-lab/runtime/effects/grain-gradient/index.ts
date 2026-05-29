import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from @paper-design/shaders (0.0.76), grain-gradient.
// Paper's ShaderMount owns a RAF loop and drives u_time; tilt-lab drives
// frame(t) externally, so u_time is written here from the host clock.
// Needs a precomputed randomizer noise texture (sampler2D u_noiseTexture).
// The host may supply assets.noiseTexture (URL -> assets/noise.png); when
// absent we generate an equivalent deterministic noise texture in JS.

const MAX_COLOR_COUNT = 7;

const SHAPES: Record<string, number> = {
  wave: 1,
  dots: 2,
  truchet: 3,
  corners: 4,
  ripple: 5,
  blob: 6,
  sphere: 7,
};

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

// grain-gradient fragment shader (verbatim from packages/shaders/src/shaders/grain-gradient.ts),
// with declarePI, simplexNoise, rotation2, textureRandomizerR and proceduralHash11
// injected verbatim from shader-utils.ts.
const FRAGMENT_SHADER = `#version 300 es
precision lowp float;

uniform mediump float u_time;
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colorBack;
uniform vec4 u_colors[${MAX_COLOR_COUNT}];
uniform float u_colorsCount;
uniform float u_softness;
uniform float u_intensity;
uniform float u_noise;
uniform float u_shape;

uniform mediump float u_originX;
uniform mediump float u_originY;
uniform mediump float u_worldWidth;
uniform mediump float u_worldHeight;
uniform mediump float u_fit;

uniform mediump float u_scale;
uniform mediump float u_rotation;
uniform mediump float u_offsetX;
uniform mediump float u_offsetY;

in vec2 v_objectUV;
in vec2 v_patternUV;
in vec2 v_objectBoxSize;
in vec2 v_patternBoxSize;

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

float randomR(vec2 p) {
  vec2 uv = floor(p) / 100. + .5;
  return texture(u_noiseTexture, fract(uv)).r;
}

float valueNoiseR(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = randomR(i);
  float b = randomR(i + vec2(1.0, 0.0));
  float c = randomR(i + vec2(0.0, 1.0));
  float d = randomR(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}
vec4 fbmR(vec2 n0, vec2 n1, vec2 n2, vec2 n3) {
  float amplitude = 0.2;
  vec4 total = vec4(0.);
  for (int i = 0; i < 3; i++) {
    n0 = rotate(n0, 0.3);
    n1 = rotate(n1, 0.3);
    n2 = rotate(n2, 0.3);
    n3 = rotate(n3, 0.3);
    total.x += valueNoiseR(n0) * amplitude;
    total.y += valueNoiseR(n1) * amplitude;
    total.z += valueNoiseR(n2) * amplitude;
    total.z += valueNoiseR(n3) * amplitude;
    n0 *= 1.99;
    n1 *= 1.99;
    n2 *= 1.99;
    n3 *= 1.99;
    amplitude *= 0.6;
  }
  return total;
}

float hash11(float p) {
  p = fract(p * 0.3183099) + 0.1;
  p *= p + 19.19;
  return fract(p * p);
}

vec2 truchet(vec2 uv, float idx){
  idx = fract(((idx - .5) * 2.));
  if (idx > 0.75) {
    uv = vec2(1.0) - uv;
  } else if (idx > 0.5) {
    uv = vec2(1.0 - uv.x, uv.y);
  } else if (idx > 0.25) {
    uv = 1.0 - vec2(1.0 - uv.x, uv.y);
  }
  return uv;
}

void main() {

  const float firstFrameOffset = 7.;
  float t = .1 * (u_time + firstFrameOffset);

  vec2 shape_uv = vec2(0.);
  vec2 grain_uv = vec2(0.);

  float r = u_rotation * PI / 180.;
  float cr = cos(r);
  float sr = sin(r);
  mat2 graphicRotation = mat2(cr, sr, -sr, cr);
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  if (u_shape > 3.5) {
    shape_uv = v_objectUV;
    grain_uv = shape_uv;

    grain_uv = transpose(graphicRotation) * grain_uv;
    grain_uv *= u_scale;
    grain_uv -= graphicOffset;
    grain_uv *= v_objectBoxSize;
    grain_uv *= .7;
  } else {
    shape_uv = .5 * v_patternUV;
    grain_uv = 100. * v_patternUV;

    grain_uv = transpose(graphicRotation) * grain_uv;
    grain_uv *= u_scale;
    if (u_fit > 0.) {
      vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
      givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
      float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
      vec2 patternBoxGivenSize = vec2(
      (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
      (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
      );
      patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;
      float patternBoxNoFitBoxWidth = patternBoxRatio * min(patternBoxGivenSize.x / patternBoxRatio, patternBoxGivenSize.y);
      grain_uv /= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
    }
    vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;
    grain_uv -= graphicOffset / patternBoxScale;
    grain_uv *= 1.6;
  }


  float shape = 0.;

  if (u_shape < 1.5) {
    // Sine wave
    float wave = cos(.5 * shape_uv.x - 4. * t) * sin(1.5 * shape_uv.x + 2. * t) * (.75 + .25 * cos(6. * t));
    shape = 1. - smoothstep(-1., 1., shape_uv.y + wave);

  } else if (u_shape < 2.5) {
    // Grid (dots)
    float stripeIdx = floor(2. * shape_uv.x / TWO_PI);
    float rand = hash11(stripeIdx * 100.);
    rand = sign(rand - .5) * pow(4. * abs(rand), .3);
    shape = sin(shape_uv.x) * cos(shape_uv.y - 5. * rand * t);
    shape = pow(abs(shape), 4.);

  } else if (u_shape < 3.5) {
    // Truchet pattern
    float n2 = valueNoiseR(shape_uv * .4 - 3.75 * t);
    shape_uv.x += 10.;
    shape_uv *= .6;

    vec2 tile = truchet(fract(shape_uv), randomR(floor(shape_uv)));

    float distance1 = length(tile);
    float distance2 = length(tile - vec2(1.));

    n2 -= .5;
    n2 *= .1;
    shape = smoothstep(.2, .55, distance1 + n2) * (1. - smoothstep(.45, .8, distance1 - n2));
    shape += smoothstep(.2, .55, distance2 + n2) * (1. - smoothstep(.45, .8, distance2 - n2));

    shape = pow(shape, 1.5);

  } else if (u_shape < 4.5) {
    // Corners
    shape_uv *= .6;
    vec2 outer = vec2(.5);

    vec2 bl = smoothstep(vec2(0.), outer, shape_uv + vec2(.1 + .1 * sin(3. * t), .2 - .1 * sin(5.25 * t)));
    vec2 tr = smoothstep(vec2(0.), outer, 1. - shape_uv);
    shape = 1. - bl.x * bl.y * tr.x * tr.y;

    shape_uv = -shape_uv;
    bl = smoothstep(vec2(0.), outer, shape_uv + vec2(.1 + .1 * sin(3. * t), .2 - .1 * cos(5.25 * t)));
    tr = smoothstep(vec2(0.), outer, 1. - shape_uv);
    shape -= bl.x * bl.y * tr.x * tr.y;

    shape = 1. - smoothstep(0., 1., shape);

  } else if (u_shape < 5.5) {
    // Ripple
    shape_uv *= 2.;
    float dist = length(.4 * shape_uv);
    float waves = sin(pow(dist, 1.2) * 5. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Blob
    t *= 2.;

    vec2 f1_traj = .25 * vec2(1.3 * sin(t), .2 + 1.3 * cos(.6 * t + 4.));
    vec2 f2_traj = .2 * vec2(1.2 * sin(-t), 1.3 * sin(1.6 * t));
    vec2 f3_traj = .25 * vec2(1.7 * cos(-.6 * t), cos(-1.6 * t));
    vec2 f4_traj = .3 * vec2(1.4 * cos(.8 * t), 1.2 * sin(-.6 * t - 3.));

    shape = .5 * pow(1. - clamp(0., 1., length(shape_uv + f1_traj)), 5.);
    shape += .5 * pow(1. - clamp(0., 1., length(shape_uv + f2_traj)), 5.);
    shape += .5 * pow(1. - clamp(0., 1., length(shape_uv + f3_traj)), 5.);
    shape += .5 * pow(1. - clamp(0., 1., length(shape_uv + f4_traj)), 5.);

    shape = smoothstep(.0, .9, shape);
    float edge = smoothstep(.25, .3, shape);
    shape = mix(.0, shape, edge);

  } else {
    // Sphere
    shape_uv *= 2.;
    float d = 1. - pow(length(shape_uv), 2.);
    vec3 pos = vec3(shape_uv, sqrt(max(d, 0.)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }

  float baseNoise = snoise(grain_uv * .5);
  vec4 fbmVals = fbmR(
  .002 * grain_uv + 10.,
  .003 * grain_uv,
  .001 * grain_uv,
  rotate(.4 * grain_uv, 2.)
  );
  float grainDist = baseNoise * snoise(grain_uv * .2) - fbmVals.x - fbmVals.y;
  float rawNoise = .75 * baseNoise - fbmVals.w - fbmVals.z;
  float noise = clamp(rawNoise, 0., 1.);

  shape += u_intensity * 2. / u_colorsCount * (grainDist + .5);
  shape += u_noise * 10. / u_colorsCount * noise;

  float aa = fwidth(shape);

  shape = clamp(shape - .5 / u_colorsCount, 0., 1.);
  float totalShape = smoothstep(0., u_softness + 2. * aa, clamp(shape * u_colorsCount, 0., 1.));
  float mixer = shape * (u_colorsCount - 1.);

  int cntStop = int(u_colorsCount) - 1;
  vec4 gradient = u_colors[0];
  gradient.rgb *= gradient.a;
  for (int i = 1; i < ${MAX_COLOR_COUNT}; i++) {
    if (i > cntStop) break;

    float localT = clamp(mixer - float(i - 1), 0., 1.);
    localT = smoothstep(.5 - .5 * u_softness - aa, .5 + .5 * u_softness + aa, localT);

    vec4 c = u_colors[i];
    c.rgb *= c.a;
    gradient = mix(gradient, c, localT);
  }

  vec3 color = gradient.rgb * totalShape;
  float opacity = gradient.a * totalShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_colorBack.a * (1.0 - opacity);

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

// Deterministic noise so the randomizer texture matches between sessions
// without depending on Math.random.
function generateNoise(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  let s = 1234567;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.floor(rnd() * 256);
    data[i * 4 + 1] = Math.floor(rnd() * 256);
    data[i * 4 + 2] = Math.floor(rnd() * 256);
    data[i * 4 + 3] = 255;
  }
  return data;
}

export function createGrainGradientEffect(): Effect {
  let gl: WebGL2RenderingContext | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let program: WebGLProgram | null = null;
  let vs: WebGLShader | null = null;
  let fs: WebGLShader | null = null;
  let buffer: WebGLBuffer | null = null;
  let noiseTex: WebGLTexture | null = null;
  let dead = false;
  let w = 1;
  let h = 1;
  let dpr = 1;
  const u: Record<string, WebGLUniformLocation | null> = {};

  const p = {
    color1: '#7300ff',
    color2: '#eba8ff',
    color3: '#00bfff',
    color4: '#2a00ff',
    colorBack: '#000000',
    shape: 'corners',
    softness: 0.5,
    intensity: 0.5,
    noise: 0.25,
    speed: 1,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  };

  function readParams(params: Record<string, unknown>) {
    for (const key of Object.keys(p)) {
      if (params[key] == null) continue;
      if (key.startsWith('color') || key === 'shape') {
        (p as Record<string, unknown>)[key] = String(params[key]);
      } else {
        (p as Record<string, unknown>)[key] = Number(params[key]);
      }
    }
  }

  function uploadNoise(data: ArrayBufferView | null, width: number, height: number) {
    if (!gl || !noiseTex) return;
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      data as ArrayBufferView,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
        'u_noiseTexture', 'u_colorBack', 'u_colors', 'u_colorsCount',
        'u_softness', 'u_intensity', 'u_noise', 'u_shape',
      ]) {
        u[name] = gl.getUniformLocation(program, name);
      }

      // Bind the randomizer noise to texture unit 0.
      noiseTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      const N = 128;
      uploadNoise(generateNoise(N), N, N);
      gl.uniform1i(u.u_noiseTexture, 0);

      // Prefer a host-supplied asset when present.
      const url = opts.assets.noiseTexture;
      if (url && typeof Image !== 'undefined') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!gl || !noiseTex) return;
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, noiseTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        };
        img.src = url;
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

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.uniform1i(u.u_noiseTexture, 0);

      gl.uniform1f(u.u_time, (t / 1000) * p.speed);
      gl.uniform2f(u.u_resolution, w * dpr, h * dpr);
      gl.uniform1f(u.u_pixelRatio, dpr);
      gl.uniform1f(u.u_imageAspectRatio, 1);
      // object sizing defaults (fit: contain) - matches the default preset
      gl.uniform1f(u.u_originX, 0.5);
      gl.uniform1f(u.u_originY, 0.5);
      gl.uniform1f(u.u_worldWidth, 0);
      gl.uniform1f(u.u_worldHeight, 0);
      gl.uniform1f(u.u_fit, 1);
      gl.uniform1f(u.u_scale, p.scale);
      gl.uniform1f(u.u_rotation, p.rotation);
      gl.uniform1f(u.u_offsetX, p.offsetX);
      gl.uniform1f(u.u_offsetY, p.offsetY);

      const colors = [p.color1, p.color2, p.color3, p.color4];
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
      gl.uniform1f(u.u_softness, p.softness);
      gl.uniform1f(u.u_intensity, p.intensity);
      gl.uniform1f(u.u_noise, p.noise);
      gl.uniform1f(u.u_shape, SHAPES[p.shape] ?? SHAPES.corners);

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
        if (key.startsWith('color') || key === 'shape') {
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
        if (noiseTex) gl.deleteTexture(noiseTex);
      }
      program = null;
      vs = null;
      fs = null;
      buffer = null;
      noiseTex = null;
      gl = null;
      canvasRef = null;
    },
  };
}
