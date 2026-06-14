---
name: Lane P4a-2 validator-adaptation plan drafted
description: No-placeholder TDD plan to expand the rule registry to 30 floor rules and attach four-status checkProduct/validateProduct
type: project
relates_to: []
---

# Phase 4a-2 implementation plan (sidecoach lane work)

Collaborator: Jonah

Drafted `docs/superpowers/plans/2026-06-13-lane-p4a2-validator-adaptation.md` (1398 lines, ASCII only, 0 unicode dashes / 0 NUL / 0 emojis). Plan only - no code executed, nothing committed.

## What the plan covers
Builds on the merged P4a-1 foundation (product-rule-types, product-rule-registry 6-rule seed, flow-validation-capabilities, validator-generation, clean-evaluator). Three deliverables across 8 TDD tasks + setup:

1. EXPAND product-rule-registry from 6 to 30 canonical rules: the 22 Polish Standard rules (aliasing polish-standard:N + POLISH_0NN), split by findingClass across owners polish-standard (19) and static-a11y (3), plus theming (2 taste token rules) and anti-pattern (6 absolute-ban detectors). Complete id/severity/owner/evidence transcription table included, every id grounded in the real validator source.
2. ATTACH four-status checkProduct (pure context->verdict) to every rule + validateProduct to every registration. Absence-passes (`?? false`, `undefined !== '0px'`) and N/A-as-passed eliminated: missing/unsupported evidence -> inconclusive; thrown check caught -> inconclusive + rule_exception.
3. WIRE validateProduct via a shared makeProductValidator(id) that collects (recursive project-collector), runs owned rules, builds CoverageObservation per required rule, and CONSUMES evaluateCleanPolicy (not reimplemented). Fixtures (clean/findings/inconclusive per gating validator) created and executed by a new e2e suite - fulfilling the P4a-1 fixture deferral.

## Key architectural decisions in the plan
- checkProduct is PURE (no fs); collection + orchestration live in run-validator.ts. Avoids the validator-generation <-> flow-validation-capabilities import cycle (verified: checks slices import only check-context types; no path back).
- Per-validator cleanPolicy stays GENERATED in validators.generated.ts; runtime validators READ it (spec intent), regenerated + committed after Task 1.
- Owner split: a11y-classed polish rules (5 min-hit-area dom, 18 focus-visible css, 20 color-contrast contrast) -> static-a11y; other 19 -> polish-standard. dom/computed-style/contrast rules are owned-non-required, surface inconclusive until P4b browser collector.
- Two severity overrides only: identical-card-grids + hero-metric-template (P1 default major demoted to minor, heuristic, cite absolute-ban-detector.ts:19-21).

## Ambiguities resolved
- Linguistic/copy slice: NOT modeled as registry rules in P4a-2 (task scope is 22 polish + 3 named slices). Flow J exposing linguistic findings is a P4b collector concern. Flagged in Deferred with a 2-rule modeling suggestion if a future phase wants them.
- min-hit-area: honored the seed's dom-only non-required modeling even though polish-standard id 5 has a static fallback (spec explicitly models it dom-only).
- Run-tests baseline 20 -> 26 (6 new suites).

## Files touched
- Created: docs/superpowers/plans/2026-06-13-lane-p4a2-validator-adaptation.md
- Created: .claude/memory/session_2026-06-13_lane-p4a2-plan.md (this beat)
