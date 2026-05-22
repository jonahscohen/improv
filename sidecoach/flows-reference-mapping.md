# Sidecoach Flows to Reference System Mapping

Maps all 14 core Sidecoach flows to reference system invocation points, showing where each reference system activates, what it produces, and how flows consume those outputs.

## Reference Systems Overview

- **component-gallery-reference**: Semantic markup, a11y patterns, interaction requirements from industry component standards
- **fontshare-reference**: Font candidates, pairing rules, OpenType strategies for the project's register and scope
- **design-references**: Visual inspiration, design patterns from the project's curated reference catalog
- **motion-reference**: Easing curves, timing patterns, stagger and delay strategies from established motion libraries

All reference systems remain lean and continue accessing live sources. Flows invoke them transparently (user sees results, not the reference systems).

---

## Tier 1: Research Phase (Flows A-D)

### Flow A: Brand Verification
**Purpose**: Load PRODUCT.md and DESIGN.md, determine register (brand vs product), apply matching design laws.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Load context, detect register | none | PRODUCT.md loaded, register determined (brand/product) |
| 2 | Apply register-specific design laws | none | Design laws cached for session |
| 3 | Pre-flight checks | none | Brand constraints and anti-references ready |

### Flow B: Component Research
**Purpose**: Research component patterns and semantics for the feature being designed.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Define component type and scope | none | Scope clearly bounded |
| 2 | Research semantic markup and a11y patterns | component-gallery-reference | Semantic markup template, ARIA requirements, keyboard interaction model |
| 3 | Identify required interaction states | component-gallery-reference | State matrix (hover, focus, active, disabled, loading, error, success) |
| 4 | Cross-reference with design laws | none | Component strategy aligned with register rules |

### Flow C: Font Research
**Purpose**: Research typography direction and font pairing for the project register.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Assess scope (headings only? body? display?) | none | Typography scope defined |
| 2 | Research font families and pairing strategy | fontshare-reference | Font candidates (3-5), pairing rationale, OpenType features |
| 3 | Apply typography design laws | none | Font choices validate against hierarchy ratio (min 1.25) and line-length rules (65-75ch max) |
| 4 | Test against register | none | Fonts approved for brand or product register |

### Flow D: Design References
**Purpose**: Gather visual inspiration from curated design reference catalog.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Define visual direction (aesthetic lane, mood) | none | Direction statement |
| 2 | Research design patterns and visual language | design-references | 8-12 reference examples, color strategies, layout patterns, component treatments |
| 3 | Run category-reflex check | none | Confirm choices are NOT category defaults (avoiding AI slop) |
| 4 | Extract reusable patterns | none | Patterns ready for execution phase |

---

## Tier 2: Execution Phase (Flows E-J)

### Flow E: Motion Patterns
**Purpose**: Research and establish motion direction before integration.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Define motion scope and intensity | none | Motion strategy (restrained, playful, ambitious) |
| 2 | Research easing and timing patterns | motion-reference | Easing curves (ease-out-quart, quint, expo), duration baselines (100ms-600ms), stagger patterns |
| 3 | Establish no-animate rules | none | Banned: layout properties, bounce/elastic easing, excessive motion |
| 4 | Create motion palette | none | Easing, duration, stagger values ready for integration |

### Flow F: Design Tokens
**Purpose**: Extract or define design tokens from DESIGN.md for implementation.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Load DESIGN.md or create token set | none | Token structure (colors, typography, spacing, elevation) |
| 2 | Validate color strategy | none | Confirm OKLCH usage, tinted neutrals, commitment level (Restrained/Committed/Full/Drenched) |
| 3 | Validate typography tokens | none | Confirm scale ratios, line lengths, weight hierarchy |
| 4 | Gate implementation | none | Tokens lock in design direction before code |

### Flow G: Component Implementation
**Purpose**: Build the component from research, typography, tokens, and a11y patterns.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Write semantic markup | component-gallery-reference | HTML structure matches industry patterns from Flow B research |
| 2 | Apply typography | fontshare-reference | Font families, weights, sizes from Flow C research |
| 3 | Apply color tokens and spacing | none | Colors, padding, gaps from Flow F tokens |
| 4 | Implement interaction states | component-gallery-reference | State handlers (hover, focus, active, disabled, loading) match component patterns |
| 5 | Validate against design laws | none | Component conforms to spatial, typography, color design laws |

### Flow H: Motion Integration
**Purpose**: Add motion from motion-reference patterns into the component.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Identify animatable elements | none | Elements suitable for motion (entrance, exit, state change) |
| 2 | Apply motion patterns | motion-reference | Easing curves, duration, stagger from Flow E motion palette |
| 3 | Test reduced-motion preference | none | `prefers-reduced-motion` respected |
| 4 | Validate against motion design laws | none | No layout animation, no bounce/elastic, easing curves match register |

### Flow I: Accessibility
**Purpose**: Comprehensive a11y validation across WCAG and semantic requirements.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Validate semantic markup | component-gallery-reference | HTML structure matches patterns, all ARIA roles/labels present |
| 2 | Test keyboard navigation | none | Tab order, focus management, keyboard shortcuts working |
| 3 | Validate color contrast | none | WCAG AAA contrast on text, interactive elements, icons |
| 4 | Test screen reader (VoiceOver/NVDA) | none | Component announces correctly, state changes announced |
| 5 | Validate responsive touch targets | none | All interactive elements at least 40x40px |

### Flow J: Tactical Polish
**Purpose**: Apply make-interfaces-feel-better principles and final refinement.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Concentric border radius | none | outer = inner + padding rule applied |
| 2 | Scale on interaction | none | press = scale(0.96), subtle visual feedback |
| 3 | Optical alignment | none | Elements aligned visually, not just mathematically |
| 4 | Icon state transitions | none | Icon swaps via opacity + scale + blur (scale 0.25-1, opacity 0-1, blur 4px-0) |
| 5 | Tabular numbers on dynamic content | none | `font-variant-numeric: tabular-nums` on changing numbers |
| 6 | Text wrap balance | none | `text-wrap: balance` on headings for readability |
| 7 | Image outlines | none | Images outlined in rgba(0,0,0,0.1), never tinted |

---

## Tier 3: Validation and Polish (Flows K-N)

### Flow K: Multi-Lens Audit
**Purpose**: Run deterministic technical checks across 5 dimensions.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Accessibility audit | component-gallery-reference | WCAG violations, semantic gaps, keyboard traps flagged |
| 2 | Performance audit | none | Layout shifts, paint performance, animation jank identified |
| 3 | Theming audit | none | Color contrast across light/dark, token usage consistency |
| 4 | Responsive audit | none | Breakpoint behavior, touch targets, layout stability across viewports |
| 5 | Anti-pattern detection | none | Design law violations flagged (27 deterministic rules + 12 LLM critique) |

### Flow L: Design Critique
**Purpose**: Independent UX review across hierarchy, clarity, and emotional resonance.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Hierarchy review | none | Visual hierarchy matches information priority |
| 2 | Clarity and cognitive load | none | User intent clear at a glance, no confusion |
| 3 | Emotional resonance | none | Component matches register tone (brand energy vs product utility) |
| 4 | Nielsen heuristics check | none | User control, system feedback, error prevention validated |
| 5 | AI slop detection | none | Category-reflex and anti-reference checks pass |

### Flow M: Responsive Validation
**Purpose**: Verify responsive behavior across breakpoints and device types.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Extract breakpoints from DESIGN.md | none | Defined breakpoints listed |
| 2 | Test each breakpoint | design-references | Layout adapts correctly, reference patterns hold across sizes |
| 3 | Test touch interaction | none | Component functions on mobile, buttons/targets 40x40px minimum |
| 4 | Test container queries if present | none | Component responds to container width, not just viewport |
| 5 | Generate responsive report | none | Confirmation: responsive across all defined breakpoints |

### Flow N: Rapid Iteration (Refined)
**Purpose**: Live browser visual iteration and refinement based on feedback or discovery.

| Step | Activity | Reference System | Output |
|------|----------|------------------|--------|
| 1 | Select elements to iterate | none | Target elements chosen |
| 2 | Generate visual alternatives | design-references | Multiple layout/spacing/color options using design reference patterns |
| 3 | Test in browser | none | Screenshot and compare alternatives |
| 4 | Apply decision | none | Winning variant locked in |
| 5 | Re-validate against design laws | none | Iteration still conforms to register and anti-patterns |

---

## Special Flows (O-V)

### Flow O: Clone/Match
**Purpose**: Match an existing design or interface 1:1.

Reference system invocations:
- **design-references** (Step 2): Extract exact measurements, colors, typography, spacing from reference design
- **component-gallery-reference** (Step 3): Validate semantic match if cloning a component
- **fontshare-reference** (Step 4): Identify exact font if different from project standard

### Flow P: Constraint-Based Design
**Purpose**: Design within tight constraints (budget, performance, platform limitations).

Reference system invocations:
- **design-references** (Step 2): Find pattern examples that work within constraints
- **component-gallery-reference** (Step 3): Identify semantic patterns that minimize JavaScript
- **fontshare-reference** (Step 4): System fonts or minimal-footprint font strategies

### Flow Q: Migration
**Purpose**: Migrate from one design system to another.

Reference system invocations:
- **design-references** (Step 2): Compare old and new system patterns
- **component-gallery-reference** (Step 3): Map old component semantics to new patterns
- **fontshare-reference** (Step 4): Update typography mappings

### Flow R: Layout Optimization
**Purpose**: Fix spacing, rhythm, and visual hierarchy.

Reference system invocations:
- **design-references** (Step 2): Reference spatial patterns from design catalog
- **component-gallery-reference** (Step 3): Validate semantic container structure

### Flow S: Typography Excellence
**Purpose**: Improve font choices, hierarchy, sizing.

Reference system invocations:
- **fontshare-reference** (Step 2): Explore additional font families and pairings
- **design-references** (Step 3): Reference typography from design catalog

### Flow T: Ambitious Motion
**Purpose**: Add technically extraordinary motion and effects.

Reference system invocations:
- **motion-reference** (Step 2): Advanced easing, spring physics, gesture-driven animation patterns
- **design-references** (Step 3): Motion reference patterns from design catalog

### Flow U: Curate
**Purpose**: Capture new design references into the project's design-references catalog.

Reference system invocations:
- **design-references** (Step 2): Add to catalog, tag by pattern type, document reusable principles

### Flow V: All-Seven QA
**Purpose**: Chain all 14 flows in sequence for comprehensive end-to-end validation.

Invokes all flows A-T in dependency order. Reference systems activate at every step as defined in individual flow mappings above.

---

## Summary Table: Which Flows Use Which Reference Systems

| Reference System | Flows |
|---|---|
| **component-gallery-reference** | B, G, H, I, K, O, P, Q, R |
| **fontshare-reference** | C, G, O, P, Q, S |
| **design-references** | D, F, G, M, N, O, P, Q, R, S, T, U |
| **motion-reference** | E, H, T |

---

## How Reference Systems Remain Lean

Each reference system is a thin layer that:
1. Stays up-to-date by accessing live sources (component.gallery, Fontshare, project design references, established motion libraries)
2. Returns curated results without storing the entire source (queries the source, filters, delivers results)
3. Gets invoked only at the moments flows need it (no pre-fetching, no global loading)
4. Produces structured output that flows consume and adapt to the specific context

No slash commands visible. User triggers naturally ("Design a button"), flow detects intent, routes to appropriate flow(s), flow silently invokes reference systems at the right moments, reference systems return guidance, flow applies and reports results.

---

Date: 2026-05-22
