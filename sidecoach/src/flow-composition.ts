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
  skipOnError?: boolean; // continue if this flow fails
  transformContext?: (context: FlowExecutionContext, previousResult: FlowExecutionResult) => FlowExecutionContext;
  condition?: StepCondition; // optional: only execute if condition is true
  branches?: {
    onSuccess?: FlowId[]; // flows to execute if this flow succeeds
    onError?: FlowId[]; // flows to execute if this flow fails
    onSkipped?: FlowId[]; // flows to execute if this flow is skipped
  };
  domainValidation?: DomainValidationConfig; // optional: validate result against domain rules
}

export interface CompositeFlowDefinition {
  id: string;
  name: string;
  description: string;
  steps: FlowCompositionStep[];
  aggregateResults?: boolean; // combine all results into one
  failOnFirstError?: boolean; // stop execution if any flow fails
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
  injectFlowId?: boolean; // Add flowId to metadata
  injectFlowName?: boolean; // Add flowName to metadata
  injectGuidance?: boolean; // Add guidance array to metadata
  injectChecklist?: boolean; // Add checklist to metadata
  injectArtifacts?: boolean; // Add artifacts to metadata
  injectMetrics?: boolean; // Add execution metrics (status, time)
  customKey?: string; // Custom metadata key to nest result under
}

export interface ValidationRule {
  name: string;
  description: string;
  validate: (result: FlowExecutionResult) => boolean;
}

export interface DomainValidator {
  domain: string;
  rules: ValidationRule[];
  failOnFirstError?: boolean; // stop validation on first failure
}

export interface ValidationResult {
  domain: string;
  status: 'pass' | 'fail' | 'partial';
  passedRules: string[];
  failedRules: string[];
  message: string;
}

export interface DomainValidationConfig {
  domains: string[]; // domains to validate against
  failOnError?: boolean; // stop composition if validation fails
}

export class FlowCompositionEngine {
  private compositeFlows: Map<string, CompositeFlowDefinition> = new Map();
  private executedFlows: Map<FlowId, FlowExecutionResult> = new Map();
  private domainValidators: Map<string, DomainValidator> = new Map();

  /**
   * Register a composite flow definition
   */
  registerCompositeFlow(definition: CompositeFlowDefinition): void {
    this.compositeFlows.set(definition.id, definition);
  }

  /**
   * Get a registered composite flow
   */
  getCompositeFlow(id: string): CompositeFlowDefinition | null {
    return this.compositeFlows.get(id) || null;
  }

  /**
   * List all registered composite flows
   */
  listCompositeFlows(): CompositeFlowDefinition[] {
    return Array.from(this.compositeFlows.values());
  }

  /**
   * Evaluate a step condition
   */
  evaluateCondition(step: FlowCompositionStep, context: ConditionContext): boolean {
    if (!step.condition) return true;
    return step.condition(context);
  }

  /**
   * Check if a flow should be skipped based on its condition
   */
  shouldSkipStep(step: FlowCompositionStep, context: ConditionContext): boolean {
    if (!step.condition) return false;
    return !this.evaluateCondition(step, context);
  }

  /**
   * Get branching flows based on previous result
   */
  getBranchingFlows(step: FlowCompositionStep, previousResult: FlowExecutionResult): FlowId[] {
    if (!step.branches) return [];

    if (previousResult.status === 'success' && step.branches.onSuccess) {
      return step.branches.onSuccess;
    }
    if (previousResult.status === 'error' && step.branches.onError) {
      return step.branches.onError;
    }
    if (previousResult.status === 'skipped' && step.branches.onSkipped) {
      return step.branches.onSkipped;
    }

    return [];
  }

  /**
   * Record executed flow for condition context
   */
  recordExecutedFlow(flowId: FlowId, result: FlowExecutionResult): void {
    this.executedFlows.set(flowId, result);
  }

  /**
   * Get all executed flows
   */
  getExecutedFlows(): Map<FlowId, FlowExecutionResult> {
    return this.executedFlows;
  }

  /**
   * Reset execution state
   */
  resetExecutionState(): void {
    this.executedFlows.clear();
  }

  /**
   * Register a domain validator
   */
  registerDomainValidator(validator: DomainValidator): void {
    this.domainValidators.set(validator.domain, validator);
  }

  /**
   * Get a domain validator
   */
  getDomainValidator(domain: string): DomainValidator | null {
    return this.domainValidators.get(domain) || null;
  }

  /**
   * Validate result against a specific domain
   */
  validateResult(domain: string, result: FlowExecutionResult): ValidationResult {
    const validator = this.getDomainValidator(domain);
    if (!validator) {
      return {
        domain,
        status: 'pass',
        passedRules: [],
        failedRules: [],
        message: `No validator registered for domain: ${domain}`,
      };
    }

    const passedRules: string[] = [];
    const failedRules: string[] = [];

    for (const rule of validator.rules) {
      try {
        if (rule.validate(result)) {
          passedRules.push(rule.name);
        } else {
          failedRules.push(rule.name);
          if (validator.failOnFirstError) break;
        }
      } catch (error) {
        failedRules.push(rule.name);
        if (validator.failOnFirstError) break;
      }
    }

    const status = failedRules.length === 0 ? 'pass' : failedRules.length === validator.rules.length ? 'fail' : 'partial';

    return {
      domain,
      status,
      passedRules,
      failedRules,
      message: `Domain validation: ${passedRules.length}/${validator.rules.length} rules passed`,
    };
  }

  /**
   * Validate result against multiple domains
   */
  validateMultipleDomains(domains: string[], result: FlowExecutionResult): ValidationResult[] {
    return domains.map(domain => this.validateResult(domain, result));
  }

  /**
   * Check if all validations passed
   */
  static allValidationsPassed(validations: ValidationResult[]): boolean {
    return validations.every(v => v.status === 'pass');
  }

  /**
   * Create a validation rule factory
   */
  static createValidationRule(
    name: string,
    description: string,
    validate: (result: FlowExecutionResult) => boolean
  ): ValidationRule {
    return { name, description, validate };
  }

  /**
   * Create a domain validator with rules
   */
  static createDomainValidator(
    domain: string,
    rules: ValidationRule[],
    failOnFirstError: boolean = false
  ): DomainValidator {
    return { domain, rules, failOnFirstError };
  }

  /**
   * Inject flow result into execution context metadata
   */
  static injectResultIntoContext(
    context: FlowExecutionContext,
    result: FlowExecutionResult,
    config: ResultInjectionConfig = {}
  ): FlowExecutionContext {
    const injected = { ...context };
    const metadata = { ...injected.metadata };

    // Determine where to nest the injected result
    const targetKey = config.customKey || 'previousFlowResult';

    if (config.injectFlowId) {
      metadata[`${targetKey}_flowId`] = result.flowId;
    }
    if (config.injectFlowName) {
      metadata[`${targetKey}_flowName`] = result.flowName;
    }
    if (config.injectGuidance && result.guidance) {
      metadata[`${targetKey}_guidance`] = result.guidance;
    }
    if (config.injectChecklist && result.checklist) {
      metadata[`${targetKey}_checklist`] = result.checklist;
    }
    if (config.injectArtifacts && result.artifacts) {
      metadata[`${targetKey}_artifacts`] = result.artifacts;
    }
    if (config.injectMetrics) {
      metadata[`${targetKey}_status`] = result.status;
    }

    injected.metadata = metadata;
    return injected;
  }

  /**
   * Intelligent context transformation based on result content
   */
  static intelligentContextTransform(
    context: FlowExecutionContext,
    result: FlowExecutionResult
  ): FlowExecutionContext {
    const transformed = { ...context };
    const metadata = { ...transformed.metadata };

    // Inject all available result data with intelligent defaults
    metadata.previousFlowId = result.flowId;
    metadata.previousFlowName = result.flowName;
    metadata.previousFlowStatus = result.status;
    metadata.previousFlowMessage = result.message;

    // Inject guidance as array for conditional checks
    if (result.guidance && result.guidance.length > 0) {
      metadata.previousFlowGuidance = result.guidance;
      // Also add count for conditions that check "did this flow produce guidance?"
      metadata.previousFlowGuidanceCount = result.guidance.length;
    }

    // Inject checklist items for reference
    if (result.checklist && result.checklist.length > 0) {
      metadata.previousFlowChecklist = result.checklist;
      metadata.previousFlowChecklistCount = result.checklist.length;
    }

    // Inject artifacts for reference
    if (result.artifacts && result.artifacts.length > 0) {
      metadata.previousFlowArtifacts = result.artifacts;
      metadata.previousFlowArtifactCount = result.artifacts.length;
    }

    transformed.metadata = metadata;
    return transformed;
  }

  /**
   * Create a dynamic context transformer based on result properties
   */
  static createConditionalTransformer(
    shouldTransform: (result: FlowExecutionResult) => boolean,
    transform: (context: FlowExecutionContext, result: FlowExecutionResult) => FlowExecutionContext
  ) {
    return (context: FlowExecutionContext, result: FlowExecutionResult) => {
      if (shouldTransform(result)) {
        return transform(context, result);
      }
      return context;
    };
  }

  /**
   * Merge results from multiple flows into context for later reference
   */
  static accumulateResultsInContext(
    context: FlowExecutionContext,
    results: FlowExecutionResult[]
  ): FlowExecutionContext {
    const accumulated = { ...context };
    const metadata = { ...accumulated.metadata };

    // Initialize results array if needed
    if (!Array.isArray(metadata.accumulatedResults)) {
      metadata.accumulatedResults = [];
    }

    // Add new results
    metadata.accumulatedResults = [
      ...metadata.accumulatedResults,
      ...results.map(r => ({
        flowId: r.flowId,
        flowName: r.flowName,
        status: r.status,
      }))
    ];

    // Track total successful/failed/skipped flows (accumulate, don't replace)
    const currentSuccessful = metadata.successfulFlowCount || 0;
    const currentFailed = metadata.failedFlowCount || 0;
    const currentSkipped = metadata.skippedFlowCount || 0;

    metadata.successfulFlowCount = currentSuccessful + results.filter(r => r.status === 'success').length;
    metadata.failedFlowCount = currentFailed + results.filter(r => r.status === 'error').length;
    metadata.skippedFlowCount = currentSkipped + results.filter(r => r.status === 'skipped').length;

    accumulated.metadata = metadata;
    return accumulated;
  }

  /**
   * Aggregate results from multiple flows
   */
  static aggregateResults(results: FlowExecutionResult[]): {
    guidance: string[];
    checklist: any[];
    artifacts: any[];
  } {
    const guidance: string[] = [];
    const checklist: any[] = [];
    const artifacts: any[] = [];

    for (const result of results) {
      if (result.guidance) {
        guidance.push(...result.guidance);
      }
      if (result.checklist) {
        checklist.push(...result.checklist);
      }
      if (result.artifacts) {
        artifacts.push(...result.artifacts);
      }
    }

    // Remove duplicates
    const uniqueGuidance = [...new Set(guidance)];
    const uniqueArtifacts = artifacts.filter(
      (art, idx, arr) => arr.findIndex((a) => a.id === art.id) === idx
    );

    return {
      guidance: uniqueGuidance,
      checklist,
      artifacts: uniqueArtifacts,
    };
  }

  /**
   * Transform context based on previous flow result
   */
  static propagateContext(
    currentContext: FlowExecutionContext,
    previousResult: FlowExecutionResult
  ): FlowExecutionContext {
    return {
      ...currentContext,
      metadata: {
        ...currentContext.metadata,
        previousFlowId: previousResult.flowId,
        previousFlowStatus: previousResult.status,
        previousFlowMessage: previousResult.message,
      },
    };
  }

  /**
   * Create a condition that requires a specific flow to have succeeded
   */
  static requireFlowSuccess(flowId: FlowId): StepCondition {
    return (context: ConditionContext) => {
      const result = context.executedFlows.get(flowId);
      return result ? result.status === 'success' : false;
    };
  }

  /**
   * Create a condition that requires previous flow to have specific status
   */
  static requirePreviousStatus(status: 'success' | 'error' | 'skipped'): StepCondition {
    return (context: ConditionContext) => {
      return context.previousResult ? context.previousResult.status === status : false;
    };
  }

  /**
   * Create a condition that checks for specific guidance content
   */
  static requireGuidanceContains(pattern: string): StepCondition {
    return (context: ConditionContext) => {
      if (!context.previousResult?.guidance) return false;
      return context.previousResult.guidance.some(g => g.includes(pattern));
    };
  }

  /**
   * Create an OR condition combining multiple conditions
   */
  static anyOf(...conditions: StepCondition[]): StepCondition {
    return (context: ConditionContext) => {
      return conditions.some(cond => cond(context));
    };
  }

  /**
   * Create an AND condition combining multiple conditions
   */
  static allOf(...conditions: StepCondition[]): StepCondition {
    return (context: ConditionContext) => {
      return conditions.every(cond => cond(context));
    };
  }

  /**
   * Build a composite flow for a common workflow
   */
  static buildResearchToImplementationFlow(): CompositeFlowDefinition {
    return {
      id: 'composite_research_to_impl',
      name: 'Research to Implementation',
      description: 'Complete workflow from design research to component implementation',
      steps: [
        { flowId: 'flowA_brand_verify' as FlowId },
        { flowId: 'flowB_component_research' as FlowId },
        { flowId: 'flowC_font_research' as FlowId },
        { flowId: 'flowD_reference_inspiration' as FlowId, skipOnError: true },
        { flowId: 'flowE_motion_patterns' as FlowId },
        { flowId: 'flowF_design_tokens' as FlowId },
        { flowId: 'flowG_component_implementation' as FlowId },
        { flowId: 'flowH_motion_integration' as FlowId },
        { flowId: 'flowI_accessibility' as FlowId },
      ],
      aggregateResults: true,
      failOnFirstError: false,
    };
  }

  /**
   * Build a composite flow for QA
   */
  static buildQAWorkflow(): CompositeFlowDefinition {
    return {
      id: 'composite_qa_workflow',
      name: 'Quality Assurance Workflow',
      description: 'Complete QA pass with audit, critique, and validation',
      steps: [
        { flowId: 'flowK_multi_lens_audit' as FlowId },
        { flowId: 'flowL_design_critique' as FlowId, skipOnError: true },
        { flowId: 'flowM_responsive_validation' as FlowId },
        { flowId: 'flowV_all_seven_qa' as FlowId },
      ],
      aggregateResults: true,
      failOnFirstError: false,
    };
  }

  /**
   * Build a composite flow for optimization
   */
  static buildOptimizationFlow(): CompositeFlowDefinition {
    return {
      id: 'composite_optimization',
      name: 'Complete Optimization Pass',
      description: 'Apply all optimization and enhancement flows',
      steps: [
        { flowId: 'flowJ_tactical_polish' as FlowId, skipOnError: true },
        { flowId: 'flowR_layout_optimization' as FlowId, skipOnError: true },
        { flowId: 'flowS_typography_excellence' as FlowId, skipOnError: true },
        { flowId: 'flowT_ambitious_motion' as FlowId, skipOnError: true },
        { flowId: 'flowN_rapid_iteration_refined' as FlowId, skipOnError: true },
      ],
      aggregateResults: true,
      failOnFirstError: false,
    };
  }

  /**
   * "Craft a landing page" - the headline composite for Sidecoach v2.
   * Chains: brand verify -> composition -> tokens -> copywriting -> component -> motion -> polish -> audit -> all-seven QA gate.
   */
  static buildCraftLandingPageFlow(): CompositeFlowDefinition {
    return {
      id: 'composite_craft_landing_page',
      name: 'Craft a landing page',
      description: 'End-to-end landing page flow: composition, tokens, copy, component, motion, polish, audit, QA gate',
      steps: [
        { flowId: 'flowA_brand_verify' as FlowId, skipOnError: true },
        { flowId: 'flowW_landing_composition' as FlowId },
        { flowId: 'flowF_design_tokens' as FlowId },
        { flowId: 'flowX_copywriting' as FlowId },
        { flowId: 'flowG_component_implementation' as FlowId },
        { flowId: 'flowH_motion_integration' as FlowId, skipOnError: true },
        { flowId: 'flowJ_tactical_polish' as FlowId, skipOnError: true },
        { flowId: 'flowK_multi_lens_audit' as FlowId, skipOnError: true },
        { flowId: 'flowV_all_seven_qa' as FlowId, skipOnError: true },
      ],
      aggregateResults: true,
      failOnFirstError: false,
    };
  }
}

/**
 * Pre-built composite flows for common workflows
 */
export const PRESET_COMPOSITE_FLOWS = [
  FlowCompositionEngine.buildResearchToImplementationFlow(),
  FlowCompositionEngine.buildQAWorkflow(),
  FlowCompositionEngine.buildOptimizationFlow(),
  FlowCompositionEngine.buildCraftLandingPageFlow(),
];
