/**
 * Flow Composition System
 * Enables creation of composite flows that combine multiple base flows
 * Supports conditional execution, branching, and result-based flow selection
 */
import { FlowId } from './types';
import { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface ConditionContext {
    previousResult?: FlowExecutionResult;
    executionContext: FlowExecutionContext;
    executedFlows: Map<FlowId, FlowExecutionResult>;
}
export type StepCondition = (context: ConditionContext) => boolean;
export interface FlowCompositionStep {
    flowId: FlowId;
    skipOnError?: boolean;
    transformContext?: (context: FlowExecutionContext, previousResult: FlowExecutionResult) => FlowExecutionContext;
    condition?: StepCondition;
    branches?: {
        onSuccess?: FlowId[];
        onError?: FlowId[];
        onSkipped?: FlowId[];
    };
    domainValidation?: DomainValidationConfig;
}
export interface CompositeFlowDefinition {
    id: string;
    name: string;
    description: string;
    steps: FlowCompositionStep[];
    aggregateResults?: boolean;
    failOnFirstError?: boolean;
}
export interface CompositeFlowResult {
    compositeFlowId: string;
    compositeFlowName: string;
    status: 'success' | 'partial' | 'error';
    message: string;
    stepsExecuted: number;
    stepResults: FlowExecutionResult[];
    aggregatedGuidance?: string[];
    aggregatedChecklist?: any[];
    totalExecutionTime: number;
}
export interface ResultInjectionConfig {
    injectFlowId?: boolean;
    injectFlowName?: boolean;
    injectGuidance?: boolean;
    injectChecklist?: boolean;
    injectArtifacts?: boolean;
    injectMetrics?: boolean;
    customKey?: string;
}
export interface ValidationRule {
    name: string;
    description: string;
    validate: (result: FlowExecutionResult) => boolean;
}
export interface DomainValidator {
    domain: string;
    rules: ValidationRule[];
    failOnFirstError?: boolean;
}
export interface ValidationResult {
    domain: string;
    status: 'pass' | 'fail' | 'partial';
    passedRules: string[];
    failedRules: string[];
    message: string;
}
export interface DomainValidationConfig {
    domains: string[];
    failOnError?: boolean;
}
export declare class FlowCompositionEngine {
    private compositeFlows;
    private executedFlows;
    private domainValidators;
    /**
     * Register a composite flow definition
     */
    registerCompositeFlow(definition: CompositeFlowDefinition): void;
    /**
     * Get a registered composite flow
     */
    getCompositeFlow(id: string): CompositeFlowDefinition | null;
    /**
     * List all registered composite flows
     */
    listCompositeFlows(): CompositeFlowDefinition[];
    /**
     * Evaluate a step condition
     */
    evaluateCondition(step: FlowCompositionStep, context: ConditionContext): boolean;
    /**
     * Check if a flow should be skipped based on its condition
     */
    shouldSkipStep(step: FlowCompositionStep, context: ConditionContext): boolean;
    /**
     * Get branching flows based on previous result
     */
    getBranchingFlows(step: FlowCompositionStep, previousResult: FlowExecutionResult): FlowId[];
    /**
     * Record executed flow for condition context
     */
    recordExecutedFlow(flowId: FlowId, result: FlowExecutionResult): void;
    /**
     * Get all executed flows
     */
    getExecutedFlows(): Map<FlowId, FlowExecutionResult>;
    /**
     * Reset execution state
     */
    resetExecutionState(): void;
    /**
     * Register a domain validator
     */
    registerDomainValidator(validator: DomainValidator): void;
    /**
     * Get a domain validator
     */
    getDomainValidator(domain: string): DomainValidator | null;
    /**
     * Validate result against a specific domain
     */
    validateResult(domain: string, result: FlowExecutionResult): ValidationResult;
    /**
     * Validate result against multiple domains
     */
    validateMultipleDomains(domains: string[], result: FlowExecutionResult): ValidationResult[];
    /**
     * Check if all validations passed
     */
    static allValidationsPassed(validations: ValidationResult[]): boolean;
    /**
     * Create a validation rule factory
     */
    static createValidationRule(name: string, description: string, validate: (result: FlowExecutionResult) => boolean): ValidationRule;
    /**
     * Create a domain validator with rules
     */
    static createDomainValidator(domain: string, rules: ValidationRule[], failOnFirstError?: boolean): DomainValidator;
    /**
     * Inject flow result into execution context metadata
     */
    static injectResultIntoContext(context: FlowExecutionContext, result: FlowExecutionResult, config?: ResultInjectionConfig): FlowExecutionContext;
    /**
     * Intelligent context transformation based on result content
     */
    static intelligentContextTransform(context: FlowExecutionContext, result: FlowExecutionResult): FlowExecutionContext;
    /**
     * Create a dynamic context transformer based on result properties
     */
    static createConditionalTransformer(shouldTransform: (result: FlowExecutionResult) => boolean, transform: (context: FlowExecutionContext, result: FlowExecutionResult) => FlowExecutionContext): (context: FlowExecutionContext, result: FlowExecutionResult) => FlowExecutionContext;
    /**
     * Merge results from multiple flows into context for later reference
     */
    static accumulateResultsInContext(context: FlowExecutionContext, results: FlowExecutionResult[]): FlowExecutionContext;
    /**
     * Aggregate results from multiple flows
     */
    static aggregateResults(results: FlowExecutionResult[]): {
        guidance: string[];
        checklist: any[];
        artifacts: any[];
    };
    /**
     * Transform context based on previous flow result
     */
    static propagateContext(currentContext: FlowExecutionContext, previousResult: FlowExecutionResult): FlowExecutionContext;
    /**
     * Create a condition that requires a specific flow to have succeeded
     */
    static requireFlowSuccess(flowId: FlowId): StepCondition;
    /**
     * Create a condition that requires previous flow to have specific status
     */
    static requirePreviousStatus(status: 'success' | 'error' | 'skipped'): StepCondition;
    /**
     * Create a condition that checks for specific guidance content
     */
    static requireGuidanceContains(pattern: string): StepCondition;
    /**
     * Create an OR condition combining multiple conditions
     */
    static anyOf(...conditions: StepCondition[]): StepCondition;
    /**
     * Create an AND condition combining multiple conditions
     */
    static allOf(...conditions: StepCondition[]): StepCondition;
    /**
     * Build a composite flow for a common workflow
     */
    static buildResearchToImplementationFlow(): CompositeFlowDefinition;
    /**
     * Build a composite flow for QA
     */
    static buildQAWorkflow(): CompositeFlowDefinition;
    /**
     * Build a composite flow for optimization
     */
    static buildOptimizationFlow(): CompositeFlowDefinition;
    /**
     * "Craft a landing page" - the headline composite for Sidecoach v2.
     * Chains: brand verify -> composition -> tokens -> copywriting -> component -> motion -> polish -> audit -> all-seven QA gate.
     */
    static buildCraftLandingPageFlow(): CompositeFlowDefinition;
}
/**
 * Pre-built composite flows for common workflows
 */
export declare const PRESET_COMPOSITE_FLOWS: CompositeFlowDefinition[];
//# sourceMappingURL=flow-composition.d.ts.map