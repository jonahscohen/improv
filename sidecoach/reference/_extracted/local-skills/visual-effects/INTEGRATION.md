# visual-effects - Sidecoach Integration

Source: `/Users/spare3/.claude/skills/visual-effects/SKILL.md`
Plus reference implementations under `/Users/spare3/.claude/skills/visual-effects/shaders/` and `/Users/spare3/.claude/skills/visual-effects/fx/`

## What this skill provides

A combined skill for **generative shader backgrounds** and **transformative FX post-processing**. Two modes:

- **Generative**: create backgrounds, textures, and animated surfaces from nothing
- **Transformative**: apply visual effects to existing images or elements

Critically, the skill ships **actual shader source code** as canonical reference implementations - not just descriptions. Sidecoach can lift these verbatim.

## Generative Mode catalog

### Tier 1: Full Reference Implementations

Complete, production-tested source code in `shaders/<name>/`. Each directory has a README.md plus implementation files.

| Effect | Directory | Tech | Files | Description |
|---|---|---|---|---|
| **Mesh Gradient** | `shaders/mesh-gradient/` | Three.js + GLSL | README.md, shaders.ts | Subdivided plane with simplex noise vertex displacement. Per-vertex color via layered noise thresholding (5 colors). Bayer 4x4 ordered dithering + film grain post-processing. |
| **Fluid Simulation** | `shaders/fluid/` | WebGL 1.0 (raw GL) | README.md, FluidSimulation.tsx | Full GPU Navier-Stokes incompressible fluid solver. Semi-Lagrangian advection, Jacobi pressure solve, gradient subtraction. Mouse-driven force application with segment distance. 1M+ particles at high quality. Four quality tiers (ultra/high/medium/low). |
| **Fractal Glass** | `shaders/fractal-glass/` | Three.js + GLSL | README.md, (shader sources) | Physical glass material (MeshPhysicalMaterial) with procedural fluted geometry. Squircle-based flute normal computation. Real-time fluid simulation drives distortion. Procedural HDR environment map with multi-layer lighting. Bloom + tone mapping. |
| **Halftone Field** | `shaders/halftone/` | Three.js + GLSL | README.md, (shader sources) | CMYK halftone dot-screen effect over a fluid-simulated color field. Rotatable grid with arbitrary angle. Per-channel luminance lifting. Adjustable dot size, contrast curves, soft edges. |
| **Swarm** | `shaders/swarm/` | Canvas 2D | README.md, Swarm.tsx | Interactive particle swarm with spring physics. Per-dot orbit state (angle, speed). 6 shape types (circle, square, diamond, triangle, sparkle, cross). Cubic-eased attraction force, orbital jitter, return springs. Glow on displacement. |

### Tier 2: Specification + Reference GLSL

GLSL reference code in `shaders/`. Less battle-tested; implement from spec + reference, verify carefully.

| Effect | Directory | Description | Key Parameters |
|---|---|---|---|
| **Voronoi** | `shaders/voronoi/` | Worley noise cell patterns with configurable edges | cellCount (int), edgeWidth (float), colorStops (vec3[]), edgeColor (vec3) |
| **Liquid Metal** | `shaders/liquid-metal/` | Chrome/mercury surface with environment reflections | reflectivity, viscosity, turbulence, colorTint (vec3) |
| **Pulsar** | `shaders/pulsar/` | Radiating concentric rings with decay | frequency, decay, speed, colorStart (vec3), colorEnd (vec3) |
| **Black Hole** | `shaders/black-hole/` | Gravitational lensing distortion of background | strength, radius, rotationSpeed |
| **Spiral** | `shaders/spiral/` | Logarithmic spiral with color gradient | arms (int), tightness, rotationSpeed, colorStops (vec3[]) |
| **Dot Grid** | `shaders/dot-grid/` | Uniform dot matrix pattern | dotSize, spacing, color (vec3), pulseSpeed |
| **Particles** | `shaders/particles/` | Floating particle field with connections | count (int), drift, connectionDistance, mouseRepulsion |
| **Fireworks** | `shaders/fireworks/` | Burst particles with gravity and trails | burstCount (int), gravity, trailLength (int), colorSpread |
| **Chrome** | `shaders/chrome/` | Reflective chrome surface | roughness, environmentIntensity, warpSpeed |

## Transformative Mode catalog

Under `/Users/spare3/.claude/skills/visual-effects/fx/`:
- art.md
- ascii.md
- dither.md
- glitch.md
- halftone-post.md
- post-processing.md

### ASCII (8 variants)

| Variant | Character Set | Best For |
|---|---|---|
| Standard | ` .:-=+*#%@` | General purpose, balanced density |
| Dense | `$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\|()1{}[]?-_+~<>i!lI;:,"^.` | High detail, photos |
| Minimal | ` .:*#` | Clean, sparse, large text |
| Blocks | ` ░▒▓█` | Block-art style, retro terminals |
| Braille | Unicode braille patterns (U+2800-U+28FF) | High resolution in small space |
| Technical | `01` | Binary/matrix aesthetic |
| Matrix | Katakana + Latin + digits, falling columns | Animated matrix rain effect |
| Hatching | `/ \ \| - X` | Crosshatch illustration style |

Algorithm: map pixel luminance to character index. For colored ASCII, preserve source pixel hue/saturation, apply to character.

### Dither (6 algorithms)

| Algorithm | Kernel | Character |
|---|---|---|
| Floyd-Steinberg | 7/16, 3/16, 5/16, 1/16 | Classic, smooth, most popular |
| Atkinson | 1/8 per 6 neighbors | High contrast, retro Mac feel |
| Stucki | 8/42, 4/42, 2/42... (12 neighbors) | Smoother than Floyd-Steinberg |
| Sierra | 5/32, 3/32, 2/32... (10 neighbors) | Balance of speed and quality |
| Jarvis-Judice-Ninke | 7/48, 5/48, 3/48... (12 neighbors) | Highest quality, slowest |
| Burkes | 8/32, 4/32, 2/32 (7 neighbors) | Fast, good quality |

Common parameters: palette (color[]), threshold (float), serpentine (bool - alternates scan direction per row).

### Glitch (4 types)

| Type | Visual Effect | Technique |
|---|---|---|
| VHS | Scanline offset + color bleed + tracking artifacts | Horizontal line displacement, chroma subsampling simulation |
| Digital | Block displacement + corruption artifacts | Random rectangular regions shifted/duplicated |
| Chromatic Aberration | RGB channel split | Offset R/G/B channels by different amounts |
| Data Moshing | Frame buffer corruption simulation | Blend/shift rectangular regions from previous frame |

### Halftone (3 modes)

| Mode | Description |
|---|---|
| Mono | Single-color dot pattern on contrasting background |
| CMYK | Four-color separation with rotated screen angles (C:15, M:75, Y:0, K:45) |
| Custom | User-specified dot shape, angle, frequency, colors |

### Art (5 styles)

| Style | Technique | Visual Result |
|---|---|---|
| Kuwahara | Anisotropic smoothing filter | Painterly, oil-painting look |
| Crosshatch | Directional line shading based on luminance | Pen-and-ink illustration |
| Line Art | Edge detection (Sobel/Canny) + thresholding | Clean line drawing |
| Engraving | Parallel lines with density modulation | Currency/banknote engraving style |
| Stipple | Dot density mapping (weighted Voronoi) | Pointillism illustration |

## Post-Processing Stack (stackable, apply in order)

| Effect | Parameters | GPU Cost | Notes |
|---|---|---|---|
| Scanlines | lineWidth, opacity, speed | Low | |
| Vignette | radius, softness, color | Low | Apply last or near-last |
| Grain | intensity, speed, colored (bool) | Low | |
| Bloom | threshold, intensity, radius | Medium | Apply before grain |
| Pixelate | blockSize | Low | |
| Chromatic Aberration | offsetR, offsetG, offsetB | Low | |
| Color Shift | hueRotation, saturation, brightness | Low | |
| Curvature | strength, type (barrel/pincushion) | Low | |
| Grid Overlay | size, color, opacity | Low | |
| Jitter | amount, speed | Low | |
| Light Beams | angle, intensity, count | Medium | |
| Motion Blur | angle, strength | Medium | |
| Noise | amount, type (gaussian/uniform) | Low | |
| Palette Mapping | palette (color[]), method (nearest/dither) | Low | |
| RGB Glitch | blockSize, intensity, speed | Low | |
| Sepia | intensity | Low | |
| Wave Distortion | amplitude, frequency, speed | Low | |

### Compositing order constraints
- Bloom BEFORE grain (grain in bloomed areas looks muddy)
- Vignette LAST or near-last
- Chromatic aberration BEFORE pixelate
- Palette mapping AFTER all color adjustments

## Combination grammar

### Pairs well
- Fluid base + halftone post-process (= halftone-field effect)
- Mesh gradient + grain + vignette (classic hero background)
- Swarm + bloom (glowing particle field)
- Particles + scanlines (sci-fi terminal aesthetic)
- Voronoi + color shift (abstract cellular patterns)
- Dot grid + subtle noise (textured pattern background)

### Clashes (avoid)
- Multiple distortion effects stacked (wave + curvature + jitter = unreadable mess)
- Glitch + halftone (competing visual patterns fight for attention)
- Heavy bloom + heavy grain (visual mud)
- ASCII + any other transformative effect (ASCII replaces image entirely)

### Recommended stacks for common use cases

| Use Case | Primary Effect | Post-Processing |
|---|---|---|
| Hero background | Mesh gradient | Grain (0.02), Vignette (soft) |
| Card/section texture | Dot grid or Voronoi | Noise (subtle), Color shift (to match palette) |
| Loading state | Pulsar or Particles | Bloom (gentle) |
| Interactive showcase | Fluid simulation | None (already complex) |
| Decorative border | Voronoi (low opacity) | None |
| Artistic header | Fractal glass | Bloom (0.3), Grain (0.01) |
| Retro/terminal feel | Any content + ASCII or Scanlines | Vignette, Grain, Color shift (green/amber) |
| Print/editorial | Content + Halftone (mono) | Grain (0.01) |

## How sidecoach should query this skill

### Trigger conditions

Auto-trigger keywords from SKILL.md description:
- "shader", "gradient background", "animated background"
- "fluid", "glass effect", "halftone", "ASCII art", "dither", "glitch"
- "particles", "generative", "procedural"
- "visual effect", "post-processing", "texture", "noise"
- "mesh gradient", "fractal", "swarm", "voronoi", "chrome", "liquid metal"
- "fireworks", "dot grid", "pulsar", "spiral", "black hole"

### Which sidecoach flows should query this skill

| Sidecoach flow | When to query | What to extract |
|---|---|---|
| **Flow craft (when generative texture needed)** | Hero section, background surface, decorative texture, loading state | Tier 1 reference impl + DESIGN.md color tokens |
| **Flow shape** | When the spec mentions atmosphere/feel that maps to a shader | Effect recommendation per "use case" table |
| **Flow E (motion-patterns)** | When the motion need is generative (particle field, fluid drag) | Swarm, Fluid, Particles refs |
| **Flow F (design-tokens)** | When tokenizing background surfaces | Effect choice as a token, parameter values as tokens |
| **Flow N (audit)** | During performance audit | GPU cost column - flag Medium-cost effects on mobile/low-power, flag compositing-order violations |
| **Flow visual-effects (new)** | Direct invocation | Pick effect + post-stack from grammar tables |

### Query shape

```typescript
{
  source: 'visual-effects',
  mode: 'generative' | 'transformative',
  useCase: 'hero-background' | 'card-texture' | 'loading-state'
    | 'interactive-showcase' | 'decorative-border' | 'artistic-header'
    | 'retro-terminal' | 'print-editorial',
  techConstraints: {
    framework: 'react' | 'vanilla' | 'three' | 'webgl' | 'canvas2d',
    mobile: boolean,                  // affects GPU cost tolerance
    bundleSizeBudget: number,
  },
  brandColors: string[],              // from DESIGN.md, REPLACE shader defaults
  expectedOutput: {
    effectName: string,
    referenceImpl: string,            // path to shader source
    postStack: PostEffect[],          // ordered list per compositing constraints
    parameters: Record<string, number | string>,
    rationale: string,                // why this effect for this use case
    pairsWith: string[],
    avoids: string[],
  },
}
```

### Implementation pattern (sidecoach must lift, not regenerate)

For Tier 1 effects, sidecoach should:
1. Read the README.md in `shaders/<effect>/`
2. Read the source files (GLSL or TypeScript)
3. Adapt to target project's tech stack:
   - Three.js project: use GLSL shaders directly with Three.js setup from reference
   - Raw WebGL: use GLSL with own GL context
   - React: wrap in component following reference's React pattern
   - Non-JS: port GLSL to target platform's shader language
4. **Apply DESIGN.md tokens for colors** (don't use reference's default palette)

For Tier 2 effects, sidecoach should implement from spec + reference and verify carefully.

### Compositing-order audit rules

Sidecoach Flow N should validate generated post-processing stacks:
- Reject if grain comes before bloom
- Reject if vignette is not last or near-last
- Reject if pixelate comes before chromatic aberration
- Reject if palette mapping comes before color adjustments
- Warn on clash combinations (wave+curvature+jitter; glitch+halftone; heavy bloom+heavy grain)

## What sidecoach is currently missing

1. **No `/sidecoach effect <use-case>` verb.** Generative texture decisions currently route through generic craft; should have dedicated flow that picks from the recommended-stack table.
2. **No reference-impl loading.** When a flow needs a mesh gradient, sidecoach doesn't read `shaders/mesh-gradient/README.md` and adapt - it regenerates from scratch.
3. **No compositing-order audit rules in Flow N.** The 159-rule validator doesn't enforce bloom-before-grain, vignette-last, etc.
4. **No GPU-cost-vs-mobile guard.** Medium-cost effects (Bloom, Light Beams, Motion Blur) should be flagged on mobile builds.
5. **No token-driven color injection.** DESIGN.md colors are not piped into shader uniforms - shaders ship with default palettes that should be replaced.

## Gaps in the skill itself

- Tier 2 effects have parameters but no reference implementation depth - relies on agent to write the GLSL from spec
- No bundle-size data per effect (would inform mobile recommendations)
- No "use case → effect" reverse index built into the file structure
- The fx/*.md files were not read in detail in this audit pass - worth a follow-up read for the transformative-mode catalog

## What's well-stocked

- 5 Tier-1 effects with real, production-tested source code
- 9 Tier-2 effects with GLSL reference
- 17 post-processing effects with parameters and GPU cost
- Compositing order constraints (specific, enforceable)
- Combination grammar (pairs well / clashes / recommended stacks)
- This is the most "data-rich" of the 8 audited skills - sidecoach can lift the most from here directly
