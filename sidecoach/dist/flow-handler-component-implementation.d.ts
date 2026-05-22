import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
interface ComponentImplementationContext {
    interactionDomainRules: string[];
    writingDomainRules: string[];
    componentStates: string[];
    validationResults: {
        stateName: string;
        hasAriaLabels: boolean;
        hasKeyboardInteraction: boolean;
        copyAppropriateness: boolean;
    }[];
}
export declare class FlowGComponentImplementationHandler extends BaseFlowHandler {
    private cachedComponentContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): ComponentImplementationContext | undefined;
}
export declare function createFlowGHandler(): FlowGComponentImplementationHandler;
export {};
//# sourceMappingURL=flow-handler-component-implementation.d.ts.map