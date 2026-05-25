---
source: https://github.com/Leonxlnx/taste-skill/blob/main/skills/{minimalist-skill,soft-skill,brutalist-skill,gpt-tasteskill}/SKILL.md
captured: 2026-05-25
type: external-taste-skill (4 named-vibe variants consolidated)
note: em-dashes in source replaced with hyphens or commas (project rule)
---

# Named-Vibe Variants - 4 Style Archetypes

## SECTION 1: VERBATIM LIFT

This file consolidates the 4 named-style variants from the taste-skill repo. Each is a self-contained "vibe" the user can opt into. All variants inherit the base taste-skill bans (no emojis, no Inter, no `#000000`, no Lila, no Lorem Ipsum).

---

## VARIANT 1: MINIMALIST-UI (Premium Utilitarian Minimalism)

### Description
Clean editorial-style interfaces. Warm monochrome palette, typographic contrast, flat bento grids, muted pastels. No gradients, no heavy shadows.

### Absolute Negative Constraints (Banned Elements)

- DO NOT use "Inter", "Roboto", or "Open Sans" typefaces.
- DO NOT use generic, thin-line icon libraries like "Lucide", "Feather", standard "Heroicons".
- DO NOT use Tailwind default heavy drop shadows (`shadow-md`, `shadow-lg`, `shadow-xl`).
- DO NOT use primary colored backgrounds for large elements/sections.
- DO NOT use gradients, neon colors, 3D glassmorphism (beyond subtle navbar blurs).
- DO NOT use `rounded-full` for large containers, cards, primary buttons.
- DO NOT use emojis anywhere.
- DO NOT use generic placeholder names ("John Doe", "Acme Corp", "Lorem Ipsum").
- DO NOT use AI copywriting cliches: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve".

### Typographic Architecture (verbatim font lists)

- **Primary Sans-Serif (Body/UI/Buttons):** `font-family: 'SF Pro Display', 'Geist Sans', 'Helvetica Neue', 'Switzer', sans-serif`
- **Editorial Serif (Hero Headings/Quotes):** `font-family: 'Lyon Text', 'Newsreader', 'Playfair Display', 'Instrument Serif', serif`. Apply tight tracking (`letter-spacing: -0.02em` to `-0.04em`) and tight line-height (`1.1`).
- **Monospace (Code/Keystrokes/Meta-data):** `font-family: 'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace`
- **Text Colors:** Body text never absolute black. Use off-black (`#111111` or `#2F3437`) with `line-height: 1.6`. Secondary text muted gray (`#787774`).

### Color Palette (Warm Monochrome + Spot Pastels)

- **Canvas/Background:** Pure White `#FFFFFF` or Warm Bone (`#F7F6F3` / `#FBFBFA`).
- **Primary Surface (Cards):** `#FFFFFF` or `#F9F9F8`.
- **Structural Borders/Dividers:** Ultra-light gray `#EAEAEA` or `rgba(0,0,0,0.06)`.
- **Accent Colors** (exclusively desaturated, washed-out pastels):
  - Pale Red: `#FDEBEC` (Text: `#9F2F2D`)
  - Pale Blue: `#E1F3FE` (Text: `#1F6C9F`)
  - Pale Green: `#EDF3EC` (Text: `#346538`)
  - Pale Yellow: `#FBF3DB` (Text: `#956400`)

### Component Specifications (exact values)

- **Bento Box Grids:** Asymmetrical CSS Grid. Cards: `border: 1px solid #EAEAEA`. Border-radius `8px` or `12px` max. Internal padding `24px` to `40px`.
- **Primary CTA Buttons:** Solid `#111111`, text `#FFFFFF`. Border-radius `4px` to `6px`. No box-shadow. Hover: subtle color shift to `#333333` or micro-scale `transform: scale(0.98)`.
- **Tags/Status Badges:** Pill-shaped (`border-radius: 9999px`), very small typography (`text-xs`), uppercase with wide tracking (`letter-spacing: 0.05em`). Background uses defined Muted Pastels.
- **Accordions (FAQ):** Strip container boxes. Separate items with `border-bottom: 1px solid #EAEAEA`. Use clean `+` and `-` toggle.
- **Keystroke Micro-UIs:** Render shortcuts as physical keys using `<kbd>`: `border: 1px solid #EAEAEA`, `border-radius: 4px`, `background: #F7F6F3`, monospace.
- **Faux-OS Window Chrome:** Wrap software mockups in minimalist container with white top bar containing three small light gray circles (macOS controls).

### Iconography & Imagery

- System Icons: "Phosphor Icons (Bold or Fill weights)" or "Radix UI Icons" for technical, thicker-stroke aesthetic.
- Illustrations: Monochromatic, rough continuous-line ink sketches on white background, single offset geometric shape filled with muted pastel.
- Photography: High-quality, desaturated images with warm tone. Subtle overlays (`opacity: 0.04` warm grain). Use `https://picsum.photos/seed/{context}/1200/800`.

### Subtle Motion

- **Scroll Entry:** `translateY(12px)` + `opacity: 0` resolving over `600ms` with `cubic-bezier(0.16, 1, 0.3, 1)`. Use `IntersectionObserver`, NEVER `window.addEventListener('scroll')`.
- **Hover:** Cards lift with ultra-subtle shadow (`box-shadow: 0 0 0` to `0 2px 8px rgba(0,0,0,0.04)` over `200ms`). Buttons `scale(0.98)` on `:active`.
- **Staggered Reveals:** `animation-delay: calc(var(--index) * 80ms)`.
- **Background Ambient Motion:** Optional. Slow-moving radial gradient blob (`animation-duration: 20s+`, `opacity: 0.02-0.04`) on `position: fixed; pointer-events: none` layer.

### Execution Protocol

1. Establish macro-whitespace first. Massive vertical padding (`py-24` or `py-32`).
2. Constrain main typography content width to `max-w-4xl` or `max-w-5xl`.
3. Apply custom typographic hierarchy and monochromatic color variables.
4. Every card, divider, border adheres strictly to `1px solid #EAEAEA` rule.
5. Add scroll-entry animations to all major content blocks.
6. Ensure sections have visual depth through imagery, ambient gradients, or subtle textures.

---

## VARIANT 2: SOFT-SKILL / HIGH-END VISUAL DESIGN (Awwwards-Tier)

### Description
Teaches the AI to design like a high-end agency. Defines exact fonts, spacing, shadows, card structures, animations that make a website feel expensive. Persona: Vanguard_UI_Architect. Objective: $150k+ agency-level digital experiences.

### THE "ABSOLUTE ZERO" DIRECTIVE (Strict Anti-Patterns)

If generated code includes ANY of the following, the design INSTANTLY FAILS:

- **Banned Fonts:** Inter, Roboto, Arial, Open Sans, Helvetica. (Use `Geist`, `Clash Display`, `PP Editorial New`, `Plus Jakarta Sans`.)
- **Banned Icons:** Standard thick-stroked Lucide, FontAwesome, Material Icons. Use only ultra-light, precise lines (Phosphor Light, Remix Line).
- **Banned Borders & Shadows:** Generic 1px solid gray borders. Harsh dark drop shadows (`shadow-md`, `rgba(0,0,0,0.3)`).
- **Banned Layouts:** Edge-to-edge sticky navbars glued to top. Symmetrical 3-column Bootstrap-style grids without massive whitespace.
- **Banned Motion:** Standard `linear` or `ease-in-out` transitions. Instant state changes without interpolation.

### THE CREATIVE VARIANCE ENGINE

Before writing code, "roll the dice" and select ONE combination:

#### Vibe & Texture Archetypes (Pick 1)

1. **Ethereal Glass (SaaS / AI / Tech):** Deepest OLED black (`#050505`), radial mesh gradients (subtle glowing purple/emerald orbs). Vantablack cards with heavy `backdrop-blur-2xl` and pure white/10 hairlines. Wide geometric Grotesk typography.
2. **Editorial Luxury (Lifestyle / Real Estate / Agency):** Warm creams (`#FDFBF7`), muted sage, deep espresso. High-contrast Variable Serif fonts for massive headings. Subtle CSS noise/film-grain overlay (`opacity-[0.03]`).
3. **Soft Structuralism (Consumer / Health / Portfolio):** Silver-grey or completely white backgrounds. Massive bold Grotesk typography. Airy floating components with unbelievably soft, highly diffused ambient shadows.

#### Layout Archetypes (Pick 1)

1. **The Asymmetrical Bento:** Masonry-like CSS Grid of varying card sizes (`col-span-8 row-span-2` next to stacked `col-span-4` cards). Mobile collapse: single-column stack (`grid-cols-1`) with generous vertical gaps (`gap-6`).
2. **The Z-Axis Cascade:** Elements stacked like physical cards, slightly overlapping with varying depths of field, some with subtle `-2deg` or `3deg` rotation. Mobile: remove all rotations and negative-margin overlaps below `768px`.
3. **The Editorial Split:** Massive typography on left half (`w-1/2`), interactive scrollable horizontal image pills or staggered interactive cards on right. Mobile: converts to full-width vertical stack.

### HAPTIC MICRO-AESTHETICS

#### The "Double-Bezel" (Doppelrand / Nested Architecture)

NEVER place a premium card/image/container flatly on background. They must look like physical machined hardware using nested enclosures:

- **Outer Shell:** Wrapper `div` with subtle background (`bg-black/5` or `bg-white/5`), hairline outer border (`ring-1 ring-black/5` or `border border-white/10`), specific padding (`p-1.5` or `p-2`), large outer radius (`rounded-[2rem]`).
- **Inner Core:** Actual content container inside shell. Distinct background color, own inner highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`), mathematically calculated smaller radius (`rounded-[calc(2rem-0.375rem)]`) for concentric curves.

#### Nested CTA & "Island" Button Architecture

- **Structure:** Primary interactive buttons fully rounded pills (`rounded-full`) with generous padding (`px-6 py-3`).
- **"Button-in-Button" Trailing Icon:** Arrow NEVER sits naked. Must be nested inside circular wrapper (`w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center`) placed flush with main button's right inner padding.

#### Spatial Rhythm & Tension

- Macro-Whitespace: Double standard padding. Use `py-24` to `py-40`.
- **Eyebrow Tags:** Precede major H1/H2s with microscopic pill-shaped badge (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`).

### MOTION CHOREOGRAPHY

Use custom cubic-beziers (e.g., `transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`).

#### Fluid Island Nav & Hamburger Reveal

- **Closed State:** Floating glass pill detached from top (`mt-6`, `mx-auto`, `w-max`, `rounded-full`).
- **Hamburger Morph:** On click, 2 or 3 lines fluidly rotate and translate to form perfect 'X' (`rotate-45` and `-rotate-45` with absolute positioning).
- **Modal Expansion:** Massive screen-filling overlay with heavy glass (`backdrop-blur-3xl bg-black/80` or `bg-white/80`).
- **Staggered Mask Reveal:** Nav links fade in and slide up from invisible box (`translate-y-12 opacity-0` to `translate-y-0 opacity-100`) with staggered delay (`delay-100`, `delay-150`, `delay-200`).

#### Magnetic Button Hover Physics

- Use `group` utility. Scale entire button down slightly (`active:scale-[0.98]`).
- Nested inner icon circle translates diagonally (`group-hover:translate-x-1 group-hover:-translate-y-[1px]`) and scales up slightly (`scale-105`).

#### Scroll Interpolation

- Elements never appear statically. Gentle heavy fade-up (`translate-y-16 blur-md opacity-0` resolving to `translate-y-0 blur-0 opacity-100` over 800ms+).
- Use `IntersectionObserver` or Framer Motion's `whileInView`. NEVER `window.addEventListener('scroll')`.

### Pre-Output Checklist

- No banned fonts/icons/borders/shadows/layouts/motion patterns from Section 2
- Vibe Archetype and Layout Archetype consciously selected and applied
- All major cards use Double-Bezel nested architecture
- CTA buttons use Button-in-Button trailing icon pattern
- Section padding at minimum `py-24`
- All transitions use custom cubic-bezier - no `linear` or `ease-in-out`
- Scroll entry animations present
- Layout collapses gracefully below `768px` to single-column
- All animations use only `transform` and `opacity`
- `backdrop-blur` only on fixed/sticky elements
- Overall impression reads as "$150k agency build", not "template with nice fonts"

---

## VARIANT 3: BRUTALIST-SKILL / INDUSTRIAL BRUTALISM & TACTICAL TELEMETRY

### Description
Raw mechanical interfaces fusing Swiss typographic print with military terminal aesthetics. Rigid grids, extreme type scale contrast, utilitarian color, analog degradation effects. For data-heavy dashboards, portfolios, editorial sites that need to feel like declassified blueprints.

### Visual Archetypes (Pick ONE, do not mix)

#### Swiss Industrial Print
- 1960s corporate identity systems + heavy machinery blueprints
- High-contrast light modes (newsprint/off-white substrates)
- Monolithic, heavy sans-serif typography
- Unforgiving structural grids with visible dividing lines
- Aggressive, asymmetric negative space punctuated by oversized viewport-bleeding numerals
- Heavy use of primary red as alert/accent color

#### Tactical Telemetry & CRT Terminal
- Classified military databases, legacy mainframes, aerospace HUDs
- Dark mode exclusivity
- High-density tabular data presentation
- Absolute dominance of monospaced typography
- Integration of technical framing devices (ASCII brackets, crosshairs)
- Application of simulated hardware limitations (phosphor glow, scanlines, low bit-depth rendering)

### Typographic Architecture

#### Macro-Typography (Structural Headers)

- **Classification:** Neo-Grotesque / Heavy Sans-Serif
- **Optimal Web Fonts:** Neue Haas Grotesk (Black), Inter (Extra Bold/Black), Archivo Black, Roboto Flex (Heavy), Monument Extended
- **Scale:** Massive scales using fluid typography (`clamp(4rem, 10vw, 15rem)`)
- **Tracking:** Extremely tight, often negative (`-0.03em` to `-0.06em`)
- **Leading:** Highly compressed (`0.85` to `0.95`)
- **Casing:** Exclusively uppercase

#### Micro-Typography (Data & Telemetry)

- **Classification:** Monospace / Technical Sans
- **Optimal Web Fonts:** JetBrains Mono, IBM Plex Mono, Space Mono, VT323, Courier Prime
- **Scale:** Fixed and small (`10px` to `14px` / `0.7rem` to `0.875rem`)
- **Tracking:** Generous (`0.05em` to `0.1em`)
- **Leading:** Standard to tight (`1.2` to `1.4`)
- **Casing:** Exclusively uppercase

### Color System

**Choose ONE substrate palette per project.**

#### Swiss Industrial Print (Light)

- **Background:** `#F4F4F0` or `#EAE8E3` (Matte, unbleached documentation paper)
- **Foreground:** `#050505` to `#111111` (Carbon Ink)
- **Accent:** `#E61919` or `#FF2A2A` (Aviation/Hazard Red) - ONLY accent color

#### Tactical Telemetry (Dark)

- **Background:** `#0A0A0A` or `#121212` (Deactivated CRT. Avoid pure `#000000`)
- **Foreground:** `#EAEAEA` (White phosphor)
- **Accent:** `#E61919` or `#FF2A2A` (Aviation/Hazard Red)
- **Terminal Green (`#4AF626`):** Optional. ONLY for single specific UI element, never as general text color.

### Layout and Spatial Engineering

- **The Blueprint Grid:** Strict CSS Grid architectures. Elements anchored precisely to grid tracks.
- **Visible Compartmentalization:** Solid borders (`1px` or `2px solid`) to delineate zones. Horizontal rules span entire container width.
- **Bimodal Density:** Layouts oscillate between extreme data density (tightly packed monospace metadata) and vast expanses of negative space framing macro-typography.
- **Geometry:** Absolute rejection of `border-radius`. All corners exactly 90 degrees.

### UI Components and Symbology

- **Syntax Decoration:** ASCII characters to frame data points: `[ DELIVERY SYSTEMS ]`, `< RE-IND >`, `>>>`, `///`, `\\\\`
- **Industrial Markers:** Registration (R), copyright (C), trademark (TM) symbols as structural elements
- **Technical Assets:** Crosshairs (`+`) at grid intersections, repeating vertical lines (barcodes), thick horizontal warning stripes, randomized string data (`REV 2.6`, `UNIT / D-01`)

### Textural Effects

- **Halftone and 1-Bit Dithering:** Pre-processing or CSS `mix-blend-mode: multiply` overlays + SVG radial dot patterns
- **CRT Scanlines:** `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
- **Mechanical Noise:** Global low-opacity SVG static filter applied to DOM root

### Web Engineering Directives

1. **Grid Determinism:** `display: grid; gap: 1px;` with contrasting parent/child backgrounds for mathematically perfect razor-thin dividing lines
2. **Semantic Rigidity:** Use precise semantic tags (`<data>`, `<samp>`, `<kbd>`, `<output>`, `<dl>`)
3. **Typography Clamping:** CSS `clamp()` for macro-typography

---

## VARIANT 4: GPT-TASTESKILL (Elite UX/UI & GSAP Motion Engineer)

### Description
Elite UX/UI & Advanced GSAP Motion Engineer. Enforces Python-driven true randomization for layout variance, strict AIDA page structure, wide editorial typography (bans 6-line wraps), gapless bento grids, strict GSAP ScrollTriggers (pinning, stacking, scrubbing), inline micro-images, massive section spacing.

### Python-Driven True Randomization

LLMs are inherently lazy and always pick first layout option. MUST simulate Python script execution in `<design_plan>` before writing UI code. Use deterministic seed (character count of prompt modulo math) to simulate `random.choice()` and strictly select:
- 1 Hero Architecture
- 1 Typography Stack (Satoshi, Cabinet Grotesk, Outfit, Geist. NEVER Inter)
- 3 Unique Component Architectures
- 2 Advanced GSAP Paradigms

### AIDA Structure & Spacing

Every page MUST begin with highly creative premium Navigation Bar.

The rest of page MUST follow AIDA framework:
- **Attention (Hero):** Cinematic, clean, wide layout
- **Interest (Features/Bento):** High-density, mathematically perfect grid or interactive typographic components
- **Desire (GSAP Scroll/Media):** Pinned sections, horizontal scroll, text-reveals
- **Action (Footer/Pricing):** Massive high-contrast CTA and clean footer links

**SPACING RULE:** Add huge vertical padding between all major sections (`py-32 md:py-48`). Sections must feel like distinct cinematic chapters.

### Hero Architecture & THE 2-LINE IRON RULE

The Hero must breathe. Must NOT be narrow, 6-line text wall.

- **Container Width Fix:** MUST use ultra-wide containers for H1 (`max-w-5xl`, `max-w-6xl`, `w-full`).
- **THE LINE LIMIT:** H1 MUST NEVER exceed 2 to 3 lines. 4, 5, 6 lines is CATASTROPHIC FAILURE. Make font size smaller (`clamp(3rem, 5vw, 5.5rem)`) and container wider.
- **Hero Layout Options:**
  1. **Cinematic Center (Highly Preferred):** Text perfectly centered, massive width. Below: exactly two high-contrast CTAs. Behind: stunning full-bleed background image with dark radial wash.
  2. **Artistic Asymmetry:** Text offset to left, artistic floating image overlapping text from bottom right.
  3. **Editorial Split:** Text left, image right, but with massive negative space.
- **Button Contrast:** Dark bg = white text. Light bg = dark text. Invisible text is FAILURE.
- **BANNED IN HERO:** Arbitrary floating stamp/badge icons on text. Pill-tags under hero. Raw data/stats in hero.

### THE GAPLESS BENTO GRID

- **Zero Empty Space:** MUST use Tailwind's `grid-flow-dense` (`grid-auto-flow: dense`) on every Bento Grid. Mathematically verify `col-span` and `row-span` values interlock perfectly.
- **Card Restraint:** 3 to 5 highly intentional cards better than 8 messy ones.

### Advanced GSAP Motion

- **Hover Physics:** Every clickable card and image must react: `group-hover:scale-105 transition-transform duration-700 ease-out` inside `overflow-hidden` containers
- **Scroll Pinning:** Pin section title on left (`ScrollTrigger pin: true`) while gallery scrolls upwards on right
- **Image Scale & Fade Scroll:** Images start small (`scale: 0.8`). Scroll into view -> `scale: 1.0`. Scroll out -> darken and fade (`opacity: 0.2`).
- **Scrubbing Text Reveals:** Opacity of paragraph words starts at 0.1, scrubs to 1.0 sequentially
- **Card Stacking:** Cards overlap and stack dynamically from bottom

### Strict Bans (additional to base taste-skill)

- **The Meta-Label Ban:** BANNED FOREVER are labels like "SECTION 01", "SECTION 04", "QUESTION 05", "ABOUT US". Remove entirely. Cheap and unprofessional.
- **Horizontal Scroll Bug Prevention:** Wrap entire page in `<main className="overflow-x-hidden w-full max-w-full">`.

### Mandatory Pre-Flight `<design_plan>`

Before writing ANY React/UI code, output `<design_plan>` block containing:
1. Python RNG Execution: 3-line mock Python output showing deterministic selection
2. AIDA Check: Confirm page contains Navigation, Attention, Interest, Desire, Action
3. Hero Math Verification: Explicitly state `max-w` class for H1 (2-3 lines guarantee)
4. Bento Density Verification: Prove mathematically zero empty spaces; `grid-flow-dense` applied
5. Label Sweep & Button Check: Confirm no cheap meta-labels; button text contrast perfect

---

## SECTION 2: EXTENSION

### When to use which variant - decision tree

**You are building an internal admin tool / utility / dashboard:**
- Use MINIMALIST-UI (warm monochrome, no shadows, ultra-flat, pastel accents).
- Reasoning: density and clarity matter more than dazzle. The admin user doesn't want a $150k agency feel.

**You are building a marketing/landing page for a premium SaaS or agency:**
- Use SOFT-SKILL ($150k agency, Double-Bezel, Spring Physics, Eyebrow Tags).
- Reasoning: this is the "Awwwards" variant. Pull out every nested-bezel and magnetic-button trick.

**You are building something for data-heavy users (telemetry, finance, security, ops dashboards):**
- Use BRUTALIST-SKILL Tactical Telemetry variant (dark mode, monospace, scanlines, crosshairs, hazard red accent).
- Reasoning: communicates "this is serious data infrastructure" without consumer-app softness.

**You are building an editorial portfolio or design publication:**
- Use BRUTALIST-SKILL Swiss Industrial Print variant (off-white substrate, oversized typography, hazard red, halftone effects).
- Reasoning: signals print heritage and design fluency.

**You are building a scroll-driven storytelling marketing site (product launch, brand campaign):**
- Use GPT-TASTESKILL (AIDA structure, GSAP Pinning, Card Stacking, scrubbed text reveals, 2-line iron rule on H1).
- Reasoning: AIDA framework + GSAP is the awards-portfolio pattern.

### The Doppelrand (Double-Bezel) - WHY this works

Source describes Doppelrand as "a glass plate sitting in an aluminum tray." The mechanism: when a flat card sits on a flat background, the eye reads it as a "div with rounded corners." When the card sits inside an OUTER shell with its own border and a slightly larger radius, the eye reads it as TWO objects, which the brain interprets as PHYSICAL DEPTH.

The math `rounded-[calc(2rem-0.375rem)]` matters because concentric radii must be CONCENTRIC (outer = inner + padding). This is also the `make-interfaces-feel-better` "concentric radius" rule, but Soft-Skill specifies the EXACT pattern with calc() math.

### The 2-Line Iron Rule - measuring it

GPT-Tasteskill bans H1s longer than 2-3 lines. The measurement:
- At desktop width, h1 with `max-w-5xl` (64rem / 1024px) usually wraps a 70-character heading to 2 lines.
- At `clamp(3rem, 5vw, 5.5rem)` font size with `max-w-6xl` (72rem / 1152px) container, you get ~14-18 characters per line at 5.5rem font. So a 28-character h1 = 2 lines.
- The catastrophic failure mode is a centered h1 at 7rem font in a 32rem container - that wraps a 40-char heading to 5+ lines and looks like a poetry textbook.

### The AIDA structure - explicit AI-defense

GPT-Tasteskill's AIDA structure (Attention/Interest/Desire/Action) is a 1960s ad-copy framework, but it's repurposed as a structural defense against the most common AI failure: pages without a clear narrative arc that just stack feature sections one after another. AIDA forces the page to have an ARC: hook -> intrigue -> demonstrate -> convert.

---

## SECTION 3: What this covers that impeccable + make-interfaces-feel-better don't

The 4 variants are PRE-COMPOSED VIBE SHEETS - each is a complete style system the user can opt into rather than building from scratch.

**Specific gap-fills the variants provide:**

1. **MINIMALIST: The exact pastel palette with text colors** (Pale Red `#FDEBEC` / `#9F2F2D`, Pale Blue `#E1F3FE` / `#1F6C9F`, Pale Green `#EDF3EC` / `#346538`, Pale Yellow `#FBF3DB` / `#956400`). Sidecoach color domain has no codified "Notion-style soft pastel" palette with pre-paired bg/fg colors.

2. **MINIMALIST: The "Faux-OS Window Chrome" pattern** (three small light gray circles for macOS controls). A specific UI motif for software mockups.

3. **SOFT: The Double-Bezel (Doppelrand) nested architecture** with concentric radius math (`rounded-[calc(2rem-0.375rem)]`). Make-interfaces-feel-better has "concentric radius" as a general rule; Soft-Skill spells out the calc() formula.

4. **SOFT: The Button-in-Button trailing icon pattern.** Specific: arrow nested inside `w-8 h-8 rounded-full` wrapper flush with main button's right inner padding. A reusable component archetype.

5. **SOFT: The Eyebrow Tag spec** (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`). A reusable typography mini-component.

6. **SOFT: The 3 Vibe + 3 Layout Archetypes (Ethereal Glass / Editorial Luxury / Soft Structuralism + Asymmetrical Bento / Z-Axis Cascade / Editorial Split).** A pre-composed style matrix the user can pick from.

7. **BRUTALIST: The complete dual-mode color systems** (Swiss Print: `#F4F4F0` substrate + `#050505` ink + `#E61919` red. Telemetry: `#0A0A0A` bg + `#EAEAEA` foreground + `#E61919` accent + optional `#4AF626` terminal green). Industry-specific palettes sidecoach doesn't have.

8. **BRUTALIST: The CRT scanlines CSS** (`repeating-linear-gradient`) and the ASCII syntax decoration patterns (`[ ]`, `< >`, `>>>`, `///`). Concrete copyable patterns for "tactical" aesthetic.

9. **BRUTALIST: The semantic-tag rigor** (`<data>`, `<samp>`, `<kbd>`, `<output>`, `<dl>`). Sidecoach a11y rules don't require these.

10. **GPT-TASTESKILL: The 2-Line Iron Rule for h1** (max 2-3 lines, otherwise font is too big or container too narrow). Specific testable constraint.

11. **GPT-TASTESKILL: The AIDA narrative arc structure** as defense against feature-list-pages.

12. **GPT-TASTESKILL: The `grid-flow-dense` (CSS `grid-auto-flow: dense`) rule for bento grids.** Eliminates gaps. Sidecoach layout handler doesn't mention this.

13. **GPT-TASTESKILL: The Meta-Label Ban** ("SECTION 01", "QUESTION 05") - a specific copywriting anti-pattern that's epidemic in AI output.

14. **GPT-TASTESKILL: The `overflow-x-hidden` wrapper rule** to prevent horizontal scrollbars from off-screen GSAP animations.
