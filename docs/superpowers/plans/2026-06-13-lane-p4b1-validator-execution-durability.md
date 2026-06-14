# Lane P4b-1 - Sequence-Lane Validator Gating + Async Execution Durability - v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Every task is failing-test-first, then real implementation, then exact verify commands, then a commit. Do NOT batch tasks. Do NOT weaken a test to make it pass.

## Goal

Make SEQUENCE lanes GATE on their product validators during `advanceLane`, and run those validators as ASYNC work protected by the operation-lease durability protocol. This folds two previously-separate designs into one phase, because the async validators are exactly what gives the durability machinery a purpose:

- **(A) Validator gating** (spec section 7, lines 322-365). At a sequence step's completion, run every product validator BOUND to that step's flow(s), aggregate their statuses worst-wins, and map the result deterministically: `clean` -> completion proceeds; `findings` -> `validation_failed` (step stays current, findings returned); `inconclusive` -> `validation_inconclusive` (step stays current); `error` -> `validation_error` (step stays current). Only an explicit user `skip` or `stop` bypasses an unclean / inconclusive / errored required step (recorded with its reason).
- **(B) Async durability** (spec section 7, lines 651-735; checkpoint schema v2 line 770). Wrap the now-ASYNC `advanceLane` in the operation-lease protocol: CLAIM (O_EXCL lock, expectedRevision check, write a lease, bump revision, release the lock) -> EXECUTE the async validators under an AbortSignal derived from the lease, refreshing `heartbeatAt`, collecting side effects in an operation-local buffer (NOT writing them yet) -> FINALIZE (O_EXCL lock, verify the SAME full lease identity still owns, write the step result + a side-effect outbox record keyed by `(checkpointId, committedRevision)` carrying the `fencingToken`, clear the lease, bump revision) -> PUBLISH the outbox idempotently (the downstream sink conditionally upserts by fencing token).
- **(C) First-step durability** (spec line 286). `startLane` uses the start-request lock only to atomically map `startRequestId` to one checkpoint and create its first-step lease. It releases that lock before any async flow handler runs, then executes first-step serving under the same lease identity and FINALIZE/outbox protocol as advancement.

**The guarantee is AT-MOST-ONE COMMITTED LANE TRANSITION, not exactly-once execution** (spec line 696). Two bodies may overlap; the lease fences which RESULT commits. `interrupt` / `stop` are priority transitions that fence a live lease, bump the token, and signal the in-process AbortController. A second ordinary advance finding a live lease (fresh heartbeat) is REJECTED; a stale lease (dead heartbeat) is reclaimable and logged.

## Architecture

P2 left a `bump()` re-read as a best-effort in-process guard and a SYNCHRONOUS `advanceLane`. P3 (designed in `2026-06-13-lane-p3-durability.md`, never executed) added the lock + lease + fencing + schema-v2 against a synchronous EXECUTE body. P4b-1 BUILDS that P3 durability AND fills the EXECUTE body with the real async validators, so:

- `LaneCheckpoint` migrates v1 -> v2 (adds `fencingCounter`, `lease`, and a typed `sideEffectOutbox`).
- `advanceLane`'s mutating actions (`complete`, `skip`) run CLAIM / EXECUTE / FINALIZE under an O_EXCL file lock. The lock guards CLAIM and FINALIZE only; the async EXECUTE runs WITHOUT a held file lock, marked in-flight by the persisted lease.
- `complete` discovers the step's bound validators (union over `step.flowIds` via `FLOW_CAPABILITIES`), runs each async `validateProduct` under a composed AbortSignal with heartbeat refresh, aggregates worst-status, and either commits (clean) or releases the lease without advancing (unclean), with the validation result returned.
- Committed side effects publish only from the FINALIZE-written outbox record, through the authoritative P4b-1 fencing-token-conditional `LaneSideEffectSink`. Replay after a crash is idempotent, and every lane start/advance first replays pending records so a crash after FINALIZE cannot strand one.
- `interrupt` / `stop` fence a live lease and abort the matching in-process controller; `resume` / `retry` reject a live lease and fence/clear a stale lease under the lock before mutating.

**Why fold P3 into P4b-1.** P3's lease/outbox/heartbeat/AbortSignal machinery is untestable when the EXECUTE body is synchronous (it protects nothing). The async validators introduce the long EXECUTE body and the real side effect to protect, so the durability is built here, where it has teeth. P4b-1 keeps the P3 lease/fencing/schema direction but replaces its stale-lock deletion with race-safe atomic takeover.

## Scope discipline (P4b-1 ONLY)

BUILD: sequence-lane validator gating + the full lease / lock / fencing / schema-v2 / outbox / AbortSignal durability for the async EXECUTE.

AUTHORITATIVE P4b-1 SIDE EFFECT: the dedicated `LaneSideEffectSink` is the only lane side-effect publisher in this phase. Do NOT retrofit the existing global `FlowHistory` writer: it belongs to the non-lane `process()` path, and changing it here risks regressing that engine and the 27 green baseline suites. Schedule `P4f - Lane FlowHistory Conditional Publisher` to add a second conditional publisher that reads the SAME committed outbox record.

DO NOT BUILD (later phases):
- Loop execution, `lane_converge` enablement, the convergence release-floor (P4c). Loop lanes stay REJECTED at `startLane` exactly as P2 left them.
- The browser-evidence collector (P4b-2). Browser-only validator rules (evidence `dom` / `computed-style` / `contrast`) keep returning `inconclusive` from their `checkProduct`; because they are NON-required (not in any static validator's `requiredRuleIds` after the P4a partial-static floor), they do NOT force a validator's overall status to `inconclusive` and therefore do NOT block gating. P4b-1 changes nothing about which rules are required.
- The MCP migration / transport-timeout signal composition (P4d). In P4b-1 the composed AbortSignal covers lease-ownership-loss + in-process priority cancellation only; transport-timeout composition is P4d (the MCP server does not propagate a signal today, spec lines 724-726).
- Copy gating (P4e).
- The `P4f - Lane FlowHistory Conditional Publisher`. It will consume the same committed outbox record after P4b-1; it does not change lane commit identity or the authoritative P4b-1 sink.

## Tech Stack

TypeScript (`sidecoach/src/`), `fs` O_EXCL locking, the ts-node SUITES runner `sidecoach/scripts/run-tests.ts` (explicit `required: true`). Production code MAY use `Date.now()` / `Math.random()` / `process.hrtime` (banned only in workflow scripts; test modules inject deterministic clocks).

---

## File Structure

**Create:**
- `sidecoach/src/lane-lock.ts` - `withCheckpointLock(dir, checkpointId, fn, opts?)`: O_EXCL lockfile acquire/release with rename-based atomic stale-lock takeover. Guards CLAIM and FINALIZE only (NOT the async EXECUTE).
- `sidecoach/src/lane-validators.ts` - pure helpers: `validatorsForStep(step)` (FLOW_CAPABILITIES discovery), `aggregateWorstStatus(results)`, `mapGateStatusToOutcome(status)`.
- `sidecoach/src/lane-side-effect-sink.ts` - `LaneSideEffectSink`: fencing-token-conditional upsert store (the outbox's downstream publisher).
- Tests: `sidecoach/src/__tests__/lane-checkpoint-migration.test.ts`, `lane-lock.test.ts`, `lane-lease.test.ts`, `lane-validator-gating.test.ts`, `lane-runner-concurrency.test.ts`, `lane-side-effect-outbox.test.ts`.

**Modify:**
- `sidecoach/src/lane-types.ts` - add `LeaseRecord`, `SideEffectEntry`, `SideEffectOutboxRecord`; extend `LaneStepResult` with an optional `gate` field and extend `LaneState` with spec-required per-step statuses including the three `validation_*` states.
- `sidecoach/src/lane-checkpoint-store.ts` - schema v2 (`fencingCounter`, `lease`, `sideEffectOutbox`, latest per-step gate status), v1 -> v2 read migration, write asserts v2, make `dir()` public, add `claimLease` / `finalizeLease` / `leaseIsLive` / `refreshHeartbeat` / `publishOutbox`.
- `sidecoach/src/lane-runner.ts` - async `startLane` first-step CLAIM/EXECUTE/FINALIZE and async `advanceLane` CLAIM/EXECUTE/FINALIZE; validator gating on `complete`; lease-fencing on `interrupt`/`stop` and stale `retry`/`resume`; full-identity live-operation registry; continuous ownership-checking heartbeat loop; `serveStep` locked merge; startup/advance outbox replay; new deps (`newOperationId`, `runValidator`, optional deterministic barriers, `staleMs`, `heartbeatIntervalMs`).
- `sidecoach/src/validators/run-validator.ts` - `makeProductValidator` returns an ASYNC `validateProduct(context, signal?) => Promise<ProductValidationResult>` with cooperative abort.
- `sidecoach/src/flow-validation-capabilities.ts` - `ProductValidatorRegistration.validateProduct` retyped async.
- `sidecoach/src/sidecoach-orchestrator.ts` - `laneDeps` supplies `newOperationId` + `runValidator` (wired to the registrations) + a deterministic clock passthrough.
- `sidecoach/src/__tests__/product-validator-pipeline.test.ts`, `validator-fixtures-e2e.test.ts` - `await` the now-async `validateProduct` (contract-change fixups in the same task).
- `sidecoach/src/__tests__/lane-checkpoint-store.test.ts` - write a v2 literal, expect v3 rejection (was v1 -> expect-v2-rejection).
- `sidecoach/scripts/run-tests.ts` - register every new suite `required: true`.

**Read-only references:** spec lines 270-365 (execution + gating), 651-735 (lease protocol), 765-789 (schema v2). The P3 plan `2026-06-13-lane-p3-durability.md` is historical context only; do not copy its blind stale-lock unlink.

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
  if (Object.keys(cp.stepGateStatuses).length !== 0) throw new Error('migration seeds stepGateStatuses {}');
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

export type PersistedStepGateStatus = 'clean' | 'validation_failed' | 'validation_inconclusive' | 'validation_error';
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

Change `LaneCheckpoint.schemaVersion` to `2`; add `fencingCounter: number; lease: LeaseRecord | null; sideEffectOutbox: SideEffectOutboxRecord[]; stepGateStatuses: Record<string, PersistedStepGateStatus>;`. Import the new types. The key is `${stepId}:${iteration}` and records the latest finalized gate status for that current step attempt. Make `dir()` PUBLIC (the lock and helpers need it). Replace `read`/`write`:

```typescript
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry, LeaseRecord, SideEffectOutboxRecord } from './lane-types';
// interface LaneCheckpoint: schemaVersion: 2; ... fencingCounter: number; lease: LeaseRecord | null;
// sideEffectOutbox: SideEffectOutboxRecord[]; stepGateStatuses: Record<string, PersistedStepGateStatus>;

dir(): string { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); }   // was private

private migrate(raw: any): LaneCheckpoint {
  if (raw.schemaVersion === 2) {
    return { ...raw, sideEffectOutbox: Array.isArray(raw.sideEffectOutbox) ? raw.sideEffectOutbox : [],
      stepGateStatuses: raw.stepGateStatuses && typeof raw.stepGateStatuses === 'object' ? raw.stepGateStatuses : {} } as LaneCheckpoint;
  }
  if (raw.schemaVersion === 1) {
    return { ...raw, schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {} } as LaneCheckpoint;
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

- [ ] **Step 1.5: `startLane` creates v2** - in `lane-runner.ts`, the `cp` literal in `startLane` must set `schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {}` (otherwise `write()`'s v2 assert throws). Add the fields to the existing object literal. (The concurrent-start lock and first-step lease come in Task 3; this step only fixes schema fields.)

- [ ] **Step 1.6: Update the existing store test** - in `lane-checkpoint-store.test.ts`, any literal that writes `schemaVersion: 1` and expects a v2-rejection becomes a `schemaVersion: 2` literal (adding `fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {}`) expecting a v3-rejection. Any in-test v2 checkpoint literal must include the new fields.

- [ ] **Step 1.7: Run PASS + register + commit**

```bash
cd sidecoach
npx ts-node src/__tests__/lane-checkpoint-migration.test.ts   # prints "lane-checkpoint-migration: OK"
npm run build && npm test                                      # all green; startLane writes v2
```

Add `{ rel: 'src/__tests__/lane-checkpoint-migration.test.ts', required: true },` to `scripts/run-tests.ts` SUITES. Stage `lane-types.ts`, `lane-checkpoint-store.ts`, `lane-runner.ts`, the two test files, `scripts/run-tests.ts`. Commit: `git commit -m "feat(lane-p4b1): checkpoint schema v2 (fencingCounter, lease, typed sideEffectOutbox) + v1-to-v2 migration"`.

---

## Task 2: O_EXCL checkpoint lock with race-safe stale takeover

**Files:** Create `lane-lock.ts`, `lane-lock.test.ts`.

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

  // stale (old content timestamp) -> reclaimable by atomic rename takeover
  const lockPath = path.join(dir, 'cp2.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ owner: 'gone', pid: 999999, at: new Date(0).toISOString() }));
  let acquired = false;
  await withCheckpointLock(dir, 'cp2', async () => { acquired = true; }, { staleMs: 1 });
  if (!acquired) throw new Error('stale lock must be reclaimable');

  // ADVERSARIAL stale takeover: both reclaimers observe the same stale lock.
  // The injected barrier releases both immediately before renameSync. Exactly
  // one rename can claim that path; the loser retries and cannot enter while held.
  const p3 = path.join(dir, 'cp3.lock');
  fs.writeFileSync(p3, JSON.stringify({ owner: 'dead', pid: 999999, at: new Date(0).toISOString() }));
  let takeoverArrivals = 0; let releaseTakeovers!: () => void;
  const takeoversReady = new Promise<void>((r) => { releaseTakeovers = r; });
  const beforeTakeover = async () => { if (++takeoverArrivals === 2) releaseTakeovers(); await takeoversReady; };
  let inside = 0; let maxInside = 0; let entered = 0; let releaseWinner!: () => void;
  const winnerHeld = new Promise<void>((r) => { releaseWinner = r; });
  const body = async () => { entered++; inside++; maxInside = Math.max(maxInside, inside); await winnerHeld; inside--; };
  const a = withCheckpointLock(dir, 'cp3', body, { ownerToken: 'a', staleMs: 1, retries: 0, __beforeStaleTakeover: beforeTakeover });
  const b = withCheckpointLock(dir, 'cp3', body, { ownerToken: 'b', staleMs: 1, retries: 0, __beforeStaleTakeover: beforeTakeover });
  while (entered === 0) await new Promise((r) => setTimeout(r, 1));
  await new Promise((r) => setTimeout(r, 5));
  if (entered !== 1 || maxInside !== 1) throw new Error('exactly one simultaneous stale reclaimer enters');
  releaseWinner();
  const settled = await Promise.allSettled([a, b]);
  if (settled.filter((x) => x.status === 'fulfilled').length !== 1) throw new Error('only takeover winner fulfills with retries:0');

  // Real reclaimed-owner release: owner A is still running after its lock is
  // made stale and atomically replaced by B. A's finally must not delete B's lock.
  let releaseA!: () => void; const holdA = new Promise<void>((r) => { releaseA = r; });
  let releaseB!: () => void; const holdB = new Promise<void>((r) => { releaseB = r; });
  const ownerA = withCheckpointLock(dir, 'cp4', async () => { await holdA; }, { ownerToken: 'owner-a' });
  while (!fs.existsSync(path.join(dir, 'cp4.lock'))) await new Promise((r) => setTimeout(r, 1));
  fs.writeFileSync(path.join(dir, 'cp4.lock'), JSON.stringify({ owner: 'owner-a', pid: process.pid, at: new Date(0).toISOString() }));
  const ownerB = withCheckpointLock(dir, 'cp4', async () => { await holdB; }, { ownerToken: 'owner-b', staleMs: 1 });
  while (JSON.parse(fs.readFileSync(path.join(dir, 'cp4.lock'), 'utf8')).owner !== 'owner-b') await new Promise((r) => setTimeout(r, 1));
  releaseA(); await ownerA;
  if (JSON.parse(fs.readFileSync(path.join(dir, 'cp4.lock'), 'utf8')).owner !== 'owner-b') throw new Error('reclaimed owner finally deleted replacement lock');
  releaseB(); await ownerB;
  console.log('lane-lock: OK');
}
run();
```

- [ ] **Step 2.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-lock.test.ts` fails with `Cannot find module '../lane-lock'`.

- [ ] **Step 2.3: Implement `lane-lock.ts` with atomic rename takeover**

```typescript
// sidecoach/src/lane-lock.ts
import * as fs from 'fs';
import * as path from 'path';

export interface LockOpts {
  retries?: number; retryDelayMs?: number; staleMs?: number; ownerToken?: string;
  __beforeStaleTakeover?: () => Promise<void>; // deterministic adversarial test seam
}
const LOCK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// O_EXCL lock with a UNIQUE owner token. Three correctness properties:
// (a) a newly-created lock mid-write (unparseable/empty content) is NOT treated as
//     immediately stale - staleness for unparseable content falls back to FILE
//     MTIME, so a concurrent reader in the create->write window waits (grace) while
//     a genuinely crashed-mid-write lock (old mtime) is still reclaimable;
// (b) stale takeover is an atomic rename to a unique per-attempt path. Never
//     blind-unlink the shared lock path. Only the reclaimer whose rename succeeds
//     owns the stale file and may unlink that renamed claim;
// (c) release also atomically renames to a unique claim before checking owner,
//     then unlinks only that claimed file. It never check-then-unlinks lockPath.
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
      if (stale) {
        await opts.__beforeStaleTakeover?.();
        const claimPath = `${lockPath}.stale-${myToken}-${attempt}`;
        try {
          fs.renameSync(lockPath, claimPath);                 // atomic: one reclaimer wins
          const claimed = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
          if (!claimed || claimed.owner !== info?.owner) {
            // The shared path changed after our stale observation. Restore only
            // with linkSync's no-replace behavior; never rename over a new lock.
            try { fs.linkSync(claimPath, lockPath); fs.unlinkSync(claimPath); } catch { /* quarantine claim; do not unlink/overwrite shared path */ }
            throw new Error('withCheckpointLock: stale takeover identity changed');
          }
          fs.unlinkSync(claimPath);                           // unlink only the file this attempt won
          continue;                                          // next loop creates our O_EXCL lock
        } catch (takeover: any) {
          if (takeover.code !== 'ENOENT' && !String(takeover.message).includes('identity changed')) throw takeover;
        }
      }
      if (attempt++ >= retries) throw new Error(`withCheckpointLock: could not acquire "${checkpointId}" after ${retries} retries`);
      await sleep(delay);
    }
  }
  try { return await fn(); }
  finally {
    const releasePath = `${lockPath}.release-${myToken}`;
    try {
      fs.renameSync(lockPath, releasePath);                   // atomically claim what is currently at lockPath
      const cur = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
      if (cur && cur.owner === myToken) fs.unlinkSync(releasePath);
      else {
        // We atomically claimed a replacement, not ours. Restore without replacing
        // any newer shared lock; remove the claim name only after the shared link exists.
        try { fs.linkSync(releasePath, lockPath); fs.unlinkSync(releasePath); } catch { /* quarantine; do not delete foreign lock */ }
      }
    } catch { /* gone/unparseable/foreign - never blind-unlink lockPath */ }
  }
}
function nowIso(): string { return new Date(Date.now()).toISOString(); }
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
```

- [ ] **Step 2.4: Run PASS + register + commit** - `cd sidecoach && npx ts-node src/__tests__/lane-lock.test.ts` prints `lane-lock: OK`; add `{ rel: 'src/__tests__/lane-lock.test.ts', required: true },` to SUITES; run `npm run build && npm test`; commit with `git commit -m "feat(lane-p4b1): race-safe O_EXCL lock takeover and owned release"`.

---

## Task 3: Lease CLAIM / FINALIZE / heartbeat + first-step start lease

**Files:** Modify `lane-checkpoint-store.ts` (helpers), `lane-runner.ts` (`startLane` start-lock and first-step lease); Create `lane-lease.test.ts`.

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
    fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {},
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

- [ ] **Step 3.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-lease.test.ts` fails because `claimLease` is not exported.

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

- [ ] **Step 3.4: Failing first-step lease test** - append an async test to `lane-lease.test.ts` using a `runFlow` barrier. Start `startLane`, wait until the first flow handler enters, then acquire the SAME `start-<hash>` lock with `retries: 0`; it MUST acquire while the handler is still blocked, proving no async `serveStep` runs under the start-request lock. While blocked, read the checkpoint and assert a first-step lease exists. Release the handler, await `startLane`, then assert the lease is cleared and the served first-step effects are persisted only by FINALIZE. Call `startLane` again with the same request ID and assert it returns the same checkpoint without running the handler again.

Import `createHash`, `withCheckpointLock`, and `startLane`; define local `deps` and `okFlow` fixtures matching the merged `LaneRunnerDeps` / `FlowExecutionResult` signatures.

```typescript
let entered!: () => void, release!: () => void, flowCalls = 0;
const flowEntered = new Promise<void>((r) => { entered = r; });
const holdFlow = new Promise<void>((r) => { release = r; });
const d = deps(proj, async (flowId) => { flowCalls++; entered(); await holdFlow; return okFlow(flowId); });
const starting = startLane('lane_build', 'first-step', { projectPath: proj }, 'req-first-step', d);
await flowEntered;
const cp = d.store.findByStartRequestId('req-first-step')!;
if (!cp.lease || cp.lease.stepId !== 'shape') throw new Error('checkpoint must persist first-step lease before handler execute');
const startLockId = 'start-' + createHash('sha256').update('req-first-step').digest('hex').slice(0, 40);
let acquiredWhileHandlerBlocked = false;
await withCheckpointLock(d.store.dir(), startLockId, () => { acquiredWhileHandlerBlocked = true; }, { retries: 0 });
if (!acquiredWhileHandlerBlocked) throw new Error('start-request lock must be released before serving');
release();
const first = await starting;
const finalized = d.store.read(first.checkpointId);
if (finalized.lease !== null || !finalized.servedSteps['0:0']) throw new Error('first-step effects must FINALIZE under lease');
const callsAfterFirst = flowCalls;
const retried = await startLane('lane_build', 'first-step', { projectPath: proj }, 'req-first-step', d);
if (retried.checkpointId !== first.checkpointId || flowCalls !== callsAfterFirst) throw new Error('retried start must not re-run first-step handlers');
```

- [ ] **Step 3.5: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-lease.test.ts` fails because current `startLane` serves while holding the start lock and creates no first-step lease.

- [ ] **Step 3.6: Start-request lock creates mapping + first-step lease only** - under a lock keyed by the start request, perform ONLY idempotent lookup or checkpoint + first-step lease creation. Do not call or await `serveStep`, `runFlow`, validators, or any other handler while this lock is held:

```typescript
import { createHash } from 'crypto';
import { withCheckpointLock } from './lane-lock';
// in startLane, after validating startRequestId + resolving the lane (l):
const startLockId = 'start-' + createHash('sha256').update(startRequestId).digest('hex').slice(0, 40);
const start = await withCheckpointLock(d.store.dir(), startLockId, () => {
  const existing = d.store.findByStartRequestId(startRequestId);
  if (existing && !isClosed(existing.lifecycle)) {
    if (existing.laneId !== laneId) throw new Error(`startLane: startRequestId already maps to active lane "${existing.laneId}"`);
    return { checkpoint: existing, created: false, identity: existing.lease };
  }
  const ts = d.now();
  const operationId = d.newOperationId();
  const cp: LaneCheckpoint = { schemaVersion: 2, checkpointId: d.newCheckpointId(), laneId, target,
    executionKind: l.executionKind, lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId,
    seenReportIds: [], fencingCounter: 1, sideEffectOutbox: [], stepGateStatuses: {},
    lease: { operationId, stepId: l.verbSteps[0].verb, iteration: 0, claimedCheckpointRevision: 0,
      fencingToken: 1, startedAt: ts, heartbeatAt: ts },
    createdAt: ts, updatedAt: ts };
  cp.revision = 1; // first-step CLAIM is persisted atomically with the mapping
  d.store.write(cp);
  return { checkpoint: cp, created: true, identity: cp.lease };
});
```

After the start-request lock is RELEASED:

- If `created` is false, return the existing checkpoint's current state. Do not re-run initial handlers. If its first-step lease is live, report it as in-flight; normal retry/recovery can reclaim it once stale.
- If `created` is true, call `serveStepUnderLease(start.checkpoint, l, context, d, start.identity!)`. It runs first-step flow handlers during EXECUTE, buffers their served-step persistent effects operation-locally, then calls `finalizeLease` with the SAME full identity to merge `servedSteps[key]` and clear the lease. It does not write the captured checkpoint directly.
- Task 7 adds the first-step committed outbox record inside this FINALIZE and publishes it afterward. Thus both start and advance use CLAIM/EXECUTE/FINALIZE/outbox, without holding the start lock across async work.

- [ ] **Step 3.7: Run PASS + register + commit** - `cd sidecoach && npx ts-node src/__tests__/lane-lease.test.ts` prints `lane-lease: OK`; add it to SUITES `required: true`; run `npm run build && npm test`; commit with `git commit -m "feat(lane-p4b1): lease helpers and first-step start lease"`.

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

## Task 6: advanceLane async CLAIM / EXECUTE / FINALIZE, validator gating, and persisted status

Rewrite `advanceLane`'s mutating actions to claim a lease, run the validators as the async EXECUTE, then finalize. PRESERVE every P2 guard (report present + >=1 evidence, stepId/iteration match, dup-reportId-on-in_progress no-op, full-serve required, successfulFlowIds-only attestation, interrupted=resume-only, closed-rejects, stale-revision rejection). This task does the gate logic + the concurrency guarantee; the outbox record + publish is Task 7, the abort/heartbeat plumbing is Task 8.

**Files:** Modify `lane-runner.ts`, `lane-types.ts`; Create `lane-runner-concurrency.test.ts`; existing advance suites must stay green.

- [ ] **Step 6.1: Failing test (gate + the core concurrency guarantee)**

```typescript
// sidecoach/src/__tests__/lane-runner-concurrency.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, finalizeLease, leaseIsLive } from '../lane-checkpoint-store';
import { withCheckpointLock } from '../lane-lock';
import { startLane, advanceLane, laneStatus, LaneRunnerDeps } from '../lane-runner';
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

  // (4) every non-clean mapping persists and remains visible on a later status read.
  for (const [gateStatus, stepStatus] of [
    ['findings', 'validation_failed'],
    ['inconclusive', 'validation_inconclusive'],
    ['error', 'validation_error'],
  ] as const) {
    const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `lane-status-${gateStatus}-`)));
    const d = deps(p, async () => ({ ...okResult(), status: gateStatus } as ProductValidationResult));
    const s = await startLane('lane_build', gateStatus, { projectPath: p }, `req-${gateStatus}`, d);
    await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
    await advanceLane(p, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: `r:${gateStatus}` }, expectedRevision: d.store.read(s.checkpointId).revision }, d);
    const later = await laneStatus(p, s.checkpointId, d);
    const craft = later.steps.find((x) => x.verb === 'craft');
    if (craft?.status !== stepStatus) throw new Error(`${gateStatus} must persist as ${stepStatus}; got ${craft?.status}`);
  }
  console.log('lane-runner-concurrency: OK');
}
run();
```

- [ ] **Step 6.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts` fails because `newOperationId` / `runValidator` are undefined, both concurrent advances commit, persisted gate status is missing, or the serve-step interleaving clobbers state.

- [ ] **Step 6.3: Rewrite the mutating path in `lane-runner.ts`**

Add to `LaneRunnerDeps`:

```typescript
newOperationId: () => string;
runValidator: (validatorId: string, validatorContext: { projectPath: string; target: string }, signal?: AbortSignal) => Promise<ProductValidationResult>;
staleMs?: number;                              // default 30000
__claimBarrier?: () => Promise<void>;          // test seam only
__beforeServePersist?: () => Promise<void>;    // deterministic stale-snapshot interleaving seam
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
const persistedStatus = outcome.proceed ? 'clean' : outcome.stepStatus;

if (outcome.proceed) {
  const final = await finalizeLease(d.store, checkpointId, id, (c) => {
    c.stepGateStatuses[`${step.verb}:${c.iteration}`] = persistedStatus;
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
  c.stepGateStatuses[`${step.verb}:${c.iteration}`] = persistedStatus;
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

**`laneStatus` status mapping:** extend `LaneState` in `lane-types.ts` with the spec-required `steps: { verb: string; flowIds: FlowId[]; status: 'pending' | 'current' | 'completed' | 'skipped' | 'validation_failed' | 'validation_inconclusive' | 'validation_error' }[]`. When building it in `laneStatus`, consult `cp.stepGateStatuses[`${step.verb}:${iteration}`]` for the current step before defaulting it to `current`. Completed/skipped states still win for past steps. This is persisted checkpoint state, not a response-only `gate`, so a later independent `laneStatus` call reports `validation_failed`, `validation_inconclusive`, or `validation_error`.

**`serveStep` must persist under the checkpoint lock (all-writes-under-lock).** `serveStep` currently writes a full `cp` snapshot WITHOUT the lock and WITHOUT bumping revision. A concurrent committed transition can be clobbered by that stale snapshot. FIX: after handlers finish, await `d.__beforeServePersist?.()`, then persist under `withCheckpointLock(d.store.dir(), cp.checkpointId, ...)`, RE-READING the current checkpoint, MERGING only the `servedSteps[key]` produced into the fresh copy, and writing that (never a whole stale `cp` captured earlier). It still does not bump the semantic revision.

Add this executable interleaving to `lane-runner-concurrency.test.ts`. Completing `shape` begins serving `craft` and pauses immediately before that served-step persistence; a second handle skips `craft`; then the stale serve persistence resumes and must merge without reverting the committed skip:

```typescript
{
  const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-serve-clobber-')));
  let atPersist!: () => void; const persistReached = new Promise<void>((r) => { atPersist = r; });
  let releasePersist!: () => void; const holdPersist = new Promise<void>((r) => { releasePersist = r; });
  let pauses = 0;
  const d1 = { ...deps(p), __beforeServePersist: async () => {
    if (++pauses === 2) { atPersist(); await holdPersist; } // first pause was start's shape serve; pause craft serve
  } } as LaneRunnerDeps;
  const s = await startLane('lane_build', 'clobber', { projectPath: p }, 'req-clobber', d1);
  const completingShape = advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d1.store.read(s.checkpointId).revision }, d1);
  await persistReached;
  const d2 = deps(p);
  const beforeSkip = d2.store.read(s.checkpointId);
  await advanceLane(p, s.checkpointId, { action: 'skip', reason: 'test interleave', expectedRevision: beforeSkip.revision }, d2);
  releasePersist(); await completingShape;
  const after = d2.store.read(s.checkpointId);
  if (!after.completedStepIds.includes('shape') || !after.skippedStepIds.includes('craft')) throw new Error('stale serve persistence clobbered committed transition');
  if (!after.servedSteps['1:0']) throw new Error('serve persistence must merge its own entry');
}
```

`retry` / `resume` / `interrupt` / `stop` keep their P2 behavior FOR NOW (still use the old write path) - Task 9 moves them under the lock and adds lease fencing. After this task they must remain green in `lane-runner-transitions.test.ts` (the live-lease rejection guard above only blocks ordinary transitions when a lease is actually live, which never happens in the synchronous transitions suite).

- [ ] **Step 6.4: Run PASS** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts && npx ts-node src/__tests__/lane-runner-advance-sequence.test.ts && npx ts-node src/__tests__/lane-runner-transitions.test.ts && npx ts-node src/__tests__/lane-runner-skip-prereq.test.ts && npx ts-node src/__tests__/lane-execution-e2e.test.ts`. Update those suites' `deps()` fixtures to add `newOperationId` + `runValidator` (a clean stub). Register the concurrency suite `required: true`, then run `npm run build && npm test`.

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
import { LaneCheckpointStore, publishOutbox } from '../lane-checkpoint-store';
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
  if (sink.upsertSync(key, rec.fencingToken, { v: 1 }).status !== 'noop') throw new Error('same-token replay must be a no-op');
  if (sink.upsertSync(key, rec.fencingToken - 1, { v: 1 }).status !== 'rejected') throw new Error('lower token must be rejected');
  if (sink.upsertSync(key, rec.fencingToken + 1, { v: 2 }).status !== 'written') throw new Error('higher token must overwrite');

  // crash-after-FINALIZE: injected publisher failure leaves the REAL finalized
  // record pending. A later production publishOutbox replay drains it.
  const d2 = deps(proj);
  let failOnce = false;
  d2.publishOutbox = async (...args) => {
    if (failOnce) { failOnce = false; throw new Error('injected publish crash'); }
    return publishOutbox(...args);
  };
  const s2 = await startLane('lane_build', 'hero2', { projectPath: proj }, 'req-crash', d2);
  await advanceLane(proj, s2.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s2.revision }, d2);
  const cur2 = d2.store.read(s2.checkpointId);
  failOnce = true; // fail only after craft FINALIZE, not during start/shape publishing
  let crashed = false;
  try { await advanceLane(proj, s2.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: cur2.revision }, d2); }
  catch (e) { crashed = String(e).includes('injected publish crash'); }
  if (!crashed) throw new Error('test must fail after FINALIZE at publish');
  const pending = d2.store.read(s2.checkpointId);
  if (!pending.completedStepIds.includes('craft') || pending.sideEffectOutbox.length !== 1) throw new Error('FINALIZE commit + pending outbox must survive publish crash');
  const pendingRecord = pending.sideEffectOutbox[0];
  await publishOutbox(d2.store, s2.checkpointId, proj, d2.now); // production publisher, no reseeding
  if (d2.store.read(s2.checkpointId).sideEffectOutbox.length !== 0) throw new Error('production replay must drain pending outbox');
  const sink2 = new LaneSideEffectSink(proj);
  const k2 = `${s2.checkpointId}:craft:0`;
  if (sink2.get(k2)?.fencingToken !== pendingRecord.fencingToken) throw new Error('production replay publishes the committed fencing token');

  // Automatic recovery path: make a committed record pending again as a crash
  // artifact, then a later production entrypoint must replay it before returning.
  const crashArtifact = d2.store.read(s2.checkpointId);
  crashArtifact.sideEffectOutbox.push(pendingRecord);
  d2.store.write(crashArtifact);
  if (d2.store.read(s2.checkpointId).sideEffectOutbox.length !== 1) throw new Error('reseeded crash artifact must be pending before entrypoint');
  const productionDeps = deps(proj); // no publish failure injection
  await startLane('lane_build', 'recovery-trigger', { projectPath: proj }, 'req-recovery-trigger', productionDeps);
  if (d2.store.read(s2.checkpointId).sideEffectOutbox.length !== 0) throw new Error('later production entrypoint must replay all pending project outbox');
  console.log('lane-side-effect-outbox: OK');
}
run();
```

- [ ] **Step 7.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-side-effect-outbox.test.ts` fails with `Cannot find module '../lane-side-effect-sink'`; after the sink skeleton exists, it still fails because the injected publish crash is not recoverable automatically.

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

The test uses `upsertSync` only for direct conditional-upsert assertions; production publishing uses the lock-guarded async `upsert`.

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

Add `publishPendingOutbox(store, projectPath, now?)`: enumerate checkpoints with pending records and call the production `publishOutbox` for each. Invoke it at the start of async `startLane` and `advanceLane`, before the requested operation mutates state. Do not make synchronous `laneStatus` async in P4b-1. A failed replay is logged and left pending; it must not corrupt or acknowledge the record. This is the startup/advance-time recovery path for a process that crashed after FINALIZE.

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
await (d.publishOutbox ?? publishOutbox)(d.store, checkpointId, projectPath, d.now);
return buildStepResult(final, l, { projectPath }, d, gate);
```

Add optional `publishOutbox` to `LaneRunnerDeps` only as a deterministic failure-injection seam; production `laneDeps` leaves it undefined and therefore calls the real publisher. The unclean branch pushes NO outbox record (no committed side effect to publish).

The first-step `serveStepUnderLease` FINALIZE from Task 3 also writes a committed outbox record for its persisted served-step effect and calls the same publisher after FINALIZE. This closes spec line 286: the start lock is already released, handlers execute under the first-step lease, and persistent effects publish only from the committed outbox.

- [ ] **Step 7.6: Run PASS + register + commit** - `cd sidecoach && npx ts-node src/__tests__/lane-side-effect-outbox.test.ts` proves pending persistence, direct production replay, and automatic entrypoint replay; add it to SUITES `required: true`; run `npm run build && npm test`; commit with `git commit -m "feat(lane-p4b1): durable outbox publish and crash recovery"`.

---

## Task 8: AbortSignal composition + heartbeat refresh during EXECUTE

Make the EXECUTE genuinely abortable and heartbeat-refreshed. The composed signal covers lease-ownership-loss (detected by a heartbeat that fails) + in-process priority cancellation (an AbortController registered per live operation). Transport-timeout composition is P4d.

**Files:** Modify `lane-runner.ts`; extend `lane-runner-concurrency.test.ts`.

- [ ] **Step 8.1: Failing independent-store ownership-loss test** (append to the concurrency suite) - one long validator runs longer than `staleMs`, proving the heartbeat LOOP keeps it live; then a second store handle atomically fences the lease DURING that same validator, proving ownership loss aborts it without waiting for a validator boundary:

```typescript
{
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-abort-')));
  let enteredValidator!: () => void;
  const entered = new Promise<void>((r) => { enteredValidator = r; });
  let releaseValidator!: () => void;
  const held = new Promise<void>((r) => { releaseValidator = r; });
  let sawAbort = false;
  const d = deps(proj, async (_id, _ctx, signal) => {
    signal?.addEventListener('abort', () => { sawAbort = true; });
    enteredValidator();
    await held;
    return okResult();
  });
  d.now = () => new Date(Date.now()).toISOString();
  d.staleMs = 40; d.heartbeatIntervalMs = 5;
  const s = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-abort', d);
  await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
  const inflight = advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
  await entered;
  await new Promise((r) => setTimeout(r, 80));    // greater than staleMs; loop must keep lease live
  const independent = new LaneCheckpointStore(proj);
  const live = independent.read(s.checkpointId);
  if (!leaseIsLive(live.lease, Date.now(), 40)) throw new Error('one slow validator must stay live via heartbeat loop');
  await withCheckpointLock(independent.dir(), s.checkpointId, () => {
    const cp = independent.read(s.checkpointId);
    cp.fencingCounter += 1; cp.lease = null; cp.revision += 1; independent.write(cp);
  });
  for (let i = 0; i < 50 && !sawAbort; i++) await new Promise((r) => setTimeout(r, 2));
  if (!sawAbort) throw new Error('independent-store ownership loss during one validator must abort signal');
  releaseValidator();
  await inflight.then(() => { throw new Error('fenced operation must reject FINALIZE'); }, () => {});
  if (d.store.read(s.checkpointId).completedStepIds.includes('craft')) throw new Error('fenced operation must NOT commit');
  console.log('lane-runner-concurrency abort-fence: OK');
}
```

- [ ] **Step 8.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts` fails because without a continuous heartbeat loop, the single slow validator looks stale and ownership loss is not detected until it returns.

- [ ] **Step 8.3: Implement a continuous ownership-checking heartbeat loop** in `lane-runner.ts`. Key the in-process registry by the full lease identity, not checkpoint ID:

```typescript
// module scope
const LIVE_OPERATIONS = new Map<string, AbortController>();
const leaseKey = (checkpointId: string, id: LeaseIdentity) =>
  `${checkpointId}:${id.operationId}:${id.stepId}:${id.iteration}:${id.claimedCheckpointRevision}:${id.fencingToken}`;

function startHeartbeatLoop(d: LaneRunnerDeps, checkpointId: string, id: LeaseIdentity, controller: AbortController): () => void {
  const every = d.heartbeatIntervalMs ?? Math.max(10, Math.floor((d.staleMs ?? 30000) / 3));
  let stopped = false; let running = false;
  const timer = setInterval(async () => {
    if (stopped || running) return;
    running = true;
    try { await refreshHeartbeat(d.store, checkpointId, id, d.now); }
    catch { controller.abort(); }
    finally { running = false; }
  }, every);
  return () => { stopped = true; clearInterval(timer); };
}
```

Start the loop immediately after every CLAIM, including the first-step lease created by `startLane`, before any flow handler or validator, and stop it in `finally` after EXECUTE/FINALIZE. Handlers and validators receive `controller.signal`. A heartbeat failure aborts the operation-local signal. FINALIZE still verifies the full identity if a handler ignores abort:

```typescript
const claimed = await claimLease(...); const id = claimed.lease!;
const controller = new AbortController();
const key = leaseKey(checkpointId, id);
LIVE_OPERATIONS.set(key, controller);
const stopHeartbeat = startHeartbeatLoop(d, checkpointId, id, controller);
try {
  const perValidator = await executeStepValidators(d, validatorIds, { projectPath, target: cp.target }, controller.signal);
  // ... aggregate worst-status, build gate ...
  ...
} finally {
  stopHeartbeat();
  if (LIVE_OPERATIONS.get(key) === controller) LIVE_OPERATIONS.delete(key);
}
```

The identity-key plus conditional delete prevents an old operation's `finally` from deleting a same-process replacement. `interrupt`/`stop` locate and abort the controller matching the fenced lease identity in Task 9. `heartbeatIntervalMs` is a test/production tuning dependency; production defaults to less than one third of `staleMs`.

- [ ] **Step 8.4: Run PASS + commit** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts && npm run build && npm test`; commit with `git commit -m "feat(lane-p4b1): continuous ownership heartbeat during execute"`.

---

## Task 9: Priority interrupt/stop fence a live lease; retry/resume under the lock

**Files:** Modify `lane-runner.ts`; extend `lane-runner-concurrency.test.ts`.

- [ ] **Step 9.1: Failing priority-cancellation + retry/resume fencing tests** (append to `lane-runner-concurrency.test.ts`). This is the task that implements priority cancellation, so its abort test lives here, not Task 8:

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
  // retry over a re-seeded LIVE lease is rejected.
  const cp1 = d.store.read(s.checkpointId);
  cp1.lifecycle = 'in_progress';
  cp1.lease = { operationId: 'live', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp1.revision, fencingToken: cp1.fencingCounter, startedAt: d.now(), heartbeatAt: d.now() };
  d.store.write(cp1);
  let rejected = false;
  try { await advanceLane(proj, s.checkpointId, { action: 'retry', expectedRevision: d.store.read(s.checkpointId).revision }, d); } catch { rejected = true; }
  if (!rejected) throw new Error('retry over a live lease must be rejected');

  // retry over a STALE lease fences/clears it under the same lock before mutation.
  const stale = d.store.read(s.checkpointId);
  stale.lease = { ...stale.lease!, operationId: 'stale-retry', claimedCheckpointRevision: stale.revision,
    fencingToken: stale.fencingCounter, heartbeatAt: new Date(-86_400_000).toISOString() };
  const staleRetryIdentity = stale.lease!;
  d.store.write(stale);
  await advanceLane(proj, s.checkpointId, { action: 'retry', expectedRevision: stale.revision }, d);
  const afterRetry = d.store.read(s.checkpointId);
  if (afterRetry.lease !== null || afterRetry.fencingCounter <= stale.fencingCounter) throw new Error('retry must fence/clear stale lease before mutation');
  await finalizeLease(d.store, s.checkpointId, staleRetryIdentity, () => {}).then(
    () => { throw new Error('stale retry owner must not FINALIZE'); }, () => {});

  const interrupted = d.store.read(s.checkpointId);
  interrupted.lifecycle = 'interrupted';
  interrupted.lease = { operationId: 'stale-resume', stepId: 'shape', iteration: 0,
    claimedCheckpointRevision: interrupted.revision, fencingToken: interrupted.fencingCounter,
    startedAt: new Date(-86_400_000).toISOString(), heartbeatAt: new Date(-86_400_000).toISOString() };
  const staleResumeIdentity = interrupted.lease!;
  d.store.write(interrupted);
  await advanceLane(proj, s.checkpointId, { action: 'resume', expectedRevision: interrupted.revision }, d);
  const afterResume = d.store.read(s.checkpointId);
  if (afterResume.lease !== null || afterResume.fencingCounter <= interrupted.fencingCounter || afterResume.lifecycle !== 'in_progress') throw new Error('resume must fence stale lease before mutation');
  await finalizeLease(d.store, s.checkpointId, staleResumeIdentity, () => {}).then(
    () => { throw new Error('stale resume owner must not FINALIZE'); }, () => {});
  console.log('lane-runner-concurrency interrupt-fence: OK');
}
```

- [ ] **Step 9.2: Add executable same-process ABA test** - start operation A with a blocked validator and capture its controller/identity through a test-only observer. Advance the injected clock so A is stale; start replacement B with a separately blocked validator; release A so its `finally` runs; then call `interrupt` and assert B's signal aborts. This test fails if `LIVE_OPERATIONS` is keyed only by checkpoint ID or if A unconditionally deletes B's entry:

```typescript
{
  const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-live-aba-')));
  let nowMs = 1_000, releaseA!: () => void, releaseB!: () => void, enterA!: () => void, enterB!: () => void;
  const holdA = new Promise<void>((r) => { releaseA = r; });
  const holdB = new Promise<void>((r) => { releaseB = r; });
  const aEntered = new Promise<void>((r) => { enterA = r; });
  const bEntered = new Promise<void>((r) => { enterB = r; });
  let calls = 0, bAborted = false;
  const base = deps(p);
  const validator = async (_id: string, _ctx: unknown, signal?: AbortSignal) => {
    if (++calls === 1) { enterA(); await holdA; return okResult(); }
    signal?.addEventListener('abort', () => { bAborted = true; }); enterB(); await holdB; return okResult();
  };
  const dA = { ...base, now: () => new Date(nowMs).toISOString(), staleMs: 10, heartbeatIntervalMs: 1_000_000, runValidator: validator } as LaneRunnerDeps;
  const s = await startLane('lane_build', 'aba', { projectPath: p }, 'req-aba', dA);
  await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
  const a = advanceLane(p, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
  await aEntered; nowMs += 100;
  const dB = { ...dA, heartbeatIntervalMs: 5 } as LaneRunnerDeps;
  const b = advanceLane(p, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: 'r:craft:b' }, expectedRevision: dB.store.read(s.checkpointId).revision }, dB);
  await bEntered;
  releaseA(); await a.then(() => { throw new Error('A must reject after B reclaim'); }, () => {});
  await advanceLane(p, s.checkpointId, { action: 'interrupt', expectedRevision: dB.store.read(s.checkpointId).revision }, dB);
  if (!bAborted) throw new Error('interrupt must abort replacement after stale same-process reclaim');
  releaseB(); await b.then(() => { throw new Error('interrupted B must reject FINALIZE'); }, () => {});
}
```

- [ ] **Step 9.3: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts` fails because interrupt cannot target the full replacement identity and stale retry/resume mutate without first fencing the stale owner.

- [ ] **Step 9.4: Implement priority and stale ordinary transitions under the lock**

`interrupt` and `stop` run under `withCheckpointLock(d.store.dir(), checkpointId, ...)`: read cp, verify `expectedRevision` against the CURRENT on-disk revision, capture the full current lease identity, clear any lease, increment `fencingCounter`, set lifecycle/outcome + audit, bump revision, and write. They do NOT require lease ownership. AFTER writing, compute the captured identity key and call only `LIVE_OPERATIONS.get(key)?.abort()`.

`resume` (interrupted-only) and `retry` also run wholly under the lock. Under that lock:

- Re-read current state and compare `expectedRevision`.
- If the lease is LIVE, reject.
- If the lease is STALE, capture it for audit, clear it, and increment `fencingCounter` BEFORE applying retry/resume mutation and bumping revision. This fences that stale operation so its later FINALIZE identity check fails.
- If no lease exists, apply the normal P2 transition.

Do not rely on Task 6's early read for correctness; it is only a fast rejection. Keep all transitions consistent with `lane-runner-transitions.test.ts` (interrupted=resume-only, audited).

- [ ] **Step 9.5: Run PASS + commit** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts && npx ts-node src/__tests__/lane-runner-transitions.test.ts && npm run build && npm test`; commit with `git commit -m "feat(lane-p4b1): identity-safe priority abort and stale retry fencing"`.

---

## Task 10: Engine wiring (laneDeps) + crash + timeout-retry recovery

**Files:** Modify `sidecoach-orchestrator.ts`; extend `lane-runner-concurrency.test.ts` + `lane-engine-methods.test.ts`.

- [ ] **Step 10.1: Add failing engine + recovery tests** - extend `lane-engine-methods.test.ts`: a full engine `startLane('lane_build')` then `advanceLane(complete shape)` then `advanceLane(complete craft)` runs through the real async validators (the craft step binds `polish-standard`; on an empty temp project its required rules are inconclusive -> the gate is `validation_inconclusive`, so the step STAYS at craft). Assert `currentVerb === 'craft'`, `gate.status === 'inconclusive'`, and a later engine `laneStatus` reports craft as `validation_inconclusive`. Also append both exact concurrency test bodies specified in Steps 10.4 and 10.5 before running Step 10.2.

Add `import { LaneSideEffectSink } from '../lane-side-effect-sink';` to the concurrency suite in this task for the Step 10.5 authoritative-entry assertion; do not add that import in Task 6 before the sink exists.

- [ ] **Step 10.2: Run, verify FAIL** - `cd sidecoach && npx ts-node src/__tests__/lane-engine-methods.test.ts && npx ts-node src/__tests__/lane-runner-concurrency.test.ts`; the engine suite fails because production `laneDeps` does not supply `newOperationId` / async `runValidator`. Do not continue unless the new engine assertion is observed failing.

- [ ] **Step 10.3: Wire `laneDeps`** - add `newOperationId` (random in production is fine) and `runValidator` (resolve the registration and call its async `validateProduct`):

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

- [ ] **Step 10.4: Executable crash-mid-advance reclaim regression test** - append this deterministic case to the concurrency suite. It seeds the exact persisted artifact a crashed process leaves, with no sleeps:

```typescript
{
  const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-crash-reclaim-')));
  const d = deps(p);
  const s = await startLane('lane_build', 'crash', { projectPath: p }, 'req-crash-reclaim', d);
  const cp = d.store.read(s.checkpointId);
  cp.lease = { operationId: 'crashed-op', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp.revision,
    fencingToken: cp.fencingCounter, startedAt: new Date(0).toISOString(), heartbeatAt: new Date(0).toISOString() };
  d.store.write(cp);
  const r = await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: cp.revision }, { ...d, staleMs: 1 });
  const after = d.store.read(s.checkpointId);
  if (r.currentVerb !== 'craft' || after.completedStepIds.filter((x) => x === 'shape').length !== 1) throw new Error('stale crash lease must be reclaimed and commit once');
  if (after.fencingCounter <= cp.fencingCounter || after.lease !== null) throw new Error('reclaim must bump fencing and clear replacement lease on finalize');
}
```

- [ ] **Step 10.5: Executable timeout-retry overlap regression test** - append this barrier-driven case. Use a mutable injected clock and set A's `heartbeatIntervalMs` longer than the test so advancing the clock makes its lease stale without real sleeps:

```typescript
{
  const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-timeout-retry-')));
  let nowMs = 1_000; let enteredA!: () => void; const aEntered = new Promise<void>((r) => { enteredA = r; });
  let releaseA!: () => void; const holdA = new Promise<void>((r) => { releaseA = r; });
  const base = deps(p);
  const dA = { ...base, now: () => new Date(nowMs).toISOString(), staleMs: 10, heartbeatIntervalMs: 1_000_000,
    runValidator: async () => { enteredA(); await holdA; return okResult(); } } as LaneRunnerDeps;
  const s = await startLane('lane_build', 'overlap', { projectPath: p }, 'req-overlap', dA);
  await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
  const a = advanceLane(p, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
  await aEntered;
  nowMs += 100;
  const dB = { ...base, now: () => new Date(nowMs).toISOString(), staleMs: 10, runValidator: async () => okResult() } as LaneRunnerDeps;
  await advanceLane(p, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: 'r:craft:b' }, expectedRevision: dB.store.read(s.checkpointId).revision }, dB);
  releaseA();
  await a.then(() => { throw new Error('superseded A must reject FINALIZE'); }, () => {});
  const after = dB.store.read(s.checkpointId);
  if (after.completedStepIds.filter((x) => x === 'craft').length !== 1) throw new Error('timeout retry must commit craft exactly once');
  const sink = new LaneSideEffectSink(p);
  if (!sink.get(`${s.checkpointId}:craft:0`)) throw new Error('replacement commit must publish one authoritative logical entry');
}
```

- [ ] **Step 10.6: Run PASS + commit** - `cd sidecoach && npx ts-node src/__tests__/lane-runner-concurrency.test.ts && npx ts-node src/__tests__/lane-engine-methods.test.ts && npm run build && npm test`; commit with `git commit -m "feat(lane-p4b1): engine wiring and deterministic crash recovery"`.

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
- Copy gating (P4e).
- `P4f - Lane FlowHistory Conditional Publisher`: add FlowHistory as a second conditional publisher reading the SAME committed outbox record. P4b-1 deliberately keeps the global FlowHistory writer untouched because it serves the non-lane engine and changing it here risks the 27 green baseline suites.

---

## Self-Review (apply the P3 + P4a lessons)

- **At-most-one COMMITTED transition, not exactly-once execution** (spec line 696). Tasks 6/8/10 prove exactly one commit under concurrency, timeout-retry overlap, and crash; the language in every test/comment says "committed", never "executed once". Do not overclaim.
- **Full lease identity on FINALIZE/heartbeat** (spec lines 709-712): `finalizeLease`/`refreshHeartbeat` match the full `{operationId, stepId, iteration, claimedCheckpointRevision, fencingToken}` captured from `claimLease`'s return - never operationId alone, never a re-read outside the lock.
- **First-step lease:** the start-request lock contains only idempotent mapping + checkpoint/lease creation. It is released before handlers; first-step effects FINALIZE under the full lease identity and publish from outbox.
- **All checkpoint writes under the lock:** `complete`/`skip` claim+finalize; `retry`/`resume`/`interrupt`/`stop` run under the lock; `serveStep` persists via a locked re-read+merge of just its `servedSteps[key]`; retry/resume fence stale leases; only `interrupt`/`stop` supersede a live lease.
- **Race-safe lock:** stale reclaim uses atomic rename to a unique per-attempt claim and never blind-unlinks the shared path. The adversarial test proves exactly one of two simultaneous reclaimers enters, and the reclaimed-owner test proves the original finally cannot delete its replacement.
- **Continuous ownership heartbeat + full-identity live registry:** heartbeat runs throughout one slow validator, every refresh re-verifies ownership, and `finally` conditionally deletes only its own identity-keyed controller.
- **Persisted gate status:** FINALIZE stores the latest current-step gate status and later `laneStatus` reads expose all three non-clean mappings.
- **Crash recovery:** the outbox test injects a failure after FINALIZE, asserts the real pending record, replays through production `publishOutbox`, and proves a later entrypoint automatically replays pending project records.
- **Validators pure/idempotent during EXECUTE; side effects publish ONLY from the committed outbox** (spec lines 713-723). The lane validators are read-only (collect + checkProduct -> findings; they write nothing). The single committed side effect (the step-completion record) is buffered in the finalize mutate and published through the fencing-conditional sink; a superseded op cannot create the committed outbox record, so it cannot publish.
- **Trace every new symbol to a caller in its task:** `withCheckpointLock` -> claimLease/finalizeLease/refreshHeartbeat/publishOutbox/sink (Tasks 2/3/7); claim/finalize/heartbeat -> startLane/advanceLane (Tasks 3/6/8); `validatorsForStep`/`aggregateWorstStatus`/`mapGateStatusToOutcome` -> advanceLane (Tasks 5/6); `LaneSideEffectSink`/`publishOutbox`/`publishPendingOutbox` -> FINALIZE and entrypoint recovery (Task 7); `newOperationId`/`runValidator` -> startLane/advanceLane, supplied by `laneDeps` (Tasks 3/6/10); identity-keyed `LIVE_OPERATIONS` -> heartbeat loop + interrupt/stop (Tasks 8/9).
- **No changelog-vs-body drift:** there is no separate changelog section; the body IS the spec. Every code block is grounded in the live signatures read at authoring time (`LaneCheckpoint`, `LaneRunnerDeps`, `evaluateCleanPolicy`'s `validatorError` path, `FLOW_CAPABILITIES`).

### Resolved spec ambiguities (flag these to the reviewer)

1. **Multi-flow step -> which validators gate.** A sequence step maps to `step.flowIds` (e.g. lane_build's "craft" binds flowI/flowM/flowJ). The bound validators are the de-duplicated UNION of `getFlowCapability(flowId).productValidatorIds` across those flows (`validatorsForStep`, Task 5). flowJ binds `polish-standard`; the advisory flows (flowI/flowM) bind none; so "craft" gates on `polish-standard` alone. Each validator runs once even if two flows reference it.
2. **Worst-status total order.** The spec lists the mapping (clean/findings/inconclusive/error) but not the cross-validator precedence when bound validators disagree. Resolved as `error > findings > inconclusive > clean`: an unevaluable gate (error) is loudest (the verdict set cannot be trusted), a confirmed blocking defect (findings) outranks an unverified gap (inconclusive), clean is best. Encoded + tested in `aggregateWorstStatus` (Task 5).
3. **Outbox vs the existing flow-history writer.** The lane execution path writes NO flow-history today - the `FlowHistory` singleton (`recordFlow`, `~/.claude/sidecoach-flow-history.json`) is used only by the non-lane `process()` path. P4b-1 makes the DEDICATED `LaneSideEffectSink` authoritative for lane side effects and leaves FlowHistory untouched to avoid regressing the non-lane engine and its 27 green suites. The named `P4f - Lane FlowHistory Conditional Publisher` later registers FlowHistory as a second publisher reading the same committed outbox record.
