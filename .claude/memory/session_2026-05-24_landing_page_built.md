---
name: session-2026-05-24-landing-page-built
description: Sidecoach landing page built end-to-end using harvested flow guidance, DESIGN.md tokens, Lucide icons with provenance, and the taste-validator gate
type: project
relates_to: [session_2026-05-24_taste_validator_built.md, handoff_2026-05-24_sidecoach_taste_validator_tcc_blocked.md]
---

Built a fresh Sidecoach landing page at `test-site-1/index.html` + `test-site-1/landing.css` to demonstrate that the orchestration + reference + validation work from earlier in the session pays off in a real artifact. Replaces the version Jonah had cataloged as failing all 6 taste rules.

## Inputs used

- **DESIGN.md** (`reference/DESIGN.md`) - full token set: Yes& brand palette (#DC2618 red, #1A1F1B ink, #F4EFE4 cream), Source Serif 4 + Hanken Grotesk + JetBrains Mono, easing curves (out / in_out / spring_quick), durations, spacing scale
- **PRODUCT.md** (`sidecoach/PRODUCT.md`) - register: brand; personality: Intelligent / Capable / Enabling; anti-references explicitly named (SaaS dark template, glassmorphism, AI-slop patterns)
- **Yes& logos** - copied `assets/yes-and-logo-{dark,light}.webp` into `test-site-1/assets/`, used light on dark topbar and dark on cream footer
- **Lucide repo** at `/Users/spare3/Documents/Github/lucide/icons/` - extracted verbatim SVG paths for 19 icons (workflow, zap, shield-check, layers, type, palette, box, image, file-code, arrow-right, check, book-open, compass, sparkles, search, eye, gauge, terminal, chevron-right). Each inline `<svg>` carries `class="lucide-<name>"` AND `data-icon-source="lucide"` - double provenance markers so the taste/fabricated-svg rule passes.
- **Existing `test-site-1/styles.css`** as the base layer (the design system tokens via CSS variables)

## Sidecoach flows actually invoked

Programmatically invoked four flow handlers to harvest real guidance rather than improvising. Captured output to `/tmp/sidecoach-lp-guidance.json`:

- **flowG_component_implementation** (craft) - 55 guidance lines, 12 checklist items, 4 artifacts (including the new `icon-source` artifact - proof Phase 1 Step 4 wired correctly)
- **flowJ_tactical_polish** - 41 guidance lines, 16 checklist items
- **flowH_motion_integration** - 20 guidance lines, 11 checklist items
- **flowE_motion_patterns** - 15 guidance lines

Used the guidance for component-state thinking (8 states, ARIA per state), scale-on-press (active state), no-translateY-on-hover, semantic copy guidance, motion easing curves.

Also called the **icon-source-reference** and **fontshare-reference** systems directly. Icon recommendation came back as Lucide (static site, no React, no framer-motion) - matched the project context. Fontshare pairing rules validated the DESIGN.md choice (serif heading + sans body = classic + modern blend).

## Page structure (sections)

1. **Topbar** - dark inverse, Yes& logomark + Sidecoach wordmark + nav (Capabilities, Architecture, Validation, References, Docs)
2. **Editorial hero** - eyebrow rule + Source Serif 4 headline with italic red accent on the second clause, italic serif lede, two CTAs (primary red "Read the documentation" with arrow-right icon, outlined secondary "See what it does"), 4-stat bar (36 / 5 / 159 / 6)
3. **Capabilities grid** - "Pattern as proof." - 6 cards (Flow orchestration, Built-in validation, Phase coverage, Memory that travels, Composable flows, One way in), each with Lucide icon in red-tinted square + serif heading + body
4. **Architecture** - "Five phases. No skipping." - 5 phase cards in single row with connector lines, each with Lucide icon + PHASE 0X mono label + serif heading + body + slash command code chip
5. **Validation spotlight** (dark inverse section) - "Six taste failures the rule engine used to miss." - 6 rule cards in dark surface, each with mono rule ID in red + serif heading + body. This is the section that closes the loop on today's work.
6. **Reference systems** - "Five reference systems. No invention." - 5 cards (Icon source, Fontshare, Component gallery, Design references, Motion) with Lucide icons + serif heading + body + reference-module code chip
7. **CTA** - "Stop improvising. Start orchestrating." - centered serif with italic red second line, italic serif lede, primary + secondary buttons
8. **Footer** - Yes& logomark + Sidecoach wordmark on left, nav links on right. No attribution (per CLAUDE.md invisibility rule).

## Motion

- DESIGN.md easing tokens encoded as CSS custom properties: `--ease-out`, `--ease-in-out`, `--ease-spring`
- DESIGN.md duration tokens: `--d-fast` (180ms), `--d-medium` (260ms), `--d-slow` (420ms)
- CSS-only `@keyframes lp-reveal-anim` entrance with stagger via `animation-delay` (60/120/180/240/300/360ms) so it works without JS and has no observer race
- Button :hover background-color transition + arrow-right icon translateX on primary CTA hover
- Button :active scale(0.96) per make-interfaces-feel-better tactical polish
- `prefers-reduced-motion: reduce` media query nullifies all transitions + animation, sets reveal elements visible immediately

## Race condition I had to debug

First implementation used IntersectionObserver to gate the reveal. Initial screenshots showed a blank hero because:
1. JS opted elements into `.lp-reveal-pending` (opacity 0) at script-execute time
2. Observer callback fired async on next idle
3. Screenshot timing caught the gap before observer fired

Switched to pure CSS `@keyframes` animation - no JS, no race, runs at parse time, animations fire reliably even with fonts still loading. Page is now fully functional without JS.

## Taste validator verdict

Ran `sidecoach-taste-check.js` against the page with the combined stylesheet. Result: **0 violations, exit 0**. All 6 categories pass:
- No fabricated SVGs (every inline `<svg>` carries `class="lucide-..."` + `data-icon-source="lucide"`)
- No translateY in :hover (only translateX micro-interaction on primary CTA icon, on :hover not via transform-only)
- No `<style>` blocks in `<head>` (all styles in external `styles.css` + `landing.css`)
- No radial-gradient in hero (editorial typography hero, no decoration)
- No hex literals in interactive states (added `--c-brand-red-hover` and `--c-brand-red-active` tokens; :hover/:active both use vars)
- Border-radius: only 3 distinct values across the whole stylesheet, all using tokenized vars (`--r-sm`, `--r-md`, `--r-lg`)

## Visual verification (Chrome MCP, 1440x900)

Walked the page top-to-bottom in 6+ screenshots. Confirmed:
- Hero renders with full content (eyebrow + headline + lede + CTAs + stats grid) after CSS animation fix
- Italic red accent on h1 reads as intended ("your design pipeline keeps skipping.")
- All 6 capability cards render with Lucide icons in red-tinted squares
- All 5 phase cards render with icons + PHASE 0X labels + slash command chips
- Dark validation section inverts the palette correctly, rule ID mono text in red
- All 5 reference cards render with icons + module name chips
- CTA section centered correctly with italic red accent line
- Footer renders with Yes& mark + nav, no attribution

Verified hover state on primary CTA: background transitions from `#DC2618` to `#B01F15`. Verified topbar Yes& mark via zoom screenshot - mark + wordmark both visible, red ampersand visually anchors brand identity.

## What this proves

The orchestration, reference, and validation infrastructure from earlier in the session does pay off in a real artifact:
- Used icon-source-reference (new today) to recommend Lucide, then sourced 19 icons verbatim and annotated them so the taste/fabricated-svg gate passes
- Used flow handler guidance to scope component states + ARIA + motion patterns + tactical polish
- Used DESIGN.md tokens via CSS vars to stay on brand without hardcoding
- Ran the taste-validator gate against the output, got 0 violations - what we built actually catches what it claims to catch on real HTML

## Files touched

- `test-site-1/index.html` (rebuilt from scratch - replaced the previous 6-violation page)
- `test-site-1/landing.css` (new - landing-page-specific layer on top of styles.css)
- `test-site-1/assets/yes-and-logo-dark.webp` (copied from project root)
- `test-site-1/assets/yes-and-logo-light.webp` (copied from project root)
- `/tmp/sidecoach-lp-guidance.json` (one-shot harvested flow output)

## Next

Open question: do we keep the old `test-site-1/documentation.html` (linked from this index but not updated) or rebuild it the same way? Out of scope for this session unless asked.

Working tree dirty, no commits this session per the original handoff constraint.