// sidecoach/src/__tests__/lane-runner-concurrency.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, finalizeLease, leaseIsLive } from '../lane-checkpoint-store';
import { withCheckpointLock } from '../lane-lock';
import { startLane, advanceLane, laneStatus, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function okResult(): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}
function deps(proj: string, validator?: (id: string) => Promise<ProductValidationResult>): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId: any) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); },
    newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: validator ?? (async () => okResult()),
  } as any;
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 's', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-conc-')));

  // (1) clean gate: shape step (binds NO validator) advances; craft step (binds
  //     polish-standard) advances when the validator returns clean.
  {
    const d = deps(proj);
    const s = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-clean', d);
    const r1 = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s.revision }, d);
    if (r1.currentVerb !== 'craft') throw new Error('clean gate advances to craft');
  }

  // (2) findings gate: craft validator returns findings -> step STAYS current, validation_failed.
  {
    const d = deps(proj, async () => ({ ...okResult(), status: 'findings',
      findings: [{ validatorId: 'polish-standard', ruleId: 'r', canonicalRuleKey: 'k', severity: 'major', findingClass: 'polish', evidenceLocations: [], message: 'bad' }] } as ProductValidationResult));
    const s = await startLane('lane_build', 'hero2', { projectPath: proj }, 'req-find', d);
    await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: s.revision }, d);
    const cur = d.store.read(s.checkpointId);
    const g = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: cur.revision }, d);
    if (g.currentVerb !== 'craft') throw new Error('findings gate keeps step current');
    if (g.gate?.status !== 'findings' || (g.gate?.findings.length ?? 0) < 1) throw new Error('findings returned on the result');
    const after = d.store.read(s.checkpointId);
    if (after.completedStepIds.includes('craft')) throw new Error('findings must NOT commit the step');
    if (after.lease !== null) throw new Error('lease released after an unclean gate');

    // re-sending the SAME report is a no-op; a DIFFERENT report re-runs the gate.
    const reReadBefore = d.store.read(s.checkpointId).revision;
    const dupe = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: reReadBefore }, d);
    if (dupe.currentVerb !== 'craft') throw new Error('same unclean report re-send must be a no-op (still craft)');
    const g2 = await advanceLane(proj, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: 'r:craft:retry' }, expectedRevision: d.store.read(s.checkpointId).revision }, d);
    if (g2.gate?.status !== 'findings') throw new Error('a new report for the same step re-runs the gate');
  }

  // (3) the core guarantee: two concurrent completes of the same step -> exactly one commits.
  {
    const d = deps(proj);
    const start = await startLane('lane_build', 'hero3', { projectPath: proj }, 'req-conc', d);
    let arrived = 0; let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const barrier = async () => { if (++arrived >= 2) release(); await gate; };
    const d2 = { ...d, __claimBarrier: barrier } as any;     // advanceLane awaits this AFTER the early read, BEFORE claimLease
    const both = await Promise.allSettled([
      advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: start.revision }, d2),
      advanceLane(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), reportId: 'r:shape2' }, expectedRevision: start.revision }, d2),
    ]);
    if (both.filter((r) => r.status === 'fulfilled').length !== 1) throw new Error(`exactly one concurrent advance must commit, got ${both.filter((r) => r.status === 'fulfilled').length}`);
    const cp = d.store.read(start.checkpointId);
    if (cp.completedStepIds.filter((x) => x === 'shape').length !== 1) throw new Error('shape committed at most once');
    if (cp.lease !== null) throw new Error('lease cleared after commit');
  }

  // (4) every non-clean mapping persists and remains visible on a later status read.
  for (const [gateStatus, stepStatus] of [
    ['findings', 'validation_failed'],
    ['inconclusive', 'validation_inconclusive'],
    ['error', 'validation_error'],
  ] as const) {
    const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `lane-status-${gateStatus}-`)));
    const d = deps(p, async () => ({ ...okResult(), status: gateStatus } as ProductValidationResult));
    const s = await startLane('lane_build', gateStatus, { projectPath: p }, `req-${gateStatus}`, d);
    await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
    await advanceLane(p, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: `r:${gateStatus}` }, expectedRevision: d.store.read(s.checkpointId).revision }, d);
    const later = await laneStatus(p, s.checkpointId, d);
    const craft = later.steps.find((x) => x.verb === 'craft');
    if (craft?.status !== stepStatus) throw new Error(`${gateStatus} must persist as ${stepStatus}; got ${craft?.status}`);
  }

  // serve-step clobber guard: a stale serve persistence must merge under the lock
  // (re-read + set only servedSteps[key]) without reverting a committed transition.
  {
    const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-serve-clobber-')));
    let atPersist!: () => void; const persistReached = new Promise<void>((r) => { atPersist = r; });
    let releasePersist!: () => void; const holdPersist = new Promise<void>((r) => { releasePersist = r; });
    let pauses = 0;
    const d1 = { ...deps(p), __beforeServePersist: async () => {
      if (++pauses === 2) { atPersist(); await holdPersist; } // first pause was start's shape serve; pause craft serve
    } } as LaneRunnerDeps;
    const s = await startLane('lane_build', 'clobber', { projectPath: p }, 'req-clobber', d1);
    const completingShape = advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d1.store.read(s.checkpointId).revision }, d1);
    await persistReached;
    const d2 = deps(p);
    const beforeSkip = d2.store.read(s.checkpointId);
    await advanceLane(p, s.checkpointId, { action: 'skip', reason: 'test interleave', expectedRevision: beforeSkip.revision }, d2);
    releasePersist(); await completingShape;
    const after = d2.store.read(s.checkpointId);
    if (!after.completedStepIds.includes('shape') || !after.skippedStepIds.includes('craft')) throw new Error('stale serve persistence clobbered committed transition');
    if (!after.servedSteps['1:0']) throw new Error('serve persistence must merge its own entry');
  }

  console.log('lane-runner-concurrency: OK');
}
run();
