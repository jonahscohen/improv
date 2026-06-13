// sidecoach/src/__tests__/lane-runner-status-list.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, laneStatus, listLanes, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-stat-'));
  const d = deps(proj);
  const a = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-a', d);
  const b = await startLane('lane_ship', 'site', { projectPath: proj }, 'req-b', d);
  await advanceLane(proj, b.checkpointId, { action: 'stop', expectedRevision: b.revision, reason: 'x' }, d); // close b

  const st = laneStatus(proj, a.checkpointId, d);
  if (st.laneId !== 'lane_build' || st.lifecycle !== 'in_progress') throw new Error('status wrong');
  if (st.totalSteps !== 3 || st.currentVerb !== 'shape') throw new Error('status step info wrong');

  // default: only active (in_progress/interrupted) lanes
  const active = listLanes(proj, d);
  if (active.length !== 1 || active[0].checkpointId !== a.checkpointId) throw new Error('default listLanes shows only active');
  // all: includes the closed one
  const all = listLanes(proj, d, { all: true });
  if (all.length !== 2) throw new Error('listLanes({all:true}) includes closed');
  console.log('lane-runner-status-list: OK');
}
run();
