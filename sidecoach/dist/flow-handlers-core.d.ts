import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
/**
 * Flow 2: Polish/Enhance Interaction
 * Consolidates /make-interfaces-feel-better - adds feeling, animation, microinteractions
 */
export declare class Flow2PolishHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getPolarishChecklist;
}
/**
 * Flow 5: Review/QA Mode
 * Consolidates audit - comprehensive multi-lens check
 */
export declare class Flow5ReviewHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getReviewChecklist;
}
/**
 * Flow 7: Design a New Component
 * Consolidates /sidecoach craft + QA triad (audit → critique → polish)
 */
export declare class Flow7DesignHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getDesignComponentChecklist;
}
/**
 * Flow 10: Implement from Design
 * Design-to-code workflow with state matrix and responsive validation
 */
export declare class Flow10ImplementHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getImplementChecklist;
}
//# sourceMappingURL=flow-handlers-core.d.ts.map