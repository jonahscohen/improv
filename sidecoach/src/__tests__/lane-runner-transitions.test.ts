// sidecoach/src/__tests__/lane-runner-transitions.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, laneStatus, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, calls = 0;
  const d: any = { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId: any) => { calls++; return { flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [`g:${flowId}`], checklist: [] }; },
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
  d.calls = () => calls;
  return d;
}
async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-trans-'));
  const d = deps(proj) as any;
  const start = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
  const callsAfterStart = d.calls();

  // retry re-serves the SAME step from cache (no handler re-run), report optional but recorded
  const rt = await advanceLane(proj, start.checkpointId, { action: 'retry', expectedRevision: start.revision, reason: 'redo' }, d);
  if (rt.currentVerb !== 'shape') throw new Error('retry stays on shape');
  if (d.calls() !== callsAfterStart) throw new Error('retry must NOT re-run handlers (served cache)');

  // interrupt -> interrupted, no handler re-run, returns paused state
  const ir = await advanceLane(proj, start.checkpointId, { action: 'interrupt', expectedRevision: rt.revision }, d);
  if (ir.lifecycle !== 'interrupted' || ir.currentVerb !== undefined) throw new Error('interrupt -> interrupted/paused');
  if (d.calls() !== callsAfterStart) throw new Error('interrupt must not re-run handlers');

  // any non-resume action while interrupted is rejected
  let threw = false;
  try { await advanceLane(proj, start.checkpointId, { action: 'retry', expectedRevision: ir.revision }, d); } catch { threw = true; }
  if (!threw) throw new Error('only resume valid while interrupted');

  // resume -> in_progress, re-serves shape from cache
  const rr = await advanceLane(proj, start.checkpointId, { action: 'resume', expectedRevision: ir.revision }, d);
  if (rr.lifecycle !== 'in_progress' || rr.currentVerb !== 'shape') throw new Error('resume -> in_progress on shape');
  if (d.calls() !== callsAfterStart) throw new Error('resume must not re-run handlers');

  // stop -> closed/stopped, audited
  const st = await advanceLane(proj, start.checkpointId, { action: 'stop', expectedRevision: rr.revision, reason: 'parking it' }, d);
  if (st.lifecycle !== 'closed' || st.outcome !== 'stopped') throw new Error('stop -> closed/stopped');
  const state = laneStatus(proj, start.checkpointId, d);
  if (!state.audit.some((a) => a.action === 'stop' && a.reason === 'parking it')) throw new Error('stop must be audited with reason');

  // P1-2: an INTERRUPTED lane + a DUPLICATE reportId + a non-resume action must
  // REJECT (resume-only), not silently no-op via the dedup short-circuit. (Same
  // bug class as dup-on-closed; the dedup short-circuit must fire only on an
  // in_progress lane.)
  const rep = (verb: string) => ({ stepId: verb, iteration: 0, reportId: `r2:${verb}`, verb, summary: 's', evidence: [{ kind: 'note' as const, detail: 'x' }] });
  const l2 = await startLane('lane_build', 'hero2', { projectPath: proj }, 'req-2', d);
  const c2 = await advanceLane(proj, l2.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: l2.revision }, d); // craft; r2:shape now seen
  const i2 = await advanceLane(proj, l2.checkpointId, { action: 'interrupt', expectedRevision: c2.revision }, d);                      // interrupted
  let threw2 = false;
  try { await advanceLane(proj, l2.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: i2.revision }, d); } catch { threw2 = true; }
  if (!threw2) throw new Error('interrupted lane + duplicate reportId + complete must reject (resume-only), not no-op');

  console.log('lane-runner-transitions: OK');
}
run();
