import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
interface DesignTokenContext {
    tokenSections: string[];
    domainValidationResults: {
        domain: string;
        rules: string[];
        validationStatus: 'pass' | 'warning' | 'fail';
        issues: string[];
    }[];
    tokenDefinitions: {
        section: string;
        tokenCount: number;
        examples: string[];
    }[];
}
export declare class FlowFDesignTokensHandler extends BaseFlowHandler {
    private cachedTokenContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): DesignTokenContext | undefined;
}
export declare function createFlowFHandler(): FlowFDesignTokensHandler;
export {};
//# sourceMappingURL=flow-handler-design-tokens.d.ts.map