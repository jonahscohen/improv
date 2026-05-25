# Design Skills Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new bundled skills (social-media, design-team, visual-effects, icon-source) to the dotfiles design stack, including extracted shader reference implementations.

**Architecture:** Each skill is a SKILL.md file in `claude/skills/<name>/`. The visual-effects skill additionally contains shader source code in subdirectories and FX algorithm reference docs. All skills are installed via file copy in install.sh. A new CLAUDE.md section documents the peer skill architecture.

**Tech Stack:** Markdown (SKILL.md files), GLSL (shader source), TypeScript (Canvas 2D reference implementations), Shell (install.sh changes)

---

### Task 0: Create icon-source skill

**Files:**
- Create: `claude/skills/icon-source/SKILL.md`

- [ ] **Step 1: Create the skill directory and SKILL.md**

```markdown
---
name: icon-source
description: Find, select, and source icons from the approved 8-library pool with a rigorous selection protocol. Auto-triggers on "icon", "icon for", "find an icon", "which icon", "animated icon", "icon library", "svg icon", plus library names (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols, Lucide Animated, Heroicons Animated). Use when the agent needs any icon during a build - enforces one-library-per-project consistency, verbatim path sourcing, and animated-vs-static selection criteria.
---

# Icon Source

Rigorous protocol for finding, selecting, and sourcing icons from the approved library pool.

## Library Pool

### Static Tier (verbatim SVG path sourcing)

| Library | ~Count | Strengths | Repo |
|---|---|---|---|
| Heroicons | 300 | Clean UI chrome, nav, actions | tailwindlabs/heroicons |
| Lucide | 1,500 | General purpose, broadest coverage | lucide-icons/lucide |
| Tabler | 5,400 | Largest set, edge-case coverage | tabler/tabler-icons |
| Bootstrap Icons | 2,000 | Familiar web conventions | twbs/icons |
| Phosphor | 7,000 (6 weights) | Weight flexibility, illustration-adjacent | phosphor-icons/core |
| Material Symbols | 3,000+ (3 fills, 7 grades) | Variable font, Android/Material convention | google/material-design-icons |

### Animated Tier (React component sourcing)

| Library | ~Count | Tech | Strengths | Repo |
|---|---|---|---|---|
| Lucide Animated | 1,000+ | React/TypeScript | Micro-interactions, state transitions | pqoqubbw/icons |
| Heroicons Animated | 300 (subset) | React/Framer Motion | Polished interactive states | heroicons-animated/heroicons-animated |

## Selection Protocol

Follow this order. Do not skip steps.

### 1. Check DESIGN.md first

If the project's design system specifies an icon library, use that library exclusively. Project consistency trumps having the "best" individual icon. If DESIGN.md names a library not in this pool, use what it says anyway.

### 2. If no project preference, match the tech stack

Check `package.json` and existing imports:
- React project with `framer-motion` or `motion` already installed? Prefer the animated libraries.
- Vanilla HTML, static site, or non-React framework? Static SVG only.
- If the project already uses icons from a specific library (grep for import paths), use the same one.

### 3. Search by semantic intent, not visual guess

Search for the concept the icon represents in its context, not a literal description of what it looks like.

| Bad search | Good search | Why |
|---|---|---|
| "house" | "home" or "home navigation" | The icon means "go home", not "building" |
| "circle with X" | "close" or "dismiss" | The action, not the shape |
| "arrow pointing right" | "next" or "forward" or "chevron-right" | The purpose in context |
| "person silhouette" | "user" or "account" or "profile" | The domain concept |

### 4. One library per project

Once the first icon is placed from a library, all subsequent icons in that project come from the same library. Mixed icon families look incoherent - different stroke widths, corner radii, visual weights.

**Exception:** Animated icons complement their static parent library. These pairings are allowed:
- Lucide + Lucide Animated
- Heroicons + Heroicons Animated

No other cross-library mixing.

### 5. Verbatim path data

Copy the exact SVG path data character-for-character from the library source. This rule is absolute:

- Do not redraw paths.
- Do not "simplify" or "optimize" paths.
- Do not approximate paths from memory.
- Do not compose icons from parts of other icons.
- If the path you are inserting does not match the library source byte-for-byte, it is wrong.

To source a path: find the icon in the library's GitHub repo or published package, copy the `<path d="...">` attribute value exactly.

### 6. Animated icon selection criteria

Use animated variants ONLY when:
- The icon represents a **state change** (loading -> complete, closed -> open, idle -> active)
- The icon responds to **user interaction** (hover reveal, click confirmation, toggle feedback)
- The icon **draws attention** to a new or changed element (notification badge, status update)

Do NOT animate:
- Static landmarks (nav items at rest, section headers, labels)
- Decorative icons (background illustrations, empty-state art)
- Icons that appear in bulk (table row actions, list item markers)

## Search Strategy (when you can't find the right icon)

1. Search the primary library by intent keyword
2. Try synonyms: "settings" -> "gear" -> "cog" -> "preferences" -> "sliders" -> "adjustments"
3. Try related concepts: "filter" -> "funnel" -> "sort" -> "refine"
4. If no match in primary library, check Tabler (largest set, 5,400 icons) or Phosphor (most weight variants, 7,000 icons) as fallback pools
5. If truly nothing exists across all libraries, tell the user explicitly. Never fabricate, approximate, or compose SVGs from parts.

## Library Selection Guide (when no project preference exists)

| Project type | Recommended library | Why |
|---|---|---|
| Marketing site / landing page | Heroicons | Clean, minimal, pairs well with Tailwind |
| Product UI / dashboard | Lucide | Broadest coverage for app UI patterns |
| Content-heavy / editorial | Phosphor | 6 weight variants match typography hierarchy |
| Component library / design system | Material Symbols | Variable font approach, most configurable |
| Quick prototype / hackathon | Tabler | Largest set, something for everything |
| Interactive / animated UI | Lucide Animated + Lucide | Best animated coverage with static fallback |
```

Write this content to `claude/skills/icon-source/SKILL.md`.

- [ ] **Step 2: Verify the file exists and has valid frontmatter**

Run: `head -5 claude/skills/icon-source/SKILL.md`
Expected: frontmatter with `name: icon-source` and `description:` field.

- [ ] **Step 3: Commit**

```bash
git add claude/skills/icon-source/SKILL.md
git commit -m "feat: add icon-source skill (8 libraries, selection protocol)"
```

---

### Task 1: Create social-media skill

**Files:**
- Create: `claude/skills/social-media/SKILL.md`

- [ ] **Step 1: Create the skill directory and SKILL.md**

```markdown
---
name: social-media
description: Platform-specific sizing, safe zones, typography rules, and content best practices for 13 social media platforms. Auto-triggers on platform names (Instagram, YouTube, TikTok, Twitter, X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack) and social content keywords (social post, thumbnail, story, reel, carousel, banner, cover image, OG image, open graph, social preview, profile picture, avatar, header image). Provides constraints and validation - the spec sheet, not the paintbrush.
---

# Social Media Design

Platform-specific specifications for 13 platforms. This skill provides the constraints and validation layer. It does not create the visual design itself - that is the job of Sidecoach (for web-based output), the design-team skill (for complex multi-asset sprints), or the agent's own judgment for simple tasks.

## Workflow

1. Detect platform + content type from the user's request
2. Load the spec below (dimensions, safe zones, typography rules)
3. Read PRODUCT.md for brand context + DESIGN.md for tokens (if they exist at the project root)
4. If building with code (React/HTML/CSS): generate at exact pixel dimensions with safe-zone awareness
5. If building for export (static image via Figma or canvas): guide creation at spec dimensions
6. Before reporting done, validate: text within safe zones, minimum font sizes met, brand tokens applied (not hardcoded colors)

## Platform Specifications

### Instagram

| Content Type | Dimensions | Aspect Ratio |
|---|---|---|
| Post (square) | 1080 x 1080 | 1:1 |
| Post (portrait) | 1080 x 1350 | 4:5 |
| Post (landscape) | 1080 x 566 | 1.91:1 |
| Story / Reel | 1080 x 1920 | 9:16 |
| Carousel slide | 1080 x 1350 | 4:5 |
| Profile picture | 320 x 320 | 1:1 |

**Safe zones:** Stories/Reels: keep text/logos outside the top 250px and bottom 250px (UI overlays). Carousel: first slide is the hook - bold headline, minimal text, high contrast.

**Typography minimums:** Body text: 24px minimum at 1080w. Headlines: 48px+ for readability on mobile. Story text: 32px minimum.

**Content patterns:** Carousel hook formula: slide 1 = bold question or statement, slides 2-8 = one idea per slide, last slide = CTA. High-contrast text overlays on photos.

### YouTube

| Content Type | Dimensions | Notes |
|---|---|---|
| Thumbnail | 1280 x 720 | 16:9, max 2MB |
| Channel banner | 2560 x 1440 | Safe area: center 1546 x 423 |
| Shorts cover | 1080 x 1920 | 9:16 |
| Video watermark | 150 x 150 | Transparent PNG |

**Safe zones:** Banner: only the center 1546x423px is visible on all devices. TV shows full 2560x1440. Mobile crops aggressively to ~1546x423. Keep all text/logos in the safe area.

**Typography minimums:** Thumbnail text: 60px+ bold. Must be readable at 160x90px (search results size). Two-three words maximum.

**Content patterns:** Thumbnail formula: expressive face + 2-3 word text + high contrast background. Avoid clutter. Test readability at small size.

### TikTok

| Content Type | Dimensions | Notes |
|---|---|---|
| Video cover | 1080 x 1920 | 9:16 |
| Profile picture | 200 x 200 | 1:1 |

**Safe zones:** Bottom third is obscured by caption/UI. Top 150px has username overlay. Keep key visuals in the center 60% vertically.

**Typography minimums:** 36px minimum for any text overlay at 1080w.

### Twitter / X

| Content Type | Dimensions | Notes |
|---|---|---|
| Post image (single) | 1600 x 900 | 16:9 |
| Post image (two) | 700 x 800 each | 7:8 |
| Header/banner | 1500 x 500 | 3:1 |
| Profile picture | 400 x 400 | 1:1, displayed as circle |
| Card image | 800 x 418 | 1.91:1 (link preview) |

**Safe zones:** Profile picture is circular - keep content away from corners. Header: bottom-left 100px is obscured by profile picture on desktop.

**Typography minimums:** Card images: 36px+ for text. Timeline images: 28px+ at 1600w.

### LinkedIn

| Content Type | Dimensions | Notes |
|---|---|---|
| Post image | 1200 x 627 | 1.91:1 |
| Article cover | 1200 x 644 | ~1.86:1 |
| Company banner | 1584 x 396 | 4:1 |
| Profile picture | 400 x 400 | 1:1 |
| Event cover | 1776 x 444 | 4:1 |

**Safe zones:** Company banner: logo/text centered, as sidebars vary by screen size.

**Typography minimums:** Post images: 28px+ at 1200w. Clean, professional. Avoid meme-style typography.

**Content patterns:** LinkedIn favors clean, professional visuals. Data visualizations, charts, and quote cards perform well. Avoid heavy design - simplicity reads as authority.

### Threads

| Content Type | Dimensions | Notes |
|---|---|---|
| Post image | 1080 x 1080 | 1:1 (square preferred) |
| Carousel slide | 1080 x 1350 | 4:5 |

**Typography minimums:** Same as Instagram (shared Meta platform).

### Bluesky

| Content Type | Dimensions | Notes |
|---|---|---|
| Post card | 1200 x 630 | ~1.91:1 |
| Profile banner | 3000 x 1000 | 3:1 |
| Profile picture | 1000 x 1000 | 1:1 |

**Safe zones:** Banner: center content, similar variability to Twitter header.

### Discord

| Content Type | Dimensions | Notes |
|---|---|---|
| Server icon | 512 x 512 | 1:1, displayed as circle |
| Server banner | 960 x 540 | 16:9 |
| Role icon | 64 x 64 | 1:1, very small |
| Embed thumbnail | 80 x 80 | 1:1 |
| Server splash | 1920 x 1080 | 16:9 (Nitro only) |

**Safe zones:** Server icon: circular crop, keep content in center 70%.

**Typography minimums:** Role icons: no text (too small). Server icons: single letter or simple glyph only.

### GitHub

| Content Type | Dimensions | Notes |
|---|---|---|
| Social preview (OG) | 1280 x 640 | 2:1 |
| Repo avatar | 500 x 500 | 1:1 |
| Profile picture | 500 x 500 | 1:1 |

**Content patterns:** Social preview: project name, one-line description, key visual or logo. Dark backgrounds perform well. Avoid screenshots (too small to read at OG card size).

### Dribbble

| Content Type | Dimensions | Notes |
|---|---|---|
| Shot (standard) | 800 x 600 | 4:3 |
| Shot (retina) | 1600 x 1200 | 4:3 |
| Profile picture | 400 x 300 | 4:3 |

**Content patterns:** First frame is the thumbnail - make it count. Show the best part of the design, not a wide overview.

### Behance

| Content Type | Dimensions | Notes |
|---|---|---|
| Project cover | 808 x 632 | ~1.28:1 |
| Module width | 1400 max | Height flexible |
| Profile cover | 3840 x 2160 | 16:9 |

**Content patterns:** Modules scroll vertically. Design for 1400px wide, any height. Break projects into clear sections.

### Product Hunt

| Content Type | Dimensions | Notes |
|---|---|---|
| Gallery image | 1270 x 760 | ~1.67:1 |
| Logo | 240 x 240 | 1:1 |
| OG card | 1200 x 630 | 1.91:1 |
| Thumbnail | 80 x 80 | 1:1 |

**Content patterns:** Gallery images: show the product in action. First image is the hero. Logo must work at 80x80 thumbnail size.

### Substack

| Content Type | Dimensions | Notes |
|---|---|---|
| Header image | 1100 x 220 | 5:1 |
| Inline graphic | 1100 max width | Height flexible |
| OG card | 1200 x 630 | 1.91:1 |

**Content patterns:** Header images are thin banners. Keep simple - blog name, subtle pattern, or gradient. Inline graphics should be self-contained (readable without surrounding text context).

## Cross-Platform Guidelines

### Color and Contrast
- Design for small screens first. If text isn't readable on a phone, it won't work.
- Test contrast on both light and dark backgrounds (some platforms have dark mode).
- Avoid thin fonts on busy backgrounds.

### Text Overlay Best Practices
- Maximum 20% of the image area should be text (Facebook/Meta enforced this historically; it remains a good heuristic).
- High contrast: dark text on light background or light text on dark background. Never medium-on-medium.
- Text shadow or semi-transparent overlay behind text on photo backgrounds.

### Brand Consistency
- Read PRODUCT.md for voice and register (brand vs product).
- Read DESIGN.md for color tokens, typography, and spacing.
- Use design system tokens, not hardcoded hex values.
- If neither file exists, flag it - social content without brand guidelines leads to inconsistency.

### Export Checklist (before reporting done)
1. Dimensions match the platform spec exactly (not "close enough")
2. Text is within safe zones
3. Text meets minimum font size for the platform
4. Brand tokens applied (not hardcoded colors)
5. Tested at the thumbnail/preview size the platform will display (not just full size)
```

Write this content to `claude/skills/social-media/SKILL.md`.

- [ ] **Step 2: Verify the file exists and has valid frontmatter**

Run: `head -5 claude/skills/social-media/SKILL.md`
Expected: frontmatter with `name: social-media` and `description:` field.

- [ ] **Step 3: Commit**

```bash
git add claude/skills/social-media/SKILL.md
git commit -m "feat: add social-media skill (13 platforms, specs + safe zones)"
```

---

### Task 2: Create design-team skill

**Files:**
- Create: `claude/skills/design-team/SKILL.md`

- [ ] **Step 1: Create the skill directory and SKILL.md**

```markdown
---
name: design-team
description: Orchestrate multi-agent design sprints with specialized roles, creative director review, and persistent team state. Use when the user wants a design sprint, collaborative design session, multi-section layout, landing page build, campaign creation, or any task that benefits from multiple specialized perspectives working in parallel. Triggers on "design team", "design sprint", "creative director", "multi-agent design", "collaborative design", "team design", "design review", "CD review", and when a task is complex enough to warrant research + build + review phases (e.g., full landing pages, multi-page sites, campaign assets, design system creation).
---

# Design Team

Orchestrate multi-agent design sprints with specialized roles, a creative director review gate, and persistent team state.

## Execution Model

Hybrid: parallel subagents for research and build phases, main-thread creative director for review. This gives you real parallelism where it matters (multiple designers building simultaneously) while keeping the review in the main thread where it has full context.

## Four-Phase Workflow

### Phase 1: Research (parallel, text-only)

Dispatch research-role subagents in parallel using Claude Code's Agent tool. Each subagent receives:
- Its role persona (from the Roles section below)
- The user's brief/request
- PRODUCT.md content (inlined, not as a file path)
- DESIGN.md content (inlined, if it exists)

Each subagent returns a brief (max 500 words) to the main thread. Research agents do NOT write files. They produce text output only.

**Typical research dispatch:**
- Researcher: competitor analysis, reference gathering, market context
- Copywriter: headlines, body copy, CTAs, microcopy options
- Brand Strategist: alignment check against PRODUCT.md, tone guidance
- Content Strategist: information hierarchy, messaging framework

Only dispatch roles relevant to the task. A simple component doesn't need 7 researchers.

### Phase 2: Build (parallel, file writes)

Dispatch builder-role subagents in parallel. Each builder receives:
- Its role persona
- All research briefs from Phase 1
- PRODUCT.md + DESIGN.md content
- Specific assignment (which section/page/component to build)
- File paths to write to (non-overlapping - builders MUST NOT write to the same files)

Builders work in isolation. They do not see each other's output during the build phase.

**Typical build dispatch:**
- Design Engineer A: hero section + navigation
- Design Engineer B: features section + pricing
- Social Media Designer: OG images + social cards

Scale the number of builders to the task. One builder for a single component. Three or more for a full page.

### Phase 3: Review (main thread, sequential)

The creative director review runs in the main session (NOT as a subagent). This is critical - the CD needs full context of what was built and access to the project's QA pipeline.

The CD reviews each builder's output sequentially:

1. Read the built files
2. Run the existing QA pipeline:
   - `/sidecoach audit` (a11y, performance, theming, responsive, anti-patterns)
   - `/sidecoach critique` (AI-slop detection, Nielsen heuristics, cognitive load)
   - `/sidecoach polish` (alignment pass against design system)
   - `make-interfaces-feel-better` 14-point checklist
   - `DESIGN.md` lint (if present)
3. Check cross-section consistency (typography, spacing, color palette, component patterns)
4. Produce a review document with per-section verdicts:
   - **Approve**: no changes needed
   - **Revise**: specific notes on what to fix (exact file, line, issue, fix)
   - **Reject**: fundamental problems requiring a rebuild (rare)

### Phase 4: Revise (targeted, one round)

For sections marked "Revise": dispatch builder subagents with their review notes. Each builder receives:
- Their original assignment context
- The CD's specific revision notes
- The current state of their files

**One round only.** If the CD still has issues after revision, the CD fixes directly in the main thread rather than ping-ponging. This prevents infinite revision loops.

For sections marked "Reject": the CD rebuilds in the main thread with full context from research briefs and the failed attempt.

## Roles

### Research Phase (text-only, no file writes)

| Role | What they produce |
|---|---|
| Researcher | Competitor analysis, reference examples, market context, data points |
| Copywriter | Headlines (3-5 options), body copy, CTAs, microcopy, error messages |
| UX Designer | User flow descriptions, information architecture, wireframe descriptions (text, not images) |
| Brand Strategist | Brand alignment assessment, tone guidance, positioning relative to PRODUCT.md |
| Content Strategist | Content hierarchy, messaging framework, what to say where and why |
| SEO Specialist | Target keywords, meta descriptions, structured data recommendations, heading hierarchy |
| Marketing Strategist | Campaign framing, audience targeting, conversion funnel position, A/B test suggestions |

### Build Phase (file writes, parallel)

| Role | What they build |
|---|---|
| Design Engineer | Component implementations, responsive layouts, interactive elements |
| Graphic Designer | Visual compositions, illustrations, decorative elements |
| Social Media Designer | Platform-specific social content (uses social-media skill specs) |
| Editorial Designer | Long-form layouts, article templates, reading-optimized designs |
| Motion Designer | Animation specifications, transition timing, interaction choreography |
| Print Designer | Print-specific layouts, CMYK considerations, bleed areas |

### Review/Revise Phase

| Role | What they do |
|---|---|
| Creative Director | Reviews all output, runs QA pipeline, enforces cross-section consistency |
| Accessibility Specialist | Assists CD with WCAG audit, keyboard navigation review, screen reader testing |
| UX Writer | Assists builders during revision with copy polish |

## Personality System

Each agent gets a 3-axis profile that subtly shapes their system prompt:

| Axis | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Boldness | Conservative | Measured | Balanced | Confident | Dramatic |
| Playfulness | Serious | Professional | Warm | Lively | Whimsical |
| Precision | Loose | Flexible | Thorough | Meticulous | Exacting |

Default profiles by role type:
- **Researchers**: Boldness 2, Playfulness 2, Precision 4 (careful, thorough, understated)
- **Builders**: Boldness 3, Playfulness 3, Precision 3 (balanced, adaptable)
- **Creative Director**: Boldness 4, Playfulness 2, Precision 5 (high standards, serious, opinionated)

These are defaults. Override them in team.json for specific agents.

### Conviction Scores

Determines how agents respond to CD feedback during Phase 4:

- **High** (builder default): Pushes back on CD feedback with design rationale. "I chose X because Y. If we change it, we lose Z."
- **Moderate**: Weighs feedback, accepts most changes but flags concerns. "I see the issue. I'd suggest A instead of B because..."
- **Low** (default for assistant roles): Accepts feedback and implements. "Got it, fixing now."

## Team State

Persists to `~/.claude/design-teams/` (per-machine, not checked into project repos).

### team.json
```json
{
  "agents": [
    {
      "id": "eng-1",
      "role": "Design Engineer",
      "personality": { "boldness": 3, "playfulness": 3, "precision": 3 },
      "conviction": "high"
    }
  ],
  "created": "2026-05-03T00:00:00Z",
  "lastSprint": "2026-05-03T00:00:00Z"
}
```

### memory.json
```json
{
  "entries": [
    {
      "agentId": "eng-1",
      "type": "preference",
      "content": "Prefers CSS Grid over Flexbox for page layouts",
      "salience": 0.8,
      "created": "2026-05-03T00:00:00Z"
    }
  ]
}
```

Salience decays at 0.02/day. Entries below 0.1 salience are pruned. Memory is injected into agent system prompts at the start of each sprint.

### history.json

Array of past sprint summaries (what was built, who built what, CD verdict, files touched). Used for continuity across sessions.

## When to Use This Skill

**Use it for:**
- Full landing pages or multi-section pages
- Campaign asset creation (hero + social + email)
- Design system creation or major extension
- Multi-page site builds
- Any task where parallel specialized work + review improves quality

**Do NOT use it for:**
- Single component builds (just use Sidecoach + component-gallery-reference)
- Bug fixes or minor tweaks
- Non-UI work
- Tasks where the overhead of team orchestration exceeds the benefit

## Subagent Dispatch Template

When dispatching a subagent, use this structure:

```
Agent({
  description: "[Role]: [specific assignment]",
  prompt: `You are a [Role] on a design team.

Personality: Boldness [N]/5, Playfulness [N]/5, Precision [N]/5
Conviction: [high/moderate/low]

## Your Assignment
[Specific task description]

## Brand Context (from PRODUCT.md)
[Inlined PRODUCT.md content]

## Design Tokens (from DESIGN.md)
[Inlined DESIGN.md content, if exists]

## Research Briefs (Phase 2 only)
[Inlined briefs from Phase 1]

## Constraints
- Write to these files only: [specific paths]
- Do not modify files outside your assignment
- Use design tokens from DESIGN.md, not hardcoded values
- [Role-specific constraints]

## Output Format
[What to produce and how to format it]`
})
```
```

Write this content to `claude/skills/design-team/SKILL.md`.

- [ ] **Step 2: Verify the file exists and has valid frontmatter**

Run: `head -5 claude/skills/design-team/SKILL.md`
Expected: frontmatter with `name: design-team` and `description:` field.

- [ ] **Step 3: Commit**

```bash
git add claude/skills/design-team/SKILL.md
git commit -m "feat: add design-team skill (16 roles, 4-phase sprints, CD review)"
```

---

### Task 3: Create visual-effects SKILL.md

**Files:**
- Create: `claude/skills/visual-effects/SKILL.md`

- [ ] **Step 1: Create the skill directory and SKILL.md**

```markdown
---
name: visual-effects
description: Generative shader backgrounds and transformative FX post-processing effects. Two modes - generative (create backgrounds/textures from nothing) and transformative (apply effects to existing images/elements). Ships actual shader source code as canonical reference implementations. Auto-triggers on "shader", "gradient background", "animated background", "fluid", "glass effect", "halftone", "ASCII art", "dither", "glitch", "particles", "generative", "procedural", "visual effect", "post-processing", "texture", "noise", "mesh gradient", "fractal", "swarm", "voronoi", "chrome", "liquid metal", "fireworks", "dot grid", "pulsar", "spiral", "black hole".
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
```

Write this content to `claude/skills/visual-effects/SKILL.md`.

- [ ] **Step 2: Verify the file exists and has valid frontmatter**

Run: `head -5 claude/skills/visual-effects/SKILL.md`
Expected: frontmatter with `name: visual-effects` and `description:` field.

- [ ] **Step 3: Commit**

```bash
git add claude/skills/visual-effects/SKILL.md
git commit -m "feat: add visual-effects skill definition (14 shaders + 25 FX + post-processing)"
```

---

### Task 4: Extract Tier 1 shader reference implementations

**Files:**
- Create: `claude/skills/visual-effects/shaders/mesh-gradient/shaders.ts`
- Create: `claude/skills/visual-effects/shaders/mesh-gradient/README.md`
- Create: `claude/skills/visual-effects/shaders/fluid/FluidSimulation.tsx`
- Create: `claude/skills/visual-effects/shaders/fluid/README.md`
- Create: `claude/skills/visual-effects/shaders/fractal-glass/FractalGlass.tsx`
- Create: `claude/skills/visual-effects/shaders/fractal-glass/README.md`
- Create: `claude/skills/visual-effects/shaders/halftone/HalftoneField.tsx`
- Create: `claude/skills/visual-effects/shaders/halftone/README.md`
- Create: `claude/skills/visual-effects/shaders/swarm/Swarm.tsx`
- Create: `claude/skills/visual-effects/shaders/swarm/README.md`

For each of the 5 Tier 1 effects, extract the source code and write a README. The process is the same for each:

- [ ] **Step 1: Extract mesh-gradient**

Read `/Users/spare3/Documents/Github/regent/app/(app)/tools/mesh-gradient/shaders.ts`. Copy the file contents to `claude/skills/visual-effects/shaders/mesh-gradient/shaders.ts`.

Transformations:
- Remove the comment on line 1 that says "GLSL shader library for mesh gradient tool"
- Remove line 2-5 comments that reference external sources by URL
- Keep all GLSL code exactly as-is (the shader algorithms are the point)
- Keep the TypeScript export wrappers (`export const VERTEX_SHADER` / `FRAGMENT_SHADER`)

Then create `claude/skills/visual-effects/shaders/mesh-gradient/README.md`:

```markdown
# Mesh Gradient

Animated 3D mesh gradient using simplex noise vertex displacement with per-vertex color mixing.

## Tech Stack
- Three.js (WebGLRenderer, ShaderMaterial, PlaneGeometry)
- GLSL vertex + fragment shaders

## How It Works
1. A subdivided plane (200x200 segments) is rendered with a custom ShaderMaterial
2. The vertex shader displaces vertices using simplex 3D noise, creating flowing waves
3. Colors are computed per-vertex via layered noise thresholding: each color gets its own noise field with unique frequency, flow, and speed parameters
4. GPU interpolates colors across triangles for smooth blending
5. Fragment shader adds optional Bayer 4x4 ordered dithering and film grain

## Key Parameters

| Uniform | Type | Default | Description |
|---|---|---|---|
| uColor | vec3[5] | - | Up to 5 gradient colors (linear RGB) |
| uColorCount | int | 5 | Number of active colors |
| uFrequency | vec2 | (3.0, 6.0) | Noise frequency (x, y) |
| uAmount | float | 0.2 | Vertex displacement strength |
| uSpeed | float | 0.02 | Animation speed |
| uGrainIntensity | float | 0.02 | Film grain amount (0 = off) |
| uDitherEnabled | bool | false | Enable Bayer dithering |
| uDitherStrength | float | 0.3 | Dither intensity |

## Setup
- Camera: PerspectiveCamera at (0, 0.5, 0.4) looking at origin, FOV 35
- Geometry: PlaneGeometry(1.5, 1.5, 200, 200), rotated -90deg on X
- Material: ShaderMaterial with DoubleSide rendering
- Colors: convert hex to linear RGB before passing to shader

## Adapting to a Project
- Replace the 5 default colors with DESIGN.md color tokens
- Adjust uFrequency and uAmount for the desired visual density
- Enable dithering for a textured/print aesthetic
- Use grain sparingly (0.01-0.03) for subtle film quality
```

- [ ] **Step 2: Extract fluid simulation**

Read `/Users/spare3/Documents/Github/regent/app/(app)/tools/fluid/FluidGenerator.tsx`. Copy the file contents to `claude/skills/visual-effects/shaders/fluid/FluidSimulation.tsx`.

Transformations:
- Remove the React component JSX return at the bottom (the `<div>` wrapper and FluidControls import)
- Remove the import of FluidControls and the types import
- Remove the `"use client"` directive
- Keep all GLSL shader strings, all WebGL setup code, all helper functions, the quality map, and the animation loop logic
- Remove references to `FluidControls`, `FluidParams` type, `FLUID_PRESETS`
- Inline the `DEFAULT_PARAMS` object and `hexToNorm` helper (keep them)
- The file should be a self-contained reference of the fluid simulation algorithm

Then create `claude/skills/visual-effects/shaders/fluid/README.md`:

```markdown
# Fluid Simulation

GPU-accelerated incompressible fluid dynamics with particle rendering.

## Tech Stack
- WebGL 1.0 (raw GL context, not Three.js)
- GLSL fragment shaders for simulation passes
- Point sprites for particle rendering

## How It Works

The simulation runs as a series of GPU passes each frame:

1. **Advect velocity**: trace particles backward through the velocity field (semi-Lagrangian)
2. **Apply forces**: mouse interaction via segment-distance falloff + velocity dissipation (0.999/frame)
3. **Compute divergence**: measure velocity field divergence
4. **Pressure solve**: Jacobi iteration (configurable, default 20 iterations)
5. **Gradient subtract**: project velocity to be divergence-free
6. **Update dye**: inject color at mouse position with decay per channel (R:0.9797, G:0.9494, B:0.9696)
7. **Advect dye**: transport color through the velocity field
8. **Step particles**: advect particles through velocity field with drag
9. **Render**: composite particles + dye to offscreen target, then blit to screen

## Quality Tiers

| Tier | Particles | Fluid Scale | Solver Iterations |
|---|---|---|---|
| Ultra | 1,048,576 (2^20) | 50% | 30 |
| High | 1,048,576 (2^20) | 25% | 20 |
| Medium | 262,144 (2^18) | 25% | 18 |
| Low | 65,536 (2^16) | 20% | 14 |

## Key Constants
- Cell size: 32 (simulation space units)
- rdx: 1/32 (reciprocal cell size)
- Mouse force radius: 0.015 (simulation space)
- Dye injection radius: 0.025 (simulation space)

## Adapting to a Project
- Particle colors are configurable: `uColorLow`, `uColorHigh`, `uColorGlow`
- Map these to DESIGN.md color tokens
- Quality tier affects performance significantly - default to "high" for desktop, "medium" for mobile
- The dye color decay rates (R/G/B channels) create warm-cool drift - adjust for your palette
```

- [ ] **Step 3: Extract fractal-glass**

Read `/Users/spare3/Documents/Github/regent/app/(app)/tools/fractal-glass/FractalGlassGenerator.tsx`. Copy to `claude/skills/visual-effects/shaders/fractal-glass/FractalGlass.tsx`.

Transformations:
- Remove the React component JSX return, `"use client"`, FractalGlassControls import, types import, presets import
- Keep all GLSL strings (FLUID_SHARED_GLSL, FLUID_SD_SEGMENT_GLSL, SIMPLEX_NOISE_GLSL, FLUTE_FUNCTIONS_GLSL)
- Keep all helper functions (hexToLinearRGB, smoothstepJS, normalize3, dist3)
- Keep DoubleBufferTarget class, createFluidSim, stepFluidSim, disposeFluidSim
- Keep createBackgroundTexture, createProceduralEnvMap, createFlutedGlassMaterial
- Keep the DEFAULT_PARAMS and FLUID_* constants
- Keep resolvePreset function but remove the SCENE_PRESETS import (inline a note that presets are color sets)

Then create `claude/skills/visual-effects/shaders/fractal-glass/README.md`:

```markdown
# Fractal Glass

Physical fluted glass material with fluid-driven distortion and procedural lighting.

## Tech Stack
- Three.js (WebGLRenderer, MeshPhysicalMaterial with onBeforeCompile patches)
- GLSL for flute normals and fluid simulation
- Real-time fluid simulation drives the distortion pattern behind the glass

## How It Works

1. A fluid simulation (Navier-Stokes, same solver as the standalone fluid effect) generates a moving color field
2. The color field is rendered as a background plane behind the glass
3. A glass plane uses MeshPhysicalMaterial with transmission=1.0 (fully transparent glass)
4. The glass has procedural fluted geometry: squircle-based normal computation creates vertical ridges
5. A procedural HDR environment map provides the lighting (softbox + fill + bounce, all tinted to palette)
6. Three.js ray-tracing through the physical material creates realistic refraction

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| fluteCount | int | 50 | Number of vertical flutes |
| fluteExponent | float | 2.0 | Squircle exponent (higher = sharper ridges) |
| fluteDepth | float | 1.0 | Blend between flat and fluted normals |
| ior | float | 1.3 | Index of refraction |
| thickness | float | 0.1 | Glass thickness for refraction |
| roughness | float | 0 | Surface roughness |
| envIntensity | float | 1.0 | Environment map brightness |
| turbulence | float | 0.1 | Fluid curl noise strength |
| fluidInfluence | float | 0.3 | How much fluid affects glass distortion |

## Color System
Uses a 7-color scheme:
- 4 base colors: background gradient (radial, center-to-edge)
- 3 env colors: procedural HDR environment map tinting

## Adapting to a Project
- The 7-color scheme should map to DESIGN.md tokens (primary, secondary, accent, background families)
- The tonal controls (highlight, midtone, shadow) adjust the gradient distribution
- Reduce fluteCount for more dramatic distortion, increase for subtlety
- On mobile, reduce fluid simulation resolution (FLUID_SIM_TEXTURE_SCALE) for performance
```

- [ ] **Step 4: Extract halftone-field**

Read `/Users/spare3/Documents/Github/regent/app/(app)/tools/halftone/HalftoneGenerator.tsx`. Copy to `claude/skills/visual-effects/shaders/halftone/HalftoneField.tsx`.

Same transformations as fractal-glass: strip React wrapper, keep all GLSL and algorithm code. The fluid simulation code in this file is shared with fractal-glass - keep it self-contained (duplication is fine, the files serve as independent references).

Then create `claude/skills/visual-effects/shaders/halftone/README.md`:

```markdown
# Halftone Field

CMYK halftone dot-screen effect over a fluid-simulated color field.

## Tech Stack
- Three.js (WebGLRenderer, ShaderMaterial for halftone pass)
- Fluid simulation generates the color source (same Navier-Stokes solver)

## How It Works
1. Fluid simulation creates a moving, interactive color field (same as fractal-glass)
2. The halftone shader reads the fluid color field as its source
3. For each pixel: rotate into grid space, find the cell center, sample source color at cell center
4. Per-channel luminance lifting: brightens dark areas WITHOUT desaturating (preserves color ratios)
5. Dot radius is proportional to lifted luminance
6. Smooth edges via configurable softness parameter

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| dotSize | float | 12 | Pixel size of halftone grid cells |
| gridAngle | float | 15 | Grid rotation in degrees |
| contrast | float | 1.0 | Contrast curve (higher = more punch) |
| softness | float | 0.4 | Dot edge softness in pixels |
| invert | bool | false | Invert: large dots on dark, small on bright |

## Luminance Lifting Technique
The shader's key innovation: instead of `pow(luminance, 0.5)` on each channel (which desaturates), it computes a lifted luminance and scales all channels by the same ratio. Then pushes saturation further with `mix(vec3(avg), lifted, 1.5)`. This preserves vivid colors even in dark areas.

## Adapting to a Project
- Map the 4 base colors to DESIGN.md palette
- dotSize 8-16 for web, 20+ for large-format/print aesthetic
- gridAngle 0 for clean grid, 15-45 for classic halftone rotation
- Invert mode creates a dark-field effect (dots are bright on dark background)
```

- [ ] **Step 5: Extract swarm**

Read `/Users/spare3/Documents/Github/regent/app/(app)/tools/swarm/SwarmGenerator.tsx`. Copy to `claude/skills/visual-effects/shaders/swarm/Swarm.tsx`.

Transformations: strip React wrapper, SwarmControls import, types/presets imports. Keep: drawShape function, Dot interface, buildGrid logic, the full animation loop (physics + render), hexToRgb helper, DEFAULT_PARAMS.

Then create `claude/skills/visual-effects/shaders/swarm/README.md`:

```markdown
# Swarm

Interactive particle swarm with spring physics and shape morphing. Canvas 2D (CPU-based, no WebGL).

## Tech Stack
- HTML5 Canvas 2D
- Pure JavaScript physics (no dependencies)

## How It Works
1. Dots are arranged in a grid (configurable spacing)
2. Each dot has: home position, current position, velocity, orbit angle, orbit speed
3. Per frame: compute forces, apply physics, render

Physics per dot:
- If mouse is within attractRadius of the dot's HOME position (not current position):
  - Attract mode: pull toward mouse with orbital jitter (orbiting around cursor, not snapping to it)
  - Repel mode: push toward the attract radius boundary
  - Force uses cubic easing on the distance-to-radius ratio
- Return spring: always pulls dot back toward home (weakened to 15% when attracted)
- Friction: velocity *= friction each frame (default 0.92)

Render per dot:
- Color: interpolates idle->swarm based on displacement from home
- Alpha: interpolates idleAlpha->swarmAlpha based on displacement
- Size: base radius + displacement * 0.8
- Glow: activates when displacement > 40% (extra-size dot at glowAlpha)

## 6 Shape Types
circle, square, diamond, triangle, sparkle, cross - each drawn with Canvas 2D path commands.

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| gridSpacing | int | 18 | Pixels between dot home positions |
| dotRadius | float | 1 | Base dot radius |
| attractRadius | int | 220 | Mouse influence radius |
| attractStrength | float | 0.035 | Force toward mouse |
| repelMode | bool | false | Push instead of pull |
| orbitRadius | float | 30 | Orbit size around attract point |
| orbitJitter | float | 0.6 | Orbit randomness |
| friction | float | 0.92 | Velocity damping |
| returnStrength | float | 0.008 | Spring back to home |

## Adapting to a Project
- Colors (idleColor, swarmColor, bgColor) should come from DESIGN.md tokens
- gridSpacing 12-24 for most use cases (smaller = more dots = more CPU)
- This is CPU-only. For >5000 dots, consider WebGL particles instead.
- The orbit jitter creates organic movement. Set to 0 for mechanical feel, 0.6+ for organic.
```

- [ ] **Step 6: Verify all 5 extractions exist**

Run: `find claude/skills/visual-effects/shaders -name "*.md" -o -name "*.ts" -o -name "*.tsx" | sort`

Expected: 10 files (5 source + 5 README).

- [ ] **Step 7: Commit**

```bash
git add claude/skills/visual-effects/shaders/
git commit -m "feat: extract 5 Tier 1 shader reference implementations"
```

---

### Task 5: Write Tier 2 shader stubs and FX reference docs

**Files:**
- Create: 9 Tier 2 shader directories with README.md + fragment.glsl each
- Create: `claude/skills/visual-effects/fx/ascii.md`
- Create: `claude/skills/visual-effects/fx/dither.md`
- Create: `claude/skills/visual-effects/fx/glitch.md`
- Create: `claude/skills/visual-effects/fx/halftone-post.md`
- Create: `claude/skills/visual-effects/fx/art.md`
- Create: `claude/skills/visual-effects/fx/post-processing.md`

- [ ] **Step 1: Create Tier 2 shader directories**

For each of the 9 Tier 2 effects (voronoi, liquid-metal, pulsar, black-hole, spiral, dot-grid, particles, fireworks, chrome), create:
- A directory under `claude/skills/visual-effects/shaders/<name>/`
- A `fragment.glsl` with a working reference implementation
- A `README.md` with parameters and usage notes

The GLSL for each should be a complete, working fragment shader. Keep them concise - these are simpler effects than Tier 1.

Example for voronoi (`shaders/voronoi/fragment.glsl`):

```glsl
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uCellCount;
uniform float uEdgeWidth;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uEdgeColor;

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = uv * uCellCount;
    vec2 ip = floor(p);
    vec2 fp = fract(p);

    float minDist = 1.0;
    float secondDist = 1.0;
    vec2 minPoint = vec2(0.0);

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash(ip + neighbor);
            point = 0.5 + 0.5 * sin(uTime * 0.5 + 6.2831 * point);
            vec2 diff = neighbor + point - fp;
            float d = length(diff);
            if (d < minDist) {
                secondDist = minDist;
                minDist = d;
                minPoint = point;
            } else if (d < secondDist) {
                secondDist = d;
            }
        }
    }

    float edge = smoothstep(0.0, uEdgeWidth, secondDist - minDist);
    vec3 cellColor = mix(uColor1, uColor2, minPoint.x);
    vec3 color = mix(uEdgeColor, cellColor, edge);

    gl_FragColor = vec4(color, 1.0);
}
```

Write similar reference implementations for all 9 Tier 2 effects. Each should be a single working fragment shader (under 80 lines) with the parameters listed in the SKILL.md spec.

- [ ] **Step 2: Create FX reference docs**

Create 6 markdown files in `claude/skills/visual-effects/fx/` covering the transformative effects. Each file should contain:
- Algorithm description
- Pseudocode or reference implementation
- Parameter specifications
- Usage guidance

These are the algorithm reference docs the agent reads when implementing FX effects. Keep them concise - the algorithms are well-documented elsewhere, the value is having them collected in one place with our parameter conventions.

- [ ] **Step 3: Verify all files exist**

Run: `find claude/skills/visual-effects -type f | wc -l`
Expected: approximately 30-35 files (SKILL.md + 14 shader dirs with 2 files each + 6 FX docs).

- [ ] **Step 4: Commit**

```bash
git add claude/skills/visual-effects/
git commit -m "feat: add Tier 2 shader references and FX algorithm docs"
```

---

### Task 6: Update install.sh

**Files:**
- Modify: `install.sh` (skills section, around line 1319)

- [ ] **Step 1: Read the current skills section**

Read `install.sh` lines 1295-1325 to see the current skills installation code.

- [ ] **Step 2: Add the four new bundled skills after the component-gallery-reference block**

After the `ok "component-gallery-reference installed"` line (around line 1324), add:

```bash
  # Bundled skill: social-media (platform specs for 13 social platforms)
  info "Installing social-media (social platform specs + safe zones)..."
  mkdir -p "$CLAUDE_DIR/skills/social-media"
  cp "$REPO_DIR/claude/skills/social-media/SKILL.md" \
     "$CLAUDE_DIR/skills/social-media/SKILL.md"
  ok "social-media installed"

  # Bundled skill: design-team (multi-agent design sprints)
  info "Installing design-team (multi-agent design sprints + CD review)..."
  mkdir -p "$CLAUDE_DIR/skills/design-team"
  cp "$REPO_DIR/claude/skills/design-team/SKILL.md" \
     "$CLAUDE_DIR/skills/design-team/SKILL.md"
  ok "design-team installed"

  # Bundled skill: visual-effects (shaders + FX, recursive copy for subdirectories)
  info "Installing visual-effects (14 shaders + 25 FX + post-processing)..."
  mkdir -p "$CLAUDE_DIR/skills/visual-effects"
  cp -r "$REPO_DIR/claude/skills/visual-effects/" "$CLAUDE_DIR/skills/visual-effects/"
  ok "visual-effects installed"

  # Bundled skill: icon-source (8-library icon selection protocol)
  info "Installing icon-source (8 libraries, selection protocol)..."
  mkdir -p "$CLAUDE_DIR/skills/icon-source"
  cp "$REPO_DIR/claude/skills/icon-source/SKILL.md" \
     "$CLAUDE_DIR/skills/icon-source/SKILL.md"
  ok "icon-source installed"
```

- [ ] **Step 3: Verify install.sh syntax**

Run: `bash -n install.sh`
Expected: no output (clean syntax).

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: add 4 new bundled skills to installer"
```

---

### Task 7: Update CLAUDE.md

**Files:**
- Modify: `claude/CLAUDE.md`

- [ ] **Step 1: Read the current CLAUDE.md to find insertion point**

Read `claude/CLAUDE.md` and find the end of the "Design Work and Sidecoach" section (before the "Permission Posture" section).

- [ ] **Step 2: Add new section documenting the peer skills**

Insert before the "Permission Posture" section:

```markdown
## Design Peer Skills (independent entry points)

Four skills that sit alongside Sidecoach as independent entry points in the design stack. Each reads PRODUCT.md + DESIGN.md from the project root (same contract as Sidecoach) but is invoked directly, not through Sidecoach's routing.

### Social Media (`/social-media`)

Platform-specific sizing, safe zones, typography rules, and content best practices for 13 platforms: Instagram, YouTube, TikTok, Twitter/X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack. Auto-triggers on platform names and social content keywords. Provides constraints and validation - the spec sheet, not the paintbrush.

### Design Team (`/design-team`)

Multi-agent design sprints with 16 specialized roles across 4 phases: Research (parallel text-only subagents) -> Build (parallel file-writing subagents) -> Review (main-thread creative director with full QA pipeline) -> Revise (one round, then CD fixes directly). Team state persists to `~/.claude/design-teams/`. Use for full pages, campaigns, or multi-section builds. Do not use for single components or minor tweaks.

### Visual Effects (`/visual-effects`)

Generative shader backgrounds (14 types including mesh gradient, fluid simulation, fractal glass, halftone field, swarm) and transformative FX post-processing (ASCII, dither, glitch, halftone, art effects, plus 17 stackable post-process effects). Ships actual shader source code as reference implementations. Full reference at `~/.claude/skills/visual-effects/`.

### Icon Source (`/icon-source`)

Rigorous protocol for sourcing icons from 8 approved libraries: Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols (static), plus Lucide Animated and Heroicons Animated (animated). Enforces one-library-per-project consistency, verbatim SVG path sourcing, and animated-vs-static selection criteria. Auto-triggers when any icon is needed during a build.

### The complete design stack

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
```

- [ ] **Step 3: Verify CLAUDE.md is under the size limit**

Run: `wc -c claude/CLAUDE.md`
Expected: under 40,000 characters. If over, consider extracting the new section to a separate file and referencing it (same pattern as `claude/memory-discipline-section.md`).

- [ ] **Step 4: Commit**

```bash
git add claude/CLAUDE.md
git commit -m "feat: document 4 new design peer skills in CLAUDE.md"
```

---

### Task 8: Final verification

- [ ] **Step 1: Verify complete file structure**

Run: `find claude/skills -type f | sort`

Expected output should include all 5 skill directories (component-gallery-reference + 4 new) with their SKILL.md files, plus the visual-effects subdirectories.

- [ ] **Step 2: Verify install.sh works in dry-run mode**

Run: `bash install.sh --dry-run --yes`

Expected: all skills listed in the component picker, no errors.

- [ ] **Step 3: Verify SKILL.md frontmatter is valid for all new skills**

Run: `for f in claude/skills/*/SKILL.md; do echo "=== $f ==="; head -4 "$f"; echo; done`

Expected: each file shows `---`, `name:`, `description:`, `---` frontmatter.

- [ ] **Step 4: Verify no forbidden references**

Run: `grep -ri "efecto\|regent" claude/skills/ || echo "Clean: no forbidden references"`

Expected: "Clean: no forbidden references"

- [ ] **Step 5: Update session memory**

Update the session memory file at `.claude/memory/session_2026-05-03_design-skills-suite.md` with the completed implementation details.
