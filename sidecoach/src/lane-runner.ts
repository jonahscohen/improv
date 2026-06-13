// sidecoach/src/lane-runner.ts
// Sequence-lane execution state machine (P2). Loop lanes are rejected here and
// handled in P4 with the convergence floor.
import type { FlowId } from './types';
import type { FlowExecutionResult } from './flow-handler';
import { LANES, GeneratedLane } from './lanes.generated';
import { LaneCheckpoint, LaneCheckpointStore } from './lane-checkpoint-store';
import { LaneStepResult, LaneState, LaneInfo, LaneTransition, LaneAuditEntry, isClosed } from './lane-types';

export interface LaneRunnerDeps {
  store: LaneCheckpointStore;
  runFlow: (flowId: FlowId, context: any) => Promise<FlowExecutionResult>;
  now: () => string;
  newCheckpointId: () => string;
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
  // Idempotency applies only to an ACTIVE lane: a duplicate request must not
  // double-start one that is still in_progress/interrupted. A CLOSED checkpoint
  // means that run finished, so the same phrase legitimately starts a fresh lane
  // (this also prevents a deterministic process()-derived id from permanently
  // aliasing later reruns to an old closed checkpoint).
  const existing = d.store.findByStartRequestId(startRequestId);
  if (existing && !isClosed(existing.lifecycle)) {
    if (existing.laneId !== laneId) throw new Error(`startLane: startRequestId "${startRequestId}" already maps to active lane "${existing.laneId}", not "${laneId}"`);
    return serveStep(existing, resolveLane(existing.laneId), context, d);
  }
  const ts = d.now();
  const cp: LaneCheckpoint = {
    schemaVersion: 1, checkpointId: d.newCheckpointId(), laneId, target,
    executionKind: l.executionKind, lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId,
    seenReportIds: [], createdAt: ts, updatedAt: ts,
  };
  d.store.write(cp);
  return serveStep(cp, l, context, d);
}

// helpers shared with advance (Task 5)
export { serveStep, resolveLane, closedResult };
export function pushAudit(cp: LaneCheckpoint, e: Omit<LaneAuditEntry, 'revision' | 'at'>, d: LaneRunnerDeps): void {
  cp.audit.push({ ...e, revision: cp.revision, at: d.now() });
}
