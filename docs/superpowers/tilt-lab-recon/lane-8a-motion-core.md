# Lane 8a - motion-core (6 effects)

Recon by Jonah (recon-e). RECON ONLY. Six effects from motion-core, with verbatim shaders and precise layerRole classification.

## Summary

[motion-core](https://motion-core.dev) is an open-source Svelte 5 component library. Stack: **Svelte 5 (runes/snippets) + Tailwind v4 + GSAP + OGL** (a lightweight WebGL library, NOT Three.js). Components are distributed via a Rust CLI (`npx @motion-core/cli add <name>`) that copies source into the consumer's `$lib/motion-core`. Source of truth: `packages/motion-core/src/lib/components/<name>/`.

Each effect is a pair: `<Name>.svelte` (the public component / DOM + props) and `<Name>Scene.svelte` (the OGL renderer, where the **inline GLSL shader strings live**). All shaders are WebGL1-style (`attribute`, `varying`, `texture2D`, `gl_FragColor`) and all share the same fullscreen-quad vertex shader except the infinite-gallery which uses real 3D plane geometry.

### LICENSE CORRECTION
The recon brief assumed `redistribution=personal-only` for motion-core. **The actual license is MIT** ("Licensed under MIT", per the repo). So **redistribution is `ok`** (retain the MIT notice + copyright). I am flagging this discrepancy for the acquisition phase: motion-core is freer to reuse than the brief assumed. Author/attribution: the motion-core project (github.com/motion-core/motion-core).

### layerRole classification (the key ask)

| effect | layerRole | classification | fits our layer model? |
|---|---|---|---|
| **dithered-image** | `post` | post-process over a source image (could also be `background` when fed a full-bleed image) | YES - maps to `post`. But note: it dithers a *texture*, not the live canvas beneath it. A true tilt-lab `post` layer would need to read the framebuffer of layers below; this reads an image asset. See gotcha. |
| **halo** | `background` | full-bleed atmospheric-scattering background | YES - clean `background`. |
| **fake-3d-image** | `background` (pointer-reactive) | depth-parallax of an image, pointer-driven | YES - `background` + `pointer` behavior. motion-core docs call it a "depth-map parallax background." |
| **globe** | `midground` | interactive 3D data-viz globe with markers/tooltips | PARTIAL - renders as a midground object, but it is a **CONTENT WIDGET** (markers, tooltips, focus-on, click interaction). The visual layer fits; the data/interaction layer is out of tilt-lab's effect contract. |
| **glass-slideshow** | n/a | **CONTENT WIDGET** - image carousel with glass transitions | OUT-OF-SCOPE CANDIDATE. It owns slide state, autoplay timing, an image array, and a GSAP-driven transition. Not a stackable visual layer. The glass-transition *shader* could be salvaged as a transition primitive, but the component as-is is a widget. |
| **infinite-gallery** | n/a | **CONTENT WIDGET** - scrollable 3D image tunnel | OUT-OF-SCOPE CANDIDATE. Owns scroll velocity, wheel/keyboard input, image array, autoplay. Not a background/post layer. |

**Recommendation:** dithered-image, halo, fake-3d-image map onto tilt-lab's contract. globe is a midground object but carries widget baggage (markers/tooltips) that exceeds the contract. glass-slideshow and infinite-gallery are content widgets and should be flagged out-of-scope (or have just their shaders harvested as primitives).

### Required assets
- dithered-image: source image (`src`) + a dither threshold-map texture (Bayer 4x4/8x8, halftone, void-and-cluster) bound to `uThresholdMap`.
- halo: none (fully procedural).
- fake-3d-image: color image (`colorSrc`) + grayscale depth map (`depthSrc`, generated via DepthPro).
- globe: `assets/land-texture.png` (equirectangular land mask) + procedural Fibonacci points.
- glass-slideshow: image array (`images`).
- infinite-gallery: image array (`images`).

### Source URLs
- Repo: https://github.com/motion-core/motion-core (license MIT)
- Components: `packages/motion-core/src/lib/components/<name>/`
- Docs: https://motion-core.dev/docs/<name>
- Each effect's shaders are inline in `…/<name>/<Name>Scene.svelte`.

---

## 1. dithered-image (`post`)

Source: `components/dithered-image/{DitheredImage.svelte, DitheredImageScene.svelte}`. Docs: https://motion-core.dev/docs/dithered-image

Ordered-dithering post effect: pixelate to a grid, sample a threshold map, `step()` against luminance, then map to a two-color (fg/bg) output.

### Shared vertex shader (used by 1-5)

```glsl
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position, 0.0, 1.0);
}
```

### Fragment shader (verbatim)

```glsl
precision highp float;

uniform sampler2D uTexture;
uniform sampler2D uThresholdMap;
uniform vec2 uResolution;
uniform vec2 uMapSize;
uniform vec2 uCoverScale;
uniform vec2 uCoverOffset;
uniform float uPixelSize;
uniform float uThreshold;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;

varying vec2 vUv;

float getLuminance(vec3 colorValue) {
	return dot(colorValue, vec3(0.299, 0.587, 0.114));
}

vec3 linearToSrgb(vec3 color) {
	vec3 safe = max(color, vec3(0.0));
	vec3 low = safe * 12.92;
	vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
	vec3 cutoff = step(vec3(0.0031308), safe);
	return mix(low, high, cutoff);
}

void main() {
	float pixel = max(1.0, uPixelSize);
	vec2 pixelCoord = floor(gl_FragCoord.xy / pixel);
	vec2 centerPixel = pixelCoord * pixel + (pixel * 0.5);
	vec2 centerUv = centerPixel / uResolution;

	vec2 coverScale = max(uCoverScale, vec2(0.00001));
	vec2 imageUv = coverScale * centerUv + uCoverOffset;
	vec4 texColor = texture2D(uTexture, imageUv);

	vec2 mapUv = mod(pixelCoord, uMapSize) / uMapSize;
	mapUv += (0.5 / uMapSize);
	float thresholdValue = texture2D(uThresholdMap, mapUv).r;

	float lum = getLuminance(texColor.rgb);
	float dither = step(thresholdValue + uThreshold, lum);
	vec3 ditheredColor = mix(uBackgroundColor, uColor, dither);

	gl_FragColor = vec4(linearToSrgb(ditheredColor), 1.0);
}
```

### Params

| param | type | default | notes |
|---|---|---|---|
| src | (asset) | - | source image -> `uTexture` |
| ditherMap | select | `bayer4x4` | options: bayer4x4, bayer8x8, halftone, voidAndCluster -> selects `uThresholdMap` texture |
| pixelSize | range | 1 | pixelation grid -> `uPixelSize` |
| threshold | range | 0.0 | bias -> `uThreshold` |
| color | color | `#ff6900` | foreground -> `uColor` |
| backgroundColor | color | `#17181A` | -> `uBackgroundColor` |

---

## 2. halo (`background`)

Source: `components/halo/{Halo.svelte, HaloScene.svelte}`. Docs: https://motion-core.dev/docs/halo

Procedural Rayleigh + Mie atmospheric-scattering halo with rotating camera and a sun direction. Fully procedural, no assets. Owns its own RAF (see gotchas).

### Fragment shader (verbatim)

```glsl
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uBackgroundColor;
uniform float uRotationSpeed;
uniform float uCameraDistance;
uniform float uFov;
uniform vec3 uSunDir;
uniform float uIntensity;

const float PI = 3.14159265359;
const float MAX = 10000.0;
const float R_INNER = 1.0;
const float R = 1.5;
const int NUM_OUT_SCATTER = 8;
const int NUM_IN_SCATTER = 40;

vec2 ray_vs_sphere(vec3 p, vec3 dir, float r) {
	float b = dot(p, dir);
	float c = dot(p, p) - r * r;
	float d = b * b - c;
	if (d < 0.0) {
		return vec2(MAX, -MAX);
	}
	d = sqrt(d);
	return vec2(-b - d, -b + d);
}

float phase_mie(float g, float c, float cc) {
	float gg = g * g;
	float a = (1.0 - gg) * (1.0 + cc);
	float b = 1.0 + gg - 2.0 * g * c;
	b *= sqrt(b);
	b *= 2.0 + gg;
	return (3.0 / 8.0 / PI) * a / b;
}

float phase_ray(float cc) {
	return (3.0 / 16.0 / PI) * (1.0 + cc);
}

float density(vec3 p, float ph) {
	return exp(-max(length(p) - R_INNER, 0.0) / ph);
}

float colorLuma(vec3 c) {
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

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
	vec3 tintTarget = mix(bg, effectHue, 0.85);
	vec3 tint = mix(bg, tintTarget, edge);

	return mix(additive, tint, lightBg);
}

vec3 linearToSrgb(vec3 color) {
	vec3 safe = max(color, vec3(0.0));
	vec3 low = safe * 12.92;
	vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
	vec3 cutoff = step(vec3(0.0031308), safe);
	return mix(low, high, cutoff);
}

float optic(vec3 p, vec3 q, float ph) {
	vec3 s = (q - p) / float(NUM_OUT_SCATTER);
	vec3 v = p + s * 0.5;
	float sum = 0.0;
	for (int i = 0; i < NUM_OUT_SCATTER; i++) {
		sum += density(v, ph);
		v += s;
	}
	sum *= length(s);
	return sum;
}

vec3 in_scatter(vec3 o, vec3 dir, vec2 e, vec3 l) {
	const float ph_ray = 0.05;
	const float ph_mie = 0.02;
	const vec3 k_ray = vec3(3.8, 13.5, 33.1);
	const vec3 k_mie = vec3(21.0);
	const float k_mie_ex = 1.1;

	vec3 sum_ray = vec3(0.0);
	vec3 sum_mie = vec3(0.0);
	float n_ray0 = 0.0;
	float n_mie0 = 0.0;
	float len = (e.y - e.x) / float(NUM_IN_SCATTER);
	vec3 s = dir * len;
	vec3 v = o + dir * (e.x + len * 0.5);

	for (int i = 0; i < NUM_IN_SCATTER; i++) {
		float d_ray = density(v, ph_ray) * len;
		float d_mie = density(v, ph_mie) * len;
		n_ray0 += d_ray;
		n_mie0 += d_mie;

		vec2 f = ray_vs_sphere(v, l, R);
		vec3 u = v + l * f.y;
		float n_ray1 = optic(v, u, ph_ray);
		float n_mie1 = optic(v, u, ph_mie);
		vec3 att = exp(-(n_ray0 + n_ray1) * k_ray - (n_mie0 + n_mie1) * k_mie * k_mie_ex);
		sum_ray += d_ray * att;
		sum_mie += d_mie * att;
		v += s;
	}
	float c = dot(dir, -l);
	float cc = c * c;
	vec3 scatter = sum_ray * k_ray * phase_ray(cc) + sum_mie * k_mie * phase_mie(-0.78, c, cc);
	return scatter;
}

mat3 rot3xy(vec2 angle) {
	vec2 c = cos(angle);
	vec2 s = sin(angle);
	return mat3(
		c.y, 0.0, -s.y,
		s.y * s.x, c.x, c.y * s.x,
		s.y * c.x, -s.x, c.y * c.x
	);
}

vec3 ray_dir(float fov, vec2 size, vec2 uv) {
	vec2 xy = uv * size - size * 0.5;
	float cot_half_fov = tan(radians(90.0 - fov * 0.5));
	float z = size.y * 0.5 * cot_half_fov;
	return normalize(vec3(xy, -z));
}

void mainImage(out vec4 fragColor, in vec2 uv) {
	vec3 dir = ray_dir(uFov, uResolution.xy, uv);
	vec3 eye = vec3(0.0, 0.0, uCameraDistance);
	mat3 rot = rot3xy(vec2(0.0, uTime * uRotationSpeed));
	dir = rot * dir;
	eye = rot * eye;
	vec3 l = normalize(uSunDir);
	vec2 e = ray_vs_sphere(eye, dir, R);
	if (e.x > e.y) {
		fragColor = vec4(uBackgroundColor, 1.0);
		return;
	}
	vec2 f = ray_vs_sphere(eye, dir, R_INNER);
	e.y = min(e.y, f.x);
	vec3 I = in_scatter(eye, dir, e, l);
	vec3 halo = I * uIntensity * 10.0;
	float softMask = 1.0 - exp(-1.2 * colorLuma(halo));
	vec3 rgb = blendAdaptive(uBackgroundColor, halo, softMask);
	fragColor = vec4(rgb, 1.0);
}

void main() {
	vec4 fragColor;
	mainImage(fragColor, vUv);
	fragColor.rgb = linearToSrgb(fragColor.rgb);
	gl_FragColor = fragColor;
}
```

### OGL uniforms + render loop (verbatim)

```javascript
const localUniforms = {
	uTime: { value: 0.0 },
	uResolution: { value: new Vec2(1, 1) },
	uBackgroundColor: { value: new Vec3(initialBackground[0], initialBackground[1], initialBackground[2]) },
	uRotationSpeed: { value: rotationSpeed },
	uCameraDistance: { value: cameraDistance },
	uFov: { value: fov },
	uSunDir: { value: initialSun },
	uIntensity: { value: intensity },
};

const tick = (now: number) => {
	const w = Math.max(1, targetCanvas.clientWidth);
	const h = Math.max(1, targetCanvas.clientHeight);
	const bufW = Math.round(w * renderer.dpr);
	const bufH = Math.round(h * renderer.dpr);
	if (targetCanvas.width !== bufW || targetCanvas.height !== bufH) {
		targetCanvas.width = bufW;
		targetCanvas.height = bufH;
		renderer.width = w;
		renderer.height = h;
		renderer.state.viewport = { x: 0, y: 0, width: null, height: null };
		localUniforms.uResolution.value.set(w, h);
	}
	const delta = previous ? (now - previous) / 1000 : 0;
	previous = now;
	localUniforms.uTime.value += delta;
	renderer.render({ scene, camera });
	raf = window.requestAnimationFrame(tick);
};
raf = window.requestAnimationFrame(tick);
```

### Params

| param | type | default | notes |
|---|---|---|---|
| rotationSpeed | range | 0.5 | -> `uRotationSpeed` |
| backgroundColor | color | `#17181A` | -> `uBackgroundColor` |
| cameraDistance | range | 3.0 | -> `uCameraDistance` |
| fov | range | 55.0 | -> `uFov` |
| sunX / sunY / sunZ | range | 0 / 0 / 1 | -> `uSunDir` |
| intensity | range | 1.0 | -> `uIntensity` |

---

## 3. fake-3d-image (`background` + `pointer`)

Source: `components/fake-3d-image/{Fake3DImage.svelte, Fake3DImageScene.svelte}`. Docs: https://motion-core.dev/docs/fake-3d-image

Depth-map parallax: displaces the color image UV by `(depth - 0.5) * mouse / threshold`. Pointer-driven, so it is both a `background` and exercises `pointer` behavior.

### Fragment shader (verbatim)

```glsl
precision mediump float;

uniform sampler2D uOriginalTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uMouse;
uniform vec2 uThreshold;
uniform vec2 uResolution;
uniform vec2 uOriginalTextureSize;
uniform vec2 uDepthTextureSize;
varying vec2 vUv;

vec2 mirrored(vec2 value) {
	vec2 m = mod(value, 2.0);
	return mix(m, 2.0 - m, step(1.0, m));
}

vec2 getCoverUV(vec2 uv, vec2 textureSize) {
	vec2 safeTexture = max(textureSize, vec2(1.0));
	vec2 s = uResolution / safeTexture;
	float scale = max(s.x, s.y);
	vec2 scaledSize = safeTexture * scale;
	vec2 offset = (uResolution - scaledSize) * 0.5;
	return (uv * uResolution - offset) / scaledSize;
}

void main() {
	vec2 baseUv = mirrored(getCoverUV(vUv, uOriginalTextureSize));
	vec2 depthUv = mirrored(getCoverUV(vUv, uDepthTextureSize));
	float depth = texture2D(uDepthTexture, depthUv).r;

	vec2 safeThreshold = max(uThreshold, vec2(0.00001));
	vec2 fake3d = vec2(
		baseUv.x + (depth - 0.5) * uMouse.x / safeThreshold.x,
		baseUv.y + (depth - 0.5) * uMouse.y / safeThreshold.y
	);

	gl_FragColor = texture2D(uOriginalTexture, mirrored(fake3d));
}
```

### Params

| param | type | default | notes |
|---|---|---|---|
| colorSrc | (asset) | - | color image -> `uOriginalTexture` |
| depthSrc | (asset) | - | grayscale depth map -> `uDepthTexture` (generate via DepthPro) |
| xThreshold | range | 8 | -> `uThreshold.x` |
| yThreshold | range | 8 | -> `uThreshold.y` |
| sensitivity | range | 0.25 | pointer smoothing (app-side, feeds `uMouse`) |

---

## 4. globe (`midground` / CONTENT WIDGET)

Source: `components/globe/{Globe.svelte, GlobeScene.svelte, GlobeMarkerItem.svelte, types.ts}`. Docs: https://motion-core.dev/docs/globe

A Fresnel-lit dotted globe (Fibonacci lattice points masked by a land texture) + additive atmosphere shell + marker layer with tooltips. Conceptually similar to cobe (Lane 4) but with rim glow, atmosphere, and a Svelte/OGL marker system.

### Shaders (structure captured; full GLSL is large)

> The globe fragment shader is large and lives inline in `GlobeScene.svelte`. Acquisition should pull the exact text from that file. Captured structure:

- Shared fullscreen-quad vertex shader (same as effects 1-3, with `vUv`).
- **Globe fragment shader** combines:
  - `nearestFibonacciLattice()` procedural point generation across the sphere (same family as cobe's lattice).
  - Land-mask sampling: `texture2D(uLandTexture, mapUv)` decides which lattice points are landmass.
  - Fresnel rim: `pow(1.0 - dotNV, rimPower) * rimIntensity`.
  - Marker overlay: blends marker colors over land dots with priority masking.
- **Atmosphere fragment shader**: additive glow shell, exponential falloff `falloff = exp(-pow(max(0.0, x), 1.2) * uAtmospherePower * 0.09)`, rendered as a second mesh with additive blending (`SRC_ALPHA, ONE`).

### OGL setup
- Two meshes (globe + atmosphere) rendered sequentially each frame.
- Uniforms: resolution, rotation (phi/theta), scale, point count, colors (base/rim/atmosphere/land), marker data arrays.
- **Asset:** `landTextureUrl` imported from `../../assets/land-texture.png` (equirectangular land mask), loaded via `Image`.

### Params

| param | type | default | notes |
|---|---|---|---|
| radius | range | 2 | sphere radius |
| pointCount | range | 15000 | Fibonacci lattice density |
| pointSize | range | 0.05 | dot size |
| landPointColor | color | `#f77114` | land dot color |
| autoRotate | toggle | true | spin |
| lockedPolarAngle | toggle | true | constrain tilt |
| fresnelConfig | (object) | default | rim glow config |
| atmosphereConfig | (object) | default | atmosphere config |
| markers | (custom) | [] | `GlobeMarker[]` - WIDGET data |
| markerTooltip | (snippet) | - | WIDGET tooltip - out of contract |
| focusOn | [lat,lng] / null | null | WIDGET focus control |

**Widget flag:** `markers`, `markerTooltip`, `focusOn` are data-viz/interaction concerns beyond tilt-lab's `Effect` contract. The visual globe (points + fresnel + atmosphere) fits `midground`; the marker/tooltip system does not.

---

## 5. glass-slideshow (CONTENT WIDGET - out-of-scope candidate)

Source: `components/glass-slideshow/{GlassSlideshow.svelte, GlassSlideshowScene.svelte}`. Docs: https://motion-core.dev/docs/glass-slideshow

Image carousel with an organic "glass bubble" transition (expanding sphere with refraction + chromatic aberration + liquid surface noise). GSAP animates `uProgress` 0->1 with power3.inOut between two slide textures. Owns slide index, autoplay timer, and image array - a widget, not a stackable layer. The **transition shader itself is salvageable** as a tilt-lab transition primitive.

### Fragment shader (verbatim)

```glsl
precision highp float;

uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform float uProgress;
uniform vec2 uResolution;
uniform vec2 uTexture1Size;
uniform vec2 uTexture2Size;

uniform float uGlobalIntensity;
uniform float uDistortionStrength;
uniform float uSpeedMultiplier;
uniform float uColorEnhancement;

uniform float uGlassRefractionStrength;
uniform float uGlassChromaticAberration;
uniform float uGlassBubbleClarity;
uniform float uGlassEdgeGlow;
uniform float uGlassLiquidFlow;

varying vec2 vUv;

vec3 srgbToLinear(vec3 color) {
	vec3 low = color / 12.92;
	vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
	vec3 cutoff = step(vec3(0.04045), color);
	return mix(low, high, cutoff);
}

vec3 linearToSrgb(vec3 color) {
	vec3 safe = max(color, vec3(0.0));
	vec3 low = safe * 12.92;
	vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
	vec3 cutoff = step(vec3(0.0031308), safe);
	return mix(low, high, cutoff);
}

vec2 getCoverUV(vec2 uv, vec2 textureSize) {
	vec2 s = uResolution / textureSize;
	float scale = max(s.x, s.y);
	vec2 scaledSize = textureSize * scale;
	vec2 offset = (uResolution - scaledSize) * 0.5;
	return (uv * uResolution - offset) / scaledSize;
}

float noise(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	return mix(
		mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
		mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

vec4 sampleLinear(sampler2D tex, vec2 uv) {
	vec4 c = texture2D(tex, uv);
	return vec4(srgbToLinear(c.rgb), c.a);
}

vec4 glassEffect(vec2 uv, float progress) {
	float glassStrength = 0.08 * uGlassRefractionStrength * uDistortionStrength * uGlobalIntensity;
	float chromaticAberration = 0.02 * uGlassChromaticAberration * uGlobalIntensity;
	float waveDistortion = 0.025 * uDistortionStrength;
	float clearCenterSize = 0.3 * uGlassBubbleClarity;
	float surfaceRipples = 0.004 * uDistortionStrength;
	float liquidFlow = 0.015 * uGlassLiquidFlow * uSpeedMultiplier;
	float rimLightWidth = 0.05;
	float glassEdgeWidth = 0.025;

	float brightnessPhase = smoothstep(0.8, 1.0, progress);
	float rimLightIntensity = 0.08 * (1.0 - brightnessPhase) * uGlassEdgeGlow * uGlobalIntensity;
	float glassEdgeOpacity = 0.06 * (1.0 - brightnessPhase) * uGlassEdgeGlow;

	vec2 center = vec2(0.5, 0.5);
	vec2 p = uv * uResolution;

	vec2 uv1 = getCoverUV(uv, uTexture1Size);
	vec2 uv2_base = getCoverUV(uv, uTexture2Size);

	float maxRadius = length(uResolution) * 0.85;
	float bubbleRadius = progress * maxRadius;
	vec2 sphereCenter = center * uResolution;

	float dist = length(p - sphereCenter);
	float normalizedDist = dist / max(bubbleRadius, 0.001);
	vec2 direction = (dist > 0.0) ? (p - sphereCenter) / dist : vec2(0.0);
	float inside = smoothstep(bubbleRadius + 3.0, bubbleRadius - 3.0, dist);

	float distanceFactor = smoothstep(clearCenterSize, 1.0, normalizedDist);
	float time = progress * 5.0 * uSpeedMultiplier;

	vec2 liquidSurface = vec2(
		smoothNoise(uv * 100.0 + time * 0.3),
		smoothNoise(uv * 100.0 + time * 0.2 + 50.0)
	) - 0.5;
	liquidSurface *= surfaceRipples * distanceFactor;

	vec2 distortedUV = uv2_base;
	if (inside > 0.0) {
		float refractionOffset = glassStrength * pow(distanceFactor, 1.5);
		vec2 flowDirection = normalize(direction + vec2(sin(time), cos(time * 0.7)) * 0.3);
		distortedUV -= flowDirection * refractionOffset;

		float wave1 = sin(normalizedDist * 22.0 - time * 3.5);
		float wave2 = sin(normalizedDist * 35.0 + time * 2.8) * 0.7;
		float wave3 = sin(normalizedDist * 50.0 - time * 4.2) * 0.5;
		float combinedWave = (wave1 + wave2 + wave3) / 3.0;

		float waveOffset = combinedWave * waveDistortion * distanceFactor;
		distortedUV -= direction * waveOffset + liquidSurface;

		vec2 flowOffset = vec2(
			sin(time + normalizedDist * 10.0),
			cos(time * 0.8 + normalizedDist * 8.0)
		) * liquidFlow * distanceFactor * inside;
		distortedUV += flowOffset;
	}

	vec4 newImg;
	if (inside > 0.0) {
		float aberrationOffset = chromaticAberration * pow(distanceFactor, 1.2);

		vec2 uv_r = distortedUV + direction * aberrationOffset * 1.2;
		vec2 uv_g = distortedUV + direction * aberrationOffset * 0.2;
		vec2 uv_b = distortedUV - direction * aberrationOffset * 0.8;

		vec3 sampleR = srgbToLinear(texture2D(uTexture2, uv_r).rgb);
		vec3 sampleG = srgbToLinear(texture2D(uTexture2, uv_g).rgb);
		vec3 sampleB = srgbToLinear(texture2D(uTexture2, uv_b).rgb);
		newImg = vec4(sampleR.r, sampleG.g, sampleB.b, 1.0);
	} else {
		newImg = sampleLinear(uTexture2, uv2_base);
	}

	if (inside > 0.0 && rimLightIntensity > 0.0) {
		float rim = smoothstep(1.0 - rimLightWidth, 1.0, normalizedDist) *
					(1.0 - smoothstep(1.0, 1.01, normalizedDist));
		newImg.rgb += rim * rimLightIntensity;

		float edge = smoothstep(1.0 - glassEdgeWidth, 1.0, normalizedDist) *
					 (1.0 - smoothstep(1.0, 1.01, normalizedDist));
		newImg.rgb = mix(newImg.rgb, vec3(1.0), edge * glassEdgeOpacity);
	}

	newImg.rgb = mix(newImg.rgb, newImg.rgb * 1.2, (uColorEnhancement - 1.0) * 0.5);

	vec4 currentImg = sampleLinear(uTexture1, uv1);

	if (progress > 0.95) {
		vec4 pureNewImg = sampleLinear(uTexture2, uv2_base);
		float endTransition = (progress - 0.95) / 0.05;
		newImg = mix(newImg, pureNewImg, endTransition);
	}

	return mix(currentImg, newImg, inside);
}

void main() {
	vec4 outColor = glassEffect(vUv, uProgress);
	gl_FragColor = vec4(linearToSrgb(outColor.rgb), outColor.a);
}
```

### Params

| param | type | default | notes |
|---|---|---|---|
| images | (asset[]) | - | slide image array |
| index | number | 0 | current slide (WIDGET state) |
| transitionDuration | range | 2000 | ms; GSAP drives `uProgress` |
| intensity | range | 1.0 | -> `uGlobalIntensity` |
| distortion | range | 1.0 | -> `uDistortionStrength` |
| chromaticAberration | range | 1.0 | -> `uGlassChromaticAberration` |
| refraction | range | 1.0 | -> `uGlassRefractionStrength` |
| autoplay | toggle | true | WIDGET timer |
| autoplayInterval | range | 5000 | ms; WIDGET timer |

---

## 6. infinite-gallery (CONTENT WIDGET - out-of-scope candidate)

Source: `components/infinite-gallery/{InfiniteGallery.svelte, InfiniteGalleryScene.svelte, ImagePlane.svelte}`. Docs: https://motion-core.dev/docs/infinite-gallery

A 3D tunnel of textured planes scrolling toward the camera, with cloth-like vertex deformation and per-plane fade/blur based on Z-depth. Owns scroll velocity, wheel/keyboard input, image array, and autoplay-after-idle. This is the ONE effect using real 3D plane geometry (not a fullscreen quad), with `modelViewMatrix`/`projectionMatrix`. Clearly a content widget.

### Vertex shader (verbatim) - scroll-driven cloth deformation

```glsl
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float scrollForce;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
	vUv = uv;
	vNormal = normal;

	vec3 pos = position;

	float curveIntensity = scrollForce * 0.3;
	float distanceFromCenter = length(pos.xy);
	float curve = distanceFromCenter * distanceFromCenter * curveIntensity;

	float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
	float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
	float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;

	pos.z -= (curve + clothEffect);

	gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

### Fragment shader (verbatim) - box blur + opacity

```glsl
precision highp float;

uniform sampler2D map;
uniform float opacity;
uniform float blurAmount;
uniform float scrollForce;
uniform vec2 uTextureSize;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
	vec4 color = texture2D(map, vUv);

	if (blurAmount > 0.0) {
		vec2 texelSize = 1.0 / max(uTextureSize, vec2(1.0));
		vec4 blurred = vec4(0.0);
		float total = 0.0;

		for (float x = -2.0; x <= 2.0; x += 1.0) {
			for (float y = -2.0; y <= 2.0; y += 1.0) {
				vec2 offset = vec2(x, y) * texelSize * blurAmount;
				float weight = 1.0 / (1.0 + length(vec2(x, y)));
				blurred += texture2D(map, vUv + offset) * weight;
				total += weight;
			}
		}
		color = blurred / total;
	}

	float curveHighlight = abs(scrollForce) * 0.05;
	color.rgb += vec3(curveHighlight * 0.1);

	gl_FragColor = vec4(color.rgb, color.a * opacity);
}
```

### Scroll logic (verbatim)

```typescript
scrollVelocity *= 0.95; // friction
let newZ = planeData.z + scrollVelocity * delta * 10;

if (newZ >= totalRange) {
	wrapsForward = Math.floor(newZ / totalRange);
	newZ -= totalRange * wrapsForward;
	planeData.imageIndex = (planeData.imageIndex + wrapsForward * imageAdvance) % totalImages;
}
```
Wheel + keyboard modify `scrollVelocity`; auto-play engages after 3s inactivity.

### Params

| param | type | default | notes |
|---|---|---|---|
| images | (asset[]) | - | `ImageItem[]` |
| speed | range | 1 | scroll speed |
| visibleCount | range | 8 | simultaneous planes |
| fadeSettings | (object) | fadeIn 0.05-0.15, fadeOut 0.85-0.95 | per-plane fade by depth |
| blurSettings | (object) | blurIn 0.0-0.1, blurOut 0.9-1.0, maxBlur 3.0 | per-plane blur by depth |

---

## License + attribution (all 6)

- **License: MIT** (repo states "Licensed under MIT"). Brief's `personal-only` assumption is incorrect - flagging.
- **Attribution**: motion-core project (github.com/motion-core/motion-core). Retain MIT notice.
- **redistribution: `ok`** for all six (MIT).

## Integration notes / gotchas (all)

1. **Svelte 5 + OGL, not React/Three.** Every component is `.svelte` with runes. The reusable layer is the **OGL renderer + GLSL** inside `*Scene.svelte`; the `.svelte` wrappers (props, DOM, GSAP wiring) must be re-authored for tilt-lab's framework. Bring OGL (`Renderer`, `Program`, `Mesh`, `Triangle`/`Plane`, `Texture`, `Vec2`, `Vec3`) or port the GL calls.
2. **Each Scene owns its own RAF** (see halo's `tick`). tilt-lab drives `frame(t)` externally - strip the internal `requestAnimationFrame` self-schedule and advance `uTime`/`uProgress`/`scrollForce` from the host clock. halo accumulates `uTime += delta`; map that to `frame(t)`.
3. **Color params are normalized RGB or hex** depending on component (halo/dithered accept hex strings; globe/dithered accept `[r,g,b]` or `{r,g,b}`). Normalize hex -> linear/normalized RGB before setting uniforms. Note the shaders do sRGB<->linear conversion internally (`linearToSrgb`/`srgbToLinear`) - keep that.
4. **Cover-UV math everywhere.** dithered, fake-3d, glass all use `getCoverUV` to fit images to the canvas aspect with a `cover` strategy, needing `uResolution` + per-texture sizes. Wire texture dimensions on load.
5. **dithered-image `post` caveat.** It dithers an **image texture** (`uTexture`), not the live framebuffer of layers beneath it. tilt-lab's `post` role implies transforming everything below. To use it as a real post layer, swap `uTexture` for the composited scene render target instead of an image asset. The dither logic (pixelate -> threshold-map -> step -> 2-color) ports directly.
6. **fake-3d-image needs a quality depth map.** Visual quality depends on the `depthSrc` grayscale map (motion-core recommends DepthPro). It is pointer-driven via `uMouse` - tilt-lab must feed smoothed pointer deltas (`sensitivity` controls smoothing app-side).
7. **globe needs `land-texture.png`** (equirectangular land mask) as a required asset, plus a marker/tooltip system that is out of contract.
8. **infinite-gallery uses 3D geometry + a camera.** Unlike the others (fullscreen quad), it needs `projectionMatrix`/`modelViewMatrix` and a per-plane scene graph. Heaviest to port; clearly a widget.

## Normalization sketch (-> Effect contract)

Applies to the three in-scope effects (dithered-image, halo, fake-3d-image); globe is adaptable as a midground object minus markers; glass-slideshow and infinite-gallery are widgets (harvest shaders only).

- **`init(canvas, { params, assets })`**: create an OGL `Renderer` on the canvas, a fullscreen `Triangle`/quad geometry, and a `Program` with the effect's vertex+fragment GLSL. Build the `localUniforms` map from params. Load `assets` into OGL `Texture`s (dithered: image + threshold map; fake-3d: color + depth; halo: none). Cache uniform refs. Do NOT start a RAF.
- **`frame(t)`**: advance the time-like uniform from the external clock - `uTime = t_seconds * speed` (halo), or hold static for input-driven effects (fake-3d updates from pointer, not time). Then `renderer.render({ scene, camera })`. One draw per host frame.
- **`resize(w, h)`**: set `renderer.width/height`, resize the canvas backing store by dpr, set `uResolution`. Recompute cover-UV scale/offset uniforms from new aspect + texture sizes.
- **`setParam(key, value)`**: map key -> uniform (`rotationSpeed`->`uRotationSpeed`, etc.). Colors: hex/array -> normalized RGB `Vec3`. `ditherMap`: swap the bound threshold-map texture. Pointer (fake-3d): write smoothed `uMouse`.
- **`dispose()`**: cancel any RAF, delete OGL program/geometry/textures, lose the GL context.

**Loop adaptation:** the universal change is removing each Scene's internal `requestAnimationFrame(tick)` and instead advancing `uTime`/`uProgress`/`scrollForce` inside tilt-lab's `frame(t)`. halo's `tick` shows the pattern to strip; glass-slideshow's GSAP `uProgress` tween would become a host-driven progress value.
