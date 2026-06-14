// sidecoach/src/__tests__/lane-execution-e2e.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';
import { StepReport } from '../lane-types';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { advanceLane, LaneRunnerDeps } from '../lane-runner';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-e2e-'));
  const engine = createExecutionEngine();
  const routed: any = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', { projectPath: proj, userId: 't' });
  if (!routed.lane) throw new Error('phrase did not start a lane through process()');
  // The engine ROUTES + starts the lane (process()). Drive the routed checkpoint with
  // a clean-validator stub deps: this e2e asserts process() routing + lane completion
  // under a clean gate; the real validator wiring (production laneDeps) lands in Task 10
  // (covered by lane-engine-methods, whose validators gate inconclusive on an empty proj).
  const drive: LaneRunnerDeps = {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => new Date().toISOString(),
    newCheckpointId: () => 'lane-e2e',
    newOperationId: () => `op-${Math.random().toString(36).slice(2)}`,
    runValidator: async () => ({ status: 'clean', rules: [], findings: [],
      coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
        ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
        findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } }),
  };
  let step = routed.lane;
  let guard = 0;
  while (step.lifecycle === 'in_progress' && guard++ < 50) {
    const verb = step.currentVerb;
    const rep: StepReport = { stepId: verb, iteration: step.iteration, reportId: `e2e:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] };
    step = await advanceLane(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision }, drive);
  }
  if (step.lifecycle !== 'closed' || step.outcome !== 'completed') throw new Error(`routed sequence lane must finish completed (got ${step.lifecycle}/${step.outcome})`);
  console.log('lane-execution-e2e: OK');
}
run();
