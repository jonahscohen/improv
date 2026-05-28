import { FlowExecutionContext } from './flow-handler';
import { FlowId } from './types';
export interface ExecutionCondition {
    name: string;
    description: string;
    evaluate: (context: FlowExecutionContext) => boolean;
}
export interface ConditionalFlowRoute {
    flowId: FlowId;
    conditions: ExecutionCondition[];
    skipIfConditionFails: boolean;
    alternativeFlow?: FlowId;
}
export declare class FlowConditionalRouter {
    static hasDesignTokens(context: FlowExecutionContext): boolean;
    static hasComponentLibrary(context: FlowExecutionContext): boolean;
    static hasColorSystem(context: FlowExecutionContext): boolean;
    static hasTypographySystem(context: FlowExecutionContext): boolean;
    static hasSpacingSystem(context: FlowExecutionContext): boolean;
    static hasAccessibilityChecks(context: FlowExecutionContext): boolean;
    static isResearchPhase(context: FlowExecutionContext): boolean;
    static isImplementationPhase(context: FlowExecutionContext): boolean;
    static isQAPhase(context: FlowExecutionContext): boolean;
    static flowHasExecuted(context: FlowExecutionContext, flowId: FlowId): boolean;
    static allPrerequisitesComplete(context: FlowExecutionContext, prerequisites: FlowId[]): boolean;
    static hasEndowTool(context: FlowExecutionContext): boolean;
    static hasFigmaAccess(context: FlowExecutionContext): boolean;
    static canAccessComponentGallery(context: FlowExecutionContext): boolean;
    static determineRoute(context: FlowExecutionContext): FlowId | null;
    static buildConditionalRoutes(): ConditionalFlowRoute[];
    static evaluateRouteConditions(context: FlowExecutionContext, route: ConditionalFlowRoute): boolean;
    static getExecutablePath(context: FlowExecutionContext): FlowId[];
}
export declare function determineConditionalFlow(context: FlowExecutionContext): FlowId | null;
export declare function getExecutablePath(context: FlowExecutionContext): FlowId[];
//# sourceMappingURL=flow-conditional-router.d.ts.map