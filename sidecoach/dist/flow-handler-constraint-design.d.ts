import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export declare class FlowPConstraintDesignHandler extends BaseFlowHandler {
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(_context: FlowExecutionContext): Promise<FlowExecutionResult>;
}
export declare function createFlowPHandler(): FlowPConstraintDesignHandler;
//# sourceMappingURL=flow-handler-constraint-design.d.ts.map