import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface MotionPatternContext {
    motionDomainRules: string[];
    easingCurves: {
        name: string;
        intensity: 'restrained' | 'playful' | 'ambitious';
        easing: string;
        duration: number;
        useCase: string;
    }[];
    reducedMotionStrategies: string[];
    validationResults: {
        patternName: string;
        hasReducedMotion: boolean;
        durationApropriate: boolean;
        easingExpOnential: boolean;
    }[];
}
export declare class FlowEMotionPatternsHandler extends BaseFlowHandler {
    private motionRef;
    private cachedMotionContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): MotionPatternContext | undefined;
}
export declare function createFlowEHandler(): FlowEMotionPatternsHandler;
//# sourceMappingURL=flow-handler-motion-patterns.d.ts.map