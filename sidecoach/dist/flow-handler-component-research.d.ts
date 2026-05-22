import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface ComponentResearchContext {
    componentPatterns: string[];
    interactionRules: string[];
    writingRules: string[];
    semanticMarkup: Record<string, string>;
    a11yPatterns: Record<string, string>;
    validationResults: {
        componentName: string;
        wcagStatus: 'pass' | 'fail' | 'warning';
        issues: string[];
    }[];
}
export declare class FlowBComponentResearchHandler extends BaseFlowHandler {
    private componentGalleryRef;
    private cachedComponentContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): ComponentResearchContext | undefined;
}
export declare function createFlowBHandler(): FlowBComponentResearchHandler;
//# sourceMappingURL=flow-handler-component-research.d.ts.map