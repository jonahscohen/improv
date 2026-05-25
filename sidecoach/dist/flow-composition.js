"use strict";
/**
 * Flow Composition System
 * Enables creation of composite flows that combine multiple base flows
 * Supports conditional execution, branching, and result-based flow selection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_COMPOSITE_FLOWS = exports.FlowCompositionEngine = void 0;
class FlowCompositionEngine {
    constructor() {
        this.compositeFlows = new Map();
        this.executedFlows = new Map();
        this.domainValidators = new Map();
    }
    /**
     * Register a composite flow definition
     */
    registerCompositeFlow(definition) {
        this.compositeFlows.set(definition.id, definition);
    }
    /**
     * Get a registered composite flow
     */
    getCompositeFlow(id) {
        return this.compositeFlows.get(id) || null;
    }
    /**
     * List all registered composite flows
     */
    listCompositeFlows() {
        return Array.from(this.compositeFlows.values());
    }
    /**
     * Evaluate a step condition
     */
    evaluateCondition(step, context) {
        if (!step.condition)
            return true;
        return step.condition(context);
    }
    /**
     * Check if a flow should be skipped based on its condition
     */
    shouldSkipStep(step, context) {
        if (!step.condition)
            return false;
        return !this.evaluateCondition(step, context);
    }
    /**
     * Get branching flows based on previous result
     */
    getBranchingFlows(step, previousResult) {
        if (!step.branches)
            return [];
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
    recordExecutedFlow(flowId, result) {
        this.executedFlows.set(flowId, result);
    }
    /**
     * Get all executed flows
     */
    getExecutedFlows() {
        return this.executedFlows;
    }
    /**
     * Reset execution state
     */
    resetExecutionState() {
        this.executedFlows.clear();
    }
    /**
     * Register a domain validator
     */
    registerDomainValidator(validator) {
        this.domainValidators.set(validator.domain, validator);
    }
    /**
     * Get a domain validator
     */
    getDomainValidator(domain) {
        return this.domainValidators.get(domain) || null;
    }
    /**
     * Validate result against a specific domain
     */
    validateResult(domain, result) {
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
        const passedRules = [];
        const failedRules = [];
        for (const rule of validator.rules) {
            try {
                if (rule.validate(result)) {
                    passedRules.push(rule.name);
                }
                else {
                    failedRules.push(rule.name);
                    if (validator.failOnFirstError)
                        break;
                }
            }
            catch (error) {
                failedRules.push(rule.name);
                if (validator.failOnFirstError)
                    break;
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
    validateMultipleDomains(domains, result) {
        return domains.map(domain => this.validateResult(domain, result));
    }
    /**
     * Check if all validations passed
     */
    static allValidationsPassed(validations) {
        return validations.every(v => v.status === 'pass');
    }
    /**
     * Create a validation rule factory
     */
    static createValidationRule(name, description, validate) {
        return { name, description, validate };
    }
    /**
     * Create a domain validator with rules
     */
    static createDomainValidator(domain, rules, failOnFirstError = false) {
        return { domain, rules, failOnFirstError };
    }
    /**
     * Inject flow result into execution context metadata
     */
    static injectResultIntoContext(context, result, config = {}) {
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
    static intelligentContextTransform(context, result) {
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
    static createConditionalTransformer(shouldTransform, transform) {
        return (context, result) => {
            if (shouldTransform(result)) {
                return transform(context, result);
            }
            return context;
        };
    }
    /**
     * Merge results from multiple flows into context for later reference
     */
    static accumulateResultsInContext(context, results) {
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
    static aggregateResults(results) {
        const guidance = [];
        const checklist = [];
        const artifacts = [];
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
        const uniqueArtifacts = artifacts.filter((art, idx, arr) => arr.findIndex((a) => a.id === art.id) === idx);
        return {
            guidance: uniqueGuidance,
            checklist,
            artifacts: uniqueArtifacts,
        };
    }
    /**
     * Transform context based on previous flow result
     */
    static propagateContext(currentContext, previousResult) {
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
    static requireFlowSuccess(flowId) {
        return (context) => {
            const result = context.executedFlows.get(flowId);
            return result ? result.status === 'success' : false;
        };
    }
    /**
     * Create a condition that requires previous flow to have specific status
     */
    static requirePreviousStatus(status) {
        return (context) => {
            return context.previousResult ? context.previousResult.status === status : false;
        };
    }
    /**
     * Create a condition that checks for specific guidance content
     */
    static requireGuidanceContains(pattern) {
        return (context) => {
            if (!context.previousResult?.guidance)
                return false;
            return context.previousResult.guidance.some(g => g.includes(pattern));
        };
    }
    /**
     * Create an OR condition combining multiple conditions
     */
    static anyOf(...conditions) {
        return (context) => {
            return conditions.some(cond => cond(context));
        };
    }
    /**
     * Create an AND condition combining multiple conditions
     */
    static allOf(...conditions) {
        return (context) => {
            return conditions.every(cond => cond(context));
        };
    }
    /**
     * Build a composite flow for a common workflow
     */
    static buildResearchToImplementationFlow() {
        return {
            id: 'composite_research_to_impl',
            name: 'Research to Implementation',
            description: 'Complete workflow from design research to component implementation',
            steps: [
                { flowId: 'flowA_brand_verify' },
                { flowId: 'flowB_component_research' },
                { flowId: 'flowC_font_research' },
                { flowId: 'flowD_reference_inspiration', skipOnError: true },
                { flowId: 'flowE_motion_patterns' },
                { flowId: 'flowF_design_tokens' },
                { flowId: 'flowG_component_implementation' },
                { flowId: 'flowH_motion_integration' },
                { flowId: 'flowI_accessibility' },
            ],
            aggregateResults: true,
            failOnFirstError: false,
        };
    }
    /**
     * Build a composite flow for QA
     */
    static buildQAWorkflow() {
        return {
            id: 'composite_qa_workflow',
            name: 'Quality Assurance Workflow',
            description: 'Complete QA pass with audit, critique, and validation',
            steps: [
                { flowId: 'flowK_multi_lens_audit' },
                { flowId: 'flowL_design_critique', skipOnError: true },
                { flowId: 'flowM_responsive_validation' },
                { flowId: 'flowV_all_seven_qa' },
            ],
            aggregateResults: true,
            failOnFirstError: false,
        };
    }
    /**
     * Build a composite flow for optimization
     */
    static buildOptimizationFlow() {
        return {
            id: 'composite_optimization',
            name: 'Complete Optimization Pass',
            description: 'Apply all optimization and enhancement flows',
            steps: [
                { flowId: 'flowJ_tactical_polish', skipOnError: true },
                { flowId: 'flowR_layout_optimization', skipOnError: true },
                { flowId: 'flowS_typography_excellence', skipOnError: true },
                { flowId: 'flowT_ambitious_motion', skipOnError: true },
                { flowId: 'flowN_rapid_iteration_refined', skipOnError: true },
            ],
            aggregateResults: true,
            failOnFirstError: false,
        };
    }
    /**
     * "Craft a landing page" - the headline composite for Sidecoach v2.
     * Chains: brand verify -> composition -> tokens -> copywriting -> component -> motion -> polish -> audit -> all-seven QA gate.
     */
    static buildCraftLandingPageFlow() {
        return {
            id: 'composite_craft_landing_page',
            name: 'Craft a landing page',
            description: 'End-to-end landing page flow: composition, tokens, copy, component, motion, polish, audit, QA gate',
            steps: [
                { flowId: 'flowA_brand_verify', skipOnError: true },
                { flowId: 'flowW_landing_composition' },
                { flowId: 'flowF_design_tokens' },
                { flowId: 'flowX_copywriting' },
                { flowId: 'flowG_component_implementation' },
                { flowId: 'flowH_motion_integration', skipOnError: true },
                { flowId: 'flowJ_tactical_polish', skipOnError: true },
                { flowId: 'flowK_multi_lens_audit', skipOnError: true },
                { flowId: 'flowV_all_seven_qa', skipOnError: true },
            ],
            aggregateResults: true,
            failOnFirstError: false,
        };
    }
}
exports.FlowCompositionEngine = FlowCompositionEngine;
/**
 * Pre-built composite flows for common workflows
 */
exports.PRESET_COMPOSITE_FLOWS = [
    FlowCompositionEngine.buildResearchToImplementationFlow(),
    FlowCompositionEngine.buildQAWorkflow(),
    FlowCompositionEngine.buildOptimizationFlow(),
    FlowCompositionEngine.buildCraftLandingPageFlow(),
];
//# sourceMappingURL=flow-composition.js.map