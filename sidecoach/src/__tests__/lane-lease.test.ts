// sidecoach/src/__tests__/lane-lease.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { LaneCheckpointStore, claimLease, finalizeLease, refreshHeartbeat } from '../lane-checkpoint-store';
import type { LaneCheckpoint } from '../lane-checkpoint-store';
import { withCheckpointLock } from '../lane-lock';
import { startLane, LaneRunnerDeps } from '../lane-runner';
import type { FlowExecutionResult } from '../flow-handler';

function okFlow(flowId: any): FlowExecutionResult {
  return { flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] };
}
function deps(proj: string, runFlow?: (flowId: any, ctx?: any) => Promise<FlowExecutionResult>): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: runFlow ?? (async (flowId) => okFlow(flowId)),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
  } as any;
}

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

async function runFirstStep() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-first-')));
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
  console.log('lane-lease first-step: OK');
}

run().then(runFirstStep);
