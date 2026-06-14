import type { FlowId } from './types';
import type { FlowExecutionResult } from './flow-handler';
import { GeneratedLane } from './lanes.generated';
import { LaneCheckpoint, LaneCheckpointStore } from './lane-checkpoint-store';
import { LaneStepResult, LaneState, LaneInfo, LaneTransition, LaneAuditEntry } from './lane-types';
import type { ProductValidationResult } from './product-rule-types';
export interface LaneRunnerDeps {
    store: LaneCheckpointStore;
    runFlow: (flowId: FlowId, context: any) => Promise<FlowExecutionResult>;
    now: () => string;
    newCheckpointId: () => string;
    newOperationId?: () => string;
    runValidator?: (validatorId: string, validatorContext: {
        projectPath: string;
        target: string;
    }, signal?: AbortSignal) => Promise<ProductValidationResult>;
    staleMs?: number;
    heartbeatIntervalMs?: number;
    publishOutbox?: (store: LaneCheckpointStore, checkpointId: string, projectPath: string, now?: () => string) => Promise<void>;
    __claimBarrier?: () => Promise<void>;
    __beforeServePersist?: () => Promise<void>;
}
declare function resolveLane(laneId: string): GeneratedLane;
declare function closedResult(cp: LaneCheckpoint, l: GeneratedLane): LaneStepResult;
declare function serveStep(cp: LaneCheckpoint, l: GeneratedLane, context: any, d: LaneRunnerDeps): Promise<LaneStepResult>;
export declare function startLane(laneId: string, target: string, context: {
    projectPath?: string;
} & Record<string, any>, startRequestId: string, d: LaneRunnerDeps): Promise<LaneStepResult>;
export { serveStep, resolveLane, closedResult };
export declare function pushAudit(cp: LaneCheckpoint, e: Omit<LaneAuditEntry, 'revision' | 'at'>, d: LaneRunnerDeps): void;
export declare function laneStatus(projectPath: string, checkpointId: string, d: LaneRunnerDeps): LaneState;
export declare function listLanes(projectPath: string, d: LaneRunnerDeps, options?: {
    all?: boolean;
}): LaneInfo[];
export declare function advanceLane(projectPath: string, checkpointId: string, transition: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult>;
//# sourceMappingURL=lane-runner.d.ts.map