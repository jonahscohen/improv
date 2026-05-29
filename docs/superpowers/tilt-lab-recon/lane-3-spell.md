# Lane 3 - spell.sh animated-gradient

Recon by Jonah (recon-b). Single effect: `animated-gradient`.

## 1. Source URL(s) / file path(s) and tech

- Live site: https://spell.sh (Spell UI, "refined UI components for Design Engineers", by handle `tomm_ui`).
- Docs page: https://spell.sh/docs/animated-gradient
- Install (shadcn registry, copy-paste, NOT an npm package):
  ```
  pnpm dlx shadcn@latest add @spell/animated-gradient
  ```
- Actual source (verbatim, fetched 2026-05-29): https://spell.sh/r/animated-gradient.json
  - Single file: `registry/spell-ui/animated-gradient.tsx` (16.7 KB), `type: registry:component`.
- **Tech:** React (Next.js, `"use client"`, `next-themes` for light/dark) + raw **WebGL2** (`getContext("webgl2")`, `#version 300 es` shaders). Full-screen triangle pair, single fragment shader does all the work. No three.js, no external runtime deps (`dependencies: []`, `registryDependencies: []`).

### Lineage note (important for license)
This is structurally a **re-implementation of paper.design's swirl/gradient shader** (the same family Lane 2 covers). The fragment shader's `blend_colors()` signature, the `u_swirl` / `u_swirlIterations` / `u_proportion` / `u_softness` uniform set, and the noise -> distortion -> swirl-iteration -> shape (Checks/Stripes/Edge) pipeline match `@paper-design/shaders` very closely. paper.design ships MIT, so a clean-room normalization is low-risk regardless of how we source this file. See `lane-2-paper-design.md` for the upstream.

## 2. VERBATIM source

### 2a. WebGL setup + externally-relevant render logic (from `animated-gradient.tsx`)

Vertex shader (trivial full-screen quad):

```glsl
#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}
```

Context, geometry, uniform locations:

```ts
const gl = canvas.getContext("webgl2", {
  premultipliedAlpha: true,
  alpha: true,
  antialias: true,
});
if (!gl) return;

// ...compile vertexShader (above) + FRAGMENT_SHADER (below), link, useProgram...

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
  gl.STATIC_DRAW
);
const positionLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const uniforms = {
  u_time: gl.getUniformLocation(program, "u_time"),
  u_resolution: gl.getUniformLocation(program, "u_resolution"),
  u_pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
  u_scale: gl.getUniformLocation(program, "u_scale"),
  u_rotation: gl.getUniformLocation(program, "u_rotation"),
  u_color1: gl.getUniformLocation(program, "u_color1"),
  u_color2: gl.getUniformLocation(program, "u_color2"),
  u_color3: gl.getUniformLocation(program, "u_color3"),
  u_proportion: gl.getUniformLocation(program, "u_proportion"),
  u_softness: gl.getUniformLocation(program, "u_softness"),
  u_shape: gl.getUniformLocation(program, "u_shape"),
  u_shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
  u_distortion: gl.getUniformLocation(program, "u_distortion"),
  u_swirl: gl.getUniformLocation(program, "u_swirl"),
  u_swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
};
```

Resize (devicePixelRatio-aware, driven by `ResizeObserver` on the container):

```ts
const resize = () => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
};
resize();
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);
```

Animation loop (the effect owns its own RAF - this is what we replace with `frame(t)`):

```ts
startTimeRef.current = performance.now();

const animate = (time: number) => {
  const elapsed = (time - startTimeRef.current) / 1000;
  const speed = (params.speed / 100) * 5;

  gl.uniform1f(uniforms.u_time, elapsed * speed + params.offset * 0.01);
  gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.u_pixelRatio, window.devicePixelRatio || 1);
  gl.uniform1f(uniforms.u_scale, params.scale);
  gl.uniform1f(uniforms.u_rotation, (params.rotation * Math.PI) / 180);

  const c1 = hexToRgba(params.color1);
  const c2 = hexToRgba(params.color2);
  const c3 = hexToRgba(params.color3);
  gl.uniform4f(uniforms.u_color1, c1[0], c1[1], c1[2], c1[3]);
  gl.uniform4f(uniforms.u_color2, c2[0], c2[1], c2[2], c2[3]);
  gl.uniform4f(uniforms.u_color3, c3[0], c3[1], c3[2], c3[3]);

  gl.uniform1f(uniforms.u_proportion, params.proportion / 100);
  gl.uniform1f(uniforms.u_softness, params.softness / 100);
  gl.uniform1f(uniforms.u_shape, PatternShapes[params.shape]);
  gl.uniform1f(uniforms.u_shapeScale, params.shapeSize / 100);
  gl.uniform1f(uniforms.u_distortion, params.distortion / 50);
  gl.uniform1f(uniforms.u_swirl, params.swirl / 100);
  gl.uniform1f(
    uniforms.u_swirlIterations,
    params.swirl === 0 ? 0 : params.swirlIterations
  );

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  frameIdRef.current = requestAnimationFrame(animate);
};
frameIdRef.current = requestAnimationFrame(animate);
```

Cleanup (maps directly to `dispose()`):

```ts
return () => {
  if (frameIdRef.current !== undefined) {
    cancelAnimationFrame(frameIdRef.current);
  }
  resizeObserver.disconnect();
  gl.deleteProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  gl.deleteBuffer(positionBuffer);
};
```

Color parsing helper (supports `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()`; returns normalized 0..1 RGBA):

```ts
function hexToRgba(hex: string): [number, number, number, number] {
  let r = 0, g = 0, b = 0, a = 1;
  if (hex.startsWith("rgba(")) {
    const parts = hex.slice(5, -1).split(",");
    r = parseInt(parts[0]) / 255; g = parseInt(parts[1]) / 255;
    b = parseInt(parts[2]) / 255; a = parseFloat(parts[3]);
  } else if (hex.startsWith("rgb(")) {
    const parts = hex.slice(4, -1).split(",");
    r = parseInt(parts[0]) / 255; g = parseInt(parts[1]) / 255; b = parseInt(parts[2]) / 255;
  } else if (hex.startsWith("hsla(") || hex.startsWith("hsl(")) {
    const isHsla = hex.startsWith("hsla(");
    const parts = hex.slice(isHsla ? 5 : 4, -1).split(",");
    const h = parseFloat(parts[0]) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    a = isHsla ? parseFloat(parts[3]) : 1;
    [r, g, b] = hslToRgb(h, s, l);
  } else if (hex.startsWith("#")) {
    const c = hex.slice(1);
    if (c.length === 3) {
      r = parseInt(c[0] + c[0], 16) / 255;
      g = parseInt(c[1] + c[1], 16) / 255;
      b = parseInt(c[2] + c[2], 16) / 255;
    } else if (c.length >= 6) {
      r = parseInt(c.slice(0, 2), 16) / 255;
      g = parseInt(c.slice(2, 4), 16) / 255;
      b = parseInt(c.slice(4, 6), 16) / 255;
      if (c.length === 8) { a = parseInt(c.slice(6, 8), 16) / 255; }
    }
  }
  return [r, g, b, a];
}
// hslToRgb(h,s,l) is the standard hue2rgb implementation (omitted for brevity, present in source).
```

`PatternShape` enum mapping:

```ts
type PatternShape = "Checks" | "Stripes" | "Edge";
const PatternShapes: Record<PatternShape, number> = { Checks: 0, Stripes: 1, Edge: 2 };
```

### 2b. VERBATIM fragment shader (`FRAGMENT_SHADER` constant)

```glsl
#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}
```

### 2c. Noise overlay (optional, pure CSS/DOM, NOT part of the shader)
When `noise.opacity > 0` the component lays a tiled base64 PNG over the canvas:

```ts
backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAAAAAAAAAAAAAAAAAAAAADgKxmiAAAABnRSTlMCCgkGBAVJOAVJAAAASklEQVQ4y2NgGAWjYBSMglEwCgY/YGRgZBQUYmJiZGQEkYwMjIyMgoKCjIyMIJKBgRFIMjIyAklGRkYGRkFBYEcwMDIyMjAOUQAA1I4HwVwZAkYAAAAASUVORK5CYII=")`,
backgroundSize: (noise.scale ?? 1) * 200,
backgroundRepeat: "repeat",
opacity: noise.opacity / 2,
pointerEvents: "none",
```

## 3. Proposed manifest

```
id:          spell-animated-gradient
name:        Animated Gradient (Spell UI)
category:    gradient
layerRole:   background        // max 1 per stack; container uses position:absolute; inset:0; z-index:-1
requiredAssets: []             // optional inline base64 noise PNG only if noise overlay enabled
origin:      https://spell.sh/docs/animated-gradient (shadcn registry @spell/animated-gradient)
license:     none stated (see section 4) - treat upstream lineage as paper.design / MIT
attribution: Spell UI (tomm_ui)
redistribution: personal-only  // no explicit OSS license found on the source; safe path = reimplement from paper.design MIT
tags:        [webgl2, gradient, swirl, noise, mesh-gradient, fragment-shader, react]
```

### Params table
All inputs are the component's `config` fields; column "uniform xform" shows how the JS scales the value before upload.

| name            | type   | default | min   | max  | uniform xform                                     |
|-----------------|--------|---------|-------|------|---------------------------------------------------|
| color1          | color  | #050505 | -     | -    | hexToRgba -> u_color1 (vec4, 0..1)                |
| color2          | color  | #66B3FF | -     | -    | hexToRgba -> u_color2                             |
| color3          | color  | #FFFFFF | -     | -    | hexToRgba -> u_color3                             |
| speed           | range  | 25      | 0     | 100  | (speed/100)*5, multiplies elapsed seconds -> u_time |
| rotation        | range  | 0       | -180  | 180  | deg -> rad (* PI/180) -> u_rotation               |
| proportion      | range  | 35      | 0     | 100  | /100 -> u_proportion                             |
| scale           | range  | 1       | 0     | 1    | raw -> u_scale (controls noise_scale)            |
| distortion      | range  | 12      | 0     | 100  | /50 -> u_distortion                              |
| swirl           | range  | 80      | 0     | 100  | /100 -> u_swirl (0 disables swirl loop)          |
| swirlIterations | range  | 10      | 1     | 30   | clamped ceil 1..30 -> u_swirlIterations          |
| softness        | range  | 100     | 0     | 100  | /100 -> u_softness (edge blur in blend_colors)   |
| offset          | range  | 0       | -1000 | 1000 | *0.01 added to u_time (phase offset)             |
| shape           | select | Checks  | -     | -    | Checks=0 / Stripes=1 / Edge=2 -> u_shape         |
| shapeSize       | range  | 10      | 0     | 100  | /100 -> u_shapeScale                             |
| noise.opacity   | range  | 0       | 0     | 1    | CSS overlay opacity/2 (optional)                 |
| noise.scale     | range  | 1       | -     | -    | CSS backgroundSize = scale*200 (optional)        |

Defaults above are the `custom` preset fallbacks from `params` useMemo. min/max for `offset`, `rotation` are inferred from preset value ranges (presets use rotation -167..114, offset -813..717); clamp generously. Six built-in presets (Prism, Lava, Plasma, Pulse, Vortex, Mist) each ship a full param set plus a `lightColors` variant for light theme - capture them as named presets if tilt-lab wants preset selection.

## 4. License + attribution

- **Author:** Spell UI, handle `tomm_ui`. Footer: "(c) 2026 Spell UI".
- **License:** NONE stated. The registry JSON (`/r/animated-gradient.json`) has no `license`/`author` field; the homepage and docs state no MIT/Apache/etc. There are Terms of Service and Privacy Policy pages but no open-source license. Components are marketed as "copy and paste into any project," which implies permissive personal use but is not a formal grant.
- **Upstream:** The shader is functionally a paper.design swirl/gradient shader (MIT) re-expressed. For redistribution safety, prefer reimplementing from the paper.design MIT source (Lane 2) rather than shipping spell.sh's file verbatim.
- **Decision:** `redistribution: personal-only` for the spell.sh file as-fetched; a clean reimplementation off paper.design MIT would be `reimplemented` and fully shippable.

## 5. Integration notes / gotchas

- **WebGL2 only.** Uses `#version 300 es`, `in/out`, `getContext("webgl2")`. No WebGL1 fallback - if context creation fails the component silently returns (renders nothing). tilt-lab should detect and fall back.
- **Self-owned RAF.** The component drives its own `requestAnimationFrame` loop. Must be stripped for tilt-lab's externally-driven `frame(t)` (see section 6).
- **devicePixelRatio.** Canvas backing store is sized `clientWidth * dpr`; `u_pixelRatio` is also passed to the shader and divides uv. Preserve both or the swirl scale shifts on retina.
- **ResizeObserver on container, not window.** Resize watches the wrapper div, so the effect adapts to container size, not just viewport. Good fit for `resize(w,h)`.
- **next-themes coupling.** `useTheme()` only selects between `color1/2/3` and `lightColors`. Strip this dep entirely; tilt-lab passes explicit colors as params.
- **No external assets** except the optional inline base64 noise tile (kept inline, no fetch).
- **Alpha / premultiplied.** Context is `premultipliedAlpha:true, alpha:true`; shader multiplies `rgb * a` in `blend_colors`. Colors with alpha < 1 produce a transparent background (useful for layering, but as a `background` role it is usually opaque). Container sets `z-index:-1`.
- **`speed === 0`** still advances `u_time` by 0 (frozen). **`swirl === 0`** forces `u_swirlIterations = 0`, skipping the swirl loop (flat noise gradient).
- **`offset`** is a static time phase, not animated - lets you pick a frame of the loop deterministically.

## 6. Normalization sketch (maps onto Effect contract)

```ts
class SpellAnimatedGradient implements Effect {
  // holds: gl, program, uniforms, positionBuffer, params, colorCache
  init(canvas, { params }) {
    this.gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true });
    // compile vertex + FRAGMENT_SHADER, link, useProgram, upload the 6-vertex quad,
    // grab all 15 uniform locations (verbatim from section 2a).
    this.params = { ...DEFAULTS, ...params };   // accept preset name -> expand to full param set
  }

  // externally driven. `t` is ms (or s) from the host clock; replaces internal elapsed.
  frame(t) {
    const g = this.gl, u = this.uniforms, p = this.params;
    const tSec = t / 1000;
    const speed = (p.speed / 100) * 5;
    g.uniform1f(u.u_time, tSec * speed + p.offset * 0.01);   // <- only change vs original animate()
    g.uniform2f(u.u_resolution, this.w, this.h);
    g.uniform1f(u.u_pixelRatio, this.dpr);
    g.uniform1f(u.u_scale, p.scale);
    g.uniform1f(u.u_rotation, p.rotation * Math.PI / 180);
    // upload color1/2/3 via hexToRgba (cache parse; only re-parse on setParam)
    g.uniform1f(u.u_proportion, p.proportion / 100);
    g.uniform1f(u.u_softness, p.softness / 100);
    g.uniform1f(u.u_shape, PatternShapes[p.shape]);
    g.uniform1f(u.u_shapeScale, p.shapeSize / 100);
    g.uniform1f(u.u_distortion, p.distortion / 50);
    g.uniform1f(u.u_swirl, p.swirl / 100);
    g.uniform1f(u.u_swirlIterations, p.swirl === 0 ? 0 : p.swirlIterations);
    g.drawArrays(g.TRIANGLES, 0, 6);
    // NO requestAnimationFrame here - host owns the loop.
  }

  resize(w, h) {
    this.dpr = window.devicePixelRatio || 1;
    this.w = w * this.dpr; this.h = h * this.dpr;
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.gl.viewport(0, 0, this.w, this.h);
  }

  setParam(key, value) {
    this.params[key] = value;            // takes effect on next frame()
    if (key.startsWith("color")) this.reparseColor(key);
  }

  dispose() {
    const g = this.gl;
    g.deleteProgram(this.program);
    g.deleteShader(this.vertexShader);
    g.deleteShader(this.fragmentShader);
    g.deleteBuffer(this.positionBuffer);
    // no RAF to cancel; host stops calling frame(). Drop ResizeObserver - host calls resize().
  }
}
```

Key adaptation: the original `animate(time)` computes `elapsed = (time - startTime)/1000` then `u_time = elapsed*speed + offset*0.01`. For `frame(t)` we feed the host's `t` straight in (`u_time = (t/1000)*speed + offset*0.01`), dropping the internal `startTime`/`performance.now()` baseline and the `requestAnimationFrame` recursion. Color parsing should be cached and only recomputed in `setParam` (the original re-parses every frame, which is wasteful). The `next-themes`/light-color logic and the React wrapper div are discarded - tilt-lab supplies colors and the canvas directly. Optional noise overlay becomes a separate DOM/post concern, not part of this WebGL effect.
