// sidecoach/src/__tests__/lane-runner-concurrency.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, finalizeLease, leaseIsLive } from '../lane-checkpoint-store';
import { withCheckpointLock } from '../lane-lock';
import { startLane, advanceLane, laneStatus, LaneRunnerDeps } from '../lane-runner';
import { LaneSideEffectSink } from '../lane-side-effect-sink';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function okResult(): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}
function deps(proj: string, validator?: (id: string, ctx?: any, signal?: AbortSignal) => Promise<ProductValidationResult>): LaneRunnerDeps {
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

  // abort-fence: one slow validator runs longer than staleMs (the heartbeat LOOP keeps
  // it live); a second store handle atomically fences the lease DURING that validator,
  // proving ownership loss aborts it without waiting for a validator boundary.
  {
    const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-abort-')));
    let enteredValidator!: () => void;
    const entered = new Promise<void>((r) => { enteredValidator = r; });
    let releaseValidator!: () => void;
    const held = new Promise<void>((r) => { releaseValidator = r; });
    let sawAbort = false;
    const d = deps(proj, async (_id, _ctx, signal) => {
      signal?.addEventListener('abort', () => { sawAbort = true; });
      enteredValidator();
      await held;
      return okResult();
    });
    d.now = () => new Date(Date.now()).toISOString();
    // Margins (heartbeat << stale << wait) sized so proper-lockfile's real lock-acquire
    // latency on each heartbeat cannot let the lease lapse; relationship is unchanged.
    d.staleMs = 150; d.heartbeatIntervalMs = 15;
    const s = await startLane('lane_build', 'hero', { projectPath: proj }, 'req-abort', d);
    await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
    const inflight = advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: d.store.read(s.checkpointId).revision }, d);
    await entered;
    await new Promise((r) => setTimeout(r, 250));    // greater than staleMs; loop must keep lease live
    const independent = new LaneCheckpointStore(proj);
    const live = independent.read(s.checkpointId);
    if (!leaseIsLive(live.lease, Date.now(), 150)) throw new Error('one slow validator must stay live via heartbeat loop');
    await withCheckpointLock(independent.dir(), s.checkpointId, () => {
      const cp = independent.read(s.checkpointId);
      cp.fencingCounter += 1; cp.lease = null; cp.revision += 1; independent.write(cp);
    });
    for (let i = 0; i < 50 && !sawAbort; i++) await new Promise((r) => setTimeout(r, 2));
    if (!sawAbort) throw new Error('independent-store ownership loss during one validator must abort signal');
    releaseValidator();
    await inflight.then(() => { throw new Error('fenced operation must reject FINALIZE'); }, () => {});
    if (d.store.read(s.checkpointId).completedStepIds.includes('craft')) throw new Error('fenced operation must NOT commit');
    console.log('lane-runner-concurrency abort-fence: OK');
  }

  // priority interrupt/stop fence a live lease; retry/resume reject live + fence stale.
  {
    const d = deps(proj);
    const s = await startLane('lane_build', 'x', { projectPath: proj }, 'req-int', d);
    const cp0 = d.store.read(s.checkpointId);
    cp0.lease = { operationId: 'stuck', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp0.revision, fencingToken: cp0.fencingCounter, startedAt: d.now(), heartbeatAt: d.now() };
    d.store.write(cp0);
    const rev = d.store.read(s.checkpointId).revision;
    const ir = await advanceLane(proj, s.checkpointId, { action: 'interrupt', expectedRevision: rev }, d);
    if (ir.lifecycle !== 'interrupted') throw new Error('interrupt sets interrupted even over a live lease');
    const after = d.store.read(s.checkpointId);
    if (after.lease !== null) throw new Error('interrupt clears the fenced lease');
    if (after.fencingCounter <= cp0.fencingCounter) throw new Error('interrupt bumps the fencing token');
    // retry over a re-seeded LIVE lease is rejected.
    const cp1 = d.store.read(s.checkpointId);
    cp1.lifecycle = 'in_progress';
    cp1.lease = { operationId: 'live', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp1.revision, fencingToken: cp1.fencingCounter, startedAt: d.now(), heartbeatAt: d.now() };
    d.store.write(cp1);
    let rejected = false;
    try { await advanceLane(proj, s.checkpointId, { action: 'retry', expectedRevision: d.store.read(s.checkpointId).revision }, d); } catch { rejected = true; }
    if (!rejected) throw new Error('retry over a live lease must be rejected');

    // retry over a STALE lease fences/clears it under the same lock before mutation.
    const stale = d.store.read(s.checkpointId);
    stale.lease = { ...stale.lease!, operationId: 'stale-retry', claimedCheckpointRevision: stale.revision,
      fencingToken: stale.fencingCounter, heartbeatAt: new Date(-86_400_000).toISOString() };
    const staleRetryIdentity = stale.lease!;
    d.store.write(stale);
    await advanceLane(proj, s.checkpointId, { action: 'retry', expectedRevision: stale.revision }, d);
    const afterRetry = d.store.read(s.checkpointId);
    if (afterRetry.lease !== null || afterRetry.fencingCounter <= stale.fencingCounter) throw new Error('retry must fence/clear stale lease before mutation');
    await finalizeLease(d.store, s.checkpointId, staleRetryIdentity, () => {}).then(
      () => { throw new Error('stale retry owner must not FINALIZE'); }, () => {});

    const interrupted = d.store.read(s.checkpointId);
    interrupted.lifecycle = 'interrupted';
    interrupted.lease = { operationId: 'stale-resume', stepId: 'shape', iteration: 0,
      claimedCheckpointRevision: interrupted.revision, fencingToken: interrupted.fencingCounter,
      startedAt: new Date(-86_400_000).toISOString(), heartbeatAt: new Date(-86_400_000).toISOString() };
    const staleResumeIdentity = interrupted.lease!;
    d.store.write(interrupted);
    await advanceLane(proj, s.checkpointId, { action: 'resume', expectedRevision: interrupted.revision }, d);
    const afterResume = d.store.read(s.checkpointId);
    if (afterResume.lease !== null || afterResume.fencingCounter <= interrupted.fencingCounter || afterResume.lifecycle !== 'in_progress') throw new Error('resume must fence stale lease before mutation');
    await finalizeLease(d.store, s.checkpointId, staleResumeIdentity, () => {}).then(
      () => { throw new Error('stale resume owner must not FINALIZE'); }, () => {});
    console.log('lane-runner-concurrency interrupt-fence: OK');
  }

  // same-process ABA: A stale-reclaimed by B; A's finally must not delete B's controller,
  // and interrupt must abort B's controller via the FULL-identity registry key.
  {
    const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-live-aba-')));
    let nowMs = 1_000, releaseA!: () => void, releaseB!: () => void, enterA!: () => void, enterB!: () => void;
    const holdA = new Promise<void>((r) => { releaseA = r; });
    const holdB = new Promise<void>((r) => { releaseB = r; });
    const aEntered = new Promise<void>((r) => { enterA = r; });
    const bEntered = new Promise<void>((r) => { enterB = r; });
    let calls = 0, bAborted = false;
    const base = deps(p);
    const validator = async (_id: string, _ctx: unknown, signal?: AbortSignal) => {
      if (++calls === 1) { enterA(); await holdA; return okResult(); }
      signal?.addEventListener('abort', () => { bAborted = true; }); enterB(); await holdB; return okResult();
    };
    const dA = { ...base, now: () => new Date(nowMs).toISOString(), staleMs: 10, heartbeatIntervalMs: 1_000_000, runValidator: validator } as LaneRunnerDeps;
    const s = await startLane('lane_build', 'aba', { projectPath: p }, 'req-aba', dA);
    await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
    const a = advanceLane(p, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
    await aEntered; nowMs += 100;
    const dB = { ...dA, heartbeatIntervalMs: 5 } as LaneRunnerDeps;
    const b = advanceLane(p, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: 'r:craft:b' }, expectedRevision: dB.store.read(s.checkpointId).revision }, dB);
    await bEntered;
    releaseA(); await a.then(() => { throw new Error('A must reject after B reclaim'); }, () => {});
    await advanceLane(p, s.checkpointId, { action: 'interrupt', expectedRevision: dB.store.read(s.checkpointId).revision }, dB);
    if (!bAborted) throw new Error('interrupt must abort replacement after stale same-process reclaim');
    releaseB(); await b.then(() => { throw new Error('interrupted B must reject FINALIZE'); }, () => {});
    console.log('lane-runner-concurrency live-aba: OK');
  }

  // crash-mid-advance reclaim: seed the exact persisted artifact a crashed process
  // leaves (a stale lease), then a fresh advance reclaims it and commits exactly once.
  {
    const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-crash-reclaim-')));
    const d = deps(p);
    const s = await startLane('lane_build', 'crash', { projectPath: p }, 'req-crash-reclaim', d);
    const cp = d.store.read(s.checkpointId);
    cp.lease = { operationId: 'crashed-op', stepId: 'shape', iteration: 0, claimedCheckpointRevision: cp.revision,
      fencingToken: cp.fencingCounter, startedAt: new Date(0).toISOString(), heartbeatAt: new Date(0).toISOString() };
    d.store.write(cp);
    const r = await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: cp.revision }, { ...d, staleMs: 1 });
    const after = d.store.read(s.checkpointId);
    if (r.currentVerb !== 'craft' || after.completedStepIds.filter((x) => x === 'shape').length !== 1) throw new Error('stale crash lease must be reclaimed and commit once');
    if (after.fencingCounter <= cp.fencingCounter || after.lease !== null) throw new Error('reclaim must bump fencing and clear replacement lease on finalize');
    console.log('lane-runner-concurrency crash-reclaim: OK');
  }

  // timeout-retry overlap: A's lease goes stale (injected clock), B reclaims + commits
  // craft exactly once, superseded A rejects FINALIZE, exactly one authoritative sink entry.
  {
    const p = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-timeout-retry-')));
    let nowMs = 1_000; let enteredA!: () => void; const aEntered = new Promise<void>((r) => { enteredA = r; });
    let releaseA!: () => void; const holdA = new Promise<void>((r) => { releaseA = r; });
    const base = deps(p);
    const dA = { ...base, now: () => new Date(nowMs).toISOString(), staleMs: 10, heartbeatIntervalMs: 1_000_000,
      runValidator: async () => { enteredA(); await holdA; return okResult(); } } as LaneRunnerDeps;
    const s = await startLane('lane_build', 'overlap', { projectPath: p }, 'req-overlap', dA);
    await advanceLane(p, s.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
    const a = advanceLane(p, s.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dA.store.read(s.checkpointId).revision }, dA);
    await aEntered;
    nowMs += 100;
    const dB = { ...base, now: () => new Date(nowMs).toISOString(), staleMs: 10, runValidator: async () => okResult() } as LaneRunnerDeps;
    await advanceLane(p, s.checkpointId, { action: 'complete', report: { ...rep('craft'), reportId: 'r:craft:b' }, expectedRevision: dB.store.read(s.checkpointId).revision }, dB);
    releaseA();
    await a.then(() => { throw new Error('superseded A must reject FINALIZE'); }, () => {});
    const after = dB.store.read(s.checkpointId);
    if (after.completedStepIds.filter((x) => x === 'craft').length !== 1) throw new Error('timeout retry must commit craft exactly once');
    const sink = new LaneSideEffectSink(p);
    if (!sink.get(`${s.checkpointId}:craft:0`)) throw new Error('replacement commit must publish one authoritative logical entry');
    console.log('lane-runner-concurrency timeout-retry: OK');
  }

  console.log('lane-runner-concurrency: OK');
}
run();
