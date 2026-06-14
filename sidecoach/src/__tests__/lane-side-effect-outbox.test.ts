// sidecoach/src/__tests__/lane-side-effect-outbox.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, publishOutbox } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { LaneSideEffectSink } from '../lane-side-effect-sink';
import { FlowHistory } from '../flow-history';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function okResult(): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}
// Module-level counters: this suite keeps MULTIPLE lanes alive in ONE project, so the
// checkpoint id must be unique across deps() instances (a per-instance counter would
// alias hero/hero2 to the same id and collide their sink entries).
let cpCounter = 0, opCounter = 0;
function deps(proj: string, validator?: (id: string) => Promise<ProductValidationResult>): LaneRunnerDeps {
  let t = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId: any) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++cpCounter}`,
    newOperationId: () => `op-${++opCounter}`,
    runValidator: validator ?? (async () => okResult()),
  } as any;
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 's', evidence: [{ kind: 'note', detail: 'x' }] });

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

// P2: the outbox ack must remove publishers INDIVIDUALLY and delete a record only when
// pendingPublishers is empty (so P4f's FlowHistory publisher, declared alongside the sink,
// is never dropped when the sink acks first).
function baseCp(id: string, outbox: any[]): any {
  return { schemaVersion: 2, checkpointId: id, laneId: 'lane_build', target: 't',
    executionKind: 'sequence', lifecycle: 'in_progress', cursor: 1, iteration: 0,
    completedStepIds: ['shape'], skippedStepIds: [], completedFlowIds: [], stepReports: [], audit: [],
    servedSteps: {}, revision: 5, startRequestId: `req-${id}`, seenReportIds: [],
    fencingCounter: 3, lease: null, sideEffectOutbox: outbox, stepGateStatuses: {},
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}
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

run().then(runMultiPublisherAck);
