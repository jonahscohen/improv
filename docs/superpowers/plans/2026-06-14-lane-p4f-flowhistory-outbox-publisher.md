# Lane P4f FlowHistory Outbox Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Keep every commit green. Do not touch the MCP server, hooks, or files outside the explicit file map below.

**Goal:** Add `flow-history` as the second declared lane outbox publisher so committed lane STEP results publish to FlowHistory only after FINALIZE, with lock-guarded fencing-token conditional idempotency and crash replay.

**Architecture:** Extend `FlowHistoryEntry` with optional lane metadata and add `FlowHistory.upsertLaneFlow`, a conditional upsert that scans the current project-keyed session for `laneLogicalKey`. A same-token replay is a no-op, a lower token is rejected, and a higher token replaces the previously accepted tagged run in place. Replacing in place makes the higher token genuinely supersede the old logical value without appending a stale duplicate. Existing `recordFlow` callers still append and retain the existing 20-run cap. A new `LaneFlowHistoryPublisher` reloads FlowHistory inside a global history-file lock and uses the canonical project path as its session key. `publishOutbox` dispatches both declared publishers, treats `written`, `noop`, and `rejected` as delivered, and acknowledges each publisher independently under the checkpoint lock. A shared lane-runner helper creates the two-publisher STEP outbox bundle at both existing STEP record creation sites.

**Tech Stack:** TypeScript, Node `fs` and `path`, `proper-lockfile` through `withCheckpointLock`, `ts-node`, the explicit `sidecoach/scripts/run-tests.ts` suite runner, and `tsc` through `npm run build`.

---

## Critical Context

- The authoritative frozen spec is `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md` lines 676-735.
- PUBLISH is the only place that may write FlowHistory for lane operations. Validators and handlers must not write it during EXECUTE.
- Every downstream publisher conditionally upserts by logical key and highest fencing token.
- Same logical key plus same token is a no-op. A lower token is rejected. A higher token supersedes the accepted value.
- `written`, `noop`, and `rejected` all mean delivered for outbox acknowledgement.
- A FlowHistory persistence error must throw from the lane conditional-upsert path so the publisher remains pending. Existing ordinary `recordFlow` callers keep their current log-and-return save behavior.
- Publisher acknowledgements update or remove the outbox record under the checkpoint lock without changing `LaneCheckpoint.revision`.
- An outbox record is removed only when `pendingPublishers` is empty.
- `publishPendingOutbox` is the crash-replay path and must replay both declared publishers.
- P4f changes the two existing committed STEP outbox creation sites in `lane-runner.ts`: first-step FINALIZE in `serveStepUnderLease`, and clean STEP completion FINALIZE in `advanceLane`.
- The separate convergence boundary outbox record is not a committed lane STEP result and remains sink-only in P4f.
- The flow-history entry uses a synthetic flow identity:
  - `flowId`: `lane:<laneId>:<stepId>`
  - `flowName`: `Lane <laneId>: <stepId>`
  - `status`: `success`
  - `message`: names the committed STEP result
  - `guidance` and `checklist`: copied from the persisted served-step result
- The flow-history entry logical key is `<checkpointId>:<stepId>:<iteration>:flow-history`. It is intentionally distinct from the sink logical key.
- The lane FlowHistory session key is the canonical project path. This prevents lane history from using the global `"default"` session while preserving existing non-lane singleton behavior.
- The current baseline command is `cd sidecoach && npm test`, and its expected final line is `run-tests: 45 suite(s) passed`.
- The new suite must be registered in `sidecoach/scripts/run-tests.ts` with `required: true`, raising the final count to 46.
- Before every implementation commit, run `cd sidecoach && npm run build && npm test`.
- The worktree contains unrelated dirty and untracked `sidecoach/dist` files. Never use `git add .`, `git add -A`, or `git add sidecoach/dist/`.
- All plan and implementation content must remain ASCII. Do not introduce em dashes, en dashes, emojis, NUL bytes, or control bytes.

### Chosen Fencing Mechanism

Use optional `laneLogicalKey` and `fencingToken` fields on `FlowHistoryEntry`, plus `FlowHistory.upsertLaneFlow`.

This is preferable to a separate dedup index because the accepted token stays adjacent to the value it fences, one atomic temp-file rename persists both, and a higher token can replace the prior tagged run in place. Existing untagged entries and `recordFlow` behavior are untouched. The replacement does not consume another slot, while new logical keys still use the normal 20-run cap.

---

## File Structure

**Create:**

- `sidecoach/src/lane-flow-history-publisher.ts`
  - Lock-guarded adapter from an outbox entry to `FlowHistory.upsertLaneFlow`.
- `sidecoach/src/__tests__/lane-flow-history-publisher.test.ts`
  - Direct fencing, replacement, ordinary append-cap, and public API compatibility coverage.

**Modify:**

- `sidecoach/src/flow-history.ts`
  - Add optional lane metadata, conditional upsert outcome, dynamic public history-file getter, shared append helper, and `upsertLaneFlow`.
- `sidecoach/src/lane-checkpoint-store.ts`
  - Declare `flow-history`, generalize publisher dispatch, and preserve individual acknowledgement behavior.
- `sidecoach/src/lane-runner.ts`
  - Add one shared STEP outbox builder and use it at both specified STEP FINALIZE sites.
- `sidecoach/src/__tests__/lane-side-effect-outbox.test.ts`
  - Cover both-publisher delivery, crash replay, idempotent replay, and record retention until both publishers ack.
- `sidecoach/scripts/run-tests.ts`
  - Register `lane-flow-history-publisher.test.ts` with `required: true`.

**Build output committed in the final task, with an explicit allowlist:**

- `sidecoach/dist/flow-history.d.ts`
- `sidecoach/dist/flow-history.d.ts.map`
- `sidecoach/dist/flow-history.js`
- `sidecoach/dist/flow-history.js.map`
- `sidecoach/dist/lane-flow-history-publisher.d.ts`
- `sidecoach/dist/lane-flow-history-publisher.d.ts.map`
- `sidecoach/dist/lane-flow-history-publisher.js`
- `sidecoach/dist/lane-flow-history-publisher.js.map`
- `sidecoach/dist/lane-checkpoint-store.d.ts`
- `sidecoach/dist/lane-checkpoint-store.d.ts.map`
- `sidecoach/dist/lane-checkpoint-store.js`
- `sidecoach/dist/lane-checkpoint-store.js.map`
- `sidecoach/dist/lane-runner.d.ts`
- `sidecoach/dist/lane-runner.d.ts.map`
- `sidecoach/dist/lane-runner.js`
- `sidecoach/dist/lane-runner.js.map`

---

## Task 1: Create the branch and verify the baseline

**Files:** None.

- [ ] **Step 1: Branch off main as `lane-p4f`**

```bash
cd /Users/spare3/Documents/Github/improv
git switch main
git switch -c lane-p4f
```

Expected output:

```text
Switched to branch 'main'
Switched to a new branch 'lane-p4f'
```

- [ ] **Step 2: Record the dirty baseline without changing it**

```bash
cd /Users/spare3/Documents/Github/improv
git status --short
```

Expected: exit 0 and the pre-existing unrelated dirty files are listed. Do not clean, reset, restore, or stage them.

- [ ] **Step 3: Run the engine baseline**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
npm test
```

Expected: both commands exit 0. The final test line is:

```text
run-tests: 45 suite(s) passed
```

There is no commit for this setup task.

---

## Task 2: Add FlowHistory conditional upsert semantics

**Files:**

- Modify: `sidecoach/src/flow-history.ts`
- Create: `sidecoach/src/__tests__/lane-flow-history-publisher.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing conditional-upsert test**

Create `sidecoach/src/__tests__/lane-flow-history-publisher.test.ts` with this complete content:

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FlowHistory, FlowHistoryEntry, getFlowHistory, resetFlowHistorySingleton } from '../flow-history';

function entry(message: string): FlowHistoryEntry {
  return {
    flowId: 'lane:lane_build:craft',
    flowName: 'Lane lane_build: craft',
    status: 'success',
    message,
    guidance: ['g'],
    checklist: [{ id: 'c', label: 'check', required: true, completed: false }],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-home-'));
  process.env.HOME = home;
  const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-project-')));
  const history = new FlowHistory(project);
  const logicalKey = 'lane-cp1:craft:0:flow-history';
  let tick = 0;
  const now = () => new Date(++tick * 1000).toISOString();

  const first = history.upsertLaneFlow(logicalKey, 7, entry('first'), now);
  assert(first.status === 'written', 'first token must write');
  assert(history.getFlowCount('lane:lane_build:craft') === 1, 'first write must append one tagged run');

  const replay = history.upsertLaneFlow(logicalKey, 7, entry('same-token replay'), now);
  assert(replay.status === 'noop', 'same token must be a no-op');
  assert(history.getFlowCount('lane:lane_build:craft') === 1, 'same token must not append a duplicate');
  assert(history.getLatestRun('lane:lane_build:craft')?.message === 'first', 'same token must preserve accepted payload');

  const stale = history.upsertLaneFlow(logicalKey, 6, entry('stale'), now);
  assert(stale.status === 'rejected', 'lower token must be rejected');
  assert(history.getFlowCount('lane:lane_build:craft') === 1, 'lower token must not append');
  assert(history.getLatestRun('lane:lane_build:craft')?.message === 'first', 'lower token must not replace accepted payload');

  const replacement = history.upsertLaneFlow(logicalKey, 8, entry('replacement'), now);
  assert(replacement.status === 'written', 'higher token must write');
  assert(history.getFlowCount('lane:lane_build:craft') === 1, 'higher token must replace instead of append');
  const accepted = history.getLatestRun('lane:lane_build:craft');
  assert(accepted?.message === 'replacement', 'higher token payload must supersede');
  assert(accepted?.laneLogicalKey === logicalKey, 'accepted run must persist the lane logical key');
  assert(accepted?.fencingToken === 8, 'accepted run must persist the highest fencing token');

  const blockedHome = path.join(home, 'blocked-home');
  fs.writeFileSync(blockedHome, 'not a directory');
  process.env.HOME = blockedHome;
  let strictSaveFailed = false;
  try {
    new FlowHistory(project).upsertLaneFlow('lane-cp1:polish:0:flow-history', 9, entry('must fail'), now);
  } catch {
    strictSaveFailed = true;
  }
  assert(strictSaveFailed, 'lane conditional upsert must throw when the durable save fails');
  process.env.HOME = home;

  const ordinary = new FlowHistory('ordinary-session');
  for (let i = 0; i < 21; i++) {
    ordinary.recordFlow({
      flowId: 'flowJ_tactical_polish',
      flowName: 'Tactical Polish',
      status: 'success',
      message: `ordinary-${i}`,
    });
  }
  assert(ordinary.hasFlowExecuted('flowJ_tactical_polish'), 'existing hasFlowExecuted API must still work');
  assert(ordinary.getFlowCount('flowJ_tactical_polish') === 20, 'ordinary recordFlow must preserve the 20-run cap');
  assert(ordinary.getFlowRuns('flowJ_tactical_polish')[0].message === 'ordinary-1', 'ordinary cap must discard only the oldest run');
  assert(ordinary.getFlowSequence().length === 1, 'existing getFlowSequence API must still return one latest entry per flow');

  process.env.SIDECOACH_SESSION_ID = 'singleton-session';
  resetFlowHistorySingleton();
  getFlowHistory().recordFlow({
    flowId: 'flowK_multi_lens_audit',
    flowName: 'Multi-Lens Audit',
    status: 'success',
    message: 'singleton',
  });
  resetFlowHistorySingleton();
  assert(getFlowHistory().getFlowCount('flowK_multi_lens_audit') === 1, 'existing singleton API must still reload persisted history');
  resetFlowHistorySingleton();

  console.log('lane-flow-history-publisher conditional-upsert: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-flow-history-publisher.test.ts
```

Expected: exit nonzero with a TypeScript error containing:

```text
Property 'upsertLaneFlow' does not exist on type 'FlowHistory'
```

- [ ] **Step 3: Implement the additive FlowHistory fields and conditional upsert**

In `sidecoach/src/flow-history.ts`, add this interface immediately after `FlowHistoryEntry`:

```typescript
export interface FlowHistoryUpsertOutcome {
  status: 'written' | 'noop' | 'rejected';
}
```

Add these two optional fields at the end of `FlowHistoryEntry`:

```typescript
  laneLogicalKey?: string;
  fencingToken?: number;
```

Replace the existing private static `HISTORY_FILE` field with this public dynamic getter:

```typescript
  static get HISTORY_FILE(): string {
    return path.join(
      process.env.HOME || '~',
      '.claude',
      'sidecoach-flow-history.json'
    );
  }
```

Replace the existing `save` method with this strict-optional version:

```typescript
  private save(throwOnError = false): void {
    try {
      const dir = path.dirname(FlowHistory.HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Object.fromEntries(this.history);
      const tmp = `${FlowHistory.HISTORY_FILE}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmp, FlowHistory.HISTORY_FILE);
    } catch (error) {
      console.error('Failed to save flow history:', error);
      if (throwOnError) throw error;
    }
  }
```

Replace the existing `recordFlow` method with this shared append helper, unchanged public method, and new conditional upsert method:

```typescript
  private appendFlow(entry: FlowHistoryEntry, now: () => string, strictSave = false): void {
    const session = this.getSessionHistory();
    const flowId = entry.flowId;

    if (!session.flowSequence.includes(flowId)) {
      session.flowSequence.push(flowId);
    }

    const entryWithTimestamp: FlowHistoryEntry = {
      ...entry,
      timestamp: now(),
    };

    let runs: FlowHistoryEntry[] = [];
    const existing: any = session.flowOutputs[flowId];

    if (existing && Array.isArray(existing)) {
      runs = existing;
    } else if (existing) {
      runs = [existing as FlowHistoryEntry];
    }

    if (runs.length >= 20) {
      runs.shift();
    }
    runs.push(entryWithTimestamp);
    session.flowOutputs[flowId] = runs;
    this.save(strictSave);
  }

  /**
   * Record an ordinary flow execution. Existing callers remain append-oriented.
   */
  recordFlow(entry: FlowHistoryEntry): void {
    this.appendFlow(entry, () => new Date().toISOString());
  }

  /**
   * Conditionally upsert one committed lane STEP result by logical key and token.
   * New keys append through the normal 20-run cap. Higher tokens replace the
   * accepted tagged run in place. Same tokens no-op and lower tokens reject.
   */
  upsertLaneFlow(
    logicalKey: string,
    fencingToken: number,
    entry: FlowHistoryEntry,
    now: () => string = () => new Date().toISOString(),
  ): FlowHistoryUpsertOutcome {
    const session = this.getSessionHistory();

    for (const [flowId, stored] of Object.entries(session.flowOutputs)) {
      const runs = Array.isArray(stored) ? stored : [stored as FlowHistoryEntry];
      const index = runs.findIndex((run) => run.laneLogicalKey === logicalKey);
      if (index < 0) continue;

      const currentToken = runs[index].fencingToken ?? -1;
      if (fencingToken < currentToken) return { status: 'rejected' };
      if (fencingToken === currentToken) return { status: 'noop' };

      runs[index] = {
        ...entry,
        flowId,
        laneLogicalKey: logicalKey,
        fencingToken,
        timestamp: now(),
      };
      session.flowOutputs[flowId] = runs;
      this.save(true);
      return { status: 'written' };
    }

    this.appendFlow({ ...entry, laneLogicalKey: logicalKey, fencingToken }, now, true);
    return { status: 'written' };
  }
```

- [ ] **Step 4: Register the new suite**

In `sidecoach/scripts/run-tests.ts`, add this exact entry immediately after `lane-side-effect-outbox.test.ts`:

```typescript
  { rel: 'src/__tests__/lane-flow-history-publisher.test.ts', required: true },
```

- [ ] **Step 5: Run the direct test to confirm it passes**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-flow-history-publisher.test.ts
```

Expected output:

```text
lane-flow-history-publisher conditional-upsert: OK
```

- [ ] **Step 6: Run the green commit gate**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
npm test
```

Expected: exit 0. The final test line is:

```text
run-tests: 46 suite(s) passed
```

- [ ] **Step 7: Commit source and test registration only**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/flow-history.ts sidecoach/src/__tests__/lane-flow-history-publisher.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4f): add conditional FlowHistory lane upsert"
```

Expected: one commit is created. Do not stage generated `dist` yet.

---

## Task 3: Add the lock-guarded FlowHistory publisher

**Files:**

- Create: `sidecoach/src/lane-flow-history-publisher.ts`
- Modify: `sidecoach/src/__tests__/lane-flow-history-publisher.test.ts`

- [ ] **Step 1: Extend the test with the publisher contract**

Add this import to `lane-flow-history-publisher.test.ts`:

```typescript
import { LaneFlowHistoryPublisher } from '../lane-flow-history-publisher';
```

Add this block after the direct `FlowHistory.upsertLaneFlow` assertions and before the ordinary `recordFlow` assertions:

```typescript
  const publisherProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-publisher-project-')));
  const publisher = new LaneFlowHistoryPublisher(publisherProject);
  const publisherKey = 'lane-cp2:shape:0:flow-history';
  const publisherFirst = await publisher.upsert(publisherKey, 11, {
    flowId: 'lane:lane_build:shape',
    flowName: 'Lane lane_build: shape',
    status: 'success',
    message: 'published',
  }, now);
  assert(publisherFirst.status === 'written', 'publisher must write the first accepted token');
  assert((await publisher.upsert(publisherKey, 11, entry('ignored'), now)).status === 'noop', 'publisher same-token replay must no-op');
  assert((await publisher.upsert(publisherKey, 10, entry('ignored'), now)).status === 'rejected', 'publisher lower token must reject');
  const publisherHistory = new FlowHistory(publisherProject);
  assert(publisherHistory.getFlowCount('lane:lane_build:shape') === 1, 'publisher must persist one idempotent run in the project session');
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-flow-history-publisher.test.ts
```

Expected: exit nonzero with:

```text
Cannot find module '../lane-flow-history-publisher'
```

- [ ] **Step 3: Create the complete publisher**

Create `sidecoach/src/lane-flow-history-publisher.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { FlowHistory, FlowHistoryEntry, FlowHistoryUpsertOutcome } from './flow-history';
import { withCheckpointLock } from './lane-lock';

export class LaneFlowHistoryPublisher {
  private readonly sessionId: string;
  private readonly lockDir: string;

  constructor(projectPath: string) {
    this.sessionId = fs.realpathSync(projectPath);
    this.lockDir = path.dirname(FlowHistory.HISTORY_FILE);
  }

  upsertSync(
    logicalKey: string,
    fencingToken: number,
    payload: FlowHistoryEntry,
    now?: () => string,
  ): FlowHistoryUpsertOutcome {
    const history = new FlowHistory(this.sessionId);
    return history.upsertLaneFlow(logicalKey, fencingToken, payload, now);
  }

  async upsert(
    logicalKey: string,
    fencingToken: number,
    payload: FlowHistoryEntry,
    now?: () => string,
  ): Promise<FlowHistoryUpsertOutcome> {
    return withCheckpointLock(
      this.lockDir,
      'flow-history',
      () => this.upsertSync(logicalKey, fencingToken, payload, now),
    );
  }
}
```

The fresh `FlowHistory` instance inside `upsertSync` is required. It reloads the file after the global history lock is acquired, so two processes do not decide from stale in-memory snapshots.

- [ ] **Step 4: Run the direct test to confirm it passes**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-flow-history-publisher.test.ts
```

Expected output:

```text
lane-flow-history-publisher conditional-upsert: OK
```

- [ ] **Step 5: Run the green commit gate**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
npm test
```

Expected: exit 0 with:

```text
run-tests: 46 suite(s) passed
```

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-flow-history-publisher.ts sidecoach/src/__tests__/lane-flow-history-publisher.test.ts
git commit -m "feat(lane-p4f): add locked FlowHistory outbox publisher"
```

Expected: one commit is created. Do not stage generated `dist`.

---

## Task 4: Generalize outbox dispatch and preserve individual acknowledgement

**Files:**

- Modify: `sidecoach/src/lane-checkpoint-store.ts`
- Modify: `sidecoach/src/__tests__/lane-side-effect-outbox.test.ts`

- [ ] **Step 1: Replace the old multi-publisher fixture with a two-entry fixture**

In `sidecoach/src/__tests__/lane-side-effect-outbox.test.ts`, add:

```typescript
import { FlowHistory } from '../flow-history';
```

Replace the existing `rec` helper with:

```typescript
function rec(id: string, publishers: string[]): any {
  return {
    checkpointId: id,
    committedRevision: 4,
    fencingToken: 2,
    stepId: 'craft',
    iteration: 0,
    pendingPublishers: publishers,
    createdAt: '2026-01-01T00:00:00.000Z',
    entries: [
      {
        publisher: 'lane-side-effect-sink',
        entryIndex: 0,
        logicalKey: `${id}:craft:0`,
        payload: { v: 1 },
      },
      {
        publisher: 'flow-history',
        entryIndex: 1,
        logicalKey: `${id}:craft:0:flow-history`,
        payload: {
          flowId: 'lane:lane_build:craft',
          flowName: 'Lane lane_build: craft',
          status: 'success',
          message: 'committed craft',
        },
      },
    ],
  };
}
```

Replace `runMultiPublisherAck` with:

```typescript
async function runMultiPublisherAck() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-multipub-home-'));
  process.env.HOME = home;
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-multipub-')));
  const store = new LaneCheckpointStore(proj);

  store.write(baseCp('lane-multi', [rec('lane-multi', ['lane-side-effect-sink', 'flow-history'])]));
  await publishOutbox(store, 'lane-multi', proj, () => '2026-01-01T00:00:10.000Z');
  const after = store.read('lane-multi');
  if (after.sideEffectOutbox.length !== 0) throw new Error('record must be removed only after both declared publishers ack');
  if (!new LaneSideEffectSink(proj).get('lane-multi:craft:0')) throw new Error('sink must hold the published entry');
  const flowHistory = new FlowHistory(proj);
  const flowRun = flowHistory.getLatestRun('lane:lane_build:craft');
  if (flowRun?.laneLogicalKey !== 'lane-multi:craft:0:flow-history' || flowRun.fencingToken !== 2) {
    throw new Error('flow-history must hold the committed logical key and fencing token');
  }

  const rejectedDelivery = rec('lane-rejected', ['flow-history']);
  rejectedDelivery.fencingToken = 1;
  rejectedDelivery.entries = rejectedDelivery.entries.filter((entry: any) => entry.publisher === 'flow-history');
  rejectedDelivery.entries[0].logicalKey = 'lane-multi:craft:0:flow-history';
  store.write(baseCp('lane-rejected', [rejectedDelivery]));
  await publishOutbox(store, 'lane-rejected', proj, () => '2026-01-01T00:00:10.250Z');
  if (store.read('lane-rejected').sideEffectOutbox.length !== 0) throw new Error('rejected lower-token delivery must still ack its publisher');
  if (new FlowHistory(proj).getLatestRun('lane:lane_build:craft')?.fencingToken !== 2) {
    throw new Error('rejected lower-token delivery must preserve the higher accepted flow-history token');
  }

  const blockedHome = path.join(home, 'blocked-home');
  fs.writeFileSync(blockedHome, 'not a directory');
  process.env.HOME = blockedHome;
  store.write(baseCp('lane-publisher-fail', [rec('lane-publisher-fail', ['lane-side-effect-sink', 'flow-history'])]));
  let flowHistoryFailed = false;
  try {
    await publishOutbox(store, 'lane-publisher-fail', proj, () => '2026-01-01T00:00:10.500Z');
  } catch {
    flowHistoryFailed = true;
  }
  if (!flowHistoryFailed) throw new Error('flow-history persistence failure must leave its publisher pending');
  const failedAfter = store.read('lane-publisher-fail');
  if (JSON.stringify(failedAfter.sideEffectOutbox[0].pendingPublishers) !== JSON.stringify(['flow-history'])) {
    throw new Error('sink must ack individually before a later flow-history publisher failure');
  }
  if (!new LaneSideEffectSink(proj).get('lane-publisher-fail:craft:0')) throw new Error('sink delivery must survive later publisher failure');
  process.env.HOME = home;

  const retained = rec('lane-retained', ['lane-side-effect-sink', 'unknown-publisher']);
  retained.entries = retained.entries.filter((entry: any) => entry.publisher === 'lane-side-effect-sink');
  store.write(baseCp('lane-retained', [retained]));
  const revisionBefore = store.read('lane-retained').revision;
  await publishOutbox(store, 'lane-retained', proj, () => '2026-01-01T00:00:11.000Z');
  const retainedAfter = store.read('lane-retained');
  if (retainedAfter.revision !== revisionBefore) throw new Error('publisher acknowledgement must not change semantic revision');
  if (retainedAfter.sideEffectOutbox.length !== 1) throw new Error('record must survive while any publisher remains pending');
  if (JSON.stringify(retainedAfter.sideEffectOutbox[0].pendingPublishers) !== JSON.stringify(['unknown-publisher'])) {
    throw new Error('declared handled publisher must ack individually and leave unknown publisher pending');
  }

  console.log('lane-side-effect-outbox multi-publisher-ack: OK');
}
```

- [ ] **Step 2: Run the outbox test to confirm it fails**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-side-effect-outbox.test.ts
```

Expected: exit nonzero with:

```text
Error: record must be removed only after both declared publishers ack
```

- [ ] **Step 3: Generalize `publishOutbox`**

In `sidecoach/src/lane-checkpoint-store.ts`, add:

```typescript
import type { FlowHistoryEntry } from './flow-history';
import { LaneFlowHistoryPublisher } from './lane-flow-history-publisher';
```

Replace `OUTBOX_PUBLISHERS` and the entire `publishOutbox` function with:

```typescript
export const OUTBOX_PUBLISHERS = ['lane-side-effect-sink', 'flow-history'] as const;

async function ackOutboxPublisher(
  store: LaneCheckpointStore,
  checkpointId: string,
  record: SideEffectOutboxRecord,
  publisher: string,
  clock: () => string,
): Promise<void> {
  await withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    const rec = cp.sideEffectOutbox.find(
      (candidate) => candidate.committedRevision === record.committedRevision
        && candidate.fencingToken === record.fencingToken,
    );
    if (!rec) return;
    rec.pendingPublishers = rec.pendingPublishers.filter((pending) => pending !== publisher);
    if (rec.pendingPublishers.length === 0) {
      cp.sideEffectOutbox = cp.sideEffectOutbox.filter((candidate) => candidate !== rec);
    }
    cp.updatedAt = clock();
    store.write(cp);
  });
}

export async function publishOutbox(
  store: LaneCheckpointStore,
  checkpointId: string,
  projectPath: string,
  now?: () => string,
): Promise<void> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  const sink = new LaneSideEffectSink(projectPath);
  const flowHistory = new LaneFlowHistoryPublisher(projectPath);
  const dispatch: Record<(typeof OUTBOX_PUBLISHERS)[number], (entry: SideEffectOutboxRecord['entries'][number], fencingToken: number) => Promise<void>> = {
    'lane-side-effect-sink': async (entry, fencingToken) => {
      await sink.upsert(entry.logicalKey, fencingToken, entry.payload, clock);
    },
    'flow-history': async (entry, fencingToken) => {
      await flowHistory.upsert(entry.logicalKey, fencingToken, entry.payload as FlowHistoryEntry, clock);
    },
  };

  const snapshot = store.read(checkpointId).sideEffectOutbox;
  for (const record of snapshot) {
    for (const publisher of OUTBOX_PUBLISHERS) {
      if (!record.pendingPublishers.includes(publisher)) continue;
      for (const entry of record.entries) {
        if (entry.publisher !== publisher) continue;
        await dispatch[publisher](entry, record.fencingToken);
      }
      await ackOutboxPublisher(store, checkpointId, record, publisher, clock);
    }
  }
}
```

Do not change `publishPendingOutbox`. It already calls `publishOutbox`, so the generalized dispatch automatically makes crash replay cover both publishers.

- [ ] **Step 4: Run the direct tests**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-flow-history-publisher.test.ts
npx ts-node src/__tests__/lane-side-effect-outbox.test.ts
```

Expected final lines:

```text
lane-flow-history-publisher conditional-upsert: OK
lane-side-effect-outbox multi-publisher-ack: OK
```

- [ ] **Step 5: Run the green commit gate**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
npm test
```

Expected: exit 0 with:

```text
run-tests: 46 suite(s) passed
```

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-checkpoint-store.ts sidecoach/src/__tests__/lane-side-effect-outbox.test.ts
git commit -m "feat(lane-p4f): dispatch and ack both outbox publishers"
```

Expected: one commit is created. Do not stage generated `dist`.

---

## Task 5: Add both publisher entries at the two committed STEP FINALIZE sites

**Files:**

- Modify: `sidecoach/src/lane-runner.ts`
- Modify: `sidecoach/src/__tests__/lane-side-effect-outbox.test.ts`

- [ ] **Step 1: Add integration assertions for generated STEP records and crash replay**

In `sidecoach/src/__tests__/lane-side-effect-outbox.test.ts`, add this line at the start of `run`, before creating `proj`:

```typescript
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-obx-home-'));
```

After the existing first `startLane` call, add:

```typescript
  const firstStepHistory = new FlowHistory(proj).getLatestRun(`lane:lane_build:${s.currentVerb}`);
  if (!firstStepHistory?.laneLogicalKey?.endsWith(':flow-history')) throw new Error('first-step FINALIZE must publish a flow-history entry');
```

After `const pendingRecord = pending.sideEffectOutbox[0];`, add:

```typescript
  if (JSON.stringify(pendingRecord.pendingPublishers) !== JSON.stringify(['lane-side-effect-sink', 'flow-history'])) {
    throw new Error('committed STEP outbox must declare both publishers');
  }
  if (pendingRecord.entries.length !== 2
      || pendingRecord.entries[0].publisher !== 'lane-side-effect-sink'
      || pendingRecord.entries[0].entryIndex !== 0
      || pendingRecord.entries[1].publisher !== 'flow-history'
      || pendingRecord.entries[1].entryIndex !== 1) {
    throw new Error('committed STEP outbox must contain stable sink and flow-history entries');
  }
```

After the existing sink replay assertion:

```typescript
  if (sink2.get(k2)?.fencingToken !== pendingRecord.fencingToken) throw new Error('production replay publishes the committed fencing token');
```

add:

```typescript
  const historyAfterReplay = new FlowHistory(proj);
  const replayedFlow = historyAfterReplay.getLatestRun('lane:lane_build:craft');
  if (replayedFlow?.fencingToken !== pendingRecord.fencingToken) throw new Error('crash replay must publish flow-history with the committed fencing token');
  const countBeforeReplay = historyAfterReplay.getFlowCount('lane:lane_build:craft');
  const replayArtifact = d2.store.read(s2.checkpointId);
  replayArtifact.sideEffectOutbox.push(pendingRecord);
  d2.store.write(replayArtifact);
  await publishOutbox(d2.store, s2.checkpointId, proj, d2.now);
  if (d2.store.read(s2.checkpointId).sideEffectOutbox.length !== 0) {
    throw new Error('same-token no-op replay must still ack both publishers');
  }
  if (new FlowHistory(proj).getFlowCount('lane:lane_build:craft') !== countBeforeReplay) {
    throw new Error('same committed outbox replay must not append a duplicate flow-history run');
  }
```

Keep the existing later automatic recovery reseed block unchanged. It proves that a later production entrypoint reaches generalized `publishPendingOutbox` after the direct idempotent replay proof.

- [ ] **Step 2: Run the outbox test to confirm it fails**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-side-effect-outbox.test.ts
```

Expected: exit nonzero with:

```text
Error: first-step FINALIZE must publish a flow-history entry
```

- [ ] **Step 3: Add one shared STEP outbox builder**

In `sidecoach/src/lane-runner.ts`, extend the checkpoint-store import to include `OUTBOX_PUBLISHERS`:

```typescript
import { LaneCheckpoint, LaneCheckpointStore, finalizeLease, claimLease, leaseIsLive, refreshHeartbeat, publishOutbox, publishPendingOutbox, OUTBOX_PUBLISHERS } from './lane-checkpoint-store';
```

Extend the lane-types imports with `SideEffectOutboxRecord`:

```typescript
import type { GateStatus, PersistedStepGateStatus, LaneStepStatus, SideEffectOutboxRecord } from './lane-types';
```

Add this helper immediately after `type ServedEntry`:

```typescript
function committedStepOutbox(
  checkpoint: LaneCheckpoint,
  stepId: string,
  iteration: number,
  committedRevision: number,
  fencingToken: number,
  createdAt: string,
  sinkPayload: unknown,
  served: ServedEntry,
): SideEffectOutboxRecord {
  const baseKey = `${checkpoint.checkpointId}:${stepId}:${iteration}`;
  return {
    checkpointId: checkpoint.checkpointId,
    committedRevision,
    fencingToken,
    stepId,
    iteration,
    pendingPublishers: [...OUTBOX_PUBLISHERS],
    createdAt,
    entries: [
      {
        publisher: 'lane-side-effect-sink',
        entryIndex: 0,
        logicalKey: baseKey,
        payload: sinkPayload,
      },
      {
        publisher: 'flow-history',
        entryIndex: 1,
        logicalKey: `${baseKey}:flow-history`,
        payload: {
          flowId: `lane:${checkpoint.laneId}:${stepId}`,
          flowName: `Lane ${checkpoint.laneId}: ${stepId}`,
          status: 'success',
          message: `Committed lane STEP ${stepId} for ${checkpoint.laneId} at revision ${committedRevision}.`,
          guidance: [...served.guidance],
          checklist: [...served.checklist],
        },
      },
    ],
  };
}
```

- [ ] **Step 4: Replace the first-step FINALIZE outbox creation**

In `serveStepUnderLease`, replace the complete `c.sideEffectOutbox.push({ ... })` block with:

```typescript
      c.sideEffectOutbox.push(committedStepOutbox(
        c,
        step.verb,
        id.iteration,
        committedRevision,
        id.fencingToken,
        d.now(),
        { laneId: c.laneId, verb: step.verb, served: true, committedRevision },
        acc,
      ));
```

- [ ] **Step 5: Replace the clean STEP completion FINALIZE outbox creation**

In the clean `advanceLane` FINALIZE branch, replace the complete `c.sideEffectOutbox.push({ ... })` block with:

```typescript
            c.sideEffectOutbox.push(committedStepOutbox(
              c,
              step.verb,
              id.iteration,
              committedRevision,
              id.fencingToken,
              d.now(),
              { laneId: cp.laneId, verb: step.verb, gateStatus: worst, validators: gate.validators, committedRevision },
              served!,
            ));
```

Do not change the convergence boundary outbox block in `runIterationBoundary`.

- [ ] **Step 6: Run the direct outbox test**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-side-effect-outbox.test.ts
```

Expected final lines:

```text
lane-side-effect-outbox: OK
lane-side-effect-outbox multi-publisher-ack: OK
```

- [ ] **Step 7: Run targeted regression suites**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/lane-flow-history-publisher.test.ts
npx ts-node src/__tests__/lane-lease.test.ts
npx ts-node src/__tests__/lane-runner-concurrency.test.ts
npx ts-node src/__tests__/lane-loop-boundary-converge.test.ts
```

Expected: every command exits 0. Required final lines include:

```text
lane-flow-history-publisher conditional-upsert: OK
lane-lease retry-during-first-step: OK
lane-loop-boundary-converge: OK
```

- [ ] **Step 8: Run the green commit gate**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
npm test
```

Expected: exit 0 with:

```text
run-tests: 46 suite(s) passed
```

- [ ] **Step 9: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-side-effect-outbox.test.ts
git commit -m "feat(lane-p4f): publish committed STEP results to FlowHistory"
```

Expected: one commit is created. Do not stage generated `dist`.

---

## Task 6: Final verification and explicit production dist commit

**Files:**

- Build and commit only the production dist allowlist in the File Structure section.

- [ ] **Step 1: Run the full source verification**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
npm test
```

Expected: exit 0 with:

```text
run-tests: 46 suite(s) passed
```

- [ ] **Step 2: Verify both STEP creation sites use the helper and the boundary remains sink-only**

```bash
cd /Users/spare3/Documents/Github/improv
rg -n "committedStepOutbox|boundary:|pendingPublishers" sidecoach/src/lane-runner.ts
```

Expected:

- Exactly one `committedStepOutbox` definition.
- Exactly two `committedStepOutbox(` call sites.
- The boundary record still uses `pendingPublishers: ['lane-side-effect-sink']`.

- [ ] **Step 3: Verify publisher declaration, dispatch, and replay path**

```bash
cd /Users/spare3/Documents/Github/improv
rg -n "OUTBOX_PUBLISHERS|LaneFlowHistoryPublisher|publishPendingOutbox|publishOutbox" sidecoach/src/lane-checkpoint-store.ts
```

Expected: `OUTBOX_PUBLISHERS` contains both publisher names, `publishOutbox` constructs `LaneFlowHistoryPublisher`, and `publishPendingOutbox` still delegates to `publishOutbox`.

- [ ] **Step 4: Run ASCII and control-byte guards on every changed source and plan file**

```bash
cd /Users/spare3/Documents/Github/improv
LC_ALL=C rg -n "[^ -~]" \
  docs/superpowers/plans/2026-06-14-lane-p4f-flowhistory-outbox-publisher.md \
  sidecoach/src/flow-history.ts \
  sidecoach/src/lane-flow-history-publisher.ts \
  sidecoach/src/lane-checkpoint-store.ts \
  sidecoach/src/lane-runner.ts \
  sidecoach/src/__tests__/lane-flow-history-publisher.test.ts \
  sidecoach/src/__tests__/lane-side-effect-outbox.test.ts \
  sidecoach/scripts/run-tests.ts
```

Expected: exit 1 with no output. That means no non-ASCII or control bytes were found.

- [ ] **Step 5: Stage the explicit production dist allowlist**

```bash
cd /Users/spare3/Documents/Github/improv
git add \
  sidecoach/dist/flow-history.d.ts \
  sidecoach/dist/flow-history.d.ts.map \
  sidecoach/dist/flow-history.js \
  sidecoach/dist/flow-history.js.map \
  sidecoach/dist/lane-flow-history-publisher.d.ts \
  sidecoach/dist/lane-flow-history-publisher.d.ts.map \
  sidecoach/dist/lane-flow-history-publisher.js \
  sidecoach/dist/lane-flow-history-publisher.js.map \
  sidecoach/dist/lane-checkpoint-store.d.ts \
  sidecoach/dist/lane-checkpoint-store.d.ts.map \
  sidecoach/dist/lane-checkpoint-store.js \
  sidecoach/dist/lane-checkpoint-store.js.map \
  sidecoach/dist/lane-runner.d.ts \
  sidecoach/dist/lane-runner.d.ts.map \
  sidecoach/dist/lane-runner.js \
  sidecoach/dist/lane-runner.js.map
git diff --cached --name-only
```

Expected: the cached list contains exactly the 16 production dist files above and no unrelated dirty dist files.

- [ ] **Step 6: Commit the affected runtime build**

```bash
cd /Users/spare3/Documents/Github/improv
git commit -m "build(lane-p4f): compile FlowHistory outbox publisher"
```

Expected: one build commit is created.

- [ ] **Step 7: Verify final branch state without disturbing unrelated work**

```bash
cd /Users/spare3/Documents/Github/improv
git status --short
git log --oneline main..lane-p4f
```

Expected:

- The four P4f source commits plus the final build commit are listed.
- Pre-existing unrelated dirty and untracked files may still appear.
- No P4f source file or allowlisted production dist file remains unstaged or uncommitted.

---

## Self-Review

- [ ] Frozen spec lines 687-693 are covered: both downstream stores conditionally upsert, replay is safe, and publisher acknowledgements do not change semantic revision.
- [ ] Frozen spec lines 713-719 are covered: FlowHistory writes occur only through the committed outbox after FINALIZE. No validator or handler gains an EXECUTE-time FlowHistory write.
- [ ] Frozen spec lines 720-723 are covered: logical key and highest token persist together; same token no-ops; lower token rejects; higher token replaces; records remain until every declared publisher confirms.
- [ ] Both requested committed STEP outbox creation sites use the same `committedStepOutbox` helper.
- [ ] The convergence boundary outbox remains outside P4f because it is not a committed lane STEP result.
- [ ] `publishOutbox` dispatches both declared publishers and acknowledges each handled publisher individually.
- [ ] `written`, `noop`, and `rejected` all count as delivered because dispatch only throws on an actual publisher failure.
- [ ] A FlowHistory persistence failure throws from `upsertLaneFlow`, so `publishOutbox` does not acknowledge a value that was not durably saved.
- [ ] `publishPendingOutbox` replays FlowHistory automatically through generalized `publishOutbox`.
- [ ] The record-removal invariant is preserved: delete only when `pendingPublishers.length === 0`.
- [ ] `LaneCheckpoint.revision` is unchanged by publisher acknowledgement.
- [ ] FlowHistory fencing semantics mirror the sink: first or higher token is `written`, same token is `noop`, lower token is `rejected`.
- [ ] Higher-token replacement does not append a stale duplicate.
- [ ] Existing `recordFlow`, `getFlowRuns`, `hasFlowExecuted`, `getFlowCount`, `getFlowSequence`, `getFlowOutput`, `getLatestRun`, and singleton APIs remain available.
- [ ] Existing non-lane `recordFlow` callers retain append behavior and the 20-run cap.
- [ ] Tests cover replay-once, idempotent replay no-op, lower-token rejection, higher-token replacement, crash-after-FINALIZE replay of both publishers, and record removal only after all publishers ack.
- [ ] The new test suite is registered with `required: true`.
- [ ] Every implementation commit passed `cd sidecoach && npm run build && npm test`.
- [ ] The final runtime build used the explicit per-file dist allowlist and never staged unrelated dirty dist output.
- [ ] The plan and changed files pass the ASCII and control-byte guard.
- [ ] No placeholders remain in the plan.

---

## v1 notes

- P4f intentionally publishes only committed lane STEP result records. The convergence boundary record remains sink-only.
- The lane publisher uses canonical `projectPath` as the FlowHistory session key. Existing non-lane callers continue using `getFlowHistory()` and `SIDECOACH_SESSION_ID` or `"default"`.
- The accepted lane token is stored on the FlowHistory entry itself. No second dedup index can drift from the value it fences.
- A higher token replaces the accepted tagged run in place. A new logical key appends through the existing 20-run cap.
- P4f does not add session-memory publication. That requires its own declared publisher and outbox payload contract.
- P4f does not touch MCP server code, hooks, browser collection, copy gating, or the frozen spec.
