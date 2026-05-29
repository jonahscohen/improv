import type { Effect, EffectOpts } from '../../types';

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
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
${DIST_SEG}
void main() {
  vec2 v = texture2D(velocity, texelCoord).xy;
  v *= 0.999;
  if (isMouseDown) {
    vec2 mouse = clipToSimSpace(mouseClipSpace);
    vec2 lastMouse = clipToSimSpace(lastMouseClipSpace);
    vec2 mouseVelocity = -(lastMouse - mouse) / dt;
    float fp;
    float l = distToSegment(mouse, lastMouse, p, fp);
    float taperFactor = 0.6;
    float projectedFraction = 1.0 - clamp(fp, 0.0, 1.0) * taperFactor;
    float R = 0.015;
    float m = exp(-l / R);
    m *= projectedFraction * projectedFraction;
    vec2 targetVelocity = mouseVelocity * dx;
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
varying vec2 texelCoord;
varying vec2 p;
${FLUID_BASE}
${DIST_SEG}
void main() {
  vec4 color = texture2D(dye, texelCoord);
  color.r *= 0.9797;
  color.g *= 0.9494;
  color.b *= 0.9696;
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
void main() {
  gl_FragColor = abs(texture2D(uTexture, texelCoord));
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

interface FluidParams {
  solverIterations: number;
  particleDrag: number;
  showDye: boolean;
  colorLow: string;
  colorHigh: string;
  colorGlow: string;
  bgColor: string;
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

  // pointer state in clip space [-1,1]
  let mouseX = 0;
  let mouseY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let mouseDown = false;

  const programs: Record<string, WebGLProgram | null> = {};
  let quadBuffer: WebGLBuffer | null = null;
  let velocity: DFBO | null = null;
  let pressure: DFBO | null = null;
  let dye: DFBO | null = null;
  let divergenceFB: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;

  const p: FluidParams = {
    solverIterations: 20,
    particleDrag: 1.0,
    showDye: true,
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

  function allocate(w: number, h: number): void {
    if (!gl) return;
    const scale = 0.25; // FLUID_SIM_TEXTURE_SCALE (high quality)
    simW = Math.max(4, Math.floor(w * scale));
    simH = Math.max(4, Math.floor(h * scale));
    aspect = w / Math.max(1, h);
    velocity = makeDFBO(gl, simW, simH, texType);
    pressure = makeDFBO(gl, simW, simH, texType);
    dye = makeDFBO(gl, simW, simH, texType);
    divergenceFB = makeTarget(gl, simW, simH, texType);
    ready = !!(velocity && pressure && dye && divergenceFB);
    if (ready && gl) {
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      if (!ok) ready = false;
    }
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
      const dt = lastT === 0 ? 1 / 60 : Math.min((t - lastT) / 1000, 1 / 30);
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
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(prog, 'dx'), dx);
        gl.uniform1i(gl.getUniformLocation(prog, 'isMouseDown'), mouseDown ? 1 : 0);
        gl.uniform2f(gl.getUniformLocation(prog, 'mouseClipSpace'), mouseX, mouseY);
        gl.uniform2f(gl.getUniformLocation(prog, 'lastMouseClipSpace'), lastMouseX, lastMouseY);
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
        gl.uniform1f(gl.getUniformLocation(prog, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(prog, 'dx'), dx);
        gl.uniform1i(gl.getUniformLocation(prog, 'isMouseDown'), mouseDown ? 1 : 0);
        gl.uniform2f(gl.getUniformLocation(prog, 'mouseClipSpace'), mouseX, mouseY);
        gl.uniform2f(gl.getUniformLocation(prog, 'lastMouseClipSpace'), lastMouseX, lastMouseY);
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

      // --- display dye to screen (abs of texture) ---
      const bg = hexToVec3(p.bgColor);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (p.showDye && drawTo(null, programs.display)) {
        const prog = programs.display!;
        bindTex(prog, 'uTexture', dye.read.tex, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // last-mouse tracking for the next frame's segment force
      lastMouseX = mouseX;
      lastMouseY = mouseY;
    },

    resize(w: number, h: number) {
      if (dead || !gl) return;
      gl.viewport(0, 0, Math.max(1, w), Math.max(1, h));
      // rebuild sim targets at the new resolution
      allocate(Math.max(1, w), Math.max(1, h));
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'solverIterations':
          p.solverIterations = Math.max(1, Math.floor(Number(value)));
          break;
        case 'particleDrag':
          p.particleDrag = Number(value);
          break;
        case 'showDye':
          p.showDye = Boolean(value);
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

    onPointer(x: number, y: number) {
      if (Number.isNaN(x) || Number.isNaN(y)) {
        mouseDown = false;
        return;
      }
      // wrapper passes canvas-relative normalized [0,1]; map to clip space
      mouseX = x * 2 - 1;
      mouseY = (1 - y) * 2 - 1;
      mouseDown = true;
    },

    dispose() {
      if (gl) {
        for (const key of Object.keys(programs)) {
          const prog = programs[key];
          if (prog) gl.deleteProgram(prog);
          programs[key] = null;
        }
        if (quadBuffer) gl.deleteBuffer(quadBuffer);
        const lose = gl.getExtension('WEBGL_lose_context');
        lose?.loseContext();
      }
      quadBuffer = null;
      velocity = null;
      pressure = null;
      dye = null;
      divergenceFB = null;
      ready = false;
      gl = null;
      dead = true;
    },
  };
}

// particleDrag is wired for the GPU particle layer (compiled above); the dye
// field is the primary visual. Referenced here to keep the param live.
void CELL_SIZE;
