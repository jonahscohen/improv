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
