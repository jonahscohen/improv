// Task 4: lane_converge starts (no longer rejected); convergence sub-state seeded.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    // never called at start (no boundary yet); throws if a step gate wrongly runs it.
    runValidator: async () => { throw new Error('runValidator must NOT run at lane start'); } };
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-start-'));
  const d = deps(proj);
  const start = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-loop', d);
  if (start.currentVerb !== 'polish') throw new Error('first loop step is polish, got ' + start.currentVerb);
  if (start.executionKind !== 'loop') throw new Error('executionKind loop');
  if (start.iteration !== 0) throw new Error('iteration 0 at start');
  if (start.lifecycle !== 'in_progress') throw new Error('in_progress at start');

  const cp = d.store.read(start.checkpointId);
  if (!cp.convergence) throw new Error('convergence sub-state must be seeded for a loop lane');
  if (cp.convergence.outcome !== 'running') throw new Error('seeded outcome running');
  if (cp.convergence.limits.maxNoProgress !== 3 || cp.convergence.limits.maxIterations !== 10) throw new Error('seeded default limits');

  // A loop lane whose policy is unknown would reject - sanity-check the happy path only here.
  console.log('lane-loop-start: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
