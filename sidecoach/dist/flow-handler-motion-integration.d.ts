import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
interface MotionIntegrationContext {
    motionDomainRules: string[];
    motionIntensity: 'restrained' | 'playful' | 'ambitious';
    animationTemplates: {
        category: string;
        duration: number;
        easing: string;
        useCase: string;
    }[];
    validationResults: {
        pattern: string;
        durationCompliant: boolean;
        easingCompliant: boolean;
        noLayoutAnimation: boolean;
        reducedMotionSupport: boolean;
    }[];
}
export declare class FlowHMotionIntegrationHandler extends BaseFlowHandler {
    private cachedMotionContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): MotionIntegrationContext | undefined;
}
export declare function createFlowHHandler(): FlowHMotionIntegrationHandler;
export {};
//# sourceMappingURL=flow-handler-motion-integration.d.ts.map