---
name: MIFB absorption into sidecoach reference library
description: Extracting make-interfaces-feel-better skill into sidecoach/reference/_extracted/ with verbatim lift + extension + gaps per file
type: project
relates_to: []
---

Extracting make-interfaces-feel-better's 5 source files into sidecoach reference library at `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/`.

Source location: `/Users/spare3/.agents/skills/make-interfaces-feel-better/`
- SKILL.md (148 lines)
- typography.md (135 lines)
- surfaces.md (256 lines)
- animations.md (379 lines)
- performance.md (88 lines)

Format per file: VERBATIM lift first, then Extension (increasing specificity with reasoning behind exact values), then What's missing (gaps in MIFB coverage).

## Progress

- SKILL.md: written. Contains 16 principles verbatim + per-principle extensions explaining the perceptual JND for 0.95 scale floor, Tailwind radius mapping, three-layer shadow reasoning, CSS transition retarget mechanics, exact bezier/duration combos. 15 named gaps including IA, copy, full a11y, responsive, contrast computation, dark-mode, loading, errors, forms, motion-a11y, brand register, layout, data viz, i18n, perf.
- typography.md: written. text-wrap balance/pretty, font smoothing, tabular nums verbatim. Extension covers companion max-width requirement for balance, why 6-line Chromium limit (O(n^2) cost), per-element vs root smoothing failure mode, single-digit-tick min-width fix, Inter/Geist/IBM Plex tabular variant verification list. 14 named gaps: font pairing, type scale, leading/tracking, optical sizing, font-feature beyond tabular, weight ramps, font loading strategy, CJK/RTL, reading typography, hierarchy, contrast, i18n wrap support, fallback chains.
- surfaces.md: written. Concentric radius, optical alignment, 3-layer shadow stack, image outlines, hit areas verbatim. Extension covers Tailwind radius mapping table, 8-row canonical padding/radius pairing table, three-layer shadow role breakdown (ring/lift/ambient), why pure neutral not tinted (10% chroma reads as dirt), 6 forbidden Tailwind outline classes, Fitts's Law on hit areas, three-level recursive concentric example. 15 named gaps: non-8px radius scales, asymmetric corners, color palette/contrast, spacing scale, z-index, focus states (conflict with shadow rule), backdrop blur, skeletons, form input chrome, tabs/chips, avatars, card composition, modal/sheet specs, hover lift specifics, glow.
- animations.md: written. Interruptible animations, split-stagger enter, subtle exit, icon animations, scale-on-press, skip-on-load verbatim. Extension covers transition vs keyframe decision tree (12-row table), 4-tier duration calibration, why 100ms inter-chunk is perceptual sweet spot, per-word stagger marketing-only rule, canonical enter composition table (opacity 0->1, translateY 12px->0, blur 4px->0), 4-row exit decision table, full reasoning for `bounce: 0` and 300ms icon duration, JND analysis for scale-on-press, static prop use cases, verification recipe for `initial={false}`. 17 named gaps: prefers-reduced-motion (largest), motion libraries beyond Framer, scroll-driven, page transitions, FLIP/list reorder, spring tuning, sequential timelines, shared element transitions, drag/gesture, easing glossary, loading states, error/success feedback, hover lift specifics, microinteraction patterns, performance budgets, 3D transforms, color transitions.
- performance.md: written. transition specificity + will-change verbatim. Extension covers 6-row safe-vs-dangerous Tailwind class table, cascade hazard explanation, CI grep test, when-to-add and when-NOT-to-add will-change rules, 15-row GPU-compositable property table (transform/opacity/filter/clip-path Yes; layout-triggering No; paint-only No), GPU memory cost math (300x200 card = 240KB, 50 cards = 12MB), Safari-specific benefit, scoped application via active-state class pattern. 17 named gaps: frame budget/60fps, Layout-Paint-Composite model, reflow avoidance, bundle size, image perf, layout shift prevention (only tabular-nums in MIFB), critical CSS, font loading perf, network/resource hints, JS animation performance, memory leaks, concurrent animation limits, low-end device strategy, GPU memory budget, profiling tools, SSR perf, build-time vs runtime CSS cost.

## COMPLETE

All 5 files written. Total exact values preserved:
- scale(0.96), 0.95 floor (perceptual JND)
- 40x40px hit area, 44x44 WCAG
- rgba(0,0,0,0.1) light / rgba(255,255,255,0.1) dark image outline
- scale 0.25->1, opacity 0->1, blur 4px->0 icon animation
- ~100ms stagger, ~80ms per-word for headlines
- cubic-bezier(0.2, 0, 0, 1) for spring-approximation
- bounce: 0 for spring (Framer Motion override)
- duration 0.3 (300ms) icon
- 6-line Chromium / 10-line Firefox for text-wrap: balance
- 3-layer shadow (ring 0.06 + lift 0.06 + ambient 0.04)
- shadow hover delta: +0.02 opacity per layer
- dark mode shadow: single 0.08/0.13 white ring
- text-side - 2px on icon side padding (pl-4 pr-3.5)
- play triangle margin-left: 2px
- exit translateY -12px, 150ms vs 300ms enter
- transition-transform = transform/translate/scale/rotate
- 16 core principles
- ~80 gaps named across 5 files

## Files touched

- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/SKILL.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/typography.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/surfaces.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/animations.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/performance.md
- /Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-25_mifb_absorption.md

## Key constraint

CLAUDE.md bans emdashes globally. Source uses emdashes throughout. Resolution: converted all emdashes to ` - ` (space hyphen space) in extracted files, with a note at top of each file explaining the conversion. All other content byte-for-byte preserved.

## Exact values preserved (running count)

- `scale(0.96)` floor, `0.95` minimum
- `40x40px` hit area
- `rgba(0, 0, 0, 0.1)` light mode image outline
- `rgba(255, 255, 255, 0.1)` dark mode image outline
- `scale 0.25 -> 1`, `opacity 0 -> 1`, `blur 4px -> 0px` for icon animation
- `~100ms` stagger delay, ~80ms per word for titles
- `cubic-bezier(0.2, 0, 0, 1)` for CSS spring approximation
- `bounce: 0` for spring animations
- `duration: 0.3` (300ms) for icon spring
- 6-line Chromium limit / 10-line Firefox limit for text-wrap: balance
- 3-layer shadow stack (ring + lift + ambient)
- `transition-transform` covers transform/translate/scale/rotate

## Files touched

- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/make-interfaces-feel-better/SKILL.md (created)
- /Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-25_mifb_absorption.md (this file)
