---
name: Six external skills evaluated for factoring (2026-06-12)
description: Team of 6 parallel agents evaluated Section 508 GRC, baseline-ui, fixing-accessibility, fixing-motion-performance, 12-principles-of-animation, design-lab; all six = borrow-selectively, none adopted whole; ranked borrow list produced
type: reference
relates_to: [session_2026-05-25_emil_skill_investigation.md, session_2026-05-25_tasteskill_competitive_investigation.md]
---

Collaborator: Jonah. Deployed a 6-agent team (skill-eval, cmux teammates) to evaluate six
external skills for factoring into the stack layers. Each agent fetched the full external
SKILL.md source (ui-skills.com 403'd for all; GitHub raw was the real source every time),
read the corresponding local layers, and returned an overlap analysis + factoring verdict
in the Emil/taste-skill precedent format. Evaluation only - NOTHING IMPLEMENTED YET.

## Verdicts (all six: borrow-selectively, adopt-whole rejected everywhere)

1. **Section 508 GRC** (Sushegaad repo) - leaning reject. WCAG core is 2.0, OLDER than
   flowI's 2.1 AA coverage; federal layer (VPAT, FAR 52.239-2, undue burden, PDF/UA) is
   procurement paperwork outside the design stack's mandate. Only take: 3 failure
   patterns for flowI's failure list (duplicate-ID parsing, mouse-only event handlers,
   drag-without-keyboard-alternative).

2. **baseline-ui** (ibelick) - ~70% duplicate, ~15% Tailwind/React stack-coupled, some
   rules directly conflict with deliberate choices (its letter-spacing ban vs design-laws
   tracking mandates; its no-custom-easing ban vs our named-bezier motion stance). Take:
   pause-looping-animations-off-screen validator rule, no-mixed-primitive-systems rule,
   paint-prop carve-out (background/color animation OK on small local UI), one-accent-
   color-per-view heuristic, h-dvh and no-arbitrary-z-index tightenings of existing rules.

3. **fixing-accessibility** (ibelick) - 85-90% duplicate of flowI + extended-domain-
   validator + component-implementation. Two real gaps: (a) a static REMEDIATION MODE
   (file -> line-anchored violations -> minimal targeted fix) which no existing a11y flow
   does (flowI emits testing PLANS, not static fixes); (b) "tool boundaries" discipline -
   no ARIA when native semantics suffice, minimize diff, never migrate libraries to fix
   a11y. Plus ~5 micro-rules (aria-hidden decorative icons, tabindex never >0, dialog
   focus-restore + initial focus, th table headers, keyboard equivalent for hover-only).

4. **fixing-motion-performance** (ibelick) - two-thirds duplicate. Five net-new: CSS
   Scroll/View Timelines (animation-timeline: view()/scroll()) - confirmed ZERO coverage
   in the stack, motion-reference is pure GSAP/ScrollTrigger; CSS-variable animation perf
   rules (same gotcha as the Emil borrow, still unimplemented, now double-sourced);
   pause-offscreen + rAF-needs-stop-condition; View Transitions API guidance; composite/
   paint/layout glossary as pedagogy.

5. **12-principles-of-animation** (raphaelsalaja) - mis-titled; actually a 14-rule motion
   linter (6 of 12 Disney principles have no rules). Routing correction: motion-reference
   is the WRONG home (it is implementation patterns; this is lint) - the homes are the
   sidecoach motion validator + MIFB. Take: 3 staging rules (one-focal-point,
   dim-background-on-modal, z-index hierarchy), no-linear-motion-easing (linear only for
   progress bars), context-menus-animate-exit-only, spring-for-overshoot heuristic,
   timing-consistency; MIFB gets the 300ms user-initiated ceiling + 0.95-1.05 squash/
   stretch deformation range. Reject the Web Audio decay rule (leaked from their wiki).

6. **design-lab** (0xdesign) - ~80% duplicate of things we do better (token extraction =
   sidecoach document/extract; feedback overlay = improv/justify; DESIGN_MEMORY.md =
   beats; principles dump = MIFB/motion-reference/component-gallery). ONE high-value
   net-new idea: the forced-divergence 5-axis variant taxonomy for a single target
   (A=hierarchy, B=layout model, C=density inversion, D=interaction model, E=expressive),
   shared fixtures for fair comparison. Recommended graft: a divergent-exploration phase
   in design-team that locks 5 builders to one axis each, then routes all candidates
   through the EXISTING CD-review for scoring - fixes design-lab's biggest gap (zero
   automated evaluation). Plus: Interface Robustness stress-test checklist (spam-click,
   interrupt-animation, 3G, offline, rapid-resize, max/min content) -> /sidecoach harden;
   frequency principle -> MIFB/animate.

## Cross-cutting findings

- **Double-sourced items (priority raisers):** pause-animations-off-screen (baseline-ui +
  fixing-motion-performance); CSS-var animation perf (Emil + fixing-motion-performance);
  tool-boundaries/never-migrate-libraries discipline (fixing-accessibility +
  fixing-motion-performance); frequency principle (Emil + design-lab).
- **Conflicts to reconcile before implementing:** blur thresholds (FMP <=8px animated vs
  Emil <20px vs MIFB 4px enter/exit - different axes, unify into one rule); stagger caps
  (12-principles 50ms/item would FAIL MIFB's 80ms word-stagger - scope per-item list cap
  separately from semantic-group staggers).
- **Why nothing adopted whole:** every skill is either a thinner duplicate of the
  validator/audit surface, stack-coupled (Tailwind/React/Next), or missing the evaluation
  layer our stack already provides. A parallel front door would fragment sidecoach's
  audit gate (CLAUDE.md: sidecoach is the front door for all design/QA work).

**Why this approach:** same competitive-investigation pattern as the Emil/taste-skill
beats, scaled to 6 targets via a cmux team (Agent calls require named teammates here).
**How:** one read-only general-purpose teammate per skill, each grounded with the stack
layer map + prior verdicts as calibration; synthesis by team lead.

## Files touched
- this beat + MEMORY.md index (evaluation only; no code/skill files modified)
