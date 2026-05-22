import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface FontResearchContext {
    brandPersonality?: string;
    typographyApproach?: string;
    selectedFonts: string[];
    pairingRules: string[];
    typographyRules: string[];
}
export declare class FlowCFontResearchHandler extends BaseFlowHandler {
    private fontshareRef;
    private cachedFontContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): FontResearchContext | undefined;
}
export declare function createFlowCHandler(): FlowCFontResearchHandler;
//# sourceMappingURL=flow-handler-font-research.d.ts.map