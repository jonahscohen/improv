import type { FlowId } from './types';
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry, LeaseRecord, SideEffectOutboxRecord, PersistedStepGateStatus, ConvergenceState } from './lane-types';
export interface LaneCheckpoint {
    schemaVersion: 2;
    checkpointId: string;
    laneId: string;
    target: string;
    executionKind: 'sequence' | 'loop';
    lifecycle: LaneLifecycle;
    outcome?: LaneOutcome;
    cursor: number;
    iteration: number;
    completedStepIds: string[];
    skippedStepIds: string[];
    completedFlowIds: FlowId[];
    stepReports: StepReport[];
    audit: LaneAuditEntry[];
    servedSteps: Record<string, {
        guidance: string[];
        checklist: {
            id: string;
            label: string;
            required: boolean;
            completed: boolean;
        }[];
        flowIds: FlowId[];
        successfulFlowIds: FlowId[];
        flowOutcomes: {
            flowId: FlowId;
            status: 'success' | 'needs_input' | 'error' | 'skipped';
            message: string;
        }[];
    }>;
    revision: number;
    startRequestId: string;
    seenReportIds: string[];
    fencingCounter: number;
    lease: LeaseRecord | null;
    sideEffectOutbox: SideEffectOutboxRecord[];
    stepGateStatuses: Record<string, PersistedStepGateStatus>;
    convergence?: ConvergenceState;
    createdAt: string;
    updatedAt: string;
}
export interface LaneCheckpointSummary {
    checkpointId: string;
    laneId: string;
    lifecycle: LaneLifecycle;
    outcome?: LaneOutcome;
    cursor: number;
    updatedAt: string;
}
export declare class LaneCheckpointStore {
    private projectPath;
    constructor(projectPath: string);
    dir(): string;
    private filePath;
    private migrate;
    write(cp: LaneCheckpoint): void;
    read(id: string): LaneCheckpoint;
    exists(id: string): boolean;
    findByStartRequestId(reqId: string): LaneCheckpoint | null;
    list(): LaneCheckpointSummary[];
    delete(id: string): void;
}
export declare function leaseIsLive(lease: LeaseRecord | null, nowMs: number, staleMs?: number): boolean;
export type LeaseIdentity = Pick<LeaseRecord, 'operationId' | 'stepId' | 'iteration' | 'claimedCheckpointRevision' | 'fencingToken'>;
export interface ClaimOpts {
    expectedRevision: number;
    stepId: string;
    iteration: number;
    operationId: string;
    now?: () => string;
    staleMs?: number;
}
export declare function claimLease(store: LaneCheckpointStore, checkpointId: string, o: ClaimOpts): Promise<LaneCheckpoint>;
export declare function refreshHeartbeat(store: LaneCheckpointStore, checkpointId: string, id: LeaseIdentity, now?: () => string): Promise<LaneCheckpoint>;
export declare function finalizeLease(store: LaneCheckpointStore, checkpointId: string, id: LeaseIdentity, mutate: (cp: LaneCheckpoint, committedRevision: number) => void, now?: () => string): Promise<LaneCheckpoint>;
export declare const OUTBOX_PUBLISHERS: readonly ["lane-side-effect-sink"];
export declare function publishOutbox(store: LaneCheckpointStore, checkpointId: string, projectPath: string, now?: () => string): Promise<void>;
export declare function publishPendingOutbox(store: LaneCheckpointStore, projectPath: string, now?: () => string): Promise<void>;
//# sourceMappingURL=lane-checkpoint-store.d.ts.map