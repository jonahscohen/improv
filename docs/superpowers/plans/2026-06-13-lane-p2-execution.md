# Lane Execution + Phrase Wiring (Phase 2) Implementation Plan - v4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make **sequence** lanes actually *run* - a step-by-step lane execution state machine on `FlowExecutionEngine` - and wire the already-built `/sidecoach <phrase>` resolver into the live `process()` entrypoint so natural language reaches a running lane end to end.

**Architecture:** P1 gave understanding (the classifier) and data (`lanes.generated.ts`: each lane's `verbChain`, `verbGuidance`, `flowSequence`, `executionKind`). P2 adds *doing* for sequence lanes only: a new `LaneCheckpoint` (separate from the pinned flow `CheckpointStore`), four engine methods (`startLane`/`advanceLane`/`laneStatus`/`listLanes`) that walk a lane's **verb steps**, and a model-attested `StepReport` contract. Lane state uses the spec's **two-axis** model - `lifecycle` (`in_progress` | `interrupted` | `closed`) and `outcome` (`completed` | `partial` | `stopped` | `converged`) - never a collapsed `status`. Served step guidance is **persisted** so idempotent transitions never re-run handlers. The live entrypoint is `FlowExecutionEngine.process()` (the same method the monitor already calls), gated on `^/sidecoach\s+(.+)$`. The CLI/tests use the existing `createExecutionEngine()` factory (the only constructor that registers flow handlers).

**Tech Stack:** TypeScript (`sidecoach/src/`), Node CLI (`sidecoach/bin/`), ts-node test runner via the explicit `SUITES` array in `sidecoach/scripts/run-tests.ts`. No pytest, no new deps.

---

## What changed from v1 (Codex review `task-mqcsq8ko`, NEEDS-FIXES - all folded here)

- **Sequence-only scope.** `lane_converge` is the ONLY loop lane (verified: `lanes.generated.ts` - the other five, including `lane_calm`, are `sequence`), and its convergence floor is P4 validator work. So P2 executes sequence lanes only, **rejects** starting a loop lane, and defers ALL loop execution to P4. v1's loop-boundary task is deleted. (Codex P0-7, P2-16)
- **Two-axis lifecycle/outcome** replaces the single `status` field; sequence completion closes `lifecycle: closed` with `outcome: completed | partial`; only validated loops (P4) reach `converged`. (Codex P0-1)
- **Live wiring into `process()`** - the resolver is called from the real entrypoint and routed (`ROUTE` -> `startLane`), tested through `process()`. v1 left it caller-less. (Codex P0-3)
- **Real prerequisite validator** - Task 7 uses `FlowPrerequisiteValidator.getDependencies()` + `prereqWaivers` as exact edge exceptions + checkpoint-local completed flows, with a genuinely-failing unsafe-skip test. v1's `prereqWaivers`-as-graph logic was inverted. (Codex P0-4)
- **Empty-flow verb steps allowed** (guidance-only steps like `lane_build/polish`, `lane_calm/distill` legitimately have no unique flows). (Codex P0-2)
- **Interrupt semantics** - only `resume` is valid against an interrupted checkpoint; interrupt does not re-run handlers. (Codex P0-5)
- **Guarded handler dispatch + persisted served output** - the engine enriches context, checks the prerequisite graph AND `canExecute` (degraded coaching-only guidance if either fails), and wraps `execute()` in try/catch (a throw degrades to `error`, never attested). Served output is cached so retry/resume/duplicate never re-execute. The per-step context carries `utterance: ''` by design (lane steps have no per-step user utterance - they serve guidance), but it is no longer an UNGUARDED raw dispatch. (Codex P0-6)
- **Engine factory** - everything uses `createExecutionEngine()` (registers handlers); `new FlowExecutionEngine()` has no handlers. (Codex P1-12)
- Cheap P2 safety brought forward: checkpoint-id validation + project `realpath` canonicalization (Codex P1-9); `listLanes(options?)` (P1-10); start-request lane-mismatch handling (P1-11); spec CLI flags `--lane`/`--start-request-id` (P1-12); explicit `SUITES` registration `required:true` (P1-13); phrase regex gated to `/sidecoach <phrase>` only (P1-14); no `git add -A` (P1-15); transition audit log (P1-8); e2e requires `outcome: completed` (P2-17).

**Still deferred (do NOT build here):**
- **P3 - durability:** cross-process leases/`operationId`, fencing tokens, side-effect outbox, checkpoint schema migration, `AbortSignal`. (P2 keeps only in-process idempotency: `startRequestId` dedup, `expectedRevision` CAS, `reportId` dedup, persisted served output.)
- **P4 - validators + loops + MCP + cleanup:** `product-rule-registry.ts`, `flow-validation-capabilities.ts`, validator gating, **loop execution + `lane_converge` + the convergence floor**, `ralph-loop.ts` -> `convergence-loop.ts`, MCP `classify-intent`/`list-lanes`/`sidecoach_lane`, `modes.ts`/`dist` deletion, SKILL/CHEATSHEET/marketing regen.

If a task tempts you to pull deferred work forward, stop - the deferral is intentional.

---

## What changed in v3 (Codex v2 review `task-mqctksof` - 14/17 closed; these close the rest)

- **Prereq-aware dispatch (P0-a / P0-6).** `runFlow` now consults the REAL `FlowPrerequisiteValidator` against the checkpoint's `completedFlowIds` plus the lane's waived edges, and serves **degraded (coaching-only) guidance** when a required prerequisite is unmet - the same posture `process()` takes (`sidecoach-orchestrator.ts:917-948`). This matters because some lane sequences legitimately violate the prereq DAG (e.g. `lane_ship` = `[flowK, flowI, flowL, flowV, flowM, flowJ]`, where `flowK` requires the last step `flowJ` and `flowI` requires the absent `flowG`). P2 coaches through those steps honestly instead of pretending the flow ran; generator-level sequence/prereq validation is a P4 note.
- **Honest concurrency claims + best-effort guard (P0-b).** v2 overclaimed "CAS"/"idempotency guarantees." P2 provides a **best-effort in-process** revision check: `bump()` re-reads the checkpoint immediately before writing and aborts on a revision mismatch. True cross-process compare-and-swap (lease + fencing token) is **P3**. The plan no longer claims a hard guarantee.
- **Pure-guidance handlers + incremental persist (P0-c).** Lane flow handlers are pure GUIDANCE generators (checklist items `completed:false`, no side effects), so re-execution is benign. `serveStep` persists each flow's output as it is produced, so a mid-step interruption re-runs only the in-flight flow. Exactly-once via the side-effect outbox is **P3**.
- **CLASSIFY has a real confirm-to-start path (P1-d).** A murky phrase returns the candidate lane AND a confirmation token; confirming dispatches `startLane` identically to ROUTE (spec 263-266, 812-813). Not a dead-end message.
- **Deterministic `startRequestId` from `process()` (P1-e).** Derived from `hash(utterance + projectPath)`, so a literal retry of the same phrase does not double-start a lane.
- **CLI report hardening (P1-f) + `startRequestId` validation (P1-g).** `--report` is size-capped and shape-validated before use; `startRequestId` is validated and length-capped (stored as-is, capped; hashed indexing is a P3/P4 refinement - the plan does NOT claim hashing).
- **Real realpath (P1-9).** The project dir is created (if absent) then `realpathSync`'d, so canonicalization is genuine rather than falling back to `path.resolve`.
- **OUT_OF_SCOPE test phrase fixed (P2-h).** `optimize` is a known verb; the wiring test uses a non-command backend phrase.

---

## What changed in v4 (Codex v3 review `task-mqcu3h5z` - closes the v3 still-opens + new finds)

- **No false attestation (NEW P0 / P0-a part 2).** Completing a step now promotes ONLY the flows that actually returned `status:'success'` (tracked per-flow in the served cache as `successfulFlowIds`) into `completedFlowIds` - never blindly all `step.flowIds`. Degraded/skipped/errored flows are not attested, so they cannot falsely satisfy a later step's prerequisite. This is what makes the `lane_ship` DAG-violating sequence correct rather than just non-crashing.
- **Intra-step prerequisite accumulation (P0-a part 1).** `serveStep` feeds each flow `completedFlowIds + the successful flows already served in THIS step`, so a later flow in a step (e.g. `flowI` after `flowG` within `craft`) sees its same-step prerequisite.
- **Guarded dispatch + honest claim (P0-6).** `handler.execute()` is wrapped in try/catch (a throw -> `error` result, never attested). The plan no longer claims the `utterance:''` context is "gone" - it is the documented no-per-step-utterance guidance context, now guarded by prereq + `canExecute` + try/catch.
- **Honest CAS wording everywhere (P0-b).** The `compare-and-swap` label in the transition type is corrected to "best-effort in-process revision check"; true CAS is consistently labeled P3.
- **Closed-checkpoint re-start (NEW P1 / P1-e aliasing).** `startLane` dedups only on an ACTIVE (in_progress/interrupted) checkpoint; a CLOSED one means the run finished, so the same deterministic id legitimately starts a fresh lane (no permanent aliasing to a closed checkpoint).
- **Fuller report validation + file input (P1-f).** `--report`/`--report-file` validate `stepId`/`reportId`/`verb`/`summary` (strings), `iteration` (number), and each `evidence` item `{kind,detail}`.
- **CLASSIFY round-trip test (P1-d).** Task 10's wiring test exercises confirm-to-start: a murky phrase surfaces `classify.laneId`, and `startLane(classify.laneId)` (the SAME terminal path as ROUTE) actually starts the lane; the no-classify branch hard-fails so the implementer must use a verified-CLASSIFY phrase.
- **NUL byte removed (P2).** A stray NUL in the Task 3 test literal is gone (the file is valid UTF-8 text again).

**Residual (intentional, deferred):** true cross-process CAS / exactly-once / `startRequestId` hashing = P3; generator-level lane-sequence prereq validation = P4. Non-revision `serveStep` writes are safe under P2's single-process sequential use; cross-process protection is P3.

---

## File Structure

**Create:**
- `sidecoach/src/lane-types.ts` - contract types (`LaneLifecycle`, `LaneOutcome`, `LaneTransition`, `StepReport`, `StepEvidence`, `LaneAuditEntry`, `LaneStepResult`, `LaneState`, `LaneInfo`).
- `sidecoach/src/lane-checkpoint-store.ts` - `LaneCheckpoint` + `LaneCheckpointStore` (project-realpath-scoped, checkpoint-id validated, atomic write, `.claude/lane-checkpoints/`).
- `sidecoach/src/lane-runner.ts` - the sequence state machine + the prerequisite-safe skip + served-output persistence.
- Test files: `lane-types.test.ts`, `lane-checkpoint-store.test.ts`, `lane-runner-start.test.ts`, `lane-runner-advance-sequence.test.ts`, `lane-runner-transitions.test.ts`, `lane-runner-skip-prereq.test.ts`, `lane-runner-status-list.test.ts`, `lane-engine-methods.test.ts`, `slash-phrase-wiring.test.ts`, `lane-cli.test.ts`, `lane-execution-e2e.test.ts` (all under `sidecoach/src/__tests__/`).

**Modify:**
- `sidecoach/src/lane-derivation.ts` + `sidecoach/scripts/generate-lanes.ts` + `sidecoach/src/lanes.generated.ts` - emit `verbSteps` (Task 2).
- `sidecoach/src/slash-command-router.ts` - `resolveSidecoachInput()` (Task 10).
- `sidecoach/src/sidecoach-orchestrator.ts` - four engine methods (Task 9) + `process()` phrase wiring (Task 10).
- `sidecoach/bin/sidecoach-monitor.js` - `lane` subcommands (Task 11).
- `sidecoach/scripts/run-tests.ts` - register each new suite in `SUITES` with `required: true` (every task that adds a test).

**Read-only references:** `checkpoint-store.ts` (atomic-write pattern), `flow-handler.ts` (`FlowExecutionResult`), `flow-prerequisites.ts` (`FlowPrerequisiteValidator`), `lanes.generated.ts` (`GeneratedLane`), `sidecoach-orchestrator.ts:1629` (`SidecoachResult`), `:1646` (`createExecutionEngine`), `:230-260` (enrich -> canExecute -> execute pattern).

---

## Setup

- [ ] **Step 0.1: Branch + cleanliness check**

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p2-execution
git branch --show-current   # expect: lane-p2-execution
# The worktree is dirty with UNRELATED workstreams. Record the pre-existing dirty
# set so the final scope check (Task 13) can prove this plan added nothing to it:
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p2-preexisting-dirty.txt
wc -l /tmp/lane-p2-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green**

Run: `cd sidecoach && npm run build && npm test`
Expected: build exit 0; `run-tests: N suite(s) passed`. The runner is the explicit `SUITES` array in `scripts/run-tests.ts` (NOT a glob) - every new suite below must be appended to it with `required: true` in the task that creates it. If red on fresh main, STOP.

---

## Task 1: Lane execution contract types (lifecycle/outcome two-axis)

**Files:** Create `sidecoach/src/lane-types.ts`; Test `sidecoach/src/__tests__/lane-types.test.ts`

- [ ] **Step 1.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-types.test.ts
import { makeStepReport, isClosed, LaneLifecycle } from '../lane-types';

function run() {
  const r = makeStepReport({ stepId: 'shape', iteration: 0, reportId: 'r1', verb: 'shape', summary: 'did it', evidence: [{ kind: 'note', detail: 'x' }] });
  if (r.evidence.length !== 1) throw new Error('evidence not preserved');
  const closed: LaneLifecycle = 'closed';
  if (!isClosed(closed)) throw new Error('closed must be terminal');
  if (isClosed('in_progress')) throw new Error('in_progress is not terminal');
  if (isClosed('interrupted')) throw new Error('interrupted is not terminal (resumable)');
  console.log('lane-types: OK');
}
run();
```

- [ ] **Step 1.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-types.test.ts`
Expected: FAIL - `Cannot find module '../lane-types'`.

- [ ] **Step 1.3: Write `lane-types.ts`**

```typescript
// sidecoach/src/lane-types.ts
// Lane execution contract. Two-axis lifecycle/outcome per spec section 7
// (lines 636-649). P2 carries idempotency KEYS (startRequestId, expectedRevision,
// reportId) but not P3 distributed-safety machinery.
import type { FlowId } from './types';

export type LaneAction = 'complete' | 'retry' | 'skip' | 'resume' | 'interrupt' | 'stop';
export type LaneLifecycle = 'in_progress' | 'interrupted' | 'closed';
export type LaneOutcome = 'completed' | 'partial' | 'stopped' | 'converged';

export interface StepEvidence { kind: 'files' | 'screenshot' | 'validation' | 'note'; detail: string; }

export interface StepReport {
  stepId: string;        // the verb step (verb name)
  iteration: number;     // 0 for sequence lanes (P2 is sequence-only)
  reportId: string;      // idempotency key; re-sent reportId is a no-op
  verb: string;
  summary: string;
  evidence: StepEvidence[];          // >= 1 entry (enforced in advanceLane)
  checklistResults?: { itemId: string; done: boolean }[];
}

export interface LaneTransition {
  action: LaneAction;
  report?: StepReport;       // REQUIRED for 'complete'
  expectedRevision: number;  // best-effort in-process revision check; stale = error (true cross-process CAS is P3)
  reason?: string;           // REQUIRED for 'skip'; recorded for stop/interrupt
}

export interface LaneAuditEntry {
  revision: number; action: LaneAction; stepId?: string; iteration: number;
  reason?: string; reportId?: string; at: string;
}

export interface LaneStepResult {
  checkpointId: string; laneId: string; laneLabel: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  executionKind: 'sequence' | 'loop'; iteration: number;
  stepIndex: number; totalSteps: number;
  currentVerb?: string;                 // undefined when closed
  guidance: string[];
  checklist: { id: string; label: string; required: boolean; completed: boolean }[];
  flowIds: FlowId[];
  revision: number;                     // pass as expectedRevision next advance
  message: string;
}

export interface LaneState {
  checkpointId: string; laneId: string; target: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  executionKind: 'sequence' | 'loop'; iteration: number;
  stepIndex: number; totalSteps: number; currentVerb?: string;
  completedStepIds: string[]; skippedStepIds: string[]; completedFlowIds: FlowId[];
  stepReports: StepReport[]; audit: LaneAuditEntry[];
  revision: number; createdAt: string; updatedAt: string;
}

export interface LaneInfo {
  checkpointId: string; laneId: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  stepIndex: number; totalSteps: number; updatedAt: string;
}

export function makeStepReport(r: StepReport): StepReport { return { ...r, evidence: [...r.evidence] }; }
export function isClosed(l: LaneLifecycle): boolean { return l === 'closed'; }
```

- [ ] **Step 1.4: Run, verify it passes; register suite**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-types.test.ts` -> `lane-types: OK`.
Add to `scripts/run-tests.ts` `SUITES`: `{ rel: 'src/__tests__/lane-types.test.ts', required: true },`

- [ ] **Step 1.5: Commit**

```bash
git add sidecoach/src/lane-types.ts sidecoach/src/__tests__/lane-types.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): lane contract types (lifecycle/outcome two-axis)"
```

---

## Task 2: Derive per-lane verb steps (empty-flow steps ALLOWED)

**Files:** Modify `lane-derivation.ts`, `generate-lanes.ts`, `lanes.generated.ts`; Test extend `lane-derivation.test.ts`

- [ ] **Step 2.1: Write the failing test (append to existing derivation test)**

```typescript
// --- P2: verbSteps derivation (empty-flow steps are LEGAL) ---
import { LANES } from '../lanes.generated';
{
  const build = LANES.find((l) => l.lane === 'lane_build')!;
  const vs = (build as any).verbSteps;
  if (!Array.isArray(vs)) throw new Error('verbSteps not emitted');
  if (vs.length !== build.verbChain.length) throw new Error('one verbStep per verb');
  if (vs[0].verb !== build.verbChain[0]) throw new Error('order matches verbChain');
  // every verb appears once, guidance preserved (incl. for empty-flow steps)
  for (const step of vs) {
    if (typeof step.verb !== 'string') throw new Error('verbStep.verb missing');
    if (!Array.isArray(step.guidance)) throw new Error(`guidance missing for ${step.verb}`);
    for (const f of step.flowIds) if (!build.flowSequence.includes(f)) throw new Error(`flow ${f} not in flowSequence`);
  }
  // union of NONEMPTY step flows == flowSequence exactly (no flow dropped/invented)
  const union = new Set(vs.flatMap((s: any) => s.flowIds));
  if (union.size !== build.flowSequence.length) throw new Error('nonempty verbStep flows must cover flowSequence exactly');
  // a guidance-only empty-flow step is allowed and must keep its guidance
  const polish = vs.find((s: any) => s.verb === 'polish');
  if (polish && polish.flowIds.length === 0 && polish.guidance.length === 0) throw new Error('empty-flow step must still carry guidance');
  console.log('lane-derivation verbSteps: OK');
}
```

- [ ] **Step 2.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-derivation.test.ts` -> FAIL `verbSteps not emitted`.

- [ ] **Step 2.3: Add `verbSteps` to the derivation**

In `lane-derivation.ts`, add and call:

```typescript
import { getVerbEntry } from './verb-command-registry';
import type { FlowId } from './types';

// First-owner assignment: a flow shared by two verbs is assigned to the FIRST
// verb in verbChain that owns it (so the union of nonempty step flows == the
// already-derived flowSequence). A verb whose flows were all claimed earlier
// yields an EMPTY-flow guidance-only step - that is legal and intentional.
function deriveVerbSteps(
  verbChain: string[], flowSequence: FlowId[],
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

Add `verbSteps: deriveVerbSteps(verbChain, flowSequence, verbGuidance),` to each emitted lane, and add to the generated `GeneratedLane` interface (edit the generator's interface-emitting string, not the generated file by hand):

```typescript
verbSteps: { verb: string; flowIds: FlowId[]; guidance: string[] }[];
```

- [ ] **Step 2.4: Regenerate + drift guard + test**

Run:
```bash
cd sidecoach && npx ts-node scripts/generate-lanes.ts && npx ts-node scripts/generate-lanes.ts --check && npx ts-node src/__tests__/lane-derivation.test.ts
```
Expected: regenerated; `--check` exit 0; `lane-derivation verbSteps: OK`. (`lane-derivation.test.ts` is already in `SUITES`; bump it to `required: true` now that it exists.)

- [ ] **Step 2.5: Commit**

```bash
git add sidecoach/src/lane-derivation.ts sidecoach/scripts/generate-lanes.ts sidecoach/src/lanes.generated.ts sidecoach/src/__tests__/lane-derivation.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): derive verbSteps (empty-flow guidance steps allowed)"
```

---

## Task 3: LaneCheckpoint + LaneCheckpointStore (validated id, realpath scope)

**Files:** Create `lane-checkpoint-store.ts`; Test `lane-checkpoint-store.test.ts`

- [ ] **Step 3.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-checkpoint-store.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, LaneCheckpoint } from '../lane-checkpoint-store';

function fresh(): LaneCheckpoint {
  return {
    schemaVersion: 1, checkpointId: 'lane-abc123', laneId: 'lane_build', target: 'hero',
    executionKind: 'sequence', lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId: 'req1',
    seenReportIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt-'));
  const store = new LaneCheckpointStore(proj);
  store.write(fresh());
  if (store.read('lane-abc123').laneId !== 'lane_build') throw new Error('round-trip failed');
  if (store.findByStartRequestId('req1')!.checkpointId !== 'lane-abc123') throw new Error('findByStartRequestId failed');
  if (store.findByStartRequestId('nope') !== null) throw new Error('unknown req -> null');
  if (store.list().length !== 1) throw new Error('list failed');

  // checkpoint-id validation: path-traversal / illegal chars rejected BEFORE fs access
  for (const bad of ['../evil', 'a/b', 'a*', '..']) {
    let threw = false;
    try { store.read(bad); } catch { threw = true; }
    if (!threw) throw new Error(`illegal id "${bad}" must be rejected`);
  }
  let threw = false;
  try { store.write({ ...fresh(), schemaVersion: 2 as any }); } catch { threw = true; }
  if (!threw) throw new Error('schemaVersion 2 rejected in P2');
  console.log('lane-checkpoint-store: OK');
}
run();
```

- [ ] **Step 3.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-checkpoint-store.test.ts` -> FAIL `Cannot find module`.

- [ ] **Step 3.3: Write the store**

```typescript
// sidecoach/src/lane-checkpoint-store.ts
import * as fs from 'fs';
import * as path from 'path';
import type { FlowId } from './types';
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry } from './lane-types';

export interface LaneCheckpoint {
  schemaVersion: 1;
  checkpointId: string; laneId: string; target: string;
  executionKind: 'sequence' | 'loop';
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  cursor: number; iteration: number;
  completedStepIds: string[]; skippedStepIds: string[]; completedFlowIds: FlowId[];
  stepReports: StepReport[]; audit: LaneAuditEntry[];
  servedSteps: Record<string, { guidance: string[]; checklist: { id: string; label: string; required: boolean; completed: boolean }[]; flowIds: FlowId[]; successfulFlowIds: FlowId[] }>; // key: `${cursor}:${iteration}`; successfulFlowIds = flows whose handler returned status 'success' (NOT degraded/skipped/errored)
  revision: number; startRequestId: string; seenReportIds: string[];
  createdAt: string; updatedAt: string;
}

export interface LaneCheckpointSummary { checkpointId: string; laneId: string; lifecycle: LaneLifecycle; outcome?: LaneOutcome; cursor: number; updatedAt: string; }

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function assertId(id: string): void {
  if (!ID_RE.test(id) || id.includes('..')) throw new Error(`LaneCheckpointStore: illegal checkpointId "${id}"`);
}

export class LaneCheckpointStore {
  private projectPath: string;
  constructor(projectPath: string) {
    // Genuine canonicalization: ensure the root exists, then realpath it so
    // symlinks/.. collapse to one canonical key (cheap boundary protection;
    // lease/fencing/outbox is P3). A truly unusable path throws loudly.
    try { fs.mkdirSync(projectPath, { recursive: true }); } catch { /* ignore - realpath will throw if still bad */ }
    this.projectPath = fs.realpathSync(projectPath);
  }
  private dir(): string { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); }
  private filePath(id: string): string { assertId(id); return path.join(this.dir(), `${id}.json`); }

  write(cp: LaneCheckpoint): void {
    if (cp.schemaVersion !== 1) throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported`);
    const target = this.filePath(cp.checkpointId);
    fs.mkdirSync(this.dir(), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
    fs.renameSync(tmp, target);
  }
  read(id: string): LaneCheckpoint {
    const target = this.filePath(id);
    if (!fs.existsSync(target)) throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as LaneCheckpoint;
    if (parsed.schemaVersion !== 1) throw new Error(`LaneCheckpointStore.read: schemaVersion ${parsed.schemaVersion} unsupported`);
    return parsed;
  }
  exists(id: string): boolean { try { return fs.existsSync(this.filePath(id)); } catch { return false; } }
  findByStartRequestId(reqId: string): LaneCheckpoint | null {
    for (const s of this.list()) { const cp = this.read(s.checkpointId); if (cp.startRequestId === reqId) return cp; }
    return null;
  }
  list(): LaneCheckpointSummary[] {
    const dir = this.dir();
    if (!fs.existsSync(dir)) return [];
    const out: LaneCheckpointSummary[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try { const cp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LaneCheckpoint;
        out.push({ checkpointId: cp.checkpointId, laneId: cp.laneId, lifecycle: cp.lifecycle, outcome: cp.outcome, cursor: cp.cursor, updatedAt: cp.updatedAt });
      } catch { /* skip */ }
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return out;
  }
  delete(id: string): void { const t = this.filePath(id); if (fs.existsSync(t)) fs.unlinkSync(t); }
}
```

- [ ] **Step 3.4: Run + register**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-checkpoint-store.test.ts` -> `lane-checkpoint-store: OK`.
Add `{ rel: 'src/__tests__/lane-checkpoint-store.test.ts', required: true },` to `SUITES`.

- [ ] **Step 3.5: Commit**

```bash
git add sidecoach/src/lane-checkpoint-store.ts sidecoach/src/__tests__/lane-checkpoint-store.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): LaneCheckpoint store (validated id, realpath scope, served-step cache)"
```

---

## Task 4: `startLane` - sequence-only, idempotent, persisted serve

**Files:** Create `lane-runner.ts`; Test `lane-runner-start.test.ts`

- [ ] **Step 4.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-start.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [`g:${flowId}`], checklist: [{ id: 'c0', label: `chk ${flowId}`, required: true, completed: false }] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++n}`,
  };
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-start-'));
  const d = deps(proj);
  const res = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  if (res.lifecycle !== 'in_progress') throw new Error('starts in_progress');
  if (res.currentVerb !== 'shape') throw new Error('first verb is shape');
  if (!res.guidance.some((g) => g.includes('Discovery interview'))) throw new Error('verb coaching guidance missing');
  if (!res.guidance.some((g) => g.includes('g:flowA_brand_verify'))) throw new Error('flow handler guidance missing');

  // idempotent retry returns the SAME checkpoint, no second lane
  const res2 = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  if (res2.checkpointId !== res.checkpointId) throw new Error('retry must return same checkpoint');
  if (d.store.list().length !== 1) throw new Error('retry must not create a second lane');

  // retry that supplies a DIFFERENT lane for the same requestId is rejected
  let threw = false;
  try { await startLane('lane_ship', 'hero', { projectPath: proj }, 'req-1', d); } catch { threw = true; }
  if (!threw) throw new Error('startRequestId reuse with a different lane must reject');

  // loop lane is rejected in P2
  threw = false;
  try { await startLane('lane_converge', 't', { projectPath: proj }, 'req-2', d); } catch (e: any) { threw = /loop|P4|converge/i.test(String(e.message)); }
  if (!threw) throw new Error('loop lane must be rejected in P2');

  // unknown lane errors
  threw = false;
  try { await startLane('lane_nope', 't', { projectPath: proj }, 'req-3', d); } catch { threw = true; }
  if (!threw) throw new Error('unknown laneId must throw');
  console.log('lane-runner-start: OK');
}
run();
```

- [ ] **Step 4.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-start.test.ts` -> FAIL `Cannot find module '../lane-runner'`.

- [ ] **Step 4.3: Write `lane-runner.ts` (start + persisted serve)**

```typescript
// sidecoach/src/lane-runner.ts
// Sequence-lane execution state machine (P2). Loop lanes are rejected here and
// handled in P4 with the convergence floor.
import type { FlowId } from './types';
import type { FlowExecutionResult } from './flow-handler';
import { LANES, GeneratedLane } from './lanes.generated';
import { LaneCheckpoint, LaneCheckpointStore } from './lane-checkpoint-store';
import { LaneStepResult, LaneState, LaneInfo, LaneTransition, LaneAuditEntry, isClosed } from './lane-types';

export interface LaneRunnerDeps {
  store: LaneCheckpointStore;
  runFlow: (flowId: FlowId, context: any) => Promise<FlowExecutionResult>;
  now: () => string;
  newCheckpointId: () => string;
}

function resolveLane(laneId: string): GeneratedLane {
  const l = LANES.find((x) => x.lane === laneId);
  if (!l) throw new Error(`lane runner: unknown laneId "${laneId}"`);
  return l;
}

function closedResult(cp: LaneCheckpoint, l: GeneratedLane): LaneStepResult {
  return {
    checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
    lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
    iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
    currentVerb: undefined, guidance: [], checklist: [], flowIds: [], revision: cp.revision,
    message: cp.lifecycle === 'closed'
      ? `Lane ${cp.outcome}.`
      : cp.lifecycle === 'interrupted'
        ? 'Lane interrupted - resume to continue.'
        : 'Lane has no current step.',
  };
}

// Serve the verb step at cursor. Uses the PERSISTED cache if present (so retry/
// resume/duplicate never re-run handlers); otherwise runs each member flow once,
// caches, and persists. Empty-flow steps serve guidance only.
async function serveStep(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult> {
  if (isClosed(cp.lifecycle) || cp.lifecycle === 'interrupted' || cp.cursor >= l.verbSteps.length) {
    return closedResult(cp, l);
  }
  const step = l.verbSteps[cp.cursor];
  const key = `${cp.cursor}:${cp.iteration}`;
  // Resumable incremental serve: persist after EACH flow so a mid-step
  // interruption re-runs only the in-flight flow. Handlers are pure guidance,
  // so even that re-run is benign. Serving is NOT a revision-bumping mutation.
  let acc = cp.servedSteps[key];
  if (!acc) { acc = { guidance: [...step.guidance], checklist: [], flowIds: [], successfulFlowIds: [] }; cp.servedSteps[key] = acc; cp.updatedAt = d.now(); d.store.write(cp); }
  if (acc.flowIds.length < step.flowIds.length) {
    for (let i = acc.flowIds.length; i < step.flowIds.length; i++) {
      const flowId = step.flowIds[i];
      // intra-step prerequisite accumulation: a later flow in THIS step sees the
      // earlier flows of the same step that ran successfully, plus all
      // prior-step completions. Only status:'success' counts (degraded/skipped/
      // errored flows are NOT attested - they must not satisfy a prerequisite).
      const flowCtx = { ...context, completedFlowIds: [...cp.completedFlowIds, ...acc.successfulFlowIds], waivers: l.prereqWaivers };
      const r = await d.runFlow(flowId, flowCtx);
      for (const g of r.guidance ?? []) acc.guidance.push(g);
      for (const c of r.checklist ?? []) acc.checklist.push({ id: `${flowId}:${c.id}`, label: c.label, required: c.required, completed: false });
      acc.flowIds.push(flowId);
      if (r.status === 'success') acc.successfulFlowIds.push(flowId);
      cp.updatedAt = d.now(); d.store.write(cp);
    }
  }
  const served = acc;
  return {
    checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
    lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
    iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
    currentVerb: step.verb, guidance: served.guidance, checklist: served.checklist,
    flowIds: served.flowIds, revision: cp.revision,
    message: `Step ${cp.cursor + 1}/${l.verbSteps.length}: ${step.verb}`,
  };
}

export async function startLane(
  laneId: string, target: string, context: { projectPath?: string } & Record<string, any>,
  startRequestId: string, d: LaneRunnerDeps,
): Promise<LaneStepResult> {
  if (!startRequestId || typeof startRequestId !== 'string' || startRequestId.length > 256) {
    throw new Error('startLane: startRequestId must be a non-empty string <= 256 chars');
  }
  const l = resolveLane(laneId);
  if (l.executionKind === 'loop') {
    throw new Error(`startLane: lane "${laneId}" is a loop lane - loop execution + the convergence floor land in P4. Not startable in P2.`);
  }
  // Idempotency applies only to an ACTIVE lane: a duplicate request must not
  // double-start one that is still in_progress/interrupted. A CLOSED checkpoint
  // means that run finished, so the same phrase legitimately starts a fresh lane
  // (this also prevents a deterministic process()-derived id from permanently
  // aliasing later reruns to an old closed checkpoint).
  const existing = d.store.findByStartRequestId(startRequestId);
  if (existing && !isClosed(existing.lifecycle)) {
    if (existing.laneId !== laneId) throw new Error(`startLane: startRequestId "${startRequestId}" already maps to active lane "${existing.laneId}", not "${laneId}"`);
    return serveStep(existing, resolveLane(existing.laneId), context, d);
  }
  const ts = d.now();
  const cp: LaneCheckpoint = {
    schemaVersion: 1, checkpointId: d.newCheckpointId(), laneId, target,
    executionKind: l.executionKind, lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId,
    seenReportIds: [], createdAt: ts, updatedAt: ts,
  };
  d.store.write(cp);
  return serveStep(cp, l, context, d);
}

// helpers shared with advance (Task 5)
export { serveStep, resolveLane, closedResult };
export function pushAudit(cp: LaneCheckpoint, e: Omit<LaneAuditEntry, 'revision' | 'at'>, d: LaneRunnerDeps): void {
  cp.audit.push({ ...e, revision: cp.revision, at: d.now() });
}
```

- [ ] **Step 4.4: Run + register**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-start.test.ts` -> `lane-runner-start: OK`.
Add `{ rel: 'src/__tests__/lane-runner-start.test.ts', required: true },` to `SUITES`.

- [ ] **Step 4.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-start.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): startLane (sequence-only, loop rejected, idempotent, persisted serve)"
```

---

## Task 5: `advanceLane` - sequence completion (lifecycle/outcome)

**Files:** Modify `lane-runner.ts`; Test `lane-runner-advance-sequence.test.ts`

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
  let n = 0, t = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-adv-'));
  const d = deps(proj);
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d); // shape, craft, polish

  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', expectedRevision: 0 }, d); } catch { threw = true; }
  if (!threw) throw new Error('complete without report rejects');

  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 99 }, d); } catch { threw = true; }
  if (!threw) throw new Error('stale revision rejects');

  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), evidence: [] }, expectedRevision: 0 }, d); } catch { threw = true; }
  if (!threw) throw new Error('report with no evidence rejects');

  const r1 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 0 }, d);
  if (r1.currentVerb !== 'craft') throw new Error('advance to craft');
  if (r1.revision !== 1) throw new Error('revision bumps to 1');

  // duplicate reportId is a no-op (still craft) regardless of revision
  const dup = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 1 }, d);
  if (dup.currentVerb !== 'craft') throw new Error('duplicate reportId is no-op');

  // wrong stepId rejected
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: dup.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('mismatched stepId rejects');

  const r2 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dup.revision }, d);
  const r3 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: r2.revision }, d);
  if (r3.lifecycle !== 'closed' || r3.outcome !== 'completed') throw new Error('sequence with no skips closes completed');
  if (r3.currentVerb !== undefined) throw new Error('closed lane has no currentVerb');

  // advancing a closed lane rejects
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: r3.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('advancing a closed lane rejects');
  console.log('lane-runner-advance-sequence: OK');
}
run();
```

- [ ] **Step 5.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-advance-sequence.test.ts` -> FAIL `advanceLane is not a function`.

- [ ] **Step 5.3: Implement `advanceLane` (sequence path + completion)**

Add to `lane-runner.ts`:

```typescript
function bump(cp: LaneCheckpoint, d: LaneRunnerDeps): void {
  // Best-effort in-process guard: re-read the persisted revision and abort if it
  // moved since this checkpoint was loaded. True cross-process CAS (lease +
  // fencing token) is P3. `cp.revision` is the pre-bump value here; serveStep's
  // incremental writes do NOT bump revision, so the on-disk value still matches.
  if (d.store.exists(cp.checkpointId)) {
    const onDisk = d.store.read(cp.checkpointId);
    if (onDisk.revision !== cp.revision) throw new Error(`lane runner: concurrent modification (disk revision ${onDisk.revision} != in-memory ${cp.revision})`);
  }
  cp.revision += 1; cp.updatedAt = d.now(); d.store.write(cp);
}

// Advance the cursor after a completed/skipped step. Sequence final step closes
// the lane: outcome 'completed' if no step was skipped, else 'partial'. (Loop
// lanes never reach here - they are rejected at startLane in P2.)
async function advanceCursor(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult> {
  const last = l.verbSteps.length - 1;
  if (cp.cursor < last) { cp.cursor += 1; bump(cp, d); return serveStep(cp, l, context, d); }
  cp.lifecycle = 'closed';
  cp.outcome = cp.skippedStepIds.length > 0 ? 'partial' : 'completed';
  bump(cp, d);
  return closedResult(cp, l);
}

export async function advanceLane(projectPath: string, checkpointId: string, transition: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  const cp = d.store.read(checkpointId);
  const l = resolveLane(cp.laneId);

  // duplicate report -> no-op (before CAS, so a retried transport call is idempotent)
  if (transition.report && cp.seenReportIds.includes(transition.report.reportId)) return serveStep(cp, l, { projectPath }, d);

  // interrupted: ONLY resume is valid (spec 640-646). Checked before CAS so the
  // directive is returned regardless of revision drift.
  if (cp.lifecycle === 'interrupted' && transition.action !== 'resume') {
    throw new Error(`advanceLane: lane is interrupted - the only valid action is "resume" (got "${transition.action}")`);
  }
  if (cp.lifecycle === 'closed') throw new Error(`advanceLane: lane already closed (outcome ${cp.outcome})`);
  if (transition.expectedRevision !== cp.revision) throw new Error(`advanceLane: stale expectedRevision ${transition.expectedRevision} (current ${cp.revision})`);

  switch (transition.action) {
    case 'complete': {
      const r = transition.report;
      if (!r) throw new Error('advanceLane: complete requires a StepReport');
      if (!r.evidence || r.evidence.length < 1) throw new Error('advanceLane: StepReport needs >=1 evidence');
      const step = l.verbSteps[cp.cursor];
      if (r.stepId !== step.verb || r.iteration !== cp.iteration) throw new Error(`advanceLane: report (${r.stepId}/${r.iteration}) != current step (${step.verb}/${cp.iteration})`);
      cp.seenReportIds.push(r.reportId); cp.stepReports.push(r); cp.completedStepIds.push(step.verb);
      // Attest ONLY the flows that actually ran successfully this step (from the
      // served cache) - never blindly all step.flowIds. Degraded/skipped/errored
      // flows must not be promoted into completedFlowIds, or they would falsely
      // satisfy a later step's prerequisite (lane_ship's DAG-violating order).
      const succ = cp.servedSteps[`${cp.cursor}:${cp.iteration}`]?.successfulFlowIds ?? [];
      for (const f of succ) if (!cp.completedFlowIds.includes(f)) cp.completedFlowIds.push(f);
      pushAudit(cp, { action: 'complete', stepId: step.verb, iteration: cp.iteration, reportId: r.reportId }, d);
      return advanceCursor(cp, l, { projectPath }, d);
    }
    // retry / skip / interrupt / resume / stop -> Tasks 6 & 7
    default:
      return transitionNonComplete(cp, l, projectPath, transition, d);
  }
}
```

Add a stub for the non-complete transitions so the file compiles; Tasks 6-7 replace it:

```typescript
async function transitionNonComplete(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  throw new Error(`transitionNonComplete not implemented (Tasks 6-7): ${t.action}`);
}
```

- [ ] **Step 5.4: Run + register**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-advance-sequence.test.ts` -> `lane-runner-advance-sequence: OK`.
Add `{ rel: 'src/__tests__/lane-runner-advance-sequence.test.ts', required: true },` to `SUITES`.

- [ ] **Step 5.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): advanceLane completion (lifecycle/outcome, CAS, dedup, audit)"
```

---

## Task 6: Transitions - retry / interrupt / resume / stop (audited, no re-run)

**Files:** Modify `lane-runner.ts`; Test `lane-runner-transitions.test.ts`

- [ ] **Step 6.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-transitions.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, laneStatus, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, calls = 0;
  const d: any = { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId: any) => { calls++; return { flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [`g:${flowId}`], checklist: [] }; },
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
  d.calls = () => calls;
  return d;
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-trans-'));
  const d = deps(proj) as any;
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  const callsAfterStart = d.calls();

  // retry re-serves the SAME step from cache (no handler re-run), report optional but recorded
  const rt = await advanceLane(proj, start.checkpointId, { action: 'retry', expectedRevision: start.revision, reason: 'redo' }, d);
  if (rt.currentVerb !== 'shape') throw new Error('retry stays on shape');
  if (d.calls() !== callsAfterStart) throw new Error('retry must NOT re-run handlers (served cache)');

  // interrupt -> interrupted, no handler re-run, returns paused state
  const ir = await advanceLane(proj, start.checkpointId, { action: 'interrupt', expectedRevision: rt.revision }, d);
  if (ir.lifecycle !== 'interrupted' || ir.currentVerb !== undefined) throw new Error('interrupt -> interrupted/paused');
  if (d.calls() !== callsAfterStart) throw new Error('interrupt must not re-run handlers');

  // any non-resume action while interrupted is rejected
  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'retry', expectedRevision: ir.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('only resume valid while interrupted');

  // resume -> in_progress, re-serves shape from cache
  const rr = await advanceLane(proj, start.checkpointId, { action: 'resume', expectedRevision: ir.revision }, d);
  if (rr.lifecycle !== 'in_progress' || rr.currentVerb !== 'shape') throw new Error('resume -> in_progress on shape');
  if (d.calls() !== callsAfterStart) throw new Error('resume must not re-run handlers');

  // stop -> closed/stopped, audited
  const st = await advanceLane(proj, start.checkpointId, { action: 'stop', expectedRevision: rr.revision, reason: 'parking it' }, d);
  if (st.lifecycle !== 'closed' || st.outcome !== 'stopped') throw new Error('stop -> closed/stopped');
  const state = laneStatus(proj, start.checkpointId, d);
  if (!state.audit.some((a) => a.action === 'stop' && a.reason === 'parking it')) throw new Error('stop must be audited with reason');
  console.log('lane-runner-transitions: OK');
}
run();
```

- [ ] **Step 6.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-transitions.test.ts` -> FAIL (`transitionNonComplete not implemented` and `laneStatus` not yet present - Task 8 adds laneStatus; add a minimal `laneStatus` export now if needed, or land Task 8 first. The plan order is fine because Step 6.3 implements the transitions and Task 8 adds laneStatus; if running 6 before 8, temporarily import laneStatus will fail - so implement laneStatus in Task 8 and re-run this suite after Task 8. Mark this suite SKIP-until-8 in SUITES, flip to required in Task 8.)

Note: to keep TDD honest, register this suite as NON-required in Task 6 and flip to `required: true` in Task 8 (when `laneStatus` exists). The transition assertions (excluding the final `laneStatus` lines) still drive 6.3.

- [ ] **Step 6.3: Implement the non-complete transitions**

Replace `transitionNonComplete` in `lane-runner.ts`:

```typescript
async function transitionNonComplete(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  switch (t.action) {
    case 'retry': {
      if (t.report) { cp.stepReports.push(t.report); if (t.report.reportId) cp.seenReportIds.push(t.report.reportId); }
      pushAudit(cp, { action: 'retry', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration, reason: t.reason, reportId: t.report?.reportId }, d);
      bump(cp, d);
      return serveStep(cp, l, { projectPath }, d);     // served cache -> no handler re-run
    }
    case 'interrupt': {
      pushAudit(cp, { action: 'interrupt', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration, reason: t.reason }, d);
      cp.lifecycle = 'interrupted';
      bump(cp, d);
      return closedResult(cp, l);                       // paused state; NO serveStep
    }
    case 'resume': {
      if (cp.lifecycle !== 'interrupted') throw new Error('advanceLane: resume is only valid on an interrupted lane');
      cp.lifecycle = 'in_progress';
      pushAudit(cp, { action: 'resume', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration }, d);
      bump(cp, d);
      return serveStep(cp, l, { projectPath }, d);      // re-serve from cache
    }
    case 'stop': {
      pushAudit(cp, { action: 'stop', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration, reason: t.reason }, d);
      cp.lifecycle = 'closed'; cp.outcome = 'stopped';
      bump(cp, d);
      return closedResult(cp, l);
    }
    case 'skip':
      return skipStep(cp, l, projectPath, t, d);        // Task 7
    default:
      throw new Error(`advanceLane: unknown action "${(t as any).action}"`);
  }
}
```

Add a `skipStep` stub (Task 7 replaces it):

```typescript
async function skipStep(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  throw new Error('skipStep not implemented (Task 7)');
}
```

- [ ] **Step 6.4: Run (transition assertions)**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-transitions.test.ts`
Expected: passes through the transition assertions; the trailing `laneStatus` lines pass once Task 8 lands. Register NON-required for now: `{ rel: 'src/__tests__/lane-runner-transitions.test.ts' },`.

- [ ] **Step 6.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-transitions.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): retry/interrupt/resume/stop transitions (audited, no handler re-run)"
```

---

## Task 7: `skip` with REAL prerequisite safety

Uses `FlowPrerequisiteValidator.getDependencies()` (the real dependency graph), the lane's `prereqWaivers` as exact waived edges, and the checkpoint's `completedFlowIds`. A skip is rejected when skipping the current verb's flows would strand a later step's **required, unwaived, not-yet-completed** prerequisite.

**Files:** Modify `lane-runner.ts`; Test `lane-runner-skip-prereq.test.ts`

- [ ] **Step 7.1: Write the failing test (genuinely fails before impl)**

```typescript
// sidecoach/src/__tests__/lane-runner-skip-prereq.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-skip-'));
  const d = deps(proj);
  // lane_build verb 'shape' owns flowA_brand_verify; later flowF_design_tokens
  // REQUIRES flowA (flow-prerequisites.ts). Skipping shape must be REJECTED.
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision, reason: 'skip shape' }, d); }
  catch (e: any) { threw = /depend|prerequisite|flowA|strand/i.test(String(e.message)); }
  if (!threw) throw new Error('skipping shape must be rejected (flowF requires flowA)');

  // skip requires a reason
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('skip requires a reason');

  // A safe skip: complete shape+craft, then the LAST step (polish) has no
  // dependents, so skipping it is allowed and closes the lane 'partial'.
  let r = await advanceLane(proj, start.checkpointId, { action: 'complete', report: { stepId: 'shape', iteration: 0, reportId: 'r-shape', verb: 'shape', summary: 's', evidence: [{ kind: 'note', detail: 'x' }] }, expectedRevision: start.revision }, d);
  r = await advanceLane(proj, r.checkpointId, { action: 'complete', report: { stepId: 'craft', iteration: 0, reportId: 'r-craft', verb: 'craft', summary: 's', evidence: [{ kind: 'note', detail: 'x' }] }, expectedRevision: r.revision }, d);
  const skipped = await advanceLane(proj, r.checkpointId, { action: 'skip', expectedRevision: r.revision, reason: 'no polish needed' }, d);
  if (skipped.lifecycle !== 'closed' || skipped.outcome !== 'partial') throw new Error('skipping last step closes lane partial');
  console.log('lane-runner-skip-prereq: OK');
}
run();
```

- [ ] **Step 7.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-skip-prereq.test.ts` -> FAIL `skipStep not implemented (Task 7)`.

- [ ] **Step 7.3: Implement `skipStep`**

```typescript
import { FlowPrerequisiteValidator } from './flow-prerequisites';

// remaining (cursor+1..end) verb steps whose member flows have a REQUIRED
// prerequisite that is among the skipped flows, not already completed, and whose
// exact edge is not waived in the lane's prereqWaivers.
function strandedBySkipping(cp: LaneCheckpoint, l: GeneratedLane): string[] {
  const skipFlows = new Set(l.verbSteps[cp.cursor].flowIds);
  if (skipFlows.size === 0) return [];
  const completed = new Set(cp.completedFlowIds);
  const waived = new Set(l.prereqWaivers.map((w) => `${w.dependentFlowId}<-${w.prerequisiteFlowId}`));
  const blocked = new Set<string>();
  for (let i = cp.cursor + 1; i < l.verbSteps.length; i++) {
    const later = l.verbSteps[i];
    for (const depFlow of later.flowIds) {
      const deps = FlowPrerequisiteValidator.getDependencies(depFlow);
      if (!deps) continue;
      for (const p of deps.prerequisites) {
        if (!p.required) continue;
        if (skipFlows.has(p.flowId) && !completed.has(p.flowId) && !waived.has(`${depFlow}<-${p.flowId}`)) {
          blocked.add(later.verb);
        }
      }
    }
  }
  return [...blocked];
}

async function skipStep(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  if (!t.reason || !t.reason.trim()) throw new Error('advanceLane: skip requires a reason');
  const blocked = strandedBySkipping(cp, l);
  if (blocked.length > 0) {
    throw new Error(`advanceLane: cannot skip "${l.verbSteps[cp.cursor].verb}" - later steps require its prerequisites: ${blocked.join(', ')}. Complete it or stop the lane.`);
  }
  const step = l.verbSteps[cp.cursor];
  cp.skippedStepIds.push(step.verb);
  pushAudit(cp, { action: 'skip', stepId: step.verb, iteration: cp.iteration, reason: t.reason }, d);
  return advanceCursor(cp, l, { projectPath }, d);
}
```

- [ ] **Step 7.4: Run + register**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-skip-prereq.test.ts` -> `lane-runner-skip-prereq: OK`.
Add `{ rel: 'src/__tests__/lane-runner-skip-prereq.test.ts', required: true },` to `SUITES`.

- [ ] **Step 7.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-skip-prereq.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): skip with real prerequisite safety (getDependencies + waived edges)"
```

---

## Task 8: `laneStatus` + `listLanes(options?)`

**Files:** Modify `lane-runner.ts`; Test `lane-runner-status-list.test.ts`

- [ ] **Step 8.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-runner-status-list.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, laneStatus, listLanes, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-stat-'));
  const d = deps(proj);
  const a = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-a', d);
  const b = await startLane('lane_ship', 'site', { projectPath: proj }, 'req-b', d);
  await advanceLane(proj, b.checkpointId, { action: 'stop', expectedRevision: b.revision, reason: 'x' }, d); // close b

  const st = laneStatus(proj, a.checkpointId, d);
  if (st.laneId !== 'lane_build' || st.lifecycle !== 'in_progress') throw new Error('status wrong');
  if (st.totalSteps !== 3 || st.currentVerb !== 'shape') throw new Error('status step info wrong');

  // default: only active (in_progress/interrupted) lanes
  const active = listLanes(proj, d);
  if (active.length !== 1 || active[0].checkpointId !== a.checkpointId) throw new Error('default listLanes shows only active');
  // all: includes the closed one
  const all = listLanes(proj, d, { all: true });
  if (all.length !== 2) throw new Error('listLanes({all:true}) includes closed');
  console.log('lane-runner-status-list: OK');
}
run();
```

- [ ] **Step 8.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-runner-status-list.test.ts` -> FAIL `laneStatus is not a function`.

- [ ] **Step 8.3: Implement**

```typescript
export function laneStatus(projectPath: string, checkpointId: string, d: LaneRunnerDeps): LaneState {
  const cp = d.store.read(checkpointId);
  const l = resolveLane(cp.laneId);
  const step = cp.lifecycle === 'in_progress' && cp.cursor < l.verbSteps.length ? l.verbSteps[cp.cursor] : undefined;
  return {
    checkpointId: cp.checkpointId, laneId: cp.laneId, target: cp.target,
    lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: cp.executionKind,
    iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length, currentVerb: step?.verb,
    completedStepIds: [...cp.completedStepIds], skippedStepIds: [...cp.skippedStepIds], completedFlowIds: [...cp.completedFlowIds],
    stepReports: [...cp.stepReports], audit: [...cp.audit], revision: cp.revision, createdAt: cp.createdAt, updatedAt: cp.updatedAt,
  };
}

export function listLanes(projectPath: string, d: LaneRunnerDeps, options?: { all?: boolean }): LaneInfo[] {
  const all = !!options?.all;
  return d.store.list()
    .filter((s) => all || s.lifecycle === 'in_progress' || s.lifecycle === 'interrupted')
    .map((s) => { const l = resolveLane(s.laneId); return { checkpointId: s.checkpointId, laneId: s.laneId, lifecycle: s.lifecycle, outcome: s.outcome, stepIndex: s.cursor, totalSteps: l.verbSteps.length, updatedAt: s.updatedAt }; });
}
```

- [ ] **Step 8.4: Run + flip Task 6 suite to required**

Run both: `cd sidecoach && npx ts-node src/__tests__/lane-runner-status-list.test.ts && npx ts-node src/__tests__/lane-runner-transitions.test.ts`
Expected: both OK. Add `{ rel: 'src/__tests__/lane-runner-status-list.test.ts', required: true },` and flip the Task 6 entry to `required: true`.

- [ ] **Step 8.5: Commit**

```bash
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-runner-status-list.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): laneStatus + listLanes(options?{all})"
```

---

## Task 9: Engine methods (via `createExecutionEngine`, real handler dispatch)

The engine's `runFlow` reuses the SAME private path `process()` uses: enrich context, check `canExecute` (degraded guidance if not), then `execute`. So lane guidance matches normal flow guidance, and prerequisite/executability rules are honored.

**Files:** Modify `sidecoach-orchestrator.ts`; Test `lane-engine-methods.test.ts`

- [ ] **Step 9.1: Write the failing test**

```typescript
// sidecoach/src/__tests__/lane-engine-methods.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-eng-'));
  const engine = createExecutionEngine();               // factory registers handlers
  const res = await engine.startLane('lane_build', 'hero', { projectPath: proj }, 'req-1');
  if (res.laneId !== 'lane_build' || res.currentVerb !== 'shape') throw new Error('startLane via engine failed');
  if (!Array.isArray(res.guidance) || res.guidance.length === 0) throw new Error('engine must serve real guidance');
  const st = engine.laneStatus(proj, res.checkpointId);
  if (st.totalSteps !== 3) throw new Error('laneStatus via engine failed');
  if (engine.listLanes(proj).length !== 1) throw new Error('listLanes via engine failed');
  console.log('lane-engine-methods: OK');
}
run();
```

- [ ] **Step 9.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-engine-methods.test.ts` -> FAIL `engine.startLane is not a function`.

- [ ] **Step 9.3: Add the engine methods**

In `sidecoach-orchestrator.ts`, import and add methods to `FlowExecutionEngine`. Reuse the existing private `enrichContextForHandler` + the handler map. (Confirm the private method name at `:241` - it is `enrichContextForHandler`; if it differs, match the actual name.)

```typescript
import * as laneRunner from './lane-runner';
import { LaneCheckpointStore } from './lane-checkpoint-store';
import type { LaneTransition } from './lane-types';
import { FlowPrerequisiteValidator } from './flow-prerequisites';

// inside class FlowExecutionEngine:
private laneDeps(projectPath: string): laneRunner.LaneRunnerDeps {
  return {
    store: new LaneCheckpointStore(projectPath),
    runFlow: async (flowId, context) => {
      const handler = this.getHandlers().get(flowId);
      if (!handler) return { flowId, flowName: String(flowId), status: 'skipped', message: `no handler for ${flowId}`, guidance: [], checklist: [] };
      // Honor the REAL prerequisite graph (same posture as process():917-948):
      // treat the lane's waived edges for THIS flow as satisfied, then check
      // against the flows completed so far in this lane run.
      const completed: string[] = Array.isArray(context.completedFlowIds) ? context.completedFlowIds : [];
      const waivedForFlow = (Array.isArray(context.waivers) ? context.waivers : [])
        .filter((w: any) => w.dependentFlowId === flowId).map((w: any) => w.prerequisiteFlowId);
      const history = [...new Set<string>([...completed, ...waivedForFlow])].map((f) => ({ flowId: f, status: 'success' } as any));
      const prereq = FlowPrerequisiteValidator.canExecute(flowId, history);
      const enriched = this.enrichContextForHandler({ utterance: '', projectPath, ...context }, flowId);
      if (!prereq.canExecute || !handler.canExecute(enriched)) {
        const why = prereq.reason || 'context not fully ready';
        // degraded: coach, but do NOT let the model attest this flow's work as run
        return { flowId, flowName: String(flowId), status: 'needs_input', message: `coaching-only: ${flowId} (${why})`, guidance: [`(${flowId}) ${why} - coaching guidance only; this flow's work is not attested as done.`], checklist: [] };
      }
      // Mirror process()'s exception posture: a throwing handler degrades to an
      // 'error' result (NOT a success), so it is never attested into completedFlowIds.
      try {
        return await handler.execute(enriched);
      } catch (e) {
        return { flowId, flowName: String(flowId), status: 'error', message: `handler ${flowId} threw: ${(e as Error).message}`, guidance: [`(${flowId}) the flow handler errored; coaching only - not attested as done.`], checklist: [] };
      }
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
laneStatus(projectPath: string, checkpointId: string) { return laneRunner.laneStatus(projectPath, checkpointId, this.laneDeps(projectPath)); }
listLanes(projectPath: string, options?: { all?: boolean }) { return laneRunner.listLanes(projectPath, this.laneDeps(projectPath), options); }
```

(`Date.now()`/`Math.random()` are production-code-fine; tests inject deterministic versions via `laneDeps`-style stubs as in Tasks 4-8. If `enrichContextForHandler` is not accessible/typed for a synthetic context, add a small `laneGuidanceContext(flowId, ctx)` private wrapper rather than calling `execute` raw.)

- [ ] **Step 9.4: Run + register**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-engine-methods.test.ts` -> `lane-engine-methods: OK`.
Add `{ rel: 'src/__tests__/lane-engine-methods.test.ts', required: true },` to `SUITES`.

- [ ] **Step 9.5: Commit**

```bash
git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/lane-engine-methods.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): engine lane methods via createExecutionEngine (real handler dispatch)"
```

---

## Task 10: Wire `/sidecoach <phrase>` into `process()`

`resolveSidecoachInput` (router) + wiring into `process()` at the point right after the existing `parseSlashCommand` known-command branch, gated to `^/sidecoach\s+(.+)$`. Bare `/sidecoach` and empty input already hit `showInteractiveMenu` (orchestrator:664) - that stays. Non-`/sidecoach` utterances are untouched (they fall through to intent detection as today).

**Files:** Modify `slash-command-router.ts`, `sidecoach-orchestrator.ts`; Test `slash-phrase-wiring.test.ts`

- [ ] **Step 10.1: Write the failing test (through `process()`)**

```typescript
// sidecoach/src/__tests__/slash-phrase-wiring.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-wire-'));
  const engine = createExecutionEngine();
  const ctx = { projectPath: proj, userId: 'test' };

  // ROUTE phrase -> a lane is actually STARTED through process()
  const routed: any = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', ctx);
  if (!routed.lane || !routed.lane.checkpointId) throw new Error('ROUTE phrase must start a lane via process()');
  if (routed.lane.currentVerb !== 'shape') throw new Error('started lane should be on its first verb');

  // OUT_OF_SCOPE phrase -> refusal, NOT a lane. NB: the first word must NOT be a
  // known verb/phase command ("optimize"/"migrate" ARE commands and would route
  // before phrase classification). Use a backend phrase opening with a
  // non-command word that trips a negative_filter.
  const oos: any = await engine.process('/sidecoach the postgres query planner keeps picking bad indexes', ctx);
  if (oos.lane) throw new Error('backend phrase must not start a lane');
  if (!/UI|design|scope/i.test(oos.message || '')) throw new Error('OUT_OF_SCOPE should explain the scope');

  // typo -> near-miss suggestion, no lane
  const typo: any = await engine.process('/sidecoach polsih', ctx);
  if (typo.lane) throw new Error('typo must not start a lane');
  if (!/did you mean/i.test(typo.message || '')) throw new Error('typo should suggest');

  // bare /sidecoach still shows the menu (unchanged)
  const menu: any = await engine.process('/sidecoach', ctx);
  if (menu.lane) throw new Error('bare /sidecoach must not start a lane');

  // a known verb still routes via parseSlashCommand (not the phrase path)
  const known: any = await engine.process('/sidecoach polish', ctx);
  if (known.lane) throw new Error('known verb must use the command path, not phrase routing');

  // CLASSIFY confirm-to-start round trip: a murky phrase surfaces a candidate,
  // and confirming it (calling startLane with classify.laneId - the SAME
  // terminal path as ROUTE) actually starts the lane. IMPLEMENTER: pick a phrase
  // that the live classifier returns CLASSIFY for by running it (score >=
  // classify_floor but not route-grade); do NOT guess. A reasonable starting
  // candidate is a single mild design word with no strong routing signal.
  const murky: any = await engine.process('/sidecoach make it nicer', ctx);
  if (murky.classify) {
    if (!murky.classify.laneId) throw new Error('CLASSIFY must surface a candidate laneId');
    const confirmed = await engine.startLane(murky.classify.laneId, 'confirmed via interview', { projectPath: proj }, 'confirm-1');
    if (confirmed.lifecycle !== 'in_progress' || !confirmed.currentVerb) throw new Error('confirming a CLASSIFY candidate must start the lane (same path as ROUTE)');
  } else {
    // if 'make it nicer' did not classify, the implementer MUST substitute a
    // verified-CLASSIFY phrase here - this branch must not silently pass.
    throw new Error('CLASSIFY round-trip not exercised: substitute a phrase the classifier returns CLASSIFY for');
  }
  console.log('slash-phrase-wiring: OK');
}
run();
```

- [ ] **Step 10.2: Run, verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/slash-phrase-wiring.test.ts` -> FAIL (`routed.lane` undefined - phrase not wired).

- [ ] **Step 10.3: Add `resolveSidecoachInput` to the router**

Append to `slash-command-router.ts`:

```typescript
export interface SidecoachInputResolution {
  source: 'command' | 'phrase' | 'not-addressed';
  command?: CommandMatch;
  phrase?: PhraseResolution;
}

const SIDECOACH_PHRASE_RE = /^\/sidecoach\s+(.+)$/i;

// Live entrypoint. Known verbs/phase commands keep their exact parseSlashCommand
// behavior. Only a `/sidecoach <phrase>` that is NOT a known command resolves via
// the classifier. Anything not /sidecoach-addressed (or bare /sidecoach) returns
// 'not-addressed' so the caller preserves existing behavior (menu / intent tier).
export function resolveSidecoachInput(utterance: string, lanesPath: string): SidecoachInputResolution {
  const cmd = parseSlashCommand(utterance);
  if (cmd.isCommand) return { source: 'command', command: cmd };
  const m = utterance.trim().match(SIDECOACH_PHRASE_RE);
  if (!m) return { source: 'not-addressed' };
  return { source: 'phrase', phrase: resolveSidecoachPhrase(m[1].trim(), lanesPath) };
}
```

- [ ] **Step 10.4: Wire into `process()`**

In `sidecoach-orchestrator.ts`, right AFTER the `if (commandMatch.isCommand) { ... }` block (the long block ending before the intent-detection fall-through), insert phrase handling. Import `resolveSidecoachInput` and the lanes path resolver:

```typescript
import { resolveSidecoachInput } from './slash-command-router';
import { LANES } from './lanes.generated';
import * as path from 'path';
import { createHash } from 'crypto';

// module-level helper: deterministic start-request id from phrase + project so a
// literal retry of the same phrase does not create a second lane.
function laneStartRequestId(utterance: string, projectPath: string): string {
  return 'proc-' + createHash('sha256').update(`${projectPath}\n${utterance.trim()}`).digest('hex').slice(0, 24);
}

// after the commandMatch.isCommand block, before intent detection:
const laneResolution = resolveSidecoachInput(utterance, path.resolve(__dirname, '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json'));
if (laneResolution.source === 'phrase' && laneResolution.phrase) {
  const pr = laneResolution.phrase;
  if (pr.kind === 'ROUTE' && pr.lane) {
    // deterministic id: a literal retry of the same phrase+project does NOT
    // double-start (startLane dedups on startRequestId).
    const startReq = laneStartRequestId(utterance, projectPath);
    const lane = await this.startLane(pr.lane, utterance, { projectPath, userId: context.userId, metadata: context.metadata }, startReq);
    return { success: true, message: `Routed to ${lane.laneLabel}: ${lane.message}`, detectedFlow: null, flowResults: [], guidance: lane.guidance, checklist: lane.checklist, lane };
  }
  if (pr.kind === 'CLASSIFY' && pr.lane) {
    // One-question interview: surface the candidate so the model can confirm.
    // Confirmation dispatches IDENTICALLY to ROUTE - the model calls
    // engine.startLane(classify.laneId, ...), the same terminal path ROUTE uses.
    // (The AskUserQuestion surface itself is a P4 hook/MCP concern; P2 exposes
    // the candidate + the dispatch path so CLASSIFY is not a dead end.)
    const cand = LANES.find((l) => l.lane === pr.lane);
    return { success: true, message: `That reads like the "${cand?.interviewLabel ?? pr.lane}" direction. Confirm to start it, or rephrase for a different lane.`, detectedFlow: null, flowResults: [], guidance: [], checklist: [], classify: { laneId: pr.lane, label: cand?.label ?? pr.lane, interviewLabel: cand?.interviewLabel ?? pr.lane } };
  }
  if (pr.kind === 'OUT_OF_SCOPE') {
    return { success: true, message: pr.redirect || 'That reads as non-UI work. Sidecoach covers UI/design only.', detectedFlow: null, flowResults: [], guidance: [], checklist: [] };
  }
  // UNKNOWN
  return { success: true, message: pr.suggestion ? `Unrecognized - ${pr.suggestion}` : 'Unrecognized /sidecoach phrase.', detectedFlow: null, flowResults: [], guidance: [], checklist: [] };
}
```

Add OPTIONAL fields to the `SidecoachResult` interface (`sidecoach-orchestrator.ts:1629`), importing the type:

```typescript
import type { LaneStepResult } from './lane-types';
// in SidecoachResult:
lane?: LaneStepResult;
classify?: { laneId: string; label: string; interviewLabel: string };
```

- [ ] **Step 10.5: Run + register**

Run: `cd sidecoach && npx ts-node src/__tests__/slash-phrase-wiring.test.ts` -> `slash-phrase-wiring: OK`.
Add `{ rel: 'src/__tests__/slash-phrase-wiring.test.ts', required: true },` to `SUITES`.
(If the OUT_OF_SCOPE phrase doesn't trip a negative filter, pick a phrase that matches a real `negative_filter` in `sidecoach-lanes.json` rather than weakening the assertion.)

- [ ] **Step 10.6: Commit**

```bash
git add sidecoach/src/slash-command-router.ts sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/slash-phrase-wiring.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): wire /sidecoach <phrase> into process() (ROUTE starts a lane)"
```

---

## Task 11: Monitor CLI lane subcommands (spec flags, factory engine)

**Files:** Modify `bin/sidecoach-monitor.js`; Test `lane-cli.test.ts`

- [ ] **Step 11.1: Write the failing test (real child process, after build)**

```typescript
// sidecoach/src/__tests__/lane-cli.test.ts
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const MONITOR = path.join(__dirname, '..', '..', 'bin', 'sidecoach-monitor.js');
function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-cli-'));
  const start = execFileSync('node', [MONITOR, 'lane', 'start', '--lane', 'lane_build', '--project', proj, '--target', 'hero', '--start-request-id', 'cli-1'], { encoding: 'utf8' });
  const startObj = JSON.parse(start);
  if (startObj.laneId !== 'lane_build' || startObj.currentVerb !== 'shape') throw new Error('CLI start failed');
  const list = JSON.parse(execFileSync('node', [MONITOR, 'lane', 'list', '--project', proj], { encoding: 'utf8' }));
  if (!Array.isArray(list) || list.length !== 1) throw new Error('CLI list failed');
  const status = JSON.parse(execFileSync('node', [MONITOR, 'lane', 'status', '--project', proj, '--checkpoint', startObj.checkpointId], { encoding: 'utf8' }));
  if (status.lifecycle !== 'in_progress') throw new Error('CLI status failed');
  console.log('lane-cli: OK');
}
run();
```

- [ ] **Step 11.2: Read the monitor, then implement the `lane` branch**

Confirm: `bin/sidecoach-monitor.js:14-15` requires `createExecutionEngine` from `../dist/sidecoach-orchestrator`; `main()` reads `process.argv[2]` as the utterance. Add a `lane` branch at the TOP of `main()`, before the utterance logic:

```javascript
const sub = process.argv[2];
if (sub === 'lane') {
  const args = process.argv.slice(3);
  const op = args[0];
  const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt; };
  const project = flag('--project', process.cwd());
  const engine = createExecutionEngine();
  try {
    let result;
    if (op === 'start') {
      result = await engine.startLane(flag('--lane'), flag('--target', ''), { projectPath: project }, flag('--start-request-id', `cli-${process.pid}-${Date.now()}`));
    } else if (op === 'advance') {
      const transition = { action: flag('--action', 'complete'), expectedRevision: Number(flag('--revision', '0')) };
      // --report inline OR --report-file <path> (spec 790: file input). File path
      // is read, size-capped, and the same shape validation applies to both.
      const reportFile = flag('--report-file', '');
      let reportRaw = flag('--report', '');
      if (reportFile) { try { reportRaw = require('fs').readFileSync(reportFile, 'utf8'); } catch (e) { console.error(`--report-file unreadable: ${reportFile}`); process.exit(2); } }
      if (reportRaw) {
        if (reportRaw.length > 64 * 1024) { console.error('--report exceeds 64KB cap'); process.exit(2); }
        let parsed; try { parsed = JSON.parse(reportRaw); } catch { console.error('--report is not valid JSON'); process.exit(2); }
        const okEvidence = Array.isArray(parsed && parsed.evidence) && parsed.evidence.length >= 1 &&
          parsed.evidence.every((ev) => ev && typeof ev.kind === 'string' && typeof ev.detail === 'string');
        if (!parsed || typeof parsed.stepId !== 'string' || typeof parsed.reportId !== 'string' || typeof parsed.verb !== 'string' ||
            typeof parsed.summary !== 'string' || typeof parsed.iteration !== 'number' || !okEvidence) {
          console.error('--report must be a StepReport: stepId, reportId, verb, summary (strings), iteration (number), evidence[>=1] of {kind,detail} strings'); process.exit(2);
        }
        transition.report = parsed;
      }
      const reason = flag('--reason', ''); if (reason) transition.reason = reason;
      result = await engine.advanceLane(project, flag('--checkpoint'), transition);
    } else if (op === 'status') {
      result = engine.laneStatus(project, flag('--checkpoint'));
    } else if (op === 'list') {
      result = engine.listLanes(project, { all: args.includes('--all') });
    } else {
      console.error('usage: sidecoach-monitor lane <start|advance|status|list> [--lane --project --target --start-request-id --checkpoint --action --revision --report --reason --all]');
      process.exit(2);
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) { console.error(String((e && e.message) || e)); process.exit(1); }
}
```

(Place this inside `main()` before the `let utterance = process.argv[2]` line, and ensure `main()` is `async` - it already is.)

- [ ] **Step 11.3: Build, then run**

Run: `cd sidecoach && npm run build && npx ts-node src/__tests__/lane-cli.test.ts`
Expected: build exit 0; `lane-cli: OK`. The CLI runs from `dist/`, so this suite REQUIRES a prior build - the integration runner (Task 13) always builds before `npm test`.

- [ ] **Step 11.4: Register + commit**

Add `{ rel: 'src/__tests__/lane-cli.test.ts', required: true },` to `SUITES`.

```bash
git add sidecoach/bin/sidecoach-monitor.js sidecoach/src/__tests__/lane-cli.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p2): monitor CLI lane subcommands (spec flags, createExecutionEngine)"
```

---

## Task 12: End-to-end through `process()` (routed sequence -> completed)

**Files:** Test `lane-execution-e2e.test.ts`

- [ ] **Step 12.1: Write the test**

```typescript
// sidecoach/src/__tests__/lane-execution-e2e.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';
import { StepReport } from '../lane-types';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-e2e-'));
  const engine = createExecutionEngine();
  const routed: any = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', { projectPath: proj, userId: 't' });
  if (!routed.lane) throw new Error('phrase did not start a lane through process()');
  let step = routed.lane;
  let guard = 0;
  while (step.lifecycle === 'in_progress' && guard++ < 50) {
    const verb = step.currentVerb;
    const rep: StepReport = { stepId: verb, iteration: step.iteration, reportId: `e2e:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] };
    step = await engine.advanceLane(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision });
  }
  if (step.lifecycle !== 'closed' || step.outcome !== 'completed') throw new Error(`routed sequence lane must finish completed (got ${step.lifecycle}/${step.outcome})`);
  console.log('lane-execution-e2e: OK');
}
run();
```

- [ ] **Step 12.2: Run + register + commit**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-execution-e2e.test.ts` -> `lane-execution-e2e: OK`.
Add `{ rel: 'src/__tests__/lane-execution-e2e.test.ts', required: true },` to `SUITES`.

```bash
git add sidecoach/src/__tests__/lane-execution-e2e.test.ts sidecoach/scripts/run-tests.ts
git commit -m "test(lane-p2): e2e /sidecoach phrase -> routed sequence lane -> completed"
```

---

## Task 13: Final integration + scope check

- [ ] **Step 13.1: Full surface**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node scripts/generate-lanes.ts --check     # no drift
npm run build                                       # exit 0 (CLI needs dist)
npm test                                            # all SUITES required:true pass
```
Expected: `--check` exit 0; build exit 0; `run-tests: N suite(s) passed` with EVERY new lane suite present (lane-types, lane-checkpoint-store, lane-runner-start/advance-sequence/transitions/skip-prereq/status-list, lane-engine-methods, slash-phrase-wiring, lane-cli, lane-execution-e2e). A SKIP line for any of these means it was never registered required - fix it.

- [ ] **Step 13.2: P1 hook surface still green (untouched)**

```bash
cd /Users/spare3/Documents/Github/improv && bash claude/hooks/test-sidecoach-keyword.sh && python3 claude/hooks/test_sidecoach_lanes.py
```
Expected: `110 passed, 0 failed`; `35 passed, 0 failed`.

- [ ] **Step 13.3: Deferral + worktree scope check**

```bash
cd /Users/spare3/Documents/Github/improv
# no P3/P4 work leaked in:
git diff --name-only main..lane-p2-execution | grep -E 'modes\.ts|ralph-loop|mcp-server/|product-rule-registry|flow-validation-capabilities|convergence-loop' && echo "LEAK - revert" || echo "no deferred-scope leak"
# this plan added nothing to the pre-existing dirty set:
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p2-now-dirty.txt
diff /tmp/lane-p2-preexisting-dirty.txt /tmp/lane-p2-now-dirty.txt && echo "worktree dirty set unchanged" || echo "REVIEW: dirty set changed (expected: only committed files differ)"
```

- [ ] **Step 13.4: Final commit (owned files only - NO `git add -A`)**

```bash
# stage ONLY files this plan owns; never `git add -A` (the worktree has unrelated drift)
git add sidecoach/src/lane-*.ts sidecoach/src/__tests__/lane-*.test.ts sidecoach/src/__tests__/slash-phrase-wiring.test.ts \
        sidecoach/src/lanes.generated.ts sidecoach/src/lane-derivation.ts sidecoach/scripts/generate-lanes.ts \
        sidecoach/src/slash-command-router.ts sidecoach/src/sidecoach-orchestrator.ts sidecoach/bin/sidecoach-monitor.js \
        sidecoach/scripts/run-tests.ts
git commit -m "chore(lane-p2): final integration green" || echo "nothing to commit"
```

---

## Deferred to later phases (unchanged from v1 scope intent)

**P3 - durability:** leases/`operationId`/fencing, side-effect outbox, checkpoint schema migration, `AbortSignal`. (P2 has in-process idempotency + persisted serve only.)

**P4 - validators, loops, MCP, cleanup:** `product-rule-registry.ts` + `flow-validation-capabilities.ts` + validator gating; **loop execution + `lane_converge` + the convergence floor** (P2 rejects starting loop lanes); `ralph-loop.ts` -> `convergence-loop.ts`; MCP `classify-intent`/`list-lanes`/`sidecoach_lane`; `modes.ts`/`dist` deletion; SKILL/CHEATSHEET/marketing regen.

---

## Self-Review (v3)

**v2-review closures (Codex `task-mqctksof`):** P0-a prereq-aware degraded dispatch (Task 9 `runFlow` now USES `FlowPrerequisiteValidator` + waived edges); P0-b honest best-effort revision guard, true CAS labeled P3 (Task 5 `bump` re-read); P0-c pure-guidance handlers + resumable incremental persist (Task 4 `serveStep`); P1-d CLASSIFY surfaces candidate + dispatches via `startLane` like ROUTE (Task 10); P1-e deterministic `startRequestId` from `hash(utterance+project)` (Task 10); P1-f CLI `--report` size-cap + shape-validate (Task 11); P1-g `startRequestId` validated/capped (Task 4); P1-9 genuine realpath after ensure-exists (Task 3); P2-h OUT_OF_SCOPE test uses a non-command phrase (Task 10). P0-6 and P1-9 (the two v2 still-opens) close here.

**v1-review closures:** P0-1 lifecycle/outcome (Task 1, used everywhere); P0-2 empty-flow steps (Task 2); P0-3 live wiring through `process()` + tested through it (Task 10); P0-4 real `FlowPrerequisiteValidator` + failing unsafe-skip test (Task 7); P0-5 interrupt = resume-only, no re-run (Task 6); P0-6 persisted serve + enrich/canExecute dispatch (Tasks 4, 9); P0-7 loop lanes rejected, sequence closes completed/partial (Tasks 4, 5). P1-8 audit log (every transition, Tasks 5-7); P1-9 id validation + realpath (Task 3); P1-10 `listLanes(options?)` (Task 8); P1-11 start-request lane-mismatch reject (Task 4); P1-12 spec CLI flags + factory (Task 11); P1-13 explicit `SUITES` required registration (every task); P1-14 phrase gated to `^/sidecoach\s+(.+)$` + bare-`/sidecoach` menu preserved (Task 10); P1-15 no `git add -A` + cleanliness check (Tasks 0.1, 13). P2-16 lane_calm is sequence (Task 2 scope); P2-17 e2e requires completed (Task 12).

**Placeholder scan:** all code concrete. Two intentional stubs (`transitionNonComplete` Task 5 -> Task 6; `skipStep` Task 6 -> Task 7) throw with task-naming messages and are replaced in the very next task.

**Type consistency:** lifecycle/outcome types defined once (Task 1) and used in `LaneCheckpoint`, runner, engine, CLI, e2e. `verbSteps {verb,flowIds,guidance}` consistent generator->runner. Engine uses `createExecutionEngine` in every caller (Tasks 9, 11, 12).

**Residual flags (Codex-adjudicated):** (1) `enrichContextForHandler` confirmed to exist at `sidecoach-orchestrator.ts:507-510` with a compatible signature - callable from the new engine methods. (2) CLASSIFY is no longer a dead end: it surfaces the candidate lane and the model confirms by calling `engine.startLane(classify.laneId, ...)` - the same terminal path as ROUTE; the AskUserQuestion interview UI remains a P4 hook/MCP concern. (3) The additive `lane?`/`classify?` fields on `SidecoachResult` are safe - no consumer asserts exact key sets, and `CommandRoutingAdapter` preserves unknown fields via object spread (`command-routing-adapter.ts:113-116`).

**Known P2 limitations (intentional, documented for the implementer):** the in-process revision guard is best-effort, not a hard CAS (true cross-process safety = P3); some lane flow sequences violate the prerequisite DAG (a P1 derivation artifact) and are handled at runtime by degraded coaching-only guidance - generator-level sequence/prereq validation is a P4 note.
