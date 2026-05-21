import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
/**
 * Flow 1: Clone/Match from Reference
 * Exact 1:1 replication from design source
 */
export declare class Flow1CloneHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getCloneChecklist;
}
/**
 * Flow 3: Audit Page/Section
 * Identify and report issues without fixing
 */
export declare class Flow3AuditHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getAuditChecklist;
}
/**
 * Flow 4: Exploration/Discovery Mode
 * Open-ended exploration without success criteria
 */
export declare class Flow4ExploreHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getExploreChecklist;
}
/**
 * Flow 6: Constraint-Based Design
 * Design under explicit constraints or limits
 */
export declare class Flow6ConstraintHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getConstraintChecklist;
}
/**
 * Flow 8: Refactor/Improve Section
 * Improve structure, hierarchy, and whitespace
 */
export declare class Flow8RefactorHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getRefactorChecklist;
}
/**
 * Flow 9: Make Accessible
 * Ensure WCAG compliance and accessibility standards
 */
export declare class Flow9AccessibleHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getAccessibilityChecklist;
}
/**
 * Flow 11: Extract Tokens/Create Variant
 * Extract repeated patterns into reusable tokens
 */
export declare class Flow11ExtractHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getExtractChecklist;
}
/**
 * Flow 12: Responsive Design Review
 * Test across screen sizes and breakpoints
 */
export declare class Flow12ResponsiveHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getResponsiveChecklist;
}
/**
 * Flow 13: Rapid Iteration Cycle
 * Goal-driven refinement with success criteria
 */
export declare class Flow13IterateHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getIterateChecklist;
}
/**
 * Flow 14: Migration/Refactor Existing Component
 * API change or component replacement with dependencies
 */
export declare class Flow14MigrationHandler extends BaseFlowHandler {
    constructor();
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private getMigrationChecklist;
}
//# sourceMappingURL=flow-handlers-extended.d.ts.map