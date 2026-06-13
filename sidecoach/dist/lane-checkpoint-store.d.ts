import type { FlowId } from './types';
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry } from './lane-types';
export interface LaneCheckpoint {
    schemaVersion: 1;
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
    }>;
    revision: number;
    startRequestId: string;
    seenReportIds: string[];
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
    private dir;
    private filePath;
    write(cp: LaneCheckpoint): void;
    read(id: string): LaneCheckpoint;
    exists(id: string): boolean;
    findByStartRequestId(reqId: string): LaneCheckpoint | null;
    list(): LaneCheckpointSummary[];
    delete(id: string): void;
}
//# sourceMappingURL=lane-checkpoint-store.d.ts.map