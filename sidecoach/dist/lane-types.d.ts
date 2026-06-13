import type { FlowId } from './types';
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
}
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
export declare function makeStepReport(r: StepReport): StepReport;
export declare function isClosed(l: LaneLifecycle): boolean;
//# sourceMappingURL=lane-types.d.ts.map