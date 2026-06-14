// sidecoach/src/__tests__/lane-runner-start.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0;
  return {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [`g:${flowId}`], checklist: [{ id: 'c0', label: `chk ${flowId}`, required: true, completed: false }] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++n}`,
  };
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-start-'));
  const d = deps(proj);
  const res = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  if (res.lifecycle !== 'in_progress') throw new Error('starts in_progress');
  if (res.currentVerb !== 'shape') throw new Error('first verb is shape');
  if (!res.guidance.some((g) => g.includes('Discovery interview'))) throw new Error('verb coaching guidance missing');
  if (!res.guidance.some((g) => g.includes('g:flowA_brand_verify'))) throw new Error('flow handler guidance missing');

  // idempotent retry returns the SAME checkpoint, no second lane
  const res2 = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  if (res2.checkpointId !== res.checkpointId) throw new Error('retry must return same checkpoint');
  if (d.store.list().length !== 1) throw new Error('retry must not create a second lane');

  // retry that supplies a DIFFERENT lane for the same requestId is rejected
  let threw = false;
  try { await startLane('lane_ship', 'hero', { projectPath: proj }, 'req-1', d); } catch { threw = true; }
  if (!threw) throw new Error('startRequestId reuse with a different lane must reject');

  // P4c: a loop lane (lane_converge) now STARTS (the P2 rejection was removed in
  // favor of the convergence release floor). It begins at the first verb (polish)
  // with executionKind 'loop' and a seeded convergence sub-state.
  const loop = await startLane('lane_converge', 't', { projectPath: proj }, 'req-2', d);
  if (loop.executionKind !== 'loop') throw new Error('lane_converge runs as a loop');
  if (loop.currentVerb !== 'polish') throw new Error('loop lane starts at polish');
  if (loop.lifecycle !== 'in_progress') throw new Error('loop lane starts in_progress');
  if (!d.store.read(loop.checkpointId).convergence) throw new Error('loop lane seeds convergence sub-state');

  // unknown lane errors
  threw = false;
  try { await startLane('lane_nope', 't', { projectPath: proj }, 'req-3', d); } catch { threw = true; }
  if (!threw) throw new Error('unknown laneId must throw');
  console.log('lane-runner-start: OK');
}
run();
