// sidecoach/src/__tests__/lane-execution-e2e.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';
import { StepReport } from '../lane-types';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-e2e-'));
  const engine = createExecutionEngine();
  const routed: any = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', { projectPath: proj, userId: 't' });
  if (!routed.lane) throw new Error('phrase did not start a lane through process()');
  let step = routed.lane;
  let guard = 0;
  while (step.lifecycle === 'in_progress' && guard++ < 50) {
    const verb = step.currentVerb;
    const rep: StepReport = { stepId: verb, iteration: step.iteration, reportId: `e2e:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] };
    step = await engine.advanceLane(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision });
  }
  if (step.lifecycle !== 'closed' || step.outcome !== 'completed') throw new Error(`routed sequence lane must finish completed (got ${step.lifecycle}/${step.outcome})`);
  console.log('lane-execution-e2e: OK');
}
run();
