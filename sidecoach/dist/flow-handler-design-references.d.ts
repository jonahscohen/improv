import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface DesignReferenceContext {
    referencesFound: number;
    colorDomainRules: string[];
    spatialDomainRules: string[];
    references: {
        title: string;
        category: string;
        hasColorPalette: boolean;
        hasSpacingPattern: boolean;
        slopDetectionResults: {
            categoryReflex: boolean;
            oversaturated: boolean;
            genericityScore: number;
        };
    }[];
}
export declare class FlowDReferenceSearchHandler extends BaseFlowHandler {
    private designReferencesRef;
    private cachedReferenceContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): DesignReferenceContext | undefined;
}
export declare function createFlowDHandler(): FlowDReferenceSearchHandler;
//# sourceMappingURL=flow-handler-design-references.d.ts.map