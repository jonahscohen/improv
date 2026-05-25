---
name: External taste skills absorption (COMPLETE)
description: Extracted Emil, TypeUI, taste-skill (6 variants), Bencium, Refactoring-UI into sidecoach/reference/_extracted/external/
type: project
relates_to: [all_tasks_complete.md, session_2026-05-23_sidecoach_100_complete.md]
---

# External Taste Skills Absorption (COMPLETE)

## Status: DONE

User goal achieved: every external taste skill repo can be discarded because sidecoach holds equivalent or richer content with extensions and gap-fill justifications.

## Sources extracted (10 files written)

### 1. emil-design-eng/ (1 file)
- `SKILL.md` (~600 lines extracted)

### 2. typeui-fundamentals/ (2 files)
- `SKILL.md` (index)
- `typography-principles.md` (~640 lines extracted, 6 pillars)

### 3. taste-skill/ (3 files)
- `SKILL.md` (primary design-taste-frontend)
- `redesign-skill.md`
- `named-vibe-variants.md` (consolidated minimalist + soft + brutalist + gpt-tasteskill)

### 4. bencium-design/ (4 files)
- `RESPONSIVE-DESIGN.md`
- `MOTION-SPEC.md`
- `ACCESSIBILITY.md`
- `SKILL.md` (controlled UX designer)

### 5. refactoring-ui/ (2 files)
- `SKILL.md` (workflow index)
- `references-consolidated.md` (5 domains: color, hierarchy, layout, typography, depth)

## Counts per source

| Source | Named rules / bans | Key tables/values |
|---|---|---|
| **Emil** | 11-row review checklist, 4 frequency tiers, 5 duration tiers, 3 named easings, 6 Sonner principles, 11 review checklist items | `cubic-bezier(0.23,1,0.32,1)` / `(0.77,0,0.175,1)` / `(0.32,0.72,0,1)` |
| **TypeUI** | 7 modular ratios enumerated, 6 pillars, 10-role heading-size matrix, 5 letter cases, 5 pairing patterns, ~80 DO/DO NOT rules across 6 pillars | line-height 1.4-1.6 body / 1.05-1.25 headings / 1.0-1.2 UI; WCAG 4.5:1 / 3:1 / 7:1; clamp() formulas |
| **taste-skill** | 3 parametric dials with 1-10 scales, 4+ banned fonts, 7+ banned colors, 5+ banned names, 8+ banned copy words, 50+ named patterns in Creative Arsenal, 5 Bento card archetypes, 7 final pre-flight checks | DESIGN_VARIANCE/MOTION_INTENSITY/VISUAL_DENSITY at 8/6/4 baseline |
| **taste-skill redesign** | 8-category audit (Typography, Color, Layout, Interactivity, Content, Components, Iconography, Code Quality), 6 strategic omissions, 7-step Fix Priority | - |
| **taste-skill variants** | 4 named vibes (minimalist/soft/brutalist/gpt-tasteskill), 4 pastel pairs (minimalist), 3 vibe archetypes + 3 layout archetypes (soft), 2 substrate palettes (brutalist), AIDA + 2-Line Iron Rule (gpt) | minimalist pastels: `#FDEBEC/#9F2F2D`, `#E1F3FE/#1F6C9F`, etc; brutalist: `#F4F4F0` substrate + `#E61919` accent |
| **Bencium Responsive** | 5-tier breakpoint table (XS/SM/MD/LG/XL), 7 prescribed pattern transitions, 12-row extended pattern matrix | XS 0-479, SM 480-767, MD 768-1023, LG 1024-1439, XL 1440+ |
| **Bencium Motion** | 11-row interaction-type duration table, 3-tier element-weight table, 6 named easings, 4 Gestalt-motion principles | Button press 100ms / Hover 150ms / Tab switch 250ms / Modal 300ms / Page transition 400ms |
| **Bencium A11y** | POUR framework, 5 ARIA landmark roles, 8 ARIA state patterns | WCAG 4.5:1 normal text / 3:1 large text |
| **Bencium SKILL** | 6 design principles, "ALWAYS ASK" protocol, "does this look AI-generated?" filter, 7-item decision checklist | 4-5 neutral + 1-3 accent palette structure |
| **Refactoring-UI** | 6 hierarchy strategies, 8 typography rules, 10-step spacing scale, HSL saturation falloff rule, 5-tier elevation system, two-part shadow recipe | Spacing 4/8/12/16/24/32/48/64/96/128; type scale 12/14/16/18/20/24/30/36/48/60/72 |

## Synthesis - what each source uniquely adds beyond impeccable + make-interfaces-feel-better

### Emil (animation philosophy + frequency-first decisions)
The "should this animate AT ALL?" frequency matrix; 3 canonical custom bezier curves; asymmetric enter/exit timing; Framer Motion x/y hardware-accel gotcha; popover transform-origin with modal exemption; blur-during-crossfade; clip-path as animation primitive; Sonner principles for loved components.

### TypeUI (typography theory at depth)
7 modular ratios with named ratios + use cases; heading-size-by-role table that separates semantic level from visual size; complete 6-pillar typography curriculum (foundations / hierarchy / readability / accessibility / responsive / brand); 5-letter-case vocabulary; widows/orphans/danglies fix patterns; conflict-resolution priority (a11y > readability > hierarchy > perf > brand > aesthetic).

### taste-skill (named-pattern bans + parametric dials)
The 3-dial parametric system (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY) with 1-10 tier definitions; the canonical AI tells ban list (Inter / John Doe / Acme / Elevate / Lila purple-blue / 3 equal cards); 50+ named UI patterns in the Creative Arsenal; the 5 Bento card archetypes; iOS Safari h-screen vs min-h-100dvh gotcha; Tailwind v3 vs v4 PostCSS distinction.

### taste-skill redesign (existing-project upgrade flow)
8-category audit checklist; 6 Strategic Omissions (the "what AI typically forgets" list); 7-step Fix Priority order; extended slop word list (Game-changer / Delve / Tapestry).

### taste-skill named-vibe variants (pre-composed style sheets)
4 ready-to-use style archetypes (minimalist pastels / Awwwards-tier $150k agency / Industrial brutalism / GPT-tasteskill AIDA + GSAP); the Double-Bezel concentric-radius pattern; the 2-Line Iron Rule for h1; brutalist's dual-substrate color systems; the AIDA narrative arc as anti-feature-list defense.

### Bencium Responsive (the missing breakpoint table)
THE foundational gap-fill: the 5-tier breakpoint table (XS 0-479 / SM 480-767 / MD 768-1023 / LG 1024-1439 / XL 1440+) with prescribed pattern transitions (hamburger -> nav, tables -> cards, filters -> drawer, etc). The complete responsive mental model sidecoach was missing.

### Bencium Motion (Material easings + interaction-type durations)
6 named easings with bezier values (complements Emil's 3); interaction-type duration table (Button 100ms / Hover 150ms / Tab 250ms / Modal 300ms / Page 400ms); element-weight duration tier; Gestalt principles applied to motion; shake-error pattern with specific keyframes.

### Bencium Accessibility (POUR + ARIA patterns)
POUR framework (Perceivable / Operable / Understandable / Robust) as audit triage tool; complete ARIA landmark/state/live-region patterns; aria-expanded + aria-controls dropdown pattern; aria-live polite vs assertive distinction.

### Bencium SKILL (ASK-first design conversation mode)
The "ALWAYS ASK before deciding" protocol; 6 design principles (Simplicity / Material Honesty / Functional Layering / Obsessive Detail / Coherent Design Language / Invisibility of Technology); the "does this look AI-generated?" filter; warm vs cool grey intentionality; brand-studio inspiration list (Perplexity / Comet / Dia / Framer / Bauhaus / Otl Aicher / Braun).

### Refactoring-UI (tactical CSS-level wisdom)
HSL saturation falloff + hue rotation curve; Two-Part Shadow recipe (ambient + occlusion); 5-tier elevation system; "de-emphasize to emphasize" inverse principle; spacing scale 25% rule; button hierarchy table with destructive nuance; "Label: Value" combination rule; sidebar fixed-width / content flex rule; right-align numerical columns; icon-weight balancing; hairline border thickening (don't darken, increase width); accent 4px top-border finishing touch.

## Files touched

### Created
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/emil-design-eng/SKILL.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/typeui-fundamentals/SKILL.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/typeui-fundamentals/typography-principles.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/taste-skill/SKILL.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/taste-skill/redesign-skill.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/taste-skill/named-vibe-variants.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/bencium-design/RESPONSIVE-DESIGN.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/bencium-design/MOTION-SPEC.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/bencium-design/ACCESSIBILITY.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/bencium-design/SKILL.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/refactoring-ui/SKILL.md`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/refactoring-ui/references-consolidated.md`

### Note
- em-dashes in source content replaced with hyphens or commas to satisfy content-guard hook (project rule)
- All files follow VERBATIM + EXTENSION + GAP-FILL three-section structure as specified by user
