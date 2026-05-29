# Lane 1 recon - regent shaders (LOCAL)

Collaborator: Jonah
Source: local working copy at `/Users/spare3/Documents/Github/regent` (no web fetch)
Effects characterized: fluid, mesh-gradient, halftone, fractal-glass, swarm (5 of 5)
License: MIT-or-owned. Attribution: regent. Redistribution: `ok` (we own it).

All five are React/Next.js client components ("use client"). Four use WebGL (one raw WebGL1, three via Three.js); one is pure Canvas2D. Every one owns its own `requestAnimationFrame` loop and its own pointer listeners today, so the dominant normalization task is the same across the lane: strip the React/RAF/event chrome, expose a class implementing `init / frame(t) / resize / setParam / dispose`, and convert pointer ownership to injected params. The GLSL itself ports verbatim.

A note that recurs below: three of these effects (fluid, halftone, fractal-glass) embed a Stam-style stable-fluid solver (advect -> forces -> divergence -> Jacobi pressure solve -> gradient subtract). The halftone and fractal-glass variants share a nearly identical Three.js fluid sim; the fluid tool uses an independent raw-WebGL fluid sim ported from haxiomic/GPU-Fluid-Experiments. When acquisition normalizes these, the Three.js fluid sim should become one shared module consumed by both halftone and fractal-glass.

---

## Effect 1: fluid

### Source / tech
- File: `app/(app)/tools/fluid/FluidGenerator.tsx` (+ `types.ts`, `presets.ts`).
- Tech: **raw WebGL1** (no Three.js). Half-float / float FBO ping-pong. GPU particle system (position+velocity packed in a float texture) advected through the fluid velocity field.
- Provenance (from in-file comment): "faithful port from haxiomic/GPU-Fluid-Experiments" (originally Haxe/WebGL). `cellSize = 32`, simulation-space coordinates throughout.

### Architecture
Ping-pong FBOs: `velocity` (DFBO), `pressure` (DFBO), `divergence` (single FBO), `dye` (DFBO), plus a `particles` DFBO (RGBA float: xy=pos, zw=vel) and an `offscreen` RGBA8 target. Per frame: advect velocity -> mouse force (also applies `v *= 0.999` dissipation every frame) -> divergence -> N Jacobi pressure iterations -> gradient subtract -> mouse dye (color decay every frame) -> advect dye -> step particles -> render particles + dye additively to offscreen -> blit offscreen to screen. Float-format capability is feature-detected at init (`testFormat`) with graceful fallback FLOAT -> HALF_FLOAT_OES -> UNSIGNED_BYTE.

### VERBATIM source - shaders

Vertex (shared by all fluid passes):
```glsl
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
```

Fluid base helpers (inlined into passes that need them):
```glsl
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
```

Advection (advect.frag):
```glsl
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
// + fluidBaseGLSL helpers above
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
```

Divergence (velocity-divergence.frag):
```glsl
precision highp float;
precision highp sampler2D;
uniform sampler2D velocity;
uniform float halfrdx;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
// + fluidBaseGLSL helpers
void main() {
  vec2 L = sampleVelocity(velocity, texelCoord - vec2(invresolution.x, 0.0));
  vec2 R = sampleVelocity(velocity, texelCoord + vec2(invresolution.x, 0.0));
  vec2 B = sampleVelocity(velocity, texelCoord - vec2(0.0, invresolution.y));
  vec2 T = sampleVelocity(velocity, texelCoord + vec2(0.0, invresolution.y));
  gl_FragColor = vec4(halfrdx * ((R.x - L.x) + (T.y - B.y)), 0.0, 0.0, 1.0);
}
```

Pressure solve (pressure-solve.frag):
```glsl
precision highp float;
precision highp sampler2D;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform float alpha;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
// + fluidBaseGLSL helpers
void main() {
  float L = samplePressure(pressure, texelCoord - vec2(invresolution.x, 0.0));
  float R = samplePressure(pressure, texelCoord + vec2(invresolution.x, 0.0));
  float B = samplePressure(pressure, texelCoord - vec2(0.0, invresolution.y));
  float T = samplePressure(pressure, texelCoord + vec2(0.0, invresolution.y));
  float bC = texture2D(divergence, texelCoord).x;
  gl_FragColor = vec4((L + R + B + T + alpha * bC) * 0.25, 0.0, 0.0, 1.0);
}
```

Gradient subtract (pressure-gradient-subtract.frag):
```glsl
precision highp float;
precision highp sampler2D;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform float halfrdx;
uniform float aspectRatio;
uniform vec2 invresolution;
varying vec2 texelCoord;
varying vec2 p;
// + fluidBaseGLSL helpers
void main() {
  float L = samplePressure(pressure, texelCoord - vec2(invresolution.x, 0.0));
  float R = samplePressure(pressure, texelCoord + vec2(invresolution.x, 0.0));
  float B = samplePressure(pressure, texelCoord - vec2(0.0, invresolution.y));
  float T = samplePressure(pressure, texelCoord + vec2(0.0, invresolution.y));
  vec2 v = texture2D(velocity, texelCoord).xy;
  gl_FragColor = vec4(v - halfrdx * vec2(R - L, T - B), 0.0, 1.0);
}
```

MouseForce (blend toward target velocity; applies dissipation every frame):
```glsl
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
// + fluidBaseGLSL helpers

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

void main() {
  vec2 v = texture2D(velocity, texelCoord).xy;
  v *= 0.999; // velocity dissipation (from original)

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
```

MouseDye (color decay every frame + injects dye on pointer):
```glsl
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
// + fluidBaseGLSL helpers + distToSegment (same as above)

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
```

Display (abs of texture):
```glsl
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
```

Particle init / step / render:
```glsl
// particle VS
precision highp float;
attribute vec2 aPosition;
varying vec2 texelCoord;
void main() {
  texelCoord = aPosition;
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}

// particle init FS
precision highp float;
varying vec2 texelCoord;
void main() {
  vec2 ip = texelCoord * 2.0 - 1.0;
  gl_FragColor = vec4(ip, 0.0, 0.0);
}

// particle step FS
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

// render particle VS
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

// render particle FS
precision highp float;
varying vec4 color;
void main() {
  gl_FragColor = color;
}
```

Quality map (sim scale + particle count + iterations):
```ts
const QUALITY_MAP = {
  ultra: { particleExp: 20, fluidScale: 0.5,   iterations: 30, offScreenScale: 1 },
  high:  { particleExp: 20, fluidScale: 0.25,  iterations: 20, offScreenScale: 1 },
  medium:{ particleExp: 18, fluidScale: 0.25,  iterations: 18, offScreenScale: 1 },
  low:   { particleExp: 16, fluidScale: 0.2,   iterations: 14, offScreenScale: 1 },
};
// CELL_SIZE = 32; rdx = 1/32; halfrdx = 0.5*rdx; alpha = -(32*32)
// flowScaleX = 1/(CELL_SIZE*simAspect); flowScaleY = 1/CELL_SIZE
// render blend: gl.blendFunc(SRC_ALPHA, SRC_ALPHA), FUNC_ADD (additive particles+dye)
```

### Proposed manifest
- id: `fluid`
- name: "Fluid"
- category: simulation / generative
- layerRole: `background`
- requiredAssets: none (procedural)
- tags: `[webgl, fluid, particles, pointer, generative, additive]`

| param | type | default | min | max |
|---|---|---|---|---|
| scene | select | 0 | 0 | 4 (presets: Cosmic, Regent, Inferno, Void, Monochrome) |
| quality | select | "high" | - | ultra/high/medium/low |
| solverIterations | range | 20 | 5 | 40 |
| particleDrag | range | 1.0 | 0.01 | 1.0 |
| showDye | toggle | true | - | - |
| dyeDissipation | range | 0.97 | 0.9 | 1.0 |
| velocityDissipation | range | 0.999 | 0.9 | 1.0 |
| colorLow | color | #3D1545 | - | - |
| colorHigh | color | #2299FF | - | - |
| colorGlow | color | #BBECFF | - | - |
| bgColor | color | #000000 | - | - |

(Note: `curl`, `splatRadius`, `splatForce`, `dyeAlpha` exist in the type but several are hardcoded in shader constants - dissipation rates are literals inside MouseForce/MouseDye, not driven by the uniform values. Acquisition should either wire them as real uniforms or drop them from the manifest.)

### License + attribution
MIT-or-owned (regent). Upstream algorithm: haxiomic/GPU-Fluid-Experiments (MIT). Redistribution `ok`.

### Integration notes / gotchas
- Raw WebGL1; needs `OES_texture_half_float` (+ `_linear`) or `OES_texture_float`. Has runtime fallback to UNSIGNED_BYTE if neither framebuffer-completes.
- Owns its own RAF, ResizeObserver, and mouse/touch listeners; re-inits the whole GL context when `quality` changes (effect dependency `[quality]`).
- Pointer is core to the effect (dye + force injection). For our contract, pointer state must be injected, not self-listened.
- Additive blending and the `abs()` display pass are load-bearing for the look. devicePixelRatio clamped to 2.

### Normalization sketch
- `init(canvas, {params})`: take the existing `useEffect` body. Create GL context on the passed canvas instead of creating its own. Compile programs, build FBOs, init particles. Store all GL handles on the instance.
- `frame(t)`: the existing `frame()` body minus `requestAnimationFrame(frame)`. Compute `dt` from the external `t` delta instead of `performance.now()`. Drives one full sim+render step.
- `resize(w,h)`: today this only resizes the canvas backing store; a faithful resize that rebuilds sim FBOs at the new sim resolution is a small addition (currently it relies on `[quality]` re-init).
- `setParam(k,v)`: write into the params object (currently `paramsRef`). Pointer position/down should arrive as params (e.g. `pointer:{x,y,down}`) since the effect must not own listeners.
- `dispose()`: the existing cleanup return (cancel RAF, remove listeners, `WEBGL_lose_context`).
- Caveat: quality change requires GL re-init in the current design. Expose as `setParam('quality')` that triggers an internal teardown+rebuild, or document it as init-only.

---

## Effect 2: mesh-gradient

### Source / tech
- Files: `app/(app)/tools/mesh-gradient/MeshGradientGenerator.tsx` + `shaders.ts` (+ `types.ts`, `presets.ts`).
- Tech: **Three.js** (`import * as THREE`) + `OrbitControls` (from `three/examples/jsm/controls/OrbitControls.js`). A 200x200 subdivided `PlaneGeometry` displaced and colored entirely in the vertex shader; fragment shader adds grain + Bayer dither.
- Provenance (from `shaders.ts` header): technique ported from `gradients.juangarcia.ch` - subdivided plane mesh, vertex displacement, per-vertex color via layered simplex-noise thresholding, GPU interpolates colors across triangles.

### VERBATIM source - shaders
Vertex shader (3D simplex noise + displacement + per-vertex layered color):
```glsl
uniform vec2 uFrequency;
uniform float uTime;
uniform float uAmount;
uniform float uSpeed;
uniform vec3 uColor[5];
uniform int uColorCount;
uniform mat3 uOrbitMatrix;

varying vec2 vUv;
varying vec3 vColor;

vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}
vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec2 noiseCoord = uv * uFrequency;
    float displacementNoise = snoise(vec3(
        noiseCoord.x + uTime * 0.02,
        noiseCoord.y,
        uTime * uSpeed
    ));
    modelPosition.y += displacementNoise * uAmount;

    int lastIdx = uColorCount - 1;
    vColor = uColor[4];
    if (lastIdx == 0) vColor = uColor[0];
    else if (lastIdx == 1) vColor = uColor[1];
    else if (lastIdx == 2) vColor = uColor[2];
    else if (lastIdx == 3) vColor = uColor[3];
    else vColor = uColor[4];

    int layerCount = uColorCount - 1;
    if (layerCount > 4) layerCount = 4;
    for (int i = 0; i < 4; i++) {
        if (i >= layerCount) break;
        float fi = float(i);
        float noiseFlow = 0.0002 + fi * 0.05;
        float noiseSpeed = 0.0001 + fi * 0.03;
        float noiseSeed = 1.0 + fi * 10.0;
        vec2 noiseFreq = vec2(0.3, 0.6);
        float noiseFloor = 0.1;
        float noiseCeiling = 0.6 + fi * 0.08;
        vec3 nCoord = vec3(
            noiseCoord.x * noiseFreq.x + uTime * noiseFlow,
            noiseCoord.y * noiseFreq.y,
            uTime * noiseSpeed + noiseSeed
        );
        nCoord = uOrbitMatrix * nCoord;
        float noise = smoothstep(noiseFloor, noiseCeiling, snoise(nCoord));
        vColor = mix(vColor, uColor[i], noise);
    }

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    vUv = uv;
}
```

Fragment shader (grain + ordered Bayer 4x4 dither):
```glsl
precision highp float;
varying vec2 vUv;
varying vec3 vColor;
uniform float uTime;
uniform float uGrainIntensity;
uniform bool uDitherEnabled;
uniform float uDitherStrength;

float bayerDither4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    if (index == 0) return 0.0 / 16.0;
    if (index == 1) return 8.0 / 16.0;
    if (index == 2) return 2.0 / 16.0;
    if (index == 3) return 10.0 / 16.0;
    if (index == 4) return 12.0 / 16.0;
    if (index == 5) return 4.0 / 16.0;
    if (index == 6) return 14.0 / 16.0;
    if (index == 7) return 6.0 / 16.0;
    if (index == 8) return 3.0 / 16.0;
    if (index == 9) return 11.0 / 16.0;
    if (index == 10) return 1.0 / 16.0;
    if (index == 11) return 9.0 / 16.0;
    if (index == 12) return 15.0 / 16.0;
    if (index == 13) return 7.0 / 16.0;
    if (index == 14) return 13.0 / 16.0;
    return 5.0 / 16.0;
}
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    vec3 color = vColor;
    if (uGrainIntensity > 0.0) {
        float grain = rand(gl_FragCoord.xy + vec2(uTime * 100.0)) - 0.5;
        color += grain * uGrainIntensity;
    }
    if (uDitherEnabled) {
        float dither = bayerDither4x4(gl_FragCoord.xy) - 0.5;
        color += dither * uDitherStrength;
    }
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
}
```

Scene setup constants: `PerspectiveCamera(35, W/H, 0.1, 100)`, default pos `(0, 0.5, 0.4)` looking at origin; `PlaneGeometry(1.5, 1.5, 200, 200)` rotated `-PI/2` on X; material `side: DoubleSide`. uColor is a `vec3[5]` filled from up to 5 color stops (linear RGB, no gamma).

### Proposed manifest
- id: `mesh-gradient`
- name: "Mesh Gradient"
- category: gradient / generative
- layerRole: `background`
- requiredAssets: none
- tags: `[three, webgl, gradient, mesh, simplex-noise, dither, grain]`

| param | type | default | min | max |
|---|---|---|---|---|
| scene | select | 0 | 0 | 4 |
| colorStops | color[] (up to 5) | preset | - | - |
| noiseFrequency | range | 3.0 | 0 | 10 |
| noiseAmount | range | 0.2 | 0 | 0.6 |
| noiseSpeed | range | 0.02 | 0 | 0.3 |
| animFreeze | toggle | false | - | - |
| grainIntensity | range | 0.02 | 0.0 | 0.5 |
| ditherEnabled | toggle | false | - | - |
| ditherStrength | range | 0.3 | 0.0 | 1.0 |
| wireframe | toggle | false | - | - |

### License + attribution
MIT-or-owned (regent). Technique credit: `gradients.juangarcia.ch` (Juan Garcia). Redistribution `ok`.

### Integration notes / gotchas
- Hard dependency on **three** and **three/examples OrbitControls**. OrbitControls is only used for an optional "camera edit" mode; safe to drop for the playground contract.
- `uColor` is a fixed-size `vec3[5]` array uniform; color count handled via `uColorCount` and clamped loops. Must always fill all 5 slots (last color repeated) or GLSL array access misbehaves.
- `setPixelRatio(window.devicePixelRatio)` unclamped here (others clamp to 2).
- Time accumulates via `timeRef` and respects `animFreeze`. `uOrbitMatrix` is reset to identity each frame (orbit feature inert in current build).

### Normalization sketch
- `init`: build renderer on the passed canvas (`new THREE.WebGLRenderer({canvas, antialias:true})`), camera, scene, ShaderMaterial with the two shaders, subdivided plane. Drop OrbitControls/camera-edit entirely.
- `frame(t)`: set `uTime` from external `t` (honor a `freeze` param), `syncUniforms`, `renderer.render`.
- `resize(w,h)`: `renderer.setSize`, `camera.aspect`, `updateProjectionMatrix` (already present as `handleResize`).
- `setParam`: map into the params object; `syncUniforms` already centralizes uniform writes.
- `dispose`: existing cleanup (geometry/material/renderer dispose).
- Self-driven RAF and ResizeObserver are the only chrome to remove. Background role, no pointer needed.

---

## Effect 3: halftone

### Source / tech
- File: `app/(app)/tools/halftone/HalftoneGenerator.tsx` (+ `types.ts`, `presets.ts`).
- Tech: **Three.js**. A full Three.js port of the same stable-fluid solver (advect/divergence/Jacobi-pressure/gradient-subtract, plus curl-noise + pointer paint passes) running into HalfFloat render targets, then a **post-process halftone fragment shader** samples the fluid color buffer per-cell and renders rotated dots. layerRole here is effectively `post` over a generated fluid field, but as packaged it is a self-contained background.
- Provenance (in-file comments): fluid sim ported from an original "FluidSimulation / FluidPlane / MainScene" (the IndiciumAI bundle, same family as fractal-glass). Background "replaces original justified.jpg" with a procedural radial gradient the fluid decays toward.

### VERBATIM source - shared fluid GLSL
```glsl
// FLUID_SHARED_GLSL
vec2 clipToSimSpace(vec2 clipSpace){
    return vec2(clipSpace.x / invResolution.z, clipSpace.y);
}
vec2 simToTexelSpace(vec2 simSpace){
    return vec2(simSpace.x * invResolution.z + 1.0, simSpace.y + 1.0) * 0.5;
}
#define samplePressure(tex, coord) (texture2D(pressure, coord).x)
#define outOfBoundsVelocityMultiplier(coord) (velocityBoundaryEnabled ? (step(vec2(0.), coord) * step(coord, vec2(1.)) * 2. - 1.) : vec2(1.0))
#define sampleVelocity(tex, coord) (outOfBoundsVelocityMultiplier(coord) * texture2D(velocity, coord).xy)
```
```glsl
// FLUID_SD_SEGMENT_GLSL
float sdSegment(vec2 x, vec2 a, vec2 b, out float alpha) {
    vec2 ab = b - a;
    vec2 ax = x - a;
    alpha = dot(ab, ax) / dot(ab, ab);
    vec2 d = ax - clamp(alpha, 0., 1.) * ab;
    return length(d);
}
float sdSegment(vec2 x, vec2 a, vec2 b) {
    float alpha;
    return sdSegment(x, a, b, alpha);
}
```
Simplex noise + curlNoise (`SIMPLEX_NOISE_GLSL`) - identical to the fractal-glass copy below (mod289/permute/taylorInvSqrt/snoise/snoiseVec3/curlNoise). See fractal-glass section for the verbatim block; it is character-for-character the same here.

Fluid pass fragment shaders (advect / divergence / pressure solve / gradient subtract / paintVelocity / paintColor) - identical to fractal-glass. The only fluid-sim differences are tuning constants:
```ts
// halftone constants
const FLUID_ITERATIONS = 2;
const FLUID_TIME_SCALE = 0.10;
const FLUID_VELOCITY_DECAY = 2.5;
const FLUID_COLOR_DECAY = 4.0;
const FLUID_POINTER_SPREAD = 150;
const FLUID_CURL_STRENGTH = 0.035;
const FLUID_CURL_SCALE = 1.5;
const FLUID_CURL_CHANGE_RATE = 0.025;
const FLUID_POINTER_STRENGTH = 0.35;
const FLUID_POINTER_DRAG = 0.32;
const FLUID_SIM_TEXTURE_SCALE = 0.25;
const FLUID_PHYSICS_SCALE = 1;
```

VERBATIM - halftone post shader (the distinctive part):
```glsl
// HALFTONE_VERTEX
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```
```glsl
// HALFTONE_FRAGMENT
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uDotSize;
uniform float uGridAngle;
uniform float uContrast;
uniform float uSoftness;
uniform float uInvert;
varying vec2 vUv;

vec2 rotatePoint(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  vec2 pixelCoord = vUv * uResolution;
  float angleRad = uGridAngle * 3.14159265 / 180.0;
  vec2 rotated = rotatePoint(pixelCoord, angleRad);
  vec2 cellSize = vec2(uDotSize);
  vec2 cell = floor(rotated / cellSize);
  vec2 cellCenter = (cell + 0.5) * cellSize;
  vec2 cellCenterPx = rotatePoint(cellCenter, -angleRad);
  vec2 cellUV = cellCenterPx / uResolution;
  cellUV = clamp(cellUV, vec2(0.0), vec2(1.0));
  vec4 srcColor = texture2D(uSource, cellUV);

  float srcLuma = max(dot(srcColor.rgb, vec3(0.299, 0.587, 0.114)), 0.001);
  float liftedLuma = pow(srcLuma, 0.5);
  float liftScale = liftedLuma / srcLuma;
  vec3 lifted = srcColor.rgb * liftScale;
  float maxChan = max(max(lifted.r, lifted.g), lifted.b);
  if (maxChan > 1.0) lifted /= maxChan;
  float avg = (lifted.r + lifted.g + lifted.b) / 3.0;
  lifted = max(mix(vec3(avg), lifted, 1.5), vec3(0.0));

  float luma = dot(lifted, vec3(0.299, 0.587, 0.114));
  luma = pow(clamp(luma, 0.0, 1.0), 1.0 / max(uContrast, 0.05));
  float sizeFactor = mix(luma, 1.0 - luma, uInvert);
  float maxRadius = uDotSize * 0.5;
  float radius = maxRadius * sqrt(sizeFactor);
  float dist = distance(rotated, cellCenter);
  float edgePx = max(uSoftness * 2.0, 0.5);
  float dotMask = 1.0 - smoothstep(radius - edgePx, radius + edgePx, dist);
  vec3 baseColor = lifted * 0.08;
  vec3 finalColor = mix(baseColor, lifted, dotMask);
  gl_FragColor = vec4(finalColor, 1.0);
}
```

The procedural background (`createBackgroundTexture`) builds a 512x512 4-stop radial gradient (center c4 -> c3 -> c2 -> edge c1) whose stop positions are weighted by `highlight/midtone/shadow`, with a slowly drifting Lissajous center. The fluid color buffer decays toward this texture each frame. JS source for that function is in the file; it is straightforward CPU code, not a shader.

### Proposed manifest
- id: `halftone`
- name: "Halftone"
- category: post-process / generative
- layerRole: `post` (over a self-generated fluid field; packaged as full-bleed background)
- requiredAssets: none (procedural bg replaces original `justified.jpg`)
- tags: `[three, webgl, halftone, fluid, post-process, pointer, dots]`

| param | type | default | min | max |
|---|---|---|---|---|
| scene | select | 0 | 0 | 4 |
| turbulence | range | 0.1 | 0 | 1 (scales curl strength) |
| highlight | range | 1.2 | ~0.1 | ~3 (gradient stop weight) |
| midtone | range | 1.5 | ~0.1 | ~3 |
| shadow | range | 1.0 | ~0.1 | ~3 |
| dotSize | range | 12 | 4 | 60 |
| gridAngle | range | 15 | 0 | 90 (degrees) |
| contrast | range | 1.0 | 0.2 | 3.0 |
| softness | range | 0.4 | 0.0 | 1.0 |
| invert | toggle | false | - | - |

(`fluidInfluence` exists in the type but is not read by the renderer; drop or wire on acquisition.)

### License + attribution
MIT-or-owned (regent). Fluid lineage: IndiciumAI bundle family (see fractal-glass). Redistribution `ok`.

### Integration notes / gotchas
- **three** dependency. Needs `HalfFloatType` render targets (WebGL1 OES_texture_half_float or WebGL2). No explicit fallback in this file - assumes half-float support.
- The fluid sim and the fractal-glass fluid sim are duplicate code with different constants. Normalize to one shared module.
- Pointer drives the fluid; pointer state must be injected. Pointer handler listens on both `container` and `document`.
- Background texture is rebuilt CPU-side ~5fps (every 200ms) for the drift; that allocation cadence is a perf knob worth noting.
- `renderer.autoClear = false` and manual clear ordering are load-bearing.

### Normalization sketch
- `init`: renderer on passed canvas; build fluid sim (`createFluidSim`), bg texture, halftone fullscreen quad + ortho camera.
- `frame(t)`: compute dt from external t; update pointer-from-params; `stepFluidSim`; refresh `uSource` to the swapped color texture; render the halftone quad to screen.
- `resize`: existing `handleResize` (renderer size, ortho bounds, quad geometry, `uResolution`).
- `setParam`: into params object; halftone uniforms are synced each frame already.
- `dispose`: existing cleanup (`disposeFluidSim`, bg texture, renderer).
- Pointer is injected, not listened. The fluid sim module should be the shared one extracted from this + fractal-glass.

---

## Effect 4: fractal-glass

### Source / tech
- Files: `app/(app)/tools/fractal-glass/FractalGlassGenerator.tsx` (+ `types.ts`, `presets.ts`, `colorUtils.ts`) AND a packaged reusable variant `components/backgrounds/FractalGlassBackground.tsx` (+ `fractal-glass-types.ts`, `fractal-glass-presets.ts`).
- Tech: **Three.js**. Same fluid sim as halftone, rendered onto a background plane, viewed through a **fluted-glass refraction material**: `MeshPhysicalMaterial` (transmission=1, ior, thickness) patched via `onBeforeCompile` to perturb the surface normal into a squircle "flute" profile, plus a **procedural HDR environment map** generated CPU-side and run through `PMREMGenerator`.
- Provenance (in-file comment): "direct port from IndiciumAI webpack bundle chunk 386"; `FlutedGlassMaterial`, `FluidSimulation`, `MainScene` are the original class names.
- `components/backgrounds/FractalGlassBackground.tsx` is the same engine packaged as a no-controls background component with fixed default params (first ~60 lines confirmed identical DEFAULT_PARAMS / resolvePreset / fluid constants). It is the "use it as a real background" surface; the tool version adds the controls panel.

### VERBATIM source - simplex/curl noise (shared)
```glsl
vec3 mod289(vec3 x) { return x-floor(x*(1./289.))*289.; }
vec4 mod289(vec4 x) { return x-floor(x*(1./289.))*289.; }
vec4 permute(vec4 x) { return mod289(((x*34.)+1.)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159-.85373472095314*r; }
float snoise(vec3 v) {
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
        i.z+vec4(0.,i1.z,i2.z,1.))
        +i.y+vec4(0.,i1.y,i2.y,1.))
        +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 snoiseVec3(vec3 x){
    float s=snoise(vec3(x));
    float s1=snoise(vec3(x.y-19.1,x.z+33.4,x.x+47.2));
    float s2=snoise(vec3(x.z+74.2,x.x-124.5,x.y+99.4));
    vec3 c=vec3(s,s1,s2);
    return c;
}
vec3 curlNoise(vec3 p){
    const float e=.1;
    vec3 dx=vec3(e,0.,0.);
    vec3 dy=vec3(0.,e,0.);
    vec3 dz=vec3(0.,0.,e);
    vec3 p_x0=snoiseVec3(p-dx);
    vec3 p_x1=snoiseVec3(p+dx);
    vec3 p_y0=snoiseVec3(p-dy);
    vec3 p_y1=snoiseVec3(p+dy);
    vec3 p_z0=snoiseVec3(p-dz);
    vec3 p_z1=snoiseVec3(p+dz);
    float x=p_y1.z-p_y0.z-p_z1.y+p_z0.y;
    float y=p_z1.x-p_z0.x-p_x1.z+p_x0.z;
    float z=p_x1.y-p_x0.y-p_y1.x+p_y0.x;
    return normalize(vec3(x,y,z));
}
```

VERBATIM - fluid pass fragment shaders (advect / divergence / pressure / gradient-sub / paintVelocity / paintColor). The full-resolution color advect + the curl+pointer velocity paint are the heart of the motion:
```glsl
// advect FS
precision highp float;
uniform vec3 invResolution;
uniform bool velocityBoundaryEnabled;
uniform float rdx;
uniform float dt;
uniform sampler2D velocity;
uniform sampler2D target;
varying vec2 vUv;
varying vec2 p;
// + FLUID_SHARED_GLSL
void main(){
    vec2 tracedPos = p - dt * rdx * texture2D(velocity, vUv).xy;
    gl_FragColor = texture2D(target, simToTexelSpace(tracedPos));
}
```
```glsl
// divergence FS
precision highp float;
uniform vec3 invResolution;
uniform bool velocityBoundaryEnabled;
uniform sampler2D velocity;
uniform float halfRdx;
varying vec2 vL; varying vec2 vR; varying vec2 vB; varying vec2 vT;
// + FLUID_SHARED_GLSL
void main(){
    vec2 L = sampleVelocity(velocity, vL);
    vec2 R = sampleVelocity(velocity, vR);
    vec2 B = sampleVelocity(velocity, vB);
    vec2 T = sampleVelocity(velocity, vT);
    gl_FragColor = vec4(halfRdx * ((R.x - L.x) + (T.y - B.y)), 0., 0., 1.);
}
```
```glsl
// pressure solve FS
precision highp float;
uniform vec3 invResolution;
uniform bool velocityBoundaryEnabled;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform float dxAlpha;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vB; varying vec2 vT;
// + FLUID_SHARED_GLSL
void main(){
    float L = samplePressure(pressure, vL);
    float R = samplePressure(pressure, vR);
    float B = samplePressure(pressure, vB);
    float T = samplePressure(pressure, vT);
    float bC = texture2D(divergence, vUv).x;
    gl_FragColor = vec4((L + R + B + T + dxAlpha * bC) * .25, 0., 0., 1.);
}
```
```glsl
// gradient subtract FS
precision highp float;
uniform vec3 invResolution;
uniform bool velocityBoundaryEnabled;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform float halfRdx;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vB; varying vec2 vT;
// + FLUID_SHARED_GLSL
void main(){
    float L = samplePressure(pressure, vL);
    float R = samplePressure(pressure, vR);
    float B = samplePressure(pressure, vB);
    float T = samplePressure(pressure, vT);
    vec2 v = texture2D(velocity, vUv).xy;
    gl_FragColor = vec4(v - halfRdx*vec2(R-L, T-B), 0., 1.);
}
```
```glsl
// paintVelocity FS (decay + curl noise + pointer drag)
precision highp float;
uniform sampler2D velocity;
uniform vec3 invResolution;
uniform float dt;
uniform float dx;
uniform vec3 uPointer;
uniform vec3 uPointerLast;
uniform float uDecayFactor;
uniform vec3 uCurlParameters;
uniform vec3 uPointerParameters;
uniform float uTime_s;
varying vec2 vUv;
varying vec2 p;
// + FLUID_SHARED_GLSL + FLUID_SD_SEGMENT_GLSL + SIMPLEX_NOISE_GLSL
void main() {
    vec2 velLastFrame = texture2D(velocity, vUv).xy;
    vec2 vel = velLastFrame;
    {
        vec2 targetVelocity = vec2(0.);
        vec2 dv = targetVelocity - vel;
        vel += dv * clamp(uDecayFactor * dt, 0., 1.0);
    }
    vec2 cNoise = curlNoise(vec3(vUv * uCurlParameters.y, uTime_s * uCurlParameters.z)).xy;
    if (uCurlParameters.x > 0.) {
        vel += uCurlParameters.x * cNoise;
    }
    vec2 pointerPos = clipToSimSpace(uPointer.xy * 2.0 - 1.0);
    vec2 pointerPosLast = clipToSimSpace(uPointerLast.xy * 2.0 - 1.0);
    float pointerDown = uPointer.z;
    if (pointerDown < 0.5) {
        float d = sdSegment(p, pointerPos, pointerPosLast);
        vec2 userVelocity = (pointerPos - pointerPosLast) / dt;
        float strength = uPointerParameters.x;
        float dragStrength = uPointerParameters.y;
        float spread = uPointerParameters.z;
        float m = exp(-d * d * spread) * dragStrength;
        vec2 targetVelocity = userVelocity * dx * dt * 60.;
        vel += (targetVelocity - vel) * m;
    }
    gl_FragColor = vec4(vel, 0., 1.);
}
```
```glsl
// paintColor FS (decay toward background texture)
precision highp float;
uniform sampler2D color;
uniform vec3 invResolution;
uniform float dt;
uniform sampler2D uBackgroundTexture;
uniform float uDecayFactor;
varying vec2 vUv;
varying vec2 p;
// + FLUID_SHARED_GLSL
void main() {
    vec3 rgbLastFrame = texture2D(color, vUv).rgb;
    vec3 rgb = rgbLastFrame;
    vec4 backgroundSample = texture2D(uBackgroundTexture, vUv);
    {
        vec3 dColor = backgroundSample.rgb - rgb;
        rgb += dColor * clamp(uDecayFactor * dt, 0., 1.0);
    }
    gl_FragColor = vec4(clamp(rgb, 0., 1.), 1.);
}
```

VERBATIM - fluted glass functions (the distinctive refraction; injected via onBeforeCompile):
```glsl
uniform float singleFluteWidth;
uniform float fluteExponent;
uniform float fluteDepth;
const float MAX_FLUTE_GEOMETRY_DEPTH = 0.02;

float getFluteU(float x) {
    float fluteLocal = fract(x / singleFluteWidth + 0.5);
    return fluteLocal * 2.0 - 1.0;
}
float getSquircleZ(float u, float n) {
    float absU = clamp(abs(u), 0.0, 0.999);
    return pow(1.0 - pow(absU, n), 1.0 / n);
}
vec2 getSquircleNormalXZ(float u, float n) {
    float absU = clamp(abs(u), 0.001, 0.999);
    float signU = sign(u);
    float nx = signU * pow(absU, n - 1.0);
    float nz = pow(1.0 - pow(absU, n), (n - 1.0) / n);
    float len = sqrt(nx * nx + nz * nz);
    return vec2(nx, nz) / len;
}
```

The `onBeforeCompile` patch (verbatim mechanism): inject the flute functions after `#include <common>` in the fragment shader, then after `#include <normal_fragment_maps>` replace the surface normal:
```glsl
#include <normal_fragment_maps>
{
    float u = getFluteU(vWorldPosition.x);
    vec2 squircleNormalXZ = getSquircleNormalXZ(u, fluteExponent);
    vec3 fluteNormalModel = vec3(squircleNormalXZ.x, 0.0, squircleNormalXZ.y);
    vec3 blendedNormalModel = normalize(mix(vec3(0.0, 0.0, 1.0), fluteNormalModel, fluteDepth));
    normal = normalize(mat3(viewMatrix) * mat3(modelMatrix) * blendedNormalModel);
}
```
Material base: `MeshPhysicalMaterial({ transmission:1.0, roughness:0, metalness:0, ior, thickness, specularIntensity:0, clearcoat:0, side:FrontSide, transparent:true, envMapIntensity })`. Renderer uses `NeutralToneMapping`, `scene.environmentRotation = Euler(0,-1.73,0)`. The procedural HDR env map (`createProceduralEnvMap`) builds a 512x512 FloatType equirect (dark base + ceiling + softbox core/mid/wide + fill + floor bounce, all tinted by `envColor1..3`) then PMREM-prefilters it. JS source in-file.

Fluid constants (differ from halftone):
```ts
const FLUID_ITERATIONS = 2;
const FLUID_TIME_SCALE = 0.10;
const FLUID_VELOCITY_DECAY = 4;
const FLUID_COLOR_DECAY = 6.0;
const FLUID_POINTER_SPREAD = 150;
const FLUID_CURL_STRENGTH = 0.012;
const FLUID_CURL_SCALE = 1.5;
const FLUID_CURL_CHANGE_RATE = 0.015;
const FLUID_POINTER_STRENGTH = 0.35;
const FLUID_POINTER_DRAG = 0.32;
const FLUID_SIM_TEXTURE_SCALE = 0.25;
const FLUID_PHYSICS_SCALE = 1;
```

### Proposed manifest
- id: `fractal-glass`
- name: "Fractal Glass"
- category: refraction / generative
- layerRole: `background` (full-bleed; already shipped as a background component)
- requiredAssets: none (procedural bg + procedural env map; original `justified.jpg` replaced)
- tags: `[three, webgl, glass, refraction, fluid, transmission, pmrem, pointer]`

| param | type | default | min | max |
|---|---|---|---|---|
| scene | select | 0 | 0 | 4 |
| turbulence | range | 0.1 | 0 | 1 |
| highlight | range | 1.0 | ~0.1 | ~3 |
| midtone | range | 1.0 | ~0.1 | ~3 |
| shadow | range | 1.0 | ~0.1 | ~3 |
| fluteCount | range | 50 | ~10 | ~150 |
| fluteExponent | range | 2.0 | ~1 | ~8 |
| fluteDepth | range | 1.0 | 0 | 1 |
| ior | range | 1.3 | 1.0 | ~2.0 |
| thickness | range | 0.1 | 0 | ~1 |
| roughness | range | 0 | 0 | 1 |
| envIntensity | range | 1.0 | 0 | ~3 |

(`fluidInfluence`, `glassAmount`, `bloomStrength` are in the type but not wired into the renderer in this build; drop or wire on acquisition.)

### License + attribution
MIT-or-owned (regent). Lineage: IndiciumAI bundle chunk 386 (`FlutedGlassMaterial` / `FluidSimulation` / `MainScene`). Redistribution `ok`.

### Integration notes / gotchas
- **three** dependency; needs `MeshPhysicalMaterial` transmission (WebGL2 strongly preferred) + `PMREMGenerator` + HalfFloat render targets + a FloatType DataTexture for the env map.
- `onBeforeCompile` string replacements are brittle across three.js versions (the `#include <normal_fragment_maps>` / `#include <common>` chunk names and `vWorldPosition` availability are version-sensitive). Pin three.js or guard the replace.
- Two procedural generators run CPU-side: bg texture (rebuilt ~5fps for drift) and env map (rebuilt only on scene/env-color change, expensive - PMREM). Env regeneration on setParam should be debounced.
- Pointer drives the fluid; inject pointer. Self-listens on container + document.
- `components/backgrounds/FractalGlassBackground.tsx` is the cleanest starting point for normalization (no controls coupling).

### Normalization sketch
- `init`: renderer on passed canvas (`NeutralToneMapping`, SRGB out); build env map (PMREM), bg texture, fluid sim, bg plane (`MeshBasicMaterial` showing fluid color), glass plane (fluted `MeshPhysicalMaterial`). Ortho camera.
- `frame(t)`: dt from external t; pointer-from-params; rebuild bg drift if due; sync material uniforms (ior/thickness/roughness/envIntensity + flute uniforms via `userData.shader`); `stepFluidSim`; update bg plane map to swapped texture; render.
- `resize`: existing handler (renderer size, ortho bounds, plane geometries).
- `setParam`: into params; scene/env-color change triggers debounced env-map regen; flute uniforms updated through the stored `userData.shader`.
- `dispose`: existing cleanup (`disposeFluidSim`, env map, bg texture, material, renderer).
- Share the fluid-sim module with halftone. Keep the env-map regen off the hot path.

---

## Effect 5: swarm

### Source / tech
- File: `app/(app)/tools/swarm/SwarmGenerator.tsx` (+ `types.ts`, `presets.ts`).
- Tech: **Canvas2D** (no WebGL, no three). A grid of "dots" with spring-return physics; pointer attracts (or repels) dots within a radius, with per-dot orbital jitter. Six dot shapes drawn via path commands.
- Provenance (in-file comments): "direct port of SwarmTuner DEFAULTS"; physics "ported from original updateDots()"; shapes "ported verbatim from original drawShape()". (Origin is regent's own SwarmTuner; owned.)

### VERBATIM source - core logic
Grid build (per-dot home + orbit state):
```ts
function buildGrid(spacing, w, h) {
  const dots = [];
  const cols = Math.ceil(w / spacing) + 2;
  const rows = Math.ceil(h / spacing) + 2;
  const offsetX = (w - (cols - 1) * spacing) / 2;
  const offsetY = (h - (rows - 1) * spacing) / 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hx = offsetX + col * spacing;
      const hy = offsetY + row * spacing;
      dots.push({ homeX: hx, homeY: hy, x: hx, y: hy, vx: 0, vy: 0,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitSpeed: 0.02 + Math.random() * 0.02 });
    }
  }
  return dots;
}
```
Physics (per frame, per dot):
```ts
dot.orbitAngle += dot.orbitSpeed;
let attracted = false;
if (mouseActive) {
  const dx = mx - dot.homeX;        // distance from HOME, not current pos
  const dy = my - dot.homeY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < p.attractRadius) {
    const force = 1 - (dist / p.attractRadius);
    const eased = force * force * force; // cubic
    if (p.repelMode) {
      const homeDx = dot.homeX - mx;
      const homeDy = dot.homeY - my;
      const homeDist = Math.sqrt(homeDx*homeDx + homeDy*homeDy) || 1;
      const nx = homeDx / homeDist, ny = homeDy / homeDist;
      const targetX = mx + nx * p.attractRadius;
      const targetY = my + ny * p.attractRadius;
      dot.vx += (targetX - dot.x) * p.attractStrength * eased;
      dot.vy += (targetY - dot.y) * p.attractStrength * eased;
    } else {
      const orbitR = p.orbitRadius * (1 - eased * 0.5);
      const jitterX = Math.cos(dot.orbitAngle) * orbitR * p.orbitJitter;
      const jitterY = Math.sin(dot.orbitAngle) * orbitR * p.orbitJitter;
      dot.vx += (mx + jitterX - dot.x) * p.attractStrength * eased;
      dot.vy += (my + jitterY - dot.y) * p.attractStrength * eased;
    }
    attracted = true;
  }
}
if (!attracted) {
  dot.vx += (dot.homeX - dot.x) * p.returnStrength;
  dot.vy += (dot.homeY - dot.y) * p.returnStrength;
} else {
  dot.vx += (dot.homeX - dot.x) * p.returnStrength * 0.15;
  dot.vy += (dot.homeY - dot.y) * p.returnStrength * 0.15;
}
dot.vx *= p.friction; dot.vy *= p.friction;
dot.x += dot.vx; dot.y += dot.vy;
```
Render (displacement -> alpha/radius/color lerp + glow):
```ts
const displacement = Math.sqrt(dx*dx + dy*dy);  // dx,dy = current - home
const t = Math.min(displacement / 60, 1);       // hardcoded /60
const alpha = preset.idleAlpha + (preset.swarmAlpha - preset.idleAlpha) * t;
const radius = p.dotRadius + t * 0.8;
const r = Math.round(idleRgb[0] + (swarmRgb[0]-idleRgb[0]) * t);
// g, b likewise
ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
drawShape(ctx, p.dotShape, dot.x, dot.y, radius);
if (t > 0.4) {                                   // glow threshold
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${preset.glowAlpha * (t - 0.4)})`;
  drawShape(ctx, p.dotShape, dot.x, dot.y, radius + 2);
}
```
Shapes (`drawShape`) - circle / square / diamond / triangle / sparkle (4-point star) / cross. Verbatim path commands are in the file (lines 87-153); they are plain Canvas2D path ops, faithfully reproducible.

### Proposed manifest
- id: `swarm`
- name: "Swarm"
- category: particles / interactive
- layerRole: `pointer` (pointer-driven dot field; can also serve as a `background` since it fills the canvas)
- requiredAssets: none
- tags: `[canvas2d, particles, pointer, grid, physics, dots]`

| param | type | default | min | max |
|---|---|---|---|---|
| scene | select | 0 | 0 | 4 |
| gridSpacing | range | 18 | 8 | 40 |
| dotRadius | range | 1 | 0.5 | 6 |
| dotShape | select | circle | - | circle/square/diamond/triangle/sparkle/cross |
| attractRadius | range | 220 | 60 | 500 |
| attractStrength | range | 0.035 | 0.005 | 0.1 |
| repelMode | toggle | false | - | - |
| orbitRadius | range | 30 | 0 | 100 |
| orbitJitter | range | 0.6 | 0 | 2 |
| friction | range | 0.92 | 0.8 | 0.99 |
| returnStrength | range | 0.008 | 0.001 | 0.05 |
| idleColor | color | #ffffff | - | - |
| swarmColor | color | #ffffff | - | - |
| bgColor | color | #060608 | - | - |
| idleAlpha | range | 0.08 | 0 | 0.5 |
| swarmAlpha | range | 0.55 | 0.1 | 1.0 |
| glowAlpha | range | 0.15 | 0 | 0.5 |

### License + attribution
MIT-or-owned (regent, original SwarmTuner). Redistribution `ok`.

### Integration notes / gotchas
- No WebGL, no three - the only Canvas2D effect in the lane. Cheapest to normalize.
- `ctx = canvas.getContext("2d", { alpha: false })` and it clears with `bgColor` each frame, so it is opaque - as a `background` it paints its own bg; as a `pointer` overlay the opaque clear would hide layers beneath, so for overlay use the clear must change to `clearRect` + transparent context.
- Reads `window.innerWidth/innerHeight` directly for sizing rather than the canvas client size; normalize to use the injected w/h.
- Pointer attract uses distance from each dot's HOME (not current) position - preserve that, it is what makes the field feel like a settling lattice.
- Grid rebuilt on resize and on `gridSpacing` change. devicePixelRatio handled via `setTransform(dpr,...)`.

### Normalization sketch
- `init(canvas, {params})`: get 2d context; `buildGrid` at initial size; store dots.
- `frame(t)`: the existing `frame()` body minus the trailing `requestAnimationFrame`. (Physics is currently frame-rate dependent, not dt-scaled; for a faithful port keep it per-frame, or scale by `t` delta if we want frame-rate independence - note this is a behavior change.)
- `resize(w,h)`: set backing store with dpr, `setTransform`, rebuild grid (existing `resize`). Use injected w/h instead of `window.innerWidth`.
- `setParam`: write into params; `gridSpacing` change triggers a rebuild (already handled by `prevSpacing` check in-frame).
- `dispose`: cancel RAF, remove listeners (existing cleanup).
- Pointer: inject `{x,y,active}` instead of self-listening pointermove/enter/leave.
- For `pointer` layerRole, swap the opaque `fillRect(bgColor)` clear for a transparent `clearRect` and a transparent 2d context.

---

## Lane-wide summary for acquisition
- 5/5 effects captured with verbatim GLSL/JS. No assets required by any (the only external asset in the originals, `justified.jpg`, is replaced by a procedural gradient in halftone + fractal-glass).
- Shared extraction opportunity: one Three.js stable-fluid module (advect/divergence/Jacobi-pressure/gradient-subtract + curl-noise + pointer paint) underlies halftone and fractal-glass with only constant differences. The fluid tool has a second, independent raw-WebGL fluid sim (haxiomic lineage) that should stay separate.
- Common chrome to strip on all five: self-owned RAF, ResizeObserver, and pointer listeners; React `useEffect`/refs. Pointer must become an injected param for fluid, halftone, fractal-glass, swarm (mesh-gradient needs no pointer).
- Dependencies: three (mesh-gradient, halftone, fractal-glass) + three/examples OrbitControls (mesh-gradient, droppable). fractal-glass additionally needs PMREMGenerator + WebGL2 transmission and a version-pinned three for the `onBeforeCompile` chunk-name patch. fluid needs WebGL1 float/half-float extensions (has fallback). swarm needs nothing beyond Canvas2D.
- Params marked "in type but not wired" (fluid: curl/splat*/dyeAlpha partially; halftone: fluidInfluence; fractal-glass: fluidInfluence/glassAmount/bloomStrength) should be either wired to real uniforms or dropped from the manifest during acquisition.
- License across the lane: MIT-or-owned, attribution regent, redistribution `ok`. Upstream technique credits to record: haxiomic/GPU-Fluid-Experiments (fluid), gradients.juangarcia.ch / Juan Garcia (mesh-gradient), IndiciumAI bundle (halftone + fractal-glass fluid + fluted glass).
