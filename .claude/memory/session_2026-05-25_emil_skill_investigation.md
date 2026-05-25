---
name: Emil Kowalski skill investigation
description: Investigated emilkowalski/skill repo to identify disparities with sidecoach; concrete tactical motion rules sidecoach lacks
type: reference
relates_to: [session_2026-05-24_sprint4_closed.md, session_2026-05-22_phase5_tier2_completion_summary.md]
---

Investigated github.com/emilkowalski/skill (single SKILL.md, 27KB, 679 lines) at user request. Goal: identify what Emil's skill enforces that sidecoach (36 flows, 159-rule validator) misses.

## Repo structure
- One file: `skills/emil-design-eng/SKILL.md`
- README is 51 bytes (just a pointer to emilkowal.ski/skill)
- Activation phrase: "I'm ready to help you build interfaces that feel right..."
- Mandatory output format: Before/After/Why markdown TABLE (not list)

## Key disparities found vs sidecoach

1. **Frequency-based animation decision matrix** - Emil's first question is "how often will the user see this?" with a hard rule: keyboard-initiated actions get ZERO animation (Raycast has no open/close animation). Sidecoach motion validator checks easing+duration but never asks frequency.

2. **Named custom cubic-bezier curves** - Emil ships exact values: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` with "built-in CSS easings are too weak". Sidecoach's motion-integration.ts uses `cubic-bezier(0.4, 0, 0.2, 1)` (Material) - weaker curves.

3. **Origin-aware popovers with modal exception** - `transform-origin: var(--radix-popover-content-transform-origin)` for popovers, but modals KEEP `center`. Sidecoach has no popover-origin rule.

4. **Asymmetric enter/exit timing pattern** - "slow where the user is deciding, fast where the system is responding" - press 2s linear, release 200ms ease-out. Sidecoach validates symmetric durations.

5. **Perceived performance rules** - fast-spinning spinner makes load FEEL faster; 180ms select beats 400ms; instant-tooltip-after-first. Sidecoach has no "perception" concept.

6. **Framer Motion `x`/`y` hardware acceleration caveat** - `motion.div animate={{x: 100}}` is NOT hardware accelerated; must use full `transform: "translateX()"` string. Sidecoach motion validator has no FM-specific check.

7. **CSS variable inheritance perf gotcha** - changing a CSS var on a parent recalcs ALL children styles; for swipe-amount type updates use `element.style.transform` directly. Sidecoach perf domain doesn't catch this.

8. **The blur-to-mask-transitions trick** - `filter: blur(2px)` during crossfades; under 20px (heavy blur is expensive in Safari).

9. **clip-path animation patterns** - tabs with duplicated active-styled list, hold-to-delete with `inset(0 100% 0 0)`, comparison sliders, image reveals. Entire technique missing from sidecoach.

10. **Velocity-based dismissal** - drag velocity > 0.11 dismisses regardless of distance threshold. Damping at boundaries instead of hard stops.

## Sidecoach gaps it doesn't address
Emil's skill is animation/feel focused. It does NOT cover: PRODUCT.md/DESIGN.md generation, voice/copy validation, accessibility WCAG checks beyond reduced-motion, responsive testing, brand verification. So scope is complementary not competitive.

## Verdict
Worth borrowing tactical motion rules. The animation decision framework (frequency-first), named strong cubic-beziers, perceived performance heuristics, and the FM `x`/`y` hardware accel gotcha would meaningfully upgrade sidecoach's motion validator. Asymmetric enter/exit timing is a new principle entirely.

## Files touched
- /tmp/emil-skill.md (transient download for investigation)
- No project files modified
