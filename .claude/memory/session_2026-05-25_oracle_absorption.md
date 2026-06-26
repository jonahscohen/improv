---
name: Oracle absorption into sidecoach (COMPLETE)
description: Verbatim+extension extraction of all 36 oracle files into sidecoach/reference/_extracted/oracle/ with verbatim lift, extension specificity, and gap analysis per file
type: project
relates_to: [session_2026_05_23_handoff_for_next_session.md, sidecoach_consolidation_gameplan.md]
---

Collaborator: Jonah

## Status: COMPLETE

All 36 source files from `/Users/spare3/.claude/plugins/cache/oracle/oracle/3.1.1/skills/oracle/` extracted to `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/oracle/`.

## Files extracted (36 total)

### Top level
- SKILL.md

### reference/ (35 files)
- Registers: brand.md, product.md
- Build flow: craft.md, shape.md, teach.md, document.md, extract.md, codex.md
- Evaluate: critique.md, audit.md
- Refine: polish.md, bolder.md, quieter.md, distill.md, harden.md, onboard.md
- Enhance: animate.md, colorize.md, typeset.md, layout.md, delight.md, overdrive.md
- Fix: clarify.md, adapt.md, optimize.md
- Iterate: live.md
- Domain: color-and-contrast.md, typography.md, spatial-design.md, motion-design.md, interaction-design.md, responsive-design.md, cognitive-load.md, heuristics-scoring.md, personas.md, ux-writing.md

Every file has the same three-section structure: VERBATIM LIFT (full source content), EXTENSION (added specificity / detection patterns / prescribed values), WHAT'S MISSING (honest gaps).

## Punctuation policy

Source files use long dashes (em and en) extensively for ranges, parenthetical asides, and emphasis. The dotfiles repo's content-guard hook blocks both. Every extracted file substitutes long dashes with regular hyphens or rewrites the construction. The preamble of each file notes this so consumers know to recognize the substitution.

Semantic content was preserved in every case. No bans were softened, no commitment thresholds were changed, no easing values were altered.

## Tallies (named bans / rules / protocols captured)

### Cross-register (shared design laws in SKILL.md)
- 6 named absolute bans (side-stripe borders, gradient text, glassmorphism, hero-metric template, identical card grids, modal as first thought)
- 4 named commitment-axis strategies (Restrained, Committed, Full palette, Drenched) with exact threshold percentages (at most 10%, 30-60%, 3-4 roles, ~100%)
- 1 named em-dash ban
- 2-altitude category-reflex check (first-order, second-order)
- 4 OKLCH color principles (use it, reduce chroma at extremes, tint neutrals, no pure black/white)

### Register-specific
- Brand: 8 named brand bans + 5 named brand permissions + 1 saturated aesthetic lane ("Editorial-typographic")
- Product: 5 named product bans + 5 named product permissions + 8 mandatory interaction states (enumerated as 9 with selected in the extension)
- Brand font reflex-reject list: 23 named banned fonts (Fraunces, Newsreader, Lora, Crimson family, Playfair Display, Cormorant family, Syne, IBM Plex family, Space Mono/Grotesk, Inter, DM family, Outfit, Plus Jakarta Sans, Instrument family)

### Flow protocols
- Craft: 4-gate sequence (shape confirmed -> codex Step A -> palette -> direction approved) with explicit no-compression rule
- Codex: 4 stop points (A, B, C, D) before code
- Shape: 2-3 questions per round, max 2 rounds, compact-vs-full brief decision
- Teach: 6 steps with codebase exploration + register hypothesis matrix
- Document: 6-section Stitch DESIGN.md format with strict ordering + YAML frontmatter token schema
- Live: 7-step contract + 8 generate substeps + carbonize 5-step cleanup + 4-phase variant planning (identity / mode / axes / squint)
- Critique: independence enforcement of 2 assessments (LLM + detector) + 10-heuristic 40-point scoring + persona red-flag walkthrough
- Audit: 5-dimension 20-point scoring with P0-P3 severity tags
- Polish: drift root-cause classification (missing token, one-off impl, conceptual misalignment) + 22-item polish checklist

### Domain reference rules
- Typography: 5-size scale, 1.25 ratio minimum, fluid for brand / fixed for product, light-on-dark compensation on 3 axes
- Color: WCAG 4.5:1 body / 3:1 UI / 7:1 AAA + OKLCH defaults + tinted neutrals (0.005-0.015 chroma) + 60/30/10 rule
- Motion: 100/300/500 duration ladder + 3 exponential easings (quart, quint, expo) + 2 banned easings (bounce, elastic) + exit ~75% of enter
- Spatial: 4pt base scale + auto-fit grid pattern + container queries for components + 44px touch targets + semantic z-index
- Interaction: 8 (+ selected = 9) mandatory states + focus-ring prescribed (2-3px, 2px offset, 3:1 contrast) + anchor-positioning pattern
- Responsive: mobile-first + content-driven breakpoints + pointer/hover queries + safe-area-inset support
- UX writing: button verb+object pattern + error message 3-part formula + voice/tone distinction + i18n expansion budgets
- Cognitive load: 3 types (intrinsic, extraneous, germane) + 8-item checklist + working memory cap of 4 items
- Heuristics: Nielsen's 10 with 0-4 scoring + 5 rating bands (Excellent 36-40 to Critical 0-11)
- Personas: 5 archetypes (Alex power user, Jordan first-timer, Sam a11y, Riley stress tester, Casey mobile) + selection table by interface type

## Gaps catalogued (for consolidation step)

Every "WHAT'S MISSING" section names specific gaps. Aggregated themes:

### Missing across many files
- No DESIGN.md cross-references. Many files prescribe tokens (motion, color, typography) but don't draw the line to DESIGN.md frontmatter or sidecar.
- No CI / automation integration. Most prescriptions are human-triggered; no CI hooks for audit, critique, contrast checking, bundle budgets.
- No versioning / changelog discipline. Files like teach, document, reflex-reject lists evolve over time but have no update protocol.
- No measurement loops. Verifications are listed but rarely with concrete tools, baselines, or A/B test frameworks.
- No internationalization depth beyond i18n in harden / ux-writing. RTL / CJK / German expansion mentioned but no end-to-end pipeline.

### Missing domain coverage
- Data visualization (categorical palettes, sequential, diverging) - referenced in audit / colorize but no actual catalog
- Security as UI concern (XSS, CSRF, CSP, SRI) - absent from audit
- PWA / install / offline beyond service-worker mention
- Multi-window / multi-tab / desktop-app patterns
- Mobile-app-shell wrapping (React Native, Capacitor)
- Drag-and-drop catalog (mentioned for delight; no implementation pattern)
- Command palette catalog (mentioned for product; no implementation pattern)
- Notification / alert hierarchy (toast vs banner vs modal vs inline)
- Empty-state taxonomy beyond surface-level treatment
- Print stylesheet depth beyond adapt's short section
- Email-template depth beyond adapt's short section

### Missing process / coordination
- Multi-stakeholder design protocols (designer + Claude + reviewer + buyer)
- PR handoff format (no template for what goes in PR description, commit message)
- Visual regression testing setup (Chromatic, Percy, Playwright snapshots)
- Design-system gap reporting (when polish finds a missing token, no protocol for landing it in DESIGN.md)
- Onboarding-debt management (tooltips accumulate; no protocol for trimming)
- Delight backlog management (easter eggs accumulate)
- Override protocols when shared laws conflict with PRODUCT.md
- Multi-user concurrency in live mode

### Missing rubrics
- Theme scene-sentence quality rubric (how concrete is concrete enough?)
- Brief-padding-vs-clarity rubric
- Audit baseline / target metrics by project type
- Bundle-size budget by app class
- Brand vs product mixed-register handling
- Departure-mode vs default-mode decision when signals are ambiguous

## Output structure verified

Tree:
```
sidecoach/reference/_extracted/oracle/
  SKILL.md
  reference/
    adapt.md
    animate.md
    audit.md
    bolder.md
    brand.md
    clarify.md
    codex.md
    cognitive-load.md
    color-and-contrast.md
    colorize.md
    craft.md
    critique.md
    delight.md
    distill.md
    document.md
    extract.md
    harden.md
    heuristics-scoring.md
    interaction-design.md
    layout.md
    live.md
    motion-design.md
    onboard.md
    optimize.md
    overdrive.md
    personas.md
    polish.md
    product.md
    quieter.md
    responsive-design.md
    shape.md
    spatial-design.md
    teach.md
    typeset.md
    typography.md
    ux-writing.md
```

36 files, all populated with the three-section structure (VERBATIM LIFT, EXTENSION, WHAT'S MISSING).

## Ready for consolidation step

The extracted library now sits next to sidecoach's existing 36 flows. The gap list above is the input for the consolidation step that follows.
