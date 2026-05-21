import { FlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowId } from './types';
export declare class SidecoachOrchestrator {
    private intentDetector;
    private handlers;
    constructor();
    private initializeHandlers;
    process(utterance: string, context?: Partial<FlowExecutionContext>): Promise<SidecoachResult>;
    registerHandler(handler: FlowHandler): void;
    getAvailableFlows(): FlowInfo[];
}
export interface FlowInfo {
    flowId: FlowId;
    name: string;
    description: string;
}
export interface SidecoachResult {
    success: boolean;
    message: string;
    detectedFlow: {
        flowId: FlowId;
        flowName: string;
        confidence: number;
    } | null;
    flowResults: FlowExecutionResult[];
    guidance?: string[];
    checklist?: any[];
    artifacts?: any[];
    ambiguousCandidates?: Array<{
        flowId: FlowId;
        flowName: string;
        confidence: number;
    }>;
}
export declare function createOrchestrator(): SidecoachOrchestrator;
//# sourceMappingURL=sidecoach-orchestrator.d.ts.map