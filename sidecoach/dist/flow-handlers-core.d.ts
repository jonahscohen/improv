import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
/**
 * Flow Z: Design a New Component (from scratch)
 * Consolidates /sidecoach craft + QA triad (audit -> critique -> polish).
 * Previously flow7_design_component; renamed in T-0015.
 */
export declare class FlowZDesignHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getDesignComponentChecklist;
}
//# sourceMappingURL=flow-handlers-core.d.ts.map