// sidecoach/src/lane-runner.ts
// Sequence-lane execution state machine (P2). Loop lanes are rejected here and
// handled in P4 with the convergence floor.
import { createHash } from 'crypto';
import type { FlowId } from './types';
import type { FlowExecutionResult } from './flow-handler';
import { LANES, GeneratedLane } from './lanes.generated';
import { LaneCheckpoint, LaneCheckpointStore, finalizeLease } from './lane-checkpoint-store';
import type { LeaseIdentity } from './lane-checkpoint-store';
import { LaneStepResult, LaneState, LaneInfo, LaneTransition, LaneAuditEntry, isClosed } from './lane-types';
import { FlowPrerequisiteValidator } from './flow-prerequisites';
import { withCheckpointLock } from './lane-lock';

export interface LaneRunnerDeps {
  store: LaneCheckpointStore;
  runFlow: (flowId: FlowId, context: any) => Promise<FlowExecutionResult>;
  now: () => string;
  newCheckpointId: () => string;
  // P4b-1: operation-id minting for the lease protocol. Optional with a production
  // -safe default so existing call sites keep compiling; production laneDeps wires
  // an explicit generator in Task 10.
  newOperationId?: () => string;
}

// Default operation id when deps omits newOperationId (production wiring is Task 10).
function defaultOperationId(): string {
  return `op-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveLane(laneId: string): GeneratedLane {
  const l = LANES.find((x) => x.lane === laneId);
  if (!l) throw new Error(`lane runner: unknown laneId "${laneId}"`);
  return l;
}

function closedResult(cp: LaneCheckpoint, l: GeneratedLane): LaneStepResult {
  return {
    checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
    lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
    iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
    currentVerb: undefined, guidance: [], checklist: [], flowIds: [], revision: cp.revision,
    message: cp.lifecycle === 'closed'
      ? `Lane ${cp.outcome}.`
      : cp.lifecycle === 'interrupted'
        ? 'Lane interrupted - resume to continue.'
        : 'Lane has no current step.',
  };
}

// Serve the verb step at cursor. Uses the PERSISTED cache if present (so retry/
// resume/duplicate never re-run handlers); otherwise runs each member flow once,
// caches, and persists. Empty-flow steps serve guidance only.
async function serveStep(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult> {
  if (isClosed(cp.lifecycle) || cp.lifecycle === 'interrupted' || cp.cursor >= l.verbSteps.length) {
    return closedResult(cp, l);
  }
  const step = l.verbSteps[cp.cursor];
  const key = `${cp.cursor}:${cp.iteration}`;
  // Resumable incremental serve: persist after EACH flow so a mid-step
  // interruption re-runs only the in-flight flow. Handlers are pure guidance,
  // so even that re-run is benign. Serving is NOT a revision-bumping mutation.
  let acc = cp.servedSteps[key];
  if (!acc) { acc = { guidance: [...step.guidance], checklist: [], flowIds: [], successfulFlowIds: [] }; cp.servedSteps[key] = acc; cp.updatedAt = d.now(); d.store.write(cp); }
  if (acc.flowIds.length < step.flowIds.length) {
    for (let i = acc.flowIds.length; i < step.flowIds.length; i++) {
      const flowId = step.flowIds[i];
      // intra-step prerequisite accumulation: a later flow in THIS step sees the
      // earlier flows of the same step that ran successfully, plus all
      // prior-step completions. Only status:'success' counts (degraded/skipped/
      // errored flows are NOT attested - they must not satisfy a prerequisite).
      const flowCtx = { ...context, completedFlowIds: [...cp.completedFlowIds, ...acc.successfulFlowIds], waivers: l.prereqWaivers };
      const r = await d.runFlow(flowId, flowCtx);
      for (const g of r.guidance ?? []) acc.guidance.push(g);
      for (const c of r.checklist ?? []) acc.checklist.push({ id: `${flowId}:${c.id}`, label: c.label, required: c.required, completed: false });
      acc.flowIds.push(flowId);
      if (r.status === 'success') acc.successfulFlowIds.push(flowId);
      cp.updatedAt = d.now(); d.store.write(cp);
    }
  }
  const served = acc;
  return {
    checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
    lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
    iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
    currentVerb: step.verb, guidance: served.guidance, checklist: served.checklist,
    flowIds: served.flowIds, revision: cp.revision,
    message: `Step ${cp.cursor + 1}/${l.verbSteps.length}: ${step.verb}`,
  };
}

export async function startLane(
  laneId: string, target: string, context: { projectPath?: string } & Record<string, any>,
  startRequestId: string, d: LaneRunnerDeps,
): Promise<LaneStepResult> {
  if (!startRequestId || typeof startRequestId !== 'string' || startRequestId.length > 256) {
    throw new Error('startLane: startRequestId must be a non-empty string <= 256 chars');
  }
  const l = resolveLane(laneId);
  if (l.executionKind === 'loop') {
    throw new Error(`startLane: lane "${laneId}" is a loop lane - loop execution + the convergence floor land in P4. Not startable in P2.`);
  }
  // Start-request lock: maps startRequestId -> ONE checkpoint and creates its
  // first-step lease atomically. Idempotency applies only to an ACTIVE lane: a
  // duplicate request must not double-start one still in_progress/interrupted. A
  // CLOSED checkpoint means that run finished, so the same phrase legitimately
  // starts a fresh lane. The lock holds ONLY the idempotent mapping + first-step
  // lease creation - it is released BEFORE any flow handler runs (spec line 286).
  const startLockId = 'start-' + createHash('sha256').update(startRequestId).digest('hex').slice(0, 40);
  const start = await withCheckpointLock(d.store.dir(), startLockId, () => {
    const existing = d.store.findByStartRequestId(startRequestId);
    if (existing && !isClosed(existing.lifecycle)) {
      if (existing.laneId !== laneId) throw new Error(`startLane: startRequestId "${startRequestId}" already maps to active lane "${existing.laneId}", not "${laneId}"`);
      return { checkpoint: existing, created: false, identity: existing.lease };
    }
    const ts = d.now();
    const operationId = (d.newOperationId ?? defaultOperationId)();
    const cp: LaneCheckpoint = {
      schemaVersion: 2, checkpointId: d.newCheckpointId(), laneId, target,
      executionKind: l.executionKind, lifecycle: 'in_progress', outcome: undefined,
      cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
      stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId,
      seenReportIds: [], fencingCounter: 1, sideEffectOutbox: [], stepGateStatuses: {},
      lease: { operationId, stepId: l.verbSteps[0].verb, iteration: 0, claimedCheckpointRevision: 0,
        fencingToken: 1, startedAt: ts, heartbeatAt: ts },
      createdAt: ts, updatedAt: ts,
    };
    cp.revision = 1; // first-step CLAIM is persisted atomically with the mapping
    d.store.write(cp);
    return { checkpoint: cp, created: true, identity: cp.lease };
  });

  // Lock released. Existing active lane: serve current state without re-running
  // initial handlers (the served cache short-circuits handler execution).
  if (!start.created) {
    return serveStep(start.checkpoint, resolveLane(start.checkpoint.laneId), context, d);
  }
  // New lane: serve the first step under the first-step lease identity, then
  // FINALIZE its served effects + clear the lease (same protocol as advancement).
  return serveStepUnderLease(start.checkpoint, l, context, d, start.identity!);
}

// Serve the first step's flow handlers during EXECUTE (buffered operation-locally,
// NO store writes), then FINALIZE the served-step entry + clear the lease under the
// full lease identity. The start-request lock is already released, so handlers run
// without holding it; persistent effects land only via FINALIZE. Task 7 adds the
// first-step committed outbox record inside this FINALIZE.
async function serveStepUnderLease(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps, id: LeaseIdentity): Promise<LaneStepResult> {
  if (isClosed(cp.lifecycle) || cp.lifecycle === 'interrupted' || cp.cursor >= l.verbSteps.length) {
    const final = await finalizeLease(d.store, cp.checkpointId, id, () => { /* nothing to serve */ }, d.now);
    return closedResult(final, l);
  }
  const step = l.verbSteps[cp.cursor];
  const key = `${cp.cursor}:${cp.iteration}`;
  const acc: { guidance: string[]; checklist: { id: string; label: string; required: boolean; completed: boolean }[]; flowIds: FlowId[]; successfulFlowIds: FlowId[] } =
    { guidance: [...step.guidance], checklist: [], flowIds: [], successfulFlowIds: [] };
  for (let i = 0; i < step.flowIds.length; i++) {
    const flowId = step.flowIds[i];
    const flowCtx = { ...context, completedFlowIds: [...cp.completedFlowIds, ...acc.successfulFlowIds], waivers: l.prereqWaivers };
    const r = await d.runFlow(flowId, flowCtx);
    for (const g of r.guidance ?? []) acc.guidance.push(g);
    for (const c of r.checklist ?? []) acc.checklist.push({ id: `${flowId}:${c.id}`, label: c.label, required: c.required, completed: false });
    acc.flowIds.push(flowId);
    if (r.status === 'success') acc.successfulFlowIds.push(flowId);
  }
  const final = await finalizeLease(d.store, cp.checkpointId, id, (c) => {
    c.servedSteps[key] = acc;
  }, d.now);
  return serveStep(final, l, context, d); // served cache complete -> pure read, no handler re-run
}

// helpers shared with advance (Task 5)
export { serveStep, resolveLane, closedResult };
export function pushAudit(cp: LaneCheckpoint, e: Omit<LaneAuditEntry, 'revision' | 'at'>, d: LaneRunnerDeps): void {
  cp.audit.push({ ...e, revision: cp.revision, at: d.now() });
}

export function laneStatus(projectPath: string, checkpointId: string, d: LaneRunnerDeps): LaneState {
  const cp = d.store.read(checkpointId);
  const l = resolveLane(cp.laneId);
  const step = cp.lifecycle === 'in_progress' && cp.cursor < l.verbSteps.length ? l.verbSteps[cp.cursor] : undefined;
  return {
    checkpointId: cp.checkpointId, laneId: cp.laneId, target: cp.target,
    lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: cp.executionKind,
    iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length, currentVerb: step?.verb,
    completedStepIds: [...cp.completedStepIds], skippedStepIds: [...cp.skippedStepIds], completedFlowIds: [...cp.completedFlowIds],
    stepReports: [...cp.stepReports], audit: [...cp.audit], revision: cp.revision, createdAt: cp.createdAt, updatedAt: cp.updatedAt,
  };
}

export function listLanes(projectPath: string, d: LaneRunnerDeps, options?: { all?: boolean }): LaneInfo[] {
  const all = !!options?.all;
  return d.store.list()
    .filter((s) => all || s.lifecycle === 'in_progress' || s.lifecycle === 'interrupted')
    .map((s) => { const l = resolveLane(s.laneId); return { checkpointId: s.checkpointId, laneId: s.laneId, lifecycle: s.lifecycle, outcome: s.outcome, stepIndex: s.cursor, totalSteps: l.verbSteps.length, updatedAt: s.updatedAt }; });
}

function bump(cp: LaneCheckpoint, d: LaneRunnerDeps): void {
  // Best-effort in-process guard: re-read the persisted revision and abort if it
  // moved since this checkpoint was loaded. True cross-process CAS (lease +
  // fencing token) is P3. `cp.revision` is the pre-bump value here; serveStep's
  // incremental writes do NOT bump revision, so the on-disk value still matches.
  if (d.store.exists(cp.checkpointId)) {
    const onDisk = d.store.read(cp.checkpointId);
    if (onDisk.revision !== cp.revision) throw new Error(`lane runner: concurrent modification (disk revision ${onDisk.revision} != in-memory ${cp.revision})`);
  }
  cp.revision += 1; cp.updatedAt = d.now(); d.store.write(cp);
}

// Advance the cursor after a completed/skipped step. Sequence final step closes
// the lane: outcome 'completed' if no step was skipped, else 'partial'. (Loop
// lanes never reach here - they are rejected at startLane in P2.)
async function advanceCursor(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult> {
  const last = l.verbSteps.length - 1;
  if (cp.cursor < last) { cp.cursor += 1; bump(cp, d); return serveStep(cp, l, context, d); }
  cp.lifecycle = 'closed';
  cp.outcome = cp.skippedStepIds.length > 0 ? 'partial' : 'completed';
  bump(cp, d);
  return closedResult(cp, l);
}

export async function advanceLane(projectPath: string, checkpointId: string, transition: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  const cp = d.store.read(checkpointId);
  const l = resolveLane(cp.laneId);

  // duplicate report -> no-op (before CAS, so a retried transport call is idempotent).
  // Guard on an IN_PROGRESS lane ONLY: a closed lane must REJECT any further
  // advance, and an interrupted lane must REJECT every non-resume action - both
  // must fall through to their checks below rather than be masked by the dedup
  // short-circuit (P1-2: same bug class as dup-on-closed, for interrupted).
  if (transition.report && cp.lifecycle === 'in_progress' && cp.seenReportIds.includes(transition.report.reportId)) return serveStep(cp, l, { projectPath }, d);

  // interrupted: ONLY resume is valid (spec 640-646). Checked before CAS so the
  // directive is returned regardless of revision drift.
  if (cp.lifecycle === 'interrupted' && transition.action !== 'resume') {
    throw new Error(`advanceLane: lane is interrupted - the only valid action is "resume" (got "${transition.action}")`);
  }
  if (cp.lifecycle === 'closed') throw new Error(`advanceLane: lane already closed (outcome ${cp.outcome})`);
  if (transition.expectedRevision !== cp.revision) throw new Error(`advanceLane: stale expectedRevision ${transition.expectedRevision} (current ${cp.revision})`);

  switch (transition.action) {
    case 'complete': {
      const r = transition.report;
      if (!r) throw new Error('advanceLane: complete requires a StepReport');
      if (!r.evidence || r.evidence.length < 1) throw new Error('advanceLane: StepReport needs >=1 evidence');
      const step = l.verbSteps[cp.cursor];
      if (r.stepId !== step.verb || r.iteration !== cp.iteration) throw new Error(`advanceLane: report (${r.stepId}/${r.iteration}) != current step (${step.verb}/${cp.iteration})`);
      // The step must be FULLY served before it can be completed. A mid-serve
      // interruption can persist a partial servedSteps cache (fewer flows than
      // step.flowIds); completing then would attest the step while silently
      // skipping the unserved flows. Reject - resume re-serves and finishes first.
      const servedFlows = cp.servedSteps[`${cp.cursor}:${cp.iteration}`]?.flowIds ?? [];
      if (servedFlows.length < step.flowIds.length) {
        throw new Error(`advanceLane: step "${step.verb}" is only partially served (${servedFlows.length}/${step.flowIds.length} flows) - resume to finish serving before completing`);
      }
      cp.seenReportIds.push(r.reportId); cp.stepReports.push(r); cp.completedStepIds.push(step.verb);
      // Attest ONLY the flows that actually ran successfully this step (from the
      // served cache) - never blindly all step.flowIds. Degraded/skipped/errored
      // flows must not be promoted into completedFlowIds, or they would falsely
      // satisfy a later step's prerequisite (lane_ship's DAG-violating order).
      const succ = cp.servedSteps[`${cp.cursor}:${cp.iteration}`]?.successfulFlowIds ?? [];
      for (const f of succ) if (!cp.completedFlowIds.includes(f)) cp.completedFlowIds.push(f);
      pushAudit(cp, { action: 'complete', stepId: step.verb, iteration: cp.iteration, reportId: r.reportId }, d);
      return advanceCursor(cp, l, { projectPath }, d);
    }
    // retry / skip / interrupt / resume / stop -> Tasks 6 & 7
    default:
      return transitionNonComplete(cp, l, projectPath, transition, d);
  }
}

async function transitionNonComplete(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  switch (t.action) {
    case 'retry': {
      if (t.report) { cp.stepReports.push(t.report); if (t.report.reportId) cp.seenReportIds.push(t.report.reportId); }
      pushAudit(cp, { action: 'retry', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration, reason: t.reason, reportId: t.report?.reportId }, d);
      bump(cp, d);
      return serveStep(cp, l, { projectPath }, d);     // served cache -> no handler re-run
    }
    case 'interrupt': {
      pushAudit(cp, { action: 'interrupt', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration, reason: t.reason }, d);
      cp.lifecycle = 'interrupted';
      bump(cp, d);
      return closedResult(cp, l);                       // paused state; NO serveStep
    }
    case 'resume': {
      if (cp.lifecycle !== 'interrupted') throw new Error('advanceLane: resume is only valid on an interrupted lane');
      cp.lifecycle = 'in_progress';
      pushAudit(cp, { action: 'resume', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration }, d);
      bump(cp, d);
      return serveStep(cp, l, { projectPath }, d);      // re-serve from cache
    }
    case 'stop': {
      pushAudit(cp, { action: 'stop', stepId: l.verbSteps[cp.cursor]?.verb, iteration: cp.iteration, reason: t.reason }, d);
      cp.lifecycle = 'closed'; cp.outcome = 'stopped';
      bump(cp, d);
      return closedResult(cp, l);
    }
    case 'skip':
      return skipStep(cp, l, projectPath, t, d);        // Task 7
    default:
      throw new Error(`advanceLane: unknown action "${(t as any).action}"`);
  }
}

// remaining (cursor+1..end) verb steps whose member flows have a REQUIRED
// prerequisite that is among the skipped flows, not already completed, and whose
// exact edge is not waived in the lane's prereqWaivers.
function strandedBySkipping(cp: LaneCheckpoint, l: GeneratedLane): string[] {
  const skipFlows = new Set(l.verbSteps[cp.cursor].flowIds);
  if (skipFlows.size === 0) return [];
  const completed = new Set(cp.completedFlowIds);
  const waived = new Set(l.prereqWaivers.map((w) => `${w.dependentFlowId}<-${w.prerequisiteFlowId}`));
  const blocked = new Set<string>();
  for (let i = cp.cursor + 1; i < l.verbSteps.length; i++) {
    const later = l.verbSteps[i];
    for (const depFlow of later.flowIds) {
      const deps = FlowPrerequisiteValidator.getDependencies(depFlow);
      if (!deps) continue;
      for (const p of deps.prerequisites) {
        if (!p.required) continue;
        if (skipFlows.has(p.flowId) && !completed.has(p.flowId) && !waived.has(`${depFlow}<-${p.flowId}`)) {
          blocked.add(later.verb);
        }
      }
    }
  }
  return [...blocked];
}

async function skipStep(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  if (!t.reason || !t.reason.trim()) throw new Error('advanceLane: skip requires a reason');
  const blocked = strandedBySkipping(cp, l);
  if (blocked.length > 0) {
    throw new Error(`advanceLane: cannot skip "${l.verbSteps[cp.cursor].verb}" - later steps require its prerequisites: ${blocked.join(', ')}. Complete it or stop the lane.`);
  }
  const step = l.verbSteps[cp.cursor];
  cp.skippedStepIds.push(step.verb);
  pushAudit(cp, { action: 'skip', stepId: step.verb, iteration: cp.iteration, reason: t.reason }, d);
  return advanceCursor(cp, l, { projectPath }, d);
}
