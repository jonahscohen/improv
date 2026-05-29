# Lane 7 - unlumen aurora-card (animated aurora background)

Recon by Jonah. RECON ONLY.

- **Effect:** `aurora` - the animated aurora that fills the card background (the `AuroraBlur` element), NOT the card chrome/border/glow overlays.
- **Source page:** https://ui.unlumen.com/components/aurora-card
- **Tech:** WebGL via **react-three-fiber** (`@react-three/fiber` + three.js). A single fullscreen `planeGeometry([2,2])` + `shaderMaterial`; a GLSL fragment shader draws 4 layered value-noise "aurora" bands over a 2-stop vertical sky gradient. Driven by R3F `useFrame` (feeds `u_time` + resolution).
- **layerRole:** `background`.
- **redistribution:** `personal-only` (unlumen UI is a commercial, license-key-gated component library; the docs page gates the real source behind `UNLUMEN_LICENSE_KEY`).

## How the source was obtained

The docs page only shows API tables; the implementation files (`aurora-card.tsx`, `aurora-blur.tsx`) are license-gated. But the live demo ships its compiled code in the public Next.js bundle. I downloaded all `/_next/static/chunks/*.js`, located the aurora implementation in chunk `37863-3520c67c84fa5450.js` (module id `30019`, exporting `AuroraBlur`), and extracted the shader strings, default uniforms, and component config **verbatim** from that bundle. The react-three-fiber `<Canvas>` glue is in chunk `72777-1de711bfa4c9a8dc.js` (it imports `THREE.*`, `useFrame`, `@react-three`). De-minified identifiers below are renamed for readability; **all GLSL, colors, and numeric defaults are verbatim**.

Caveat: the chunk `37863` also bundles unrelated unlumen effects (a Stam fluid sim with advect/divergence/pressure shaders, and a pixel/dither fluid display shader). Those belong to OTHER components and are NOT part of aurora-card. Only the `aurora()` shader below is this effect.

---

## VERBATIM source

### Fragment shader (the aurora)

```glsl
precision highp float;
varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform vec3 u_layer1Color;
uniform float u_layer1Speed;
uniform float u_layer1Intensity;
uniform vec3 u_layer2Color;
uniform float u_layer2Speed;
uniform float u_layer2Intensity;
uniform vec3 u_layer3Color;
uniform float u_layer3Speed;
uniform float u_layer3Intensity;
uniform vec3 u_layer4Color;
uniform float u_layer4Speed;
uniform float u_layer4Intensity;
uniform float u_noiseScale;
uniform float u_movementX;
uniform float u_movementY;
uniform float u_verticalFade;
uniform float u_bloomIntensity;
uniform vec3 u_skyColor1;
uniform vec3 u_skyColor2;
uniform float u_skyBlend1;
uniform float u_skyBlend2;
uniform float u_brightness;
uniform float u_saturation;
uniform float u_opacity;

float hashNoise(float n) { return fract(sin(n) * 43758.5453123); }

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hashNoise(i.x + hashNoise(i.y)), hashNoise(i.x + 1.0 + hashNoise(i.y)), u.x),
    mix(hashNoise(i.x + hashNoise(i.y + 1.0)), hashNoise(i.x + 1.0 + hashNoise(i.y + 1.0)), u.x),
    u.y
  );
}

vec3 aurora(vec2 uv, float layerSpeed, float intensity, vec3 color, float aspect) {
  float time = u_time * u_speed * layerSpeed;
  vec2 scaled = vec2(uv.x * aspect, uv.y) * u_noiseScale;
  vec2 point = scaled + time * vec2(u_movementX, u_movementY);
  float n = noise2d(point + noise2d(color.xy + point + time));
  float alpha = n - uv.y * u_verticalFade;
  return color * alpha * intensity * u_bloomIntensity;
}

vec3 saturateColor(vec3 color, float saturation) {
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(gray), color, saturation);
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;

  vec3 color = vec3(0.0);
  color += aurora(uv, u_layer1Speed, u_layer1Intensity, u_layer1Color, aspect);
  color += aurora(uv, u_layer2Speed, u_layer2Intensity, u_layer2Color, aspect);
  color += aurora(uv, u_layer3Speed, u_layer3Intensity, u_layer3Color, aspect);
  color += aurora(uv, u_layer4Speed, u_layer4Intensity, u_layer4Color, aspect);

  color += u_skyColor2 * (1.0 - smoothstep(u_skyBlend1, 1.0, uv.y));
  color += u_skyColor1 * (1.0 - smoothstep(0.0, u_skyBlend2, uv.y));

  color = saturateColor(color, u_saturation) * u_brightness;

  gl_FragColor = vec4(color, u_opacity);
}
```

### Vertex shader (standard R3F fullscreen quad)

```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Mesh + uniforms (R3F, de-minified, defaults verbatim)

```jsx
// Inner mesh component - updated every frame by useFrame
function AuroraMesh({ speed, layers, noiseScale, movementX, movementY,
                      verticalFade, bloomIntensity, skyLayers, brightness,
                      saturation, opacity }) {
  const ref = useRef(null);
  const { size } = useThree();          // r3f hook -> drawing buffer size

  const uniforms = useMemo(() => ({
    u_time:            { value: 0 },
    u_resolution:      { value: new THREE.Vector2(1, 1) },
    u_speed:           { value: 1 },
    u_layer1Color:     { value: new THREE.Vector3(0.13, 0.83, 0.93) },  // #22d3ee
    u_layer1Speed:     { value: 0.35 },
    u_layer1Intensity: { value: 0.7 },
    u_layer2Color:     { value: new THREE.Vector3(0.23, 0.51, 0.96) },  // #3b82f6
    u_layer2Speed:     { value: 0.18 },
    u_layer2Intensity: { value: 0.65 },
    u_layer3Color:     { value: new THREE.Vector3(0.38, 0.65, 0.98) },  // #60a5fa
    u_layer3Speed:     { value: 0.12 },
    u_layer3Intensity: { value: 0.4 },
    u_layer4Color:     { value: new THREE.Vector3(0.11, 0.31, 0.85) },  // #1d4ed8
    u_layer4Speed:     { value: 0.08 },
    u_layer4Intensity: { value: 0.22 },
    u_noiseScale:      { value: 3.2 },
    u_movementX:       { value: -1.4 },
    u_movementY:       { value: -2.6 },
    u_verticalFade:    { value: 0.5 },
    u_bloomIntensity:  { value: 1.9 },
    u_skyColor1:       { value: new THREE.Vector3(0.01, 0.02, 0.09) },  // #020617
    u_skyColor2:       { value: new THREE.Vector3(0.06, 0.09, 0.16) },  // #0f172a
    u_skyBlend1:       { value: 0.78 },
    u_skyBlend2:       { value: 0.52 },
    u_brightness:      { value: 0.92 },
    u_saturation:      { value: 1.12 },
    u_opacity:         { value: 1 },
  }), []);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material;
    const L = layers.length ? layers : DEFAULT_LAYERS;
    const S = skyLayers.length ? skyLayers : DEFAULT_SKY;
    mat.uniforms.u_time.value = state.clock.elapsedTime;
    mat.uniforms.u_resolution.value.set(size.width, size.height);
    mat.uniforms.u_speed.value = speed;
    // layer1..4: color = hexToRgb(L[i].color), speed = L[i].speed, intensity = L[i].intensity
    // (falls back to DEFAULT_LAYERS[i] per field)
    // sky: u_skyColor1 = hexToRgb(S[0].color); u_skyBlend2 = S[0].blend
    //      u_skyColor2 = hexToRgb(S[1].color); u_skyBlend1 = S[1].blend
    // u_noiseScale/u_movementX/u_movementY/u_verticalFade/u_bloomIntensity
    // /u_brightness/u_saturation/u_opacity <- corresponding props
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        fragmentShader={AURORA_FRAG}
        vertexShader={AURORA_VERT}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

// Exported wrapper - default props are the verbatim defaults
function AuroraBlur({
  width = "100%", height = "100%", className, children,
  speed = 1.1,
  layers = DEFAULT_LAYERS,
  noiseScale = 3.2,
  movementX = -1.4,
  movementY = -2.6,
  verticalFade = 0.5,
  bloomIntensity = 1.9,
  skyLayers = DEFAULT_SKY,
  brightness = 0.92,
  saturation = 1.12,
  opacity = 1,
  style, ...rest
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}
         style={{ ...style, width, height }} {...rest}>
      <Canvas /* react-three-fiber */>
        <AuroraMesh {...{speed, layers, noiseScale, movementX, movementY,
          verticalFade, bloomIntensity, skyLayers, brightness, saturation, opacity}} />
      </Canvas>
      {children}
    </div>
  );
}

const DEFAULT_LAYERS = [
  { color: "#22d3ee", speed: 0.35, intensity: 0.7  },
  { color: "#3b82f6", speed: 0.18, intensity: 0.65 },
  { color: "#60a5fa", speed: 0.12, intensity: 0.4  },
  { color: "#1d4ed8", speed: 0.08, intensity: 0.22 },
];
const DEFAULT_SKY = [
  { color: "#020617", blend: 0.52 },
  { color: "#0f172a", blend: 0.78 },
];

// hexToRgb: parses "#rrggbb" -> [r/255,g/255,b/255]; falls back to
// getComputedStyle(span).color for named/other CSS colors; [1,1,1] on failure.
```

### How aurora-card positions the AuroraBlur (verbatim classes)

The card mounts `AuroraBlur` as the background layer, rotated and scaled, with a CSS `blur(14px)` filter applied at the card level (NOT inside AuroraBlur), plus radial-gradient "glow" overlays stacked above it:

```jsx
<div className="pointer-events-none absolute inset-0 overflow-hidden">
  <AuroraBlur
    className="absolute -left-[34%] bottom-[-18%] h-[82%] w-[128%]
               origin-bottom-left rotate-[-18deg] scale-[1.24]
               opacity-95 blur-[14px]"
    height="100%" width="100%"
    layers={DEFAULT_LAYERS} skyLayers={DEFAULT_SKY} />
  <div className="absolute inset-0
       bg-[radial-gradient(circle_at_18%_84%,var(--aurora-card-glow-1),transparent_20%),
           radial-gradient(circle_at_36%_68%,var(--aurora-card-glow-2),...)]" />
  {/* ...card chrome above... */}
</div>
```

The rotate/scale/blur/glow are card styling, not part of the reusable aurora. For tilt-lab the aurora itself is just the full-bleed shader; the rotation+blur+glow can be replicated as an optional CSS post-treatment.

---

## Proposed manifest

```yaml
id: aurora
name: Aurora
category: aurora
layerRole: background
origin: unlumen UI (https://ui.unlumen.com/components/aurora-card) - AuroraBlur
license: commercial (unlumen UI, license-key gated)
attribution: unlumen UI
redistribution: personal-only
tags: [aurora, value-noise, layered, sky-gradient, webgl, react-three-fiber, threejs, background]
requiredAssets: []   # no textures/images; pure procedural shader
```

Params (the 4 aurora layers + 2 sky stops are arrays; flatten or expose as grouped controls):

| param | type | default | min | max | notes |
|---|---|---|---|---|---|
| speed | range | 1.1 | 0 | ~3 | global `u_speed` time multiplier |
| layer1Color | color | #22d3ee | - | - | |
| layer1Speed | range | 0.35 | 0 | ~1 | per-layer time mult |
| layer1Intensity | range | 0.7 | 0 | ~2 | |
| layer2Color | color | #3b82f6 | - | - | |
| layer2Speed | range | 0.18 | 0 | ~1 | |
| layer2Intensity | range | 0.65 | 0 | ~2 | |
| layer3Color | color | #60a5fa | - | - | |
| layer3Speed | range | 0.12 | 0 | ~1 | |
| layer3Intensity | range | 0.4 | 0 | ~2 | |
| layer4Color | color | #1d4ed8 | - | - | |
| layer4Speed | range | 0.08 | 0 | ~1 | |
| layer4Intensity | range | 0.22 | 0 | ~2 | |
| noiseScale | range | 3.2 | 0.5 | ~10 | value-noise frequency |
| movementX | range | -1.4 | -5 | 5 | drift x |
| movementY | range | -2.6 | -5 | 5 | drift y |
| verticalFade | range | 0.5 | 0 | 2 | fades aurora toward top (uv.y) |
| bloomIntensity | range | 1.9 | 0 | ~4 | overall aurora gain |
| skyColor1 | color | #020617 | - | - | lower sky stop (blend 0.52) |
| skyColor2 | color | #0f172a | - | - | upper sky stop (blend 0.78) |
| skyBlend1 | range | 0.78 | 0 | 1 | upper smoothstep edge |
| skyBlend2 | range | 0.52 | 0 | 1 | lower smoothstep edge |
| brightness | range | 0.92 | 0 | ~2 | final multiplier |
| saturation | range | 1.12 | 0 | ~2 | mix toward luma |
| opacity | range | 1 | 0 | 1 | output alpha |

---

## License + attribution

- **Author/site:** unlumen UI - https://ui.unlumen.com (component `aurora-card`, primitive `AuroraBlur`).
- **License type:** commercial / proprietary. Source is gated behind `UNLUMEN_LICENSE_KEY` for install. The shader/JS here was reconstructed from the publicly-served demo bundle for characterization only.
- **redistribution:** `personal-only` (per brief; do not republish unlumen's source). For a shippable build, the technique (4 layered value-noise bands over a 2-stop sky smoothstep) is trivial and could be re-implemented clean if redistribution beyond personal use is ever needed - mark such a rebuild `reimplemented`.

---

## Integration notes / gotchas

- **Deps:** three.js + @react-three/fiber. For tilt-lab's plain `Effect` contract (raw canvas, no React), drop R3F and run the shader on a bare WebGL quad - the shader is self-contained and needs only `u_time` + `u_resolution` driven externally; everything else is a static uniform until changed.
- **No assets:** fully procedural (value noise via `hashNoise`/`sin`). `requiredAssets: []`.
- **Aspect-correct:** the shader reads `u_resolution` to compute `aspect = x/y` and only scales `uv.x` by it - keep `u_resolution` synced to the real backing pixel size or the bands stretch.
- **Additive bands, no clamp:** `gl_FragColor` is not clamped; with high `bloomIntensity`/`intensity` it can exceed 1.0 and rely on the framebuffer to clamp. Output uses straight alpha = `u_opacity` (so it composites as a background; `transparent: true` on the material).
- **`uv.y` orientation:** `verticalFade` and the two sky smoothsteps assume `uv.y` increases upward (R3F plane uv). On a raw GL quad confirm uv orientation or the sky/aurora vertical falloff inverts.
- **Card-level blur:** the soft look on the demo comes partly from a CSS `blur(14px)` + rotate(-18deg) + scale(1.24) on the wrapper, plus radial glow overlays - those are card decoration, optional for the effect.
- **devicePixelRatio:** R3F `<Canvas>` defaults to capped dpr; a raw port should `Math.min(dpr, 2)`.

## Normalization sketch (-> init / frame / resize / setParam / dispose)

- `init(canvas, {params})`: create a WebGL(2) context on the supplied canvas; compile the verbatim vertex + aurora fragment shaders; build one fullscreen quad (two triangles covering clip space, or `planeGeometry([2,2])` if staying on three.js); create the uniform block from `params` (or the verbatim defaults). Set `u_resolution` from canvas size.
- `frame(t)`: set `u_time = t` (seconds) and re-render the quad. No internal RAF - this maps cleanly since the effect only animates via `u_time` (it does NOT own a clock beyond R3F's; replace `state.clock.elapsedTime` with the injected `t`).
- `resize(w, h)`: set viewport + `u_resolution.set(w, h)`.
- `setParam(key, value)`: write the matching uniform (`u_layerNColor` via hexToRgb, `u_noiseScale`, `u_movementX/Y`, `u_speed`, sky colors/blends, `u_brightness`, `u_saturation`, `u_opacity`, `u_bloomIntensity`, `u_verticalFade`). Layer/sky arrays map to the indexed `u_layerN*` / `u_sky*` uniforms.
- `dispose()`: delete program, buffers, and (if three.js) geometry/material/renderer. No event listeners, no pointer dependency (this effect is NOT pointer-driven).
- This is one of the lightest WebGL effects in the set: a single non-ping-pong fragment pass, no FBOs, no pointer, no assets.
