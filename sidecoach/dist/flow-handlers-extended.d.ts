import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
/**
 * Flow Y: Exploration/Discovery Mode
 * Open-ended exploration without success criteria.
 * Previously flow4_explore_discovery; renamed in T-0015.
 */
export declare class FlowYExploreHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getExploreChecklist;
}
//# sourceMappingURL=flow-handlers-extended.d.ts.map