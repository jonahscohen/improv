---
name: session-2026-05-24-sprint2-t11-deferred
description: Sprint 2 Task 11 (process()-path integration test) deferred to Sprint 3. Two implementer attempts revealed real orchestrator bugs that are out of scope for Sprint 2; bypassing them defeats the test's purpose.
type: project
relates_to: [handoff_2026-05-24_sprint1_closed_sprint2_ready.md, session_2026-05-24_sprint2_plan_drafting.md, session_2026-05-23_sidecoach_intent_ambiguity.md]
---

Human collaborator: Jonah.

## What T11 was supposed to do

Add `sidecoach/src/__tests__/sprint2-process-path.test.ts` that calls `engine.process(utterance, ctx)` (the public API) and asserts a DESIGN.md citation (`Source: DESIGN.md L<n>`) appears in `result.flowResults[].guidance`. This was the "T5 gap" carryover from Sprint 1's holistic review - Sprint 1's `sprint1-integration.test.ts` exercises `(engine as any).enrichContextForHandler(...)` directly, missing a regression mode where one of three `handler.execute(...)` call sites inside `engine.process()` gets unwired.

## What two implementer attempts found

**Attempt 1 (commit aee36aa, reverted at 7da5d08):**
Implementer abandoned `engine.process()` entirely and called the handler directly via `new FlowFDesignTokensHandler().execute(...)`. That makes T11 a duplicate of Sprint 1's coverage and DEFEATS the gap-closure purpose. Reverted with side-effects also undone: deleted `sidecoach/reference/PRODUCT.md`, `sidecoach/reference/DESIGN.md` (duplicate fixtures inside sidecoach/ - the canonical ones live at the repo root `reference/`), and the orchestrator+brand-verify edits.

**Attempt 2 (uncommitted, discarded):**
Tried `'lint design.md'` as the utterance (unique to Flow F's patterns + intent markers - verified via grep against `flows.ts`). `engine.process()` still failed. The implementer discovered:
1. Orchestrator calls `handler.canExecute(rawCtx)` BEFORE `enrichContextForHandler` runs (lines ~549, ~725, ~946 in `sidecoach-orchestrator.ts`). Handlers whose `canExecute` requires fields populated by enrichment (like `projectContext.register`) get skipped.
2. The natural-language `process()` path chains prerequisite flows automatically (brand-verify before flow F). Brand-verify's handler crashes at `REGISTER_SPECIFIC_LAWS[register].description` when register is undefined - no null check.

Both findings are real orchestrator bugs. The implementer started editing the orchestrator to swap canExecute/enrich order in three places (a sensible fix) plus added debug logging, but stopped when brand-verify still crashed. They reported BLOCKED rather than further patching handlers without authorization.

## Why T11 is deferred (not "completed compromise")

The plan's verbatim test exercises `engine.process()`. Any version that doesn't is not closing T5. Two viable paths to actually shipping the test both require out-of-scope orchestrator work:

1. **Fix canExecute/enrich ordering in 3 orchestrator locations.** Sensible structural change but warrants its own task with code review (it touches the hot execution path for every flow).
2. **Fix brand-verify's REGISTER_SPECIFIC_LAWS lookup to null-check.** Plus possibly other prerequisite handlers that have the same pattern.

Both fall outside Sprint 2's scope ("composition + copywriting flows + Sprint 1 prep").

## Recommended Sprint 3 work

- Audit `canExecute` call sites in `sidecoach-orchestrator.ts` and ensure context is enriched first (or document that `canExecute` is contractually supposed to work on raw context, then fix handlers to match).
- Audit handlers that index into register-keyed records without null checks. At minimum: `flow-handler-brand-verify.ts:193`. There may be others.
- After those land, port the T11 test from the plan verbatim. The `lint design.md` utterance is the correct routing input - it's unique to Flow F.

## What landed for T11 in Sprint 2

Nothing in code. This memory file documents the deferral. The Sprint 2 sprint-close memory (T13) should call this out so the final task count is 12-of-13 shipped, 1 deferred with clear next steps.

## Files I left in their pre-T11 state

- `sidecoach/src/__tests__/sprint2-process-path.test.ts` - DELETED (was untracked).
- `sidecoach/src/sidecoach-orchestrator.ts` - checked out to HEAD (the canExecute/enrich reordering + debug logging the implementer added was reverted).

Working tree is back to the post-T10 state.
