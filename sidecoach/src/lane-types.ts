// sidecoach/src/lane-types.ts
// Lane execution contract. Two-axis lifecycle/outcome per spec section 7
// (lines 636-649). P2 carries idempotency KEYS (startRequestId, expectedRevision,
// reportId) but not P3 distributed-safety machinery.
import type { FlowId } from './types';
import type { ProductFinding } from './product-rule-types';

export type LaneAction = 'complete' | 'retry' | 'skip' | 'resume' | 'interrupt' | 'stop';
export type LaneLifecycle = 'in_progress' | 'interrupted' | 'closed';
export type LaneOutcome = 'completed' | 'partial' | 'stopped' | 'converged';

export interface StepEvidence { kind: 'files' | 'screenshot' | 'validation' | 'note'; detail: string; }

export interface StepReport {
  stepId: string;        // the verb step (verb name)
  iteration: number;     // 0 for sequence lanes (P2 is sequence-only)
  reportId: string;      // idempotency key; re-sent reportId is a no-op
  verb: string;
  summary: string;
  evidence: StepEvidence[];          // >= 1 entry (enforced in advanceLane)
  checklistResults?: { itemId: string; done: boolean }[];
}

export interface LaneTransition {
  action: LaneAction;
  report?: StepReport;       // REQUIRED for 'complete'
  expectedRevision: number;  // best-effort in-process revision check; stale = error (true cross-process CAS is P3)
  reason?: string;           // REQUIRED for 'skip'; recorded for stop/interrupt
}

export interface LaneAuditEntry {
  revision: number; action: LaneAction; stepId?: string; iteration: number;
  reason?: string; reportId?: string; at: string;
}

export interface LeaseRecord {
  operationId: string;
  stepId: string;
  iteration: number;
  claimedCheckpointRevision: number;
  fencingToken: number;
  startedAt: string;
  heartbeatAt: string;
}

// One side-effect entry inside an outbox bundle. publisher + entryIndex give a
// stable replay key; logicalKey is the downstream conditional-upsert key.
export interface SideEffectEntry {
  publisher: string;          // logical downstream store id, e.g. 'lane-side-effect-sink'
  entryIndex: number;         // stable index within this bundle
  logicalKey: string;         // downstream upsert key, e.g. `${checkpointId}:${stepId}:${iteration}`
  payload: unknown;           // the side-effect content (P4b-1: a step-completion summary)
}

// Written at FINALIZE, keyed by (checkpointId, committedRevision), carrying the
// fencingToken. Retained until every declared publisher acks (spec lines 683-723).
export interface SideEffectOutboxRecord {
  checkpointId: string;
  committedRevision: number;
  fencingToken: number;
  stepId: string;
  iteration: number;
  entries: SideEffectEntry[];
  pendingPublishers: string[];
  createdAt: string;
}

export type PersistedStepGateStatus = 'clean' | 'validation_failed' | 'validation_inconclusive' | 'validation_error';

// Worst-status verdict for a step's bound product validators (advanceLane gating).
export type GateStatus = 'clean' | 'findings' | 'inconclusive' | 'error';

export interface LaneStepResult {
  checkpointId: string; laneId: string; laneLabel: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  executionKind: 'sequence' | 'loop'; iteration: number;
  stepIndex: number; totalSteps: number;
  currentVerb?: string;                 // undefined when closed
  guidance: string[];
  checklist: { id: string; label: string; required: boolean; completed: boolean }[];
  flowIds: FlowId[];
  revision: number;                     // pass as expectedRevision next advance
  message: string;
  // Validator gate surface (optional so closed/serve results omit it). Present on
  // a `complete` result that ran product validators.
  gate?: { status: GateStatus; validators: { validatorId: string; status: GateStatus }[]; findings: ProductFinding[] };
}

export interface LaneState {
  checkpointId: string; laneId: string; target: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  executionKind: 'sequence' | 'loop'; iteration: number;
  stepIndex: number; totalSteps: number; currentVerb?: string;
  completedStepIds: string[]; skippedStepIds: string[]; completedFlowIds: FlowId[];
  stepReports: StepReport[]; audit: LaneAuditEntry[];
  revision: number; createdAt: string; updatedAt: string;
}

export interface LaneInfo {
  checkpointId: string; laneId: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  stepIndex: number; totalSteps: number; updatedAt: string;
}

export function makeStepReport(r: StepReport): StepReport { return { ...r, evidence: [...r.evidence] }; }
export function isClosed(l: LaneLifecycle): boolean { return l === 'closed'; }
