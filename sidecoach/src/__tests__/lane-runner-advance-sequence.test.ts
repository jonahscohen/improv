// sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-adv-'));
  const d = deps(proj);
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d); // shape, craft, polish

  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', expectedRevision: 0 }, d); } catch { threw = true; }
  if (!threw) throw new Error('complete without report rejects');

  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 99 }, d); } catch { threw = true; }
  if (!threw) throw new Error('stale revision rejects');

  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), evidence: [] }, expectedRevision: 0 }, d); } catch { threw = true; }
  if (!threw) throw new Error('report with no evidence rejects');

  const r1 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 0 }, d);
  if (r1.currentVerb !== 'craft') throw new Error('advance to craft');
  if (r1.revision !== 1) throw new Error('revision bumps to 1');

  // duplicate reportId is a no-op (still craft) regardless of revision
  const dup = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 1 }, d);
  if (dup.currentVerb !== 'craft') throw new Error('duplicate reportId is no-op');

  // wrong stepId rejected
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: dup.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('mismatched stepId rejects');

  const r2 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dup.revision }, d);
  const r3 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: r2.revision }, d);
  if (r3.lifecycle !== 'closed' || r3.outcome !== 'completed') throw new Error('sequence with no skips closes completed');
  if (r3.currentVerb !== undefined) throw new Error('closed lane has no currentVerb');

  // advancing a closed lane rejects
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: r3.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('advancing a closed lane rejects');
  console.log('lane-runner-advance-sequence: OK');
}
run();
