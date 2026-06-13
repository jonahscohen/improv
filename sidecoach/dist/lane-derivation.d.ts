import type { FlowId } from './types';
/** Flows for a verb chain in verb order, each flow once, first owning verb. */
export declare function deriveFlowSequence(verbChain: string[]): FlowId[];
/** Per-verb guidance lines for a chain, in chain order. */
export declare function deriveVerbGuidance(verbChain: string[]): {
    verb: string;
    guidance: string[];
}[];
export declare function deriveVerbSteps(verbChain: string[], flowSequence: FlowId[], verbGuidance: {
    verb: string;
    guidance: string[];
}[]): {
    verb: string;
    flowIds: FlowId[];
    guidance: string[];
}[];
//# sourceMappingURL=lane-derivation.d.ts.map