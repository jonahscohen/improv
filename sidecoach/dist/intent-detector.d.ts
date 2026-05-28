import { FlowId, MatchResult, DisambiguationResult } from './types';
import { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SidecoachOrchestrator } from './orchestrator';
import { FlowHistory } from './flow-history';
export declare class IntentDetector {
    private detectors;
    private orchestrator;
    private history;
    constructor(orchestrator?: SidecoachOrchestrator, history?: FlowHistory);
    detect(utterance: string): MatchResult | DisambiguationResult;
    validateFlowPrerequisites(flowId: FlowId, context: FlowExecutionContext): {
        canRun: boolean;
        missingPrerequisites: FlowId[];
        recommendedFlow?: FlowId;
        message: string;
    };
    getNextRecommendedFlow(currentFlowId: FlowId, result: FlowExecutionResult): FlowId | undefined;
    getCurrentPhase(context: FlowExecutionContext): import("./orchestrator").DesignPhase;
    getRecommendedFlowSequence(context: FlowExecutionContext): FlowId[];
    getWorkflowProgress(context: FlowExecutionContext): {
        phase: import("./orchestrator").DesignPhase;
        nextFlow: FlowId;
        sequenceProgress: string;
    };
    private has;
    private hasAny;
    private hasNone;
    private createFlowADetector;
    private createFlowBDetector;
    private createFlowCDetector;
    private createFlowDDetector;
    private createFlowEDetector;
    private createFlowFDetector;
    private createFlowGDetector;
    private createFlowHDetector;
    private createFlowIDetector;
    private createFlowJDetector;
    private createFlowKDetector;
    private createFlowLDetector;
    private createFlowMDetector;
    private createFlowNDetector;
    private createFlowODetector;
    private createFlowPDetector;
    private createFlowQDetector;
    private createFlowRDetector;
    private createFlowSDetector;
    private createFlowTDetector;
    private createFlowYDetector;
    private createFlowZDetector;
    private createFlowUDetector;
    private createFlowVDetector;
    private createFlowWDetector;
    private createFlowXDetector;
}
export declare function createDetector(): IntentDetector;
//# sourceMappingURL=intent-detector.d.ts.map