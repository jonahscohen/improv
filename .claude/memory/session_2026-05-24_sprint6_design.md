---
name: session-2026-05-24-sprint6-design
description: Sprint 6 (Phase 6 part 2 - composite flow checkpoint mechanism) design spec drafted via superpowers:brainstorming. Auto-checkpoint between steps, JSON files in .claude/checkpoints/, two-call resume via metadata.resumeFromCheckpoint mirroring Sprint 5 forceFlowId pattern.
type: project
relates_to: [session_2026-05-24_sprint5_closed.md, session_2026-05-24_sprint5_design.md, feedback_multiple_choice_2026-05-24_third_failure_root_cause.md]
---

Human collaborator: Jonah.

## What this session is doing

Designed Sprint 6 = Phase 6 part 2 (composite flow checkpoint mechanism). This sprint adds pause/resume to long-running composites like composite_craft_landing_page (7+ flows). A crash, kill, or mid-composite halt currently loses all progress. Resume is impossible. This sprint fixes that.

The brainstorming was PAUSED briefly when I deflected with bold-labeled approaches in prose. Jonah ordered hardening of the multiple-choice enforcement before resuming. That hardening shipped as commit 0f19225 (Stop-event detection + UserPromptSubmit injection, 24/24 tests, live round-trip verified end-to-end). After hardening shipped, Jonah authorized resuming the Sprint 6 design.

## Scope decisions resolved during brainstorming

- **Pause trigger:** auto-checkpoint between every successful step (not explicit signal, not token-budget). Pause is implicit - any crash or exit leaves a usable checkpoint.
- **Storage:** `.claude/checkpoints/sidecoach-<compositeId>-<isoTimestamp>.json` files. Atomic write via tmp + rename.
- **Resume API:** `metadata.resumeFromCheckpoint` on `engine.process()`. Mirrors Sprint 5's forceFlowId pattern.
- **Checkpoint shape:** self-contained (compositeId + cursor + full flowResults + executionContext + utterance + completedStepIds + schemaVersion). No external lookups needed on resume.
- **Cleanup:** delete on completion + age-based GC (7 days) on first process() call per engine instance.
- **Implementation:** separate CheckpointStore module. Matches file-per-responsibility convention.

## Spec location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/specs/2026-05-24-sidecoach-phase-6-part-2-checkpoint-mechanism-design.md`

## Plan size estimate

6-7 tasks (Sprint 6):
- T1: CheckpointStore module + types + isolated tests
- T2: Lazy GC wiring + boot-once flag
- T3: Composite-loop body extracted into runCompositeLoop()
- T4: Write-after-step + write-on-step test
- T5: Resume early-branch + runCompositeFromCheckpoint wrapper
- T6: End-to-end resume test (positive + 2 negative cases)
- T7: Sprint close

Comparable to Sprint 5 (6 tasks).

## Risk flags

- High confidence on CheckpointStore module (pure I/O, easy to test).
- Medium confidence on runCompositeLoop extraction - the existing composite-loop body is ~150 lines and tangled with several side-effects (recordFlowWithMemory, runTasteValidationGate, validation gates, context propagation). Extracting cleanly may surface dependencies.
- Test-interrupt mechanism is mechanical (use failOnFirstError + a step set to fail). No process signals needed.

## Open questions still open

- Concurrent composite runs: design allows multiple checkpoints in same dir; collisions unlikely since filenames include compositeId. No locking. Acceptable for single-process Sidecoach.
- projectPath fallback: if caller invokes process() without projectPath, we fall back to process.cwd(). Documented but not tested.

## Next step

Self-review the spec, then ask Jonah to review the spec file, then invoke superpowers:writing-plans.

## Self-review pass 1

Placeholder scan: PASS (no TBD/TODO/FIXME).

Ambiguity fixes:
- **Checkpoint accumulation:** original filename scheme `sidecoach-<compositeId>-<isoTimestamp>` used a fresh timestamp per step write, creating N files per composite run (only the last got cleaned up - the rest leaked until GC). Fixed: use the RUN's start timestamp so the same file is overwritten in place. One checkpoint per run, deleted on completion.
- **writeCheckpoint failure mode:** RESOLVED. Added a "Failure modes" section to the spec documenting six explicit cases - write-fail mid-composite (SOFT-fail, set checkpointDisabled=true, continue), write-fail at step 1 (same soft-fail), resume with missing/corrupt file (HARD-fail at process() with actionable message), schemaVersion mismatch (HARD-fail, no migration), cleanup-fail at completion (log + return success anyway, 7-day GC catches it), GC-fail per-file (skip + continue + return count).

Self-review pass 1 complete. Spec is at 285 lines, fully specified.

## Next: user review gate

Ask Jonah to review the spec file before invoking writing-plans.

## Plan written (2026-05-24)

Jonah approved the spec without changes ("proceed to writing the implementation plan"). Invoked superpowers:writing-plans and wrote the 7-task implementation plan to `docs/superpowers/plans/2026-05-24-sprint6-phase-6-part-2-checkpoint-mechanism.md`.

Task breakdown:
- T1: CheckpointStore module + 14 isolated assertions (write/read, atomic, idempotent delete, sorted list, mtime-based GC, schemaVersion throw, missing-file throw)
- T2: Lazy GC + checkpointStore field on engine (3 assertions: GC fires on first process, GC does not re-fire on subsequent calls, stale file removed)
- T3: Pure refactor extracting composite-loop body into runCompositeLoop helper (no new tests, only regression validation)
- T4: write-after-step + cleanup-on-completion (6 assertions: clean success leaves no file, halt leaves file with correct cursor/compositeId/flowResults/schemaVersion)
- T5: Resume early-branch + runCompositeFromCheckpoint wrapper (no new tests, T6 covers this end-to-end)
- T6: End-to-end resume test (10 assertions: round-1 halt + checkpoint, round-2 resume + success + cleanup, 2 negative cases)
- T7: Sprint close

Each task uses the four-bash-call commit pattern (rm verification flag, git add named files, git commit) to satisfy memory-nudge hooks. Each task includes a session-memory append step.

The plan is ready for subagent-driven execution.

## Self-review fixes applied (post-plan-write)

- Removed `lastCheckpointId` declaration from T3 step 1 (T3 is a pure refactor; forward-referenced locals belong in T4). T4 step 3 will declare it alongside the other new locals (`runStartIso`, `runCheckpointId`, `checkpointDisabled`).
- Added `let lastCheckpointId: string | undefined;` to T4 step 3 alongside `runStartIso`, `runCheckpointId`, `checkpointDisabled`. T4 step 4 (write block) and T4 step 5 (cleanup block) both reference it.
- Updated the explanatory note after T4 step 3 to clarify the role of each variable now that they all come from the same task instead of being split across T3 and T4.

## Files touched in this session

- `docs/superpowers/specs/2026-05-24-sidecoach-phase-6-part-2-checkpoint-mechanism-design.md` (new, full design spec)
- `.claude/memory/session_2026-05-24_sprint6_design.md` (this file, new)
