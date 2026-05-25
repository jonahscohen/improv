---
source: https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md
author: Leon (Leonxlnx)
captured: 2026-05-25
type: external-taste-skill (primary - design-taste-frontend)
note: em-dashes in source replaced with hyphens or commas (project rule)
---

# taste-skill / design-taste-frontend (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### 1. ACTIVE BASELINE CONFIGURATION (Parametric dials)

The taste-skill ships with three dials, each 1-10 with explicit definitions, that drive ALL downstream logic.

* **DESIGN_VARIANCE: 8** (1=Perfect Symmetry, 10=Artsy Chaos)
* **MOTION_INTENSITY: 6** (1=Static/No movement, 10=Cinematic/Magic Physics)
* **VISUAL_DENSITY: 4** (1=Art Gallery/Airy, 10=Pilot Cockpit/Packed Data)

The standard baseline for all generations is strictly set to (8, 6, 4). Adapt dynamically based on what users explicitly request.

#### DESIGN_VARIANCE definitions (full)

* **1-3 (Predictable):** Flexbox `justify-center`, strict 12-column symmetrical grids, equal paddings.
* **4-7 (Offset):** Use `margin-top: -2rem` overlapping, varied image aspect ratios (e.g., 4:3 next to 16:9), left-aligned headers over center-aligned data.
* **8-10 (Asymmetric):** Masonry layouts, CSS Grid with fractional units (e.g., `grid-template-columns: 2fr 1fr 1fr`), massive empty zones (`padding-left: 20vw`).
* **MOBILE OVERRIDE:** For levels 4-10, any asymmetric layout above `md:` MUST aggressively fall back to a strict, single-column layout (`w-full`, `px-4`, `py-8`) on viewports `< 768px`.

#### MOTION_INTENSITY definitions (full)

* **1-3 (Static):** No automatic animations. CSS `:hover` and `:active` states only.
* **4-7 (Fluid CSS):** Use `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`. Use `animation-delay` cascades for load-ins. Focus strictly on `transform` and `opacity`. Use `will-change: transform` sparingly.
* **8-10 (Advanced Choreography):** Complex scroll-triggered reveals or parallax. Use Framer Motion hooks. NEVER use `window.addEventListener('scroll')`.

#### VISUAL_DENSITY definitions (full)

* **1-3 (Art Gallery Mode):** Lots of white space. Huge section gaps. Everything feels very expensive and clean.
* **4-7 (Daily App Mode):** Normal spacing for standard web apps.
* **8-10 (Cockpit Mode):** Tiny paddings. No card boxes; just 1px lines to separate data. Everything is packed. Mandatory: Use Monospace (`font-mono`) for all numbers.

### 2. DEFAULT ARCHITECTURE & CONVENTIONS

- **DEPENDENCY VERIFICATION [MANDATORY]:** Before importing ANY 3rd party library, check `package.json`. If missing, output installation command. Never assume a library exists.
- **Framework:** React or Next.js. Default to Server Components (RSC). INTERACTIVITY ISOLATION: motion/glass components extracted as isolated leaf with `'use client'` at top.
- **State Management:** Local `useState`/`useReducer` for isolated UI. Global state only for deep prop-drilling avoidance.
- **Styling Policy:** Tailwind CSS (v3/v4) for 90% of styling. TAILWIND VERSION LOCK: check package.json first.
- **ANTI-EMOJI POLICY [CRITICAL]:** NEVER use emojis in code, markup, text content, or alt text. Replace with high-quality icons (Radix, Phosphor) or clean SVG primitives. Emojis are BANNED.
- **Responsiveness & Spacing:**
  - Standardize breakpoints (`sm`, `md`, `lg`, `xl`).
  - Contain page layouts using `max-w-[1400px] mx-auto` or `max-w-7xl`.
  - **Viewport Stability [CRITICAL]:** NEVER use `h-screen`. ALWAYS use `min-h-[100dvh]` to prevent catastrophic layout jumping on mobile (iOS Safari).
  - **Grid over Flex-Math:** NEVER use complex flexbox percentage math (`w-[calc(33%-1rem)]`). ALWAYS use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`).
- **Icons:** MUST use exactly `@phosphor-icons/react` or `@radix-ui/react-icons`. Standardize `strokeWidth` globally (use exclusively `1.5` or `2.0`).

### 3. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

**Rule 1: Deterministic Typography**
- Display/Headlines default: `text-4xl md:text-6xl tracking-tighter leading-none`
- ANTI-SLOP: Discourage `Inter` for "Premium" or "Creative" vibes. Force unique character using `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
- TECHNICAL UI RULE: Serif fonts strictly BANNED for Dashboard/Software UIs. Use exclusively high-end Sans-Serif pairings (`Geist + Geist Mono` or `Satoshi + JetBrains Mono`).
- Body/Paragraphs default: `text-base text-gray-600 leading-relaxed max-w-[65ch]`

**Rule 2: Color Calibration**
- Constraint: Max 1 Accent Color. Saturation < 80%.
- **THE LILA BAN:** The "AI Purple/Blue" aesthetic is strictly BANNED. No purple button glows, no neon gradients. Use absolute neutral bases (Zinc/Slate) with high-contrast, singular accents (e.g. Emerald, Electric Blue, or Deep Rose).
- COLOR CONSISTENCY: Stick to one palette. Do not fluctuate between warm and cool grays within the same project.

**Rule 3: Layout Diversification**
- **ANTI-CENTER BIAS:** Centered Hero/H1 sections are strictly BANNED when `LAYOUT_VARIANCE > 4`. Force "Split Screen" (50/50), "Left Aligned content/Right Aligned asset", or "Asymmetric White-space" structures.

**Rule 4: Materiality, Shadows, "Anti-Card Overuse"**
- DASHBOARD HARDENING: For `VISUAL_DENSITY > 7`, generic card containers are strictly BANNED. Use logic-grouping via `border-t`, `divide-y`, or purely negative space.
- Cards ONLY when elevation communicates hierarchy. When a shadow is used, tint it to the background hue.

**Rule 5: Interactive UI States (mandatory generation)**
- **Loading:** Skeletal loaders matching layout sizes (avoid generic circular spinners).
- **Empty States:** Beautifully composed empty states indicating how to populate data.
- **Error States:** Clear, inline error reporting (e.g., forms).
- **Tactile Feedback:** On `:active`, use `-translate-y-[1px]` or `scale-[0.98]` to simulate a physical push.

**Rule 6: Data & Form Patterns**
- Forms: Label MUST sit above input. Helper text optional but should exist in markup. Error text below input. Use standard `gap-2` for input blocks.

### 4. CREATIVE PROACTIVITY (Anti-Slop Implementation)

- **"Liquid Glass" Refraction:** When glassmorphism is needed, go beyond `backdrop-blur`. Add a 1px inner border (`border-white/10`) and a subtle inner shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`) to simulate physical edge refraction.
- **Magnetic Micro-physics (If MOTION_INTENSITY > 5):** Buttons that pull slightly toward mouse cursor. CRITICAL: NEVER use React `useState` for magnetic hover or continuous animations. Use EXCLUSIVELY Framer Motion's `useMotionValue` and `useTransform` outside React render cycle to prevent performance collapse on mobile.
- **Perpetual Micro-Interactions:** When `MOTION_INTENSITY > 5`, embed continuous infinite micro-animations (Pulse, Typewriter, Float, Shimmer, Carousel). Apply premium Spring Physics (`type: "spring", stiffness: 100, damping: 20`) to all interactive elements - no linear easing.
- **Layout Transitions:** Always utilize Framer Motion's `layout` and `layoutId` props.
- **Staggered Orchestration:** Use `staggerChildren` (Framer) or CSS cascade (`animation-delay: calc(var(--index) * 100ms)`).

### 5. PERFORMANCE GUARDRAILS

- **DOM Cost:** Apply grain/noise filters exclusively to fixed, pointer-event-none pseudo-elements. NEVER to scrolling containers.
- **Hardware Acceleration:** Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` and `opacity`.
- **Z-Index Restraint:** NEVER spam arbitrary `z-50` or `z-10` unprompted. Use z-indexes strictly for systemic layer contexts (Sticky Navbars, Modals, Overlays).

### 7. AI TELLS (FORBIDDEN PATTERNS) - THE CANONICAL LIST

#### Visual & CSS

- **NO Neon/Outer Glows:** Do not use default `box-shadow` glows. Use inner borders or subtle tinted shadows.
- **NO Pure Black:** Never use `#000000`. Use Off-Black, Zinc-950, or Charcoal.
- **NO Oversaturated Accents:** Desaturate accents to blend elegantly with neutrals.
- **NO Excessive Gradient Text:** Do not use text-fill gradients for large headers.
- **NO Custom Mouse Cursors:** Outdated, ruin performance/accessibility.

#### Typography

- **NO Inter Font:** Banned. Use `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
- **NO Oversized H1s:** First heading should not scream. Control hierarchy with weight and color, not just massive scale.
- **Serif Constraints:** Use Serif fonts ONLY for creative/editorial designs. NEVER on clean Dashboards.

#### Layout & Spacing

- **Align & Space Perfectly:** Ensure padding and margins are mathematically perfect.
- **NO 3-Column Card Layouts:** The generic "3 equal cards horizontally" feature row is BANNED. Use a 2-column Zig-Zag, asymmetric grid, or horizontal scrolling approach instead.

#### Content & Data (The "Jane Doe" Effect) - CANONICAL NAME/DATA BANS

- **NO Generic Names:** "John Doe", "Sarah Chan", or "Jack Su" are banned. Use highly creative, realistic-sounding names.
- **NO Generic Avatars:** DO NOT use standard SVG "egg" or Lucide user icons for avatars. Use creative, believable photo placeholders or specific styling.
- **NO Fake Numbers:** Avoid predictable outputs like `99.99%`, `50%`, or basic phone numbers (`1234567`). Use organic, messy data (`47.2%`, `+1 (312) 847-1928`).
- **NO Startup Slop Names:** "Acme", "Nexus", "SmartFlow". Invent premium, contextual brand names.
- **NO Filler Words:** Avoid AI copywriting cliches like **"Elevate", "Seamless", "Unleash", or "Next-Gen"**. Use concrete verbs.

#### External Resources & Components

- **NO Broken Unsplash Links:** Use `https://picsum.photos/seed/{random_string}/800/600` or SVG UI Avatars.
- **shadcn/ui Customization:** May use `shadcn/ui`, but NEVER in generic default state. MUST customize radii, colors, and shadows.
- **Production-Ready Cleanliness:** Code must be extremely clean, visually striking, memorable, meticulously refined.

### 8. THE CREATIVE ARSENAL - NAMED PATTERNS

#### Navigation & Menus
- Mac OS Dock Magnification
- Magnetic Button
- Gooey Menu (sub-items detach like viscous liquid)
- Dynamic Island
- Contextual Radial Menu
- Floating Speed Dial
- Mega Menu Reveal

#### Layout & Grids
- Bento Grid
- Masonry Layout
- Chroma Grid
- Split Screen Scroll
- Curtain Reveal

#### Cards & Containers
- Parallax Tilt Card
- Spotlight Border Card
- Glassmorphism Panel (true frosted glass with inner refraction borders)
- Holographic Foil Card
- Tinder Swipe Stack
- Morphing Modal

#### Scroll-Animations
- Sticky Scroll Stack
- Horizontal Scroll Hijack
- Locomotive Scroll Sequence
- Zoom Parallax
- Scroll Progress Path
- Liquid Swipe Transition

#### Galleries & Media
- Dome Gallery
- Coverflow Carousel
- Drag-to-Pan Grid
- Accordion Image Slider
- Hover Image Trail
- Glitch Effect Image

#### Typography & Text
- Kinetic Marquee
- Text Mask Reveal
- Text Scramble Effect
- Circular Text Path
- Gradient Stroke Animation
- Kinetic Typography Grid

#### Micro-Interactions & Effects
- Particle Explosion Button
- Liquid Pull-to-Refresh
- Skeleton Shimmer
- Directional Hover Aware Button
- Ripple Click Effect
- Animated SVG Line Drawing
- Mesh Gradient Background
- Lens Blur Depth

### 9. THE "MOTION-ENGINE" BENTO PARADIGM

#### Core Design Philosophy
- Aesthetic: High-end, minimal, functional.
- Palette: Background `#f9fafb`. Cards pure white (`#ffffff`) with 1px border of `border-slate-200/50`.
- Surfaces: Use `rounded-[2.5rem]` for all major containers. Apply "diffusion shadow" (very light, wide-spreading: `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`).
- Typography: Strict `Geist`, `Satoshi`, or `Cabinet Grotesk` stack. Subtle tracking (`tracking-tight`) for headers.
- Labels: Titles and descriptions placed OUTSIDE and BELOW the cards (gallery-style).
- Pixel-Perfection: Use generous `p-8` or `p-10` padding inside cards.

#### Animation Engine Specs (Perpetual Motion)
- Spring Physics: NO linear easing. Use `type: "spring", stiffness: 100, damping: 20`.
- Layout Transitions: Heavily utilize `layout` and `layoutId` props.
- Infinite Loops: Every card must have an "Active State" that loops infinitely (Pulse, Typewriter, Float, Carousel).
- Performance CRITICAL: Any perpetual motion or infinite loop MUST be memoized (React.memo) and isolated in its own microscopic Client Component.

#### The 5-Card Archetypes
1. **The Intelligent List:** Vertical stack with infinite auto-sorting loop. Items swap positions using `layoutId`, simulating AI prioritizing tasks.
2. **The Command Input:** Search/AI bar with multi-step Typewriter Effect. Cycles through complex prompts with blinking cursor and "processing" state with shimmering loading gradient.
3. **The Live Status:** Scheduling interface with "breathing" status indicators. Pop-up notification badge with "Overshoot" spring effect, stays 3s, vanishes.
4. **The Wide Data Stream:** Horizontal "Infinite Carousel" of data cards/metrics. Seamless loop (using `x: ["0%", "-100%"]`).
5. **The Contextual UI (Focus Mode):** Document view animating staggered highlight of text block, followed by "Float-in" of floating action toolbar with micro-icons.

### 10. FINAL PRE-FLIGHT CHECK

- [ ] Is global state used appropriately to avoid deep prop-drilling rather than arbitrarily?
- [ ] Is mobile layout collapse (`w-full`, `px-4`, `max-w-7xl mx-auto`) guaranteed for high-variance designs?
- [ ] Do full-height sections safely use `min-h-[100dvh]` instead of the bugged `h-screen`?
- [ ] Do `useEffect` animations contain strict cleanup functions?
- [ ] Are empty, loading, and error states provided?
- [ ] Are cards omitted in favor of spacing where possible?
- [ ] Did you strictly isolate CPU-heavy perpetual animations in their own Client Components?

---

## SECTION 2: EXTENSION (added specificity, examples, WHY)

### The 3-dial system - how to map a prompt to dial values

The taste-skill's dial system is the most useful contribution but the source doesn't explain how to PICK values. Practical mapping:

**DESIGN_VARIANCE (set by prompt vibe):**
- "Dashboard for accountants" -> 2-3 (predictability inspires trust in numbers).
- "SaaS marketing site" -> 5-6 (one section asymmetric is enough).
- "Agency portfolio" -> 8-10 (asymmetry IS the brand).
- "Internal tool / admin" -> 1-3 (consistency is the goal).
- "Awwwards submission" -> 9-10.

**MOTION_INTENSITY (set by content type):**
- "Banking app, sensitive data" -> 1-2 (motion is anxiety).
- "Standard product UI" -> 3-5 (state-change motion only, no decoration).
- "Marketing landing page" -> 6-8 (scroll-driven storytelling).
- "Experimental/portfolio" -> 9-10.

**VISUAL_DENSITY (set by user role and frequency):**
- "Stripe dashboard for power users" -> 7-9 (every pixel is information).
- "Consumer app, occasional use" -> 3-5 (breathable).
- "Marketing site" -> 2-4 (airy).
- "Editorial article" -> 2-3 (long-form needs space).
- "Pilot/air-traffic-control style interface" -> 9-10.

### The "Title Case" ban - the WHY

Multiple variants ban Title Case. The WHY: Title Case (Every Major Word Capitalized) reads as MARKETING. Sentence case (only the first word capitalized) reads as SOFTWARE. Software is direct, marketing is performative. When you put Title Case on a button label inside a product, the product feels like a brochure instead of a tool.

The exact pattern to detect: any heading element that has more than one capitalized word that isn't a proper noun (proper nouns like "York", "API", "OAuth" stay capitalized in sentence case).

Title Case is acceptable for:
- Editorial article headlines ("How Stripe Survived the 2020 Crash")
- Page titles in the browser tab/SEO meta
- News/magazine headlines

Title Case is BANNED for:
- Button labels
- Dialog titles
- Form field labels
- Navigation items in product UI
- Toast messages
- Empty state messages

### The Lila Ban - what "AI Purple/Blue" actually looks like

The specific aesthetic banned:
- `from-purple-500 to-blue-500` Tailwind gradients (the most common AI fingerprint)
- Glowing `box-shadow: 0 0 40px rgba(139, 92, 246, 0.5)` on buttons
- Background mesh gradients with violet, indigo, blue blobs
- "OpenAI-style" rainbow gradient on logos or stat numbers

Replace with: neutral Zinc/Slate (`bg-zinc-950`, `text-zinc-100`) + a SINGLE high-contrast accent (`text-emerald-400` for tech, `text-rose-500` for editorial). One accent. Not three.

### The slop word list - extended (additive)

The verbatim ban list is **"Elevate", "Seamless", "Unleash", "Next-Gen"**. The redesign-skill variant adds **"Game-changer", "Delve", "Tapestry", and "In the world of..."**. Practical expansion of cliche AI copy:

- "Empower" (always followed by "users to...")
- "Streamline" (especially "streamline your workflow")
- "Revolutionize"
- "Disrupt"
- "Transform"
- "Cutting-edge"
- "State-of-the-art"
- "Bespoke" (when not literally tailored)
- "Curated" (when not literally curated by humans)
- "Harness"
- "Leverage" (as verb in marketing copy)
- "Synergy"
- "Holistic"
- "Robust"
- "Scalable" (in marketing - acceptable in technical docs)
- "Reimagine"
- "Reinvent"
- "Unlock"
- "Discover" (in CTA buttons - too soft)

### The "Jane Doe" effect - extended ban list

Source bans: John Doe, Sarah Chan, Jack Su, Acme, Nexus, SmartFlow.

Practical extension - placeholder names that signal slop:
- "Jane Smith"
- "User One"
- "John Q. Public"
- "Test User"
- "Foo Bar"
- "Lorem Ipsum"
- Any name beginning with "Demo"
- Domains: `example.com`, `acme.com`, `mycompany.com`
- Emails: `user@example.com`, `john@example.com`
- Phone: any `555-` prefix (Hollywood reservation), any `123-4567`
- Addresses: "123 Main Street", "1234 Anywhere Lane"

Replacement strategy: use NAMES OF PEOPLE WHO WORK IN ADJACENT FIELDS (real engineer/designer names from your own bookmarks), realistic but non-attention-grabbing companies (combinations of two real words: "Northgate Studio", "Field Notes Lab"), and PHONE NUMBERS that follow proper area-code structure for the city the user mentions.

### The "3 equal cards" ban - the structural rule

The source bans "3-Column Card Layouts." The structural pattern to detect: any feature section with exactly 3 sibling elements, each with same width, same height, same icon-title-body structure. This is the "hero-metric template" - a recognizable AI archetype.

Replacement patterns:
- **2-column zig-zag**: alternate image-left/text-right then image-right/text-left
- **Asymmetric bento**: 1 large + 2 small + 3 micro, mathematically interlocked
- **Horizontal scroll**: cards become a horizontal carousel on desktop
- **Wide-feature + supporting rail**: 1 hero feature + 2-3 secondary callouts
- **Single feature with details**: drop the multi-card pattern entirely

---

## SECTION 3: What this covers that impeccable + make-interfaces-feel-better don't

**Make-interfaces-feel-better has tactical rules. Impeccable has process. Neither has the BANNED PATTERNS catalog.**

The taste-skill's unique contribution is **the canonical ban list as a defensive layer**. Sidecoach's tactical polish skill says "use balanced text wrap"; the taste-skill says "DO NOT use 'Elevate' in copy" and "DO NOT use Inter for premium vibes" and "DO NOT use 3 equal cards." These are pattern-matching bans, not principle bans.

**Specific gap-fills the taste-skill provides:**

1. **The 3-dial parametric system (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY).** Sidecoach has no codified way to express "I want this DENSE" or "I want this CALM" as a numeric input that downstream rules can read. The dials with 1-3/4-7/8-10 tier definitions let every other rule branch on a quantified vibe.

2. **The named-pattern ban list.** Specific bans like "NO Inter Font", "NO 3-Column Card Layouts", "NO `#000000`", "NO Generic Names (John Doe, Acme)". These are detectable in linting. They become validators.

3. **The "AI tells" framework.** Reframes design quality as "absence of AI fingerprints" rather than "presence of good patterns." This is the inverse of normal design advice and catches what positive rules miss.

4. **The 50+ named pattern library (Creative Arsenal).** Magnetic Button, Gooey Menu, Dynamic Island, Bento Grid, Tinder Swipe Stack, Zoom Parallax - each is a named pattern with a known implementation. Sidecoach references reference systems (component.gallery) but doesn't have a NAMED-PATTERN vocabulary internally.

5. **The "h-screen vs min-h-[100dvh]" iOS Safari gotcha.** A production bug almost nobody knows about. Sidecoach motion docs don't mention it.

6. **The Tailwind v3 vs v4 PostCSS plugin distinction.** Concrete: do NOT use `tailwindcss` plugin in `postcss.config.js` for v4 - use `@tailwindcss/postcss`. Sidecoach has no version-aware Tailwind guidance.

7. **The "Magnetic micro-physics never via useState" rule.** Specific: use Framer Motion's `useMotionValue`/`useTransform` outside React render cycle. Otherwise mobile performance collapses.

8. **The 5-Bento-card archetype list.** Intelligent List / Command Input / Live Status / Wide Data Stream / Contextual UI. Each with the specific animation pattern (auto-sort via layoutId, Typewriter, breathing status, infinite carousel, staggered highlight). This is a concrete UI generator playbook.

9. **The "Title Case banned in conversational UI" rule with the WHY.** Sentence case = software; Title Case = marketing.

10. **The Lila Ban (specific color ban).** "AI Purple/Blue" aesthetic - the `from-purple-500 to-blue-500` Tailwind gradient and purple-glow box-shadows are explicit bans. Specific enough to be a regex.

11. **The fake-numbers ban with examples.** `99.99%`, `50%`, `1234567`. Use organic data (`47.2%`, real-area-code phone numbers). Sidecoach has no codified "messy data is more believable" rule.

12. **The icon-stroke standardization rule.** Use `strokeWidth: 1.5` or `2.0` exclusively, never mix. Sidecoach icon-source skill picks the icon but doesn't enforce stroke consistency.
