import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
interface AccessibilityContext {
    wcagLevel: 'AA' | 'AAA';
    domainAuditResults: {
        domain: string;
        wcagCriteria: string[];
        complianceStatus: 'pass' | 'fail' | 'needs_testing';
        issues: string[];
    }[];
    screenReaderTests: {
        tool: string;
        coverage: string;
    }[];
}
export declare class FlowIAccessibilityHandler extends BaseFlowHandler {
    private cachedA11yContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): AccessibilityContext | undefined;
}
export declare function createFlowIHandler(): FlowIAccessibilityHandler;
export {};
//# sourceMappingURL=flow-handler-accessibility.d.ts.map