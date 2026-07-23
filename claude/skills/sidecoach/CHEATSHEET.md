---
name: sidecoach-cheatsheet
description: Single-page reference for all 21 sidecoach verbs and every flow in the registry. One-line triggers and example invocations for each.
type: reference
---

# Sidecoach Cheatsheet

Single-page reference for the sidecoach surface. Section 1 covers the 21 verb commands (the user-facing slash commands). Section 2 covers the underlying flows (the internal handler IDs the orchestrator chains together). Section 3 explains how the two layers connect.

This file is generated from `claude/hooks/sidecoach-verbs.json`, `claude/hooks/sidecoach-modes.json`, and `sidecoach/src/flows.ts`. When any of those change, regenerate this file. See the footer for the regeneration note.

---

## Section 0 - Modes (5 commands)

Modes name the shape of work itself, not a single step. Each mode is a curated chain of verbs and takes precedence over verb matches in the same prompt. Type a mode word in any prompt to fire the chain.

| Mode | Shape of work | Verb chain | Example invocation |
|---|---|---|---|
| `forge` | Net-new build from raw to working | shape -> craft -> polish | `forge the homepage` |
| `kiln` | Fire-harden a built thing for production | audit -> critique -> harden -> adapt -> polish | `kiln this release` |
| `bloom` | Add joy, color, motion, personality | colorize -> delight -> animate -> polish | `bloom the empty state` |
| `trim` | Strip a busy UI back to essentials | quieter -> distill -> clarify -> polish | `trim the dashboard` |
| `ralph` | Relentless cross-flow iteration to convergence | polish -> audit -> critique (loop) | `ralph the checkout flow` |

---

## Section 1 - Verbs (21 commands)

Verbs are listed in registry order within each phase. The phase column groups verbs by where in a design workflow they belong. The "Related flow(s)" column lists the underlying flow chain the orchestrator runs when that verb fires.

### Shape and strategy

| Verb | What it does | Example invocation | Related flow(s) |
|---|---|---|---|
| `shape` | Plans a feature's design approach before any code is written | `/sidecoach shape checkout-redesign` | flowA |
| `onboard` | Designs first-run experiences, empty states, and activation funnels | `/sidecoach onboard new-user-tour` | flowG, flowI, flowX |

### Build

| Verb | What it does | Example invocation | Related flow(s) |
|---|---|---|---|
| `craft` | Builds a net-new component end-to-end including tokens and motion | `/sidecoach craft pricing-table` | flowA, flowB, flowE, flowF, flowG, flowH, flowI, flowM, flowJ |
| `animate` | Adds production-grade motion with exponential easing and reduced-motion fallbacks | `/sidecoach animate hero-section` | flowH, flowT |
| `bolder` | Pushes a design toward more visual weight, contrast, and presence | `/sidecoach bolder marketing-hero` | flowJ |
| `colorize` | Applies and refines color and palette decisions on a target | `/sidecoach colorize dashboard.tsx` | flowF |
| `delight` | Adds personality, micro-interactions, and joyful detail to a target | `/sidecoach delight success-state` | flowH |
| `layout` | Reworks spatial relationships, hierarchy, and structural composition | `/sidecoach layout pricing-page` | flowR |
| `overdrive` | Amplifies design expression to its maximum useful intensity | `/sidecoach overdrive landing-hero` | flowT |
| `typeset` | Refines typography, font pairing, scale, and readability | `/sidecoach typeset docs-site` | flowS |
| `clarify` | Removes ambiguity from design language, labels, and intent | `/sidecoach clarify settings-modal` | flowX |

### Review

| Verb | What it does | Example invocation | Related flow(s) |
|---|---|---|---|
| `audit` | Runs a 5-dimension technical scan for accessibility, performance, theming, responsive, and anti-patterns | `/sidecoach audit src/components` | flowK, flowI |
| `critique` | Runs an independent design review across heuristics, cognitive load, and emotion | `/sidecoach critique pages/checkout` | flowL, flowK |
| `polish` | Applies the 16-point tactical refinement checklist as a final-alignment pass | `/sidecoach polish Button.tsx` | flowJ, flowM |
| `harden` | Sweeps a target for production readiness across errors, edge cases, i18n, and a11y | `/sidecoach harden auth-flow` | flowV |
| `adapt` | Adapts a target across all responsive breakpoints and touch targets | `/sidecoach adapt nav-bar` | flowM |
| `optimize` | Tunes a target for performance, efficiency, and runtime cost | `/sidecoach optimize image-gallery` | flowJ |

### Tone

| Verb | What it does | Example invocation | Related flow(s) |
|---|---|---|---|
| `quieter` | Reduces visual noise and decorative complexity | `/sidecoach quieter admin-panel` | flowJ |
| `distill` | Strips a target to only its essential elements | `/sidecoach distill onboarding-modal` | flowJ |

### Docs

| Verb | What it does | Example invocation | Related flow(s) |
|---|---|---|---|
| `document` | Generates a Google-spec DESIGN.md from a project's existing HTML and CSS | `/sidecoach document` | (dedicated handler, no flow chain) |
| `extract` | Pulls reusable tokens and components out of implementation into DESIGN.md | `/sidecoach extract src/styles` | flowU |

---

## Section 2 - Flows (registry)

Flows are the handlers the orchestrator chains. Verbs map to one or more flows. Each flow has its own validator set, memory hooks, and reference systems. Flows are listed by tier in source order.

### Tier 1 - Strategy and research

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowA_brand_verify` | Brand/PRODUCT.md Verification | `craft`, `shape` | Verifies the project has a valid brand register before any design work runs |
| `flowB_component_research` | Component Research (component.gallery) | `craft` | Researches component patterns and implementations from 60 types and 95 systems |
| `flowC_font_research` | Font Research (fontshare.com) | (orchestrator-only) | Researches typefaces and pairing against brand personality |
| `flowD_reference_inspiration` | Reference/Inspiration Search | (orchestrator-only) | Searches the personal design-references catalog for matching patterns |
| `flowE_motion_patterns` | Motion Pattern Library | `craft` | Researches motion patterns and animation techniques across the GSAP/Lenis stack |

### Tier 2 - Execution

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowF_design_tokens` | Design System Tokens (DESIGN.md) | `craft`, `colorize` | Full DESIGN.md workflow including token extraction, management, and linting |
| `flowG_component_implementation` | Component Implementation | `craft`, `onboard` | Maps a design spec to implementation with variants, states, and responsive behavior |
| `flowH_motion_integration` | Motion Integration (GSAP/Lenis) | `craft`, `animate`, `delight` | Wires production-ready motion using ScrollTrigger, Flip, SplitText, DrawSVG |
| `flowI_accessibility` | Accessibility Compliance (WCAG 2.1 AA) | `craft`, `onboard` | Runs WCAG 2.1 AA validation, screen reader testing, and severity prioritization |

### Tier 3 - Polish and QA

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowJ_tactical_polish` | 16-Point Tactical Polish | `craft`, `polish`, `bolder`, `quieter`, `distill`, `optimize` | Applies the tactical-polish refinement rules |
| `flowK_multi_lens_audit` | Multi-Lens Audit (5 dimensions) | `audit`, `critique` | Runs a technical scan across accessibility, performance, theming, responsive, anti-patterns |
| `flowL_design_critique` | Design Critique (Nielsen heuristics) | `critique` | Runs an independent design review across heuristics, cognitive load, emotional journey |
| `flowM_responsive_validation` | Responsive Design Validation | `craft`, `polish`, `adapt` | Validates breakpoints, touch targets at 40x40 minimum, and viewport behavior |
| `flowN_rapid_iteration_refined` | Rapid Iteration (Token-based) | (orchestrator-only) | Goal-driven token-based refinement with success criteria and decision framework |

### Tier 4 - Special workflows

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowO_clone_match_special` | Clone/Match from Reference (Special) | (orchestrator-only) | Performs pixel-perfect 1:1 replication of an existing reference |
| `flowP_constraint_design_special` | Constraint-Based Design (Special) | (orchestrator-only) | Designs under explicit limits like budget, scope, accessibility floor |
| `flowQ_migration_special` | Migration/Refactor (Special) | (orchestrator-only) | Refactors a component API with dependency mapping and pre/post signoff gates |

### Tier 5 - Specialized refinement

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowR_layout_optimization` | Layout and Spacing Optimization | `layout` | Fixes layout, spacing, and visual rhythm with grid optimization and hierarchy adjustment |
| `flowS_typography_excellence` | Typography Excellence | `typeset` | Improves font choices, hierarchy, sizing, weight, and readability |
| `flowT_ambitious_motion` | Ambitious Motion and Physics | `animate`, `overdrive` | Pushes interfaces past conventional limits with shaders, springs, and cinematic transitions |

### Special - Curate and end-to-end QA

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowU_curate` | Curate Design References | `extract` | 5-step wizard for adding components and patterns to the design-references catalog |
| `flowV_all_seven_qa` | All-Seven QA Pipeline | `harden` | Chains all 7 tiers for end-to-end comprehensive design pipeline QA |

### Tier 6 - Composition and copy

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowW_landing_composition` | Landing Page Composition | (orchestrator-only) | Decides which sections a landing page needs and how to space them, register-aware |
| `flowX_copywriting` | Copywriting (per-slot draft options) | `onboard`, `clarify` | Generates 2-3 draft copy options per slot using register and product context |

### Tier 7 - Renamed legacy flows (T-0015, 2026-05-28)

The original number-prefixed flow IDs (`flow1`..`flow14`) were culled. Twelve were duplicates of lettered counterparts; two carried unique behavior and survive with letter prefixes. See the T-0015 beat for the per-flow mapping table.

| Flow ID | Name | Triggered by verb(s) | One-line purpose |
|---|---|---|---|
| `flowY_explore_discovery` | Exploration/Discovery Mode | (orchestrator-only) | Open-ended exploration without success criteria |
| `flowZ_design_component` | Design a New Component (from scratch) | `craft` | Creates a new component from scratch with the audit -> critique -> polish QA triad |

---

## Section 3 - How verbs route to flows

When you type a slash command like `/sidecoach craft <target>`, two paths converge.

The `UserPromptSubmit` hook at `claude/hooks/sidecoach-keyword.sh` (built by T-0008) reads the prompt, sanitizes it (strips fenced code blocks, inline backticks, URLs, XML tag bodies, and transcript markers), then matches each verb in `sidecoach-verbs.json` with hyphen-aware word boundaries. The first matching verb wins, registry order breaks ties, and informational framings like "what is X" or "how do I X" suppress the fire. On a hit, the hook injects an `additionalContext` line naming the verb so the model routes to the right flow chain.

In parallel, the slash-command router in `sidecoach/src/slash-command-router.ts` looks up the verb in `verb-command-registry.ts`, retrieves the `flowIds` chain for that verb, and runs each flow in order. Each flow produces guidance, a checklist, artifacts, and a memory entry. The orchestrator appends the verb-specific `guidanceAppend` lines after the chain finishes so the response speaks the verb's voice while keeping sidecoach's validators, BuildReport, taste validation, and memory infrastructure intact.

The keyword hook is the keyword-detector layer (it ensures the right intent gets recognized even when the user does not type the slash command directly). The verb registry is the flow-mapping layer (it turns a verb into a deterministic chain). The two together replace the older "skill auto-trigger" model that did not fire reliably on real builds.

### Setup commands (teach + document)

Setup commands are NOT verbs - they're dedicated handlers in the orchestrator that write canonical project files (PRODUCT.md, DESIGN.md). They exist outside the 21-verb registry because they're invoked once at project setup, not per-task.

| Command | What it does |
|---|---|
| `/sidecoach teach [brief]` | Brief-driven hybrid setup. Parses the brief, asks targeted questions only for the gaps, writes PRODUCT.md. Refuses to overwrite a real existing PRODUCT.md unless `metadata.forceOverwrite=true`. |
| `/sidecoach teach --deep [brief]` | Deep-interview mode (T-0023). Extends taxonomy from 5 to 9 fields (adds problem, success metrics, business model, technical constraints, brand voice), runs vague-answer detection that demotes generic answers and asks sharper follow-ups, reports an OMC-style ambiguity score across 4 dimensions (goal/constraints/criteria/context) with weakest-dimension targeting, validates the written PRODUCT.md structurally, hands off to `/sidecoach document` when DESIGN.md is missing. |
| `/sidecoach document` | Scans project HTML/CSS and writes a Google-spec DESIGN.md (YAML token frontmatter plus six canonical-order sections). |

---

*Generated from `claude/hooks/sidecoach-modes.json`, `claude/hooks/sidecoach-verbs.json`, and `sidecoach/src/flows.ts`. Regenerate after registry changes.*
