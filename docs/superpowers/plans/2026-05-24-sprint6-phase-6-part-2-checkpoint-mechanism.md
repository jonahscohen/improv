# Sprint 6: Composite Flow Checkpoint Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pause/resume to Sidecoach composite flows so a long-running composite (e.g. `composite_craft_landing_page` with 7+ steps) can be interrupted at any step boundary and resumed without re-running completed steps.

**Architecture:** New `CheckpointStore` module owns JSON-file persistence in `<projectPath>/.claude/checkpoints/`. The orchestrator's composite-loop body is extracted into a private `runCompositeLoop` helper that supports a seed (so both the new-run and resume paths share the same code). Each successful step writes a checkpoint (one file per run, overwritten in place). A new `metadata.resumeFromCheckpoint` branch in `engine.process()` reads the checkpoint and continues the loop from the saved cursor. Failures soft-fail (checkpointing is opt-in resilience); resume failures hard-fail with actionable messages.

**Tech Stack:** TypeScript (CommonJS module output), ts-node for test execution, Node.js `fs` (no native deps), existing `FlowExecutionEngine` + `PRESET_COMPOSITE_FLOWS` machinery from Sprints 1-5.

---

## File Structure

**New files:**

- `sidecoach/src/checkpoint-store.ts` - pure I/O module. Exports `CheckpointStore` class + `SidecoachCheckpoint` interface + `CheckpointSummary` interface. ~150 lines.
- `sidecoach/src/__tests__/sprint6-checkpoint-store-isolated.test.ts` - 7 isolated tests on the module (no orchestrator dependency).
- `sidecoach/src/__tests__/sprint6-checkpoint-write-on-step.test.ts` - orchestrator-level. Run a composite, observe checkpoint file existence + contents across step boundaries.
- `sidecoach/src/__tests__/sprint6-checkpoint-resume.test.ts` - end-to-end two-call resume + 2 negative cases.

**Modified files:**

- `sidecoach/src/sidecoach-orchestrator.ts` - add 2 private fields (`checkpointStore`, `gcRan`), lazy-init block at top of `process()`, resume early-branch, extract composite-loop body into `runCompositeLoop(...)`, add `runCompositeFromCheckpoint(...)` thin wrapper, write-after-step block, cleanup-on-completion block.

The interfaces `SidecoachCheckpoint` + `CheckpointSummary` live in `checkpoint-store.ts` (co-located with the only consumer). The orchestrator imports them by name. This avoids polluting `types.ts` with module-internal types.

---

## Task Sequence

The tasks are ordered so each lands a self-contained green state:

- T1 builds the storage module + isolated tests (no orchestrator changes, so it can land alone).
- T2 wires the engine to OWN a `CheckpointStore` and run GC, but writes nothing yet (smallest possible orchestrator change).
- T3 extracts the composite-loop body into a helper (pure refactor, no behavior change, regression tests still green).
- T4 wires write-after-step (first real behavior change; adds a new test file).
- T5 wires the resume early-branch (uses the helper from T3).
- T6 adds end-to-end resume test (positive + 2 negatives).
- T7 closes the sprint.

---

### Task 1: CheckpointStore module + isolated tests

**Files:**
- Create: `sidecoach/src/checkpoint-store.ts`
- Create: `sidecoach/src/__tests__/sprint6-checkpoint-store-isolated.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint6-checkpoint-store-isolated.test.ts`:

```typescript
import { CheckpointStore, SidecoachCheckpoint } from '../checkpoint-store';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  const checks: Array<[string, boolean]> = [];

  // Sandbox dir
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-checkpoint-'));

  // Fixture builder
  const makeCheckpoint = (overrides: Partial<SidecoachCheckpoint> = {}): SidecoachCheckpoint => ({
    schemaVersion: 1,
    checkpointId: 'sidecoach-composite_craft_landing_page-20260524T120000000Z',
    compositeFlowId: 'composite_craft_landing_page' as any,
    createdAt: '2026-05-24T12:00:00.000Z',
    cursor: 3,
    completedStepIds: ['flowA' as any, 'flowB' as any, 'flowC' as any],
    flowResults: [
      { flowId: 'flowA' as any, flowName: 'flowA', status: 'success', message: 'ok', guidance: [], checklist: [] } as any,
    ],
    executionContext: { utterance: 'craft a landing page', projectPath: sandbox, metadata: {} } as any,
    utterance: 'craft a landing page',
    ...overrides,
  });

  const store = new CheckpointStore(sandbox);

  // T1: write -> read round-trip preserves all fields
  const cp1 = makeCheckpoint();
  store.writeCheckpoint(cp1);
  const read1 = store.readCheckpoint(cp1.checkpointId);
  checks.push(['T1: write/read round-trip preserves cursor', read1.cursor === 3]);
  checks.push(['T1: write/read round-trip preserves compositeFlowId', read1.compositeFlowId === 'composite_craft_landing_page']);
  checks.push(['T1: write/read round-trip preserves utterance', read1.utterance === 'craft a landing page']);
  checks.push(['T1: write/read round-trip preserves flowResults length', read1.flowResults.length === 1]);

  // T2: write produces atomic result (no leftover tmp file in checkpoints dir)
  const checkpointsDir = path.join(sandbox, '.claude', 'checkpoints');
  const entries = fs.readdirSync(checkpointsDir);
  const tmpFiles = entries.filter(e => e.endsWith('.tmp') || e.startsWith('.'));
  checks.push(['T2: no leftover tmp files in checkpoints dir', tmpFiles.length === 0]);
  checks.push(['T2: exactly one checkpoint file written', entries.length === 1]);

  // T3: delete is idempotent
  store.deleteCheckpoint(cp1.checkpointId);
  let secondDeleteThrew = false;
  try { store.deleteCheckpoint(cp1.checkpointId); } catch { secondDeleteThrew = true; }
  checks.push(['T3: delete of missing checkpoint does not throw', !secondDeleteThrew]);

  // T4: listCheckpoints returns CheckpointSummary objects sorted by createdAt desc
  const cpA = makeCheckpoint({ checkpointId: 'sidecoach-X-001', createdAt: '2026-05-24T10:00:00.000Z' });
  const cpB = makeCheckpoint({ checkpointId: 'sidecoach-X-002', createdAt: '2026-05-24T11:00:00.000Z' });
  const cpC = makeCheckpoint({ checkpointId: 'sidecoach-X-003', createdAt: '2026-05-24T12:00:00.000Z' });
  store.writeCheckpoint(cpA);
  store.writeCheckpoint(cpB);
  store.writeCheckpoint(cpC);
  const listed = store.listCheckpoints();
  checks.push(['T4: listCheckpoints returns 3 entries', listed.length === 3]);
  checks.push(['T4: listCheckpoints sorted by createdAt desc (newest first)', listed[0].checkpointId === 'sidecoach-X-003']);
  checks.push(['T4: listCheckpoints summary has cursor field', typeof listed[0].cursor === 'number']);
  checks.push(['T4: listCheckpoints summary excludes flowResults', !('flowResults' in listed[0])]);

  // T5: gcOldCheckpoints deletes only files older than maxAgeDays
  // Backdate cpA's file mtime to 10 days ago.
  const cpAPath = path.join(checkpointsDir, 'sidecoach-X-001.json');
  const tenDaysAgo = (Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000;
  fs.utimesSync(cpAPath, tenDaysAgo, tenDaysAgo);
  const deletedCount = store.gcOldCheckpoints(7);
  checks.push(['T5: gcOldCheckpoints removed 1 stale file', deletedCount === 1]);
  checks.push(['T5: gcOldCheckpoints kept the 2 fresh files', store.listCheckpoints().length === 2]);

  // T6: readCheckpoint with mismatched schemaVersion throws
  const cpBad = makeCheckpoint({ checkpointId: 'sidecoach-bad-v2', schemaVersion: 2 as any });
  // Write directly without using writeCheckpoint (which would validate). Hand-craft the file.
  fs.writeFileSync(path.join(checkpointsDir, 'sidecoach-bad-v2.json'), JSON.stringify(cpBad));
  let badRead: string | null = null;
  try { store.readCheckpoint('sidecoach-bad-v2'); } catch (e) { badRead = (e as Error).message; }
  checks.push(['T6: readCheckpoint(badSchemaVersion) throws', badRead !== null]);
  checks.push(['T6: error message mentions schemaVersion', !!badRead && /schemaVersion/i.test(badRead)]);

  // T7: readCheckpoint with missing file throws
  let missingRead: string | null = null;
  try { store.readCheckpoint('sidecoach-not-there'); } catch (e) { missingRead = (e as Error).message; }
  checks.push(['T7: readCheckpoint(missingFile) throws', missingRead !== null]);

  // Cleanup sandbox
  fs.rmSync(sandbox, { recursive: true, force: true });

  // Report
  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint6-checkpoint-store-isolated PASS' : 'sprint6-checkpoint-store-isolated FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-store-isolated.test.ts
```

Expected: FAIL with `Cannot find module '../checkpoint-store'`.

- [ ] **Step 3: Write the CheckpointStore module**

Create `sidecoach/src/checkpoint-store.ts`:

```typescript
// Sidecoach checkpoint persistence. One file per composite RUN under
// <projectPath>/.claude/checkpoints/. Atomic write via tmp + rename.

import * as fs from 'fs';
import * as path from 'path';
import type { FlowId, FlowExecutionContext, FlowExecutionResult } from './types';

export interface SidecoachCheckpoint {
  schemaVersion: 1;
  checkpointId: string;
  compositeFlowId: FlowId;
  createdAt: string;
  cursor: number;
  completedStepIds: FlowId[];
  flowResults: FlowExecutionResult[];
  executionContext: FlowExecutionContext;
  utterance: string;
}

export interface CheckpointSummary {
  checkpointId: string;
  compositeFlowId: FlowId;
  createdAt: string;
  cursor: number;
}

export class CheckpointStore {
  constructor(private projectPath: string) {}

  private checkpointsDir(): string {
    return path.join(this.projectPath, '.claude', 'checkpoints');
  }

  private ensureDir(): void {
    fs.mkdirSync(this.checkpointsDir(), { recursive: true });
  }

  private filePath(checkpointId: string): string {
    return path.join(this.checkpointsDir(), `${checkpointId}.json`);
  }

  writeCheckpoint(checkpoint: SidecoachCheckpoint): void {
    if (checkpoint.schemaVersion !== 1) {
      throw new Error(`writeCheckpoint: schemaVersion ${checkpoint.schemaVersion} not supported (this build writes schemaVersion 1)`);
    }
    this.ensureDir();
    const target = this.filePath(checkpoint.checkpointId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2));
    fs.renameSync(tmp, target);
  }

  readCheckpoint(checkpointId: string): SidecoachCheckpoint {
    const target = this.filePath(checkpointId);
    if (!fs.existsSync(target)) {
      throw new Error(`readCheckpoint: file not found for id "${checkpointId}"`);
    }
    const raw = fs.readFileSync(target, 'utf8');
    let parsed: SidecoachCheckpoint;
    try {
      parsed = JSON.parse(raw) as SidecoachCheckpoint;
    } catch (err) {
      throw new Error(`readCheckpoint: malformed JSON in "${checkpointId}": ${(err as Error).message}`);
    }
    if (parsed.schemaVersion !== 1) {
      throw new Error(`readCheckpoint: schemaVersion ${parsed.schemaVersion} not supported (this Sidecoach build supports schemaVersion 1)`);
    }
    return parsed;
  }

  deleteCheckpoint(checkpointId: string): void {
    const target = this.filePath(checkpointId);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }

  listCheckpoints(): CheckpointSummary[] {
    const dir = this.checkpointsDir();
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const summaries: CheckpointSummary[] = [];
    for (const f of entries) {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const parsed = JSON.parse(raw) as SidecoachCheckpoint;
        summaries.push({
          checkpointId: parsed.checkpointId,
          compositeFlowId: parsed.compositeFlowId,
          createdAt: parsed.createdAt,
          cursor: parsed.cursor,
        });
      } catch {
        // skip unparseable files
      }
    }
    summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return summaries;
  }

  gcOldCheckpoints(maxAgeDays: number): number {
    const dir = this.checkpointsDir();
    if (!fs.existsSync(dir)) return 0;
    const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const full = path.join(dir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoffMs) {
          fs.unlinkSync(full);
          deleted++;
        }
      } catch {
        // skip files we can't stat or delete
      }
    }
    return deleted;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-store-isolated.test.ts
```

Expected: all 14 assertions PASS, final line `sprint6-checkpoint-store-isolated PASS`.

- [ ] **Step 5: Confirm tsc is clean**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: exit code 0, no output.

- [ ] **Step 6: Update session memory**

Append to `.claude/memory/session_2026-05-24_sprint6_execution.md` (create if missing) with a `## T1: CheckpointStore module` section listing the file paths and the 14 assertions passing.

- [ ] **Step 7: Commit**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/checkpoint-store.ts sidecoach/src/__tests__/sprint6-checkpoint-store-isolated.test.ts .claude/memory/session_2026-05-24_sprint6_execution.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "feat(sidecoach): add CheckpointStore module for composite flow persistence (Phase 6 part 2 T1)"
```

---

### Task 2: Lazy GC + checkpointStore field on the engine

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (engine fields + lazy-init block at the top of `process()`)

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint6-checkpoint-engine-gc.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  const checks: Array<[string, boolean]> = [];

  // Sandbox a projectPath with an OLD checkpoint file already on disk.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-engine-gc-'));
  const checkpointsDir = path.join(sandbox, '.claude', 'checkpoints');
  fs.mkdirSync(checkpointsDir, { recursive: true });

  const oldFile = path.join(checkpointsDir, 'sidecoach-stale-001.json');
  const oldCheckpoint = {
    schemaVersion: 1,
    checkpointId: 'sidecoach-stale-001',
    compositeFlowId: 'composite_qa_workflow',
    createdAt: '2026-05-14T00:00:00.000Z',
    cursor: 0,
    completedStepIds: [],
    flowResults: [],
    executionContext: { utterance: '', projectPath: sandbox, metadata: {} },
    utterance: '',
  };
  fs.writeFileSync(oldFile, JSON.stringify(oldCheckpoint));
  // Backdate mtime to 10 days ago (older than the 7-day GC threshold).
  const tenDaysAgo = (Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000;
  fs.utimesSync(oldFile, tenDaysAgo, tenDaysAgo);

  // Sanity: file exists before engine boot.
  checks.push(['pre: stale checkpoint file exists', fs.existsSync(oldFile)]);

  // Boot the engine and invoke process() with the sandbox projectPath.
  // We pass a harmless utterance that will go through normal intent detection.
  // GC should fire as part of the lazy-init block before any flow runs.
  const engine = new FlowExecutionEngine();
  await engine.process('hello sidecoach', { projectPath: sandbox, projectContext: { register: 'brand' } } as any);

  // After the first process() call, the stale file should be deleted.
  checks.push(['post: stale checkpoint file removed by GC', !fs.existsSync(oldFile)]);

  // Second process() call should NOT re-run GC (boot-once flag).
  // Plant another stale file and verify it survives the second call.
  const secondStale = path.join(checkpointsDir, 'sidecoach-stale-002.json');
  fs.writeFileSync(secondStale, JSON.stringify({ ...oldCheckpoint, checkpointId: 'sidecoach-stale-002' }));
  fs.utimesSync(secondStale, tenDaysAgo, tenDaysAgo);
  await engine.process('hello again', { projectPath: sandbox, projectContext: { register: 'brand' } } as any);
  checks.push(['second-call: GC does NOT re-fire (file still present)', fs.existsSync(secondStale)]);

  fs.rmSync(sandbox, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint6-checkpoint-engine-gc PASS' : 'sprint6-checkpoint-engine-gc FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-engine-gc.test.ts
```

Expected: FAIL on `post: stale checkpoint file removed by GC` because the engine does not yet wire CheckpointStore or call gcOldCheckpoints.

- [ ] **Step 3: Add the import and engine fields**

In `sidecoach/src/sidecoach-orchestrator.ts`, find the existing import block at the top of the file and add:

```typescript
import { CheckpointStore, SidecoachCheckpoint } from './checkpoint-store';
```

Inside the `FlowExecutionEngine` class declaration (near the other `private` fields around line 95), add two new private fields:

```typescript
private checkpointStore: CheckpointStore | null = null;
private gcRan = false;
```

- [ ] **Step 4: Add the lazy-init block at the top of process()**

Find `async process(` in `sidecoach-orchestrator.ts` (the single public entry method). At the very top of the method body, AFTER context defaults are applied but BEFORE the `metadata.forceFlowId` block from Sprint 5, insert:

```typescript
// Phase 6 part 2: lazy CheckpointStore boot + 7-day GC sweep (runs once per engine instance).
if (!this.checkpointStore || !this.gcRan) {
  this.checkpointStore = new CheckpointStore(context.projectPath || process.cwd());
  try {
    this.checkpointStore.gcOldCheckpoints(7);
  } catch (err) {
    process.stderr.write(`[sidecoach] checkpoint GC failed (continuing): ${(err as Error).message}\n`);
  }
  this.gcRan = true;
}
```

The `try/catch` here is the GC-failure soft-fail behavior from the spec's Failure modes section.

- [ ] **Step 5: Run the failing test - now expected to pass**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-engine-gc.test.ts
```

Expected: all 3 assertions PASS, final line `sprint6-checkpoint-engine-gc PASS`.

- [ ] **Step 6: Run regression - the sprint6 isolated test must still pass**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-store-isolated.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: both succeed.

- [ ] **Step 7: Update session memory**

Append to `.claude/memory/session_2026-05-24_sprint6_execution.md` a `## T2: Lazy GC + checkpointStore field` section.

- [ ] **Step 8: Commit**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/sprint6-checkpoint-engine-gc.test.ts .claude/memory/session_2026-05-24_sprint6_execution.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "feat(sidecoach): lazy CheckpointStore boot + 7-day GC sweep on first process() (Phase 6 part 2 T2)"
```

---

### Task 3: Extract composite-loop body into runCompositeLoop helper

This is a **pure refactor** with no behavior change. The existing composite loop (lines ~513-652 in `sidecoach-orchestrator.ts`) is moved into a private method that accepts seed parameters. The original call site invokes it with empty seeds. The resume path (T5) will invoke it with checkpoint seeds.

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts`

- [ ] **Step 1: Define the helper signature**

Inside the `FlowExecutionEngine` class (place it near the other private methods, e.g. after `recordFlowWithMemory`), add the new method skeleton. We will fill it in by moving code:

```typescript
private async runCompositeLoop(
  compositeFlow: CompositeFlowDefinition,
  executionContext: FlowExecutionContext,
  flowResults: FlowExecutionResult[],
  startIndex: number,
  utterance: string,
): Promise<SidecoachResult> {
  const flowHistory = getFlowHistory();
  const historyEntries = flowHistory.getFlowSequence();
  const startTime = Date.now();

  for (let stepIndex = startIndex; stepIndex < compositeFlow.steps.length; stepIndex++) {
    const step = compositeFlow.steps[stepIndex];

    // BODY MOVED FROM THE ORIGINAL COMPOSITE LOOP (see Step 2 below)
  }

  const totalTime = Date.now() - startTime;

  // AGGREGATION + BUILD-REPORT + RETURN (also moved - see Step 2)
}
```

- [ ] **Step 2: Move the existing loop body into the helper**

Open `sidecoach-orchestrator.ts`. Find the existing composite-execution block. It currently looks like:

```typescript
// Find the composite flow definition
const compositeFlow = PRESET_COMPOSITE_FLOWS.find(cf => cf.id === compositeFlowId);
if (!compositeFlow) {
  return { success: false, message: `Composite flow not found: ${compositeFlowId}`, detectedFlow: null, flowResults: [] };
}

// Execute composite flow steps
const executionContext: FlowExecutionContext = {
  utterance,
  userId: context.userId,
  projectPath: context.projectPath || process.cwd(),
  currentFile: context.currentFile,
  selectedText: context.selectedText,
  metadata: { ...context.metadata, compositeFlowId },
};

const flowResults: FlowExecutionResult[] = [];
const flowHistory = getFlowHistory();
// ... and so on through the for loop and final return block ...
```

Replace the section from `const flowHistory = getFlowHistory();` through the `return { success: ..., buildReport };` block at the end of the composite path (currently lines ~509-692) with a single call:

```typescript
return this.runCompositeLoop(compositeFlow, executionContext, [], 0, utterance);
```

Then paste the removed code INTO the `runCompositeLoop` method body you created in Step 1. Replace `for (const step of compositeFlow.steps)` with the indexed `for (let stepIndex = startIndex; ...)` form. Remove the local re-declaration of `flowResults`, `flowHistory`, `historyEntries`, `startTime` from the original site since they are now parameters or already declared in the helper. Keep ALL other behavior identical (prerequisite checks, taste-validation gates, validator application, transformContext, catch-block, aggregation, build-report generation, return shape).

Two `return { success: false, ... }` halt paths inside the original loop (the prerequisite-halt and the domain-validation-halt) should also `return` from `runCompositeLoop` directly (their shape does not change).

The Build Report generation block stays at the bottom of `runCompositeLoop` exactly as before, since `flowResults` is still in scope.

- [ ] **Step 3: Run a full regression - composite-path tests should still pass**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-integration.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-engine-gc.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: every test passes. This is a refactor; no behavior should change.

- [ ] **Step 4: Update session memory**

Append `## T3: composite-loop extracted into runCompositeLoop` section listing the moved code and the regression tests that confirm the refactor.

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts .claude/memory/session_2026-05-24_sprint6_execution.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "refactor(sidecoach): extract composite-loop body into runCompositeLoop helper (Phase 6 part 2 T3)"
```

---

### Task 4: Write-after-step + cleanup-on-completion

This task wires checkpoint writes inside `runCompositeLoop` after each successful step, and deletes the checkpoint at the end. The orchestrator's checkpointing soft-fails per the spec's Failure modes section.

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (inside the `runCompositeLoop` helper from T3)
- Create: `sidecoach/src/__tests__/sprint6-checkpoint-write-on-step.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint6-checkpoint-write-on-step.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  const checks: Array<[string, boolean]> = [];

  // Sandbox projectPath.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-write-step-'));
  const checkpointsDir = path.join(sandbox, '.claude', 'checkpoints');

  // Run a composite. Use a real preset that the engine knows about.
  // composite_qa_workflow is short (4 flows) per flow-composition.ts.
  const engine = new FlowExecutionEngine();
  const result = await engine.process('/sidecoach composite composite_qa_workflow', {
    projectPath: sandbox,
    projectContext: { register: 'brand' },
  } as any);

  // After a fully successful composite, the checkpoint file should be DELETED (cleanup at completion).
  let checkpointFilesAfter: string[] = [];
  if (fs.existsSync(checkpointsDir)) {
    checkpointFilesAfter = fs.readdirSync(checkpointsDir).filter(f => f.endsWith('.json'));
  }
  checks.push(['T1: after full composite success, no checkpoint file remains', checkpointFilesAfter.length === 0]);

  // Run a HALTING composite. We force a halt by passing a composite that does not exist
  // (engine returns an error before the loop) - that path does not touch checkpoints,
  // so for halting we need a different approach: re-run a composite but intercept
  // the LOOP MID-WAY using a process.kill-style abort? That is too invasive.
  //
  // Cleaner: monkey-patch one handler to throw, with composite_qa_workflow's
  // failOnFirstError set (composite_qa_workflow has failOnFirstError: true).
  // After the halt, the checkpoint file from the LAST successful step should still
  // exist (cleanup only fires on natural loop exit, not on mid-loop early return).

  const sandbox2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-write-step-halt-'));
  const checkpointsDir2 = path.join(sandbox2, '.claude', 'checkpoints');
  const engine2 = new FlowExecutionEngine();

  // Grab one of the steps and replace its handler with a throwing stub.
  // composite_qa_workflow's first step is typically a curate/research flow.
  // We use the public handlers map via getHandlers() (exposed in Sprint 1).
  const handlers = (engine2 as any).handlers as Map<string, any>;
  // Find a flowId that is in composite_qa_workflow's step list.
  const { PRESET_COMPOSITE_FLOWS } = require('../flow-composition');
  const qaWorkflow = PRESET_COMPOSITE_FLOWS.find((cf: any) => cf.id === 'composite_qa_workflow');
  const stepToBreak = qaWorkflow.steps[1].flowId; // Break the SECOND step so step 1 writes a checkpoint first.
  const originalHandler = handlers.get(stepToBreak);
  handlers.set(stepToBreak, {
    canExecute: () => true,
    execute: async () => { throw new Error('intentional halt for checkpoint test'); },
  });

  await engine2.process('/sidecoach composite composite_qa_workflow', {
    projectPath: sandbox2,
    projectContext: { register: 'brand' },
  } as any);

  // Restore handler.
  if (originalHandler) handlers.set(stepToBreak, originalHandler);

  // After the halt, a checkpoint from step 0 SHOULD still be on disk because the loop
  // returned early on the failure (cleanup at the bottom of runCompositeLoop did not execute).
  let checkpointFilesAfterHalt: string[] = [];
  if (fs.existsSync(checkpointsDir2)) {
    checkpointFilesAfterHalt = fs.readdirSync(checkpointsDir2).filter(f => f.endsWith('.json'));
  }
  checks.push(['T2: halted composite leaves a checkpoint on disk', checkpointFilesAfterHalt.length === 1]);

  if (checkpointFilesAfterHalt.length === 1) {
    const cp = JSON.parse(fs.readFileSync(path.join(checkpointsDir2, checkpointFilesAfterHalt[0]), 'utf8'));
    checks.push(['T2: checkpoint cursor reflects steps completed', cp.cursor === 1]);
    checks.push(['T2: checkpoint compositeFlowId matches', cp.compositeFlowId === 'composite_qa_workflow']);
    checks.push(['T2: checkpoint flowResults has exactly 1 result', cp.flowResults.length === 1]);
    checks.push(['T2: checkpoint schemaVersion is 1', cp.schemaVersion === 1]);
  } else {
    // Push placeholder failures so the test reports clearly.
    checks.push(['T2: checkpoint cursor reflects steps completed', false]);
    checks.push(['T2: checkpoint compositeFlowId matches', false]);
    checks.push(['T2: checkpoint flowResults has exactly 1 result', false]);
    checks.push(['T2: checkpoint schemaVersion is 1', false]);
  }

  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.rmSync(sandbox2, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint6-checkpoint-write-on-step PASS' : 'sprint6-checkpoint-write-on-step FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-write-on-step.test.ts
```

Expected: FAIL because no checkpoint write is wired yet.

- [ ] **Step 3: Add the run-start timestamp + checkpointId in runCompositeLoop**

In `sidecoach-orchestrator.ts`, inside `runCompositeLoop`, BEFORE the `for` loop, add:

```typescript
// Phase 6 part 2: stable run-start timestamp so the same file is overwritten in place across steps.
const runStartIso = new Date().toISOString().replace(/[:.]/g, '');
const runCheckpointId = `sidecoach-${compositeFlow.id}-${runStartIso}`;
let lastCheckpointId: string | undefined;
let checkpointDisabled = false;
```

Two names with different roles: `runCheckpointId` is the deterministic per-run id (used for write + cleanup), `lastCheckpointId` tracks whether a write succeeded at least once (used to decide whether cleanup should run). Both serve the same id when writing succeeds; `lastCheckpointId` stays `undefined` if all writes fail and lets the cleanup block skip.

- [ ] **Step 4: Insert the write-after-step block**

In `runCompositeLoop`, find `flowResults.push(result);` (the successful-step push inside the try block). Immediately AFTER that line, insert:

```typescript
// Phase 6 part 2: persist a checkpoint after each successful step.
if (result.status === 'success' && this.checkpointStore && !checkpointDisabled) {
  const checkpoint: SidecoachCheckpoint = {
    schemaVersion: 1,
    checkpointId: runCheckpointId,
    compositeFlowId: compositeFlow.id as any,
    createdAt: new Date().toISOString(),
    cursor: stepIndex + 1,
    completedStepIds: flowResults.map((r) => r.flowId as any),
    flowResults,
    executionContext,
    utterance,
  };
  try {
    this.checkpointStore.writeCheckpoint(checkpoint);
    lastCheckpointId = runCheckpointId;
  } catch (err) {
    process.stderr.write(`[sidecoach] checkpoint write failed at step ${stepIndex} (continuing without resume capability): ${(err as Error).message}\n`);
    checkpointDisabled = true;
  }
}
```

- [ ] **Step 5: Insert the cleanup-on-completion block**

In `runCompositeLoop`, immediately BEFORE the final `return { success: ..., buildReport };` (the natural loop-exit return), insert:

```typescript
// Phase 6 part 2: composite finished naturally - delete the checkpoint.
if (lastCheckpointId && this.checkpointStore) {
  try {
    this.checkpointStore.deleteCheckpoint(lastCheckpointId);
  } catch (err) {
    process.stderr.write(`[sidecoach] checkpoint cleanup failed (will be GC'd later): ${(err as Error).message}\n`);
  }
}
```

NOTE: The mid-loop early-return paths (prerequisite halt + domain-validation halt + try/catch failOnFirstError halt) deliberately do NOT call the cleanup. The leftover checkpoint is the resume seed.

- [ ] **Step 6: Run the write-on-step test - now expected to pass**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-write-on-step.test.ts
```

Expected: all 6 assertions PASS, final line `sprint6-checkpoint-write-on-step PASS`.

- [ ] **Step 7: Run full regression**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-store-isolated.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-engine-gc.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-force-flowid-bypass.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: every test passes.

- [ ] **Step 8: Update session memory**

Append `## T4: write-after-step + cleanup` section.

- [ ] **Step 9: Commit**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/sprint6-checkpoint-write-on-step.test.ts .claude/memory/session_2026-05-24_sprint6_execution.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "feat(sidecoach): checkpoint write after each successful step + cleanup on completion (Phase 6 part 2 T4)"
```

---

### Task 5: Resume early-branch + runCompositeFromCheckpoint wrapper

This task adds the `metadata.resumeFromCheckpoint` branch to `engine.process()` and a thin wrapper that reconstructs state from the checkpoint and calls `runCompositeLoop` with the seeds.

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts`

- [ ] **Step 1: Add the wrapper method**

Inside the `FlowExecutionEngine` class (near `runCompositeLoop`), add:

```typescript
private async runCompositeFromCheckpoint(
  compositeFlow: CompositeFlowDefinition,
  checkpoint: SidecoachCheckpoint,
): Promise<SidecoachResult> {
  // Seed flowResults + executionContext from the checkpoint, then continue the loop.
  // Note: the runCompositeLoop helper mints a fresh runStartIso for the resumed run,
  // so the resumed run writes to a NEW checkpoint file. The old (pre-resume) checkpoint
  // is deleted by the caller via deleteCheckpoint before this method returns.
  return this.runCompositeLoop(
    compositeFlow,
    checkpoint.executionContext,
    [...checkpoint.flowResults],
    checkpoint.cursor,
    checkpoint.utterance,
  );
}
```

- [ ] **Step 2: Add the resume early-branch in process()**

In `engine.process()`, immediately AFTER the Sprint 5 `metadata.forceFlowId` block, insert:

```typescript
// Phase 6 part 2: metadata.resumeFromCheckpoint bypass.
// Routes process() directly to the saved composite from the checkpoint's cursor,
// skipping intent detection and the normal composite-routing logic.
const resumeId = (context as any)?.metadata?.resumeFromCheckpoint as string | undefined;
if (resumeId) {
  if (!this.checkpointStore) {
    return {
      success: false,
      message: 'Cannot resume: checkpoint store not initialized',
      detectedFlow: null,
      flowResults: [],
    };
  }
  let checkpoint: SidecoachCheckpoint;
  try {
    checkpoint = this.checkpointStore.readCheckpoint(resumeId);
  } catch (err) {
    return {
      success: false,
      message: `Cannot resume: ${(err as Error).message}`,
      detectedFlow: null,
      flowResults: [],
    };
  }
  const compositeFlow = PRESET_COMPOSITE_FLOWS.find((cf) => cf.id === checkpoint.compositeFlowId);
  if (!compositeFlow) {
    return {
      success: false,
      message: `Cannot resume: unknown compositeFlowId in checkpoint: ${checkpoint.compositeFlowId}`,
      detectedFlow: null,
      flowResults: [],
    };
  }
  const result = await this.runCompositeFromCheckpoint(compositeFlow, checkpoint);
  // After a successful resumed run completes, delete the original pre-resume checkpoint.
  try {
    this.checkpointStore.deleteCheckpoint(resumeId);
  } catch (err) {
    process.stderr.write(`[sidecoach] resume cleanup of original checkpoint failed (will be GC'd later): ${(err as Error).message}\n`);
  }
  return result;
}
```

NOTE: The lazy-init block from T2 runs BEFORE this early-branch, so `this.checkpointStore` is non-null by the time we get here (the explicit null guard is defensive).

- [ ] **Step 3: Run regressions - existing tests must still pass**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-store-isolated.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-engine-gc.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-write-on-step.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-force-flowid-bypass.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: every test passes.

- [ ] **Step 4: Update session memory**

Append `## T5: resume early-branch + runCompositeFromCheckpoint` section.

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts .claude/memory/session_2026-05-24_sprint6_execution.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "feat(sidecoach): metadata.resumeFromCheckpoint branch routes to runCompositeFromCheckpoint (Phase 6 part 2 T5)"
```

---

### Task 6: End-to-end resume test (positive + 2 negative cases)

**Files:**
- Create: `sidecoach/src/__tests__/sprint6-checkpoint-resume.test.ts`

- [ ] **Step 1: Write the end-to-end test**

Create `sidecoach/src/__tests__/sprint6-checkpoint-resume.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  const checks: Array<[string, boolean]> = [];
  const { PRESET_COMPOSITE_FLOWS } = require('../flow-composition');

  // ============================================================
  // POSITIVE CASE: round 1 halts, round 2 resumes and completes.
  // ============================================================
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-resume-'));
  const checkpointsDir = path.join(sandbox, '.claude', 'checkpoints');
  const engine = new FlowExecutionEngine();

  const qa = PRESET_COMPOSITE_FLOWS.find((cf: any) => cf.id === 'composite_qa_workflow');
  const stepToBreak = qa.steps[1].flowId;
  const handlers = (engine as any).handlers as Map<string, any>;
  const originalHandler = handlers.get(stepToBreak);

  // ROUND 1: break step 1 so the composite halts after step 0 writes a checkpoint.
  handlers.set(stepToBreak, {
    canExecute: () => true,
    execute: async () => { throw new Error('intentional halt for resume test'); },
  });
  const round1 = await engine.process('/sidecoach composite composite_qa_workflow', {
    projectPath: sandbox,
    projectContext: { register: 'brand' },
  } as any);

  checks.push(['round1: success is false (halted)', round1.success === false]);
  const files1 = fs.readdirSync(checkpointsDir).filter(f => f.endsWith('.json'));
  checks.push(['round1: exactly one checkpoint file on disk', files1.length === 1]);
  const checkpointId = files1[0].replace(/\.json$/, '');
  const cpData = JSON.parse(fs.readFileSync(path.join(checkpointsDir, files1[0]), 'utf8'));
  checks.push(['round1: checkpoint cursor === 1', cpData.cursor === 1]);

  // RESTORE the broken handler so round 2 can run cleanly.
  if (originalHandler) handlers.set(stepToBreak, originalHandler);

  // ROUND 2: resume with metadata.resumeFromCheckpoint.
  const round2 = await engine.process('any utterance, ignored', {
    projectPath: sandbox,
    projectContext: { register: 'brand' },
    metadata: { resumeFromCheckpoint: checkpointId },
  } as any);

  checks.push(['round2: success is true', round2.success === true]);
  checks.push(['round2: flowResults includes the step-0 result from the checkpoint', Array.isArray(round2.flowResults) && round2.flowResults.length >= qa.steps.length]);
  // After full success, the original checkpoint plus any newly-written checkpoint should both be cleaned up.
  const files2 = fs.existsSync(checkpointsDir) ? fs.readdirSync(checkpointsDir).filter(f => f.endsWith('.json')) : [];
  checks.push(['round2: no checkpoint files remain after full success', files2.length === 0]);

  fs.rmSync(sandbox, { recursive: true, force: true });

  // ============================================================
  // NEGATIVE CASE 1: nonexistent resume id.
  // ============================================================
  const sandbox2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-resume-neg-'));
  const engine2 = new FlowExecutionEngine();
  const negResult = await engine2.process('whatever', {
    projectPath: sandbox2,
    projectContext: { register: 'brand' },
    metadata: { resumeFromCheckpoint: 'sidecoach-does-not-exist-xyz' },
  } as any);

  checks.push(['neg1: success is false for missing checkpoint id', negResult.success === false]);
  checks.push(['neg1: message identifies the failure', typeof negResult.message === 'string' && /(cannot resume|not found|missing)/i.test(negResult.message)]);
  fs.rmSync(sandbox2, { recursive: true, force: true });

  // ============================================================
  // NEGATIVE CASE 2: forged schemaVersion=2 checkpoint.
  // ============================================================
  const sandbox3 = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-resume-v2-'));
  const checkpointsDir3 = path.join(sandbox3, '.claude', 'checkpoints');
  fs.mkdirSync(checkpointsDir3, { recursive: true });
  const forgedId = 'sidecoach-forged-v2';
  const forged = {
    schemaVersion: 2,
    checkpointId: forgedId,
    compositeFlowId: 'composite_qa_workflow',
    createdAt: new Date().toISOString(),
    cursor: 0,
    completedStepIds: [],
    flowResults: [],
    executionContext: { utterance: '', projectPath: sandbox3, metadata: {} },
    utterance: '',
  };
  fs.writeFileSync(path.join(checkpointsDir3, `${forgedId}.json`), JSON.stringify(forged));

  const engine3 = new FlowExecutionEngine();
  const v2Result = await engine3.process('whatever', {
    projectPath: sandbox3,
    projectContext: { register: 'brand' },
    metadata: { resumeFromCheckpoint: forgedId },
  } as any);

  checks.push(['neg2: success is false for schemaVersion mismatch', v2Result.success === false]);
  checks.push(['neg2: message mentions schemaVersion', typeof v2Result.message === 'string' && /schemaversion/i.test(v2Result.message)]);
  fs.rmSync(sandbox3, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint6-checkpoint-resume PASS' : 'sprint6-checkpoint-resume FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-resume.test.ts
```

Expected: all 10 assertions PASS, final line `sprint6-checkpoint-resume PASS`.

If a step in `composite_qa_workflow` has a prerequisite that prevents resume execution, the test will surface that. If that happens, see the troubleshooting note below the commit step.

- [ ] **Step 3: Run full regression**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-store-isolated.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-engine-gc.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint6-checkpoint-write-on-step.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: every test passes.

- [ ] **Step 4: Update session memory**

Append `## T6: end-to-end resume test` section listing the positive + 2 negative cases.

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/__tests__/sprint6-checkpoint-resume.test.ts .claude/memory/session_2026-05-24_sprint6_execution.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "test(sidecoach): end-to-end resume + 2 negative cases (Phase 6 part 2 T6)"
```

**Troubleshooting note:** if the positive case fails because `composite_qa_workflow`'s steps have prerequisites that the test sandbox cannot satisfy (e.g. they depend on a real DESIGN.md file), substitute a different composite that runs cleanly in a sandboxed projectPath. Inspect `PRESET_COMPOSITE_FLOWS` in `sidecoach/src/flow-composition.ts` and pick the shortest composite whose handlers all return `success` for an empty projectPath. Update the test's `composite_qa_workflow` references accordingly. Document the substitution in the session memory.

---

### Task 7: Sprint close

**Files:**
- Create: `.claude/memory/session_2026-05-24_sprint6_closed.md`
- Modify: `.claude/memory/MEMORY.md` (one new index line)

- [ ] **Step 1: Run the full sidecoach test suite**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && for t in src/__tests__/*.test.ts; do
  echo "=== $t ==="
  npx ts-node "$t" || echo "FAILED: $t"
done
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && echo "tsc clean"
```

Expected: every test exits 0; tsc reports "tsc clean".

- [ ] **Step 2: Write the sprint close memory**

Create `.claude/memory/session_2026-05-24_sprint6_closed.md`:

```markdown
---
name: session-2026-05-24-sprint6-closed
description: Sprint 6 (Phase 6 part 2 - composite flow checkpoint mechanism) closed. CheckpointStore module + lazy GC + write-after-step + resume early-branch + runCompositeLoop refactor. <N>/<N> tests green.
type: project
relates_to: [session_2026-05-24_sprint6_design.md, session_2026-05-24_sprint5_closed.md]
---

Human collaborator: Jonah.

## What this sprint landed

7 commits on `main` (since Sprint 5 closed):

- T1 `<sha>` - CheckpointStore module + 14 isolated assertions (write/read round-trip, atomic write, idempotent delete, listCheckpoints sort, gcOldCheckpoints mtime-based, schemaVersion mismatch throw, missing-file throw).
- T2 `<sha>` - lazy CheckpointStore boot + 7-day GC sweep on first process() call. Boot-once flag prevents re-sweep on subsequent calls.
- T3 `<sha>` - refactor: extracted composite-loop body into runCompositeLoop helper. Pure refactor, no behavior change, all prior tests remain green.
- T4 `<sha>` - write-after-step inside runCompositeLoop. One checkpoint file per RUN (overwritten in place via stable runCheckpointId). Soft-fail on write error: log to stderr, set checkpointDisabled=true, continue. Cleanup-on-completion deletes the file before the natural-loop-exit return; mid-loop early-return paths intentionally leave the file as a resume seed.
- T5 `<sha>` - resume early-branch in engine.process() routes metadata.resumeFromCheckpoint to runCompositeFromCheckpoint thin wrapper. Hard-fails with actionable message on missing file, schemaVersion mismatch, or unknown compositeFlowId.
- T6 `<sha>` - end-to-end test: round-1 halt -> checkpoint persisted with cursor=1 -> round-2 resume -> full success -> all checkpoints cleaned up. Plus 2 negative cases (missing id, forged schemaVersion=2).

## Test count

Sprint 1 + 2 + 3 prep + 3 proper + 4 + 5 + 6 = <N> distinct test files, all green. Zero TypeScript errors.

(Fill in the actual test list from the Step 1 output.)

## Behavior contract

- **Auto-checkpoint between steps:** after each successful step in a composite, a checkpoint is persisted at `<projectPath>/.claude/checkpoints/sidecoach-<compositeId>-<runStartIso>.json`. The filename is stable across the run, so a 10-step composite leaves a single file updated 10 times.
- **Resume via metadata.resumeFromCheckpoint:** caller invokes `engine.process(<any utterance>, { ..., metadata: { resumeFromCheckpoint: '<id>' } })`. The orchestrator reads the checkpoint, restores flowResults + executionContext, and continues the loop from cursor.
- **Cleanup on success:** when a composite finishes naturally (loop exits), the checkpoint file is deleted. When a composite halts mid-loop, the file is left in place as a resume seed.
- **Failure modes:** write failures soft-fail (composite continues without resume capability). Resume failures hard-fail with actionable messages. GC failures skip-and-continue.

## Known scope notes

- Concurrent composites: the design allows multiple in-flight composites to all write into the same dir; filenames are disambiguated by compositeId. No locking.
- projectPath fallback: callers without projectPath get `process.cwd()`. Documented but not exhaustively tested.
- Schema migrations: schemaVersion field exists but no migration logic. A v2 checkpoint hard-fails with an actionable message.

## Out of scope (future sprints)

- Token-budget-driven pause (the original Sprint 6 brainstorm option that was deferred).
- Explicit pause signal (also deferred).
- Cross-process checkpoint sharing or locking.
- A `listCheckpoints` CLI surface (the API exists but is not wired to a slash command).
- Schema migration logic when schemaVersion eventually bumps.

## Local main state

Local `main` continues ahead of `origin/main`. Push timing remains Jonah's call.

## Next on the roadmap

- Carryover sweep: wire flowW/flowX into intent-detector.ts; fix composite slash-command help-text parser inconsistency; consume unstructured-validator output into BuildReport.
- Push timing: when local main is ready to sync to origin.
```

Fill in `<sha>` and `<N>` from the actual commits and test count.

- [ ] **Step 3: Add MEMORY.md index entry**

In `.claude/memory/MEMORY.md`, insert at the top of the list:

```markdown
- [Sprint 6 closed (2026-05-24)](session_2026-05-24_sprint6_closed.md): Phase 6 part 2 checkpoint mechanism - CheckpointStore module, auto-write between steps, metadata.resumeFromCheckpoint resume API, soft-fail write semantics; <N> tests green.
```

Keep the entry under 200 chars.

- [ ] **Step 4: Commit the sprint close**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && rm -f /Users/spare3/.claude/.needs-verification
cd /Users/spare3/Documents/Github/claude-dotfiles && git add .claude/memory/session_2026-05-24_sprint6_closed.md .claude/memory/MEMORY.md
cd /Users/spare3/Documents/Github/claude-dotfiles && git commit -m "docs(sidecoach): close Sprint 6 - Phase 6 part 2 checkpoint mechanism"
```

- [ ] **Step 5: Final sanity check**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git log --oneline -10
cd /Users/spare3/Documents/Github/claude-dotfiles && git status
```

Working tree should be clean (or only contain pre-existing dirty state from session start - `sidecoach/dist/*` etc.).
