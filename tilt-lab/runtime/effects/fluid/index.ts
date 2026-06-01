import type { Effect, EffectOpts } from '../../types';
import { FLUID_PRESETS, FLUID_SCENE_NAMES } from './presets';

/**
 * Fluid - raw WebGL1 stable-fluid sim (advect / mouse-force / divergence /
 * Jacobi pressure / gradient-subtract / mouse-dye) plus a GPU particle system
 * advected through the velocity field. Verbatim shaders ported from regent's
 * fluid tool (upstream: haxiomic/GPU-Fluid-Experiments, MIT).
 *
 * The web-component wrapper drives frame(t); this effect does NOT own a RAF
 * loop. Pointer state arrives via onPointer. Headless-safe: with no WebGL
 * context (happy-dom) init marks the effect dead and all methods no-op.
 *
 * Float/half-float framebuffers are feature-detected with a FLOAT ->
 * HALF_FLOAT_OES -> UNSIGNED_BYTE fallback, matching the original.
 */

// CELL_SIZE = 32; rdx = 1/32; halfrdx = 0.5*rdx; alpha = -(32*32)
const CELL_SIZE = 32;

const VERT = /* glsl */ `
precision highp float;
attribute vec2 aPosition;
uniform float aspectRatio;
varying vec2 texelCoord;
varying vec2 p;
void main() {
  texelCoord = aPosition;
  vec2 clipSpace = 2.0 * texelCoord - 1.0;
  p = vec2(clipSpace.x * aspectRatio, clipSpace.y);
  gl_Position = vec4(clipSpace, 0.0, 1.0);
}
`;

const FLUID_BASE = /* glsl */ `
vec2 clipToSimSpace(vec2 cs) {
  return vec2(cs.x * aspectRatio, cs.y);
}
vec2 simToTexelSpace(vec2 ss) {
  return vec2(ss.x / aspectRatio + 1.0, ss.y + 1.0) * 0.5;
}
float samplePressure(sampler2D pr, vec2 coord) {
  vec2 off = vec2(0.0);
  if (coord.x < 0.0)      off.x = 1.0;
  else if (coord.x > 1.0)  off.x = -1.0;
  if (coord.y < 0.0)      off.y = 1.0;
  else if (coord.y > 1.0)  off.y = -1.0;
  return texture2D(pr, coord + off * invresolution).x;
}
vec2 sampleVelocity(sampler2D vel, vec2 coord) {
  vec2 off = vec2(0.0);
  vec2 mult = vec2(1.0);
  if (coord.x < 0.0)      { off.x = 1.0;  mult.x = -1.0; }
  else if (coord.x > 1.0)  { off.x = -1.0; mult.x = -1.0; }
  if (coord.y < 0.0)      { off.y = 1.0;  mult.y = -1.0; }
  else if (coord.y > 1.0)  { off.y = -1.0; mult.y = -1.0; }
  return mult * texture2D(vel, coord + off * invresolution).xy;
}
`;

const DIST_SEG = /* glsl */ `
float distToSegment(vec2 a, vec2 b, vec2 pt, out float fp) {
  vec2 d = pt - a;
  vec2 x = b - a;
  fp = 0.0;
  float lx = length(x);
  if (lx <= 0.0001) return length(d);
  float proj = dot(d, x / lx);
  fp = proj / lx;
  if (proj < 0.0) return length(d);
  else if (proj > lx) return length(pt - b);
  return sqrt(abs(dot(d, d) - proj * proj));
}
`;

const ADVECT_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D velocity;
uniform sampler2D target;
uniform float dt;
uniform float rdx;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
void main() {
  vec2 tracedPos = p - dt * rdx * texture2D(velocity, texelCoord).xy;
  vec2 tc = simToTexelSpace(tracedPos) / invresolution;
  vec4 st;
  st.xy = floor(tc - 0.5) + 0.5;
  st.zw = st.xy + 1.0;
  vec2 t = tc - st.xy;
  st *= invresolution.xyxy;
  vec4 tex11 = texture2D(target, st.xy);
  vec4 tex21 = texture2D(target, st.zy);
  vec4 tex12 = texture2D(target, st.xw);
  vec4 tex22 = texture2D(target, st.zw);
  gl_FragColor = mix(mix(tex11, tex21, t.x), mix(tex12, tex22, t.x), t.y);
}
`;

const DIVERGENCE_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D velocity;
uniform float halfrdx;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
void main() {
  vec2 L = sampleVelocity(velocity, texelCoord - vec2(invresolution.x, 0.0));
  vec2 R = sampleVelocity(velocity, texelCoord + vec2(invresolution.x, 0.0));
  vec2 B = sampleVelocity(velocity, texelCoord - vec2(0.0, invresolution.y));
  vec2 T = sampleVelocity(velocity, texelCoord + vec2(0.0, invresolution.y));
  gl_FragColor = vec4(halfrdx * ((R.x - L.x) + (T.y - B.y)), 0.0, 0.0, 1.0);
}
`;

const PRESSURE_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform float alpha;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
void main() {
  float L = samplePressure(pressure, texelCoord - vec2(invresolution.x, 0.0));
  float R = samplePressure(pressure, texelCoord + vec2(invresolution.x, 0.0));
  float B = samplePressure(pressure, texelCoord - vec2(0.0, invresolution.y));
  float T = samplePressure(pressure, texelCoord + vec2(0.0, invresolution.y));
  float bC = texture2D(divergence, texelCoord).x;
  gl_FragColor = vec4((L + R + B + T + alpha * bC) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform float halfrdx;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
void main() {
  float L = samplePressure(pressure, texelCoord - vec2(invresolution.x, 0.0));
  float R = samplePressure(pressure, texelCoord + vec2(invresolution.x, 0.0));
  float B = samplePressure(pressure, texelCoord - vec2(0.0, invresolution.y));
  float T = samplePressure(pressure, texelCoord + vec2(0.0, invresolution.y));
  vec2 v = texture2D(velocity, texelCoord).xy;
  gl_FragColor = vec4(v - halfrdx * vec2(R - L, T - B), 0.0, 1.0);
}
`;

const MOUSE_FORCE_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D velocity;
uniform float dt;
uniform float dx;
uniform float aspectRatio;
uniform vec2 invresolution;
uniform bool isMouseDown;
uniform vec2 mouseClipSpace;
uniform vec2 lastMouseClipSpace;
uniform float uVelDissipation;
uniform float uSplatRadius;
uniform float uSplatForce;
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
${DIST_SEG}
void main() {
  vec2 v = texture2D(velocity, texelCoord).xy;
  v *= uVelDissipation;
  if (isMouseDown) {
    vec2 mouse = clipToSimSpace(mouseClipSpace);
    vec2 lastMouse = clipToSimSpace(lastMouseClipSpace);
    vec2 mouseVelocity = -(lastMouse - mouse) / dt;
    float fp;
    float l = distToSegment(mouse, lastMouse, p, fp);
    float taperFactor = 0.6;
    float projectedFraction = 1.0 - clamp(fp, 0.0, 1.0) * taperFactor;
    float R = uSplatRadius;
    float m = exp(-l / R);
    m *= projectedFraction * projectedFraction;
    vec2 targetVelocity = mouseVelocity * dx * uSplatForce;
    v += (targetVelocity - v) * m;
  }
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const MOUSE_DYE_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D dye;
uniform float dt;
uniform float dx;
uniform float aspectRatio;
uniform vec2 invresolution;
uniform bool isMouseDown;
uniform vec2 mouseClipSpace;
uniform vec2 lastMouseClipSpace;
uniform float uDyeDissipation;
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
${DIST_SEG}
void main() {
  vec4 color = texture2D(dye, texelCoord);
  // Per-channel decay ratios are the original's (warm-trail signature);
  // uDyeDissipation scales them, normalized so 0.97 reproduces the original.
  float decayScale = uDyeDissipation / 0.97;
  color.r *= 0.9797 * decayScale;
  color.g *= 0.9494 * decayScale;
  color.b *= 0.9696 * decayScale;
  if (isMouseDown) {
    vec2 mouse = clipToSimSpace(mouseClipSpace);
    vec2 lastMouse = clipToSimSpace(lastMouseClipSpace);
    vec2 mouseVelocity = -(lastMouse - mouse) / dt;
    float fp;
    float l = distToSegment(mouse, lastMouse, p, fp);
    float taperFactor = 0.6;
    float projectedFraction = 1.0 - clamp(fp, 0.0, 1.0) * taperFactor;
    float R = 0.025;
    float m = exp(-l / R);
    float speed = length(mouseVelocity);
    float x = clamp((speed * speed * 0.02 - l * 5.0) * projectedFraction, 0.0, 1.0);
    color.rgb += m * (
      mix(vec3(2.4, 0.0, 5.9) / 60.0, vec3(0.2, 51.8, 100.0) / 30.0, x)
      + vec3(1.0) * pow(x, 9.0)
    );
  }
  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

const DISPLAY_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
uniform sampler2D uTexture;
uniform float uAlpha;
void main() {
  gl_FragColor = abs(texture2D(uTexture, texelCoord)) * uAlpha;
}
`;

const PARTICLE_VS = /* glsl */ `
precision highp float;
attribute vec2 aPosition;
varying vec2 texelCoord;
void main() {
  texelCoord = aPosition;
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}
`;

const PARTICLE_INIT_FS = /* glsl */ `
precision highp float;
varying vec2 texelCoord;
void main() {
  vec2 ip = texelCoord * 2.0 - 1.0;
  gl_FragColor = vec4(ip, 0.0, 0.0);
}
`;

const PARTICLE_STEP_FS = /* glsl */ `
precision highp float;
precision highp sampler2D;
varying vec2 texelCoord;
uniform float dt;
uniform sampler2D particleData;
uniform float dragCoefficient;
uniform vec2 flowScale;
uniform sampler2D flowVelocityField;
void main() {
  vec2 pos = texture2D(particleData, texelCoord).xy;
  vec2 vel = texture2D(particleData, texelCoord).zw;
  vec2 vf = texture2D(flowVelocityField, (pos + 1.0) * 0.5).xy * flowScale;
  vel += (vf - vel) * dragCoefficient;
  pos += dt * vel;
  gl_FragColor = vec4(pos, vel);
}
`;

const PARTICLE_RENDER_VS = /* glsl */ `
precision highp float;
precision highp sampler2D;
attribute vec2 particleUV;
uniform sampler2D particleData;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform vec3 uColorGlow;
varying vec4 color;
void main() {
  vec2 pos = texture2D(particleData, particleUV).xy;
  vec2 vel = texture2D(particleData, particleUV).zw;
  gl_PointSize = 1.0;
  gl_Position = vec4(pos, 0.0, 1.0);
  float speed = length(vel);
  float x = clamp(speed * 4.0, 0.0, 1.0);
  color.rgb = mix(uColorLow, uColorHigh, x)
            + uColorGlow * x * x * x * 0.1;
  color.a = 1.0;
}
`;

const PARTICLE_RENDER_FS = /* glsl */ `
precision highp float;
varying vec4 color;
void main() {
  gl_FragColor = color;
}
`;

type FluidQuality = 'ultra' | 'high' | 'medium' | 'low';

interface FluidParams {
  scene: number;
  quality: FluidQuality;
  solverIterations: number;
  curl: number;
  velocityDissipation: number;
  splatRadius: number;
  splatForce: number;
  particleDrag: number;
  showDye: boolean;
  dyeAlpha: number;
  dyeDissipation: number;
  colorLow: string;
  colorHigh: string;
  colorGlow: string;
  bgColor: string;
}

// Scene presets live in ./presets (single source of truth, shared with the
// central preset registry). FLUID_PRESETS is indexed by scene order.

// Quality map: particleExp (1<<exp particles), fluidScale (sim-texture scale),
// iterations (Jacobi default). Verbatim from the original QUALITY_MAP.
const QUALITY_MAP: Record<FluidQuality, { particleExp: number; fluidScale: number; iterations: number }> = {
  ultra: { particleExp: 20, fluidScale: 0.5, iterations: 30 },
  high: { particleExp: 20, fluidScale: 0.25, iterations: 20 },
  medium: { particleExp: 18, fluidScale: 0.25, iterations: 18 },
  low: { particleExp: 16, fluidScale: 0.2, iterations: 14 },
};

/**
 * Map a canvas-relative pointer position (PIXELS, top-left origin - the units
 * the compositor/PointerTracker now deliver) into the fluid sim's clip space
 * [-1,1] with y flipped to y-up. This is exactly the regent original's
 * windowToClipX/Y: `(x / clientWidth) * 2 - 1` and `((clientH - y) / clientH) *
 * 2 - 1`. Pure + headless-safe so the coordinate mapping can be unit tested
 * without a GL context.
 */
export function fluidClipFromPixel(
  px: number,
  py: number,
  w: number,
  h: number,
): [number, number] {
  const cw = w > 0 ? w : 1;
  const ch = h > 0 ? h : 1;
  return [(px / cw) * 2 - 1, ((ch - py) / ch) * 2 - 1];
}

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

/** A ping-pong framebuffer pair (read/write swap). */
interface DFBO {
  read: { fb: WebGLFramebuffer; tex: WebGLTexture };
  write: { fb: WebGLFramebuffer; tex: WebGLTexture };
  swap(): void;
}

function makeTarget(
  gl: WebGLRenderingContext,
  w: number,
  h: number,
  type: number,
): { fb: WebGLFramebuffer; tex: WebGLTexture } | null {
  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();
  if (!tex || !fb) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fb, tex };
}

function makeDFBO(gl: WebGLRenderingContext, w: number, h: number, type: number): DFBO | null {
  const a = makeTarget(gl, w, h, type);
  const b = makeTarget(gl, w, h, type);
  if (!a || !b) return null;
  const d: DFBO = {
    read: a,
    write: b,
    swap() {
      const t = d.read;
      d.read = d.write;
      d.write = t;
    },
  };
  return d;
}

export function createFluidEffect(): Effect {
  let gl: WebGLRenderingContext | null = null;
  let dead = false;
  let lastT = 0;
  let simW = 0;
  let simH = 0;
  let aspect = 1;
  let texType = 0; // resolved float/half-float/unsigned-byte
  let ready = false;

  // The live canvas, kept so the pointer handlers can normalize pixel coords by
  // the canvas's CSS size (matching the original's windowToClip using clientWidth).
  let canvasEl: HTMLCanvasElement | null = null;

  // pointer state in clip space [-1,1]
  let mouseX = 0;
  let mouseY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let mouseDown = false;
  // The original gates injection on `(lastMousePointKnown && isMouseDown)` so a
  // splat is never applied before a real pointer sample exists (avoids a velocity
  // spike on the very first move/press). We mirror that here.
  let mousePointKnown = false;
  let lastMousePointKnown = false;

  const programs: Record<string, WebGLProgram | null> = {};
  let quadBuffer: WebGLBuffer | null = null;
  let velocity: DFBO | null = null;
  let pressure: DFBO | null = null;
  let dye: DFBO | null = null;
  let divergenceFB: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;

  // GPU particle layer (advected through the velocity field).
  let particles: DFBO | null = null;
  let particleUVBuffer: WebGLBuffer | null = null;
  let pTexSize = 0;
  let numParticles = 0;
  let offscreen: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;
  let offW = 0;
  let offH = 0;
  let lastW = 256;
  let lastH = 256;

  const p: FluidParams = {
    scene: 0,
    quality: 'high',
    solverIterations: 20,
    curl: 0,
    velocityDissipation: 0.999,
    splatRadius: 0.015,
    splatForce: 1,
    particleDrag: 1.0,
    showDye: true,
    dyeAlpha: 1.0,
    dyeDissipation: 0.97,
    colorLow: '#3D1545',
    colorHigh: '#2299FF',
    colorGlow: '#BBECFF',
    bgColor: '#000000',
  };

  function bindQuad(prog: WebGLProgram): void {
    if (!gl || !quadBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const loc = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  function setCommon(prog: WebGLProgram): void {
    if (!gl) return;
    gl.uniform1f(gl.getUniformLocation(prog, 'aspectRatio'), aspect);
    gl.uniform2f(gl.getUniformLocation(prog, 'invresolution'), 1 / simW, 1 / simH);
  }

  function drawTo(
    target: { fb: WebGLFramebuffer } | null,
    prog: WebGLProgram | null,
  ): boolean {
    if (!gl || !prog) return false;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? simW : gl.drawingBufferWidth, target ? simH : gl.drawingBufferHeight);
    bindQuad(prog);
    setCommon(prog);
    return true;
  }

  function bindTex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void {
    if (!gl) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  function initParticles(): void {
    if (!gl || !particles || !programs.particleInit) return;
    // Render the InitialConditions twice into the ping-pong pair so both
    // read and write start seeded (matches the original double-blit).
    const prog = programs.particleInit;
    gl.useProgram(prog);
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, particles.write.fb);
      gl.viewport(0, 0, pTexSize, pTexSize);
      bindQuad(prog);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      particles.swap();
    }
  }

  function allocate(w: number, h: number): void {
    if (!gl) return;
    lastW = w;
    lastH = h;
    const qcfg = QUALITY_MAP[p.quality] || QUALITY_MAP.high;
    simW = Math.max(4, Math.floor(w * qcfg.fluidScale));
    simH = Math.max(4, Math.floor(h * qcfg.fluidScale));
    aspect = w / Math.max(1, h);
    velocity = makeDFBO(gl, simW, simH, texType);
    pressure = makeDFBO(gl, simW, simH, texType);
    dye = makeDFBO(gl, simW, simH, texType);
    divergenceFB = makeTarget(gl, simW, simH, texType);

    // Particle data textures: pTexSize^2 >= 1<<particleExp, RGBA float
    // (pos.xy + vel.zw). Verbatim particle-count derivation from the original.
    pTexSize = Math.ceil(Math.sqrt(1 << qcfg.particleExp));
    numParticles = pTexSize * pTexSize;
    particles = makeDFBO(gl, pTexSize, pTexSize, texType);
    const uvs = new Float32Array(numParticles * 2);
    for (let i = 0; i < numParticles; i++) {
      uvs[i * 2] = (i % pTexSize) / pTexSize;
      uvs[i * 2 + 1] = Math.floor(i / pTexSize) / pTexSize;
    }
    particleUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    // Offscreen accumulation target (particles + dye, additive) -> blit to screen.
    offW = Math.max(1, w);
    offH = Math.max(1, h);
    offscreen = makeTarget(gl, offW, offH, gl.UNSIGNED_BYTE);

    ready = !!(velocity && pressure && dye && divergenceFB && particles && offscreen);
    if (ready && gl) {
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      if (!ok) ready = false;
    }
    if (ready) initParticles();
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const ctx =
        (canvas.getContext('webgl', { premultipliedAlpha: false }) as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (!ctx) {
        dead = true;
        return;
      }
      gl = ctx;
      canvasEl = canvas;

      // feature-detect float -> half-float -> unsigned-byte (matches original)
      const floatExt = gl.getExtension('OES_texture_float');
      const halfExt = gl.getExtension('OES_texture_half_float');
      gl.getExtension('OES_texture_half_float_linear');
      gl.getExtension('OES_texture_float_linear');
      texType = floatExt
        ? gl.FLOAT
        : halfExt
          ? (halfExt as { HALF_FLOAT_OES: number }).HALF_FLOAT_OES
          : gl.UNSIGNED_BYTE;

      for (const k of Object.keys(p) as (keyof FluidParams)[]) {
        if (k in opts.params) this.setParam(k, opts.params[k]);
      }

      // fullscreen quad (aPosition in [0,1])
      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
        gl.STATIC_DRAW,
      );

      // compile all fluid programs (verbatim shaders above)
      programs.advect = program(gl, VERT, ADVECT_FS);
      programs.divergence = program(gl, VERT, DIVERGENCE_FS);
      programs.pressure = program(gl, VERT, PRESSURE_FS);
      programs.gradient = program(gl, VERT, GRADIENT_FS);
      programs.mouseForce = program(gl, VERT, MOUSE_FORCE_FS);
      programs.mouseDye = program(gl, VERT, MOUSE_DYE_FS);
      programs.display = program(gl, VERT, DISPLAY_FS);
      // particle programs compiled too (the additive GPU particle layer)
      programs.particleStep = program(gl, PARTICLE_VS, PARTICLE_STEP_FS);
      programs.particleInit = program(gl, PARTICLE_VS, PARTICLE_INIT_FS);
      programs.particleRender = program(gl, PARTICLE_RENDER_VS, PARTICLE_RENDER_FS);

      allocate(canvas.width || 256, canvas.height || 256);
    },

    frame(t: number) {
      if (dead || !gl || !ready || !velocity || !pressure || !dye || !divergenceFB) return;
      // Original caps the timestep at 0.02s (Main.hx: Math.min(now - lastTime, 0.02)).
      const dt = lastT === 0 ? 1 / 60 : Math.min((t - lastT) / 1000, 0.02);
      lastT = t;

      const rdx = 1 / CELL_SIZE;
      const halfrdx = 0.5 * rdx;
      const alpha = -(CELL_SIZE * CELL_SIZE);
      const dx = CELL_SIZE;

      // --- advect velocity ---
      if (drawTo(velocity.write, programs.advect)) {
        const prog = programs.advect!;
        bindTex(prog, 'velocity', velocity.read.tex, 0);
        bindTex(prog, 'target', velocity.read.tex, 1);
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(prog, 'rdx'), rdx);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        velocity.swap();
      }

      // --- mouse force (also applies v *= 0.999 every frame) ---
      if (drawTo(velocity.write, programs.mouseForce)) {
        const prog = programs.mouseForce!;
        bindTex(prog, 'velocity', velocity.read.tex, 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), Math.max(dt, 0.001));
        gl.uniform1f(gl.getUniformLocation(prog, 'dx'), dx);
        gl.uniform1i(
          gl.getUniformLocation(prog, 'isMouseDown'),
          lastMousePointKnown && mouseDown ? 1 : 0,
        );
        gl.uniform2f(gl.getUniformLocation(prog, 'mouseClipSpace'), mouseX, mouseY);
        gl.uniform2f(gl.getUniformLocation(prog, 'lastMouseClipSpace'), lastMouseX, lastMouseY);
        gl.uniform1f(gl.getUniformLocation(prog, 'uVelDissipation'), p.velocityDissipation);
        gl.uniform1f(gl.getUniformLocation(prog, 'uSplatRadius'), p.splatRadius);
        gl.uniform1f(gl.getUniformLocation(prog, 'uSplatForce'), p.splatForce);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        velocity.swap();
      }

      // --- divergence ---
      if (drawTo(divergenceFB, programs.divergence)) {
        const prog = programs.divergence!;
        bindTex(prog, 'velocity', velocity.read.tex, 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'halfrdx'), halfrdx);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // --- Jacobi pressure solve ---
      for (let i = 0; i < p.solverIterations; i++) {
        if (drawTo(pressure.write, programs.pressure)) {
          const prog = programs.pressure!;
          bindTex(prog, 'pressure', pressure.read.tex, 0);
          bindTex(prog, 'divergence', divergenceFB.tex, 1);
          gl.uniform1f(gl.getUniformLocation(prog, 'alpha'), alpha);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          pressure.swap();
        }
      }

      // --- gradient subtract ---
      if (drawTo(velocity.write, programs.gradient)) {
        const prog = programs.gradient!;
        bindTex(prog, 'pressure', pressure.read.tex, 0);
        bindTex(prog, 'velocity', velocity.read.tex, 1);
        gl.uniform1f(gl.getUniformLocation(prog, 'halfrdx'), halfrdx);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        velocity.swap();
      }

      // --- mouse dye (color decay every frame + inject on pointer) ---
      if (drawTo(dye.write, programs.mouseDye)) {
        const prog = programs.mouseDye!;
        bindTex(prog, 'dye', dye.read.tex, 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), Math.max(dt, 0.001));
        gl.uniform1f(gl.getUniformLocation(prog, 'dx'), dx);
        gl.uniform1i(
          gl.getUniformLocation(prog, 'isMouseDown'),
          lastMousePointKnown && mouseDown ? 1 : 0,
        );
        gl.uniform2f(gl.getUniformLocation(prog, 'mouseClipSpace'), mouseX, mouseY);
        gl.uniform2f(gl.getUniformLocation(prog, 'lastMouseClipSpace'), lastMouseX, lastMouseY);
        gl.uniform1f(gl.getUniformLocation(prog, 'uDyeDissipation'), p.dyeDissipation);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        dye.swap();
      }

      // --- advect dye ---
      if (drawTo(dye.write, programs.advect)) {
        const prog = programs.advect!;
        bindTex(prog, 'velocity', velocity.read.tex, 0);
        bindTex(prog, 'target', dye.read.tex, 1);
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(prog, 'rdx'), rdx);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        dye.swap();
      }

      // --- step GPU particles through the velocity field ---
      if (particles && programs.particleStep) {
        const prog = programs.particleStep;
        gl.useProgram(prog);
        gl.disable(gl.BLEND);
        gl.bindFramebuffer(gl.FRAMEBUFFER, particles.write.fb);
        gl.viewport(0, 0, pTexSize, pTexSize);
        bindQuad(prog);
        bindTex(prog, 'particleData', particles.read.tex, 0);
        bindTex(prog, 'flowVelocityField', velocity.read.tex, 1);
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(prog, 'dragCoefficient'), p.particleDrag);
        gl.uniform2f(
          gl.getUniformLocation(prog, 'flowScale'),
          1 / (CELL_SIZE * aspect),
          1 / CELL_SIZE,
        );
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        particles.swap();
      }

      // --- additive composite (particles + dye) into the offscreen target ---
      if (offscreen) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, offscreen.fb);
        gl.viewport(0, 0, offW, offH);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);

        // GPU particle render (speed -> low/high/glow color ramp)
        if (particles && programs.particleRender && particleUVBuffer) {
          const prog = programs.particleRender;
          gl.useProgram(prog);
          bindTex(prog, 'particleData', particles.read.tex, 0);
          const low = hexToVec3(p.colorLow);
          const high = hexToVec3(p.colorHigh);
          const glow = hexToVec3(p.colorGlow);
          gl.uniform3f(gl.getUniformLocation(prog, 'uColorLow'), low[0], low[1], low[2]);
          gl.uniform3f(gl.getUniformLocation(prog, 'uColorHigh'), high[0], high[1], high[2]);
          gl.uniform3f(gl.getUniformLocation(prog, 'uColorGlow'), glow[0], glow[1], glow[2]);
          gl.bindBuffer(gl.ARRAY_BUFFER, particleUVBuffer);
          const loc = gl.getAttribLocation(prog, 'particleUV');
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.POINTS, 0, numParticles);
        }

        // dye layered into the same offscreen (additive), scaled by dyeAlpha
        if (p.showDye && programs.display) {
          const prog = programs.display;
          gl.useProgram(prog);
          bindQuad(prog);
          bindTex(prog, 'uTexture', dye.read.tex, 0);
          gl.uniform1f(gl.getUniformLocation(prog, 'uAlpha'), p.dyeAlpha);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.disable(gl.BLEND);
      }

      // --- blit offscreen to screen, additively over bgColor ---
      const bg = hexToVec3(p.bgColor);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (offscreen && programs.display) {
        const prog = programs.display;
        gl.useProgram(prog);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);
        bindQuad(prog);
        bindTex(prog, 'uTexture', offscreen.tex, 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'uAlpha'), 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disable(gl.BLEND);
      }

      // last-mouse tracking for the next frame's segment force (verbatim
      // updateLastMouse(): clip coords + the known-flag the inject gate reads).
      lastMouseX = mouseX;
      lastMouseY = mouseY;
      lastMousePointKnown = mousePointKnown;
    },

    resize(w: number, h: number) {
      if (dead || !gl) return;
      gl.viewport(0, 0, Math.max(1, w), Math.max(1, h));
      // rebuild sim targets at the new resolution
      allocate(Math.max(1, w), Math.max(1, h));
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'scene': {
          // Named presets (Cosmic/Regent/Inferno/Void/Monochrome) apply the
          // full color set, exactly as the original FluidControls.selectScene.
          // "Custom" (scene = -1) leaves the color pickers in control.
          const sval = String(value);
          if (sval === 'Custom' || sval === '-1') {
            p.scene = -1;
            break;
          }
          let idx = FLUID_SCENE_NAMES.indexOf(sval as (typeof FLUID_SCENE_NAMES)[number]);
          if (idx < 0) idx = Number(sval); // numeric fallback
          const preset = FLUID_PRESETS[idx];
          if (preset) {
            p.scene = idx;
            p.colorLow = preset.colorLow;
            p.colorHigh = preset.colorHigh;
            p.colorGlow = preset.colorGlow;
            p.bgColor = preset.bgColor;
          }
          break;
        }
        case 'quality': {
          const q = String(value) as FluidQuality;
          if (q in QUALITY_MAP && q !== p.quality) {
            p.quality = q;
            p.solverIterations = QUALITY_MAP[q].iterations;
            // particle count + sim scale changed: rebuild GPU resources.
            if (gl && !dead) allocate(lastW, lastH);
          } else if (q in QUALITY_MAP) {
            p.quality = q;
          }
          break;
        }
        case 'solverIterations':
          p.solverIterations = Math.max(1, Math.floor(Number(value)));
          break;
        // curl: in the original's param set/defaults (0) but left inert by the
        // original sim (no vorticity-confinement pass); stored to preserve the
        // full param surface 1:1.
        case 'curl':
          p.curl = Number(value);
          break;
        case 'velocityDissipation':
          p.velocityDissipation = Number(value);
          break;
        case 'splatRadius':
          p.splatRadius = Number(value);
          break;
        case 'splatForce':
          p.splatForce = Number(value);
          break;
        case 'particleDrag':
          p.particleDrag = Number(value);
          break;
        case 'showDye':
          p.showDye = Boolean(value);
          break;
        case 'dyeAlpha':
          p.dyeAlpha = Number(value);
          break;
        case 'dyeDissipation':
          p.dyeDissipation = Number(value);
          break;
        case 'colorLow':
          p.colorLow = String(value);
          break;
        case 'colorHigh':
          p.colorHigh = String(value);
          break;
        case 'colorGlow':
          p.colorGlow = String(value);
          break;
        case 'bgColor':
          p.bgColor = String(value);
          break;
        default:
          break;
      }
    },

    // Continuous pointer surface: position every frame + whether pressed. The
    // original injects velocity/dye ONLY while the button is down (the shaders
    // gate on `isMouseDown`); a hover just tracks position. So `pressed` IS the
    // drag flag - hovering moves the cursor without splatting, dragging splats
    // force + dye along the segment, exactly like the regent original.
    onPointer(x: number, y: number, pressed?: boolean) {
      if (Number.isNaN(x) || Number.isNaN(y)) {
        mouseDown = false;
        return;
      }
      const w = canvasEl?.clientWidth || lastW;
      const h = canvasEl?.clientHeight || lastH;
      const [cx, cy] = fluidClipFromPixel(x, y, w, h);
      mouseX = cx;
      mouseY = cy;
      mousePointKnown = true;
      mouseDown = pressed === true;
    },

    // Discrete press: seed last = current so the drag starts from zero velocity
    // (no force spike on the press frame) - verbatim onMouseDown -> updateLastMouse.
    onPointerDown(x: number, y: number) {
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      const w = canvasEl?.clientWidth || lastW;
      const h = canvasEl?.clientHeight || lastH;
      const [cx, cy] = fluidClipFromPixel(x, y, w, h);
      mouseX = cx;
      mouseY = cy;
      mousePointKnown = true;
      mouseDown = true;
      lastMouseX = mouseX;
      lastMouseY = mouseY;
      lastMousePointKnown = true;
    },

    onPointerUp() {
      mouseDown = false;
    },

    onPointerLeave() {
      mouseDown = false;
    },

    dispose() {
      if (gl) {
        for (const key of Object.keys(programs)) {
          const prog = programs[key];
          if (prog) gl.deleteProgram(prog);
          programs[key] = null;
        }
        if (quadBuffer) gl.deleteBuffer(quadBuffer);
        if (particleUVBuffer) gl.deleteBuffer(particleUVBuffer);
        const lose = gl.getExtension('WEBGL_lose_context');
        lose?.loseContext();
      }
      quadBuffer = null;
      particleUVBuffer = null;
      velocity = null;
      pressure = null;
      dye = null;
      divergenceFB = null;
      particles = null;
      offscreen = null;
      ready = false;
      gl = null;
      canvasEl = null;
      dead = true;
    },
  };
}
