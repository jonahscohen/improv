// Combined Task 5: completing the FINAL loop step runs the lane policy validators ONCE, and
// all-clean closes the lane as converged with a truthful summary. Asserts the four
// required validators each ran exactly once, AT the boundary (no double-run). Plus two
// focused cases: advisory-flow error qualifies the display label, and a required
// validator throw is normalized to a typed error result (lease cleared, no converge).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';
import type { FlowExecutionResult } from '../flow-handler';

function clean(scope: string): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [scope], unverifiedScope: [] } };
}
const rep = (verb: string, iteration = 0): StepReport => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
const okFlow = (flowId: any): FlowExecutionResult => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] });

// --- base: all-clean boundary converges, validators run once each ---
async function baseConverge() {
  const calls: string[] = [];
  function deps(proj: string): LaneRunnerDeps {
    let n = 0, t = 0, op = 0;
    return { store: new LaneCheckpointStore(proj),
      runFlow: async (flowId) => okFlow(flowId),
      now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
      newOperationId: () => `op-${++op}`,
      runValidator: async (validatorId) => { calls.push(validatorId); return clean(`scope-${validatorId}`); } };
  }
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-conv-'));
  const d = deps(proj);
  const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-c', d); // polish
  const a = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision }, d); // audit
  if (calls.slice().length !== 0) throw new Error('no validators before the boundary; got ' + JSON.stringify(calls));
  const b = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision }, d);  // critique
  const c = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision }, d); // BOUNDARY

  if (c.lifecycle !== 'closed') throw new Error('converged closes the lane, got ' + c.lifecycle);
  if (c.outcome !== 'converged') throw new Error('outcome converged, got ' + c.outcome);
  if (!c.convergence || c.convergence.outcome !== 'converged') throw new Error('convergence.outcome converged');
  if (!c.convergence.summary || !/Converged \(machine-measured\)/.test(c.convergence.summary)) throw new Error('truthful summary present: ' + c.convergence?.summary);

  // The four required validators each ran EXACTLY once, at the boundary.
  const expected = ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'];
  if (JSON.stringify(calls.slice().sort()) !== JSON.stringify(expected.slice().sort())) throw new Error('required validators run once each: ' + JSON.stringify(calls));
  if (calls.length !== 4) throw new Error('exactly 4 validator runs (no double-run); got ' + calls.length);

  // Persisted + reproducible: a signature recorded; lane closed.
  const cp = d.store.read(s.checkpointId);
  if (cp.convergence!.signatures.length !== 1) throw new Error('one boundary signature persisted');
  if (cp.convergence!.history.length !== 1) throw new Error('one boundary history record persisted');
}

// --- focused 1: clean required + an advisory flow error -> converged but display-qualified ---
async function advisoryErrorQualifiesDisplay() {
  function deps(proj: string): LaneRunnerDeps {
    let n = 0, t = 0, op = 0;
    return { store: new LaneCheckpointStore(proj),
      // flowK (advisory, in the audit step) is unavailable this pass.
      runFlow: async (flowId) => (String(flowId) === 'flowK_multi_lens_audit'
        ? ({ flowId, flowName: String(flowId), status: 'error', message: 'audit framework unavailable', guidance: [], checklist: [] } as FlowExecutionResult)
        : okFlow(flowId)),
      now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
      newOperationId: () => `op-${++op}`,
      runValidator: async (validatorId) => clean(`scope-${validatorId}`) };
  }
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-adverr-'));
  const d = deps(proj);
  const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-adverr', d);
  const a = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision }, d);
  const b = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision }, d);
  const c = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision }, d);

  if (c.lifecycle !== 'closed' || c.outcome !== 'converged') throw new Error('clean required validators still converge despite an advisory error');
  if (d.store.read(s.checkpointId).convergence!.outcome !== 'converged') throw new Error('persisted convergence.outcome converged');
  if (c.convergence!.displayLabel !== 'machine_checks_clean_with_advisory_warnings') throw new Error('advisory error qualifies the display label, got ' + c.convergence!.displayLabel);
  if (!c.convergence!.summary || !/flowK_multi_lens_audit/.test(c.convergence!.summary)) throw new Error('summary names the unavailable advisory flow: ' + c.convergence!.summary);
}

// --- focused 2: a required validator THROW is normalized to a typed error state ---
async function requiredValidatorThrowNormalized() {
  function deps(proj: string): LaneRunnerDeps {
    let n = 0, t = 0, op = 0;
    return { store: new LaneCheckpointStore(proj),
      runFlow: async (flowId) => okFlow(flowId),
      now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
      newOperationId: () => `op-${++op}`,
      runValidator: async (validatorId) => { if (validatorId === 'polish-standard') throw new Error('boom'); return clean(`scope-${validatorId}`); } };
  }
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-vthrow-'));
  const d = deps(proj);
  const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-vthrow', d);
  const a = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision }, d);
  const b = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision }, d);
  const c = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision }, d);

  if (c.outcome === 'converged') throw new Error('a required validator throw cannot converge');
  if (!c.convergence || c.convergence.outcome !== 'running') throw new Error('errored iteration stays resumable (running), got ' + c.convergence?.outcome);
  const cp = d.store.read(s.checkpointId);
  if (cp.convergence!.history.length !== 1) throw new Error('one errored iteration persisted');
  const ps = cp.convergence!.history[0].perValidator.find((p) => p.validatorId === 'polish-standard');
  if (!ps || ps.status !== 'error' || ps.validatorErrorCategory !== 'validator_exception') throw new Error('required validator throw -> typed error state with category validator_exception: ' + JSON.stringify(ps));
  if (!cp.convergence!.validatorErrors.some((e) => e.validatorId === 'polish-standard' && e.category === 'validator_exception')) throw new Error('validatorErrors records the throw');
  if (cp.lease !== null) throw new Error('the boundary lease must be cleared after a validator throw');
}

async function run() {
  await baseConverge();
  await advisoryErrorQualifiesDisplay();
  await requiredValidatorThrowNormalized();
  console.log('lane-loop-boundary-converge: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
