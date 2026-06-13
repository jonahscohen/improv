# Lane Durability - Lease / Fencing / Schema-v2 (Phase 3) Implementation Plan - v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

## What changed in v2 (Codex review `task-mqcx5yfz` - no P0; folds 6 P1 + 3 P2)

These are BINDING requirements; the per-task code below already reflects them where shown, and the rest are enforced here:
- **Race-safe lock (P1-1):** unique owner token; unparseable/empty lock is NOT immediately stale (mtime-fallback grace for the create->write window); release unlinks ONLY if this owner still holds it; `checkpointId` validated. The lock test adds a create-window case and a reclaimed-owner-release case.
- **All checkpoint writes under the lock (P1-2):** ordinary transitions (`complete`/`skip`/`retry`/`resume`) are REJECTED while a live lease exists; only `interrupt`/`stop` proceed over a live lease. `serveStep` persists via a LOCKED re-read+merge of just its `servedSteps[key]` (never writing a whole stale snapshot). A test proves a `serveStep` write cannot revert a committed `complete`.
- **Full lease identity on FINALIZE (P1-3):** `finalizeLease` matches the full `{operationId,stepId,iteration,claimedCheckpointRevision,fencingToken}` captured from `claimLease`'s return (not a re-read outside the lock, not operationId alone).
- **Real concurrency proof (P1-4):** an injectable `__claimBarrier?: () => Promise<void>` seam in `LaneRunnerDeps` (awaited in `advanceLane` AFTER the early-guard read, BEFORE `claimLease`) lets a test force two callers past their initial read at the same revision, then race the claim: exactly one commits, the other rejects (stale revision or live lease). Plus: stale-reclaim-then-rejected-late-FINALIZE; interrupt leases built via `claimLease`; `retry`-vs-live-lease.
- **Locked start mapping (P1-5):** `startLane`'s `findByStartRequestId`+create runs under a lock keyed by `sha256(startRequestId)` so concurrent starts map one `startRequestId` to exactly one checkpoint (Task 3 step below).
- **Schema-v2 outbox seed (P1-6):** migration seeds `sideEffectOutbox: []` so P4 needs no third migration.
- **Build/tests green after each task (P2-1):** every contract-changing task updates ALL affected fixtures/tests IN THAT TASK. Concretely: (a) the existing `lane-checkpoint-store.test.ts` writes a v1 literal and expects v2-rejection - update it to write v2 (`schemaVersion:2, fencingCounter:0, lease:null, sideEffectOutbox:[]`) and expect v3-rejection; (b) EVERY `LaneRunnerDeps` fixture across the lane-runner test suites gains `newOperationId: () => 'op-' + (n++)`; (c) every in-test v2 checkpoint literal includes `fencingCounter`, `lease`, `sideEffectOutbox`.
- **`leaseIsLive` NaN guard (P2-2):** malformed `heartbeatAt` -> not-live (reclaimable) + logged; `staleMs` validated.
- **Concrete tests + no dup import (P2-3):** skip-wrap, priority transitions (`interrupt` AND `stop`), crash recovery, engine round-trip, hook regression, and CLI verification each have an executable test/command. `createHash` is ALREADY imported in `sidecoach-orchestrator.ts` - do NOT add a duplicate import in Task 6.

**Goal:** Replace P2's best-effort in-process revision guard with a real cross-process at-most-one-committed-transition guarantee for `advanceLane`, via an O_EXCL checkpoint lock + an operation lease + a monotonic fencing token, on a migrated schema-v2 lane checkpoint.

**Architecture:** P2 left a `// best-effort; true CAS is P3` guard (`bump()` re-reads the on-disk revision). P3 makes it real: every `advanceLane` mutation runs CLAIM, EXECUTE, FINALIZE under an O_EXCL file lock, writing an in-flight `lease` into the checkpoint and bumping a persisted `fencingCounter`. A second concurrent advance finding a live lease is rejected; a stale lease (dead heartbeat = crash) is reclaimable and logged; FINALIZE commits only if the same lease identity still owns the checkpoint. `interrupt`/`stop` are priority transitions that fence a live lease. The lane checkpoint migrates v1 to v2 (adding `fencingCounter` + `lease`).

**Scope discipline.** P3 is the durability CORE. In P2/P3 `advanceLane`'s EXECUTE body is SYNCHRONOUS (model-attested completion, no async validators yet), so CLAIM and FINALIZE happen within one call and the lease is short-lived. P3 therefore does NOT build (these are P4, where async validators introduce long EXECUTE bodies + external side effects to protect):
- the side-effect outbox + idempotent PUBLISH (no external side effects are written during P2/P3 advance; serveStep persists only the lane's own checkpoint),
- AbortSignal propagation into handlers/validators (nothing async to abort yet),
- heartbeat refresh during a long EXECUTE (EXECUTE is synchronous; the lease is claimed and finalized in the same call).

P3 builds the lease STRUCTURE and the lock/CAS/fencing/migration/reclaim so P4 fills in async EXECUTE + outbox + AbortSignal without changing the on-disk schema or the claim/finalize identity. This split is deliberate: building outbox/heartbeat now would be untestable machinery protecting nothing.

**Tech Stack:** TypeScript (`sidecoach/src/`), `fs` O_EXCL locking, ts-node runner via `sidecoach/scripts/run-tests.ts` SUITES (explicit, `required:true`).

---

## File Structure

**Create:**
- `sidecoach/src/lane-lock.ts` - `withCheckpointLock(dir, checkpointId, fn)`: O_EXCL lockfile acquire/release with stale-lock breaking; the lock guards CLAIM and FINALIZE only (NOT the EXECUTE body).
- `sidecoach/src/__tests__/lane-lock.test.ts`, `lane-checkpoint-migration.test.ts`, `lane-lease.test.ts`, `lane-runner-concurrency.test.ts`.

**Modify:**
- `sidecoach/src/lane-checkpoint-store.ts` - schema v2 (`fencingCounter`, `lease`), v1-to-v2 read migration, write asserts v2.
- `sidecoach/src/lane-types.ts` - `LeaseRecord` type.
- `sidecoach/src/lane-runner.ts` - `advanceLane` CLAIM/EXECUTE/FINALIZE; live-lease rejection; stale-lease reclaim; `interrupt`/`stop` fencing. Remove the best-effort `bump()` re-read in favor of the lock.
- `sidecoach/src/sidecoach-orchestrator.ts` - `laneDeps` supplies an `operationId` factory; method signatures unchanged externally.
- `sidecoach/scripts/run-tests.ts` - register each new suite `required:true`.

**Read-only references:** `lane-checkpoint-store.ts` (current schema v1), `lane-runner.ts` (current `bump`/`advanceLane`), spec section 7 lines 651-730 (the lease protocol).

---

## Setup

- [ ] **Step 0.1: Branch + dirty snapshot**

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p3-durability
git branch --show-current
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p3-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green** - `cd sidecoach && npm run build && npm test` gives build exit 0 and `run-tests: 16 suite(s) passed`. If red, STOP.

---

## Task 1: `LeaseRecord` type + schema-v2 fields

**Files:** Modify `lane-types.ts`; Modify `lane-checkpoint-store.ts` (type + migration); Test `lane-checkpoint-migration.test.ts`

- [ ] **Step 1.1: Failing test (migration round-trip)**

```typescript
// sidecoach/src/__tests__/lane-checkpoint-migration.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';

function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-mig-'));
  const dir = path.join(fs.realpathSync(proj), '.claude', 'lane-checkpoints');
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
  if (cp.revision !== 3) throw new Error('migration preserves state');

  store.write(cp);
  const back = store.read('lane-legacy');
  if (back.schemaVersion !== 2 || back.fencingCounter !== 0) throw new Error('v2 round-trip failed');
  console.log('lane-checkpoint-migration: OK');
}
run();
```

- [ ] **Step 1.2: Run, verify FAIL** - `npx ts-node src/__tests__/lane-checkpoint-migration.test.ts` fails (schemaVersion 1, no fencingCounter).

- [ ] **Step 1.3: Add `LeaseRecord` to `lane-types.ts`**

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
```

- [ ] **Step 1.4: Schema v2 + migration in `lane-checkpoint-store.ts`**

Change `LaneCheckpoint` to `schemaVersion: 2;` and add `fencingCounter: number; lease: LeaseRecord | null; sideEffectOutbox: unknown[];` (import `LeaseRecord`). The `sideEffectOutbox` is seeded `[]` and UNUSED in P3 - it exists so P4 (which fills it with typed entries per spec line 770) does NOT need a third migration. Replace `read()`/`write()`:

```typescript
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry, LeaseRecord } from './lane-types';
// interface: ... fencingCounter: number; lease: LeaseRecord | null; sideEffectOutbox: unknown[]; // P4 types the entries

private migrate(raw: any): LaneCheckpoint {
  if (raw.schemaVersion === 2) return { ...raw, sideEffectOutbox: Array.isArray(raw.sideEffectOutbox) ? raw.sideEffectOutbox : [] } as LaneCheckpoint;
  if (raw.schemaVersion === 1) return { ...raw, schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: [] } as LaneCheckpoint;
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

`startLane` (lane-runner.ts) must now create `schemaVersion: 2, fencingCounter: 0, lease: null` - Task 3 updates it; the migration test drives this task.

- [ ] **Step 1.5: Run PASS + register** - add `{ rel: 'src/__tests__/lane-checkpoint-migration.test.ts', required: true },` to SUITES.

- [ ] **Step 1.6: Commit** - stage the 4 files, `git commit -m "feat(lane-p3): lane checkpoint schema v2 (fencingCounter, lease) + v1-to-v2 migration"`. If startLane's schemaVersion:1 write now breaks a lane-runner suite, fold Task 3's creation-site edit into this commit and report.

---

## Task 2: O_EXCL checkpoint lock

**Files:** Create `lane-lock.ts`; Test `lane-lock.test.ts`

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

  const lockPath = path.join(dir, 'cp2.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999, at: new Date(0).toISOString() }));
  let acquired = false;
  await withCheckpointLock(dir, 'cp2', async () => { acquired = true; }, { staleMs: 1 });
  if (!acquired) throw new Error('stale lock must be reclaimable');
  console.log('lane-lock: OK');
}
run();
```

- [ ] **Step 2.2: Run, verify FAIL** - `Cannot find module '../lane-lock'`.

- [ ] **Step 2.3: Implement `lane-lock.ts`**

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

`Date.now()`/`Math.random()`/`hrtime` are fine in production code (banned only in workflow scripts/test modules). The lock test (2.1) MUST add: a create-window case (a second acquirer seeing an empty lock waits, does not reclaim) and a reclaimed-owner-release case (the original owner's `finally` does NOT delete the replacement's lock).

- [ ] **Step 2.4: Run PASS + register + commit** - add suite `required:true`; `git commit -m "feat(lane-p3): O_EXCL checkpoint lock with stale-lock reclaim"`.

---

## Task 3: Lease CLAIM / FINALIZE + startLane creates v2

**Files:** Modify `lane-checkpoint-store.ts` (claim/finalize helpers, make `dir()` accessible); Modify `lane-runner.ts` (startLane creates v2); Test `lane-lease.test.ts`

- [ ] **Step 3.1: Failing test**

```typescript
// sidecoach/src/__tests__/lane-lease.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, LaneCheckpoint, claimLease, finalizeLease } from '../lane-checkpoint-store';

function base(): LaneCheckpoint {
  return { schemaVersion: 2, checkpointId: 'cp1', laneId: 'lane_build', target: 't',
    executionKind: 'sequence', lifecycle: 'in_progress', cursor: 0, iteration: 0,
    completedStepIds: [], skippedStepIds: [], completedFlowIds: [], stepReports: [], audit: [],
    servedSteps: {}, revision: 0, startRequestId: 'r', seenReportIds: [], fencingCounter: 0, lease: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}
async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-lease-')));
  const store = new LaneCheckpointStore(proj);
  store.write(base());

  const c1 = await claimLease(store, 'cp1', { expectedRevision: 0, stepId: 'shape', iteration: 0, operationId: 'op-1', now: () => '2026-01-01T00:00:01.000Z' });
  if (c1.lease!.fencingToken !== 1) throw new Error('first claim fencingToken = 1');
  if (store.read('cp1').revision !== 1) throw new Error('claim bumps revision');
  if (store.read('cp1').lease!.operationId !== 'op-1') throw new Error('lease persisted');

  let threw = false;
  try { await claimLease(store, 'cp1', { expectedRevision: 1, stepId: 'shape', iteration: 0, operationId: 'op-2', now: () => '2026-01-01T00:00:02.000Z', staleMs: 60000 }); } catch { threw = true; }
  if (!threw) throw new Error('claim must reject a live lease');

  const fin = await finalizeLease(store, 'cp1', 'op-1', (cp) => { cp.completedStepIds.push('shape'); cp.cursor = 1; });
  if (fin.lease !== null) throw new Error('finalize clears lease');
  if (!fin.completedStepIds.includes('shape')) throw new Error('finalize applies mutation');
  if (fin.revision !== 2) throw new Error('finalize bumps revision');

  store.write({ ...store.read('cp1'), lease: { operationId: 'op-9', stepId: 'craft', iteration: 0, claimedCheckpointRevision: 2, fencingToken: 5, startedAt: 'x', heartbeatAt: 'x' } });
  let f2 = false;
  try { await finalizeLease(store, 'cp1', 'op-1', () => {}); } catch { f2 = true; }
  if (!f2) throw new Error('finalize by a non-owning operationId must reject');
  console.log('lane-lease: OK');
}
run();
```

- [ ] **Step 3.2: Run, verify FAIL** - `claimLease is not exported`.

- [ ] **Step 3.3: Implement claim/finalize (use the Task 2 lock)**

Make `dir()` public on `LaneCheckpointStore` (the lock needs the checkpoints dir). Add:

```typescript
import { withCheckpointLock } from './lane-lock';
import type { LeaseRecord } from './lane-types';

export function leaseIsLive(lease: LeaseRecord | null, nowMs: number, staleMs = 30000): boolean {
  if (!lease) return false;
  const hb = Date.parse(lease.heartbeatAt);
  if (Number.isNaN(hb)) { process.stderr.write('[lane] malformed lease heartbeatAt; treating as not-live (reclaimable)\n'); return false; }
  return (nowMs - hb) <= staleMs;
}

// The FULL identity FINALIZE must match (spec line 709) - not just operationId.
export type LeaseIdentity = Pick<LeaseRecord, 'operationId' | 'stepId' | 'iteration' | 'claimedCheckpointRevision' | 'fencingToken'>;

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

export async function finalizeLease(store: LaneCheckpointStore, checkpointId: string, identity: LeaseIdentity, mutate: (cp: LaneCheckpoint) => void, now?: () => string): Promise<LaneCheckpoint> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    const L = cp.lease;
    const owns = !!L && L.operationId === identity.operationId && L.stepId === identity.stepId && L.iteration === identity.iteration
      && L.claimedCheckpointRevision === identity.claimedCheckpointRevision && L.fencingToken === identity.fencingToken;
    if (!owns) throw new Error(`finalizeLease: lease identity mismatch (current op ${L?.operationId ?? 'none'}, fencing ${L?.fencingToken ?? 'n/a'})`);
    mutate(cp);
    cp.lease = null;
    cp.revision += 1; cp.updatedAt = clock();
    store.write(cp);
    return cp;
  });
}
```

`claimLease` returns the checkpoint with its written `lease`; callers capture the FULL identity (`const claimed = await claimLease(...); const id = claimed.lease!;`) and pass `id` to `finalizeLease`. Update the Task 3.1 test's `finalizeLease` calls to pass the identity object (e.g. `await finalizeLease(store, 'cp1', c1.lease!, (cp) => {...})`); the superseded-op case passes a stale identity and expects rejection.

Update `startLane` (lane-runner.ts): (a) wrap the ENTIRE `findByStartRequestId`-check-then-create sequence under a lock keyed by the start-request so concurrent starts map one `startRequestId` to exactly one checkpoint (Codex P1-5):

```typescript
import { createHash } from 'crypto';
import { withCheckpointLock } from './lane-lock';
// in startLane, after validating startRequestId and resolving the lane:
const startLockId = 'start-' + createHash('sha256').update(startRequestId).digest('hex').slice(0, 40);
return withCheckpointLock(d.store.dir(), startLockId, () => {
  const existing = d.store.findByStartRequestId(startRequestId);
  if (existing && !isClosed(existing.lifecycle)) {
    if (existing.laneId !== laneId) throw new Error(`startLane: startRequestId already maps to active lane "${existing.laneId}"`);
    return serveStep(existing, resolveLane(existing.laneId), context, d);
  }
  const ts = d.now();
  const cp: LaneCheckpoint = { schemaVersion: 2, checkpointId: d.newCheckpointId(), laneId, target,
    executionKind: l.executionKind, lifecycle: 'in_progress', cursor: 0, iteration: 0,
    completedStepIds: [], skippedStepIds: [], completedFlowIds: [], stepReports: [], audit: [],
    servedSteps: {}, revision: 0, startRequestId, seenReportIds: [], fencingCounter: 0, lease: null,
    sideEffectOutbox: [], createdAt: ts, updatedAt: ts };
  d.store.write(cp);
  return serveStep(cp, l, context, d);
});
```

(b) since `serveStep` now also takes the checkpoint lock for its persistence (P1-2), and `startLane` holds the start-lock - NOT the checkpoint lock - these are different lock keys (`start-<hash>` vs `<checkpointId>`), so no self-deadlock. Confirm the two key spaces never collide (a `checkpointId` is `lane-...`; a start-lock is `start-...`).

- [ ] **Step 3.4: Run PASS + register + commit** - `git commit -m "feat(lane-p3): lease CLAIM/FINALIZE under O_EXCL lock (fencing token, owner-checked commit)"`.

---

## Task 4: `advanceLane` runs CLAIM, EXECUTE, FINALIZE

Rewrite `advanceLane`'s mutating actions (`complete`, `skip`) to claim a lease, do the synchronous validation/mutation as EXECUTE, then finalize. A second advance finding a live lease is rejected by `claimLease`. PRESERVE every P2 guard (report shape, stepId/iteration match, dup-reportId on in_progress only, partial-serve rejection, successfulFlowIds-only attestation, interrupted=resume-only, closed-rejects).

**Files:** Modify `lane-runner.ts`; Test new `lane-runner-concurrency.test.ts` + existing advance suites must stay green

- [ ] **Step 4.1: Failing test (the core guarantee)**

```typescript
// sidecoach/src/__tests__/lane-runner-concurrency.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
  } as any;
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 's', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-conc-')));
  const d = deps(proj);
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);

  // barrier: release BOTH callers only after BOTH have passed their early-guard
  // read at the SAME revision, then race the claim. (Without this, the first
  // caller writes before yielding and the second just rejects on revision - which
  // would also pass on P2's best-effort guard and prove nothing. Codex P1-4.)
  let arrived = 0; let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const barrier = async () => { if (++arrived >= 2) release(); await gate; };
  const d2 = { ...d, __claimBarrier: barrier } as any;   // advanceLane awaits this after the early read, before claimLease
  const both = await Promise.allSettled([
    advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: start.revision }, d2),
    advanceLane(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), reportId: 'r:shape2' }, expectedRevision: start.revision }, d2),
  ]);
  const ok = both.filter((r) => r.status === 'fulfilled');
  if (ok.length !== 1) throw new Error(`exactly one concurrent advance must commit, got ${ok.length}`);
  const cp = d.store.read(start.checkpointId);
  if (cp.completedStepIds.filter((s) => s === 'shape').length !== 1) throw new Error('shape committed at most once');
  if (cp.lease !== null) throw new Error('lease cleared after commit');
  console.log('lane-runner-concurrency: OK');
}
run();
```

- [ ] **Step 4.2: Run, verify FAIL** (either `newOperationId` undefined or both advances commit).

- [ ] **Step 4.3: Rewrite the mutating path**

Add `newOperationId: () => string` to `LaneRunnerDeps`. Factor the old `bump()`-based cursor advance into a PURE in-place mutator `advanceCursorInPlace(cp, l)` (sets cursor/lifecycle/outcome, NO store writes) and a `buildStepResult(cp, l, ctx, d)` that serves the new current step (or `closedResult`). For `complete` and `skip`, run all P2 validation, then:

```typescript
import { claimLease, finalizeLease } from './lane-checkpoint-store';

// complete (after the P2 guards: report present, >=1 evidence, stepId/iteration match,
// dup-reportId-on-in_progress no-op, interrupted=resume-only, closed-rejects, full-serve):
const step = l.verbSteps[cp.cursor];
const servedKey = `${cp.cursor}:${cp.iteration}`;
const served = cp.servedSteps[servedKey];
if (!served || served.flowIds.length !== step.flowIds.length) throw new Error('advanceLane: step not fully served');
const claimed = await claimLease(d.store, checkpointId, { expectedRevision: transition.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId: d.newOperationId(), now: d.now });
const id = claimed.lease!;   // FULL identity captured from the claim (do NOT re-read outside the lock)
const final = await finalizeLease(d.store, checkpointId, id, (c) => {
  c.seenReportIds.push(r.reportId); c.stepReports.push(r); c.completedStepIds.push(step.verb);
  for (const f of served.successfulFlowIds) if (!c.completedFlowIds.includes(f)) c.completedFlowIds.push(f);
  c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: c.revision, at: d.now() });
  advanceCursorInPlace(c, l);
}, d.now);
return buildStepResult(final, l, { projectPath }, d);
```

The dup/interrupted/closed/revision guards stay BEFORE the claim (they read the current cp). `claimLease` re-verifies `expectedRevision` under the lock (TOCTOU-safe) AND rejects a live lease. The full identity is captured from `claimed.lease` (NOT re-read outside the lock - a priority transition could clear it between).

**ALL checkpoint writes must be under the lock (Codex P1-2):**
- `retry` mutates revision/report/audit, so it MUST also run under the lock (claim a lease, finalize) OR be rejected while a live lease exists - do NOT mutate a checkpoint that has a live lease outside the protocol. Simplest: in `advanceLane`, after the early guards, if `leaseIsLive(cp.lease, Date.parse(d.now()))` and the action is an ORDINARY transition (`complete`/`skip`/`retry`/`resume`), REJECT with "an operation holds this checkpoint"; only `interrupt`/`stop` may proceed over a live lease (Task 5).
- `serveStep` currently writes a checkpoint snapshot (the served cache) WITHOUT the lock and WITHOUT bumping revision. A concurrent committed transition can be clobbered by that stale snapshot. FIX: `serveStep`'s persistence must run under `withCheckpointLock`, RE-READING the current checkpoint, MERGING only the `servedSteps[key]` it produced into the fresh copy, and writing that - never writing a whole stale `cp` it captured earlier. (It still does not bump the semantic revision.) Add a test: a `serveStep` write interleaved after a committed `complete` does not revert the commit.

Apply the same claim/finalize wrap to `skip` (mutation: push skippedStepId + advanceCursorInPlace). Delete the old `bump()` once unused.

Add `__claimBarrier?: () => Promise<void>` to `LaneRunnerDeps` (optional test seam). In `advanceLane`, immediately AFTER the early-guard read and BEFORE `claimLease`, call `await d.__claimBarrier?.()`. Production passes no barrier (no-op); the concurrency test (4.1) uses it to force two callers past their read at the same revision before either claims.

- [ ] **Step 4.4: Run PASS** - the concurrency suite AND existing `lane-runner-advance-sequence`/`-transitions`/`-skip-prereq` stay green (observable behavior unchanged; only the commit mechanism changed). Register concurrency suite `required:true`.

- [ ] **Step 4.5: Commit** - `git commit -m "feat(lane-p3): advanceLane CLAIM/EXECUTE/FINALIZE - at-most-one committed transition"`.

---

## Task 5: Priority `interrupt`/`stop` fence a live lease

**Files:** Modify `lane-runner.ts`; Test extend `lane-runner-concurrency.test.ts`

- [ ] **Step 5.1: Failing test** (append to the concurrency suite)

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
  console.log('lane-runner-concurrency interrupt-fence: OK');
}
```

- [ ] **Step 5.2: Run FAIL** (interrupt cannot currently fence a live lease).

- [ ] **Step 5.3: Implement priority transitions under the lock**

`interrupt` and `stop` run under `withCheckpointLock(d.store.dir(), checkpointId, ...)`: read cp, verify `expectedRevision` against the CURRENT on-disk revision, then atomically clear any lease, increment `fencingCounter` (fence), set lifecycle/outcome, bump revision, write, return. They do NOT require lease ownership (priority controls supersede an in-flight op; an op in another process observes ownership loss at its FINALIZE because its lease/fencingToken no longer matches). `resume` (interrupted-only) likewise runs under the lock. Leave a `// P4: signal in-process AbortController here` marker (no async EXECUTE to abort in P3). Keep these guards consistent with the existing transitions suite (interrupted=resume-only, audited).

- [ ] **Step 5.4: Run PASS + commit** - `git commit -m "feat(lane-p3): interrupt/stop fence a live lease (priority control)"`.

---

## Task 6: Engine wires `newOperationId`; crash-recovery test

**Files:** Modify `sidecoach-orchestrator.ts`; Test extend concurrency suite + `lane-engine-methods.test.ts`

- [ ] **Step 6.1:** Add `newOperationId` to `laneDeps` (random in production engine code is fine):

```typescript
import { createHash } from 'crypto';
// in laneDeps return object:
newOperationId: () => 'op-' + createHash('sha256').update(`${process.pid}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16),
```

Confirm a full engine `startLane` then `advanceLane(complete)` round trip still works through the lease path (extend `lane-engine-methods.test.ts`).

- [ ] **Step 6.2: Crash-recovery test** - write a checkpoint carrying a STALE lease (heartbeatAt far in the past), then assert the next `advanceLane(complete)` reclaims it (claimLease stale path) and commits. Append to the concurrency suite.

- [ ] **Step 6.3: Run PASS + commit** - `git commit -m "feat(lane-p3): engine operationId factory + crash-stale-lease reclaim"`.

---

## Task 7: Final integration check

- [ ] **Step 7.1:** `cd sidecoach && npx ts-node scripts/generate-lanes.ts --check && npm run build && npm test` gives --check OK, build exit 0, and `run-tests: 20 suite(s) passed` (16 prior + migration + lock + lease + concurrency). Every new suite present and required.
- [ ] **Step 7.2:** P1 hook regression green (110/0, 35/0).
- [ ] **Step 7.3:** Deferral leak check: `git diff --name-only main..lane-p3-durability | grep -E 'outbox|product-rule|flow-validation|mcp-server/|convergence-loop' && echo LEAK || echo clean`.
- [ ] **Step 7.4:** Rebuild + commit ONLY the lane-related dist (the lease changes touch lane-checkpoint-store, lane-runner, lane-lock, lane-types, sidecoach-orchestrator). Stage only those dist files + new lane-lock.* - never `git add -A`. Verify the CLI runs from the committed tree (stash dirty dist, run lane-cli, pop).

---

## Deferred to P4 (do NOT build here)

- Side-effect outbox + idempotent PUBLISH (no external side effects during P2/P3 advance).
- `AbortSignal` composition + propagation into async validators/handlers; heartbeat refresh during a long EXECUTE.
- Product validators, rule registry, convergence floor, loop execution, `lane_converge` enablement, MCP migration, modes.ts/dist deletion, ralph-loop rename, SKILL/marketing regen.

---

## Self-Review (apply the P2 lessons)

- **Trace every new function to its caller in the same task** (avoid P2's caller-less repeats): `withCheckpointLock` is consumed by claimLease/finalizeLease (Task 3); claimLease/finalizeLease by advanceLane (Task 4); newOperationId by advanceLane, supplied by laneDeps (Task 6).
- **Owner-checked commits** (avoid false attestation / superseded commits): finalizeLease commits only for the owning operationId; advanceLane still promotes only `successfulFlowIds`; the partial-serve and dup-on-in_progress guards from P2 are PRESERVED before the claim.
- **Honest claims:** the guarantee is AT-MOST-ONE COMMITTED TRANSITION (spec line 696), not exactly-once execution. Do not overclaim.
- **Ground against live code:** `dir()` is currently `private` (make it accessible for the lock); `LaneCheckpoint` is currently `schemaVersion: 1` (migrate, and update startLane's creation site, Task 1/3); the P2 advanceLane guards MUST survive the rewrite (the existing suites guard them).
- **Reviewer watch-items:** (1) the lock file and the checkpoint file both live under `.claude/lane-checkpoints/`; (2) `claimLease` reads cp INSIDE the lock then re-checks revision (TOCTOU closed); (3) `interrupt`/`stop` operate on the current on-disk revision under the lock, not a pre-claim snapshot.
