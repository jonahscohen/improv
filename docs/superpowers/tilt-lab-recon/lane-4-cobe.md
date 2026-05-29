# Lane 4 - cobe (globe)

Recon by Jonah (recon-e). RECON ONLY. One WebGL effect: an interactive dotted globe.

## Summary

`cobe` is a tiny (~5KB, zero-dependency) WebGL globe by Shu Ding. It renders a sphere of dots (a Fibonacci lattice sampled against a landmass texture) with diffuse lighting and a soft glow, plus optional markers and (v2) arcs. It is **not** built on `phenomenon` - it ships its own minimal WebGL helper (`webgl.js`) and raw GLSL. `layerRole: midground` - it draws a transparent sphere over content, not a full-bleed background.

### Tech
- WebGL1 (`texture2D`, `gl_FragColor`, `attribute`) compiled from **GLSLX** (`.glslx`) shader source via the glslx compiler. A fullscreen quad runs a ray/sphere fragment shader - the geometry is two triangles, all the globe math is in the fragment shader.
- Landmass data is a baked texture (`texture.png`) sampled in equirectangular UV space.
- Markers (and v2 arcs) are drawn as a second instanced pass with their own shaders (`marker.glslx`, `arc.glslx`).

### Version note (important for the loop adaptation)
- **v1 API**: `createGlobe(canvas, opts)` where `opts.onRender(state)` is called every frame by cobe's **internal `requestAnimationFrame` loop**. You mutate `state.phi` etc. inside the callback. cobe owns the loop.
- **v2** (released 2026-03-19): the type surface exposes `Globe = { update(state), destroy() }`. `update(partialState)` performs a single render pass with mutated params - i.e. cobe can now be **driven externally**, which is exactly tilt-lab's model. `onRender` still works for self-driven use. See normalization sketch below.

### Source URLs / paths
- Repo: https://github.com/shuding/cobe (author: Shu Ding; npm: `cobe`)
- Types: `src/index.d.ts` - https://raw.githubusercontent.com/shuding/cobe/main/src/index.d.ts
- Main logic: `src/index.js`
- Fragment shader: `src/globe.frag.glslx`
- Vertex shader: `src/globe.vert.glslx`
- Marker shader: `src/marker.glslx` (not captured - secondary, see gotchas)
- Arc shader (v2): `src/arc.glslx` (not captured - secondary)
- WebGL helper: `src/webgl.js`
- Landmass texture: `src/texture.png` (required asset)
- Anchor positioning (v2): `src/anchor.js`
- Demo: https://cobe.vercel.app
- npm/CDN: https://unpkg.com/cobe , https://cdn.jsdelivr.net/npm/cobe

## License + attribution

- **License: MIT.**
- **Author / attribution**: Shu Ding (github.com/shuding/cobe).
- **redistribution: `ok`** (MIT permits verbatim reuse with the license + copyright notice retained). Keep the MIT notice.

---

## VERBATIM SOURCE

### TypeScript types (`src/index.d.ts`, v2)

```ts
export interface Marker {
  location: [number, number]
  size: number
  color?: [number, number, number]
  id?: string
}

export interface Arc {
  from: [number, number]
  to: [number, number]
  color?: [number, number, number]
  id?: string
}

export interface COBEOptions {
  width: number
  height: number
  phi: number
  theta: number
  mapSamples: number
  mapBrightness: number
  mapBaseBrightness?: number
  baseColor: [number, number, number]
  markerColor: [number, number, number]
  glowColor: [number, number, number]
  markers?: Marker[]
  diffuse: number
  devicePixelRatio: number
  dark: number
  opacity?: number
  offset?: [number, number]
  scale?: number
  context?: WebGLContextAttributes

  // New in v2
  arcs?: Arc[]
  arcColor?: [number, number, number]
  arcWidth?: number
  arcHeight?: number
  markerElevation?: number
}

export interface Globe {
  update: (state: Partial<COBEOptions>) => void
  destroy: () => void
}

export default function createGlobe(
  canvas: HTMLCanvasElement,
  opts: COBEOptions,
): Globe
```

> Note: the v2 `.d.ts` type does not list `onRender`, but it remains accepted at runtime for self-driven use (see README example below). The `state` argument cobe passes to `onRender` is a mutable `Partial<COBEOptions>`-shaped object that you write into.

### Default option values (destructured in `src/index.js`)

These are the code-level defaults (distinct from the heavier demo values shown in the README):

```js
phi              = 0
theta            = 0
dark             = 0
diffuse          = 1
mapSamples       = 10000
mapBrightness    = 1
mapBaseBrightness= 0
baseColor        = [1, 1, 1]
markerColor      = [1, 0.5, 0]
glowColor        = [1, 1, 1]
opacity          = 1
offset           = [0, 0]
scale            = 1
devicePixelRatio = 1
// width / height are required (no default)
```

### Vertex shader (`src/globe.vert.glslx`, verbatim)

```glsl
export void vertex();

attribute vec2 aPosition;

void vertex() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
```

### Fragment shader (`src/globe.frag.glslx`, verbatim)

```glsl
export void fragment();

uniform vec2 uResolution;
uniform vec2 offset;
uniform vec2 rotation;        // (phi, theta)
uniform float dots;
uniform float scale;
uniform vec3 baseColor;
uniform vec3 glowColor;
uniform vec4 renderParams;    // (dotsBrightness, diffuse, dark, opacity)
uniform float mapBaseBrightness;
uniform sampler2D uTexture;

const float sqrt5 = 2.236068;
const float PI = 3.141593;
const float kTau = 6.283185;
const float kPhi = 1.618034;
const float r = 0.8;

float byDots;

mat3 rotate(float theta, float phi) {
  float cx = cos(theta);
  float cy = cos(phi);
  float sx = sin(theta);
  float sy = sin(phi);
  return mat3(
    cy, sy * sx, -sy * cx,
    0.0, cx, sx,
    sy, cy * -sx, cy * cx
  );
}

vec3 nearestFibonacciLattice(vec3 p, out float m) {
  p = p.xzy;

  float k = max(2.0, floor(log2(sqrt5 * dots * PI * (1.0 - p.z * p.z)) * 0.72021));

  vec2 f = floor(pow(kPhi, k) / sqrt5 * vec2(1.0, kPhi) + 0.5);
  vec2 br1 = fract((f + 1.0) * (kPhi - 1.0)) * kTau - 3.883222;
  vec2 br2 = -2.0 * f;
  vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);
  vec2 c = floor(vec2(br2.y * sp.x - br1.y * (sp.y * dots + 1.0), -br2.x * sp.x + br1.x * (sp.y * dots + 1.0)) / (br1.x * br2.y - br2.x * br1.y));

  float mindist = PI;
  vec3 minip;
  for (float s = 0.0; s < 4.0; s += 1.0) {
    vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));
    float idx = dot(f, c + o);
    if (idx > dots) continue;

    float a = idx, b = 0.0;
    if (a >= 16384.0) a -= 16384.0, b += 0.868872;
    if (a >= 8192.0) a -= 8192.0, b += 0.934436;
    if (a >= 4096.0) a -= 4096.0, b += 0.467218;
    if (a >= 2048.0) a -= 2048.0, b += 0.733609;
    if (a >= 1024.0) a -= 1024.0, b += 0.866804;
    if (a >= 512.0) a -= 512.0, b += 0.433402;
    if (a >= 256.0) a -= 256.0, b += 0.216701;
    if (a >= 128.0) a -= 128.0, b += 0.108351;
    if (a >= 64.0) a -= 64.0, b += 0.554175;
    if (a >= 32.0) a -= 32.0, b += 0.777088;
    if (a >= 16.0) a -= 16.0, b += 0.888544;
    if (a >= 8.0) a -= 8.0, b += 0.944272;
    if (a >= 4.0) a -= 4.0, b += 0.472136;
    if (a >= 2.0) a -= 2.0, b += 0.236068;
    if (a >= 1.0) a -= 1.0, b += 0.618034;

    float theta = fract(b) * kTau;

    float cosphi = 1.0 - 2.0 * idx * byDots;
    float sinphi = sqrt(1.0 - cosphi * cosphi);
    vec3 sample = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);

    float dist = length(p - sample);

    if (dist < mindist) {
      mindist = dist;
      minip = sample;
    }
  }

  m = mindist;
  return minip.xzy;
}

void fragment() {
  byDots = 1.0 / dots;

  vec2 invResolution = 1.0 / uResolution;

  vec2 uv = ((gl_FragCoord.xy * invResolution) * 2.0 - 1.0) / scale - offset * vec2(1.0, -1.0) * invResolution;
  uv.x *= uResolution.x * invResolution.y;

  float l = dot(uv, uv);
  float glowFactor = 0.0;

  vec4 color = vec4(0.0);

  if (l <= r*r) {
    float dis;
    vec4 layer = vec4(0.0);
    vec3 p = normalize(vec3(uv, sqrt(r*r - l)));
    mat3 rot = rotate(rotation.y, rotation.x);
    float dotNL = p.z;

    vec3 gP = nearestFibonacciLattice(p * rot, dis);

    float gPhi = asin(gP.y);
    float gTheta = acos(-gP.x / cos(gPhi));
    if (gP.z < 0.0) gTheta = -gTheta;

    float mapColor = max(texture2D(uTexture, vec2(((gTheta * 0.5) / PI), -(gPhi / PI + 0.5))).x, mapBaseBrightness);

    float sample = mapColor
      * smoothstep(0.008, 0.0, dis)
      * pow(dotNL, renderParams.y)
      * renderParams.x;
    layer += vec4(baseColor
      * (mix((1.0 - sample) * pow(dotNL, 0.4), sample, renderParams.z) + 0.1)
      + pow(1.0 - dotNL, 4.0) * glowColor
    , 1.0);

    color += layer * (1.0 + renderParams.w) * 0.5;

    glowFactor = (1.0 - l) * (1.0 - l) * smoothstep(0.0, 1.0, 0.2 / (l - r*r));
  } else {
    float outD = sqrt(0.2 / (l - r*r));
    glowFactor = smoothstep(0.5, 1.0, outD / (outD + 1.0));
  }

  gl_FragColor = color + vec4(glowFactor * glowColor, glowFactor);
}
```

**Uniform mapping note (from `index.js`):**
- `rotation = (phi, theta)` packs the two rotation params.
- `dots = mapSamples`.
- `renderParams = (mapBrightness, diffuse, dark, opacity)` - one packed vec4. `renderParams.x`=dotsBrightness/mapBrightness, `.y`=diffuse, `.z`=dark, `.w`=opacity.
- `uTexture` = the baked landmass texture (`texture.png`).

### Self-driven loop pattern (README, verbatim)

```js
let phi = 0
const globe = createGlobe(canvas, {
  // ... configuration
  onRender: (state) => {
    state.phi = phi
    phi += 0.01
  },
})
```

README on `onRender`: "Called on every animation frame. `state` will be an empty object, return updated params." cobe's internal RAF calls this each frame and re-renders.

---

## Proposed manifest

```jsonc
{
  "id": "cobe-globe",
  "name": "Globe (cobe)",
  "category": "object-3d",
  "layerRole": "midground",
  "origin": "shuding/cobe (npm: cobe)",
  "license": "MIT",
  "attribution": "Shu Ding (github.com/shuding/cobe)",
  "redistribution": "ok",
  "requiredAssets": ["landmassTexture"],   // src/texture.png - equirectangular dot-map
  "tags": ["webgl", "globe", "sphere", "dots", "fibonacci-lattice", "markers", "glow"]
}
```

Params (mapped from `COBEOptions`):

| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| phi | range | 0 | 0 | 6.283 | longitude rotation (radians); animate for spin |
| theta | range | 0 | -1.57 | 1.57 | latitude tilt (radians) |
| mapSamples | range | 10000 | 1000 | 64000 | dot count -> `dots` uniform |
| mapBrightness | range | 1 | 0 | 12 | dot brightness -> `renderParams.x` |
| mapBaseBrightness | range | 0 | 0 | 1 | floor brightness for unlit dots |
| diffuse | range | 1 | 0 | 4 | lighting falloff -> `renderParams.y` |
| dark | range | 0 | 0 | 1 | dark/inverted mix -> `renderParams.z` |
| opacity | range | 1 | 0 | 1 | -> `renderParams.w` |
| scale | range | 1 | 0.1 | 4 | globe size in viewport |
| offset | (x,y) | [0,0] | - | - | pixel offset of center |
| baseColor | color | [1,1,1] | - | - | dot color (RGB 0-1, NOT hex) |
| markerColor | color | [1,0.5,0] | - | - | marker color |
| glowColor | color | [1,1,1] | - | - | atmosphere glow color |
| markers | (custom) | [] | - | - | array of `{location:[lat,lng], size}` |
| dark | range | 0 | 0 | 1 | (see above) |
| devicePixelRatio | range | 1 | 1 | 3 | set to window DPR |

> Color params are `[r,g,b]` floats in 0..1, not CSS hex. tilt-lab's `color` param UI must convert hex -> normalized RGB triplet before passing to cobe.

---

## Integration notes / gotchas

1. **cobe owns its RAF in v1 via `onRender`** - this is the central adaptation challenge. tilt-lab drives `frame(t)` externally. Two clean paths:
   - **Preferred: use v2 and `globe.update({ phi, theta, ... })`.** v2 exposes `update()` which renders a single pass with new params and has NO internal loop dependency, so tilt-lab can call it from its own `frame(t)`.
   - **If pinned to v1**: cobe's internal RAF is unavoidable; the only per-frame hook is `onRender`. To externally drive you would have to fork `index.js` to (a) skip the internal `requestAnimationFrame` self-schedule and (b) expose the internal render function. Flag this for acquisition if v1 must be used.
2. **Required asset: landmass texture (`texture.png`).** The dot map comes from a baked equirectangular texture sampled in `uTexture`. tilt-lab must ship this image as a `requiredAsset`. Without it the globe renders no continents.
3. **GLSLX, not raw GLSL.** Shaders are `.glslx` (Evan Wallace's GLSLX) and compiled to GLSL1 at build. For a verbatim port either run the glslx compiler or capture the compiled GLSL from `dist/`. The `export void fragment();` / `void fragment()` syntax is GLSLX, not valid GLSL as-is.
4. **WebGL1.** Uses `texture2D`, `gl_FragColor`, `attribute`. Fine broadly, but if tilt-lab standardizes on WebGL2 the shaders need a port (`texture()`, `out`, `in`).
5. **Markers / arcs are separate passes.** `marker.glslx` (and v2 `arc.glslx`) run instanced draws after the globe pass. Not captured here (out of primary scope) - acquisition should pull them if markers/arcs are needed. The base globe works without them.
6. **devicePixelRatio + width/height.** `width`/`height` are required (no defaults) and are multiplied by `devicePixelRatio` for the backing store. Pass real DPR and CSS size.
7. **Pointer interaction is app-side, not built in.** The classic cobe demo adds drag-to-spin by mutating `phi` from pointer deltas in `onRender`. That input handling lives in app code, not the library - tilt-lab would wire pointer deltas into the `phi`/`theta` params.

---

## Normalization sketch (-> Effect contract)

Target cobe v2 (`update()`-driven). The globe is a midground object, so init creates its own canvas/context but tilt-lab supplies the externally-driven clock.

- **`init(canvas, { params, assets })`**
  - Call `createGlobe(canvas, { ...defaults, ...params, width, height, devicePixelRatio, /* no onRender */ })`. Store the returned `Globe` handle.
  - The landmass texture is internal to cobe (bundled), but if tilt-lab swaps it, pass `assets.landmassTexture` through a forked texture loader.
  - Keep local `phi`, `theta` state seeded from params. Do NOT rely on cobe's internal loop.
- **`frame(t)`**
  - Compute rotation from the external clock: `phi = basePhi + t_seconds * spinSpeed` (apply a `speed`/`autoRotate` param). Then `globe.update({ phi, theta })`. This renders exactly one pass per host frame - no internal RAF.
  - (v1 fallback: would require a fork to expose render; see gotcha 1.)
- **`resize(w, h)`**
  - `globe.update({ width: w, height: h, devicePixelRatio: dpr })`. cobe re-sizes the canvas/viewport and recomputes `uResolution`.
- **`setParam(key, value)`**
  - Map directly to `globe.update({ [key]: value })`. Colors: convert hex -> `[r,g,b]` 0..1 before passing. `markers`: pass the array through. Numeric params pass straight.
- **`dispose()`**
  - Call `globe.destroy()` (releases WebGL resources). Drop the handle and any pointer listeners tilt-lab attached.

**Loop adaptation summary:** v1 cobe self-schedules a RAF and only hands you `onRender(state)` to mutate params; that fights tilt-lab's external `frame(t)`. v2's `update(partialState)` is a single synchronous render with no internal scheduling - it maps 1:1 onto `frame(t)` and `setParam`/`resize`. Prefer v2; if v1 is mandatory, fork `index.js` to suppress the internal `requestAnimationFrame` and expose the render call.
