// sidecoach/src/__tests__/lane-runner-skip-prereq.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: async () => ({ status: 'clean', rules: [], findings: [],
      coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
        ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
        findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } }) };
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-skip-'));
  const d = deps(proj);
  // lane_build verb 'shape' owns flowA_brand_verify; later flowF_design_tokens
  // REQUIRES flowA (flow-prerequisites.ts). Skipping shape must be REJECTED.
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision, reason: 'skip shape' }, d); }
  catch (e: any) { threw = /depend|prerequisite|flowA|strand/i.test(String(e.message)); }
  if (!threw) throw new Error('skipping shape must be rejected (flowF requires flowA)');

  // skip requires a reason
  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('skip requires a reason');

  // A safe skip: complete shape+craft, then the LAST step (polish) has no
  // dependents, so skipping it is allowed and closes the lane 'partial'.
  let r = await advanceLane(proj, start.checkpointId, { action: 'complete', report: { stepId: 'shape', iteration: 0, reportId: 'r-shape', verb: 'shape', summary: 's', evidence: [{ kind: 'note', detail: 'x' }] }, expectedRevision: start.revision }, d);
  r = await advanceLane(proj, r.checkpointId, { action: 'complete', report: { stepId: 'craft', iteration: 0, reportId: 'r-craft', verb: 'craft', summary: 's', evidence: [{ kind: 'note', detail: 'x' }] }, expectedRevision: r.revision }, d);
  const skipped = await advanceLane(proj, r.checkpointId, { action: 'skip', expectedRevision: r.revision, reason: 'no polish needed' }, d);
  if (skipped.lifecycle !== 'closed' || skipped.outcome !== 'partial') throw new Error('skipping last step closes lane partial');
  console.log('lane-runner-skip-prereq: OK');
}
run();
