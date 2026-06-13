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
