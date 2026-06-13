import type { FlowId } from './types';
import type { FlowExecutionResult } from './flow-handler';
import { GeneratedLane } from './lanes.generated';
import { LaneCheckpoint, LaneCheckpointStore } from './lane-checkpoint-store';
import { LaneStepResult, LaneState, LaneInfo, LaneTransition, LaneAuditEntry } from './lane-types';
export interface LaneRunnerDeps {
    store: LaneCheckpointStore;
    runFlow: (flowId: FlowId, context: any) => Promise<FlowExecutionResult>;
    now: () => string;
    newCheckpointId: () => string;
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