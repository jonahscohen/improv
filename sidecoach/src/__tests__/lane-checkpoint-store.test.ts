// sidecoach/src/__tests__/lane-checkpoint-store.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, LaneCheckpoint } from '../lane-checkpoint-store';

function fresh(): LaneCheckpoint {
  return {
    schemaVersion: 2, checkpointId: 'lane-abc123', laneId: 'lane_build', target: 'hero',
    executionKind: 'sequence', lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId: 'req1',
    seenReportIds: [], fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {},
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
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
  try { store.write({ ...fresh(), schemaVersion: 3 as any }); } catch { threw = true; }
  if (!threw) throw new Error('schemaVersion 3 rejected (writes only v2)');

  // P2-1: when a CLOSED and an ACTIVE checkpoint share a startRequestId (a closed
  // run + a closed-restart), findByStartRequestId must prefer the ACTIVE one -
  // even when the closed one is more recently updated (so list() returns it
  // first). Otherwise startLane's dedup could resume/alias the wrong (closed) run.
  const proj2 = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt2-'));
  const store2 = new LaneCheckpointStore(proj2);
  store2.write({ ...fresh(), checkpointId: 'lane-active', lifecycle: 'in_progress', startRequestId: 'shared', updatedAt: '2026-01-01T00:00:00.000Z' });
  store2.write({ ...fresh(), checkpointId: 'lane-closed', lifecycle: 'closed', outcome: 'completed', startRequestId: 'shared', updatedAt: '2026-09-09T00:00:00.000Z' }); // more recent
  const found = store2.findByStartRequestId('shared');
  if (!found || found.checkpointId !== 'lane-active') throw new Error('findByStartRequestId must prefer the ACTIVE checkpoint over a more-recent closed one');
  // when only a closed match exists, it is returned (closed-restart still finds it)
  const store3 = new LaneCheckpointStore(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt3-')));
  store3.write({ ...fresh(), checkpointId: 'lane-only-closed', lifecycle: 'closed', outcome: 'stopped', startRequestId: 'solo' });
  if (store3.findByStartRequestId('solo')?.checkpointId !== 'lane-only-closed') throw new Error('a lone closed match must still be returned');
  console.log('lane-checkpoint-store: OK');
}
run();
