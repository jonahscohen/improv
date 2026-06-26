import type { FlowId } from './types';
import type { ProductFinding, NormalizedErrorCategory, ProductValidationCoverage } from './product-rule-types';
export type LaneAction = 'complete' | 'retry' | 'skip' | 'resume' | 'interrupt' | 'stop';
export type LaneLifecycle = 'in_progress' | 'interrupted' | 'closed';
export type LaneOutcome = 'completed' | 'partial' | 'stopped' | 'converged';
export interface StepEvidence {
    kind: 'files' | 'screenshot' | 'validation' | 'note';
    detail: string;
}
export interface StepReport {
    stepId: string;
    iteration: number;
    reportId: string;
    verb: string;
    summary: string;
    evidence: StepEvidence[];
    checklistResults?: {
        itemId: string;
        done: boolean;
    }[];
}
export interface LaneTransition {
    action: LaneAction;
    report?: StepReport;
    expectedRevision: number;
    reason?: string;
}
export interface LaneAuditEntry {
    revision: number;
    action: LaneAction;
    stepId?: string;
    iteration: number;
    reason?: string;
    reportId?: string;
    at: string;
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
export interface SideEffectEntry {
    publisher: string;
    entryIndex: number;
    logicalKey: string;
    payload: unknown;
}
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
export type GateStatus = 'clean' | 'findings' | 'inconclusive' | 'error';
export interface LaneStepResult {
    checkpointId: string;
    laneId: string;
    laneLabel: string;
    lifecycle: LaneLifecycle;
    outcome?: LaneOutcome;
    executionKind: 'sequence' | 'loop';
    iteration: number;
    stepIndex: number;
    totalSteps: number;
    currentVerb?: string;
    guidance: string[];
    checklist: {
        id: string;
        label: string;
        required: boolean;
        completed: boolean;
    }[];
    flowIds: FlowId[];
    revision: number;
    message: string;
    panel?: string;
    gate?: {
        status: GateStatus;
        validators: {
            validatorId: string;
            status: GateStatus;
        }[];
        findings: ProductFinding[];
    };
    referencePreflight?: {
        artifacts: {
            kind: string;
            title: string;
            content: string;
            source: string;
        }[];
        warnings: string[];
    };
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
    checkpointId: string;
    laneId: string;
    target: string;
    lifecycle: LaneLifecycle;
    outcome?: LaneOutcome;
    executionKind: 'sequence' | 'loop';
    iteration: number;
    stepIndex: number;
    totalSteps: number;
    currentVerb?: string;
    completedStepIds: string[];
    skippedStepIds: string[];
    completedFlowIds: FlowId[];
    stepReports: StepReport[];
    audit: LaneAuditEntry[];
    steps: {
        verb: string;
        flowIds: FlowId[];
        status: LaneStepStatus;
    }[];
    revision: number;
    createdAt: string;
    updatedAt: string;
}
export interface LaneInfo {
    checkpointId: string;
    laneId: string;
    lifecycle: LaneLifecycle;
    outcome?: LaneOutcome;
    stepIndex: number;
    totalSteps: number;
    updatedAt: string;
}
export type ConvergenceOutcome = 'running' | 'converged' | 'stalled' | 'capped' | 'error';
export interface RequiredValidatorState {
    validatorId: string;
    status: GateStatus;
    failedRuleIds: string[];
    inconclusiveRuleIds: string[];
    coverageGapIdentities: string[];
    validatorErrorCategory?: NormalizedErrorCategory;
    ruleErrorCategories: string[];
}
export interface ConvergenceIterationRecord {
    iteration: number;
    signature: string;
    perValidator: RequiredValidatorState[];
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
    flows: {
        flowId: FlowId;
        outcome: AdvisoryFlowOutcome;
        message?: string;
    }[];
}
export interface ConvergenceState {
    outcome: ConvergenceOutcome;
    iteration: number;
    signatures: string[];
    consecutiveNoProgress: number;
    limits: {
        maxIterations: number;
        maxNoProgress: number;
    };
    history: ConvergenceIterationRecord[];
    findings: ProductFinding[];
    validatorErrors: {
        validatorId: string;
        category: NormalizedErrorCategory;
        message: string;
    }[];
    advisoryRuns: AdvisoryRunRecord[];
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
export declare function makeStepReport(r: StepReport): StepReport;
export declare function isClosed(l: LaneLifecycle): boolean;
//# sourceMappingURL=lane-types.d.ts.map