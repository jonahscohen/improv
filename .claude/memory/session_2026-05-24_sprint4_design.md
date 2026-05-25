---
name: session-2026-05-24-sprint4-design
description: Sprint 4 (Phase 5 graded validation + build report) design spec drafted via superpowers:brainstorming. Both severity-verdict AND per-domain letter grades in one report. Three surfaces (composite auto + single opt-in + CLI). Central aggregator module owns the report shape. Spec at docs/superpowers/specs/.
type: project
relates_to: [session_2026-05-24_sprint3_proper_closed.md, feedback_multiple_choice_2026-05-24_double_failure.md]
---

Human collaborator: Jonah.

## What this session is doing

Drafted the Phase 5 design spec for Sprint 4. Used the brainstorming skill to scope it after a mid-session detour to harden the multiple-choice enforcement hook (which caught two failures earlier today).

## Scope decisions resolved during brainstorming

- **What "graded validation + build report" means**: Both severity-verdict (clean/warnings-only/blocked) AND per-domain letter grades (A through F based on pass-rate thresholds 90/80/70/60). Single coherent report covers shipping decisions + quality tracking.
- **When the report fires**: Three triggers - automatic on composite flow execution, opt-in for single flows via `metadata.emitBuildReport: true`, plus a standalone CLI `bin/sidecoach-build-report.js` that reads memory files for retrospective reports.
- **Aggregator architecture**: Central module `build-report-aggregator.ts` that takes either `FlowExecutionResult[]` or memory paths as input. One file owns the report shape. Validators stay unchanged.

## Plan size

8 tasks per the spec breakdown (T1-T8). Mirrors the original Phase 5 estimate of ~10 tasks but tighter because the validator layer doesn't need changes - just aggregation.

## Risk flags

- High confidence on the grading scheme, verdict logic, and markdown format (all mechanical).
- Medium confidence on memory-mode parsing in T7 - FlowMemoryEntry markdown rendering in session files may have shape drift; will lock the parse contract with fixtures.
- Lower confidence on CLI scanning heuristic (which session_*.md files are flow runs).

## Spec location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/specs/2026-05-24-sidecoach-phase-5-graded-validation-build-report-design.md`

## Tasks for implementation plan

8 tasks:
- T1: build-report-types.ts + grading helpers + unit test
- T2: build-report-aggregator.ts (FlowExecutionResult input) + unit test
- T3: markdown renderer + snapshot test
- T4: composite wiring + integration test
- T5: single-flow opt-in via metadata
- T6: CLI bin/sidecoach-build-report.js + smoke test
- T7: memory-input mode for the aggregator + test variant
- T8: sprint close (full suite + memory + index)

## Mid-session detour

Before this design, two multiple-choice rule failures triggered a hook hardening pass (commit 2b7db7f, 6 layers + 16 hook tests). That work is its own committed change; this design happens on top of it.

## Next step

Spec self-review, then ask Jonah to review the spec file, then invoke superpowers:writing-plans.

## Spec approved by Jonah

Approved. Committing the spec now, then invoking writing-plans for the implementation plan.

Commit retry note: re-touched memory after rm flag-clear per Sprint 1 hook workaround.

## Plan drafted

Implementation plan written to `docs/superpowers/plans/2026-05-24-sprint4-phase-5-graded-validation-build-report.md`. 8 tasks covering build-report-types, aggregator, markdown renderer, three orchestrator surfaces (composite auto, single opt-in, CLI), memory-input mode, and sprint close. Plan uses `spawnSync` (not `exec` with shell strings) in the CLI test to satisfy the security-reminder hook that just blocked the first draft. Self-review pass: all spec sections covered, no placeholders, type/signature names consistent. Ready to dispatch via subagent-driven-development.
