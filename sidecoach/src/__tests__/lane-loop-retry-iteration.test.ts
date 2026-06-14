// P2a: an UNCLEAN retry must PRESERVE the pending iteration index (only a genuine
// continue advances it). After a stall, retry (still failing) then resume must run the
// SAME pending iteration, not skip one. Regression for decideProgress incrementing the
// persisted pending index on a non-converging retry.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function fail(ruleKey: string): ProductValidationResult {
  return { status: 'findings',
    rules: [{ ruleId: ruleKey, canonicalRuleKey: ruleKey, status: 'fail', severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
    findings: [{ validatorId: 'polish-standard', ruleId: ruleKey, canonicalRuleKey: ruleKey, severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 1, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 1, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] } };
}
function clean(): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: ['ok'], unverifiedScope: [] } };
}
function deps(proj: string, polishResult: () => ProductValidationResult): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: async (validatorId) => (validatorId === 'polish-standard' ? polishResult() : clean()) };
}
const rep = (verb: string, iteration: number): StepReport => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
async function onePass(proj: string, d: LaneRunnerDeps, cpId: string, rev: number, iter: number): Promise<any> {
  const a = await advanceLane(proj, cpId, { action: 'complete', report: rep('polish', iter), expectedRevision: rev }, d);
  const b = await advanceLane(proj, cpId, { action: 'complete', report: rep('audit', iter), expectedRevision: a.revision }, d);
  return advanceLane(proj, cpId, { action: 'complete', report: rep('critique', iter), expectedRevision: b.revision }, d);
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-retryiter-'));
  const d = deps(proj, () => fail('polish.no-transition-all'));   // same failing rule each pass -> stall
  const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-retryiter', d);
  let rev = s.revision, last: any;
  for (let i = 0; i < 3; i++) { last = await onePass(proj, d, s.checkpointId, rev, i); rev = last.revision; }
  if (last.convergence.outcome !== 'stalled') throw new Error('precondition: stalled, got ' + last.convergence.outcome);

  const pending = d.store.read(s.checkpointId).convergence!.iteration;   // the pending next index after the stall
  if (pending !== 3) throw new Error('precondition: pending index is 3 after a 3-pass stall, got ' + pending);

  // UNCLEAN retry (same failing validator): stays stalled and must NOT advance the
  // pending index (the retry re-ran the SAME boundary, it did not continue).
  const retried: any = await advanceLane(proj, s.checkpointId, { action: 'retry', expectedRevision: last.revision }, d);
  if (retried.convergence.outcome === 'converged') throw new Error('precondition: an unclean retry does not converge');
  const pendingAfter = d.store.read(s.checkpointId).convergence!.iteration;
  if (pendingAfter !== pending) throw new Error(`an unclean retry must preserve the pending iteration ${pending}, got ${pendingAfter}`);

  // Resume must begin that SAME preserved pending iteration, not the next.
  const resumed = await advanceLane(proj, s.checkpointId, { action: 'resume', expectedRevision: retried.revision }, d);
  if (resumed.currentVerb !== 'polish') throw new Error('resume serves polish, got ' + resumed.currentVerb);
  if (resumed.iteration !== pending) throw new Error(`resume must run the preserved pending iteration ${pending}, got ${resumed.iteration}`);

  console.log('lane-loop-retry-iteration: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
