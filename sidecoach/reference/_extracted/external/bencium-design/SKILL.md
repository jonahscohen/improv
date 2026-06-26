---
source: https://github.com/bencium/bencium-claude-code-design-skill/blob/main/bencium-controlled-ux-designer/skills/bencium-controlled-ux-designer/SKILL.md
captured: 2026-05-25
type: external-taste-skill (controlled UX designer)
---

# Bencium - Controlled UX Designer (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### Core Philosophy

**CRITICAL: Design Decision Protocol**
- **ALWAYS ASK** before making any design decisions (colors, fonts, sizes, layouts)
- Never implement design changes until explicitly instructed
- Present alternatives and trade-offs, not single "correct" solutions

### Stand Out From Generic Patterns

**Avoid Generic Training Dataset Patterns:**
- Don't default to "Claude style" designs (excessive bauhaus, liquid glass, apple-like)
- Don't use generic SaaS aesthetics that look machine-generated
- Don't rely only on solid colors - suggest photography, patterns, textures
- Think beyond typical patterns

**Draw Inspiration From:**
- Modern landing pages (Perplexity, Comet Browser, Dia Browser)
- Framer templates and their innovative approaches
- Leading brand design studios
- Historical design movements (Bauhaus, Otl Aicher, Braun) - as inspiration, NOT imitation
- Beautiful background animations (CSS, SVG) - slow, looping, subtle

**Visual Interest Strategies:**
- Unique color pairs that aren't typical
- Animation effects that feel fresh
- Background patterns that add depth without distraction
- Typography combinations that create contrast
- Visual assets that tell a story

### 6 Core Design Principles

1. **Simplicity Through Reduction**
   - Identify essential purpose and eliminate distractions
   - Begin with complexity, then deliberately remove until simplest effective solution
   - Every element must justify its existence

2. **Material Honesty**
   - Digital materials have unique properties - embrace them
   - Buttons communicate affordance through color, spacing, typography (NOT shadows)
   - Cards use borders and background differentiation (NOT depth effects)
   - Animations follow real-world physics adapted to digital responsiveness

3. **Functional Layering (Not Visual Depth)**
   - Create hierarchy through typography scale, color contrast, spatial relationships
   - Layer information conceptually (primary -> secondary -> tertiary)
   - Reject skeuomorphic shadows/gradients
   - Embrace functional depth: modals over content, dropdowns over UI

4. **Obsessive Detail**
   - Consider every pixel, interaction, transition
   - Excellence emerges from hundreds of small, intentional decisions
   - When detail conflicts with clarity, clarity wins

5. **Coherent Design Language**
   - Every element should visually communicate its function
   - Elements should feel part of a unified system
   - Nothing should feel arbitrary

6. **Invisibility of Technology**
   - The best technology disappears
   - Users should focus on content and goals, not on understanding the interface

### Color System Architecture

**Base/Neutral Palette (4-5 colors):**
- Backgrounds (lightest)
- Surface colors (cards, inputs)
- Borders and dividers
- Text (darkest)
- Use slightly desaturated, warm or cool greys based on brand

**Accent Palette (1-3 colors):**
- Primary action (CTA buttons)
- Status indicators (success, warning, error, info)
- Focus/hover states
- Saturated colors for clear contrast against neutrals

**Color Application Rules:**
- Backgrounds: Lightest neutral (slate-50 or white)
- Text: Darkest neutral for primary (slate-900), mid-tone for secondary (slate-600)
- Buttons (primary): Accent color with white text
- Buttons (secondary): Neutral with border and dark text
- Status: Specific accent (green=success, red=error, amber=warning, blue=info)
- Interactive states:
  - Hover: Darken by 10-15% or shift hue slightly
  - Focus: Use ring/outline in accent color
  - Disabled: Reduce opacity to 40-50% and remove hover effects

**Warm vs Cool greys (intentional):**
- **Warm greys** (beige/brown undertones): Organic, approachable, trustworthy
- **Cool greys** (blue undertones): Modern, tech-forward, professional

**Unique Color Strategy (anti-AI):**
- Avoid default SaaS blue (#3B82F6) unless it fits your brand
- Consider unexpected neutrals: warm greys, soft off-whites, deep charcoals
- Pair neutrals with distinctive accents: terracotta + charcoal, sage + navy, coral + slate
- Test combinations against "does this look AI-generated?" filter

### Typography

- Headlines/Display: Prioritize emotion, personality, attention (legibility secondary)
- Body: Prioritize legibility, reading comfort, accessibility
- UI/Labels: Prioritize clarity, scannability, consistency
- 2-3 typefaces maximum
- Clear mathematical scale (e.g., 1.25x between sizes)

### Animation

- Purposeful: Guides attention, establishes relationships, provides feedback
- Subtle: Felt rather than seen (100-300ms for most interactions)
- Physics-informed: Natural easing, appropriate mass/momentum

### Spacing

- Generous negative space creates clarity and breathing room
- Mathematical relationships (4px base, 8/16/24/32/48px scale)
- Consistent application creates visual rhythm

### Design Decision Checklist (before any design)

1. **Purpose**: Does every element serve a clear function?
2. **Hierarchy**: Is visual importance aligned with content importance?
3. **Consistency**: Do similar elements look and behave similarly?
4. **Accessibility**: Does it meet WCAG AA standards?
5. **Responsiveness**: Does it work on mobile, tablet, desktop?
6. **Uniqueness**: Does this break from generic SaaS patterns?
7. **Approval**: Have I asked before implementing colors, fonts, sizes, layouts?

---

## SECTION 2: EXTENSION

### The "ALWAYS ASK" protocol - when sidecoach should adopt it

Bencium's most distinctive contribution is the "ALWAYS ASK before making design decisions" mandate. Sidecoach's flows currently MAKE decisions and validate them; Bencium's flows PROPOSE decisions and wait for approval.

When sidecoach should adopt the "ASK" protocol:
- When PRODUCT.md exists but doesn't lock specific colors/fonts (only personality)
- When user is in a "shape" phase (not "craft" phase)
- When the user has indicated taste preferences but not a complete brand
- When making a decision that propagates across the whole codebase (e.g., choosing primary accent color)

When sidecoach should NOT use "ASK":
- When the decision is downstream of a locked DESIGN.md token
- When the user explicitly said "just build it"
- When iterating tactically on already-shipped UI

### Color pairing examples (extending the source)

Bencium says "terracotta + charcoal, sage + navy, coral + slate". Extending:

**Warm pairings (organic, editorial, hospitality):**
- Terracotta (#C4593B) + Charcoal (#2B2926)
- Mustard (#D4A03B) + Espresso (#3C2E26)
- Olive (#7A8043) + Cream (#F4F1EA)
- Coral (#E87766) + Slate (#5C6770)

**Cool pairings (tech, finance, B2B):**
- Sage (#86A293) + Navy (#1A3354)
- Electric blue (#4F7AFA) + Deep charcoal (#1A1A1F)
- Lavender (#A89DDB) + Indigo (#2D2A6E)
- Mint (#94D2BD) + Forest (#1A3D32)

**Neutral pairings (premium, minimal):**
- Bone (#F5F1E8) + Carbon (#1C1C1C)
- Off-white (#FAFAF7) + Deep brown (#3D2E22)
- Stone (#D5CFC4) + Charcoal (#2C2C2C)

### The "does this look AI-generated?" filter

The single best heuristic Bencium provides. Concrete tests:
- Does the page use purple-to-blue gradient anywhere? -> AI tell
- Are there exactly 3 equal cards in a feature row? -> AI tell
- Does the primary CTA say "Get Started" or "Try Now"? -> AI tell
- Is the body font Inter or Roboto? -> AI tell
- Does the hero say "Build [X] faster" or "The future of [Y]"? -> AI tell
- Is the dashboard sidebar exactly 240px wide with chevron arrows? -> AI tell
- Are the section headers Title Case? -> AI tell
- Is there a "trusted by" logo strip with 5-6 grayscale logos? -> AI tell

Any 3+ of these means the design is indistinguishable from GPT/Cursor/v0 output. Mix it up.

---

## SECTION 3: What this covers that oracle + make-interfaces-feel-better don't

1. **The "ALWAYS ASK before deciding" protocol.** Sidecoach makes decisions and validates; Bencium proposes and waits. A different design conversation mode.

2. **The 6-principle design philosophy** (Simplicity Through Reduction / Material Honesty / Functional Layering / Obsessive Detail / Coherent Design Language / Invisibility of Technology). A more philosophical layer than make-interfaces-feel-better's tactical rules.

3. **The "Material Honesty" principle - buttons communicate via color/spacing/typography, NOT shadows; cards use borders/backgrounds, NOT depth.** A specific anti-skeuomorphic rule.

4. **The 4-5 neutral + 1-3 accent color architecture** with specific application rules per state.

5. **The "warm vs cool grey" intentionality rule** with brand-mapping (warm = organic/trustworthy, cool = modern/tech).

6. **The "does this look AI-generated?" filter as an explicit named gate.** Bencium codifies the slop-detection mindset as a question.

7. **The unique color pairing suggestions** (terracotta + charcoal, sage + navy, coral + slate) - specific named palettes that break from default SaaS blue.

8. **The brand-studio inspiration list** (Perplexity, Comet Browser, Dia Browser, Framer templates, Bauhaus, Otl Aicher, Braun). Specific aspirational references.

9. **The design-decision checklist with the "Approval" step** explicitly listed as a gate.
