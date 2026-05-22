import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { ProjectContext, Register } from './project-context';
export interface BrandVerificationContext {
    projectContext: ProjectContext;
    registerDetected: Register;
    designLawsCached: string[];
    productMetadata: Record<string, any>;
    designMetadata: Record<string, any>;
}
export declare class FlowABrandVerifyHandler extends BaseFlowHandler {
    private contextLoader;
    private cachedBrandContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): BrandVerificationContext | undefined;
    private cacheDesignLawsForRegister;
    private runPreflight;
}
export declare let flowAInstance: FlowABrandVerifyHandler | null;
export declare function getFlowAInstance(): FlowABrandVerifyHandler;
export declare function createFlowAHandler(): FlowABrandVerifyHandler;
//# sourceMappingURL=flow-handler-brand-verify.d.ts.map