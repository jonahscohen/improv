# Lane P4b-1 - Sequence-Lane Validator Gating + Async Execution Durability - v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Every task is failing-test-first, then real implementation, then exact verify commands, then a commit. Do NOT batch tasks. Do NOT weaken a test to make it pass.

## Goal

Make SEQUENCE lanes GATE on their product validators during `advanceLane`, and run those validators as ASYNC work protected by the operation-lease durability protocol. This folds two previously-separate designs into one phase, because the async validators are exactly what gives the durability machinery a purpose:

- **(A) Validator gating** (spec section 7, lines 322-365). At a sequence step's completion, run every product validator BOUND to that step's flow(s), aggregate their statuses worst-wins, and map the result deterministically: `clean` -> completion proceeds; `findings` -> `validation_failed` (step stays current, findings returned); `inconclusive` -> `validation_inconclusive` (step stays current); `error` -> `validation_error` (step stays current). Only an explicit user `skip` or `stop` bypasses an unclean / inconclusive / errored required step (recorded with its reason).
- **(B) Async durability** (spec section 7, lines 651-735; checkpoint schema v2 line 770). Wrap the now-ASYNC `advanceLane` in the operation-lease protocol: CLAIM (O_EXCL lock, expectedRevision check, write a lease, bump revision, release the lock) -> EXECUTE the async validators under an AbortSignal derived from the lease, refreshing `heartbeatAt`, collecting side effects in an operation-local buffer (NOT writing them yet) -> FINALIZE (O_EXCL lock, verify the SAME full lease identity still owns, write the step result + a side-effect outbox record keyed by `(checkpointId, committedRevision)` carrying the `fencingToken`, clear the lease, bump revision) -> PUBLISH the outbox idempotently (the downstream sink conditionally upserts by fencing token).

**The guarantee is AT-MOST-ONE COMMITTED LANE TRANSITION, not exactly-once execution** (spec line 696). Two bodies may overlap; the lease fences which RESULT commits. `interrupt` / `stop` are priority transitions that fence a live lease, bump the token, and signal the in-process AbortController. A second ordinary advance finding a live lease (fresh heartbeat) is REJECTED; a stale lease (dead heartbeat) is reclaimable and logged.

## Architecture

P2 left a `bump()` re-read as a best-effort in-process guard and a SYNCHRONOUS `advanceLane`. P3 (designed in `2026-06-13-lane-p3-durability.md`, never executed) added the lock + lease + fencing + schema-v2 against a synchronous EXECUTE body. P4b-1 BUILDS that P3 durability AND fills the EXECUTE body with the real async validators, so:

- `LaneCheckpoint` migrates v1 -> v2 (adds `fencingCounter`, `lease`, and a typed `sideEffectOutbox`).
- `advanceLane`'s mutating actions (`complete`, `skip`) run CLAIM / EXECUTE / FINALIZE under an O_EXCL file lock. The lock guards CLAIM and FINALIZE only; the async EXECUTE runs WITHOUT a held file lock, marked in-flight by the persisted lease.
- `complete` discovers the step's bound validators (union over `step.flowIds` via `FLOW_CAPABILITIES`), runs each async `validateProduct` under a composed AbortSignal with heartbeat refresh, aggregates worst-status, and either commits (clean) or releases the lease without advancing (unclean), with the validation result returned.
- Committed side effects publish only from the FINALIZE-written outbox record, through a dedicated fencing-token-conditional `LaneSideEffectSink`. Replay after a crash is idempotent.
- `interrupt` / `stop` fence a live lease and abort the in-process controller; `resume` / `retry` are rejected over a live lease (only priority controls supersede it).

**Why fold P3 into P4b-1.** P3's lease/outbox/heartbeat/AbortSignal machinery is untestable when the EXECUTE body is synchronous (it protects nothing). The async validators introduce the long EXECUTE body and the real side effect to protect, so the durability is built here, where it has teeth, reusing P3's already-Codex-reviewed lock / lease / fencing / schema-v2 design verbatim.

## Scope discipline (P4b-1 ONLY)

BUILD: sequence-lane validator gating + the full lease / lock / fencing / schema-v2 / outbox / AbortSignal durability for the async EXECUTE.

DO NOT BUILD (later phases):
- Loop execution, `lane_converge` enablement, the convergence release-floor (P4c). Loop lanes stay REJECTED at `startLane` exactly as P2 left them.
- The browser-evidence collector (P4b-2). Browser-only validator rules (evidence `dom` / `computed-style` / `contrast`) keep returning `inconclusive` from their `checkProduct`; because they are NON-required (not in any static validator's `requiredRuleIds` after the P4a partial-static floor), they do NOT force a validator's overall status to `inconclusive` and therefore do NOT block gating. P4b-1 changes nothing about which rules are required.
- The MCP migration / transport-timeout signal composition (P4d). In P4b-1 the composed AbortSignal covers lease-ownership-loss + in-process priority cancellation only; transport-timeout composition is P4d (the MCP server does not propagate a signal today, spec lines 724-726).
- Copy gating (P4e).

## Tech Stack

TypeScript (`sidecoach/src/`), `fs` O_EXCL locking, the ts-node SUITES runner `sidecoach/scripts/run-tests.ts` (explicit `required: true`). Production code MAY use `Date.now()` / `Math.random()` / `process.hrtime` (banned only in workflow scripts; test modules inject deterministic clocks).

---

## File Structure

**Create:**
- `sidecoach/src/lane-lock.ts` - `withCheckpointLock(dir, checkpointId, fn, opts?)`: O_EXCL lockfile acquire/release with stale-lock reclaim. Guards CLAIM and FINALIZE only (NOT the async EXECUTE).
- `sidecoach/src/lane-validators.ts` - pure helpers: `validatorsForStep(step)` (FLOW_CAPABILITIES discovery), `aggregateWorstStatus(results)`, `mapGateStatusToOutcome(status)`.
- `sidecoach/src/lane-side-effect-sink.ts` - `LaneSideEffectSink`: fencing-token-conditional upsert store (the outbox's downstream publisher).
- Tests: `sidecoach/src/__tests__/lane-checkpoint-migration.test.ts`, `lane-lock.test.ts`, `lane-lease.test.ts`, `lane-validator-gating.test.ts`, `lane-runner-concurrency.test.ts`, `lane-side-effect-outbox.test.ts`.

**Modify:**
- `sidecoach/src/lane-types.ts` - add `LeaseRecord`, `SideEffectEntry`, `SideEffectOutboxRecord`; extend `LaneStepResult` with an optional `gate` field and the three `validation_*` step statuses.
- `sidecoach/src/lane-checkpoint-store.ts` - schema v2 (`fencingCounter`, `lease`, `sideEffectOutbox`), v1 -> v2 read migration, write asserts v2, make `dir()` public, add `claimLease` / `finalizeLease` / `leaseIsLive` / `refreshHeartbeat` / `publishOutbox`.
- `sidecoach/src/lane-runner.ts` - async `advanceLane` CLAIM/EXECUTE/FINALIZE; validator gating on `complete`; lease-fencing on `interrupt`/`stop`; live-lease rejection of ordinary transitions; `serveStep` persistence under the lock; new deps (`newOperationId`, `runValidator`, optional `__claimBarrier`, `staleMs`).
- `sidecoach/src/validators/run-validator.ts` - `makeProductValidator` returns an ASYNC `validateProduct(context, signal?) => Promise<ProductValidationResult>` with cooperative abort.
- `sidecoach/src/flow-validation-capabilities.ts` - `ProductValidatorRegistration.validateProduct` retyped async.
- `sidecoach/src/sidecoach-orchestrator.ts` - `laneDeps` supplies `newOperationId` + `runValidator` (wired to the registrations) + a deterministic clock passthrough.
- `sidecoach/src/__tests__/product-validator-pipeline.test.ts`, `validator-fixtures-e2e.test.ts` - `await` the now-async `validateProduct` (contract-change fixups in the same task).
- `sidecoach/src/__tests__/lane-checkpoint-store.test.ts` - write a v2 literal, expect v3 rejection (was v1 -> expect-v2-rejection).
- `sidecoach/scripts/run-tests.ts` - register every new suite `required: true`.

**Read-only references:** spec lines 270-365 (execution + gating), 651-735 (lease protocol), 765-789 (schema v2). The P3 plan `2026-06-13-lane-p3-durability.md` (lock / lease / fencing source to reuse verbatim).

---

## Setup

- [ ] **Step 0.1: Branch + dirty snapshot**

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p4b1-validator-execution-durability
git branch --show-current
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p4b1-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green** - `cd sidecoach && npm run build && npm test` gives build exit 0 and `run-tests: 27 suite(s) passed`. If red, STOP and report; do not build on a red baseline.

---

## Task 1: Schema v2 (fencingCounter, lease, typed sideEffectOutbox) + v1 -> v2 migration

**Files:** Modify `lane-types.ts`, `lane-checkpoint-store.ts`, `lane-runner.ts` (startLane v2 creation), `lane-checkpoint-store.test.ts`; Create `lane-checkpoint-migration.test.ts`.

- [ ] **Step 1.1: Failing test (migration round-trip)**

```typescript
// sidecoach/src/__tests__/lane-checkpoint-migration.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';

function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-mig-')));
  const dir = path.join(proj, '.claude', 'lane-checkpoints');
  fs.mkdirSync(dir, { recursive: true });
  const v1 = { schemaVersion: 1, checkpointId: 'lane-legacy', laneId: 'lane_build', target: 't',
    executionKind: 'sequence', lifecycle: 'in_progress', cursor: 0, iteration: 0,
    completedStepIds: [], skippedStepIds: [], completedFlowIds: [], stepReports: [], audit: [],
    servedSteps: {}, revision: 3, startRequestId: 'r', seenReportIds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
  fs.writeFileSync(path.join(dir, 'lane-legacy.json'), JSON.stringify(v1));

  const store = new LaneCheckpointStore(proj);
  const cp = store.read('lane-legacy');
  if (cp.schemaVersion !== 2) throw new Error('read must migrate v1 to v2');
  if (cp.fencingCounter !== 0) throw new Error('migration seeds fencingCounter 0');
  if (cp.lease !== null) throw new Error('migration seeds lease null');
  if (!Array.isArray(cp.sideEffectOutbox) || cp.sideEffectOutbox.length !== 0) throw new Error('migration seeds sideEffectOutbox []');
  if (cp.revision !== 3) throw new Error('migration preserves state');

  store.write(cp);
  const back = store.read('lane-legacy');
  if (back.schemaVersion !== 2 || back.fencingCounter !== 0) throw new Error('v2 round-trip failed');
  console.log('lane-checkpoint-migration: OK');
}
run();
```

- [ ] **Step 1.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-checkpoint-migration.test.ts` fails (`schemaVersion` is 1, no `fencingCounter`).

- [ ] **Step 1.3: Add types to `lane-types.ts`**

```typescript
// append to sidecoach/src/lane-types.ts
export interface LeaseRecord {
  operationId: string;
  stepId: string;
  iteration: number;
  claimedCheckpointRevision: number;
  fencingToken: number;
  startedAt: string;
  heartbeatAt: string;
}

// One side-effect entry inside an outbox bundle. publisher + entryIndex give a
// stable replay key; logicalKey is the downstream conditional-upsert key.
export interface SideEffectEntry {
  publisher: string;          // logical downstream store id, e.g. 'lane-side-effect-sink'
  entryIndex: number;         // stable index within this bundle
  logicalKey: string;         // downstream upsert key, e.g. `${checkpointId}:${stepId}:${iteration}`
  payload: unknown;           // the side-effect content (P4b-1: a step-completion summary)
}

// Written at FINALIZE, keyed by (checkpointId, committedRevision), carrying the
// fencingToken. Retained until every declared publisher acks (spec lines 683-723).
export interface SideEffectOutboxRecord {
  checkpointId: string;
  committedRevision: number;
  fencingToken: number;
  stepId: string;
  iteration: number;
  entries: SideEffectEntry[];
  pendingPublishers: string[];
  createdAt: string;
}
```

Extend `LaneStepResult` (same file) with the gate surface and the three validation step statuses:

```typescript
export type GateStatus = 'clean' | 'findings' | 'inconclusive' | 'error';
// In LaneStepResult, ADD (optional so closed/serve results omit it):
//   gate?: { status: GateStatus; validators: { validatorId: string; status: GateStatus }[];
//            findings: ProductFinding[] };
// Import ProductFinding from './product-rule-types'.
```

(Use a type-only import: `import type { ProductFinding } from './product-rule-types';`.)

- [ ] **Step 1.4: Schema v2 + migration in `lane-checkpoint-store.ts`**

Change `LaneCheckpoint.schemaVersion` to `2`; add `fencingCounter: number; lease: LeaseRecord | null; sideEffectOutbox: SideEffectOutboxRecord[];`. Import the new types. Make `dir()` PUBLIC (the lock and helpers need it). Replace `read`/`write`:

```typescript
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry, LeaseRecord, SideEffectOutboxRecord } from './lane-types';
// interface LaneCheckpoint: schemaVersion: 2; ... fencingCounter: number; lease: LeaseRecord | null; sideEffectOutbox: SideEffectOutboxRecord[];

dir(): string { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); }   // was private

private migrate(raw: any): LaneCheckpoint {
  if (raw.schemaVersion === 2) {
    return { ...raw, sideEffectOutbox: Array.isArray(raw.sideEffectOutbox) ? raw.sideEffectOutbox : [] } as LaneCheckpoint;
  }
  if (raw.schemaVersion === 1) {
    return { ...raw, schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: [] } as LaneCheckpoint;
  }
  throw new Error(`LaneCheckpointStore: unsupported schemaVersion ${raw.schemaVersion}`);
}
write(cp: LaneCheckpoint): void {
  if (cp.schemaVersion !== 2) throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported (writes 2)`);
  const target = this.filePath(cp.checkpointId);
  fs.mkdirSync(this.dir(), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
  fs.renameSync(tmp, target);
}
read(id: string): LaneCheckpoint {
  const target = this.filePath(id);
  if (!fs.existsSync(target)) throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
  return this.migrate(JSON.parse(fs.readFileSync(target, 'utf8')));
}
```

`list()` and `findByStartRequestId()` already read whole files; they keep working because `migrate` only runs in `read()`. `list()`'s inline parse only touches summary fields that are unchanged - leave it, OR route it through `migrate` for consistency (optional). Do NOT change `list()`'s summary shape.

- [ ] **Step 1.5: `startLane` creates v2** - in `lane-runner.ts`, the `cp` literal in `startLane` must set `schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: []` (otherwise `write()`'s v2 assert throws). Add the three fields to the existing object literal. (The concurrent-start lock comes in Task 3; this step only fixes the schema fields.)

- [ ] **Step 1.6: Update the existing store test** - in `lane-checkpoint-store.test.ts`, any literal that writes `schemaVersion: 1` and expects a v2-rejection becomes a `schemaVersion: 2` literal (adding `fencingCounter: 0, lease: null, sideEffectOutbox: []`) expecting a v3-rejection. Any in-test v2 checkpoint literal must include the three new fields.

- [ ] **Step 1.7: Run PASS + register + commit**

```bash
cd sidecoach
npx ts-node src/__tests__/lane-checkpoint-migration.test.ts   # prints "lane-checkpoint-migration: OK"
npm run build && npm test                                      # all green; startLane writes v2
```

Add `{ rel: 'src/__tests__/lane-checkpoint-migration.test.ts', required: true },` to `scripts/run-tests.ts` SUITES. Stage `lane-types.ts`, `lane-checkpoint-store.ts`, `lane-runner.ts`, the two test files, `scripts/run-tests.ts`. Commit: `git commit -m "feat(lane-p4b1): checkpoint schema v2 (fencingCounter, lease, typed sideEffectOutbox) + v1-to-v2 migration"`.

---

## Task 2: O_EXCL checkpoint lock

**Files:** Create `lane-lock.ts`, `lane-lock.test.ts`. (Reused verbatim from the P3 plan - already Codex-reviewed.)

- [ ] **Step 2.1: Failing test**

```typescript
// sidecoach/src/__tests__/lane-lock.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { withCheckpointLock } from '../lane-lock';

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-lock-')));
  const dir = path.join(proj, '.claude', 'lane-checkpoints');
  fs.mkdirSync(dir, { recursive: true });

  let inner2Ran = false;
  await withCheckpointLock(dir, 'cp1', async () => {
    let threw = false;
    try { await withCheckpointLock(dir, 'cp1', async () => { inner2Ran = true; }, { retries: 0 }); }
    catch { threw = true; }
    if (!threw) throw new Error('second acquire while held must fail with retries:0');
    if (inner2Ran) throw new Error('held lock must not let a second body run');
  });
  let ran = false;
  await withCheckpointLock(dir, 'cp1', async () => { ran = true; });
  if (!ran) throw new Error('lock must release after body');

  // stale (old content timestamp) -> reclaimable
  const lockPath = path.join(dir, 'cp2.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ owner: 'gone', pid: 999999, at: new Date(0).toISOString() }));
  let acquired = false;
  await withCheckpointLock(dir, 'cp2', async () => { acquired = true; }, { staleMs: 1 });
  if (!acquired) throw new Error('stale lock must be reclaimable');

  // owned-release: a reclaimed original owner must NOT delete the replacement's lock.
  const p3 = path.join(dir, 'cp3.lock');
  fs.writeFileSync(p3, JSON.stringify({ owner: 'replacement', pid: 1, at: new Date(Date.now()).toISOString() }));
  await withCheckpointLock(dir, 'cp3', async () => { /* original body */ }, { ownerToken: 'original', retries: 0 })
    .then(() => { throw new Error('should not have acquired a live foreign lock'); })
    .catch(() => { /* expected: live foreign lock blocks */ });
  if (!fs.existsSync(p3)) throw new Error('foreign live lock must survive a blocked acquirer');
  console.log('lane-lock: OK');
}
run();
```

- [ ] **Step 2.2: Run, verify FAIL** - `Cannot find module '../lane-lock'`.

- [ ] **Step 2.3: Implement `lane-lock.ts`** (verbatim from the P3 plan Task 2.3)

```typescript
// sidecoach/src/lane-lock.ts
import * as fs from 'fs';
import * as path from 'path';

export interface LockOpts { retries?: number; retryDelayMs?: number; staleMs?: number; ownerToken?: string; }
const LOCK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// O_EXCL lock with a UNIQUE owner token. Two correctness properties (Codex P1-1):
// (a) a newly-created lock mid-write (unparseable/empty content) is NOT treated as
//     immediately stale - staleness for unparseable content falls back to FILE
//     MTIME, so a concurrent reader in the create->write window waits (grace) while
//     a genuinely crashed-mid-write lock (old mtime) is still reclaimable;
// (b) release unlinks ONLY if THIS owner still holds the lock - a reclaimed owner
//     never deletes its replacement's lock.
export async function withCheckpointLock<T>(
  dir: string, checkpointId: string, fn: () => Promise<T> | T, opts: LockOpts = {},
): Promise<T> {
  if (!LOCK_ID_RE.test(checkpointId) || checkpointId.includes('..')) throw new Error(`withCheckpointLock: illegal checkpointId "${checkpointId}"`);
  const retries = opts.retries ?? 50;
  const delay = opts.retryDelayMs ?? 20;
  const staleMs = opts.staleMs ?? 30000;
  const myToken = opts.ownerToken ?? `${process.pid}-${process.hrtime.bigint().toString()}-${Math.random().toString(36).slice(2)}`;
  const lockPath = path.join(dir, `${checkpointId}.lock`);
  fs.mkdirSync(dir, { recursive: true });
  let attempt = 0;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');                 // O_EXCL atomic create
      try { fs.writeFileSync(fd, JSON.stringify({ owner: myToken, pid: process.pid, at: nowIso() })); } finally { fs.closeSync(fd); }
      break;
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e;
      let info: any = null;
      try { info = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { info = null; }
      const ts = info && typeof info.at === 'string' ? Date.parse(info.at) : NaN;
      let stale: boolean;
      if (!Number.isNaN(ts)) stale = (Date.now() - ts) > staleMs;       // parseable content: content age
      else { try { stale = (Date.now() - fs.statSync(lockPath).mtimeMs) > staleMs; } catch { stale = true; } } // unparseable: mtime (grace for mid-write)
      if (stale) { try { fs.unlinkSync(lockPath); } catch { /* raced */ } continue; }
      if (attempt++ >= retries) throw new Error(`withCheckpointLock: could not acquire "${checkpointId}" after ${retries} retries`);
      await sleep(delay);
    }
  }
  try { return await fn(); }
  finally {
    try { const cur = JSON.parse(fs.readFileSync(lockPath, 'utf8')); if (cur && cur.owner === myToken) fs.unlinkSync(lockPath); }
    catch { /* gone or unparseable - leave for stale reclaim; do NOT unlink a non-owned lock */ }
  }
}
function nowIso(): string { return new Date(Date.now()).toISOString(); }
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
```

- [ ] **Step 2.4: Run PASS + register + commit** - run the suite (prints `lane-lock: OK`), add `{ rel: 'src/__tests__/lane-lock.test.ts', required: true },` to SUITES, `npm run build && npm test`, then `git commit -m "feat(lane-p4b1): O_EXCL checkpoint lock with owner-token + stale-lock reclaim"`.

---

## Task 3: Lease CLAIM / FINALIZE / heartbeat + concurrent-start lock

**Files:** Modify `lane-checkpoint-store.ts` (helpers), `lane-runner.ts` (startLane start-lock); Create `lane-lease.test.ts`.

- [ ] **Step 3.1: Failing test**

```typescript
// sidecoach/src/__tests__/lane-lease.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, claimLease, finalizeLease, refreshHeartbeat } from '../lane-checkpoint-store';
import type { LaneCheckpoint } from '../lane-checkpoint-store';

function base(): LaneCheckpoint {
  return { schemaVersion: 2, checkpointId: 'cp1', laneId: 'lane_build', target: 't',
    executionKind: 'sequence', lifecycle: 'in_progress', cursor: 0, iteration: 0,
    completedStepIds: [], skippedStepIds: [], completedFlowIds: [], stepReports: [], audit: [],
    servedSteps: {}, revision: 0, startRequestId: 'r', seenReportIds: [],
    fencingCounter: 0, lease: null, sideEffectOutbox: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } as LaneCheckpoint;
}
async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-lease-')));
  const store = new LaneCheckpointStore(proj);
  store.write(base());

  const c1 = await claimLease(store, 'cp1', { expectedRevision: 0, stepId: 'shape', iteration: 0, operationId: 'op-1', now: () => '2026-01-01T00:00:01.000Z' });
  if (c1.lease!.fencingToken !== 1) throw new Error('first claim fencingToken = 1');
  if (store.read('cp1').revision !== 1) throw new Error('claim bumps revision');
  const id1 = c1.lease!;

  // a live lease blocks a second claim
  let threw = false;
  try { await claimLease(store, 'cp1', { expectedRevision: 1, stepId: 'shape', iteration: 0, operationId: 'op-2', now: () => '2026-01-01T00:00:02.000Z', staleMs: 60000 }); } catch { threw = true; }
  if (!threw) throw new Error('claim must reject a live lease');

  // heartbeat refresh keeps the same identity, bumps no revision/fencing
  const beat = await refreshHeartbeat(store, 'cp1', id1, () => '2026-01-01T00:00:03.000Z');
  if (beat.revision !== 1 || beat.fencingCounter !== 1) throw new Error('heartbeat must not bump revision/fencing');
  if (beat.lease!.heartbeatAt !== '2026-01-01T00:00:03.000Z') throw new Error('heartbeat must update heartbeatAt');

  // FINALIZE with the FULL identity commits + clears lease; mutate sees committedRevision
  const fin = await finalizeLease(store, 'cp1', id1, (cp, committedRevision) => {
    cp.completedStepIds.push('shape'); cp.cursor = 1;
    if (committedRevision !== 2) throw new Error('mutate must see committedRevision 2');
  }, () => '2026-01-01T00:00:04.000Z');
  if (fin.lease !== null) throw new Error('finalize clears lease');
  if (!fin.completedStepIds.includes('shape') || fin.revision !== 2) throw new Error('finalize applies mutation + bumps revision');

  // a stale/superseded identity must be rejected
  store.write({ ...store.read('cp1'), lease: { operationId: 'op-9', stepId: 'craft', iteration: 0, claimedCheckpointRevision: 2, fencingToken: 5, startedAt: 'x', heartbeatAt: '2026-01-01T00:00:05.000Z' } });
  let f2 = false;
  try { await finalizeLease(store, 'cp1', id1, () => {}, () => '2026-01-01T00:00:06.000Z'); } catch { f2 = true; }
  if (!f2) throw new Error('finalize by a superseded identity must reject');

  // refreshHeartbeat by a superseded identity must reject (ownership lost)
  let h2 = false;
  try { await refreshHeartbeat(store, 'cp1', id1, () => '2026-01-01T00:00:07.000Z'); } catch { h2 = true; }
  if (!h2) throw new Error('refreshHeartbeat must reject when ownership is lost');
  console.log('lane-lease: OK');
}
run();
```

- [ ] **Step 3.2: Run, verify FAIL** - `claimLease is not exported`.

- [ ] **Step 3.3: Implement claim/finalize/heartbeat (use the Task 2 lock)** in `lane-checkpoint-store.ts`. `finalizeLease`'s `mutate` receives `(cp, committedRevision)` and the revision is bumped BEFORE `mutate` so the committed revision is available for the outbox key (Task 7).

```typescript
import { withCheckpointLock } from './lane-lock';
import type { LeaseRecord } from './lane-types';

export function leaseIsLive(lease: LeaseRecord | null, nowMs: number, staleMs = 30000): boolean {
  if (!lease) return false;
  const hb = Date.parse(lease.heartbeatAt);
  if (Number.isNaN(hb)) { process.stderr.write('[lane] malformed lease heartbeatAt; treating as not-live (reclaimable)\n'); return false; }
  return (nowMs - hb) <= staleMs;
}

// The FULL identity FINALIZE/heartbeat must match (spec line 709-712).
export type LeaseIdentity = Pick<LeaseRecord, 'operationId' | 'stepId' | 'iteration' | 'claimedCheckpointRevision' | 'fencingToken'>;
function ownsLease(L: LeaseRecord | null, id: LeaseIdentity): boolean {
  return !!L && L.operationId === id.operationId && L.stepId === id.stepId && L.iteration === id.iteration
    && L.claimedCheckpointRevision === id.claimedCheckpointRevision && L.fencingToken === id.fencingToken;
}

export interface ClaimOpts { expectedRevision: number; stepId: string; iteration: number; operationId: string; now?: () => string; staleMs?: number; }

export async function claimLease(store: LaneCheckpointStore, checkpointId: string, o: ClaimOpts): Promise<LaneCheckpoint> {
  const now = o.now ?? (() => new Date(Date.now()).toISOString());
  const staleMs = o.staleMs ?? 30000;
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    if (cp.revision !== o.expectedRevision) throw new Error(`claimLease: stale expectedRevision ${o.expectedRevision} (current ${cp.revision})`);
    if (leaseIsLive(cp.lease, Date.parse(now()), staleMs)) throw new Error(`claimLease: a live lease (op ${cp.lease!.operationId}) holds this checkpoint`);
    if (cp.lease) process.stderr.write(`[lane] reclaiming stale lease op=${cp.lease.operationId} on ${checkpointId}\n`);
    cp.fencingCounter += 1;
    const ts = now();
    cp.lease = { operationId: o.operationId, stepId: o.stepId, iteration: o.iteration, claimedCheckpointRevision: cp.revision, fencingToken: cp.fencingCounter, startedAt: ts, heartbeatAt: ts };
    cp.revision += 1; cp.updatedAt = ts;
    store.write(cp);
    return cp;
  });
}

// Update ONLY heartbeatAt under the lock; verify ownership; do NOT touch revision/fencing.
export async function refreshHeartbeat(store: LaneCheckpointStore, checkpointId: string, id: LeaseIdentity, now?: () => string): Promise<LaneCheckpoint> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    if (!ownsLease(cp.lease, id)) throw new Error(`refreshHeartbeat: lease ownership lost (current op ${cp.lease?.operationId ?? 'none'})`);
    cp.lease!.heartbeatAt = clock();
    store.write(cp);
    return cp;
  });
}

// Bump revision BEFORE mutate so the committed revision is available to the outbox key.
export async function finalizeLease(store: LaneCheckpointStore, checkpointId: string, id: LeaseIdentity, mutate: (cp: LaneCheckpoint, committedRevision: number) => void, now?: () => string): Promise<LaneCheckpoint> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    if (!ownsLease(cp.lease, id)) throw new Error(`finalizeLease: lease identity mismatch (current op ${cp.lease?.operationId ?? 'none'}, fencing ${cp.lease?.fencingToken ?? 'n/a'})`);
    cp.revision += 1;
    cp.updatedAt = clock();
    mutate(cp, cp.revision);
    cp.lease = null;
    store.write(cp);
    return cp;
  });
}
```

- [ ] **Step 3.4: Concurrent-start lock in `startLane`** - wrap the `findByStartRequestId`-check-then-create sequence under a lock keyed by the start request so concurrent starts map one `startRequestId` to one checkpoint:

```typescript
import { createHash } from 'crypto';
import { withCheckpointLock } from './lane-lock';
// in startLane, after validating startRequestId + resolving the lane (l):
const startLockId = 'start-' + createHash('sha256').update(startRequestId).digest('hex').slice(0, 40);
return withCheckpointLock(d.store.dir(), startLockId, async () => {
  const existing = d.store.findByStartRequestId(startRequestId);
  if (existing && !isClosed(existing.lifecycle)) {
    if (existing.laneId !== laneId) throw new Error(`startLane: startRequestId already maps to active lane "${existing.laneId}"`);
    return serveStep(existing, resolveLane(existing.laneId), context, d);
  }
  const ts = d.now();
  const cp: LaneCheckpoint = { schemaVersion: 2, checkpointId: d.newCheckpointId(), laneId, target,
    executionKind: l.executionKind, lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId,
    seenReportIds: [], fencingCounter: 0, lease: null, sideEffectOutbox: [], createdAt: ts, updatedAt: ts };
  d.store.write(cp);
  return serveStep(cp, l, context, d);
});
```

The start-lock key space (`start-<hash>`) never collides with a checkpoint id (`lane-...`), so a `serveStep` write inside (which takes the checkpoint lock in Task 6) cannot self-deadlock.

- [ ] **Step 3.5: Run PASS + register + commit** - run `lane-lease.test.ts` (prints `lane-lease: OK`), add it to SUITES `required: true`, `npm run build && npm test`, then `git commit -m "feat(lane-p4b1): lease CLAIM/FINALIZE/heartbeat under O_EXCL lock + concurrent-start lock"`.

---

## Task 4: Validators become async with cooperative abort

**Files:** Modify `validators/run-validator.ts`, `flow-validation-capabilities.ts`, `__tests__/product-validator-pipeline.test.ts`, `__tests__/validator-fixtures-e2e.test.ts`.

- [ ] **Step 4.1: Failing test (abort + async contract)** - add to `product-validator-pipeline.test.ts` (and convert its existing `reg.validateProduct!(ctx)` calls to `await reg.validateProduct!(ctx)`):

```typescript
// near the end of product-validator-pipeline.test.ts run():
// (1) async contract: validateProduct returns a Promise now
const pending = getValidatorRegistration('polish-standard')!.validateProduct!({ projectPath: emptyDir });
if (typeof (pending as any).then !== 'function') throw new Error('validateProduct must be async (returns a Promise)');
await pending;

// (2) an already-aborted signal yields a validator-level error, category 'aborted'
const ac = new AbortController();
ac.abort();
const aborted = await getValidatorRegistration('polish-standard')!.validateProduct!({ projectPath: emptyDir }, ac.signal);
if (aborted.status !== 'error' || aborted.normalizedErrorCategory !== 'aborted') throw new Error('aborted signal must yield status error / category aborted');
```

(Define `emptyDir` as an empty mkdtemp dir at the top of the test if not already present.)

- [ ] **Step 4.2: Run, verify FAIL** - the Promise/await mismatch and the missing abort handling fail the suite.

- [ ] **Step 4.3: Make `makeProductValidator` async** in `run-validator.ts`. Keep `runDetailed` as the synchronous CPU core; wrap it so the public entry is async and checks the signal cooperatively. The simplest faithful change: check the signal at entry and BETWEEN rule executions, mapping an abort to a validator-level error via the existing `evaluateCleanPolicy` `validatorError` path (category `'aborted'`).

```typescript
export function makeProductValidator(validatorId: string) {
  return async function validateProduct(context: unknown, signal?: AbortSignal): Promise<ProductValidationResult> {
    if (signal?.aborted) return abortedResult(validatorId);
    // yield once so an abort fired during this microtask is observed (cooperative)
    await Promise.resolve();
    if (signal?.aborted) return abortedResult(validatorId);
    return runDetailed(validatorId, context, signal).result;
  };
}

function abortedResult(validatorId: string): ProductValidationResult {
  return evaluateCleanPolicy(
    { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
      validatorError: { category: 'aborted', message: 'validation aborted (lease lost / cancelled)' } },
    { requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {}, requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report' },
  );
}
```

Thread `signal` into `runDetailed`: after `collect(...)` and before the `executions` map, and inside the `.map((d) => ...)`, check `if (signal?.aborted) throw new AbortError()` OR short-circuit. Simplest: inside `runDetailed`, before building `executions`, `if (signal?.aborted) return abortedDetail(validatorId, policy);` and (for long rule sets) check `signal?.aborted` at the top of the `executeRule` loop body, throwing a sentinel caught by `runDetailed` to return the aborted result. Keep the existing clean/findings/inconclusive/error behavior identical when no signal is passed or the signal never fires (this is what the existing suites assert).

- [ ] **Step 4.4: Retype the registration** in `flow-validation-capabilities.ts`:

```typescript
validateProduct?: (context: unknown, signal?: AbortSignal) => Promise<ProductValidationResult>;
```

The four `VALIDATOR_REGISTRATIONS` entries already call `makeProductValidator(...)`, which now returns the async function - no change to those lines beyond the type.

- [ ] **Step 4.5: Update the other async caller** - in `validator-fixtures-e2e.test.ts`, change every `reg.validateProduct!(...)` / `getValidatorRegistration(...)!.validateProduct!(...)` call to `await ...` (the function is `async run()` already). Confirm no other non-test caller exists (`grep -rn "validateProduct" src | grep -v validateProductMd` - only the two test files + the registrations).

- [ ] **Step 4.6: Run PASS + commit** - `npx ts-node src/__tests__/product-validator-pipeline.test.ts`, `npx ts-node src/__tests__/validator-fixtures-e2e.test.ts`, then `npm run build && npm test` (all 29 suites green). Commit: `git commit -m "feat(lane-p4b1): validateProduct is async with cooperative AbortSignal (aborted -> validator error)"`.

---

## Task 5: Step validator discovery + worst-status aggregation (pure)

**Files:** Create `lane-validators.ts`, `lane-validator-gating.test.ts`.

This task encodes the resolved ambiguities (see Self-Review): (1) a sequence step that maps to MULTIPLE flows discovers the UNION (de-duplicated) of `productValidatorIds` across those flows via `FLOW_CAPABILITIES`; (2) the worst-status total order is `error` > `findings` > `inconclusive` > `clean`.

- [ ] **Step 5.1: Failing test**

```typescript
// sidecoach/src/__tests__/lane-validator-gating.test.ts
import { validatorsForStep, aggregateWorstStatus, mapGateStatusToOutcome } from '../lane-validators';
import type { FlowId } from '../types';

function run() {
  // discovery: lane_build "craft" step binds flowI(adv)/flowM(adv)/flowJ(polish-standard) -> ['polish-standard']
  const craft = { flowIds: ['flowI_accessibility', 'flowM_responsive_validation', 'flowJ_tactical_polish'] as FlowId[] };
  const ids = validatorsForStep(craft);
  if (ids.length !== 1 || ids[0] !== 'polish-standard') throw new Error(`craft must discover ['polish-standard'], got ${JSON.stringify(ids)}`);

  // a step that binds the same validator via two flows de-dups
  const dupd = validatorsForStep({ flowIds: ['flowJ_tactical_polish', 'flowJ_tactical_polish'] as FlowId[] });
  if (dupd.length !== 1) throw new Error('duplicate validators must de-dup');

  // a no-validator step discovers []
  if (validatorsForStep({ flowIds: ['flowA_brand_verify'] as FlowId[] }).length !== 0) throw new Error('advisory/none flow contributes no validator');
  if (validatorsForStep({ flowIds: [] as FlowId[] }).length !== 0) throw new Error('empty step contributes no validator');

  // worst-status total order: error > findings > inconclusive > clean
  if (aggregateWorstStatus(['clean', 'clean']) !== 'clean') throw new Error('all clean -> clean');
  if (aggregateWorstStatus(['clean', 'inconclusive']) !== 'inconclusive') throw new Error('inconclusive beats clean');
  if (aggregateWorstStatus(['findings', 'inconclusive']) !== 'findings') throw new Error('findings beats inconclusive');
  if (aggregateWorstStatus(['error', 'findings', 'inconclusive']) !== 'error') throw new Error('error is worst');
  if (aggregateWorstStatus([]) !== 'clean') throw new Error('no validators -> clean (vacuously gated)');

  // mapping
  if (mapGateStatusToOutcome('clean').proceed !== true) throw new Error('clean proceeds');
  if (mapGateStatusToOutcome('findings').stepStatus !== 'validation_failed') throw new Error('findings -> validation_failed');
  if (mapGateStatusToOutcome('inconclusive').stepStatus !== 'validation_inconclusive') throw new Error('inconclusive -> validation_inconclusive');
  if (mapGateStatusToOutcome('error').stepStatus !== 'validation_error') throw new Error('error -> validation_error');
  console.log('lane-validator-gating: OK');
}
run();
```

- [ ] **Step 5.2: Run, verify FAIL** - `Cannot find module '../lane-validators'`.

- [ ] **Step 5.3: Implement `lane-validators.ts`**

```typescript
// sidecoach/src/lane-validators.ts
import type { FlowId } from './types';
import type { GateStatus } from './lane-types';
import { getFlowCapability } from './flow-validation-capabilities';

// A sequence step that maps to multiple flows gates on the UNION (de-duplicated,
// order-preserving) of those flows' bound productValidatorIds (spec line 351-353).
export function validatorsForStep(step: { flowIds: FlowId[] }): string[] {
  const ids: string[] = [];
  for (const f of step.flowIds) {
    const cap = getFlowCapability(f as string);
    for (const v of cap?.productValidatorIds ?? []) if (!ids.includes(v)) ids.push(v);
  }
  return ids;
}

// Total order, worst-first: a gate machinery failure (error) is loudest because the
// gate could not be evaluated at all; a confirmed blocking defect (findings) outranks
// an unverified gap (inconclusive); clean is best. No bound validators -> clean
// (the step is vacuously gated - nothing required it).
const RANK: Record<GateStatus, number> = { clean: 0, inconclusive: 1, findings: 2, error: 3 };
export function aggregateWorstStatus(statuses: GateStatus[]): GateStatus {
  let worst: GateStatus = 'clean';
  for (const s of statuses) if (RANK[s] > RANK[worst]) worst = s;
  return worst;
}

export interface GateOutcome { proceed: boolean; stepStatus?: 'validation_failed' | 'validation_inconclusive' | 'validation_error'; }
export function mapGateStatusToOutcome(status: GateStatus): GateOutcome {
  switch (status) {
    case 'clean': return { proceed: true };
    case 'findings': return { proceed: false, stepStatus: 'validation_failed' };
    case 'inconclusive': return { proceed: false, stepStatus: 'validation_inconclusive' };
    case 'error': return { proceed: false, stepStatus: 'validation_error' };
  }
}
```

- [ ] **Step 5.4: Run PASS + register + commit** - run the suite (prints `lane-validator-gating: OK`), add it to SUITES `required: true`, `npm run build && npm test`, then `git commit -m "feat(lane-p4b1): step validator discovery (FLOW_CAPABILITIES union) + worst-status aggregation + gate mapping"`.

---

## Task 6: advanceLane(complete) async CLAIM / EXECUTE / FINALIZE with validator gating

Rewrite `advanceLane`'s mutating actions to claim a lease, run the validators as the async EXECUTE, then finalize. PRESERVE every P2 guard (report present + >=1 evidence, stepId/iteration match, dup-reportId-on-in_progress no-op, full-serve required, successfulFlowIds-only attestation, interrupted=resume-only, closed-rejects, stale-revision rejection). This task does the gate logic + the concurrency guarantee; the outbox record + publish is Task 7, the abort/heartbeat plumbing is Task 8.

**Files:** Modify `lane-runner.ts`; Create `lane-runner-concurrency.test.ts`; existing advance suites must stay green.

- [ ] **Step 6.1: Failing test (gate + the core concurrency guarantee)**

```typescript
// sidecoach/src/__tests__/lane-runner-concurrency.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function okResult(): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}
function deps(proj: string, validator?: (id: string) => Promise<ProductValidationResult>): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: validator ?? (async () => okResult()),
  } as any;
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 's', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-conc-')));

  // (1) clean gate: shape step (binds NO validator) advances; craft step (binds
  //     polish-standard) advances when the validator returns clean.
  {
    const d = deps(proj);
    const s = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-clean', d);
    const r1 = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s.revision }, d);
    if (r1.currentVerb !== 'craft') throw new Error('clean gate advances to craft');
  }

  // (2) findings gate: craft validator returns findings -> step STAYS current, validation_failed.
  {
    const d = deps(proj, async () => ({ ...okResult(), status: 'findings',
      findings: [{ validatorId: 'polish-standard', ruleId: 'r', canonicalRuleKey: 'k', severity: 'major', findingClass: 'polish', evidenceLocations: [], message: 'bad' }] } as ProductValidationResult));
    const s = await startLane('lane_build', 'hero2', { projectPath: proj }, 'req-find', d);
    await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s.revision }, d);
    const cur = d.store.read(s.checkpointId);
    const g = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: cur.revision }, d);
    if (g.currentVerb !== 'craft') throw new Error('findings gate keeps step current');
    if (g.gate?.status !== 'findings' || (g.gate?.findings.length ?? 0) < 1) throw new Error('findings returned on the result');
    const after = d.store.read(s.checkpointId);
    if (after.completedStepIds.includes('craft')) throw new Error('findings must NOT commit the step');
    if (after.lease !== null) throw new Error('lease released after an unclean gate');
  }

  // (3) the core guarantee: two concurrent completes of the same step -> exactly one commits.
  {
    const d = deps(proj);
    const start = await startLane('lane_build', 'hero3', { projectPath: proj }, 'req-conc', d);
    let arrived = 0; let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const barrier = async () => { if (++arrived >= 2) release(); await gate; };
    const d2 = { ...d, __claimBarrier: barrier } as any;     // advanceLane awaits this AFTER the early read, BEFORE claimLease
    const both = await Promise.allSettled([
      advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: start.revision }, d2),
      advanceLane(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), reportId: 'r:shape2' }, expectedRevision: start.revision }, d2),
    ]);
    if (both.filter((r) => r.status === 'fulfilled').length !== 1) throw new Error(`exactly one concurrent advance must commit, got ${both.filter((r) => r.status === 'fulfilled').length}`);
    const cp = d.store.read(start.checkpointId);
    if (cp.completedStepIds.filter((x) => x === 'shape').length !== 1) throw new Error('shape committed at most once');
    if (cp.lease !== null) throw new Error('lease cleared after commit');
  }
  console.log('lane-runner-concurrency: OK');
}
run();
```

- [ ] **Step 6.2: Run, verify FAIL** - `newOperationId` / `runValidator` undefined, or both concurrent advances commit, or `gate` missing.

- [ ] **Step 6.3: Rewrite the mutating path in `lane-runner.ts`**

Add to `LaneRunnerDeps`:

```typescript
newOperationId: () => string;
runValidator: (validatorId: string, validatorContext: { projectPath: string; target: string }, signal?: AbortSignal) => Promise<ProductValidationResult>;
staleMs?: number;                              // default 30000
__claimBarrier?: () => Promise<void>;          // test seam only
```

(Import `ProductValidationResult` type, `claimLease`/`finalizeLease`/`leaseIsLive`, `validatorsForStep`/`aggregateWorstStatus`/`mapGateStatusToOutcome`, and `withCheckpointLock`.)

Refactor the old `bump()`-based `advanceCursor` into a PURE in-place mutator `advanceCursorInPlace(cp, l)` (sets cursor/lifecycle/outcome, NO store writes) and a `buildStepResult(cp, l, ctx, d, gate?)` (serves the new current step or `closedResult`, attaches `gate` if given). Delete `bump()` once unused.

`advanceLane` keeps its early guards (dup-on-in_progress no-op, interrupted=resume-only, closed-rejects, `expectedRevision === cp.revision`). Then, immediately after the early read and BEFORE any claim, add the test seam and the live-lease rejection for ORDINARY transitions:

```typescript
await d.__claimBarrier?.();        // production passes none (no-op)
const nowMs = Date.parse(d.now());
const ordinary = transition.action === 'complete' || transition.action === 'skip' || transition.action === 'retry' || transition.action === 'resume';
if (ordinary && leaseIsLive(cp.lease, nowMs, d.staleMs ?? 30000)) {
  throw new Error(`advanceLane: an operation holds this checkpoint (lease op ${cp.lease!.operationId}); only interrupt/stop may supersede it`);
}
```

`complete` (after the P2 guards incl. full-serve):

```typescript
const step = l.verbSteps[cp.cursor];
const served = cp.servedSteps[`${cp.cursor}:${cp.iteration}`];   // full-serve already asserted above
const operationId = d.newOperationId();
const claimed = await claimLease(d.store, checkpointId, { expectedRevision: transition.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
const id = claimed.lease!;                       // FULL identity captured under the lock (do NOT re-read outside it)

const validatorIds = validatorsForStep(step);
// EXECUTE: async validators, abort + heartbeat plumbing wired in Task 8. For now
// run them sequentially with no signal; aggregate worst-status.
const perValidator: { validatorId: string; result: ProductValidationResult }[] = [];
for (const vId of validatorIds) {
  const result = await d.runValidator(vId, { projectPath, target: cp.target });
  perValidator.push({ validatorId: vId, result });
}
const worst = aggregateWorstStatus(perValidator.map((p) => p.result.status as GateStatus));
const gate = { status: worst, validators: perValidator.map((p) => ({ validatorId: p.validatorId, status: p.result.status as GateStatus })),
               findings: perValidator.flatMap((p) => p.result.findings) };
const outcome = mapGateStatusToOutcome(worst);

if (outcome.proceed) {
  const final = await finalizeLease(d.store, checkpointId, id, (c) => {
    c.seenReportIds.push(r.reportId); c.stepReports.push(r); c.completedStepIds.push(step.verb);
    for (const f of served.successfulFlowIds) if (!c.completedFlowIds.includes(f)) c.completedFlowIds.push(f);
    c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: c.revision, at: d.now() });
    advanceCursorInPlace(c, l);
    // Task 7 pushes the side-effect outbox record here, keyed by committedRevision.
  }, d.now);
  return buildStepResult(final, l, { projectPath }, d, gate);
}
// UNCLEAN: release the lease WITHOUT advancing; the step stays current. This is
// still a FINALIZE (owner-checked, bumps revision, clears lease) so all writes stay
// under the lock and the next attempt can claim cleanly.
const released = await finalizeLease(d.store, checkpointId, id, (c) => {
  c.seenReportIds.push(r.reportId);    // the report was consumed; a re-send is a no-op (idempotent)
  c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: c.revision, reason: `gate:${worst}`, at: d.now() } as any);
}, d.now);
return buildStepResult(released, l, { projectPath }, d, gate);   // re-serves the SAME (still-current) step + gate
```

NOTE on `seenReportIds` for the unclean path: pushing `r.reportId` makes a re-send of the SAME report a no-op (returns current state), which is correct - the same evidence cannot re-trigger the gate. A DIFFERENT report (new `reportId`) for the same step re-runs the gate. Confirm test (2) above still keeps the step current after the unclean gate, and add an assertion that re-sending the same report is a no-op while a new report re-runs validators.

`skip` keeps its P2 prerequisite check, then claims + finalizes (mutation: push `skippedStepId` + `advanceCursorInPlace`; no validators - skip BYPASSES the gate, recorded with its reason in the audit):

```typescript
// skipStep, after strandedBySkipping passes:
const operationId = d.newOperationId();
const claimed = await claimLease(d.store, checkpointId, { expectedRevision: t.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
const id = claimed.lease!;
const final = await finalizeLease(d.store, checkpointId, id, (c) => {
  c.skippedStepIds.push(step.verb);
  c.audit.push({ action: 'skip', stepId: step.verb, iteration: c.iteration, reason: t.reason, revision: c.revision, at: d.now() });
  advanceCursorInPlace(c, l);
}, d.now);
return buildStepResult(final, l, { projectPath }, d);
```

**`serveStep` must persist under the checkpoint lock (all-writes-under-lock).** `serveStep` currently writes a full `cp` snapshot WITHOUT the lock and WITHOUT bumping revision. A concurrent committed transition can be clobbered by that stale snapshot. FIX: `serveStep`'s persistence runs under `withCheckpointLock(d.store.dir(), cp.checkpointId, ...)`, RE-READING the current checkpoint, MERGING only the `servedSteps[key]` it produced into the fresh copy, and writing that (never a whole stale `cp` captured earlier). It still does not bump the semantic revision. Test in Task 7/9 that a `serveStep` write interleaved after a committed `complete` does not revert the commit.

`retry` / `resume` / `interrupt` / `stop` keep their P2 behavior FOR NOW (still use the old write path) - Task 9 moves them under the lock and adds lease fencing. After this task they must remain green in `lane-runner-transitions.test.ts` (the live-lease rejection guard above only blocks ordinary transitions when a lease is actually live, which never happens in the synchronous transitions suite).

- [ ] **Step 6.4: Run PASS** - the new concurrency suite plus the existing `lane-runner-advance-sequence` / `-transitions` / `-skip-prereq` / `lane-execution-e2e` stay green (observable behavior for a no-validator or clean-validator step is unchanged; only the commit mechanism changed). Update those suites' `deps()` fixtures to add `newOperationId` + `runValidator` (a clean stub) - this is the contract-change fixup required in THIS task. Register the concurrency suite `required: true`.

- [ ] **Step 6.5: Commit** - `git commit -m "feat(lane-p4b1): advanceLane(complete/skip) CLAIM/EXECUTE/FINALIZE - validator gating + at-most-one committed transition"`.

---

## Task 7: Side-effect outbox record at FINALIZE + idempotent PUBLISH

A committed `complete` writes a side-effect outbox record keyed by `(checkpointId, committedRevision)` carrying the `fencingToken`; the record publishes to a dedicated fencing-token-conditional `LaneSideEffectSink`. Replay after a crash is idempotent. (See Self-Review for why this is a NEW dedicated sink, not the global FlowHistory writer.)

**Files:** Create `lane-side-effect-sink.ts`, `lane-side-effect-outbox.test.ts`; Modify `lane-checkpoint-store.ts` (`publishOutbox`), `lane-runner.ts` (push the record in the clean-FINALIZE mutate + call `publishOutbox`).

- [ ] **Step 7.1: Failing test**

```typescript
// sidecoach/src/__tests__/lane-side-effect-outbox.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { LaneSideEffectSink } from '../lane-side-effect-sink';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';
// reuse deps()/rep()/okResult() shape from lane-runner-concurrency.test.ts (copy in)

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-obx-')));
  const d = deps(proj);
  const s = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-obx', d);
  // complete the craft step (binds polish-standard, clean) so a side effect is produced
  await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s.revision }, d);
  const cur = d.store.read(s.checkpointId);
  await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: cur.revision }, d);

  // after a clean commit + publish: the sink holds the entry, the outbox record is drained
  const sink = new LaneSideEffectSink(proj);
  const key = `${s.checkpointId}:craft:0`;
  const rec = sink.get(key);
  if (!rec) throw new Error('sink must hold the committed step side effect');
  if (rec.fencingToken < 1) throw new Error('sink entry carries the fencing token');
  const after = d.store.read(s.checkpointId);
  if (after.sideEffectOutbox.length !== 0) throw new Error('fully-published outbox record is drained');

  // idempotent replay: re-publishing the same logical key with the same token is a no-op,
  // a LOWER token is rejected, a HIGHER token overwrites.
  if (sink.upsert(key, rec.fencingToken, { v: 1 }).status !== 'noop') throw new Error('same-token replay must be a no-op');
  if (sink.upsert(key, rec.fencingToken - 1, { v: 1 }).status !== 'rejected') throw new Error('lower token must be rejected');
  if (sink.upsert(key, rec.fencingToken + 1, { v: 2 }).status !== 'written') throw new Error('higher token must overwrite');

  // crash-after-FINALIZE: an undrained outbox record replays safely.
  const d2 = deps(proj);
  const s2 = await startLane('lane_build', 'hero2', { projectPath: proj }, 'req-crash', d2);
  await advanceLane(proj, s2.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s2.revision }, d2);
  const cur2 = d2.store.read(s2.checkpointId);
  // simulate FINALIZE-but-not-yet-published by completing craft, then forcibly re-add the record:
  await advanceLane(proj, s2.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: cur2.revision }, d2);
  // (the engine publishes inline; this asserts a manual replay of a re-seeded record is a no-op)
  const sink2 = new LaneSideEffectSink(proj);
  const k2 = `${s2.checkpointId}:craft:0`;
  const before = sink2.get(k2)!.fencingToken;
  const replay = sink2.upsert(k2, before, { v: 9 });
  if (replay.status !== 'noop') throw new Error('replay of an already-published record is a no-op');
  console.log('lane-side-effect-outbox: OK');
}
run();
```

- [ ] **Step 7.2: Run, verify FAIL** - `Cannot find module '../lane-side-effect-sink'`.

- [ ] **Step 7.3: Implement `LaneSideEffectSink`** (fencing-token-conditional upsert; lock-guarded JSON under `.claude/lane-checkpoints/lane-side-effects.json`)

```typescript
// sidecoach/src/lane-side-effect-sink.ts
import * as fs from 'fs';
import * as path from 'path';
import { withCheckpointLock } from './lane-lock';

interface SinkEntry { fencingToken: number; payload: unknown; updatedAt: string; }
export interface UpsertOutcome { status: 'written' | 'noop' | 'rejected'; }

export class LaneSideEffectSink {
  private dirPath: string;
  private file: string;
  constructor(projectPath: string) {
    this.dirPath = path.join(fs.realpathSync(projectPath), '.claude', 'lane-checkpoints');
    this.file = path.join(this.dirPath, 'lane-side-effects.json');
  }
  private read(): Record<string, SinkEntry> {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return {}; }
  }
  get(logicalKey: string): SinkEntry | null { return this.read()[logicalKey] ?? null; }

  // Conditional upsert by fencing token (spec lines 687-723): higher token writes;
  // same token is an idempotent no-op; lower token is rejected (stale replay).
  upsertSync(logicalKey: string, fencingToken: number, payload: unknown, now: () => string = () => new Date(Date.now()).toISOString()): UpsertOutcome {
    fs.mkdirSync(this.dirPath, { recursive: true });
    const map = this.read();
    const cur = map[logicalKey];
    if (cur && fencingToken < cur.fencingToken) return { status: 'rejected' };
    if (cur && fencingToken === cur.fencingToken) return { status: 'noop' };
    map[logicalKey] = { fencingToken, payload, updatedAt: now() };
    const tmp = `${this.file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(map, null, 2));
    fs.renameSync(tmp, this.file);
    return { status: 'written' };
  }
  // lock-guarded variant for concurrent publishers
  async upsert(logicalKey: string, fencingToken: number, payload: unknown, now?: () => string): Promise<UpsertOutcome> {
    return withCheckpointLock(this.dirPath, 'lane-side-effect-sink', () => this.upsertSync(logicalKey, fencingToken, payload, now));
  }
}
```

(The test calls a synchronous `upsert(...)` returning `.status`; expose BOTH: a sync `upsertSync` for the test's direct assertions and the async `upsert` the publisher uses. Adjust the test to call whichever you expose - keep ONE name in the test and match it. The implementation above offers `upsertSync` for direct test use; rename the test calls to `upsertSync` OR make the test `await` the async `upsert`. Pick one and keep it consistent.)

- [ ] **Step 7.4: `publishOutbox` in `lane-checkpoint-store.ts`** - drains each outbox record's pending publishers idempotently, then removes acked publishers (and fully-acked records) under the checkpoint lock WITHOUT bumping the semantic revision (spec lines 691-693):

```typescript
import { LaneSideEffectSink } from './lane-side-effect-sink';

export const OUTBOX_PUBLISHERS = ['lane-side-effect-sink'] as const;

export async function publishOutbox(store: LaneCheckpointStore, checkpointId: string, projectPath: string, now?: () => string): Promise<void> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  const sink = new LaneSideEffectSink(projectPath);
  // snapshot the records to publish (read outside the checkpoint lock; publishing is idempotent)
  const snapshot = store.read(checkpointId).sideEffectOutbox;
  for (const record of snapshot) {
    for (const entry of record.entries) {
      if (entry.publisher !== 'lane-side-effect-sink') continue;
      const r = await sink.upsert(entry.logicalKey, record.fencingToken, entry.payload, clock);
      if (r.status === 'rejected') continue;          // a higher token already won; still ack-able as delivered
    }
    // ack: remove this record under the checkpoint lock; do NOT bump revision.
    await withCheckpointLock(store.dir(), checkpointId, () => {
      const cp = store.read(checkpointId);
      cp.sideEffectOutbox = cp.sideEffectOutbox.filter((x) => !(x.committedRevision === record.committedRevision && x.fencingToken === record.fencingToken));
      cp.updatedAt = clock();
      store.write(cp);
    });
  }
}
```

- [ ] **Step 7.5: Wire the record into the clean-FINALIZE mutate (lane-runner.ts)** - in the `outcome.proceed` branch of `complete`, push the record inside the finalize mutate (it sees `committedRevision`), then call `publishOutbox` after FINALIZE returns:

```typescript
const final = await finalizeLease(d.store, checkpointId, id, (c, committedRevision) => {
  c.seenReportIds.push(r.reportId); c.stepReports.push(r); c.completedStepIds.push(step.verb);
  for (const f of served.successfulFlowIds) if (!c.completedFlowIds.includes(f)) c.completedFlowIds.push(f);
  c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: committedRevision, at: d.now() });
  advanceCursorInPlace(c, l);
  c.sideEffectOutbox.push({
    checkpointId, committedRevision, fencingToken: id.fencingToken, stepId: step.verb, iteration: id.iteration,
    pendingPublishers: ['lane-side-effect-sink'], createdAt: d.now(),
    entries: [{ publisher: 'lane-side-effect-sink', entryIndex: 0, logicalKey: `${checkpointId}:${step.verb}:${id.iteration}`,
      payload: { laneId: cp.laneId, verb: step.verb, gateStatus: worst, validators: gate.validators, committedRevision } }],
  });
}, d.now);
await publishOutbox(d.store, checkpointId, projectPath, d.now);
return buildStepResult(final, l, { projectPath }, d, gate);
```

The unclean branch pushes NO outbox record (no committed side effect to publish).

- [ ] **Step 7.6: Run PASS + register + commit** - run `lane-side-effect-outbox.test.ts`, add it to SUITES `required: true`, `npm run build && npm test`, then `git commit -m "feat(lane-p4b1): side-effect outbox record at FINALIZE + fencing-conditional sink + idempotent publish"`.

---

## Task 8: AbortSignal composition + heartbeat refresh during EXECUTE

Make the EXECUTE genuinely abortable and heartbeat-refreshed. The composed signal covers lease-ownership-loss (detected by a heartbeat that fails) + in-process priority cancellation (an AbortController registered per live operation). Transport-timeout composition is P4d.

**Files:** Modify `lane-runner.ts`; extend `lane-runner-concurrency.test.ts`.

- [ ] **Step 8.1: Failing test** (append to the concurrency suite) - a validator that awaits a barrier; while it is in-flight, fence the lease from a second store handle (simulating another process), and assert the in-flight op (a) aborts and (b) cannot FINALIZE:

```typescript
{
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-abort-')));
  let releaseValidator!: () => void;
  const held = new Promise<void>((r) => { releaseValidator = r; });
  let sawAbort = false;
  const d = deps(proj, async (_id, _ctx, signal) => {
    signal?.addEventListener('abort', () => { sawAbort = true; });
    await held;                                   // stay in-flight until the test fences the lease
    return okResult();
  });
  const s = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-abort', d);
  await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
  // start the craft complete; it will block inside the validator
  const inflight = advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
  await new Promise((r) => setTimeout(r, 30));    // let it claim + enter the validator
  // priority interrupt from "another caller": fences the lease + signals the controller
  await advanceLane(proj, s.checkpointId, { action: 'interrupt', expectedRevision: d.store.read(s.checkpointId).revision }, d);
  releaseValidator();
  let committed = true;
  try { await inflight; } catch { committed = false; }   // FINALIZE must reject (ownership lost)
  if (!sawAbort) throw new Error('in-flight validator must receive the abort signal');
  if (committed && d.store.read(s.checkpointId).completedStepIds.includes('craft')) throw new Error('a fenced operation must NOT commit');
  console.log('lane-runner-concurrency abort-fence: OK');
}
```

- [ ] **Step 8.2: Run FAIL** - no signal reaches the validator; the fenced op still commits.

- [ ] **Step 8.3: Implement the composed signal + heartbeat** in `lane-runner.ts`. Add a module-level in-process registry and an `executeStepValidators` helper:

```typescript
// module scope
const LIVE_OPERATIONS = new Map<string, AbortController>();   // keyed by checkpointId (one live lease per checkpoint)

async function executeStepValidators(
  d: LaneRunnerDeps, checkpointId: string, id: LeaseIdentity, validatorIds: string[],
  ctx: { projectPath: string; target: string }, controller: AbortController,
): Promise<{ validatorId: string; result: ProductValidationResult }[]> {
  const out: { validatorId: string; result: ProductValidationResult }[] = [];
  for (const vId of validatorIds) {
    // heartbeat BEFORE each validator; a failed heartbeat (ownership lost) aborts locally.
    try { await refreshHeartbeat(d.store, checkpointId, id, d.now); }
    catch { controller.abort(); }
    const result = await d.runValidator(vId, ctx, controller.signal);
    out.push({ validatorId: vId, result });
  }
  return out;
}
```

In `complete`, register/unregister the controller around CLAIM..FINALIZE and gate on abort:

```typescript
const claimed = await claimLease(...); const id = claimed.lease!;
const controller = new AbortController();
LIVE_OPERATIONS.set(checkpointId, controller);
try {
  const perValidator = await executeStepValidators(d, checkpointId, id, validatorIds, { projectPath, target: cp.target }, controller);
  // ... aggregate worst-status, build gate ...
  // outcome.proceed branch finalizes; finalizeLease already rejects if ownership was
  // fenced (identity mismatch), so a fenced op THROWS here and never commits.
  ...
} finally {
  LIVE_OPERATIONS.delete(checkpointId);
}
```

`refreshHeartbeat` failing throws; the helper catches it and aborts the controller so the (cooperative) validator sees `signal.aborted`. Even if the validator ignores the signal, FINALIZE re-checks the full identity and rejects, so the fenced op cannot commit. (Task 9 makes `interrupt`/`stop` call `LIVE_OPERATIONS.get(checkpointId)?.abort()` so a SAME-process priority transition aborts the in-flight controller directly, in addition to the cross-process heartbeat path.)

- [ ] **Step 8.4: Run PASS + commit** - `git commit -m "feat(lane-p4b1): composed AbortSignal (lease-ownership-loss + priority) + heartbeat refresh during EXECUTE"`.

---

## Task 9: Priority interrupt/stop fence a live lease; retry/resume under the lock

**Files:** Modify `lane-runner.ts`; extend `lane-runner-concurrency.test.ts`.

- [ ] **Step 9.1: Failing test** (append) - interrupt over a live lease clears it, bumps the fencing token, sets `interrupted`, and signals the in-process controller:

```typescript
{
  const d = deps(proj);
  const s = await startLane('lane_build', 'x', { projectPath: proj }, 'req-int', d);
  const cp0 = d.store.read(s.checkpointId);
  cp0.lease = { operationId: 'stuck', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp0.revision, fencingToken: cp0.fencingCounter, startedAt: d.now(), heartbeatAt: d.now() };
  d.store.write(cp0);
  const rev = d.store.read(s.checkpointId).revision;
  const ir = await advanceLane(proj, s.checkpointId, { action: 'interrupt', expectedRevision: rev }, d);
  if (ir.lifecycle !== 'interrupted') throw new Error('interrupt sets interrupted even over a live lease');
  const after = d.store.read(s.checkpointId);
  if (after.lease !== null) throw new Error('interrupt clears the fenced lease');
  if (after.fencingCounter <= cp0.fencingCounter) throw new Error('interrupt bumps the fencing token');
  // retry over a (re-seeded) live lease is REJECTED
  const cp1 = d.store.read(s.checkpointId);
  cp1.lifecycle = 'in_progress';
  cp1.lease = { operationId: 'live', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp1.revision, fencingToken: cp1.fencingCounter, startedAt: d.now(), heartbeatAt: d.now() };
  d.store.write(cp1);
  let rejected = false;
  try { await advanceLane(proj, s.checkpointId, { action: 'retry', expectedRevision: d.store.read(s.checkpointId).revision }, d); } catch { rejected = true; }
  if (!rejected) throw new Error('retry over a live lease must be rejected');
  console.log('lane-runner-concurrency interrupt-fence: OK');
}
```

- [ ] **Step 9.2: Run FAIL** - interrupt cannot currently fence a live lease; retry is not blocked.

- [ ] **Step 9.3: Implement priority transitions under the lock** - `interrupt` and `stop` run under `withCheckpointLock(d.store.dir(), checkpointId, ...)`: read cp, verify `expectedRevision` against the CURRENT on-disk revision, then atomically clear any lease, increment `fencingCounter` (fence), set lifecycle/outcome + audit, bump revision, write. They do NOT require lease ownership. AFTER writing, call `LIVE_OPERATIONS.get(checkpointId)?.abort()` so a same-process in-flight EXECUTE aborts immediately (cross-process ops observe ownership loss on their next heartbeat). `resume` (interrupted-only) and `retry` also move under the lock; the ordinary-transition live-lease guard from Task 6.3 already rejects `retry`/`resume` when a live lease exists - keep both (the guard rejects fast; the lock keeps the write race-safe). Keep all transitions consistent with `lane-runner-transitions.test.ts` (interrupted=resume-only, audited).

- [ ] **Step 9.4: Run PASS + commit** - existing transitions suite stays green; `git commit -m "feat(lane-p4b1): interrupt/stop fence a live lease + abort the in-process controller; retry/resume under the lock"`.

---

## Task 10: Engine wiring (laneDeps) + crash + timeout-retry recovery

**Files:** Modify `sidecoach-orchestrator.ts`; extend `lane-runner-concurrency.test.ts` + `lane-engine-methods.test.ts`.

- [ ] **Step 10.1: Wire `laneDeps`** - add `newOperationId` (random in production is fine) and `runValidator` (resolve the registration and call its async `validateProduct`):

```typescript
import { createHash } from 'crypto';   // already imported in this file - do NOT add a duplicate
import { getValidatorRegistration } from './flow-validation-capabilities';
// in laneDeps return object:
newOperationId: () => 'op-' + createHash('sha256').update(`${process.pid}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16),
runValidator: async (validatorId, validatorContext, signal) => {
  const reg = getValidatorRegistration(validatorId);
  if (!reg || !reg.validateProduct) throw new Error(`laneDeps.runValidator: no validator "${validatorId}"`);
  return reg.validateProduct(validatorContext, signal);
},
```

(Confirm `createHash` is already imported in `sidecoach-orchestrator.ts` before adding - the P3 plan notes it is; do NOT duplicate the import.)

- [ ] **Step 10.2: Engine round-trip test** - extend `lane-engine-methods.test.ts`: a full engine `startLane('lane_build')` then `advanceLane(complete shape)` then `advanceLane(complete craft)` runs through the real async validators (the craft step binds `polish-standard`; on an empty temp project its required rules are inconclusive -> the gate is `validation_inconclusive`, so the step STAYS at craft). Assert `currentVerb === 'craft'` and `gate.status === 'inconclusive'`. (This documents that a real empty project does not pass the static floor - it is the honest gating behavior, not a bug.)

- [ ] **Step 10.3: Crash-stale reclaim + timeout-retry overlap** - append to the concurrency suite:
  - **Crash reclaim:** write a checkpoint carrying a STALE lease (heartbeatAt far in the past); assert the next `advanceLane(complete)` reclaims it (claimLease stale path, logged) and commits.
  - **Timeout-retry overlap (at-most-one commit):** a slow validator (awaits a barrier) holds operation A in-flight; operation A's lease goes stale (inject `staleMs: 1` + an old heartbeat, or advance the injected clock); operation B (a fresh `advanceLane`) reclaims the stale lease and commits; when A finally returns, its FINALIZE is REJECTED (identity superseded). Assert exactly one committed `craft` and one authoritative sink entry.

- [ ] **Step 10.4: Run PASS + commit** - `git commit -m "feat(lane-p4b1): engine laneDeps wires operationId + async runValidator; crash + timeout-retry recovery proven"`.

---

## Task 11: Final integration check

- [ ] **Step 11.1:** `cd sidecoach && npx ts-node scripts/generate-lanes.ts --check && npx ts-node scripts/generate-validators.ts --check && npm run build && npm test` gives both `--check` OK, build exit 0, and `run-tests: 33 suite(s) passed` (27 baseline + migration + lock + lease + validator-gating + concurrency + side-effect-outbox). Every new suite present and `required: true`.
- [ ] **Step 11.2:** P1 hook regression green (the sidecoach-keyword harness: `bash claude/hooks/test-sidecoach-keyword.sh` from the repo root - the same gate P2/P3/P4a ran; expect its prior pass counts unchanged).
- [ ] **Step 11.3: Deferral leak check** - `git diff --name-only main..lane-p4b1-validator-execution-durability | grep -E 'convergence|loop-exec|browser-evidence|mcp-server/' && echo LEAK || echo clean` (P4b-1 must NOT touch the convergence floor, loop execution, the browser-evidence collector, or the MCP server).
- [ ] **Step 11.4: Rebuild + commit ONLY the lane-related dist** - the changes touch `lane-types`, `lane-checkpoint-store`, `lane-runner`, `lane-lock`, `lane-validators`, `lane-side-effect-sink`, `flow-validation-capabilities`, `validators/run-validator`, `sidecoach-orchestrator`. Stage only those `dist/` files + the new source/test files - never `git add -A`. Verify the CLI runs from the committed tree (stash dirty dist, run `npx ts-node src/__tests__/lane-cli.test.ts`, pop). Commit: `git commit -m "build(lane-p4b1): rebuild lane dist"`.

---

## Deferred (do NOT build here)

- Loop execution, `lane_converge` enablement, the convergence release-floor (P4c). Loop lanes stay rejected at `startLane`.
- The browser-evidence collector (P4b-2): browser-only rules keep returning `inconclusive`; they are non-required and do not block gating. The validator `context` passed from the lane is `{ projectPath, target }` only; P4b-2 enriches it with DOM/computed-style/contrast evidence.
- MCP migration + transport-timeout signal composition (P4d). The composed AbortSignal in P4b-1 covers lease-ownership-loss + in-process priority cancellation only.
- Copy gating (P4e). A second declared outbox publisher (e.g. surfacing lane runs into the global cross-session FlowHistory) can be added later by reading the SAME committed outbox record; P4b-1 deliberately keeps the global FlowHistory writer untouched.

---

## Self-Review (apply the P3 + P4a lessons)

- **At-most-one COMMITTED transition, not exactly-once execution** (spec line 696). Tasks 6/8/10 prove exactly one commit under concurrency, timeout-retry overlap, and crash; the language in every test/comment says "committed", never "executed once". Do not overclaim.
- **Full lease identity on FINALIZE/heartbeat** (spec lines 709-712): `finalizeLease`/`refreshHeartbeat` match the full `{operationId, stepId, iteration, claimedCheckpointRevision, fencingToken}` captured from `claimLease`'s return - never operationId alone, never a re-read outside the lock.
- **All checkpoint writes under the lock:** `complete`/`skip` claim+finalize; `retry`/`resume`/`interrupt`/`stop` run under the lock; `serveStep` persists via a locked re-read+merge of just its `servedSteps[key]`; ordinary transitions are rejected while a live lease exists; only `interrupt`/`stop` supersede it.
- **Race-safe lock** (owner token + mtime-grace for the create->write window + owned-release): reused verbatim from the Codex-reviewed P3 plan; the lock test covers the stale-reclaim and foreign-live-lock cases.
- **Validators pure/idempotent during EXECUTE; side effects publish ONLY from the committed outbox** (spec lines 713-723). The lane validators are read-only (collect + checkProduct -> findings; they write nothing). The single committed side effect (the step-completion record) is buffered in the finalize mutate and published through the fencing-conditional sink; a superseded op cannot create the committed outbox record, so it cannot publish.
- **Trace every new symbol to a caller in its task:** `withCheckpointLock` -> claimLease/finalizeLease/refreshHeartbeat/publishOutbox/sink (Tasks 2/3/7); claim/finalize/heartbeat -> advanceLane (Tasks 6/8); `validatorsForStep`/`aggregateWorstStatus`/`mapGateStatusToOutcome` -> advanceLane (Tasks 5/6); `LaneSideEffectSink`/`publishOutbox` -> the clean-FINALIZE branch (Task 7); `newOperationId`/`runValidator` -> advanceLane, supplied by `laneDeps` (Tasks 6/10); `LIVE_OPERATIONS` -> executeStepValidators + interrupt/stop (Tasks 8/9).
- **No changelog-vs-body drift:** there is no separate changelog section; the body IS the spec. Every code block is grounded in the live signatures read at authoring time (`LaneCheckpoint`, `LaneRunnerDeps`, `evaluateCleanPolicy`'s `validatorError` path, `FLOW_CAPABILITIES`).

### Resolved spec ambiguities (flag these to the reviewer)

1. **Multi-flow step -> which validators gate.** A sequence step maps to `step.flowIds` (e.g. lane_build's "craft" binds flowI/flowM/flowJ). The bound validators are the de-duplicated UNION of `getFlowCapability(flowId).productValidatorIds` across those flows (`validatorsForStep`, Task 5). flowJ binds `polish-standard`; the advisory flows (flowI/flowM) bind none; so "craft" gates on `polish-standard` alone. Each validator runs once even if two flows reference it.
2. **Worst-status total order.** The spec lists the mapping (clean/findings/inconclusive/error) but not the cross-validator precedence when bound validators disagree. Resolved as `error > findings > inconclusive > clean`: an unevaluable gate (error) is loudest (the verdict set cannot be trusted), a confirmed blocking defect (findings) outranks an unverified gap (inconclusive), clean is best. Encoded + tested in `aggregateWorstStatus` (Task 5).
3. **Outbox vs the existing flow-history writer.** The lane execution path writes NO flow-history today - the `FlowHistory` singleton (`recordFlow`, `~/.claude/sidecoach-flow-history.json`) is used only by the non-lane `process()` path. So the outbox does NOT wrap an existing FlowHistory call. P4b-1 introduces the lane's FIRST durable side effect (the committed step-completion record) and routes it through a DEDICATED `LaneSideEffectSink` (fencing-conditional upsert), leaving the global FlowHistory writer untouched to avoid regressing the non-lane engine. A future phase can register FlowHistory as a second publisher reading the same committed outbox record.
