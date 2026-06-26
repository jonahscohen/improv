// sidecoach/src/lane-types.ts
// Lane execution contract. Two-axis lifecycle/outcome per spec section 7
// (lines 636-649). P2 carries idempotency KEYS (startRequestId, expectedRevision,
// reportId) but not P3 distributed-safety machinery.
import type { FlowId } from './types';
import type { ProductFinding, NormalizedErrorCategory, ProductValidationCoverage } from './product-rule-types';

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
  // Pre-rendered compact progress panel (the model prints it verbatim). Optional
  // so existing callers/tests are unaffected; populated by the engine wrappers.
  panel?: string;
  // Validator gate surface (optional so closed/serve results omit it). Present on
  // a `complete` result that ran product validators.
  gate?: { status: GateStatus; validators: { validatorId: string; status: GateStatus }[]; findings: ProductFinding[] };
  // Reference-system preflight (deliverable B): reference artifacts gathered at lane
  // START for build/refinement lanes, REGARDLESS of which verbs the chain routes.
  // Additive + soft-fail (never blocks lane start); optional so existing callers/tests
  // are unaffected. Populated by the orchestrator's startLane wrapper.
  referencePreflight?: {
    artifacts: { kind: string; title: string; content: string; source: string }[];
    warnings: string[];
  };
  // Loop-lane convergence surface (present on a loop boundary result). The summary
  // is GENERATED from the run coverage record for a converged result (truthful).
  convergence?: {
    outcome: ConvergenceOutcome;
    iteration: number;
    signature?: string;
    findings: ProductFinding[];
    displayLabel: 'running' | 'stalled' | 'capped' | 'converged' | 'machine_checks_clean_with_advisory_warnings';
    summary?: string;
  };
}

export type LaneStepStatus = 'pending' | 'current' | 'completed' | 'skipped' | 'validation_failed' | 'validation_inconclusive' | 'validation_error';

export interface LaneState {
  checkpointId: string; laneId: string; target: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  executionKind: 'sequence' | 'loop'; iteration: number;
  stepIndex: number; totalSteps: number; currentVerb?: string;
  completedStepIds: string[]; skippedStepIds: string[]; completedFlowIds: FlowId[];
  stepReports: StepReport[]; audit: LaneAuditEntry[];
  // Per-step status surface (spec): past steps report completed/skipped; the current
  // step reports its persisted gate status (validation_*) or 'current'; the rest pending.
  steps: { verb: string; flowIds: FlowId[]; status: LaneStepStatus }[];
  revision: number; createdAt: string; updatedAt: string;
}

export interface LaneInfo {
  checkpointId: string; laneId: string;
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  stepIndex: number; totalSteps: number; updatedAt: string;
}

// ---- P4c loop convergence sub-state (spec section 9 lines 1142-1167) ----------
export type ConvergenceOutcome = 'running' | 'converged' | 'stalled' | 'capped' | 'error';

// The full required-state tuple per required validator. Stable identities only
// (canonical rule keys, gap identities, normalized error categories) - never
// free-text messages, so the progress signature is reproducible.
export interface RequiredValidatorState {
  validatorId: string;
  status: GateStatus;
  failedRuleIds: string[];
  inconclusiveRuleIds: string[];
  coverageGapIdentities: string[];
  validatorErrorCategory?: NormalizedErrorCategory;
  ruleErrorCategories: string[];   // `${canonicalRuleKey}:${category}`
}

export interface ConvergenceIterationRecord {
  iteration: number;
  signature: string;
  perValidator: RequiredValidatorState[];
  // Actual run coverage for EACH required validator. This is persisted alongside
  // the signature so the boundary decision and closing summary are reproducible.
  requiredValidatorRuns: {
    validatorId: string;
    status: GateStatus;
    coverage: ProductValidationCoverage;
  }[];
}

export type AdvisoryFlowOutcome = 'success' | 'needs_input' | 'skipped' | 'error';
export interface AdvisoryRunRecord {
  iteration: number;
  stepId: string;
  flows: { flowId: FlowId; outcome: AdvisoryFlowOutcome; message?: string }[];
}

// Persisted in the checkpoint so every iteration survives process boundaries and a
// clean decision is reproducible from persisted inputs (spec lines 1138-1152). The
// LANE lifecycle/outcome lives on LaneCheckpoint; this is the LOOP result only.
export interface ConvergenceState {
  outcome: ConvergenceOutcome;
  iteration: number;
  signatures: string[];
  consecutiveNoProgress: number;
  limits: { maxIterations: number; maxNoProgress: number };
  history: ConvergenceIterationRecord[];                                  // productValidationRuns
  findings: ProductFinding[];                                            // latest boundary findings
  validatorErrors: { validatorId: string; category: NormalizedErrorCategory; message: string }[];
  advisoryRuns: AdvisoryRunRecord[];
  // Aggregated from the latest requiredValidatorRuns, never registry prose.
  runCoverage: {
    discoveredFiles: string[];
    inspectedFiles: string[];
    skippedFiles: string[];
    unreadableFiles: string[];
    unsupportedSourceKinds: string[];
    unsupportedFiles: string[];
    measuredScope: string[];
    unverifiedScope: string[];
    notApplicableRuleIds: string[];
  };
}

export function makeStepReport(r: StepReport): StepReport { return { ...r, evidence: [...r.evidence] }; }
export function isClosed(l: LaneLifecycle): boolean { return l === 'closed'; }
