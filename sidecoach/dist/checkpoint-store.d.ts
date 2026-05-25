import type { FlowId } from './types';
import type { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface SidecoachCheckpoint {
    schemaVersion: 1;
    checkpointId: string;
    compositeFlowId: FlowId;
    createdAt: string;
    cursor: number;
    completedStepIds: FlowId[];
    flowResults: FlowExecutionResult[];
    executionContext: FlowExecutionContext;
    utterance: string;
}
export interface CheckpointSummary {
    checkpointId: string;
    compositeFlowId: FlowId;
    createdAt: string;
    cursor: number;
}
export declare class CheckpointStore {
    private projectPath;
    constructor(projectPath: string);
    private checkpointsDir;
    private ensureDir;
    private filePath;
    writeCheckpoint(checkpoint: SidecoachCheckpoint): void;
    readCheckpoint(checkpointId: string): SidecoachCheckpoint;
    deleteCheckpoint(checkpointId: string): void;
    listCheckpoints(): CheckpointSummary[];
    gcOldCheckpoints(maxAgeDays: number): number;
}
//# sourceMappingURL=checkpoint-store.d.ts.map