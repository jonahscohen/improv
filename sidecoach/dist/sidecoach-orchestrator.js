"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowExecutionEngine = void 0;
exports.createExecutionEngine = createExecutionEngine;
const intent_detector_1 = require("./intent-detector");
const flows_1 = require("./flows");
const flow_history_1 = require("./flow-history");
const orchestrator_1 = require("./orchestrator");
const deterministic_validator_1 = require("./deterministic-validator");
const regression_detector_1 = require("./regression-detector");
const design_debt_tracker_1 = require("./design-debt-tracker");
const project_context_1 = require("./project-context");
const flow_handler_brand_verify_1 = require("./flow-handler-brand-verify");
const flow_handler_component_research_1 = require("./flow-handler-component-research");
const flow_handler_font_research_1 = require("./flow-handler-font-research");
const flow_handler_design_references_1 = require("./flow-handler-design-references");
const flow_handler_motion_patterns_1 = require("./flow-handler-motion-patterns");
const flow_handlers_core_1 = require("./flow-handlers-core");
const flow_handlers_extended_1 = require("./flow-handlers-extended");
const flow_handler_design_tokens_1 = require("./flow-handler-design-tokens");
const flow_handler_component_implementation_1 = require("./flow-handler-component-implementation");
const flow_handler_motion_integration_1 = require("./flow-handler-motion-integration");
const flow_handler_accessibility_1 = require("./flow-handler-accessibility");
const flow_handlers_tier3_tier4_1 = require("./flow-handlers-tier3-tier4");
const flow_handlers_tier5_specialized_1 = require("./flow-handlers-tier5-specialized");
const flow_handlers_curate_qa_1 = require("./flow-handlers-curate-qa");
class FlowExecutionEngine {
    constructor() {
        this.intentDetector = (0, intent_detector_1.createDetector)();
        this.handlers = new Map();
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        this.orchestrator = new orchestrator_1.SidecoachOrchestrator(flowHistory);
        this.initializeHandlers();
    }
    initializeHandlers() {
        // Register all flow handlers with their implementations
        const handlerMap = [
            // Tier 1: Strategy/Research
            ['flowA_brand_verify', () => new flow_handler_brand_verify_1.FlowABrandVerifyHandler()],
            ['flowB_component_research', () => new flow_handler_component_research_1.FlowBComponentResearchHandler()],
            ['flowC_font_research', () => new flow_handler_font_research_1.FlowCFontResearchHandler()],
            ['flowD_reference_inspiration', () => new flow_handler_design_references_1.FlowDReferenceSearchHandler()],
            ['flowE_motion_patterns', () => new flow_handler_motion_patterns_1.FlowEMotionPatternsHandler()],
            // Tier 2: Execution
            ['flowF_design_tokens', () => new flow_handler_design_tokens_1.FlowFDesignTokensHandler()],
            ['flowG_component_implementation', () => new flow_handler_component_implementation_1.FlowGComponentImplementationHandler()],
            ['flowH_motion_integration', () => new flow_handler_motion_integration_1.FlowHMotionIntegrationHandler()],
            ['flowI_accessibility', () => new flow_handler_accessibility_1.FlowIAccessibilityHandler()],
            // Tier 3: Polish/QA
            ['flowJ_tactical_polish', () => new flow_handlers_tier3_tier4_1.FlowJTacticalPolishHandler()],
            ['flowK_multi_lens_audit', () => new flow_handlers_tier3_tier4_1.FlowKMultiLensAuditHandler()],
            ['flowL_design_critique', () => new flow_handlers_tier3_tier4_1.FlowLDesignCritiqueHandler()],
            ['flowM_responsive_validation', () => new flow_handlers_tier3_tier4_1.FlowMResponsiveValidationHandler()],
            ['flowN_rapid_iteration_refined', () => new flow_handlers_tier3_tier4_1.FlowNRapidIterationHandler()],
            // Tier 4: Special
            ['flowO_clone_match_special', () => new flow_handlers_tier3_tier4_1.FlowOCloneMatchHandler()],
            ['flowP_constraint_design_special', () => new flow_handlers_tier3_tier4_1.FlowPConstraintDesignHandler()],
            ['flowQ_migration_special', () => new flow_handlers_tier3_tier4_1.FlowQMigrationHandler()],
            // Tier 5: Specialized refinement (NEW - impeccable v2.1.9 coverage)
            ['flowR_layout_optimization', () => new flow_handlers_tier5_specialized_1.FlowRLayoutOptimizationHandler()],
            ['flowS_typography_excellence', () => new flow_handlers_tier5_specialized_1.FlowSTypographyExcellenceHandler()],
            ['flowT_ambitious_motion', () => new flow_handlers_tier5_specialized_1.FlowTAmbitiousMotionHandler()],
            // Special: Curate + All-Seven QA (addresses two concrete gaps)
            ['flowU_curate', () => new flow_handlers_curate_qa_1.FlowUCurateHandler()],
            ['flowV_all_seven_qa', () => new flow_handlers_curate_qa_1.FlowVAllSevenQAHandler()],
            // Legacy flows
            ['flow1_clone_match', () => new flow_handlers_extended_1.Flow1CloneHandler()],
            ['flow2_polish_enhance', () => new flow_handlers_core_1.Flow2PolishHandler()],
            ['flow3_audit_page', () => new flow_handlers_extended_1.Flow3AuditHandler()],
            ['flow4_explore_discovery', () => new flow_handlers_extended_1.Flow4ExploreHandler()],
            ['flow5_review_qa', () => new flow_handlers_core_1.Flow5ReviewHandler()],
            ['flow6_constraint_design', () => new flow_handlers_extended_1.Flow6ConstraintHandler()],
            ['flow7_design_component', () => new flow_handlers_core_1.Flow7DesignHandler()],
            ['flow8_refactor_layout', () => new flow_handlers_extended_1.Flow8RefactorHandler()],
            ['flow9_accessible', () => new flow_handlers_extended_1.Flow9AccessibleHandler()],
            ['flow10_implement_design', () => new flow_handlers_core_1.Flow10ImplementHandler()],
            ['flow11_extract_tokens', () => new flow_handlers_extended_1.Flow11ExtractHandler()],
            ['flow12_responsive_review', () => new flow_handlers_extended_1.Flow12ResponsiveHandler()],
            ['flow13_rapid_iteration', () => new flow_handlers_extended_1.Flow13IterateHandler()],
            ['flow14_migration', () => new flow_handlers_extended_1.Flow14MigrationHandler()],
        ];
        for (const [flowId, createHandler] of handlerMap) {
            this.handlers.set(flowId, createHandler());
        }
    }
    recordFlowWithMemory(result) {
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        const entry = {
            flowId: result.flowId,
            flowName: result.flowName,
            status: result.status,
            message: result.message,
            guidance: result.guidance,
            checklist: result.checklist,
            artifacts: result.artifacts,
            error: result.error,
        };
        // Merge memory data if present
        if (result.memory) {
            const memory = result.memory;
            entry.appliedRules = memory.appliedRules;
            entry.userDecisions = memory.userDecisions;
            entry.metrics = memory.metrics;
            entry.validationResults = memory.validationResults;
            entry.referencesUsed = memory.referencesUsed;
            entry.gates = memory.gates;
            entry.artifactProduced = memory.artifactProduced;
            entry.aiSlopDetection = memory.aiSlopDetection;
            entry.summary = memory.summary;
        }
        flowHistory.recordFlow(entry);
    }
    async process(utterance, context = {}) {
        // Step 1: Detect intent
        const detection = this.intentDetector.detect(utterance);
        // Handle no matches
        if (Array.isArray(detection.candidates) && detection.candidates.length === 0) {
            return {
                success: false,
                message: 'Could not understand your request. Please try rephrasing.',
                detectedFlow: null,
                flowResults: [],
            };
        }
        // Handle ambiguous matches
        if (detection.isAmbiguous && !detection.flowId) {
            const candidates = detection.candidates || [];
            return {
                success: false,
                message: 'Your request could match multiple flows. Please clarify.',
                detectedFlow: null,
                flowResults: [],
                ambiguousCandidates: candidates.map((c) => ({
                    flowId: c.flowId,
                    flowName: c.flowName,
                    confidence: c.confidence,
                })),
            };
        }
        // Get the matched flow (either from MatchResult or DisambiguationResult.recommendation)
        const match = detection.flowId
            ? detection
            : detection.recommendation;
        if (!match || !match.flowId) {
            return {
                success: false,
                message: 'Could not determine flow.',
                detectedFlow: null,
                flowResults: [],
            };
        }
        // Prepare execution context (shared across all flows in the chain)
        const executionContext = {
            utterance,
            userId: context.userId,
            projectPath: context.projectPath || process.cwd(),
            currentFile: context.currentFile,
            selectedText: context.selectedText,
            metadata: context.metadata,
        };
        // Execute flow chain: initial flow + any automatically recommended follow-ups
        const flowResults = [];
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        const validator = new deterministic_validator_1.DeterministicValidator();
        const debtTracker = new design_debt_tracker_1.DesignDebtTracker(executionContext.projectPath);
        // CRITICAL: Load and cache project context before Flow A execution
        // All downstream flows depend on register detection and cached design laws
        const contextLoader = new project_context_1.ContextLoader();
        const projectContext = contextLoader.load(executionContext.projectPath);
        executionContext.projectContext = projectContext;
        // Run Flow A to verify brand register and cache design laws
        const flowAHandler = new flow_handler_brand_verify_1.FlowABrandVerifyHandler();
        const flowAResult = await flowAHandler.execute(executionContext);
        flowResults.push(flowAResult);
        this.recordFlowWithMemory(flowAResult);
        // If Flow A failed, block the chain (context is mandatory)
        if (flowAResult.status !== 'success') {
            return {
                success: false,
                message: `Cannot proceed: Brand verification failed. ${flowAResult.message}`,
                detectedFlow: { flowId: match.flowId, flowName: match.flowName, confidence: match.confidence },
                flowResults,
            };
        }
        let currentFlowId = match.flowId;
        let firstFlow = true;
        while (currentFlowId) {
            // Get the handler for current flow
            const handler = this.handlers.get(currentFlowId);
            if (!handler) {
                if (firstFlow) {
                    return {
                        success: false,
                        message: `No handler found for flow: ${currentFlowId}`,
                        detectedFlow: { flowId: match.flowId, flowName: match.flowName, confidence: match.confidence },
                        flowResults,
                    };
                }
                break; // Stop chaining if handler not found for follow-up flow
            }
            // Get flow name for error handling
            const flowDef = (0, flows_1.getFlow)(currentFlowId);
            const flowName = flowDef?.name || 'Unknown';
            // Validate real prerequisites (DeterministicValidator: hard gates)
            const validation = validator.validate(currentFlowId, executionContext, flowHistory);
            // Auto-log warning violations as design debt (DesignDebtTracker)
            if (currentFlowId) {
                const flowIdForDebt = currentFlowId; // Type guard for TS
                validation.violations.forEach((violation) => {
                    if (violation.severity === 'warning' && violation.debtCandidate) {
                        debtTracker.addDebt({
                            ...violation.debtCandidate,
                            flowId: flowIdForDebt,
                        });
                    }
                });
            }
            if (!validation.valid) {
                // Prerequisites not met: skip this flow and stop chaining
                const skipResult = {
                    flowId: currentFlowId,
                    flowName,
                    status: 'skipped',
                    message: validation.message,
                };
                flowResults.push(skipResult);
                // Record skipped flow with violations
                flowHistory.recordFlow({
                    flowId: currentFlowId,
                    flowName,
                    status: 'skipped',
                    message: validation.message,
                    guidance: validation.violations.map((v) => `[${v.severity}] ${v.message}${v.fix ? ` - ${v.fix}` : ''}`),
                });
                break; // Stop chaining when prerequisites not met
            }
            // Check if handler can execute (revive canExecute validation)
            if (!handler.canExecute(executionContext)) {
                const skipResult = {
                    flowId: currentFlowId,
                    flowName,
                    status: 'skipped',
                    message: `Flow cannot execute: prerequisites not met for ${currentFlowId}`,
                };
                flowResults.push(skipResult);
                flowHistory.recordFlow({
                    flowId: currentFlowId,
                    flowName,
                    status: 'skipped',
                    message: skipResult.message,
                });
                break;
            }
            // Execute handler
            let result;
            try {
                result = await handler.execute(executionContext);
            }
            catch (error) {
                result = {
                    flowId: currentFlowId,
                    flowName,
                    status: 'error',
                    message: `Error executing flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
            // Check for regressions (RegressionDetector: compare against prior runs)
            const regressionDetector = new regression_detector_1.RegressionDetector();
            const regression = regressionDetector.compare(currentFlowId, result, flowHistory);
            if (regression.hasRegression) {
                const blockingRegressions = regression.regressions.filter((r) => r.severity === 'blocking');
                const warningRegressions = regression.regressions.filter((r) => r.severity === 'warning');
                if (blockingRegressions.length > 0) {
                    // Status regression: block the chain
                    result.status = 'error';
                    result.message = `${result.message}\n\n⚠️ REGRESSION DETECTED: ${regression.message}`;
                    // Break the chain on blocking regression
                    this.recordFlowWithMemory(result);
                    flowResults.push(result);
                    currentFlowId = undefined; // Stop chaining
                    break;
                }
                else if (warningRegressions.length > 0) {
                    // Guidance/checklist drops: warn but continue
                    const warningMessages = warningRegressions.map((w) => w.message).join('; ');
                    result.message = `${result.message}\n\n⚠️ Warning: ${warningMessages}`;
                }
            }
            // Record to FlowHistory (with memory data if available)
            this.recordFlowWithMemory(result);
            flowResults.push(result);
            // Determine next flow: if current flow succeeded, ask orchestrator for recommendation
            if (result.status === 'success') {
                currentFlowId = this.orchestrator.getNextRecommendedFlow(currentFlowId, result);
            }
            else if (result.status === 'needs_input' || result.status === 'error') {
                // Stop chaining on error or incomplete flow
                currentFlowId = undefined;
            }
            else {
                currentFlowId = undefined;
            }
            firstFlow = false;
        }
        // Build response with all flow results
        const combinedMessage = flowResults.map((r) => `[Flow: ${r.flowName}]\n${r.message}`).join('\n\n---\n\n');
        // Prepend open design debt summary if any (DesignDebtTracker session start)
        const debtSummary = debtTracker.getSummary();
        const finalMessage = debtSummary ? `${debtSummary}\n\n---\n\n${combinedMessage}` : combinedMessage;
        return {
            success: flowResults.some((r) => r.status === 'success'),
            message: finalMessage,
            detectedFlow: { flowId: match.flowId, flowName: match.flowName, confidence: match.confidence },
            flowResults,
            guidance: flowResults.flatMap((r) => r.guidance || []),
            checklist: flowResults.flatMap((r) => r.checklist || []),
            artifacts: flowResults.flatMap((r) => r.artifacts || []),
        };
    }
    registerHandler(handler) {
        this.handlers.set(handler.flowId, handler);
    }
    getAvailableFlows() {
        const flowIds = [
            // Tier 1: Strategy/Research
            'flowA_brand_verify',
            'flowB_component_research',
            'flowC_font_research',
            'flowD_reference_inspiration',
            'flowE_motion_patterns',
            // Tier 2: Execution
            'flowF_design_tokens',
            'flowG_component_implementation',
            'flowH_motion_integration',
            'flowI_accessibility',
            // Tier 3: Polish/QA
            'flowJ_tactical_polish',
            'flowK_multi_lens_audit',
            'flowL_design_critique',
            'flowM_responsive_validation',
            'flowN_rapid_iteration_refined',
            // Tier 4: Special
            'flowO_clone_match_special',
            'flowP_constraint_design_special',
            'flowQ_migration_special',
            // Tier 5: Specialized Refinement
            'flowR_layout_optimization',
            'flowS_typography_excellence',
            'flowT_ambitious_motion',
            // Special: Curate & QA
            'flowU_curate',
            'flowV_all_seven_qa',
            // Legacy flows
            'flow1_clone_match',
            'flow2_polish_enhance',
            'flow3_audit_page',
            'flow4_explore_discovery',
            'flow5_review_qa',
            'flow6_constraint_design',
            'flow7_design_component',
            'flow8_refactor_layout',
            'flow9_accessible',
            'flow10_implement_design',
            'flow11_extract_tokens',
            'flow12_responsive_review',
            'flow13_rapid_iteration',
            'flow14_migration',
        ];
        return flowIds
            .map((flowId) => {
            const flow = (0, flows_1.getFlow)(flowId);
            return flow
                ? {
                    flowId,
                    name: flow.name,
                    description: flow.description,
                }
                : null;
        })
            .filter((f) => f !== null);
    }
}
exports.FlowExecutionEngine = FlowExecutionEngine;
function createExecutionEngine() {
    return new FlowExecutionEngine();
}
//# sourceMappingURL=sidecoach-orchestrator.js.map