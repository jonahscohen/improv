---
name: session-2026-05-24-sprint7-design
description: Sprint 7 (carryover sweep) design spec drafted via superpowers:brainstorming. Three loose ends from Sprints 2-4 bundled - flowW/flowX intent-detector wiring, composite-parser colon/space fix, unstructured-validator output into BuildReport.
type: project
relates_to: [session_2026-05-24_sprint6_closed.md, sidecoach_followup_queue.md]
---

Human collaborator: Jonah.

## What this session is doing

Sprint 6 closed; Jonah picked the carryover sweep (item 1 of the followup queue) with explicit instruction "but please don't forget the other tasks." Items 2-4 are persisted in `sidecoach_followup_queue.md`.

The carryover sweep bundles three independent loose ends from Sprints 2-4. Each is small and well-specified; bundling into one sprint is the right scope.

## Scope decisions resolved during brainstorming

- **flowW triggers:** composition-focused keywords `['landing', 'composition', 'compose', 'sections', 'section layout', 'page sections']` + excluder `['research', 'reference', 'inspiration']` + score 0.8.
- **flowX triggers:** copy + draft focused `['copywriting', 'copy', 'draft copy', 'headline', 'hero copy', 'section copy', 'marketing copy', 'tagline']` + excluder `['code', 'function', 'component']` + score 0.85.
- **Parser fix:** accept both colon (`composite:foo`) AND space (`composite foo`) forms via expanded regex with alternation. Help text stays as colon form (canonical).
- **Validator -> BuildReport contract:** validators get static `toValidationResult()` adapters that return the existing ValidationResult shape. Orchestrator pushes converted results onto `result.validationResults` so BuildReport picks them up via existing path. Severity mapping critical->fail, warning->partial, none->pass.

## Spec location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/specs/2026-05-24-sidecoach-carryover-sweep-design.md`

## Plan size

7 tasks (Sprint 7):
- T1: flowW + flowX detectors + intent-detector test
- T2: composite-parser regex change + destructuring + parser test
- T3: ClaudemdMandate toValidationResult adapter + unit test
- T4: PolishStandard toValidationResult adapter + unit test
- T5: Taste toValidationResult adapter + runTasteValidationGate integration
- T6: Orchestrator wiring + end-to-end BuildReport test
- T7: Sprint close

Comparable to Sprint 6 (7 tasks).

## Risk flags

- High confidence on T1 (additive detectors), T2 (well-isolated regex change), T3 + T4 (pure adapter functions).
- Medium confidence on T5 - the Taste validator has a different severity vocabulary (error/warn vs critical/warning); normalization happens in the adapter.
- Medium confidence on T6 - need to wire validator pushes into BOTH the composite-loop path AND the single-flow natural-language path (Sprint 4 Surface B). Existing Sprint 4 BuildReport tests may need updates if they asserted specific shapes.

## Open questions still open

None blocking. The Taste severity normalization is documented in the spec; T5 will resolve it during implementation.

## Followups not in scope

Items 2-4 from `sidecoach_followup_queue.md`:
- Push local main to origin (after Sprint 7 closes)
- Sync repo claude/settings.json to live (own sprint)
- Tackle 16 pre-existing test failures (1-2 sprints)

## Next step

Self-review the spec, then ask Jonah to review the spec file before invoking writing-plans.

## Plan written (2026-05-24)

Jonah approved the spec ("continue") and the writing-plans skill was invoked. Plan saved to `docs/superpowers/plans/2026-05-24-sprint7-carryover-sweep.md`.

7 tasks: T1 flowW/flowX detectors (5 assertions), T2 composite-parser regex (4 assertions), T3 ClaudemdMandate adapter (7 assertions), T4 PolishStandard adapter (9 assertions), T5 Taste adapter + gate push (6 assertions), T6 orchestrator wiring + e2e test (7 assertions), T7 sprint close.

## Spec drift discovered during plan write

The spec at section 3 said the orchestrator "already runs ClaudemdMandate at ~line 558" - it was wrong. ClaudemdMandate is defined in `validateFlowExecution()` (line 555), but `validateFlowExecution` is DEAD CODE - never invoked. T6 must wire ClaudemdMandate for the FIRST time, not just push results from an existing call site.

Also discovered: PolishStandard is only called from `flow-handler-tactical-polish.ts`, not from the orchestrator. The orchestrator does not have a PolishCheckContext (it needs HTML/CSS). The plan adjusts: PolishStandard's `toValidationResult` push happens inside the flow handler, not the orchestrator.

Both adjustments are documented in the plan's "Note on spec drift discovered during planning" section at the top. No need to revise the spec; the plan is the implementation contract and these are sensible architecture realities.

## Files touched in this session

- `docs/superpowers/specs/2026-05-24-sidecoach-carryover-sweep-design.md` (new, full design spec)
- `.claude/memory/session_2026-05-24_sprint7_design.md` (this file, new)
- `.claude/memory/sidecoach_followup_queue.md` (created earlier this turn to track items 2-4)
