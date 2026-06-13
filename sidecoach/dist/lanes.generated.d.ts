import type { FlowId } from './types';
export interface GeneratedLane {
    lane: string;
    label: string;
    description: string;
    interviewLabel: string;
    executionKind: 'sequence' | 'loop';
    verbChain: string[];
    flowSequence: FlowId[];
    verbGuidance: {
        verb: string;
        guidance: string[];
    }[];
    verbSteps: {
        verb: string;
        flowIds: FlowId[];
        guidance: string[];
    }[];
    prereqWaivers: {
        dependentFlowId: string;
        prerequisiteFlowId: string;
        reason: string;
    }[];
}
export declare const LANES: GeneratedLane[];
export declare const LANES_BY_ID: Record<string, GeneratedLane>;
export declare function getLane(id: string): GeneratedLane | undefined;
export declare function getLaneFlowSequence(id: string): FlowId[] | undefined;
//# sourceMappingURL=lanes.generated.d.ts.map