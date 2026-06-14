import type { FlowId } from './types';
import type { GateStatus } from './lane-types';
export declare function validatorsForStep(step: {
    flowIds: FlowId[];
}): string[];
export declare function aggregateWorstStatus(statuses: GateStatus[]): GateStatus;
export interface GateOutcome {
    proceed: boolean;
    stepStatus?: 'validation_failed' | 'validation_inconclusive' | 'validation_error';
}
export declare function mapGateStatusToOutcome(status: GateStatus): GateOutcome;
export declare function isLoopLane(laneId: string): boolean;
export declare function requiredValidatorsForLane(laneId: string): string[];
//# sourceMappingURL=lane-validators.d.ts.map