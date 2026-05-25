---
name: session-2026-05-24-sprint3-proper-design
description: Sprint 3 proper (Phase 4 stack-aware motion) design spec drafted via superpowers:brainstorming. Scope expanded from original 'vanilla vs React' to cover Yes&'s actual mix - Angular + WordPress + HubSpot + Drupal added. Spec at docs/superpowers/specs/.
type: project
relates_to: [session_2026-05-24_sprint3_prep_closed.md, session_2026-05-24_sprint2_closed.md]
---

Human collaborator: Jonah.

## What this session is doing

Drafted the Phase 4 design spec for Sprint 3 proper. Used the brainstorming skill to scope it.

## Scope decisions (resolved during brainstorming)

- **What flowH does differently per stack:** Emit framework-appropriate code patterns. Same animation intent, idiom-correct code.
- **Where Yes& opens Claude in CMS projects:** At the CMS root (wp-config.php / theme.json / composer.json + drupal/*). Detection sniffs top-level markers.
- **Motion library policy:** GSAP everywhere, adapt the loading + cleanup idiom per stack. One canonical toolchain across engagements.

## Scope expansion vs original plan

Original Phase 4 in `~/.claude/plans/misty-jingling-plum.md`: "stack-aware motion (flowH detects vanilla vs React and adapts, ~4 tasks)".

Jonah expanded the scope to cover real client mix: Angular + WordPress + HubSpot + Drupal added alongside the existing SPA frameworks. Final 12-value `framework` union, 9 idiom records.

## Risk flags I asked Jonah to spot-check

- HubSpot script-loader snippet (their docs are sparse on motion patterns).
- Angular `gsap.context()` integration snippet (no canonical "useGSAP for Angular" wrapper exists).

Other snippets follow well-documented standards.

## Spec location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/specs/2026-05-24-sidecoach-phase-4-stack-aware-motion-design.md`

## Tasks for implementation plan

4 tasks:
- T1: extend `TechStack.framework` union + `detectStackFromFilesystem()` + tests
- T2: build `motion-stack-idioms.ts` (9 idiom records) + tests
- T3: update `flow-handler-motion-integration.ts` to consume idioms + tests
- T4: full suite check + sprint close memory + MEMORY.md index

## Next step

Spec self-review, then ask Jonah to review the spec file, then invoke superpowers:writing-plans.

## Self-review findings

One inline fix: the "9 records" wording was ambiguous against the 12-value union. Clarified to "11 records (12-value union, with `unknown` resolving to `vanilla` via the accessor)". Some records share `exampleSnippet` text (react/next/remix all use `useGSAP`) but each framework gets its own entry so `getMotionIdiom(framework)` always returns non-null without an alias map. No other placeholders, contradictions, or ambiguity found.

About to commit the spec + ask Jonah to review.

Commit retry note: re-touched memory after rm flag-clear per Sprint 1 hook workaround.

## Plan drafted

Spec approved by Jonah. Implementation plan written to `docs/superpowers/plans/2026-05-24-sprint3-proper-phase-4-stack-aware-motion.md`. 4 tasks: T1 detection extension + filesystem helper, T2 motion-stack-idioms data module with 11 records (full GSAP snippets included in plan body, not deferred), T3 flow-handler-motion-integration consumes idioms, T4 sprint close. Plan grounds line numbers in current source (project-context.ts:178, flow-handler-motion-integration.ts:188). Each task uses the FOUR-bash-call commit pattern Sprint 1/2/3-prep established. Plan is ready to dispatch via subagent-driven-development.
