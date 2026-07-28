---
name: visual-effects
description: Generative shader backgrounds and transformative FX post-processing effects. Two modes - generative (create backgrounds/textures from nothing) and transformative (apply effects to existing images/elements). Ships actual shader source code as canonical reference implementations. Invoke this skill when the task involves "shader", "gradient background", "animated background", "fluid", "glass effect", "halftone", "ASCII art", "dither", "glitch", "particles", "generative", "procedural", "visual effect", "post-processing", "texture", "noise", "mesh gradient", "fractal", "swarm", "voronoi", "chrome", "liquid metal", "fireworks", "dot grid", "pulsar", "spiral", "black hole".
---

# Visual Effects

Combined skill for generative shader backgrounds and transformative FX post-processing. Two modes:

- **Generative**: create backgrounds, textures, and animated surfaces from nothing
- **Transformative**: apply visual effects to existing images or elements

## Generative Mode: Shader Backgrounds

### Tier 1: Full Reference Implementations

These effects have complete, production-tested source code in the `shaders/` subdirectory of this skill. When implementing any of these, read the reference source and adapt to the target project's tech stack.

| Effect | Directory | Tech | Description |
|---|---|---|---|
| Mesh Gradient | `shaders/mesh-gradient/` | Three.js + GLSL | Subdivided plane with simplex noise vertex displacement. Per-vertex color via layered noise thresholding (5 colors). Bayer 4x4 ordered dithering + film grain post-processing. |
| Fluid Simulation | `shaders/fluid/` | WebGL 1.0 (raw GL) | Full GPU Navier-Stokes incompressible fluid solver. Semi-Lagrangian advection, Jacobi pressure solve, gradient subtraction. Mouse-driven force application with segment distance. 1M+ particles at high quality. Four quality tiers (ultra/high/medium/low). |
| Fractal Glass | `shaders/fractal-glass/` | Three.js + GLSL | Physical glass material (MeshPhysicalMaterial) with procedural fluted geometry. Squircle-based flute normal computation. Real-time fluid simulation drives distortion. Procedural HDR environment map with multi-layer lighting (softbox, fill, bounce). Bloom + tone mapping. |
| Halftone Field | `shaders/halftone/` | Three.js + GLSL | CMYK halftone dot-screen effect over a fluid-simulated color field. Rotatable grid with arbitrary angle. Per-channel luminance lifting (brightens darks without desaturation). Adjustable dot size, contrast curves, and soft edges. |
| Swarm | `shaders/swarm/` | Canvas 2D | Interactive particle swarm with spring physics. Per-dot orbit state (angle, speed). 6 shape types (circle, square, diamond, triangle, sparkle, cross). Cubic-eased attraction force, orbital jitter, return springs. Glow on displacement. |

#### Using Tier 1 effects

1. Read the README.md in the effect's directory for parameters, usage notes, and visual description
2. Read the source files (GLSL or TypeScript) for the implementation
3. Adapt to the target project's tech stack:
   - Three.js project: use the GLSL shaders directly with Three.js setup from the reference
   - Raw WebGL: use the GLSL shaders with your own GL context setup
   - React: wrap in a component following the reference's React pattern
   - Non-JS: port the GLSL algorithms to the target platform's shader language
4. Apply DESIGN.md tokens for colors (don't use the reference's default palette)

### Tier 2: Specification + Reference GLSL

These effects have GLSL reference code in the `shaders/` directory but are less battle-tested than Tier 1. Implement from the spec and reference, verify carefully.

| Effect | Directory | Description | Key Parameters |
|---|---|---|---|
| Voronoi | `shaders/voronoi/` | Worley noise cell patterns with configurable edges | cellCount (int), edgeWidth (float), colorStops (vec3[]), edgeColor (vec3) |
| Liquid Metal | `shaders/liquid-metal/` | Chrome/mercury surface with environment reflections | reflectivity (float), viscosity (float), turbulence (float), colorTint (vec3) |
| Pulsar | `shaders/pulsar/` | Radiating concentric rings with decay | frequency (float), decay (float), speed (float), colorStart (vec3), colorEnd (vec3) |
| Black Hole | `shaders/black-hole/` | Gravitational lensing distortion of background | strength (float), radius (float), rotationSpeed (float) |
| Spiral | `shaders/spiral/` | Logarithmic spiral with color gradient | arms (int), tightness (float), rotationSpeed (float), colorStops (vec3[]) |
| Dot Grid | `shaders/dot-grid/` | Uniform dot matrix pattern | dotSize (float), spacing (float), color (vec3), pulseSpeed (float) |
| Particles | `shaders/particles/` | Floating particle field with connections | count (int), drift (float), connectionDistance (float), mouseRepulsion (float) |
| Fireworks | `shaders/fireworks/` | Burst particles with gravity and trails | burstCount (int), gravity (float), trailLength (int), colorSpread (float) |
| Chrome | `shaders/chrome/` | Reflective chrome surface | roughness (float), environmentIntensity (float), warpSpeed (float) |

## Transformative Mode: FX Post-Processing

### ASCII (8 variants)

Convert images to text-based representations. Each variant uses a different character set and density mapping.

| Variant | Character Set | Best For |
|---|---|---|
| Standard | ` .:-=+*#%@` | General purpose, balanced density |
| Dense | `$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^\`.` | High detail, photos |
| Minimal | ` .:*#` | Clean, sparse, large text |
| Blocks | `  ░▒▓█` | Block-art style, retro terminals |
| Braille | Unicode braille patterns (U+2800-U+28FF) | High resolution in small space |
| Technical | `01` | Binary/matrix aesthetic |
| Matrix | Katakana + Latin + digits, falling columns | Animated matrix rain effect |
| Hatching | `/ \\ | - X` | Crosshatch illustration style |

**Algorithm:** Map pixel luminance to character index. For colored ASCII, preserve the source pixel's hue/saturation and apply it to the character.

### Dither (6 algorithms)

Reduce images to limited color palettes using error diffusion.

| Algorithm | Kernel | Character |
|---|---|---|
| Floyd-Steinberg | 7/16, 3/16, 5/16, 1/16 | Classic, smooth, most popular |
| Atkinson | 1/8 per 6 neighbors | High contrast, retro Mac feel |
| Stucki | 8/42, 4/42, 2/42... (12 neighbors) | Smoother than Floyd-Steinberg |
| Sierra | 5/32, 3/32, 2/32... (10 neighbors) | Balance of speed and quality |
| Jarvis-Judice-Ninke | 7/48, 5/48, 3/48... (12 neighbors) | Highest quality, slowest |
| Burkes | 8/32, 4/32, 2/32 (7 neighbors) | Fast, good quality |

**Common parameters:** palette (color[]), threshold (float), serpentine (bool - alternates scan direction per row for even distribution).

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
| Custom | User-specified dot shape, angle, frequency, and colors |

### Art (5 styles)

| Style | Technique | Visual Result |
|---|---|---|
| Kuwahara | Anisotropic smoothing filter | Painterly, oil-painting look |
| Crosshatch | Directional line shading based on luminance | Pen-and-ink illustration |
| Line Art | Edge detection (Sobel/Canny) + thresholding | Clean line drawing |
| Engraving | Parallel lines with density modulation | Currency/banknote engraving style |
| Stipple | Dot density mapping (weighted Voronoi) | Pointillism illustration |

## Post-Processing Stack

These effects are stackable. Apply in the declared order. Each effect operates on the output of the previous one.

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

### Compositing Order Constraints
- Bloom BEFORE grain (grain in bloomed areas looks muddy)
- Vignette LAST or near-last (it's a final framing pass)
- Chromatic aberration BEFORE pixelate (sub-pixel offsets disappear after pixelation)
- Palette mapping AFTER all color adjustments

## Combination Grammar

### Pairs Well
- Fluid base + halftone post-process (the halftone-field effect IS this combination)
- Mesh gradient + grain + vignette (classic hero background)
- Swarm + bloom (glowing particle field)
- Particles + scanlines (sci-fi terminal aesthetic)
- Voronoi + color shift (abstract cellular patterns)
- Dot grid + subtle noise (textured pattern background)

### Clashes (avoid)
- Multiple distortion effects stacked (wave + curvature + jitter = unreadable mess)
- Glitch + halftone (competing visual patterns fight for attention)
- Heavy bloom + heavy grain (produces visual mud)
- ASCII + any other transformative effect (ASCII replaces the image entirely)

### Recommended Stacks for Common Use Cases

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
