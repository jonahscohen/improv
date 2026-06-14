// Task 9: real orchestrator end-to-end on a TEMP COPY. This must pass through
// orchestrator preflight and must not write checkpoint artifacts under the tracked fixture.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { StepReport } from '../lane-types';
import { getLanePolicy } from '../flow-validation-capabilities';
import { runValidatorForTest } from '../validators/run-validator';

const FIXTURE = path.join(__dirname, 'fixtures', 'convergence', 'clean');
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  // Gate 1: each required validator must be clean on the fixture (actionable if not).
  for (const vId of getLanePolicy('lane_converge')!.requiredProductValidatorIds) {
    const detail = await runValidatorForTest(vId, { projectPath: FIXTURE });
    if (detail.result.status !== 'clean') {
      const failing = detail.result.rules.filter((r) => r.status !== 'pass' && r.status !== 'not_applicable')
        .map((r) => `${r.canonicalRuleKey}:${r.status}`);
      throw new Error(`fixture is not clean for ${vId} (status ${detail.result.status}); adjust the fixture for: ${failing.join(', ')}`);
    }
  }

  // Gate 2: copy the fixture, then drive through the REAL orchestrator so
  // convergencePreflight cannot be bypassed and tracked fixtures stay untouched.
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-e2e-'));
  const project = path.join(tempRoot, 'project');
  fs.cpSync(FIXTURE, project, { recursive: true });
  const engine = new FlowExecutionEngine();
  const s = await engine.startLane('lane_converge', 'project', { projectPath: project }, 'e2e-' + Date.now());
  const a = await engine.advanceLane(project, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision });
  const b = await engine.advanceLane(project, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision });
  const c = await engine.advanceLane(project, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision });
  if (c.outcome !== 'converged') throw new Error('expected converged end-to-end, got ' + c.outcome + ' / ' + JSON.stringify(c.convergence));
  if (!c.convergence?.summary) throw new Error('converged result must carry a truthful summary');
  if (fs.existsSync(path.join(FIXTURE, '.claude'))) throw new Error('tracked fixture must not receive checkpoint artifacts');

  console.log('lane-converge-e2e: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
