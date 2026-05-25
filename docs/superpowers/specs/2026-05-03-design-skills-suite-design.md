# Design Skills Suite

Four new peer skills extending the design stack: social media specs, multi-agent design teams, visual effects (shaders + FX), and icon sourcing.

## Principles

- All four skills are **peers** to Sidecoach, not children. Independent entry points with shared PRODUCT.md + DESIGN.md contract.
- All four are **bundled skills** shipped with the dotfiles repo. No external npx dependencies. Installed via file copy in install.sh, same as component-gallery-reference.
- No references to external tools or projects in any source, documentation, or commit.
- The visual-effects skill ships actual shader source code, not descriptions or pseudocode.

## Skill 1: Social Media (`/social-media`)

### Purpose

Platform-specific sizing, safe zones, typography rules, and content best practices for 13 platforms. Auto-triggers on platform names and social content keywords. Provides the constraints and validation layer - not the visual design itself.

### Platform Specifications

| Platform | Content Types (with dimensions) |
|---|---|
| Instagram | Post 1080x1080, Story/Reel 1080x1920, Carousel 1080x1350, Profile 320x320 |
| YouTube | Thumbnail 1280x720, Banner 2560x1440 (safe 1546x423), Shorts 1080x1920 |
| TikTok | Video cover 1080x1920, Profile 200x200 |
| Twitter/X | Post 1600x900, Header 1500x500, Profile 400x400, Card 800x418 |
| LinkedIn | Post 1200x627, Article cover 1200x644, Banner 1584x396, Profile 400x400 |
| Threads | Post 1080x1080, Carousel 1080x1350 |
| Bluesky | Post card 1200x630, Banner 3000x1000, Profile 1000x1000 |
| Discord | Server icon 512x512, Banner 960x540, Role icon 64x64, Embed thumb 80x80 |
| GitHub | Social preview 1280x640, Repo avatar 500x500 |
| Dribbble | Shot 1600x1200 or 800x600, Profile 400x300 |
| Behance | Project cover 808x632, Module 1400xAny |
| Product Hunt | Gallery 1270x760, Logo 240x240, OG card 1200x630 |
| Substack | Header 1100x220, Inline graphic 1100xAny, OG card 1200x630 |

### Per-Platform Rules

Each platform entry includes:
- **Safe zones**: pixel regions where text/logos must stay to avoid UI overlaps (YouTube banner corners, TikTok bottom third, Instagram story top/bottom 250px)
- **Typography minimums**: smallest readable font size per platform at native resolution
- **Color guidance**: contrast requirements for small-screen viewing, dark mode considerations
- **Content patterns**: structural best practices (carousel hook-slide patterns, YouTube thumbnail face+text+contrast formula, LinkedIn article cover simplicity)

### Workflow

1. Detect platform + content type from user request
2. Load spec (dimensions, safe zones, typography rules)
3. Read PRODUCT.md for brand context + DESIGN.md for tokens
4. If building with code: generate at exact pixel dimensions with safe-zone guides
5. If building for export: guide through Figma or canvas-based creation at spec
6. Validate: text within safe zones, minimum font sizes met, brand tokens applied

### Auto-Trigger Keywords

Platform names (Instagram, YouTube, TikTok, Twitter, X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack), plus: "social post", "thumbnail", "story", "reel", "carousel", "banner", "cover image", "OG image", "open graph", "social preview", "profile picture", "avatar".

---

## Skill 2: Design Team (`/design-team`)

### Purpose

Orchestrates multi-agent design sprints with specialized roles, a creative director review gate, and persistent team state. Hybrid execution: parallel subagents for research/build phases, main-thread creative director for review.

### Four-Phase Workflow

**Phase 1 - Research:** Parallel subagents (researcher, copywriter, brand strategist, etc.) gather context. Text-only roles, no file writes. Each returns a brief to the main thread.

**Phase 2 - Build:** Parallel subagents with designer personas work on separate files/sections simultaneously. Each receives research briefs + PRODUCT.md + DESIGN.md as context. Isolated from each other to prevent cross-contamination.

**Phase 3 - Review:** Runs in the main thread. Creative director persona reviews each builder's output sequentially with full context. Enforces the existing QA pipeline (Sidecoach audit/critique/polish, make-interfaces-feel-better checklist). Produces review document with per-section verdicts: approve, revise (with specific notes), or reject.

**Phase 4 - Revise:** Builders receive review notes and fix. One round only. If the CD still has issues after revision, the CD fixes directly rather than ping-ponging.

### Roles (16)

**Research phase (text-only, no file writes):**

| Role | What they do |
|---|---|
| Researcher | Web search, competitor analysis, reference gathering |
| Copywriter | Headlines, body copy, CTAs, microcopy |
| UX Designer | User flows, information architecture, wireframe descriptions |
| Brand Strategist | Brand alignment, tone, positioning |
| Content Strategist | Content hierarchy, messaging framework |
| SEO Specialist | Keywords, meta descriptions, structured data |
| Marketing Strategist | Campaign framing, audience targeting |

**Build phase (file writes, parallel):**

| Role | What they do |
|---|---|
| Graphic Designer | Visual layouts, compositions, graphics |
| Design Engineer | Component implementation, responsive code |
| Social Media Designer | Platform-specific social content |
| Editorial Designer | Long-form layouts, editorial spreads |
| Motion Designer | Animation specs, transition design |
| Print Designer | Print-specific layouts |

**Review/Revise phase:**

| Role | What they do |
|---|---|
| Creative Director | Review: final authority on quality, consistency, brand alignment |
| Accessibility Specialist | Review: assists CD with WCAG audit, keyboard nav, screen reader |
| UX Writer | Revise: assists builders with copy polish |

### Team State

Persists to `~/.claude/design-teams/` (per-machine state, not checked into project repos):

- `team.json` - roster, role assignments, personality scores
- `memory.json` - per-agent memory entries with salience decay (0.02/day)
- `history.json` - past sprint summaries for continuity

### Personality System

Each agent gets a 3-axis profile on a 1-5 scale:

- **Boldness** (1=conservative, 5=dramatic)
- **Playfulness** (1=serious, 5=whimsical)
- **Precision** (1=loose, 5=exacting)

These subtly shape the agent's system prompt. No emotions, no XP, no leveling.

**Conviction scores** (high/moderate/low) determine revision behavior:
- **High (builder default):** Pushes back on CD feedback with design rationale
- **Moderate:** Weighs feedback, accepts most changes
- **Low (default for junior roles):** Accepts feedback, defers to team

### CD Review Enforces Existing QA Pipeline

The creative director review is not a separate QA system. It runs the same gates already defined in CLAUDE.md:

1. `/sidecoach audit` (a11y, performance, theming, responsive, anti-patterns)
2. `/sidecoach critique` (AI-slop detection, Nielsen heuristics, cognitive load)
3. `/sidecoach polish` (alignment pass against design system)
4. `make-interfaces-feel-better` 14-point checklist
5. `DESIGN.md` lint (if present)

The CD's added value is cross-section consistency, brand coherence, and the authority to approve/revise/reject.

### Subagent Dispatch

Research and build phases use Claude Code's `Agent` tool with `subagent_type` unset (general-purpose). Each subagent receives:

- Role persona (name, description, personality axis values)
- Phase-specific instructions (what to produce, constraints)
- PRODUCT.md + DESIGN.md content (inlined, not file paths)
- Research briefs (build phase only)
- Review notes (revise phase only)

Subagents are stateless per-invocation. Personality persists via team.json, not via subagent memory.

---

## Skill 3: Visual Effects (`/visual-effects`)

### Purpose

A combined skill covering generative shader backgrounds (create from nothing) and transformative FX post-processing (apply effects to existing content). Ships actual shader source code as canonical reference implementations.

### Directory Structure

```
claude/skills/visual-effects/
  SKILL.md                    (skill definition + combination grammar)
  shaders/
    mesh-gradient/
      vertex.glsl
      fragment.glsl
      README.md               (parameters, usage, visual description)
    fluid/
      simulation.glsl
      README.md
    fractal-glass/
      glass.glsl
      environment.glsl
      README.md
    halftone-field/
      halftone.glsl
      README.md
    swarm/
      swarm.ts                (Canvas 2D, not GLSL)
      README.md
    voronoi/
      fragment.glsl
      README.md
    liquid-metal/
      fragment.glsl
      README.md
    pulsar/
      fragment.glsl
      README.md
    black-hole/
      fragment.glsl
      README.md
    spiral/
      fragment.glsl
      README.md
    dot-grid/
      fragment.glsl
      README.md
    particles/
      particles.ts
      README.md
    fireworks/
      fireworks.ts
      README.md
    chrome/
      fragment.glsl
      README.md
  fx/
    ascii.md                  (algorithm specs + reference implementations)
    dither.md
    glitch.md
    halftone.md
    art.md
    post-processing.md        (stackable post-process effects)
```

### Generative Mode - Shader Backgrounds (14 types)

**Tier 1 - Full source implementations (extracted from existing polished work):**

| Effect | Tech | Key features |
|---|---|---|
| Mesh Gradient | Three.js/GLSL | Simplex noise vertex displacement, 5-color layered mixing, Bayer dithering, grain |
| Fluid Simulation | WebGL 1.0 | GPU Navier-Stokes solver, semi-Lagrangian advection, mouse interaction, 4 quality tiers (ultra/high/medium/low) |
| Fractal Glass | Three.js/GLSL | Ray-traced fluted glass, squircle-based normals, fluid distortion, procedural HDR environment, bloom/tone mapping |
| Halftone Field | Three.js/GLSL | CMYK dot-screen over fluid color field, per-channel luminance lifting, adjustable dot size/contrast/angle |
| Swarm | Canvas 2D | Spring-physics particles, 6 shape morphs (circle/square/diamond/triangle/sparkle/cross), orbital jitter, glow on displacement |

**Tier 2 - Specification + reference GLSL (new implementations):**

| Effect | Description | Key parameters |
|---|---|---|
| Voronoi | Worley noise cell patterns | cellCount, edgeWidth, colorStops, edgeColor |
| Liquid Metal | Chrome/mercury surface simulation | reflectivity, viscosity, turbulence, colorTint |
| Pulsar | Radiating concentric rings | frequency, decay, speed, colorStart, colorEnd |
| Black Hole | Gravitational lensing distortion | strength, radius, rotationSpeed |
| Spiral | Logarithmic spiral with color gradient | arms, tightness, rotationSpeed, colorStops |
| Dot Grid | Uniform dot matrix | dotSize, spacing, color, pulseSpeed |
| Particles | Floating particle field | count, drift, connectionDistance, mouseRepulsion |
| Fireworks | Burst particles with gravity | burstCount, gravity, trailLength, colorSpread |
| Chrome | Reflective chrome surface | roughness, environmentIntensity, warpSpeed |

### Transformative Mode - FX Post-Processing

**ASCII (8 variants):** Standard, Dense, Minimal, Blocks, Braille, Technical, Matrix, Hatching. Each specifies character set, density mapping algorithm, and color preservation rules.

**Dither (6 algorithms):** Floyd-Steinberg, Atkinson, Stucki, Sierra, Jarvis-Judice-Ninke, Burkes. Each specifies the error diffusion kernel and palette reduction strategy.

**Glitch (4 types):** VHS (scanline offset + color bleed), Digital (block displacement + corruption), Chromatic Aberration (RGB channel split), Data Moshing (frame buffer corruption).

**Halftone (3 modes):** Mono dots, CMYK separation, custom angle/frequency. Specifies dot shape, screen angle per channel, and anti-aliasing.

**Art (5 styles):** Kuwahara (painterly smoothing), Crosshatch (directional line shading), Line Art (edge detection + thresholding), Engraving (parallel line density), Stipple (dot density mapping).

### Post-Processing Stack

Stackable effects applied in declared order: Scanlines, Vignette, Grain, Bloom, Pixelate, Chromatic Aberration, Color Shift, Curvature, Grid Overlay, Jitter, Light Beams, Motion Blur, Noise, Palette Mapping, RGB Glitch, Sepia, Wave Distortion.

Each effect specifies: parameter schema, default values, GPU cost (low/medium/high), and compositing order constraints (e.g., bloom before grain, vignette last).

### Combination Grammar

The SKILL.md includes a compatibility matrix:
- **Pairs well:** fluid base + halftone post, mesh gradient + grain + vignette, swarm + bloom, particles + scanlines
- **Clashes:** multiple distortion effects stacked, glitch + halftone (competing patterns), heavy bloom + heavy grain (mud)
- **Recommended stacks** for common use cases: hero backgrounds (mesh gradient + grain + vignette), card textures (dot grid + subtle noise), loading states (pulsar or particles), decorative borders (voronoi, low opacity)

### Auto-Trigger Keywords

"shader", "gradient background", "animated background", "fluid", "glass effect", "halftone", "ASCII art", "dither", "glitch", "particles", "generative", "procedural", "visual effect", "post-processing", "texture", "noise", "mesh gradient", "fractal", "swarm".

---

## Skill 4: Icon Source (`/icon-source`)

### Purpose

Rigorous protocol for finding, selecting, and sourcing icons from the approved 8-library pool. Auto-triggers when the agent needs an icon during any build.

### Library Pool

**Static tier (verbatim SVG path sourcing):**

| Library | ~Count | Strengths |
|---|---|---|
| Heroicons | 300 | Clean UI chrome, nav, actions |
| Lucide | 1,500 | General purpose, broadest coverage |
| Tabler | 5,400 | Largest set, edge-case coverage |
| Bootstrap Icons | 2,000 | Familiar web conventions |
| Phosphor | 7,000 (6 weights) | Weight flexibility, illustration-adjacent |
| Material Symbols | 3,000+ (3 fills, 7 grades) | Variable font, Android/Material convention |

**Animated tier (React component sourcing):**

| Library | ~Count | Tech | Strengths |
|---|---|---|---|
| Lucide Animated | 1,000+ | React/TypeScript | Micro-interactions, state transitions |
| Heroicons Animated | 300 (subset) | React/Framer Motion | Polished interactive states |

### Selection Protocol

The skill enforces this order:

1. **Check DESIGN.md first.** If the project's design system specifies an icon library, use that library exclusively. Project consistency trumps individual icon quality.
2. **If no project preference, match the tech stack.** React + Framer Motion already installed? Prefer animated libraries. Vanilla HTML? Static SVG only.
3. **Search by semantic intent, not visual guess.** Search for the concept the icon represents in context, not a literal visual description.
4. **One library per project.** Once the first icon is placed, all subsequent icons come from the same library. Exception: animated icons complement their static parent (Lucide + Lucide Animated, Heroicons + Heroicons Animated).
5. **Verbatim path data.** Copy exact SVG path data character-for-character from the library source. No redrawing, simplifying, or optimizing. Byte-for-byte match or it's wrong.
6. **Animated icon criteria.** Use animated variants only when: the icon represents a state change (loading, success, error), responds to user interaction (hover, click), or draws attention to new/changed elements. Static landmarks (nav at rest, labels, decorative) stay static.

### Search Strategy

1. Search primary library by intent keyword
2. If no match, try synonyms (e.g., "settings" -> "gear" -> "cog" -> "preferences")
3. If still no match, check Tabler (largest) or Phosphor (most weight variants) as fallback pools
4. If truly nothing exists, tell the user. Never fabricate, approximate, or compose SVGs.

### Auto-Trigger Keywords

"icon", "icon for", "find an icon", "which icon", "animated icon", "icon library", "svg icon", plus library names (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols).

---

## Installation

### Repo Structure

```
claude/skills/
  component-gallery-reference/     (existing)
    SKILL.md
  social-media/                    (new)
    SKILL.md
  design-team/                     (new)
    SKILL.md
  visual-effects/                  (new)
    SKILL.md
    shaders/                       (14 subdirectories with source)
    fx/                            (effect algorithm specs)
  icon-source/                     (new)
    SKILL.md
```

### install.sh Changes

The `skills` component section gets four additional copy operations, same pattern as component-gallery-reference:

```bash
for skill in social-media design-team visual-effects icon-source; do
  mkdir -p "$CLAUDE_DIR/skills/$skill"
  cp -r "$REPO_DIR/claude/skills/$skill/" "$CLAUDE_DIR/skills/$skill/"
  ok "$skill installed"
done
```

The visual-effects skill uses `cp -r` (recursive) because it has subdirectories for shaders and fx.

### CLAUDE.md Addition

New section documenting the four peer skills, their triggers, and relationship to the existing stack. No changes to the Sidecoach routing section.

### The Complete Design Stack

```
Strategy:      /sidecoach (23 commands, PRODUCT.md + DESIGN.md)
Research:      component-gallery-reference (60 types, 95 systems)
Tactical:      make-interfaces-feel-better (16 CSS polish rules)
Social:        /social-media (13 platforms, specs + validation)
Effects:       /visual-effects (14 shaders + 25 FX + post-processing)
Icons:         /icon-source (8 libraries, selection protocol)
Team:          /design-team (16 roles, 4-phase sprints, CD review gate)
Tokens:        DESIGN.md (Google spec, linted)
Brand:         PRODUCT.md (register, users, anti-references)
Verification:  cmux + Chrome MCP + QA gate pipeline
```
