// sidecoach/src/__tests__/lane-side-effect-outbox.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, publishOutbox } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { LaneSideEffectSink } from '../lane-side-effect-sink';
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
  return { checkpointId: id, committedRevision: 4, fencingToken: 2, stepId: 'craft', iteration: 0,
    pendingPublishers: publishers, createdAt: '2026-01-01T00:00:00.000Z',
    entries: [{ publisher: 'lane-side-effect-sink', entryIndex: 0, logicalKey: `${id}:craft:0`, payload: { v: 1 } }] };
}
async function runMultiPublisherAck() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-multipub-')));
  const store = new LaneCheckpointStore(proj);
  // record with TWO declared publishers; the sink ack must NOT delete it - flow-history pends.
  store.write(baseCp('lane-multi', [rec('lane-multi', ['lane-side-effect-sink', 'flow-history'])]));
  await publishOutbox(store, 'lane-multi', proj, () => '2026-01-01T00:00:10.000Z');
  const after = store.read('lane-multi');
  if (after.sideEffectOutbox.length !== 1) throw new Error('a record with a still-pending publisher must survive the sink ack');
  if (JSON.stringify(after.sideEffectOutbox[0].pendingPublishers) !== JSON.stringify(['flow-history'])) throw new Error('the sink publisher must be acked INDIVIDUALLY, leaving flow-history pending');
  if (!new LaneSideEffectSink(proj).get('lane-multi:craft:0')) throw new Error('sink must hold the published entry');

  // a record whose ONLY declared publisher is the sink is fully drained after publish.
  store.write(baseCp('lane-solo', [rec('lane-solo', ['lane-side-effect-sink'])]));
  await publishOutbox(store, 'lane-solo', proj, () => '2026-01-01T00:00:11.000Z');
  if (store.read('lane-solo').sideEffectOutbox.length !== 0) throw new Error('a sink-only record must be drained when its sole publisher acks');
  console.log('lane-side-effect-outbox multi-publisher-ack: OK');
}

run().then(runMultiPublisherAck);
