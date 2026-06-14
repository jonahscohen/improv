// sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

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
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-adv-'));
  const d = deps(proj);
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d); // shape, craft, polish

  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', expectedRevision: start.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('complete without report rejects');

  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 99 }, d); } catch { threw = true; }
  if (!threw) throw new Error('stale revision rejects');

  threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), evidence: [] }, expectedRevision: start.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('report with no evidence rejects');

  const r1 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: start.revision }, d);
  if (r1.currentVerb !== 'craft') throw new Error('advance to craft');
  if (r1.revision <= start.revision) throw new Error('revision must advance after a committed complete');

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

  // P1-3: a PARTIALLY-served step must NOT be completable. A mid-serve
  // interruption can leave servedSteps[key].flowIds covering only some of
  // step.flowIds; completing then would attest the step while skipping the
  // unserved flows. Simulate a truncated served cache and assert complete rejects.
  const p = await startLane('lane_build', 'heroP', { projectPath: proj }, 'req-P', d); // shape
  const pc = await advanceLane(proj, p.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: p.revision }, d); // craft (multi-flow, fully served)
  const cpRaw = d.store.read(p.checkpointId);
  const key = `${cpRaw.cursor}:${cpRaw.iteration}`;
  if ((cpRaw.servedSteps[key]?.flowIds.length ?? 0) < 2) throw new Error('test setup: craft step must have >=2 flows to truncate');
  cpRaw.servedSteps[key].flowIds = cpRaw.servedSteps[key].flowIds.slice(0, 1); // simulate mid-serve interruption
  d.store.write(cpRaw);
  threw = false;
  try { await advanceLane(proj, p.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: pc.revision }, d); } catch (e: any) { threw = /partial|served/i.test(String(e.message)); }
  if (!threw) throw new Error('completing a partially-served step must be rejected');
  console.log('lane-runner-advance-sequence: OK');
}
run();
