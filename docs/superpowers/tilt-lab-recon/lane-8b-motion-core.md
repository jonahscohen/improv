# Lane 8b - motion-core (6 effects)

Recon by Jonah (recon-b). Six WebGL effects from Motion Core's `canvas` category: `interactive-grid`, `lava-lamp`, `neural-noise`, `plasma-grid`, `specular-band`, `water-ripple`.

## Shared facts (apply to all 6)

- **Site/docs:** https://motion-core.dev/docs/<slug> (e.g. /docs/lava-lamp). "Curated Motion Core Svelte components."
- **Install:** `npx @motion-core/cli add <slug>` (the CLI is a compiled Rust binary; copy-paste-into-your-repo model, like shadcn). The docs pages only show usage snippets, NOT the shader source.
- **Real source:** GitHub `motion-core/motion-core` (branch `master`), under `packages/motion-core/src/lib/components/<slug>/`. Each effect ships three files: `<Name>.svelte` (wrapper: props, defaults, pointer tracking, container), `<Name>Scene.svelte` (the OGL/WebGL renderer + GLSL), and `component.json` (manifest with deps + file list). Raw base: `https://raw.githubusercontent.com/motion-core/motion-core/master/packages/motion-core/src/lib/components/`
- **Tech:** all six use **OGL `^1.0.11`** (minimal WebGL lib by Nathan Gordon) - `Renderer`, `Camera`, `Transform`, `Triangle` (full-screen), `Program`, `Mesh`, `Texture`, plus `Plane`/`RenderTarget` for water-ripple. Framework is **Svelte 5 runes** (`$props`, `$state`, `$effect`, `onMount`). Shaders are **WebGL1-style GLSL** (`attribute`/`varying`/`gl_FragColor`/`texture2D`), all sharing the same trivial full-screen-quad vertex shader.
- **Common render loop:** every Scene owns its own `requestAnimationFrame` `tick(now)` that (a) resizes the backing store to `clientWidth/Height * dpr`, (b) accumulates `uTime += delta * speed`, (c) calls `renderer.render({ scene, camera })`. This is the RAF that must be replaced by tilt-lab's externally-driven `frame(t)` (see "Normalization, shared pattern" at the end).
- **Color handling:** effects with color props import `toLinearRgb` from `helpers/color.ts` (captured below). Hex/CSS/number/array/`{r,g,b}` all accepted; converted to linear-space `[r,g,b]` 0..1 and uploaded as `Vec3`. The shaders that go through linear space convert back via an inline `linearToSrgb()` at the end (lava-lamp, plasma-grid, specular-band).
- **License:** repo license is **MIT** (GitHub license API `spdx_id: MIT`). Per the recon brief, **redistribution posture = `personal-only`** for motion-core regardless; recorded honestly as MIT-licensed-but-treat-as-personal-only. Attribution: Motion Core (github.com/motion-core/motion-core).

### Shared color helper (`helpers/color.ts`, verbatim core)
```ts
export const srgbToLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

export const normalizeTriplet = (r, g, b): [number, number, number] => {
  const scale = Math.max(r, g, b) > 1 ? 255 : 1;
  return [clamp01(r / scale), clamp01(g / scale), clamp01(b / scale)];
};
// parseHexColor (#rgb/#rgba/#rrggbb/#rrggbbaa), parseCssColor (canvas 2d fillStyle trick),
// toRgb(value, fallback) handles number(0xRRGGBB) | string | [r,g,b] | {r,g,b}
export const toLinearRgb = (value, fallback): [number, number, number] => {
  const [r, g, b] = toRgb(value, fallback);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
};
```
For tilt-lab a `color` param can pass a hex string straight through `toLinearRgb` to get the `Vec3` the shaders want.

### Shared vertex shader (identical in all 6, full-screen quad via OGL `Triangle`)
```glsl
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
```
(water-ripple additionally uses a second `brushVertexShader` with model/projection matrices for its `Plane` brush meshes - see effect 6.)

---

## Effect 1: interactive-grid

- **layerRole:** `midground` (it distorts a supplied IMAGE in response to the cursor; it is content-bearing, not a full-bleed ambient background). Could be used as `background` if the image is a backdrop, but it is fundamentally an image-distortion layer needing an `<img>` asset + pointer.
- **category:** image-distortion / pointer
- **Tech:** OGL. A CPU-side `grid x grid` RGBA32F (or RGBA fallback) "data texture" stores per-cell velocity; the cursor injects velocity into nearby cells each frame, cells relax back by `relaxation`. The fragment shader displaces the image UV by the data texture's rg.

Fragment shader (verbatim):
```glsl
precision highp float;
uniform float time;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
varying vec2 vUv;

vec2 getCoverUV(vec2 uv, vec2 textureSize) {
  vec2 s = uResolution / textureSize;
  float scale = max(s.x, s.y);
  vec2 scaledSize = textureSize * scale;
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  vec2 coverUv = getCoverUV(vUv, uTextureSize);
  vec4 data = texture2D(uDataTexture, vUv);
  vec2 displacedUV = coverUv - 0.02 * data.rg;
  vec4 color = texture2D(uTexture, displacedUV);
  gl_FragColor = color;
}
```

CPU per-frame data-texture update (the heart of the physics, verbatim from `tick`):
```js
const gridMouseX = gridSize * mouseX;
const gridMouseY = gridSize * (1 - mouseY);
const maxDist = gridSize * mouseSize;
const aspect = width > 0 ? height / width : 1;
const maxDistSq = maxDist * maxDist;
for (let i = 0; i < gridSize; i++) {
  for (let j = 0; j < gridSize; j++) {
    const distance = ((gridMouseX - i) ** 2) / aspect + (gridMouseY - j) ** 2;
    if (distance < maxDistSq) {
      const index = 4 * (i + gridSize * j);
      let power = maxDist / Math.sqrt(distance);
      if (!Number.isFinite(power) || power > 10) power = 10;
      data[index]     += strength * 100 * currentVX * power;
      data[index + 1] -= strength * 100 * currentVY * power;
    }
    const idx = 4 * (i + gridSize * j);
    data[idx]     *= relaxation;
    data[idx + 1] *= relaxation;
  }
}
currentVX *= 0.9; currentVY *= 0.9;
gridState.texture.needsUpdate = true;
```
Wrapper computes `mouseX/mouseY` as normalized 0..1 from `onmousemove`; `currentVX/VY` are mouse velocity (delta per frame).

**Manifest:**
```
id: motion-core-interactive-grid
name: Interactive Grid
category: image-distortion
layerRole: midground
requiredAssets: [image]   // user-supplied image URL (must be CORS-enabled; img.crossOrigin='anonymous')
dependencies: ogl@^1.0.11 (+ utils/cn.ts)
origin: https://motion-core.dev/docs/interactive-grid
license: MIT (treat redistribution: personal-only per brief)
attribution: Motion Core
tags: [webgl, ogl, image, distortion, pointer, grid, physics, data-texture]
```
| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| image | (asset) | (required) | - | - | image URL, CORS-enabled |
| grid | range | 15 | 1 | 100 | cells per row/col (`Math.round`, min 1); changing rebuilds data texture |
| mouseSize | range | 0.15 | 0 | 1 | cursor influence radius (fraction of grid) |
| strength | range | 0.35 | 0 | 2 | distortion strength |
| relaxation | range | 0.9 | 0 | 0.99 | per-frame return-to-rest factor |
| mouseX/mouseY | (pointer) | 0 | 0 | 1 | normalized cursor, fed by wrapper |

**Gotchas:** needs RGBA32F float textures (WebGL2) - falls back to RGBA on WebGL1, may lose precision. Requires a CORS-enabled image or the texture stays black. The physics is CPU-side and O(grid^2) per frame - keep `grid` modest. Pointer is required for any motion.

---

## Effect 2: lava-lamp

- **layerRole:** `background` (full-bleed raymarched metaballs; transparent outside the blobs so it can also layer, but it is an ambient backdrop).
- **category:** raymarch / SDF
- **Tech:** OGL full-screen quad; fragment shader raymarches 6 rotating sphere SDFs blended with a polynomial smooth-min (metaballs), shaded with a fresnel rim. Linear-space colors -> `linearToSrgb`.

Fragment shader (verbatim):
```glsl
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec4 uResolution;
uniform vec3 uColor;
uniform vec3 uFresnelColor;
uniform float uFresnelPower;
uniform float uRadius;
uniform float uSmoothness;

float PI = 3.141592653589793238;

mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle); float c = cos(angle); float oc = 1.0 - c;
  return mat4(oc*axis.x*axis.x+c,        oc*axis.x*axis.y-axis.z*s, oc*axis.z*axis.x+axis.y*s, 0.0,
              oc*axis.x*axis.y+axis.z*s, oc*axis.y*axis.y+c,        oc*axis.y*axis.z-axis.x*s, 0.0,
              oc*axis.z*axis.x-axis.y*s, oc*axis.y*axis.z+axis.x*s, oc*axis.z*axis.z+c,        0.0,
              0.0, 0.0, 0.0, 1.0);
}
vec3 rotate(vec3 v, vec3 axis, float angle) {
  mat4 m = rotationMatrix(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}
float smin(float a, float b, float k) {
  k *= 6.0; float h = max(k-abs(a-b), 0.0)/k;
  return min(a,b) - h*h*h*k*(1.0/6.0);
}
float sphereSDF(vec3 p, float r) { return length(p) - r; }
float sdf(vec3 p) {
  vec3 p1 = rotate(p, vec3(0.0, 0.0, 1.0), uTime/5.0);
  vec3 p2 = rotate(p, vec3(1.), -uTime/5.0);
  vec3 p3 = rotate(p, vec3(1., 1., 0.), -uTime/4.5);
  vec3 p4 = rotate(p, vec3(0., 1., 0.), -uTime/4.0);
  float r = uRadius;
  float final = sphereSDF(p1 - vec3(-0.5, 0.0, 0.0), 0.35 * r);
  float nextSphere = sphereSDF(p2 - vec3(0.55, 0.0, 0.0), 0.3 * r);
  final = smin(final, nextSphere, uSmoothness);
  nextSphere = sphereSDF(p2 - vec3(-0.8, 0.0, 0.0), 0.2 * r);
  final = smin(final, nextSphere, uSmoothness);
  nextSphere = sphereSDF(p3 - vec3(1.0, 0.0, 0.0), 0.15 * r);
  final = smin(final, nextSphere, uSmoothness);
  nextSphere = sphereSDF(p4 - vec3(0.45, -0.45, 0.0), 0.15 * r);
  final = smin(final, nextSphere, uSmoothness);
  return final;
}
vec3 getNormal(vec3 p) {
  float d = 0.001;
  return normalize(vec3(
    sdf(p + vec3(d,0,0)) - sdf(p - vec3(d,0,0)),
    sdf(p + vec3(0,d,0)) - sdf(p - vec3(0,d,0)),
    sdf(p + vec3(0,0,d)) - sdf(p - vec3(0,0,d))));
}
float rayMarch(vec3 rayOrigin, vec3 ray) {
  float t = 0.0;
  for (int i = 0; i < 100; i++) {
    vec3 p = rayOrigin + ray * t;
    float d = sdf(p);
    if (d < 0.001) return t;
    t += d;
    if (t > 100.0) break;
  }
  return -1.0;
}
vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0/2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}
void main() {
  vec3 cameraPos = vec3(0.0, 0.0, 5.0);
  vec3 ray = normalize(vec3((vUv - vec2(0.5)) * uResolution.zw, -1));
  float t = rayMarch(cameraPos, ray);
  if (t > 0.0) {
    vec3 p = cameraPos + ray * t;
    vec3 normal = getNormal(p);
    float fresnel = pow(1.0 + dot(ray, normal), uFresnelPower);
    vec3 color = mix(uColor, uFresnelColor, fresnel);
    gl_FragColor = vec4(linearToSrgb(color), 1.0);
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
}
```
`uResolution.zw` carry an aspect-correction pair `(a1, a2)` computed on resize (not just w/h): if `h/w > 1` then `a1=(w/h), a2=1` else `a1=1, a2=h/w`. `uTime` accumulates `delta * speed`.

**Manifest + params:**
```
id: motion-core-lava-lamp   layerRole: background   category: raymarch
requiredAssets: []   dependencies: ogl@^1.0.11 (+ utils/cn.ts, helpers/color.ts)
license: MIT (personal-only per brief)   attribution: Motion Core
tags: [webgl, ogl, raymarch, sdf, metaball, fresnel, background]
```
| param | type | default | min | max | uniform |
|---|---|---|---|---|---|
| color | color | #17181A | - | - | uColor (linear Vec3) |
| fresnelColor | color | #ff6900 | - | - | uFresnelColor |
| speed | range | 1.0 | 0 | 4 | scales uTime accumulation |
| fresnelPower | range | 3.0 | 0 | 8 | uFresnelPower |
| radius | range | 1 | 0.1 | 3 | uRadius (blob size) |
| smoothness | range | 0.1 | 0 | 0.5 | uSmoothness (metaball blend) |

**Gotchas:** 100-step raymarch loop per fragment - heaviest of the six; cap DPR on large/retina canvases. Background is transparent where rays miss the blobs (`alpha:0`), good for layering. Fixed camera at z=5.

---

## Effect 3: neural-noise

- **layerRole:** `background` (full-bleed generative pattern, opaque output `alpha=1`). Max 1 per stack as a background.
- **category:** generative / CPPN
- **Tech:** OGL full-screen quad. The fragment shader is a hardcoded **Compositional Pattern Producing Network (CPPN)** - a fixed multi-layer matrix/sigmoid network evaluated per pixel, with three time-driven sinusoidal inputs. Only uniforms are `uTime` and `uResolution`; the network weights are baked constants. No color params.

Fragment shader (verbatim, weight matrices abbreviated with a marker - the full constants are large but MUST be copied byte-for-byte from source):
```glsl
#ifdef GL_ES
precision highp float;
#endif
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

vec4 buf[8];
vec4 sigmoid(vec4 x) { return 1. / (1. + exp(-x)); }

vec4 cppn_fn(vec2 coordinate, float in0, float in1, float in2) {
  buf[6] = vec4(coordinate.x, coordinate.y, 0.394833 + in0, 0.36 + in1);
  buf[7] = vec4(0.14 + in2, sqrt(coordinate.x*coordinate.x + coordinate.y*coordinate.y), 0., 0.);
  // buf[0] = mat4(...) * buf[6] + mat4(...) * buf[7] + vec4(...);  // layer 1
  // buf[1] = mat4(...) * buf[6] + mat4(...) * buf[7] + vec4(...);
  // buf[0] = sigmoid(buf[0]); buf[1] = sigmoid(buf[1]);
  // ... layers 2-3 (buf[2],buf[3]) ... sigmoid ...
  // ... layers 4-5 (buf[4],buf[5]) mixing buf[0..3] ... sigmoid ...
  // ... layers 6-7 (buf[6],buf[7]) mixing buf[0..5] ... sigmoid ...
  // final: buf[0] = mat4(...)*buf[0] + ... + mat4(...)*buf[7] + vec4(...); buf[0]=sigmoid(buf[0]);
  return vec4(buf[0].xyz, 1.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.y *= -1.0;
  vec4 color = cppn_fn(uv, 0.1 * sin(0.3 * uTime), 0.1 * sin(0.69 * uTime), 0.1 * sin(0.44 * uTime));
  gl_FragColor = vec4(color.rgb, 1.0);
}
```
> NOTE: the eight matrix layers in `cppn_fn` contain ~50 hardcoded `mat4(...)` weight blocks (the shader file is 11.4 KB, lines 54-74 of `NeuralNoiseScene.svelte`). They are deterministic constants and define the entire look; copy them verbatim from the source file when porting - do NOT regenerate. Full source: raw GitHub `.../neural-noise/NeuralNoiseScene.svelte`.

**Manifest + params:**
```
id: motion-core-neural-noise   layerRole: background   category: generative
requiredAssets: []   dependencies: ogl@^1.0.11 (+ utils/cn.ts)
license: MIT (personal-only per brief)   attribution: Motion Core
tags: [webgl, ogl, cppn, generative, neural, organic, background]
```
| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| speed | range | 1.0 | 0 | 4 | scales uTime accumulation; the only param |

**Gotchas:** colors are emergent from the baked network - NOT configurable via params (no color uniforms). The CPPN evaluates a dense matrix net per pixel; moderately heavy. `#ifdef GL_ES` guard present. Output is fully opaque.

---

## Effect 4: plasma-grid

- **layerRole:** `background` (full-bleed; output alpha is gated by a checkerboard `grid` mask so it reads as a pixelated plasma-on-grid backdrop, partly transparent).
- **category:** generative noise
- **Tech:** OGL full-screen quad; value-noise plasma with domain warping, masked by a 2px checkerboard grid; two color params (base + highlight) in linear space, `linearToSrgb` out. `uTime` accumulates `delta * 0.5` (speed is fixed at 0.5 in the loop, not a prop).

Fragment shader (verbatim):
```glsl
precision highp float;
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
vec3 linearToSrgb(vec3 color) { /* same as lava-lamp */ }
void main() {
  vec4 fragColor;
  vec2 fragCoord = vUv * uResolution.xy;
  mainImage(fragColor, fragCoord);
  fragColor.rgb = linearToSrgb(fragColor.rgb);
  gl_FragColor = fragColor;
}
```

**Manifest + params:**
```
id: motion-core-plasma-grid   layerRole: background   category: generative
requiredAssets: []   dependencies: ogl@^1.0.11 (+ utils/cn.ts, helpers/color.ts)
license: MIT (personal-only per brief)   attribution: Motion Core
tags: [webgl, ogl, plasma, noise, grid, pixelated, background]
```
| param | type | default | min | max | uniform |
|---|---|---|---|---|---|
| color | color | #17181A | - | - | uBaseColor (linear) |
| highlightColor | color | #FF6900 | - | - | uGradientColor (linear) |
| (speed) | (hardcoded) | 0.5 | - | - | loop uses `delta * 0.5`; expose as a param when porting if speed control is wanted |

**Gotchas:** `uResolution` is a `Vec3` here (w,h,1). The 2px checkerboard makes alpha 1 on even cells, 0 on odd - so the "background" is half-transparent in a grid pattern; place over a solid backdrop. No speed prop (fixed 0.5).

---

## Effect 5: specular-band

- **layerRole:** `background` (full-bleed procedural light bands over a background color; opaque output).
- **category:** generative
- **Tech:** OGL full-screen quad; 3-band specular field with hue-shifted palette, lens distortion (`u /= 0.5 + distortion*dot(u,u)`), and an adaptive blend against the background color. Linear in, `linearToSrgb` out.

Fragment shader (verbatim):
```glsl
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uSpeed;
uniform float uDistortion;
uniform float uHueShift;
uniform float uIntensity;

mat3 hueRot(float a) {
  float c = cos(a), s = sin(a), t = 1.0 - c;
  return mat3(
  t*.333+c,      t*.333-s*.577, t*.333+s*.577,
  t*.333+s*.577, t*.333+c,      t*.333-s*.577,
  t*.333-s*.577, t*.333+s*.577, t*.333+c);
}
float colorLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 hueFromColor(vec3 c, vec3 fallback) {
  float m = max(max(c.r, c.g), c.b);
  if (m < 1e-5) return fallback;
  return clamp(c / m, 0.0, 1.0);
}
vec3 blendAdaptive(vec3 bg, vec3 effect, float softness) {
  float bgLum = colorLuma(bg);
  float lightBg = smoothstep(0.45, 0.95, bgLum);
  float edge = clamp(softness, 0.0, 1.0);
  vec3 additive = bg + effect;
  vec3 effectHue = hueFromColor(effect, vec3(1.0));
  vec3 tintTarget = mix(bg, effectHue, 0.9);
  vec3 tint = mix(bg, tintTarget, edge);
  return mix(additive, tint, lightBg);
}
vec3 linearToSrgb(vec3 color) { /* same as lava-lamp */ }
void mainImage(out vec4 o, vec2 uv) {
  vec2 u = (uv * 2.0 - 1.0);
  u.x *= uResolution.x / uResolution.y;
  float time = uTime * uSpeed;
  u /= 0.5 + uDistortion * dot(u, u);
  u += 0.2 * cos(time) - 7.56;
  vec3 baseColor = uColor;
  vec3 palette[3];
  palette[0] = baseColor;
  palette[1] = hueRot(radians(uHueShift)) * baseColor;
  palette[2] = hueRot(radians(-uHueShift)) * baseColor;
  vec3 col = vec3(0.0);
  float edgeField = 0.0;
  for(int i = 0; i < 3; i++) {
    vec2 uv_loop = sin(1.5 * u.yx + 2.0 * cos(u -= 0.01));
    float val = 1.0 - exp(-6.0 / exp(6.0 * length(uv_loop + sin(5.0 * uv_loop.y - 3.0 * time) / 4.0)));
    val = pow(clamp(val, 0.0, 1.0), 1.4);
    edgeField += val;
    col += val * palette[i];
  }
  vec3 bands = col * uIntensity;
  float softMask = 1.0 - exp(-0.85 * edgeField * uIntensity);
  vec3 rgb = blendAdaptive(uBackgroundColor, bands, softMask);
  o = vec4(rgb, 1.0);
}
void main() {
  vec4 fragColor;
  mainImage(fragColor, vUv);
  fragColor.rgb = linearToSrgb(fragColor.rgb);
  gl_FragColor = fragColor;
}
```

**Manifest + params:**
```
id: motion-core-specular-band   layerRole: background   category: generative
requiredAssets: []   dependencies: ogl@^1.0.11 (+ utils/cn.ts, helpers/color.ts)
license: MIT (personal-only per brief)   attribution: Motion Core   introducedAt: 2026-03-18
tags: [webgl, ogl, specular, bands, hue-shift, lens-distortion, background]
```
| param | type | default | min | max | uniform |
|---|---|---|---|---|---|
| color | color | #FF6900 | - | - | uColor (linear) |
| backgroundColor | color | #17181A | - | - | uBackgroundColor |
| speed | range | 1.0 | 0 | 4 | uSpeed |
| distortion | range | 0.2 | 0 | 1 | uDistortion (lens) |
| hueShift | range (deg) | 30.0 | 0 | 180 | uHueShift |
| intensity | range | 1.0 | 0 | 3 | uIntensity |

**Gotchas:** the `u -= 0.01` mutation happens inside the loop's `cos(u -= ...)` - keep verbatim, it is intentional per-iteration drift. Output opaque (alpha 1) so it is a true background. `blendAdaptive` switches between additive (dark bg) and tint (light bg) based on bg luma.

---

## Effect 6: water-ripple

- **layerRole:** `post`-ish / `midground`. It distorts a supplied IMAGE via a ping-pong displacement render target driven by pointer movement. It transforms an underlying image, but it owns the image itself (samples `uTexture`), so it is closest to a **midground image-distortion** layer requiring an `<img>` + pointer; if pointed at a snapshot of the scene below it, it behaves like a `post` effect. Classify `midground` (image-bearing) by default; note `post` adaptability.
- **category:** image-distortion / pointer
- **Tech:** OGL with a **`RenderTarget`** (offscreen displacement buffer). Up to 100 pooled rotating brush `Plane` meshes (additive blend) are stamped at the cursor into the displacement target; they decay/grow over time. The main full-screen pass reads `uDisplacement` and offsets the image UV along a per-pixel direction. **Requires a brush PNG asset** (`assets/water-ripple-brush.png`).

Main fragment shader (verbatim):
```glsl
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
varying vec2 vUv;
const float PI = 3.141592653589793238;
vec2 getCoverUV(vec2 uv, vec2 textureSize) {
  vec2 safeTexture = max(textureSize, vec2(1.0));
  vec2 s = uResolution / safeTexture;
  float scale = max(s.x, s.y);
  vec2 scaledSize = safeTexture * scale;
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}
void main() {
  vec2 coverUv = getCoverUV(vUv, uTextureSize);
  vec4 displacement = texture2D(uDisplacement, vUv);
  float theta = displacement.r * 2.0 * PI;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 finalUv = coverUv + dir * displacement.r * 0.05;
  gl_FragColor = texture2D(uTexture, finalUv);
}
```
Brush vertex + fragment shaders (verbatim):
```glsl
// brushVertexShader
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
// brushFragmentShader
precision highp float;
uniform sampler2D uBrush;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 tex = texture2D(uBrush, vUv);
  gl_FragColor = vec4(tex.rgb * uOpacity, tex.a * uOpacity);
}
```
Per-frame: pointer movement (>4px) advances a ring buffer of 100 waves, stamping a new brush at cursor (centered coords, y-up). Each visible wave rotates (`rotation.z += 0.02 * timeScale`), decays opacity (`*= 0.96^timeScale` then `*= 0.99^timeScale`), and grows (`scaleX = 0.982*scaleX + 0.108`). Two-pass render: brushScene -> displacementTarget (additive `SRC_ALPHA, ONE`), then main scene reads it.

**Manifest + params:**
```
id: motion-core-water-ripple   layerRole: midground (post-capable)   category: image-distortion
requiredAssets: [image, water-ripple-brush.png]
dependencies: ogl@^1.0.11 (+ utils/cn.ts, assets/water-ripple-brush.png)
license: MIT (personal-only per brief)   attribution: Motion Core
tags: [webgl, ogl, ripple, displacement, render-target, pointer, image]
```
| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| image | (asset) | (required) | - | - | image URL, CORS-enabled |
| brushSize | range | 100 | 1 | 400 | brush plane px size (rebuilds geometry sizing) |
| (MAX_WAVES) | const | 100 | - | - | pooled wave count (not a prop) |

**Gotchas:** needs TWO assets (the user image AND the bundled brush PNG) - ship `water-ripple-brush.png`. Uses a `RenderTarget` (ping-pong); `dispose` must free framebuffer + renderbuffers + textures (the source has a `disposeTarget` helper, capture it). Pointer-driven only (no idle animation beyond decay). Brush meshes use additive blending. `brushSize` change updates `brushPixelSize` but the existing `Plane` geometry is created once at mount - changing it scales via mesh.scale, not geometry rebuild.

---

## License + attribution (all 6)
- **License:** MIT (repo `motion-core/motion-core`, GitHub license API `spdx_id: MIT`).
- **Attribution:** Motion Core (https://github.com/motion-core/motion-core, https://motion-core.dev).
- **redistribution:** `personal-only` (per recon brief posture for motion-core). The underlying MIT grant would technically permit redistribution with notice, but we honor the brief's conservative posture - flag for the acquisition phase if broader redistribution is wanted (it likely is permissible given MIT, but confirm there is a LICENSE file in the repo root before relying on it).
- **Runtime dep:** OGL `^1.0.11` (MIT, Nathan Gordon / oframe) - tilt-lab will need OGL available, or port the OGL calls to raw WebGL.

## Integration notes / gotchas (shared)
- **OGL dependency.** All six are written against OGL's `Renderer/Program/Mesh/Triangle/Texture` API. Either bundle OGL (~tiny, MIT) or rewrite the ~30 lines of OGL setup per effect to raw WebGL. The GLSL itself is portable WebGL1.
- **Svelte 5 runes.** The captured files are `.svelte` with `$props/$state/$effect`. For a framework-agnostic tilt-lab runtime, lift the GLSL strings + the `onMount` body (renderer setup + `tick`) into a plain TS class; drop the Svelte reactivity and feed params via `setParam`.
- **devicePixelRatio.** Every Scene sets `dpr = window.devicePixelRatio` and sizes the backing store to `clientW/H * dpr` inside `tick`, with `renderer.state.viewport = {width:null,height:null}` (OGL auto-viewport). Preserve in `resize`.
- **Self-owned RAF (the key adaptation).** Each `tick(now)` calls `requestAnimationFrame(tick)`. Must be removed for tilt-lab's externally-driven `frame(t)`.
- **Two effects need a user image (interactive-grid, water-ripple)** with `img.crossOrigin = "anonymous"` - CORS required or texture stays black. water-ripple also needs the bundled brush PNG.
- **Transparency varies:** lava-lamp/interactive-grid clear to `alpha:0` and miss = transparent; neural-noise/specular-band output `alpha:1` (opaque); plasma-grid alpha is a checkerboard mask. This affects layerRole/compositing.

## Normalization sketch (shared pattern -> Effect contract)
The five non-pointer-idle effects (lava-lamp, neural-noise, plasma-grid, specular-band; interactive-grid/water-ripple add pointer) map identically:

```ts
class MotionCoreEffect implements Effect {
  // holds: renderer, gl, scene, camera, program, mesh, uniforms, params
  init(canvas, { params, assets }) {
    this.renderer = new Renderer({ canvas, alpha: true, dpr: window.devicePixelRatio || 1 });
    const gl = this.renderer.gl; gl.clearColor(0,0,0,0);
    this.camera = new Camera(gl); this.camera.position.z = 1;
    this.scene = new Transform();
    const geometry = new Triangle(gl);
    this.uniforms = { uTime: { value: 0 }, uResolution: { value: new Vec2(1,1) }, /* + per-effect */ };
    // colors: this.uniforms.uColor.value = new Vec3(...toLinearRgb(params.color, fallback))
    this.program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms: this.uniforms, transparent: true });
    new Mesh(gl, { geometry, program: this.program }).setParent(this.scene);
    this.speed = params.speed ?? 1;
  }

  frame(t) {
    // externally driven: set uTime from host clock instead of accumulating in a self-RAF
    this.uniforms.uTime.value = (t / 1000) * this.speed;   // (interactive-grid/water-ripple also step their CPU sim here using a host-provided dt)
    this.renderer.render({ scene: this.scene, camera: this.camera });
    // NO requestAnimationFrame.
  }

  resize(w, h) {
    this.renderer.width = w; this.renderer.height = h;
    this.renderer.state.viewport = { x:0, y:0, width:null, height:null };
    // lava-lamp: uResolution = Vec4(w,h,a1,a2) with aspect calc; plasma-grid: Vec3(w,h,1); others Vec2(w,h)
    this.uniforms.uResolution.value.set(w, h /*, ...*/);
    // water-ripple: also resize displacementTarget + brushCamera ortho bounds
  }

  setParam(key, value) {
    if (key === 'speed') { this.speed = value; return; }
    if (isColor(key)) { const [r,g,b] = toLinearRgb(value, fb); this.uniforms[map[key]].value.set(r,g,b); return; }
    this.uniforms[map[key]].value = value;
  }

  dispose() {
    // remove RAF (none in our model); programs/geometry .remove(); delete textures;
    // water-ripple: disposeTarget(gl, displacementTarget) + remove pointermove listener;
    // interactive-grid: delete data + image textures.
  }
}
```
Per-effect deltas from the shared pattern:
- **time:** neural-noise/lava-lamp/specular-band/interactive-grid use `uTime += delta * speed`; plasma-grid uses fixed `delta * 0.5`. For `frame(t)`, set `uTime = (t/1000)*speed` (or `*0.5` for plasma-grid). interactive-grid keeps a `time` uniform but it is unused by its shader.
- **CPU sim (interactive-grid, water-ripple):** these need a per-frame delta (`dt`) AND pointer state. In `frame(t)` compute `dt = t - lastT` and run the grid-velocity update / wave decay loop with it, then render. Pointer must be wired through `setParam('mouseX'|'mouseY', ...)` or a dedicated pointer hook.
- **water-ripple two-pass:** `frame` must render the brushScene into `displacementTarget` first, then the main scene - keep both `renderer.render(...)` calls.
- **pointer effects** (interactive-grid, water-ripple) need tilt-lab to forward pointer events; they will not animate from `t` alone (interactive-grid is fully static without cursor velocity; water-ripple only shows decaying ripples after pointer input).
