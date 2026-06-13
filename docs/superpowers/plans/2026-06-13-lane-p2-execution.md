# Lane Execution + Phrase Wiring (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lanes actually *run* - a step-by-step lane execution state machine on `FlowExecutionEngine` - and connect the already-built `/sidecoach <phrase>` resolver so natural language reaches a running lane end to end.

**Architecture:** P1 gave us understanding (a classifier that picks a lane) and the data (`lanes.generated.ts` exposing each lane's `verbChain`, `verbGuidance`, `flowSequence`, `executionKind`). P2 adds *doing*: a new `LaneCheckpoint` persisted per run, four engine methods (`startLane` / `advanceLane` / `laneStatus` / `listLanes`) that walk a lane's **verb steps** (each verb step serves its member flows' handler guidance plus the verb's coaching guidance), and a model-attested `StepReport` contract to advance. The existing one-shot `engine.process()` and the flow `CheckpointStore` (schemaVersion 1) are left untouched; lane state lives in a separate `LaneCheckpointStore`. The P1 `resolveSidecoachPhrase` (built, unit-tested, currently caller-less) gets wired into the live command path, and a thin monitor CLI surface exposes the four operations so the model can drive a lane without waiting on the P4 MCP migration.

**Tech Stack:** TypeScript (engine, `sidecoach/src/`), Node CLI (`sidecoach/bin/`), ts-node test runner via the P1 enumerating runner (`sidecoach/scripts/run-tests.ts` over `sidecoach/src/__tests__/*.test.ts`). No pytest, no new deps.

**Scope discipline (read before starting):** This plan is ONE coherent subsystem. It deliberately does NOT build:
- **Durability hardening (-> P3):** cross-process leases, `operationId`, fencing tokens, the side-effect outbox, checkpoint schema migration, realpath project canonicalization, `AbortSignal` propagation, full concurrent-advance safety. P2 implements only the *cheap in-process* idempotency that keeps the API shape stable: `startRequestId` dedup, `expectedRevision` compare-and-swap, and `reportId` dedup via `seenReportIds`. The method signatures match the spec (section 7) so P3 adds machinery without changing them.
- **Validators + convergence floor (-> P4):** `product-rule-registry.ts`, `flow-validation-capabilities.ts`, validator gating at step/iteration boundaries, the release floor, and `lane_converge`'s truthful convergence. In P2, step completion is purely **model-attested** (a valid `StepReport` advances; no validator can block). Loop lanes iterate until an explicit `stop`. P4 layers the gates on top of this contract.
- **MCP migration + cleanup (-> P4):** `sidecoach_classify_intent` / `list-lanes` / `sidecoach_lane` tools, `modes.ts` + `dist/modes.js` deletion, `ralph-loop.ts` -> `convergence-loop.ts` rename, SKILL/CHEATSHEET/marketing regeneration. P2 ships a monitor-CLI surface instead.

If any task below tempts you to pull P3/P4 work forward, stop and leave it - the deferral is intentional.

---

## File Structure

**Create:**
- `sidecoach/src/lane-types.ts` - the lane execution contract types (`LaneTransition`, `StepReport`, `StepEvidence`, `LaneStepResult`, `LaneState`, `LaneInfo`). One file, types only, so every later task imports a single source.
- `sidecoach/src/lane-checkpoint-store.ts` - `LaneCheckpoint` record + `LaneCheckpointStore` (project-scoped, atomic write, `.claude/lane-checkpoints/`). Separate from the flow `CheckpointStore` so the pinned schemaVersion-1 flow checkpoint is never disturbed.
- `sidecoach/src/lane-runner.ts` - the lane state machine (`startLane` / `advanceLane` / `laneStatus` / `listLanes`) as standalone functions taking the engine + stores as args. Kept out of the 1648-line orchestrator for focus; `FlowExecutionEngine` gets thin delegating methods (Task 9).
- `sidecoach/src/__tests__/lane-checkpoint-store.test.ts`
- `sidecoach/src/__tests__/lane-runner-start.test.ts`
- `sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts`
- `sidecoach/src/__tests__/lane-runner-advance-loop.test.ts`
- `sidecoach/src/__tests__/lane-runner-transitions.test.ts`
- `sidecoach/src/__tests__/lane-runner-status-list.test.ts`
- `sidecoach/src/__tests__/slash-phrase-wiring.test.ts`
- `sidecoach/src/__tests__/lane-execution-e2e.test.ts`

**Modify:**
- `sidecoach/src/lane-derivation.ts` + `sidecoach/scripts/generate-lanes.ts` + `sidecoach/src/lanes.generated.ts` - emit a derived `verbSteps: { verb, flowIds, guidance }[]` per lane (Task 2). Regenerated, `--check`-guarded.
- `sidecoach/src/slash-command-router.ts` - wire `resolveSidecoachPhrase` into a live `resolveSidecoachInput()` entrypoint (Task 10). `parseSlashCommand` stays byte-stable for known commands; only the previously-dead unknown branch gains phrase resolution.
- `sidecoach/src/sidecoach-orchestrator.ts` - add four thin delegating methods on `FlowExecutionEngine` (Task 9).
- `sidecoach/bin/sidecoach-monitor.js` - add `lane` subcommands (Task 11), mirroring the existing `engine.process()` instantiation at line 53.
- `sidecoach/scripts/run-tests.ts` - register the new test files if the runner enumerates explicitly (verify in Setup).

**Read-only references (do not modify):**
- `sidecoach/src/checkpoint-store.ts` - `SidecoachCheckpoint` (schemaVersion 1) is the *pattern* to copy (atomic tmp+rename, project-scoped dir), NOT the store to extend.
- `sidecoach/src/flow-handler.ts` - `FlowExecutionContext`, `FlowExecutionResult` (`{ flowId, flowName, status, message, guidance?, checklist? }`), `FlowHandler.execute()`.
- `sidecoach/src/lanes.generated.ts` - `GeneratedLane` (`lane, label, executionKind, verbChain, flowSequence, verbGuidance, prereqWaivers`).
- `sidecoach/src/verb-command-registry.ts` - `getVerbEntry(verb) -> { flowIds, description }`.

---

## Setup

- [ ] **Step 0.1: Branch off main**

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b lane-p2-execution
git branch --show-current   # expect: lane-p2-execution
```

- [ ] **Step 0.2: Confirm the test runner enumerates `src/__tests__/`**

Run: `cd sidecoach && cat scripts/run-tests.ts`
Confirm whether it globs `src/__tests__/*.test.ts` or lists files explicitly. If explicit, every new test file below must be added to its list in the same task that creates it (note it inline). If it globs, no runner edits are needed. Record which it is before proceeding.

- [ ] **Step 0.3: Baseline green**

Run: `cd sidecoach && npm run build && npm test`
Expected: build exit 0; `run-tests: N suite(s) passed` (the P1 surface - intent-detector, engine+mcp parity, slash-phrase, lane-derivation). If not green on a fresh main, STOP and escalate - do not build on a red baseline.

---

## Task 1: Lane execution contract types

**Files:**
- Create: `sidecoach/src/lane-types.ts`
- Test: `sidecoach/src/__tests__/lane-types.test.ts`

- [ ] **Step 1.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-types.test.ts
import { makeStepReport, isTerminalLaneStatus } from '../lane-types';

function run() {
  const r = makeStepReport({
    stepId: 'shape', iteration: 0, reportId: 'r1', verb: 'shape',
    summary: 'did the thing', evidence: [{ kind: 'note', detail: 'x' }],
  });
  if (r.evidence.length !== 1) throw new Error('evidence not preserved');
  if (!isTerminalLaneStatus('converged')) throw new Error('converged should be terminal');
  if (isTerminalLaneStatus('in_progress')) throw new Error('in_progress is not terminal');
  console.log('lane-types: OK');
}
run();
```

- [ ] **Step 1.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-types.test.ts`
Expected: FAIL - `Cannot find module '../lane-types'`.

- [ ] **Step 1.3: Write `lane-types.ts`**

```typescript
// sidecoach/src/lane-types.ts
// The lane execution contract. Mirrors spec section 7, scoped to P2:
// idempotency KEYS are present (startRequestId, expectedRevision, reportId)
// but distributed-safety machinery (leases, fencing, outbox) is P3.
import type { FlowId } from './types';

export type LaneAction = 'complete' | 'retry' | 'skip' | 'resume' | 'interrupt' | 'stop';

export type LaneStatus = 'in_progress' | 'converged' | 'stopped' | 'interrupted';

export interface StepEvidence {
  kind: 'files' | 'screenshot' | 'validation' | 'note';
  detail: string;
}

export interface StepReport {
  stepId: string;          // the verb step this reports on (the verb name)
  iteration: number;       // loop lanes: which pass (0 for sequence lanes)
  reportId: string;        // idempotency key; a re-sent reportId is a no-op
  verb: string;
  summary: string;
  evidence: StepEvidence[];          // at least one entry (validated in advanceLane)
  checklistResults?: { itemId: string; done: boolean }[];
}

export interface LaneTransition {
  action: LaneAction;
  report?: StepReport;       // REQUIRED for 'complete'
  expectedRevision: number;  // compare-and-swap; stale revision = error
  reason?: string;           // for skip/stop/interrupt audit
}

// What a step serves to the model.
export interface LaneStepResult {
  checkpointId: string;
  laneId: string;
  laneLabel: string;
  status: LaneStatus;
  executionKind: 'sequence' | 'loop';
  iteration: number;
  stepIndex: number;          // cursor over the lane's verb steps
  totalSteps: number;
  currentVerb?: string;       // undefined when status is terminal
  guidance: string[];         // verb coaching guidance + each member flow's handler guidance
  checklist: { id: string; label: string; required: boolean; completed: boolean }[];
  flowIds: FlowId[];          // the member flows of the current verb step
  revision: number;           // pass back as expectedRevision on the next advance
  message: string;
}

export interface LaneState {
  checkpointId: string;
  laneId: string;
  status: LaneStatus;
  executionKind: 'sequence' | 'loop';
  iteration: number;
  stepIndex: number;
  totalSteps: number;
  completedStepIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface LaneInfo {
  checkpointId: string;
  laneId: string;
  status: LaneStatus;
  stepIndex: number;
  totalSteps: number;
  updatedAt: string;
}

export function makeStepReport(r: StepReport): StepReport {
  return { ...r, evidence: [...r.evidence] };
}

export function isTerminalLaneStatus(s: LaneStatus): boolean {
  return s === 'converged' || s === 'stopped';
}
```

- [ ] **Step 1.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-types.test.ts`
Expected: `lane-types: OK`. If the runner is explicit (Step 0.2), add this file to it now.

- [ ] **Step 1.5: Commit**

```bash
git add sidecoach/src/lane-types.ts sidecoach/src/__tests__/lane-types.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): lane execution contract types"
```

---

## Task 2: Derive per-lane verb steps (generator change)

The execution cursor walks **verb steps**, and each verb step must serve its member flows plus the verb's coaching guidance. The generated lane has `verbChain` + `verbGuidance` + `flowSequence`, but no per-verb flow grouping. Derive `verbSteps: { verb, flowIds, guidance }[]` so the runner does zero registry lookups at execution time and parity/`--check` guards it.

**Files:**
- Modify: `sidecoach/src/lane-derivation.ts`
- Modify: `sidecoach/src/lanes.generated.ts` (regenerated, not hand-edited)
- Test: `sidecoach/src/__tests__/lane-derivation.test.ts` (extend existing)

- [ ] **Step 2.1: Write the failing test (extend the existing derivation test)**

Append a new assertion block to `sidecoach/src/__tests__/lane-derivation.test.ts`:

```typescript
// --- P2: verbSteps derivation ---
import { LANES } from '../lanes.generated';
{
  const build = LANES.find((l) => l.lane === 'lane_build');
  if (!build) throw new Error('lane_build missing');
  if (!Array.isArray((build as any).verbSteps)) throw new Error('verbSteps not emitted');
  const vs = (build as any).verbSteps;
  if (vs.length !== build.verbChain.length) throw new Error('one verbStep per verb expected');
  if (vs[0].verb !== build.verbChain[0]) throw new Error('verbSteps order must match verbChain');
  // every verbStep flow must appear in the lane's flowSequence (lane-scoped, ordered)
  for (const step of vs) {
    if (step.flowIds.length === 0) throw new Error(`verb ${step.verb} has no flows`);
    for (const f of step.flowIds) {
      if (!build.flowSequence.includes(f)) throw new Error(`flow ${f} not in flowSequence`);
    }
  }
  // union of verbStep flows == flowSequence (no flow dropped or invented)
  const union = new Set(vs.flatMap((s: any) => s.flowIds));
  if (union.size !== build.flowSequence.length) throw new Error('verbStep flows must cover flowSequence exactly');
  console.log('lane-derivation verbSteps: OK');
}
```

- [ ] **Step 2.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-derivation.test.ts`
Expected: FAIL - `verbSteps not emitted`.

- [ ] **Step 2.3: Add `verbSteps` to the derivation**

In `sidecoach/src/lane-derivation.ts`, locate where each lane object is assembled (the function that produces the `GeneratedLane`-shaped objects from `sidecoach-lanes.json` + the verb registry). Add a derived `verbSteps` field. Insert this helper and call it when building each lane:

```typescript
import { getVerbEntry } from './verb-command-registry';
import type { FlowId } from './types';

// Each verb step carries ONLY the flows that (a) belong to that verb in the
// registry AND (b) appear in the lane's already-derived flowSequence, in
// flowSequence order. A flow shared by two verbs is assigned to the FIRST verb
// in verbChain that owns it, so the union of verbStep flows equals flowSequence
// exactly (no flow dropped, none run twice).
function deriveVerbSteps(
  verbChain: string[],
  flowSequence: FlowId[],
  verbGuidance: { verb: string; guidance: string[] }[],
): { verb: string; flowIds: FlowId[]; guidance: string[] }[] {
  const claimed = new Set<FlowId>();
  const guidanceByVerb = new Map(verbGuidance.map((g) => [g.verb, g.guidance]));
  return verbChain.map((verb) => {
    const entry = getVerbEntry(verb);
    const verbFlows = entry ? (entry.flowIds as FlowId[]) : [];
    const flowIds = flowSequence.filter((f) => verbFlows.includes(f) && !claimed.has(f));
    flowIds.forEach((f) => claimed.add(f));
    return { verb, flowIds, guidance: guidanceByVerb.get(verb) ?? [] };
  });
}
```

Then, in the lane assembly, add `verbSteps: deriveVerbSteps(verbChain, flowSequence, verbGuidance),` to the emitted object, and add the field to the `GeneratedLane` interface in `sidecoach/src/lanes.generated.ts`'s source-of-truth interface (the generator writes the interface too - update the generator's interface-emitting string, do not hand-edit the generated file):

```typescript
// GeneratedLane interface gains:
verbSteps: { verb: string; flowIds: FlowId[]; guidance: string[] }[];
```

- [ ] **Step 2.4: Regenerate and verify drift guard**

Run: `cd sidecoach && npx ts-node scripts/generate-lanes.ts && npx ts-node scripts/generate-lanes.ts --check`
Expected: file rewritten; `--check` exits 0 (no drift). Then `npx ts-node src/__tests__/lane-derivation.test.ts` -> `lane-derivation verbSteps: OK`.

- [ ] **Step 2.5: Commit**

```bash
git add sidecoach/src/lane-derivation.ts sidecoach/scripts/generate-lanes.ts sidecoach/src/lanes.generated.ts sidecoach/src/__tests__/lane-derivation.test.ts
git commit -m "feat(lane-p2): derive per-lane verbSteps for execution"
```

---

## Task 3: LaneCheckpoint + LaneCheckpointStore

**Files:**
- Create: `sidecoach/src/lane-checkpoint-store.ts`
- Test: `sidecoach/src/__tests__/lane-checkpoint-store.test.ts`

- [ ] **Step 3.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-checkpoint-store.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, LaneCheckpoint } from '../lane-checkpoint-store';

function tmpProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt-'));
}

function run() {
  const proj = tmpProject();
  const store = new LaneCheckpointStore(proj);
  const cp: LaneCheckpoint = {
    schemaVersion: 1, checkpointId: 'cp1', laneId: 'lane_build',
    executionKind: 'sequence', target: 'the hero', status: 'in_progress',
    cursor: 0, iteration: 0, completedStepIds: [], stepReports: [],
    revision: 0, startRequestId: 'req1', seenReportIds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
  store.write(cp);
  const back = store.read('cp1');
  if (back.laneId !== 'lane_build') throw new Error('round-trip laneId mismatch');
  if (back.revision !== 0) throw new Error('round-trip revision mismatch');

  // idempotency lookup by startRequestId
  const found = store.findByStartRequestId('req1');
  if (!found || found.checkpointId !== 'cp1') throw new Error('findByStartRequestId failed');
  if (store.findByStartRequestId('nope') !== null) throw new Error('unknown req should be null');

  const list = store.list();
  if (list.length !== 1 || list[0].checkpointId !== 'cp1') throw new Error('list failed');

  // unsupported schema rejected
  let threw = false;
  try { store.write({ ...cp, schemaVersion: 2 as any }); } catch { threw = true; }
  if (!threw) throw new Error('schemaVersion 2 should be rejected in P2');

  console.log('lane-checkpoint-store: OK');
}
run();
```

- [ ] **Step 3.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-checkpoint-store.test.ts`
Expected: FAIL - `Cannot find module '../lane-checkpoint-store'`.

- [ ] **Step 3.3: Write the store (copy the flow CheckpointStore atomic-write pattern)**

```typescript
// sidecoach/src/lane-checkpoint-store.ts
// Lane execution persistence. One file per lane run under
// <projectPath>/.claude/lane-checkpoints/. Atomic tmp+rename, mirroring
// checkpoint-store.ts. Separate store so the flow checkpoint (schemaVersion 1,
// pinned) is never touched. P2 is schemaVersion 1; P3 adds migration.
import * as fs from 'fs';
import * as path from 'path';
import type { FlowId } from './types';
import type { StepReport, LaneStatus } from './lane-types';

export interface LaneCheckpoint {
  schemaVersion: 1;
  checkpointId: string;
  laneId: string;
  executionKind: 'sequence' | 'loop';
  target: string;
  status: LaneStatus;
  cursor: number;             // index into the lane's verbSteps
  iteration: number;          // loop pass (0 for sequence)
  completedStepIds: string[]; // verb step ids completed in the CURRENT iteration
  stepReports: StepReport[];  // append-only audit of accepted reports
  revision: number;           // bumped on every committed mutation (compare-and-swap)
  startRequestId: string;     // transport idempotency for startLane
  seenReportIds: string[];    // reportId dedup
  createdAt: string;
  updatedAt: string;
}

export interface LaneCheckpointSummary {
  checkpointId: string;
  laneId: string;
  status: LaneStatus;
  cursor: number;
  updatedAt: string;
}

export class LaneCheckpointStore {
  constructor(private projectPath: string) {}

  private dir(): string {
    return path.join(this.projectPath, '.claude', 'lane-checkpoints');
  }
  private filePath(id: string): string {
    return path.join(this.dir(), `${id}.json`);
  }

  write(cp: LaneCheckpoint): void {
    if (cp.schemaVersion !== 1) {
      throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported (this build writes 1)`);
    }
    fs.mkdirSync(this.dir(), { recursive: true });
    const target = this.filePath(cp.checkpointId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
    fs.renameSync(tmp, target);
  }

  read(id: string): LaneCheckpoint {
    const target = this.filePath(id);
    if (!fs.existsSync(target)) throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as LaneCheckpoint;
    if (parsed.schemaVersion !== 1) {
      throw new Error(`LaneCheckpointStore.read: schemaVersion ${parsed.schemaVersion} unsupported`);
    }
    return parsed;
  }

  exists(id: string): boolean {
    return fs.existsSync(this.filePath(id));
  }

  findByStartRequestId(reqId: string): LaneCheckpoint | null {
    for (const s of this.list()) {
      const cp = this.read(s.checkpointId);
      if (cp.startRequestId === reqId) return cp;
    }
    return null;
  }

  list(): LaneCheckpointSummary[] {
    const dir = this.dir();
    if (!fs.existsSync(dir)) return [];
    const out: LaneCheckpointSummary[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try {
        const cp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LaneCheckpoint;
        out.push({ checkpointId: cp.checkpointId, laneId: cp.laneId, status: cp.status, cursor: cp.cursor, updatedAt: cp.updatedAt });
      } catch { /* skip unparseable */ }
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return out;
  }

  delete(id: string): void {
    const target = this.filePath(id);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}
```

- [ ] **Step 3.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-checkpoint-store.test.ts`
Expected: `lane-checkpoint-store: OK`.

- [ ] **Step 3.5: Commit**

```bash
git add sidecoach/src/lane-checkpoint-store.ts sidecoach/src/__tests__/lane-checkpoint-store.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): LaneCheckpoint + LaneCheckpointStore (schema v1, in-process idempotency keys)"
```

---

## Task 4: `startLane` - create checkpoint, serve step 0

The runner functions take their dependencies explicitly (lane data lookup, the checkpoint store, a clock, and a checkpoint-id factory) so tests are deterministic without `Date.now()`/random in the module (the workflow/test convention bans them at module scope).

**Files:**
- Create: `sidecoach/src/lane-runner.ts`
- Test: `sidecoach/src/__tests__/lane-runner-start.test.ts`

- [ ] **Step 4.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-start.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0;
  let t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    // serveStep is stubbed: returns deterministic guidance for the verb's flows
    runFlow: async (flowId) => ({
      flowId, flowName: String(flowId), status: 'success', message: 'ok',
      guidance: [`guidance for ${flowId}`],
      checklist: [{ id: 'c0', label: `check ${flowId}`, required: true, completed: false }],
    }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `cp${++n}`,
  };
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-start-'));
  const d = deps(proj);

  const res = await startLane('lane_build', 'the hero', { projectPath: proj }, 'req-1', d);
  if (res.laneId !== 'lane_build') throw new Error('laneId wrong');
  if (res.stepIndex !== 0) throw new Error('should start at step 0');
  if (res.currentVerb !== 'shape') throw new Error('lane_build first verb is shape');
  if (!res.guidance.some((g) => g.includes('Discovery interview'))) throw new Error('verb coaching guidance missing');
  if (!res.guidance.some((g) => g.includes('guidance for flowA_brand_verify'))) throw new Error('flow handler guidance missing');
  if (res.revision !== 0) throw new Error('initial revision is 0');

  // idempotent retry: same startRequestId returns the SAME checkpoint, no second lane
  const res2 = await startLane('lane_build', 'the hero', { projectPath: proj }, 'req-1', d);
  if (res2.checkpointId !== res.checkpointId) throw new Error('retry must return same checkpoint');
  if (d.store.list().length !== 1) throw new Error('retry must not create a second lane');

  // unknown lane errors
  let threw = false;
  try { await startLane('lane_nope', 't', { projectPath: proj }, 'req-2', d); } catch { threw = true; }
  if (!threw) throw new Error('unknown laneId must throw');

  console.log('lane-runner-start: OK');
}
run();
```

- [ ] **Step 4.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-start.test.ts`
Expected: FAIL - `Cannot find module '../lane-runner'`.

- [ ] **Step 4.3: Write `lane-runner.ts` (start + shared step-assembly helper)**

```typescript
// sidecoach/src/lane-runner.ts
// Lane execution state machine (P2: model-attested, in-process idempotency).
import type { FlowId } from './types';
import type { FlowExecutionResult } from './flow-handler';
import { LANES, GeneratedLane } from './lanes.generated';
import { LaneCheckpoint, LaneCheckpointStore } from './lane-checkpoint-store';
import {
  LaneStepResult, LaneState, LaneInfo, LaneTransition, isTerminalLaneStatus,
} from './lane-types';

export interface LaneRunnerDeps {
  store: LaneCheckpointStore;
  runFlow: (flowId: FlowId, context: any) => Promise<FlowExecutionResult>;
  now: () => string;
  newCheckpointId: () => string;
}

function lane(laneId: string): GeneratedLane {
  const l = LANES.find((x) => x.lane === laneId);
  if (!l) throw new Error(`startLane: unknown laneId "${laneId}"`);
  return l;
}

// Assemble the step result for the verb step at `cursor`: that verb's coaching
// guidance first, then each member flow's handler guidance + checklist.
async function serveStep(
  cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps,
): Promise<LaneStepResult> {
  const steps = l.verbSteps;
  if (isTerminalLaneStatus(cp.status) || cp.cursor >= steps.length) {
    return {
      checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
      status: cp.status, executionKind: l.executionKind, iteration: cp.iteration,
      stepIndex: cp.cursor, totalSteps: steps.length, currentVerb: undefined,
      guidance: [], checklist: [], flowIds: [], revision: cp.revision,
      message: cp.status === 'converged' ? 'Lane complete.' : `Lane ${cp.status}.`,
    };
  }
  const step = steps[cp.cursor];
  const guidance: string[] = [...step.guidance];
  const checklist: LaneStepResult['checklist'] = [];
  for (const flowId of step.flowIds) {
    const r = await d.runFlow(flowId, context);
    for (const g of r.guidance ?? []) guidance.push(g);
    for (const c of r.checklist ?? []) {
      checklist.push({ id: `${flowId}:${c.id}`, label: c.label, required: c.required, completed: false });
    }
  }
  return {
    checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
    status: cp.status, executionKind: l.executionKind, iteration: cp.iteration,
    stepIndex: cp.cursor, totalSteps: steps.length, currentVerb: step.verb,
    guidance, checklist, flowIds: step.flowIds, revision: cp.revision,
    message: `Step ${cp.cursor + 1}/${steps.length}: ${step.verb}`,
  };
}

export async function startLane(
  laneId: string, target: string, context: { projectPath?: string } & Record<string, any>,
  startRequestId: string, d: LaneRunnerDeps,
): Promise<LaneStepResult> {
  const l = lane(laneId);
  const existing = d.store.findByStartRequestId(startRequestId);
  if (existing) return serveStep(existing, l, context, d);

  const ts = d.now();
  const cp: LaneCheckpoint = {
    schemaVersion: 1, checkpointId: d.newCheckpointId(), laneId,
    executionKind: l.executionKind, target, status: 'in_progress',
    cursor: 0, iteration: 0, completedStepIds: [], stepReports: [],
    revision: 0, startRequestId, seenReportIds: [], createdAt: ts, updatedAt: ts,
  };
  d.store.write(cp);
  return serveStep(cp, l, context, d);
}

// (advanceLane / laneStatus / listLanes added in Tasks 5-8; serveStep is shared.)
export { serveStep, lane as resolveLane };
```

- [ ] **Step 4.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-start.test.ts`
Expected: `lane-runner-start: OK`.

- [ ] **Step 4.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-start.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): startLane + shared verb-step assembly"
```

---

## Task 5: `advanceLane` - sequence completion (model-attested)

**Files:**
- Modify: `sidecoach/src/lane-runner.ts`
- Test: `sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts`

- [ ] **Step 5.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

function deps(proj: string): LaneRunnerDeps {
  let n = 0; let t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [`g:${flowId}`], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `cp${++n}`,
  };
}
const report = (verb: string, iteration = 0): StepReport => ({
  stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb,
  summary: 'done', evidence: [{ kind: 'note', detail: 'x' }],
});

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-adv-'));
  const d = deps(proj);
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d); // verbs: shape, craft, polish

  // complete without a report is REJECTED, step stays current
  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', expectedRevision: 0 }, d); } catch { threw = true; }
  if (!threw) throw new Error('complete without report must reject');

  // stale revision rejected
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: report('shape'), expectedRevision: 99 }, d); } catch { threw = true; }
  if (!threw) throw new Error('stale expectedRevision must reject');

  // valid complete advances to craft, bumps revision
  const r1 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: report('shape'), expectedRevision: 0 }, d);
  if (r1.currentVerb !== 'craft') throw new Error('should advance to craft');
  if (r1.revision !== 1) throw new Error('revision should bump to 1');

  // duplicate reportId is a no-op returning current state (still craft)
  const dup = await advanceLane(proj, start.checkpointId, { action: 'complete', report: report('shape'), expectedRevision: 1 }, d);
  if (dup.currentVerb !== 'craft') throw new Error('duplicate reportId must be a no-op');

  // wrong stepId rejected (reporting 'polish' while on 'craft')
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: report('polish'), expectedRevision: dup.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('mismatched stepId must reject');

  // finish craft, then polish -> converged
  const r2 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: report('craft'), expectedRevision: dup.revision }, d);
  if (r2.currentVerb !== 'polish') throw new Error('should advance to polish');
  const r3 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: report('polish'), expectedRevision: r2.revision }, d);
  if (r3.status !== 'converged') throw new Error('sequence lane should converge after last step');
  if (r3.currentVerb !== undefined) throw new Error('terminal step has no currentVerb');

  console.log('lane-runner-advance-sequence: OK');
}
run();
```

- [ ] **Step 5.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-advance-sequence.test.ts`
Expected: FAIL - `advanceLane is not a function` (not yet exported).

- [ ] **Step 5.3: Implement `advanceLane` (sequence path) in `lane-runner.ts`**

Add to `lane-runner.ts`:

```typescript
function bump(cp: LaneCheckpoint, d: LaneRunnerDeps): void {
  cp.revision += 1;
  cp.updatedAt = d.now();
  d.store.write(cp);
}

export async function advanceLane(
  projectPath: string, checkpointId: string, transition: LaneTransition, d: LaneRunnerDeps,
): Promise<LaneStepResult> {
  const cp = d.store.read(checkpointId);
  const l = resolveLane(cp.laneId);

  // duplicate report -> no-op returning current state (checked before revision CAS,
  // so a retried transport call is idempotent regardless of revision drift).
  if (transition.report && cp.seenReportIds.includes(transition.report.reportId)) {
    return serveStep(cp, l, { projectPath }, d);
  }
  if (transition.expectedRevision !== cp.revision) {
    throw new Error(`advanceLane: stale expectedRevision ${transition.expectedRevision} (current ${cp.revision})`);
  }
  if (isTerminalLaneStatus(cp.status)) {
    throw new Error(`advanceLane: lane already ${cp.status}`);
  }

  switch (transition.action) {
    case 'stop':
      cp.status = 'stopped'; bump(cp, d); return serveStep(cp, l, { projectPath }, d);
    case 'interrupt':
      cp.status = 'interrupted'; bump(cp, d); return serveStep(cp, l, { projectPath }, d);
    case 'resume':
      if (cp.status === 'interrupted') cp.status = 'in_progress';
      bump(cp, d); return serveStep(cp, l, { projectPath }, d);
    case 'retry':
      bump(cp, d); return serveStep(cp, l, { projectPath }, d); // re-serve same step
    case 'skip':
      return advanceCursor(cp, l, { projectPath }, d, undefined); // see Task 7
    case 'complete': {
      const rep = transition.report;
      if (!rep) throw new Error('advanceLane: complete requires a StepReport');
      if (!rep.evidence || rep.evidence.length < 1) throw new Error('advanceLane: StepReport needs >=1 evidence');
      const step = l.verbSteps[cp.cursor];
      if (rep.stepId !== step.verb || rep.iteration !== cp.iteration) {
        throw new Error(`advanceLane: report (${rep.stepId}/${rep.iteration}) does not match current step (${step.verb}/${cp.iteration})`);
      }
      cp.seenReportIds.push(rep.reportId);
      cp.stepReports.push(rep);
      cp.completedStepIds.push(step.verb);
      return advanceCursor(cp, l, { projectPath }, d, rep);
    }
    default:
      throw new Error(`advanceLane: unknown action "${(transition as any).action}"`);
  }
}
```

Add the cursor-advance helper (sequence path now; loop branch filled in Task 6, skip-prereq in Task 7 - leave the marked TODO comments exactly so later tasks find them):

```typescript
async function advanceCursor(
  cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps, _rep: any,
): Promise<LaneStepResult> {
  const last = l.verbSteps.length - 1;
  if (cp.cursor < last) {
    cp.cursor += 1;
    bump(cp, d);
    return serveStep(cp, l, context, d);
  }
  // at last step:
  if (l.executionKind === 'sequence') {
    cp.status = 'converged';
    bump(cp, d);
    return serveStep(cp, l, context, d);
  }
  // LOOP lane iteration boundary -> Task 6
  return loopBoundary(cp, l, context, d);
}
```

For this task only, add a temporary `loopBoundary` stub so the file compiles; Task 6 replaces it:

```typescript
async function loopBoundary(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult> {
  // Replaced in Task 6. Sequence lanes never reach here.
  throw new Error('loopBoundary not implemented (Task 6)');
}
```

- [ ] **Step 5.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-advance-sequence.test.ts`
Expected: `lane-runner-advance-sequence: OK`.

- [ ] **Step 5.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): advanceLane sequence completion (model-attested, CAS, report dedup)"
```

---

## Task 6: `advanceLane` - loop lanes (iteration boundary)

`lane_calm` and `lane_converge` are `executionKind: 'loop'`. After the last verb step of an iteration, the loop increments `iteration`, resets the cursor, and re-serves the first step. P2 has NO validator gate, so the loop continues until an explicit `stop`. (P4 adds the validator-gated convergence floor that can auto-close the loop as `converged`.)

**Files:**
- Modify: `sidecoach/src/lane-runner.ts` (replace the `loopBoundary` stub)
- Test: `sidecoach/src/__tests__/lane-runner-advance-loop.test.ts`

- [ ] **Step 6.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-advance-loop.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LANES } from '../lanes.generated';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

function deps(proj: string): LaneRunnerDeps {
  let n = 0; let t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `cp${++n}`,
  };
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-loop-'));
  const d = deps(proj);
  // pick a real loop lane from the generated data, fail loudly if none
  const loopLane = LANES.find((l) => l.executionKind === 'loop');
  if (!loopLane) throw new Error('expected at least one loop lane (lane_calm/lane_converge)');

  let res = await startLane(loopLane.lane, 't', { projectPath: proj }, 'req-1', d);
  if (res.iteration !== 0) throw new Error('starts at iteration 0');

  // complete every verb step of iteration 0
  for (let i = 0; i < loopLane.verbSteps.length; i++) {
    const verb = res.currentVerb!;
    const rep: StepReport = { stepId: verb, iteration: 0, reportId: `r0:${verb}`, verb, summary: 's', evidence: [{ kind: 'note', detail: 'x' }] };
    res = await advanceLane(proj, res.checkpointId, { action: 'complete', report: rep, expectedRevision: res.revision }, d);
  }
  // loop boundary: NOT converged, iteration incremented, cursor reset
  if (res.status !== 'in_progress') throw new Error('loop must not converge without stop in P2');
  if (res.iteration !== 1) throw new Error('iteration should be 1 after first boundary');
  if (res.stepIndex !== 0) throw new Error('cursor resets to 0 at boundary');

  // an explicit stop ends the loop
  const stopped = await advanceLane(proj, res.checkpointId, { action: 'stop', expectedRevision: res.revision, reason: 'good enough' }, d);
  if (stopped.status !== 'stopped') throw new Error('stop must end the loop');

  console.log('lane-runner-advance-loop: OK');
}
run();
```

- [ ] **Step 6.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-advance-loop.test.ts`
Expected: FAIL - `loopBoundary not implemented (Task 6)`.

- [ ] **Step 6.3: Replace the `loopBoundary` stub**

```typescript
async function loopBoundary(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult> {
  // P2: no validator gate. Increment the iteration, reset for the next pass,
  // keep the lane in_progress. The user/model ends the loop with an explicit
  // 'stop'. (P4 will invoke requiredProductValidatorIds here and close the lane
  // as 'converged' when they all return clean.)
  cp.iteration += 1;
  cp.cursor = 0;
  cp.completedStepIds = [];
  bump(cp, d);
  return serveStep(cp, l, context, d);
}
```

- [ ] **Step 6.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-advance-loop.test.ts`
Expected: `lane-runner-advance-loop: OK`.

- [ ] **Step 6.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-advance-loop.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): loop-lane iteration boundary (stop-terminated; validator gate deferred to P4)"
```

---

## Task 7: `skip` with prerequisite safety

A `skip` advances the cursor without a report, BUT must not strand a later step whose hard prerequisite (from the lane's `prereqWaivers` - a waiver means the dependency is intentionally satisfiable) is left unmet. P2 implements the spec's reject-unsafe-skip rule using the generated `prereqWaivers` as the waiver source: a skip is rejected if a not-yet-completed, non-waived prerequisite of any remaining step is the step being skipped.

**Files:**
- Modify: `sidecoach/src/lane-runner.ts`
- Test: `sidecoach/src/__tests__/lane-runner-transitions.test.ts`

- [ ] **Step 7.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-transitions.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0; let t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `cp${++n}`,
  };
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-trans-'));
  const d = deps(proj);
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);

  // skip the first verb step -> advances to craft, records the skip
  const r = await advanceLane(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision, reason: 'already shaped' }, d);
  if (r.currentVerb !== 'craft') throw new Error('skip should advance to craft');

  // interrupt then resume returns to the same step
  const ir = await advanceLane(proj, r.checkpointId, { action: 'interrupt', expectedRevision: r.revision }, d);
  if (ir.status !== 'interrupted') throw new Error('interrupt sets interrupted');
  const rr = await advanceLane(proj, r.checkpointId, { action: 'resume', expectedRevision: ir.revision }, d);
  if (rr.status !== 'in_progress' || rr.currentVerb !== 'craft') throw new Error('resume returns to craft, in_progress');

  // retry re-serves the same step without advancing
  const rt = await advanceLane(proj, r.checkpointId, { action: 'retry', expectedRevision: rr.revision }, d);
  if (rt.currentVerb !== 'craft') throw new Error('retry stays on craft');

  console.log('lane-runner-transitions: OK');
}
run();
```

- [ ] **Step 7.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-transitions.test.ts`
Expected: FAIL - the `skip` path currently calls `advanceCursor(..., undefined)` which records nothing / may mis-handle; assertion fails (or skip throws). Confirm the specific failure before implementing.

- [ ] **Step 7.3: Implement safe `skip`**

Replace the `case 'skip':` line in `advanceLane` with a guarded version, and add the prereq helper:

```typescript
    case 'skip': {
      const step = l.verbSteps[cp.cursor];
      const blocked = remainingHardDependentsOf(step.verb, cp, l);
      if (blocked.length > 0) {
        throw new Error(`advanceLane: cannot skip "${step.verb}" - remaining steps depend on it: ${blocked.join(', ')}. Retry it or stop the lane.`);
      }
      cp.stepReports.push({ stepId: step.verb, iteration: cp.iteration, reportId: `skip:${step.verb}:${cp.iteration}`, verb: step.verb, summary: `SKIPPED: ${transition.reason ?? 'no reason given'}`, evidence: [{ kind: 'note', detail: 'skipped' }] });
      return advanceCursor(cp, l, { projectPath }, d, undefined);
    }
```

```typescript
// A remaining (not-yet-passed) verb step "hard-depends" on `verb` when a
// prereqWaiver maps one of its member flows to a flow owned by `verb` AND that
// waiver is NOT present (waived deps are satisfiable, so they don't block).
// In P2 the prereqWaivers list enumerates the *waived* (safe-to-skip) edges;
// any dependency not waived blocks the skip.
function remainingHardDependentsOf(verb: string, cp: LaneCheckpoint, l: GeneratedLane): string[] {
  const step = l.verbSteps[cp.cursor];
  const waivedFrom = new Set(l.prereqWaivers.map((w) => w.prerequisiteFlowId));
  const skippedFlowsUnwaived = step.flowIds.filter((f) => !waivedFrom.has(f));
  if (skippedFlowsUnwaived.length === 0) return [];
  const blocked: string[] = [];
  for (let i = cp.cursor + 1; i < l.verbSteps.length; i++) {
    const later = l.verbSteps[i];
    const dependsOnSkipped = later.flowIds.some((lf) =>
      l.prereqWaivers.some((w) => w.dependentFlowId === lf && skippedFlowsUnwaived.includes(w.prerequisiteFlowId as any)),
    );
    if (dependsOnSkipped) blocked.push(later.verb);
  }
  return blocked;
}
```

Note: `lane_build` has empty `prereqWaivers`, so `remainingHardDependentsOf` returns `[]` and the skip succeeds - matching the test. The guard only bites on lanes that declare prerequisite edges. (This is the P2 approximation; P4's validator/prereq model is richer.)

- [ ] **Step 7.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-transitions.test.ts`
Expected: `lane-runner-transitions: OK`.

- [ ] **Step 7.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-transitions.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): skip with prerequisite safety + interrupt/resume/retry transitions"
```

---

## Task 8: `laneStatus` + `listLanes`

**Files:**
- Modify: `sidecoach/src/lane-runner.ts`
- Test: `sidecoach/src/__tests__/lane-runner-status-list.test.ts`

- [ ] **Step 8.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-status-list.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, laneStatus, listLanes, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0; let t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `cp${++n}`,
  };
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-stat-'));
  const d = deps(proj);
  const a = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-a', d);
  await startLane('lane_ship', 'site', { projectPath: proj }, 'req-b', d);

  const st = laneStatus(proj, a.checkpointId, d);
  if (st.laneId !== 'lane_build' || st.status !== 'in_progress') throw new Error('status wrong');
  if (st.totalSteps !== 3) throw new Error('lane_build has 3 verb steps');

  const all = listLanes(proj, d);
  if (all.length !== 2) throw new Error('expected 2 lanes');

  console.log('lane-runner-status-list: OK');
}
run();
```

- [ ] **Step 8.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-status-list.test.ts`
Expected: FAIL - `laneStatus is not a function`.

- [ ] **Step 8.3: Implement `laneStatus` + `listLanes`**

```typescript
export function laneStatus(projectPath: string, checkpointId: string, d: LaneRunnerDeps): LaneState {
  const cp = d.store.read(checkpointId);
  const l = resolveLane(cp.laneId);
  return {
    checkpointId: cp.checkpointId, laneId: cp.laneId, status: cp.status,
    executionKind: cp.executionKind, iteration: cp.iteration, stepIndex: cp.cursor,
    totalSteps: l.verbSteps.length, completedStepIds: [...cp.completedStepIds],
    revision: cp.revision, createdAt: cp.createdAt, updatedAt: cp.updatedAt,
  };
}

export function listLanes(projectPath: string, d: LaneRunnerDeps): LaneInfo[] {
  return d.store.list().map((s) => {
    const l = resolveLane(s.laneId);
    return { checkpointId: s.checkpointId, laneId: s.laneId, status: s.status, stepIndex: s.cursor, totalSteps: l.verbSteps.length, updatedAt: s.updatedAt };
  });
}
```

- [ ] **Step 8.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-status-list.test.ts`
Expected: `lane-runner-status-list: OK`.

- [ ] **Step 8.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-status-list.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): laneStatus + listLanes"
```

---

## Task 9: Engine delegation methods

Expose the four operations on `FlowExecutionEngine` so callers use one object. The engine wires real dependencies: a `LaneCheckpointStore` scoped to the project path, a `runFlow` that dispatches to the registered handler, a real clock, and a checkpoint-id factory.

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts`
- Test: `sidecoach/src/__tests__/lane-engine-methods.test.ts`

- [ ] **Step 9.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-engine-methods.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FlowExecutionEngine } from '../sidecoach-orchestrator';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-eng-'));
  const engine = new FlowExecutionEngine();   // match the existing constructor; adjust if it requires args
  const res = await engine.startLane('lane_build', 'hero', { projectPath: proj }, 'req-1');
  if (res.laneId !== 'lane_build' || res.currentVerb !== 'shape') throw new Error('startLane via engine failed');
  const st = engine.laneStatus(proj, res.checkpointId);
  if (st.totalSteps !== 3) throw new Error('laneStatus via engine failed');
  console.log('lane-engine-methods: OK');
}
run();
```

- [ ] **Step 9.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-engine-methods.test.ts`
Expected: FAIL - `engine.startLane is not a function`. (If `new FlowExecutionEngine()` needs args, read the constructor around `sidecoach-orchestrator.ts:77` and match it in the test first.)

- [ ] **Step 9.3: Add delegating methods**

In `sidecoach-orchestrator.ts`, import the runner and add methods to the `FlowExecutionEngine` class. `runFlow` reuses the registered handler map (`getHandlers()`):

```typescript
import * as laneRunner from './lane-runner';
import { LaneCheckpointStore } from './lane-checkpoint-store';
import type { LaneTransition } from './lane-types';

// ... inside class FlowExecutionEngine:

private laneDeps(projectPath: string): laneRunner.LaneRunnerDeps {
  return {
    store: new LaneCheckpointStore(projectPath),
    runFlow: async (flowId, context) => {
      const handler = this.getHandlers().get(flowId);
      if (!handler) {
        return { flowId, flowName: String(flowId), status: 'skipped', message: `no handler for ${flowId}` };
      }
      return handler.execute({ utterance: '', projectPath, ...context });
    },
    now: () => new Date().toISOString(),
    newCheckpointId: () => `lane-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  };
}

async startLane(laneId: string, target: string, context: { projectPath?: string } & Record<string, any>, startRequestId: string) {
  const projectPath = context.projectPath || process.cwd();
  return laneRunner.startLane(laneId, target, { ...context, projectPath }, startRequestId, this.laneDeps(projectPath));
}
async advanceLane(projectPath: string, checkpointId: string, transition: LaneTransition) {
  return laneRunner.advanceLane(projectPath, checkpointId, transition, this.laneDeps(projectPath));
}
laneStatus(projectPath: string, checkpointId: string) {
  return laneRunner.laneStatus(projectPath, checkpointId, this.laneDeps(projectPath));
}
listLanes(projectPath: string) {
  return laneRunner.listLanes(projectPath, this.laneDeps(projectPath));
}
```

Note: `Date.now()`/`Math.random()` are fine in the *engine* (production code); they are banned only in workflow scripts and test modules. Tests inject deterministic `now`/`newCheckpointId` via `laneDeps`-style stubs as in Tasks 4-8.

- [ ] **Step 9.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-engine-methods.test.ts`
Expected: `lane-engine-methods: OK`.

- [ ] **Step 9.5: Commit**

```bash
git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/lane-engine-methods.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): FlowExecutionEngine lane delegation methods"
```

---

## Task 10: Wire `/sidecoach <phrase>` into the live command path

`resolveSidecoachPhrase` (P1) is built and unit-tested but has zero callers. Add `resolveSidecoachInput()` that tries the existing `parseSlashCommand` first (known verbs/phase commands keep byte-stable behavior), and only when that returns the "unknown command" result for a `/sidecoach`-addressed phrase falls through to the phrase resolver.

**Files:**
- Modify: `sidecoach/src/slash-command-router.ts`
- Test: `sidecoach/src/__tests__/slash-phrase-wiring.test.ts`

- [ ] **Step 10.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/slash-phrase-wiring.test.ts
import * as path from 'path';
import { resolveSidecoachInput } from '../slash-command-router';

const LANES_JSON = path.join(__dirname, '..', '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json');

function run() {
  // a known verb still routes as a direct command (parseSlashCommand wins)
  const known = resolveSidecoachInput('/sidecoach polish the hero', LANES_JSON);
  if (known.source !== 'command') throw new Error('known verb should resolve via command path');

  // a natural phrase with no command word resolves via the classifier
  const phrase = resolveSidecoachInput('/sidecoach build me a dashboard from scratch and make it production-ready', LANES_JSON);
  if (phrase.source !== 'phrase') throw new Error('phrase should resolve via classifier');
  if (phrase.phrase!.kind !== 'ROUTE') throw new Error('strong phrase should ROUTE');

  // backend phrase refuses
  const oos = resolveSidecoachInput('/sidecoach optimize the database query planner', LANES_JSON);
  if (oos.source !== 'phrase' || oos.phrase!.kind !== 'OUT_OF_SCOPE') throw new Error('backend phrase should be OUT_OF_SCOPE');

  // a typo suggests
  const typo = resolveSidecoachInput('/sidecoach polsih', LANES_JSON);
  if (typo.source !== 'phrase' || typo.phrase!.kind !== 'UNKNOWN' || !typo.phrase!.suggestion) throw new Error('typo should produce a near-miss suggestion');

  console.log('slash-phrase-wiring: OK');
}
run();
```

- [ ] **Step 10.2: Run it, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/slash-phrase-wiring.test.ts`
Expected: FAIL - `resolveSidecoachInput is not a function`.

- [ ] **Step 10.3: Add `resolveSidecoachInput`**

Append to `slash-command-router.ts`:

```typescript
export interface SidecoachInputResolution {
  source: 'command' | 'phrase';
  command?: CommandMatch;        // set when source === 'command'
  phrase?: PhraseResolution;     // set when source === 'phrase'
}

// Live entrypoint for /sidecoach input. Known verbs/phase commands keep their
// exact existing behavior (parseSlashCommand). Only a /sidecoach-addressed
// utterance that parseSlashCommand cannot map to a known command falls through
// to the natural-language phrase resolver (P1 resolveSidecoachPhrase).
export function resolveSidecoachInput(utterance: string, lanesPath: string): SidecoachInputResolution {
  const cmd = parseSlashCommand(utterance);
  if (cmd.isCommand) return { source: 'command', command: cmd };

  // Not a known command. Strip a leading /sidecoach (or /) and resolve the rest
  // as a natural phrase. If it was not /sidecoach-addressed at all, still resolve
  // the raw utterance (callers gate on the leading slash upstream).
  const phraseText = utterance.trim().replace(/^\/(?:sidecoach\s+)?/i, '');
  return { source: 'phrase', phrase: resolveSidecoachPhrase(phraseText, lanesPath) };
}
```

- [ ] **Step 10.4: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/slash-phrase-wiring.test.ts`
Expected: `slash-phrase-wiring: OK`. If the OUT_OF_SCOPE case fails, confirm `sidecoach-lanes.json` has a negative_filter matching "database/query planner"; adjust the test phrase to a known backend negative rather than weakening the assertion.

- [ ] **Step 10.5: Commit**

```bash
git add sidecoach/src/slash-command-router.ts sidecoach/src/__tests__/slash-phrase-wiring.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): wire resolveSidecoachPhrase into live resolveSidecoachInput"
```

---

## Task 11: Monitor CLI lane subcommands

Give the model a runtime surface without the P4 MCP migration. Add a `lane` subcommand group to `bin/sidecoach-monitor.js`, mirroring the existing `engine.process()` instantiation.

**Files:**
- Modify: `sidecoach/bin/sidecoach-monitor.js`
- Test: `sidecoach/src/__tests__/lane-cli.test.ts` (spawns the CLI as a child process - real input, no internal-method shortcut)

- [ ] **Step 11.1: Read the current monitor entry**

Run: `cd sidecoach && sed -n '1,60p' bin/sidecoach-monitor.js`
Note how it imports the compiled engine (from `dist/`) and instantiates it at line ~53. The lane subcommands must use the SAME import + build assumption. If the monitor runs from `dist/`, this task depends on `npm run build` having compiled the new lane modules - add a build step to the test.

- [ ] **Step 11.2: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-cli.test.ts
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MONITOR = path.join(__dirname, '..', '..', 'bin', 'sidecoach-monitor.js');

function run() {
  // requires a prior `npm run build`; the runner step (11.4) builds first.
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-cli-'));
  const out = execFileSync('node', [MONITOR, 'lane', 'start', 'lane_build', '--project', proj, '--target', 'hero'], { encoding: 'utf8' });
  if (!/lane_build/.test(out)) throw new Error('CLI start did not report the lane');
  if (!/shape/.test(out)) throw new Error('CLI start did not serve the first verb step');
  const list = execFileSync('node', [MONITOR, 'lane', 'list', '--project', proj], { encoding: 'utf8' });
  if (!/lane_build/.test(list)) throw new Error('CLI list did not show the started lane');
  console.log('lane-cli: OK');
}
run();
```

- [ ] **Step 11.3: Implement the `lane` subcommands**

In `bin/sidecoach-monitor.js`, before the existing utterance path, branch on `process.argv[2] === 'lane'`. Parse `--project`, `--target`, `--request`, `--checkpoint`, `--action`, `--report` (JSON) flags. Dispatch:

```javascript
// near the top of the dispatch, after engine import:
const sub = process.argv[2];
if (sub === 'lane') {
  const args = process.argv.slice(3);
  const getFlag = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
  };
  const op = args[0];
  const project = getFlag('--project', process.cwd());
  const engine = buildEngine(); // same factory the utterance path uses; extract if inline
  (async () => {
    let result;
    if (op === 'start') {
      const laneId = args[1];
      const target = getFlag('--target', '');
      const request = getFlag('--request', `cli-${process.pid}-${Date.now()}`);
      result = await engine.startLane(laneId, target, { projectPath: project }, request);
    } else if (op === 'advance') {
      const checkpoint = getFlag('--checkpoint', args[1]);
      const action = getFlag('--action', 'complete');
      const reportRaw = getFlag('--report', '');
      const expectedRevision = Number(getFlag('--revision', '0'));
      const transition = { action, expectedRevision };
      if (reportRaw) transition.report = JSON.parse(reportRaw);
      const reason = getFlag('--reason', '');
      if (reason) transition.reason = reason;
      result = await engine.advanceLane(project, checkpoint, transition);
    } else if (op === 'status') {
      result = engine.laneStatus(project, getFlag('--checkpoint', args[1]));
    } else if (op === 'list') {
      result = engine.listLanes(project);
    } else {
      console.error('usage: sidecoach-monitor lane <start|advance|status|list> [flags]');
      process.exit(2);
    }
    console.log(JSON.stringify(result, null, 2));
  })().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
  return; // do not fall through to the utterance path
}
```

If the engine instantiation at line ~53 is inline rather than a `buildEngine()` factory, extract it into a small factory function first (refactor-only, no behavior change) so both the utterance path and the lane path share it.

- [ ] **Step 11.4: Build, then run the test**

Run: `cd sidecoach && npm run build && npx ts-node src/__tests__/lane-cli.test.ts`
Expected: build exit 0; `lane-cli: OK`.

- [ ] **Step 11.5: Commit**

```bash
git add sidecoach/bin/sidecoach-monitor.js sidecoach/src/__tests__/lane-cli.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): monitor CLI lane subcommands (start/advance/status/list)"
```

---

## Task 12: End-to-end - phrase to converged lane

Prove the whole path with real inputs: resolve a phrase, start the routed lane on the engine, advance through every verb step, reach `converged`.

**Files:**
- Test: `sidecoach/src/__tests__/lane-execution-e2e.test.ts`

- [ ] **Step 12.1: Write the test**

```typescript
// sidecoach/src/__tests__/lane-execution-e2e.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveSidecoachInput } from '../slash-command-router';
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { StepReport } from '../lane-types';

const LANES_JSON = path.join(__dirname, '..', '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json');

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-e2e-'));
  const reso = resolveSidecoachInput('/sidecoach build me a dashboard from scratch and make it production-ready', LANES_JSON);
  if (reso.source !== 'phrase' || reso.phrase!.kind !== 'ROUTE') throw new Error('expected a ROUTE phrase');
  const laneId = reso.phrase!.lane!;

  const engine = new FlowExecutionEngine();
  let step = await engine.startLane(laneId, 'dashboard', { projectPath: proj }, 'e2e-1');
  let guard = 0;
  while (step.status === 'in_progress' && guard++ < 50) {
    const verb = step.currentVerb!;
    const rep: StepReport = { stepId: verb, iteration: step.iteration, reportId: `e2e:${verb}:${step.iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] };
    step = await engine.advanceLane(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision });
    if (step.executionKind === 'loop' && step.iteration >= 2) { // loop lanes: stop after 2 passes
      step = await engine.advanceLane(proj, step.checkpointId, { action: 'stop', expectedRevision: step.revision });
    }
  }
  if (!['converged', 'stopped'].includes(step.status)) throw new Error(`lane did not finish (status=${step.status})`);
  console.log('lane-execution-e2e: OK');
}
run();
```

- [ ] **Step 12.2: Run it, verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-execution-e2e.test.ts`
Expected: `lane-execution-e2e: OK`.

- [ ] **Step 12.3: Commit**

```bash
git add sidecoach/src/__tests__/lane-execution-e2e.test.ts sidecoach/scripts/run-tests.ts
git commit -m "test(lane-p2): end-to-end phrase -> startLane -> advance -> finished"
```

---

## Task 13: Final integration check

- [ ] **Step 13.1: Full build + test surface**

Run:
```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node scripts/generate-lanes.ts --check   # no drift after the verbSteps change
npm run build                                     # exit 0
npm test                                          # enumerating runner: all suites pass
```
Expected: `--check` exit 0; build exit 0; `run-tests: N suite(s) passed` where N includes every new lane suite (lane-types, lane-checkpoint-store, lane-runner-*, lane-engine-methods, slash-phrase-wiring, lane-cli, lane-execution-e2e) plus the P1 suites. If any new suite is MISSING from the count, the runner did not pick it up (Step 0.2) - fix registration, do not hand-wave the count.

- [ ] **Step 13.2: Hook regression (must stay green - P1 surface untouched)**

Run: `cd /Users/spare3/Documents/Github/improv && bash claude/hooks/test-sidecoach-keyword.sh && python3 claude/hooks/test_sidecoach_lanes.py`
Expected: `110 passed, 0 failed` and `35 passed, 0 failed`. P2 does not touch the hook or the Python classifier; a regression here means an accidental cross-edit.

- [ ] **Step 13.3: Confirm deferrals did NOT leak in**

Run: `cd /Users/spare3/Documents/Github/improv && git diff --name-only main..lane-p2-execution`
Expected: NO changes to `modes.ts`, `ralph-loop.ts`, any `mcp-server/` file, or any new `product-rule-registry.ts`/`flow-validation-capabilities.ts`. If any appear, P3/P4 work leaked into P2 - revert it.

- [ ] **Step 13.4: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore(lane-p2): final integration check green" || echo "nothing to commit"
```

---

## Deferred to later phases (record, do not build here)

**Phase 3 - durability hardening** (makes lane execution crash- and concurrency-safe):
- Cross-process lease + `operationId` (EXECUTE/FINALIZE/committed-outbox protocol), fencing tokens.
- Side-effect outbox so initial guidance / step effects publish only after the operation finalizes.
- `LaneCheckpoint` schemaVersion 2 + migration; realpath project canonicalization.
- `AbortSignal` propagation into `runFlow`.
- Concurrent-advance correctness beyond the in-process CAS (two processes).

**Phase 4 - validators, convergence, MCP, cleanup:**
- `product-rule-registry.ts` (canonical `ProductRuleDefinition`s + severity table) and `flow-validation-capabilities.ts` (registration / flow binding / lane policy), all `--check`-generated.
- Validator gating: sequence-step validators + loop iteration-boundary `requiredProductValidatorIds`; worst-status-wins mapping (`clean`/`findings`/`inconclusive`/`error`); the release floor (theming/anti-pattern/static-a11y slices).
- `lane_converge` truthful, persisted convergence (the floor that closes a loop as `converged` instead of waiting for `stop`); `ralph-loop.ts` -> `convergence-loop.ts` (rename + t20 expectation fix).
- MCP migration: `sidecoach_classify_intent` (replaces `resolve_keyword`), `list-modes` -> `list-lanes`, new `sidecoach_lane` tool mirroring the four ops, `registries.ts` lane loader + NUDGE parity, schemas/tools/get-cheatsheet, transcripts, `mcp-server/dist`.
- Cleanup: delete `modes.ts` + stale `dist/modes.js`; SKILL.md/CHEATSHEET.md generated sections (stepped lane protocol + phrase docs) + `marketing-site` regen via the visual verification gate.

---

## Self-Review (completed during authoring)

**Spec coverage (section 7 + 10):** `startLane`/`advanceLane`/`laneStatus`/`listLanes` signatures match section 7; `StepReport` shape (stepId/iteration/reportId/verb/summary/evidence/checklistResults) matches; `transition` union (complete/retry/skip/resume/interrupt/stop + expectedRevision + report) matches; model-attested completion with >=1 evidence enforced (Task 5); loop iteration boundary resets cursor and increments iteration (Task 6); skip-prereq-safety reject (Task 7); `/sidecoach <phrase>` ROUTE/CLASSIFY/OUT_OF_SCOPE/UNKNOWN wired (Task 10). DELIBERATELY deferred and labeled: validator gating, convergence floor, leases/outbox/fencing, schema migration, MCP migration - each mapped to P3 or P4 above.

**Placeholder scan:** every code step contains full code; no "TBD"/"add error handling"/"similar to Task N". The one intentional stub (`loopBoundary`, Task 5) is explicitly replaced in Task 6, with its throw message naming the task.

**Type consistency:** `LaneStepResult`/`LaneState`/`LaneInfo`/`LaneTransition`/`StepReport`/`StepEvidence` defined once (Task 1), imported everywhere. `LaneCheckpoint` defined once (Task 3). Runner fns `startLane`/`advanceLane`/`laneStatus`/`listLanes` keep one signature from Task 4 through Task 9's delegation. `verbSteps` shape `{verb, flowIds, guidance}` consistent between the generator (Task 2) and the runner (Task 4).

**Known soft spots for the reviewer to probe:** (1) the `runFlow` signature - whether dispatching the registered handler with a synthetic `utterance:''` is acceptable for guidance generation, or whether handlers need richer context; (2) whether the monitor runs from `dist/` (Task 11 build dependency); (3) the P2 `prereqWaivers`-as-waiver-list interpretation in Task 7 vs the spec's richer prerequisite model.
