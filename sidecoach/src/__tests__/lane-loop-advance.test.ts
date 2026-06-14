// Task 5: completing a NON-final loop verb step is advisory - cursor advances within
// the iteration and NO product validator runs (no per-step gate in a loop lane).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

let validatorCalls = 0;
function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: async () => { validatorCalls++; throw new Error('no validator on a non-final loop step'); } };
}
const rep = (verb: string, iteration = 0): StepReport => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-adv-'));
  const d = deps(proj);
  const start = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-adv', d); // polish
  if (start.currentVerb !== 'polish') throw new Error('start at polish');

  // complete polish (non-final) -> advisory advance to audit, iteration stays 0, NO validator.
  const r1 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: start.revision }, d);
  if (r1.currentVerb !== 'audit') throw new Error('advance to audit, got ' + r1.currentVerb);
  if (r1.iteration !== 0) throw new Error('iteration stays 0 within the pass');
  if (r1.lifecycle !== 'in_progress') throw new Error('still in_progress');

  // complete audit (non-final) -> advance to critique (the final/boundary step).
  const r2 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: r1.revision }, d);
  if (r2.currentVerb !== 'critique') throw new Error('advance to critique, got ' + r2.currentVerb);

  if (validatorCalls !== 0) throw new Error('NO product validator may run on non-final loop steps; got ' + validatorCalls);

  const cp = d.store.read(start.checkpointId);
  if (cp.cursor !== 2) throw new Error('cursor at the final step (2)');
  if (cp.iteration !== 0) throw new Error('iteration still 0 before the boundary');
  if (!cp.convergence || cp.convergence.advisoryRuns.length < 2) throw new Error('advisory served flows recorded per non-final step');

  console.log('lane-loop-advance: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
