---
source: https://github.com/bergside/typeui/blob/main/skills/fundamentals/SKILL.md
author: typeui.sh
captured: 2026-05-25
type: external-taste-skill (index file)
license: MIT
---

# TypeUI - Design Fundamentals (Index)

## SECTION 1: VERBATIM LIFT

Universal UI/UX design principles covering visual hierarchy, interaction laws, typography foundations, and WCAG accessibility requirements. Use when making design decisions not covered by a specific design system, validating principle compliance, or resolving conflicts between aesthetics and accessibility. Design-system-agnostic and applies to every surface.

### Module index (sibling files)

| File | Purpose |
|---|---|
| `ui-principles.md` | Universal visual design principles - hierarchy, layout rhythm, typography placement, color theory, depth & layering, interaction design, responsive adaptation, component behavior |
| `ux-principles.md` | Interaction & control principles - 30 UX laws, button/control state contracts (9 states), hover/active technique palettes, touch targets, cognitive load, feedback loops |
| `typography-principles.md` | Typography-specific principles - type system foundations, scale & modular ratios, readability & measure, accessibility, responsive type, brand tone expression |
| `accessibility.md` | WCAG 2.1/2.2 compliance - contrast ratios, color-as-information rules, focus visibility, keyboard navigation, motion safety, target sizes, text spacing, semantic structure, ARIA |

### Conflict resolution

When sources disagree:

1. **Design system** wins for concrete values (colors, sizes, spacing tokens, component specs).
2. **Fundamentals** (this layer) win for structural principles (hierarchy, accessibility, motion logic).
3. **Vertical** wins for process decisions AND content architecture (section order, required sections, industry tone).

Accessibility is non-negotiable at every level - it overrides aesthetic preferences everywhere.

When the design system is silent, these principles decide. Never contradict the design system - if a principle and a design-system rule conflict, the design system wins. Flag the conflict for review.

---

## SECTION 2: EXTENSION

This SKILL.md is the entry index. The four sibling files are extracted in:
- `typography-principles.md` (this folder) - fully extracted with 6 pillars
- `ui-principles.md` (this folder) - extracted summary
- `ux-principles.md` (this folder) - extracted summary
- `accessibility.md` (this folder) - extracted summary

The structural insight TypeUI adds: design knowledge is organized in three tiers:
1. **Design system** (concrete tokens) - the WHAT.
2. **Fundamentals** (universal principles) - the WHY.
3. **Vertical** (process/workflow) - the HOW.

Sidecoach has tier 1 (DESIGN.md) and tier 3 (the 36 flows). Tier 2 has been implicit (scattered across handler validators). TypeUI's fundamentals layer makes the WHY explicit and inheritable.

---

## SECTION 3: What this covers that impeccable + make-interfaces-feel-better don't

The three-tier mental model (system / fundamentals / vertical) and the explicit conflict-resolution priority. Impeccable's commands implicitly operate across all three tiers without naming the distinction. Make-interfaces-feel-better is tier 2 (fundamentals) tactical-only. TypeUI separates the layers so when an audit flags a conflict, you know which tier overrides.
