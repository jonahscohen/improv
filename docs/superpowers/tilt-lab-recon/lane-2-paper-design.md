# Lane 2 - paper.design: grain-gradient + neuro-noise

Recon by Jonah (recon-e). RECON ONLY. Two WebGL fragment-shader background effects from the `@paper-design/shaders` library.

## Summary

Both effects are full-bleed WebGL fragment shaders from Paper Design's open-source `@paper-design/shaders` package (vanilla) and `@paper-design/shaders-react` (React wrapper). They are **WebGL2** (`#version 300 es`) fragment shaders rendered by a shared `ShaderMount` runtime that owns a `requestAnimationFrame` loop and drives a single `u_time` uniform. The live site (shaders.paper.design) ships minified bundles; the **verbatim GLSL below is captured from the original unminified source** on GitHub (`paper-design/shaders`, package version `0.0.76`).

- **grain-gradient**: multi-color animated gradient with grainy noise distortion, 7 selectable abstract shapes (wave, dots, truchet, corners, ripple, blob, sphere). `layerRole: background`.
- **neuro-noise**: glowing, web-like organic line structure. `layerRole: background` (could also be `midground` if alpha-composited - it writes real alpha so it can layer over content). Original algorithm credited to @zozuar.

### Tech
- WebGL2 / GLSL ES 3.00 fragment shaders. No Three.js. Custom thin GL mount (`ShaderMount`).
- A shared vertex shader (in `shader-sizing.ts` / `shader-mount.ts`) computes the sizing varyings `v_patternUV`, `v_objectUV`, `v_patternBoxSize`, `v_objectBoxSize` that the fragment shaders consume. grain-gradient additionally needs a **pre-computed randomizer noise texture** bound to `u_noiseTexture` (a `sampler2D`).

### Source URLs / paths
- Repo: https://github.com/paper-design/shaders (package version 0.0.76)
- grain-gradient GLSL: `packages/shaders/src/shaders/grain-gradient.ts`
  - raw: https://raw.githubusercontent.com/paper-design/shaders/main/packages/shaders/src/shaders/grain-gradient.ts
- neuro-noise GLSL: `packages/shaders/src/shaders/neuro-noise.ts`
  - raw: https://raw.githubusercontent.com/paper-design/shaders/main/packages/shaders/src/shaders/neuro-noise.ts
- shared GLSL helpers: `packages/shaders/src/shader-utils.ts`
- React defaults: `packages/shaders-react/src/shaders/{grain-gradient,neuro-noise}.tsx`
- unpkg dist (minified, for reference only): https://unpkg.com/@paper-design/shaders@0.0.76/
- Live demos: https://shaders.paper.design

## License + attribution

- **License: PolyForm Shield License 1.0.0** (NOT MIT). From the repo: "the code is free to use in any commercial or non-commercial apps, products, and libraries, as long as they do not compete with Paper or Paper Shaders." Full text in the package `LICENSE` (5.74 kB).
- **Author / attribution**: Paper Design (paper-design). Repo `github.com/paper-design/shaders`. neuro-noise algorithm derives from @zozuar (https://x.com/zozuar/status/1625182758745128981/) - credit that line in attribution.
- **redistribution: `ok`** for tilt-lab's purpose. tilt-lab is a personal/internal visual-effects playground and does NOT compete with Paper or Paper Shaders, so the PolyForm Shield grant covers verbatim reuse. Keep the PolyForm Shield notice + the @zozuar credit. If tilt-lab ever ships as a competing shader product, this grant would no longer apply - flag for the acquisition phase.

---

## VERBATIM SOURCE

### Shared GLSL helpers (`shader-utils.ts`)

These string constants are interpolated into both fragment shaders. Both effects need `rotation2`; grain-gradient also needs `declarePI`, `simplexNoise`, `textureRandomizerR`, `proceduralHash11`; neuro-noise also needs `colorBandingFix`.

```glsl
// declarePI
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

// rotation2
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

// proceduralHash11
float hash11(float p) {
  p = fract(p * 0.3183099) + 0.1;
  p *= p + 19.19;
  return fract(p * p);
}

// textureRandomizerR  (depends on u_noiseTexture sampler2D)
float randomR(vec2 p) {
  vec2 uv = floor(p) / 100. + .5;
  return texture(u_noiseTexture, fract(uv)).r;
}

// colorBandingFix
color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

// simplexNoise
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
```

### neuro-noise fragment shader (verbatim)

```glsl
#version 300 es
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

// [rotation2 helper injected here: vec2 rotate(vec2 uv, float th) {...}]

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

  // [colorBandingFix injected here]

  fragColor = vec4(color, opacity);
}
```

TypeScript uniform/param interfaces (verbatim):

```ts
export interface NeuroNoiseUniforms extends ShaderSizingUniforms {
  u_colorFront: [number, number, number, number];
  u_colorMid: [number, number, number, number];
  u_colorBack: [number, number, number, number];
  u_brightness: number;
  u_contrast: number;
}

export interface NeuroNoiseParams extends ShaderSizingParams, ShaderMotionParams {
  colorFront?: string;
  colorMid?: string;
  colorBack?: string;
  brightness?: number;
  contrast?: number;
}
```

### grain-gradient fragment shader (verbatim)

```glsl
#version 300 es
precision lowp float;

uniform mediump float u_time;
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colorBack;
uniform vec4 u_colors[7];          // ${grainGradientMeta.maxColorCount} == 7
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

// [declarePI, simplexNoise, rotation2, textureRandomizerR injected here]

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

// [proceduralHash11 injected here]

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
  for (int i = 1; i < 7; i++) {     // i < ${grainGradientMeta.maxColorCount}
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
}
```

TypeScript uniform/param interfaces + shape enum (verbatim):

```ts
export const grainGradientMeta = { maxColorCount: 7 } as const;

export interface GrainGradientUniforms extends ShaderSizingUniforms {
  u_colorBack: [number, number, number, number];
  u_colors: vec4[];
  u_colorsCount: number;
  u_softness: number;
  u_intensity: number;
  u_noise: number;
  u_shape: (typeof GrainGradientShapes)[GrainGradientShape];
  u_noiseTexture?: HTMLImageElement;
}

export interface GrainGradientParams extends ShaderSizingParams, ShaderMotionParams {
  colorBack?: string;
  colors?: string[];
  softness?: number;
  intensity?: number;
  noise?: number;
  shape?: GrainGradientShape;
}

export const GrainGradientShapes = {
  wave: 1, dots: 2, truchet: 3, corners: 4, ripple: 5, blob: 6, sphere: 7,
};
export type GrainGradientShape = keyof typeof GrainGradientShapes;
```

---

## Proposed manifests

### neuro-noise

```jsonc
{
  "id": "neuro-noise",
  "name": "Neuro Noise",
  "category": "generative-noise",
  "layerRole": "background",   // writes real alpha; can also sit midground over content
  "origin": "paper-design/shaders (@paper-design/shaders 0.0.76)",
  "license": "PolyForm Shield License 1.0.0",
  "attribution": "Paper Design; algorithm by @zozuar (x.com/zozuar/status/1625182758745128981)",
  "redistribution": "ok",
  "requiredAssets": [],
  "tags": ["webgl2", "noise", "organic", "glow", "lines", "atmospheric"]
}
```

Params (uniforms mapped to UI controls; sizing/motion params come from the shared `ShaderSizingParams` + `ShaderMotionParams` bases):

| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| colorFront | color | `#ffffff` | - | - | highlight color (-> `u_colorFront`, RGBA, alpha-premultiplied in shader) |
| colorMid | color | `#47a6ff` | - | - | main line color (-> `u_colorMid`) |
| colorBack | color | `#000000` | - | - | background color (-> `u_colorBack`) |
| brightness | range | 0.05 | 0 | 1 | luminosity of crossing points (-> `u_brightness`) |
| contrast | range | 0.3 | 0 | 1 | sharpness of bright-dark transition (-> `u_contrast`) |
| speed | range | 1 | -2 | 2 | motion multiplier (drives `u_time` accumulation) |
| scale | range | 1 | 0.01 | 4 | zoom (sizing) |
| rotation | range | 0 | 0 | 360 | degrees (sizing) |
| offsetX | range | 0 | -1 | 1 | sizing |
| offsetY | range | 0 | -1 | 1 | sizing |

### grain-gradient

```jsonc
{
  "id": "grain-gradient",
  "name": "Grain Gradient",
  "category": "generative-gradient",
  "layerRole": "background",
  "origin": "paper-design/shaders (@paper-design/shaders 0.0.76)",
  "license": "PolyForm Shield License 1.0.0",
  "attribution": "Paper Design (github.com/paper-design/shaders)",
  "redistribution": "ok",
  "requiredAssets": ["noiseTexture"],   // sampler2D u_noiseTexture - precomputed randomizer image
  "tags": ["webgl2", "gradient", "grain", "noise", "multi-shape", "animated"]
}
```

Params:

| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| colors | color[] (1-7) | `['#7300ff','#eba8ff','#00bfff','#2a00ff']` | - | - | gradient stops -> `u_colors[7]` + `u_colorsCount` |
| colorBack | color | `#000000` | - | - | -> `u_colorBack` |
| shape | select | `corners` | - | - | options: wave, dots, truchet, corners, ripple, blob, sphere -> `u_shape` (1-7) |
| softness | range | 0.5 | 0 | 1 | transition sharpness (0 = hard, 1 = smooth) -> `u_softness` |
| intensity | range | 0.5 | 0 | 1 | distortion between bands -> `u_intensity` |
| noise | range | 0.25 | 0 | 1 | grain overlay strength -> `u_noise` |
| speed | range | 1 | -2 | 2 | drives `u_time` |
| scale | range | 1 | 0.01 | 4 | sizing |
| rotation | range | 0 | 0 | 360 | sizing |
| offsetX | range | 0 | -1 | 1 | sizing |
| offsetY | range | 0 | -1 | 1 | sizing |

> `select` options for `shape` map to the `GrainGradientShapes` enum integers; pass the int as `u_shape`.

---

## Integration notes / gotchas

1. **WebGL2 only.** Both shaders are `#version 300 es` (GLSL ES 3.00): `in/out`, `texture()`, `fwidth()`. Need a WebGL2 context. No fallback.
2. **Shared vertex shader + sizing uniforms.** The fragment shaders consume varyings (`v_patternUV`, `v_objectUV`, `v_patternBoxSize`, `v_objectBoxSize`) produced by the library's shared vertex shader in `shader-sizing.ts`/`shader-mount.ts`. A faithful port must also bring over that sizing vertex shader and the full set of sizing uniforms (`u_resolution`, `u_pixelRatio`, `u_originX/Y`, `u_worldWidth/Height`, `u_fit`, `u_scale`, `u_rotation`, `u_offsetX/Y`). These were NOT captured here (out of lane scope) - the acquisition phase should pull `shader-sizing.ts` and `shader-mount.ts` from the same repo. neuro-noise uses only `v_patternUV`; grain-gradient uses both pattern and object UVs depending on `u_shape`.
3. **grain-gradient needs a noise texture asset.** `uniform sampler2D u_noiseTexture` feeds `randomR()`/`valueNoiseR()`. The library generates a precomputed randomizer image (`HTMLImageElement`) and binds it. tilt-lab must supply this as a `requiredAsset`. Without it, truchet/value-noise/grain paths read garbage. (neuro-noise does NOT need any texture.)
4. **`fwidth()` derivatives** are used in grain-gradient for anti-aliasing (`aa = fwidth(shape)`). Fine in WebGL2 core, but confirm derivative support if ever downgrading.
5. **Premultiplied alpha.** Both shaders premultiply (`rgb *= a`) and output straight composited color+alpha. The mount likely uses premultiplied-alpha blending. Match the blend mode (`gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`) or colors will look wrong over transparent backgrounds.
6. **devicePixelRatio.** `u_pixelRatio` participates in fit math; pass real DPR and size the canvas backing store by DPR.
7. **`firstFrameOffset = 7.`** in grain-gradient nudges `t` so the first rendered frame is not a degenerate state - keep it.
8. **Color format.** Params are CSS hex strings in the React layer; the mount parses them to RGBA float vec4. tilt-lab's `setParam('colorFront', '#fff')` path needs the same hex->vec4 parse.

---

## Normalization sketch (-> Effect contract)

The library's `ShaderMount` owns its own RAF loop and advances `u_time`. tilt-lab drives `frame(t)` externally, so we strip the internal loop:

- **`init(canvas, { params, assets })`**
  - Get a WebGL2 context. Compile the shared sizing vertex shader + the effect's fragment shader (string above with helpers injected). Link program. Build a fullscreen quad / triangle VAO.
  - Cache all uniform locations. For grain-gradient, upload `assets.noiseTexture` into a `sampler2D` texture unit and bind to `u_noiseTexture`. neuro-noise needs no asset.
  - Parse hex color params -> vec4; set initial uniforms (`u_colorFront`, `u_colors`, `u_colorsCount`, `u_softness`, etc.) plus sizing uniforms from params.
  - Do NOT start a RAF loop.
- **`frame(t)`**
  - Convert the externally-driven `t` (ms or s) into the shader's `u_time`. Apply the `speed` param as a multiplier (`u_time = t_seconds * speed`). Set `u_time`, then `gl.drawArrays`. No internal scheduling.
- **`resize(w, h)`**
  - `gl.viewport(0,0,w*dpr,h*dpr)`; set `u_resolution = [w*dpr, h*dpr]` and `u_pixelRatio = dpr`. Resize the canvas backing store. (Sizing math recomputes from `u_resolution` each frame.)
- **`setParam(key, value)`**
  - Map key -> uniform. Colors: hex->vec4 then `uniform4fv`. `shape`: enum name->int->`uniform1f(u_shape)`. `colors` array: rewrite `u_colors[]` + `u_colorsCount`. Numeric ranges: direct `uniform1f`. Sizing keys (scale/rotation/offset): set their uniforms.
- **`dispose()`**
  - Delete program, shaders, VAO/buffers, and the noise texture; drop the GL context reference.

**Loop adaptation note:** the only real adaptation from upstream is removing `ShaderMount`'s `requestAnimationFrame` self-drive and instead writing `u_time` from the host's `frame(t)`. Everything else (uniform set, draw) is already per-frame work the mount does internally.
