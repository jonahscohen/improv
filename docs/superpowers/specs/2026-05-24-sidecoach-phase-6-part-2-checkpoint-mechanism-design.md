# Sidecoach Phase 6 Part 2: Checkpoint Mechanism - Design Spec

**Date:** 2026-05-24
**Author:** Jonah Cohen (collaborator)
**Phase:** 6 part 2 (composite flow checkpoint mechanism)
**Predecessor:** Sprint 5 closed Phase 6 part 1 (intent disambiguation UI)
**Roadmap:** misty-jingling-plum

## Goal

Add pause/resume capability to Sidecoach composite flows so long-running composites (e.g. `composite_craft_landing_page` with 7+ flows) can be interrupted and resumed without re-running already-completed flows.

## Why

Composite flows are sequential and can include 5-10 nested handlers. A crash, context exit, or user-driven pause mid-composite currently loses all progress. There is no resume path. For long-running composites this is a real cost: a 6-step composite that fails on step 5 currently means re-running steps 1-4 to retry step 5.

## Scope decisions resolved during brainstorming

- **Pause trigger:** auto-checkpoint between every successful step. Pause is implicit (any crash, kill, or exit leaves a usable checkpoint). No explicit pause signal needed; this maximizes reliability and minimizes new API surface.
- **Storage:** JSON files in `<projectPath>/.claude/checkpoints/`. One file per active checkpoint, named `sidecoach-<compositeId>-<isoTimestamp>.json`. Atomic write via tmp-file + rename. Inspectable, debuggable, paired with the existing `.claude/` convention.
- **Resume API:** `metadata.resumeFromCheckpoint` on `engine.process()`. Mirrors the `forceFlowId` pattern from Sprint 5. One API surface to maintain.
- **Checkpoint shape:** self-contained - compositeId + cursor + flowResults + executionContext + utterance + completedStepIds + schemaVersion + createdAt. No external lookups needed on resume.
- **Cleanup:** delete on composite completion (success or full halt). Age-based GC sweep (7 days) on first `process()` call per engine instance.
- **Implementation pattern:** separate module (`sidecoach/src/checkpoint-store.ts`). Matches the file-per-responsibility convention used by `session-memory-writer.ts`, `flow-history-store.ts`, etc.

## Architecture overview

New module `sidecoach/src/checkpoint-store.ts` owns all checkpoint persistence (write, read, delete, list, garbage-collect). The orchestrator imports it and:

1. **Constructor / lazy boot:** GC sweep deletes checkpoints older than 7 days. Runs lazily on first `process()` call since `projectPath` is not known at construction time.
2. **Resume early-branch:** at the top of `engine.process()`, if `context.metadata?.resumeFromCheckpoint` is set, the orchestrator reads the checkpoint, restores `flowResults` + `executionContext`, and resumes the composite loop at the saved cursor.
3. **Write-after-step:** inside the composite loop, after every successful step is pushed to `flowResults`, the orchestrator persists a checkpoint to disk.
4. **Cleanup at completion:** when the composite finishes (success OR halt), the most recent checkpoint for that composite is deleted.

Storage path: `<projectPath>/.claude/checkpoints/sidecoach-<compositeId>-<runStartIsoTimestamp>.json`.

**One checkpoint file per composite RUN, not per step.** The filename uses the timestamp of the run's start (not each step's time), so the same file is overwritten in place across the run's steps. This means a 10-step composite run leaves a single file on disk, updated 10 times. On completion the file is deleted; on resume the file is loaded. No accumulation, no cleanup ambiguity.

## Data shape

```typescript
interface SidecoachCheckpoint {
  schemaVersion: 1;
  checkpointId: string;             // sidecoach-<compositeId>-<isoTimestamp>
  compositeFlowId: FlowId;          // e.g. 'composite_craft_landing_page'
  createdAt: string;                // ISO 8601
  cursor: number;                   // next step index to execute (0-based)
  completedStepIds: FlowId[];       // already-run steps, for human inspection
  flowResults: FlowExecutionResult[]; // full results so far - the resume seed
  executionContext: FlowExecutionContext; // post-step state (after transformContext calls)
  utterance: string;                // original utterance, recorded for context
}

interface CheckpointSummary {
  checkpointId: string;
  compositeFlowId: FlowId;
  createdAt: string;
  cursor: number;
}
```

`completedStepIds` is redundant with `flowResults.map(r => r.flowId)` but is included for cheap human-readable inspection of the checkpoint file without parsing the full FlowExecutionResult array.

## CheckpointStore module API

```typescript
// sidecoach/src/checkpoint-store.ts
export class CheckpointStore {
  constructor(private projectPath: string) {}

  // Atomic write: tmp file in same dir + rename. Throws on I/O failure.
  // (See "Failure modes" below for how the orchestrator handles a throw.)
  writeCheckpoint(checkpoint: SidecoachCheckpoint): void;

  // Reads + JSON-parses. Throws if file missing or unparseable.
  // Validates schemaVersion === 1; throws on mismatch with actionable message.
  readCheckpoint(checkpointId: string): SidecoachCheckpoint;

  // Idempotent: missing file is not an error.
  deleteCheckpoint(checkpointId: string): void;

  // Returns CheckpointSummary objects (id, compositeId, createdAt, cursor)
  // so callers can pick by recency or composite without loading every file.
  listCheckpoints(): CheckpointSummary[];

  // Deletes checkpoints older than maxAgeDays. Returns count deleted.
  // Called lazily on first process() invocation per engine instance.
  gcOldCheckpoints(maxAgeDays: number): number;
}
```

Module is pure I/O with no orchestrator coupling. Tests drive it directly with `new CheckpointStore('/tmp/sandbox')` and verify file states without spinning up the engine.

## Orchestrator integration

Four touch points in `sidecoach/src/sidecoach-orchestrator.ts`:

### 1. Engine state - checkpoint store + boot-once flag

```typescript
private checkpointStore: CheckpointStore | null = null;
private gcRan = false;
```

### 2. Lazy GC + store init in process()

```typescript
// At the top of engine.process(), after context defaults are applied:
if (!this.checkpointStore || !this.gcRan) {
  this.checkpointStore = new CheckpointStore(context.projectPath || process.cwd());
  this.checkpointStore.gcOldCheckpoints(7);
  this.gcRan = true;
}
```

### 3. Resume early-branch (sibling to Sprint 5's forceFlowId block)

```typescript
const resumeId = context?.metadata?.resumeFromCheckpoint as string | undefined;
if (resumeId) {
  let checkpoint: SidecoachCheckpoint;
  try {
    checkpoint = this.checkpointStore!.readCheckpoint(resumeId);
  } catch (err) {
    return {
      success: false,
      message: `Cannot resume: ${(err as Error).message}`,
      detectedFlow: null,
      flowResults: [],
    };
  }
  const compositeFlow = PRESET_COMPOSITE_FLOWS.find(cf => cf.id === checkpoint.compositeFlowId);
  if (!compositeFlow) {
    return {
      success: false,
      message: `Unknown compositeFlowId in checkpoint: ${checkpoint.compositeFlowId}`,
      detectedFlow: null,
      flowResults: [],
    };
  }
  return this.runCompositeFromCheckpoint(compositeFlow, checkpoint);
}
```

### 4. Write-after-step in the composite loop

```typescript
// Inside the for-loop, after flowResults.push(result):
if (result.status === 'success' && this.checkpointStore) {
  const checkpoint: SidecoachCheckpoint = {
    schemaVersion: 1,
    checkpointId: `sidecoach-${compositeFlow.id}-${new Date().toISOString().replace(/[:.]/g,'')}`,
    compositeFlowId: compositeFlow.id,
    createdAt: new Date().toISOString(),
    cursor: stepIndex + 1,
    completedStepIds: flowResults.map(r => r.flowId as FlowId),
    flowResults,
    executionContext,
    utterance,
  };
  this.checkpointStore.writeCheckpoint(checkpoint);
  lastCheckpointId = checkpoint.checkpointId;
}
```

`stepIndex` is the current iteration index inside the `for` loop. Add `let stepIndex = 0;` before the loop and `stepIndex++` at the end of each iteration.

### 5. Cleanup at completion

```typescript
// At the end of the composite-loop body, before the final return:
if (lastCheckpointId && this.checkpointStore) {
  this.checkpointStore.deleteCheckpoint(lastCheckpointId);
}
```

### 6. New helper method - runCompositeFromCheckpoint

```typescript
private async runCompositeFromCheckpoint(
  compositeFlow: CompositeFlowDefinition,
  checkpoint: SidecoachCheckpoint,
): Promise<SidecoachResult> {
  // Same body as the existing composite-loop block but seeded with
  // checkpoint.flowResults, checkpoint.executionContext, and starting
  // the loop at checkpoint.cursor.
}
```

The duplication between the original composite loop and `runCompositeFromCheckpoint` is the main code smell. The refactor: extract the composite-loop body into a single private method `runCompositeLoop(compositeFlow, seedFlowResults, seedContext, startIndex)`. Both the new-run path and the resume path call it. This is part of the same task, not a separate pass.

## Testing strategy

Three new test files, all using the existing ts-node + console.log PASS/FAIL pattern that the rest of the sidecoach test suite uses.

### 1. sprint6-checkpoint-store-isolated.test.ts

Pure-module tests on CheckpointStore (no orchestrator dependency):
- write -> read round-trip preserves all fields
- write produces atomic result (no half-written file - tested by inspecting that tmp file is rename-renamed)
- delete is idempotent (deleteCheckpoint of a non-existent id does not throw)
- listCheckpoints returns CheckpointSummary objects sorted by createdAt desc
- gcOldCheckpoints deletes only files older than maxAgeDays (mtime-based)
- readCheckpoint with mismatched schemaVersion throws with actionable message
- readCheckpoint with missing file throws

### 2. sprint6-checkpoint-write-on-step.test.ts

Orchestrator-level (uses `engine.process()` composite path with a sandboxed projectPath):
- Run a composite with N successful steps, verify N checkpoints get written during execution
- After full success, the most recent checkpoint is deleted (cleanup fired)
- Each checkpoint's cursor matches `stepIndex + 1`
- Each checkpoint's flowResults contains exactly the results of the completed steps

### 3. sprint6-checkpoint-resume.test.ts

End-to-end two-call resume:
- Round 1: run a composite via `engine.process()`. Arrange a mid-composite halt (e.g. a step configured with `failOnFirstError: true` that intentionally fails at step 3). Assert a checkpoint exists with cursor=2 (steps 0, 1 completed; step 2 was about to run when the halt fired).
- Round 2: invoke `engine.process('any utterance', { ..., metadata: { resumeFromCheckpoint: <id> } })`. Patch the offending step's handler to succeed this time.
- Assert: composite resumed at cursor=2, flowResults contains the 2 pre-checkpoint results PLUS the post-checkpoint results, final result is success, checkpoint deleted on full completion.
- Negative case: `resumeFromCheckpoint: 'nonexistent-id'` returns `success: false` with a message containing the bad id or "missing"/"not found".
- Negative case: a checkpoint with `schemaVersion: 2` (forged) returns `success: false` with a clear "schemaVersion mismatch" message.

## Plan size

Estimated 6-7 tasks for the implementation plan:

- T1: `checkpoint-store.ts` module + types + isolated test (TDD)
- T2: Lazy GC wiring in `process()` + boot-once flag
- T3: Composite-loop body extracted into `runCompositeLoop()` helper
- T4: Write-after-step wiring in the composite loop + write-on-step test
- T5: Resume early-branch in `process()` + `runCompositeFromCheckpoint` thin wrapper
- T6: End-to-end resume test (positive + 2 negative cases)
- T7: Sprint close (full suite green, sprint memory, MEMORY.md index entry)

Comparable to Sprint 5 in scope. Sprint name: Sprint 6.

## Failure modes

- **Checkpoint write fails mid-composite (disk full, perm error, I/O glitch).** `writeCheckpoint` throws. The orchestrator wraps the call in try/catch and SOFT-FAILS: log the error to stderr, set a `checkpointDisabled = true` flag on the engine for the rest of the run, and continue executing the composite as if checkpointing was off. Rationale: a working composite should not be killed by a peripheral persistence failure. The caller loses resume capability for the rest of the run; they get a successful composite result if the rest of the steps succeed. This is the right tradeoff for an opt-in resilience feature.
- **Checkpoint write fails at the first step.** Same soft-fail. The composite runs to completion (or natural halt) without resume capability. No checkpoint file is left behind for that run.
- **Resume requested but checkpoint file missing or corrupt.** Hard fail at `engine.process()` resume early-branch. Return `success: false` with an actionable message ("Cannot resume: <reason>"). No partial work attempted - the caller chose to resume from a specific id and we cannot fabricate state.
- **Resume requested with `schemaVersion` mismatch.** Same hard fail. Message: "schemaVersion <X> not supported (this Sidecoach build supports schemaVersion 1)". No migration attempted.
- **Cleanup at completion fails.** Log to stderr, return the successful result anyway. The stale checkpoint will get cleaned up by the next 7-day GC sweep.
- **GC sweep fails to delete an individual file.** Skip that file, continue with the rest. Return the count actually deleted. No throw.

## Open questions / risk flags

- **Concurrent composites:** the current design allows multiple in-flight composites to all write checkpoints into the same dir. They use different `compositeFlowId` prefixes in filenames, so collisions are unlikely. No explicit locking. Acceptable since Sidecoach is single-process per session.
- **`projectPath` is required at process() time:** if a caller invokes process() without a projectPath, we fall back to `process.cwd()` for the checkpoint dir. This is documented but not tested for stability across the test suite.
- **Schema migrations:** schemaVersion exists for future use but no migration path is built. A checkpoint with `schemaVersion: 2` will fail to resume with an actionable error. Adding versioning logic is YAGNI for now.
- **Test interrupts:** the test suite needs a way to "interrupt" a composite mid-run. The clean approach is to inject a step that fails (and configure `failOnFirstError: true` on the composite). No process-killing or signals needed.

## Files to create / modify

**New:**
- `sidecoach/src/checkpoint-store.ts`
- `sidecoach/src/__tests__/sprint6-checkpoint-store-isolated.test.ts`
- `sidecoach/src/__tests__/sprint6-checkpoint-write-on-step.test.ts`
- `sidecoach/src/__tests__/sprint6-checkpoint-resume.test.ts`

**Modified:**
- `sidecoach/src/sidecoach-orchestrator.ts` (engine state, lazy GC, resume early-branch, write-after-step, cleanup, `runCompositeLoop` extraction, `runCompositeFromCheckpoint` thin wrapper)
- `sidecoach/src/types.ts` (add `SidecoachCheckpoint` interface if it lives there, or co-locate with CheckpointStore - decided during T1)

## Acceptance criteria

- 7+ new test cases all pass via ts-node
- Existing 32-test suite from Sprint 5 close remains green (no regressions)
- `npx tsc --noEmit` exits 0
- A failed composite leaves a checkpoint on disk
- Resume via `metadata.resumeFromCheckpoint` runs only the steps from cursor onward
- A successful composite leaves no checkpoint on disk
- Old checkpoints (>7 days) get cleaned up on engine boot
- Invalid resume id and schemaVersion mismatch return actionable errors
