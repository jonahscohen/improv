"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowExecutionEngine = void 0;
exports.createExecutionEngine = createExecutionEngine;
const fs = __importStar(require("fs"));
const taste_validator_1 = require("./taste-validator");
const intent_detector_1 = require("./intent-detector");
const flows_1 = require("./flows");
const flow_history_1 = require("./flow-history");
const orchestrator_1 = require("./orchestrator");
const deterministic_validator_1 = require("./deterministic-validator");
const regression_detector_1 = require("./regression-detector");
const design_debt_tracker_1 = require("./design-debt-tracker");
const project_context_1 = require("./project-context");
const context_loader_1 = require("./context-loader");
const session_memory_writer_1 = require("./session-memory-writer");
const slash_command_router_1 = require("./slash-command-router");
const sidecoach_entry_point_1 = require("./sidecoach-entry-point");
const teach_command_handler_v2_1 = require("./teach-command-handler-v2");
const document_command_handler_1 = require("./document-command-handler");
const flow_prerequisites_1 = require("./flow-prerequisites");
const flow_composition_1 = require("./flow-composition");
const flow_domain_validators_1 = require("./flow-domain-validators");
const flow_execution_context_enhanced_1 = require("./flow-execution-context-enhanced");
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
const flow_handler_tactical_polish_1 = require("./flow-handler-tactical-polish");
const flow_handler_responsive_validation_1 = require("./flow-handler-responsive-validation");
const flow_handlers_tier3_tier4_1 = require("./flow-handlers-tier3-tier4");
const flow_handlers_tier5_specialized_1 = require("./flow-handlers-tier5-specialized");
const flow_handlers_curate_qa_1 = require("./flow-handlers-curate-qa");
const flow_handler_landing_composition_1 = require("./flow-handler-landing-composition");
const flow_handler_copywriting_1 = require("./flow-handler-copywriting");
// Phase III: Performance, Validation, Metrics
const flow_performance_cache_1 = require("./flow-performance-cache");
const flow_specific_validators_1 = require("./flow-specific-validators");
const flow_metrics_tracker_1 = require("./flow-metrics-tracker");
const flow_conditional_router_1 = require("./flow-conditional-router");
const clausemd_mandate_validator_1 = require("./clausemd-mandate-validator");
const build_report_aggregator_1 = require("./build-report-aggregator");
const checkpoint_store_1 = require("./checkpoint-store");
const verb_command_registry_1 = require("./verb-command-registry");
// Flows that produce HTML output and must clear the taste gate before declaring success.
// craft / clone-match / layout / polish families (both modern flowX_* and legacy flowN_* IDs).
const HTML_PRODUCING_FLOWS = new Set([
    'flowG_component_implementation',
    'flowJ_tactical_polish',
    'flowO_clone_match_special',
    'flowR_layout_optimization',
    'flow1_clone_match',
    'flow2_polish_enhance',
    'flow7_design_component',
    'flow8_refactor_layout',
    'flow10_implement_design',
]);
class FlowExecutionEngine {
    constructor() {
        this.checkpointStore = null;
        this.gcRan = false;
        this.cachedProjectCtx = null;
        this.intentDetector = (0, intent_detector_1.createDetector)();
        this.handlers = new Map();
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        this.orchestrator = new orchestrator_1.SidecoachOrchestrator(flowHistory);
        this.compositionEngine = new flow_composition_1.FlowCompositionEngine();
        this.contextManager = new flow_execution_context_enhanced_1.EnhancedContextManager();
        this.initializeHandlers();
        this.initializeValidators();
    }
    initializeValidators() {
        // Register all domain validators for flow execution
        (0, flow_domain_validators_1.registerFlowDomainValidators)(this.compositionEngine);
        // Register context propagation rules for flow sequences
        for (const rule of flow_execution_context_enhanced_1.COMMON_PROPAGATION_RULES) {
            this.contextManager.registerPropagationRule(rule);
        }
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
            ['flowJ_tactical_polish', () => new flow_handler_tactical_polish_1.FlowJTacticalPolishHandler()],
            ['flowK_multi_lens_audit', () => new flow_handlers_tier3_tier4_1.FlowKMultiLensAuditHandler()],
            ['flowL_design_critique', () => new flow_handlers_tier3_tier4_1.FlowLDesignCritiqueHandler()],
            ['flowM_responsive_validation', () => new flow_handler_responsive_validation_1.FlowMResponsiveValidationHandler()],
            ['flowN_rapid_iteration_refined', () => new flow_handlers_tier3_tier4_1.FlowNRapidIterationHandler()],
            // Tier 4: Special
            ['flowO_clone_match_special', () => new flow_handlers_tier3_tier4_1.FlowOCloneMatchHandler()],
            ['flowP_constraint_design_special', () => new flow_handlers_tier3_tier4_1.FlowPConstraintDesignHandler()],
            ['flowQ_migration_special', () => new flow_handlers_tier3_tier4_1.FlowQMigrationHandler()],
            // Tier 5: Specialized refinement (NEW - v2.1.9 coverage)
            ['flowR_layout_optimization', () => new flow_handlers_tier5_specialized_1.FlowRLayoutOptimizationHandler()],
            ['flowS_typography_excellence', () => new flow_handlers_tier5_specialized_1.FlowSTypographyExcellenceHandler()],
            ['flowT_ambitious_motion', () => new flow_handlers_tier5_specialized_1.FlowTAmbitiousMotionHandler()],
            // Special: Curate + All-Seven QA (addresses two concrete gaps)
            ['flowU_curate', () => new flow_handlers_curate_qa_1.FlowUCurateHandler()],
            ['flowV_all_seven_qa', () => new flow_handlers_curate_qa_1.FlowVAllSevenQAHandler()],
            // Tier 6: Composition & Copy
            ['flowW_landing_composition', () => new flow_handler_landing_composition_1.FlowWLandingCompositionHandler()],
            ['flowX_copywriting', () => new flow_handler_copywriting_1.FlowXCopywritingHandler()],
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
    /**
     * Run the composite-flow execution loop. Extracted from `process()` so both the
     * new-run path and the (forthcoming T5) resume path can share it.
     * Pure refactor in T3 - no new behavior, no checkpoint writes (those come in T4).
     */
    async runCompositeLoop(compositeFlow, executionContext, flowResults, startIndex, utterance) {
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        const historyEntries = flowHistory.getFlowSequence();
        const startTime = Date.now();
        // Phase 6 part 2: stable run-start timestamp so the same file is overwritten in place across steps.
        const runStartIso = new Date().toISOString().replace(/[:.]/g, '');
        const runCheckpointId = `sidecoach-${compositeFlow.id}-${runStartIso}`;
        let lastCheckpointId;
        let checkpointDisabled = false;
        for (let stepIndex = startIndex; stepIndex < compositeFlow.steps.length; stepIndex++) {
            const step = compositeFlow.steps[stepIndex];
            const handler = this.handlers.get(step.flowId);
            if (!handler)
                continue;
            // Check prerequisites
            const prerequisiteCheck = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute(step.flowId, historyEntries);
            if (!prerequisiteCheck.canExecute) {
                if (step.skipOnError) {
                    flowResults.push({
                        flowId: step.flowId,
                        flowName: step.flowId,
                        status: 'skipped',
                        message: `Prerequisites not met: ${prerequisiteCheck.reason}`,
                        guidance: [],
                        checklist: [],
                    });
                    continue;
                }
                else if (compositeFlow.failOnFirstError) {
                    return {
                        success: false,
                        message: `Composite flow halted: ${step.flowId} failed prerequisites`,
                        detectedFlow: null,
                        flowResults,
                    };
                }
                flowResults.push({
                    flowId: step.flowId,
                    flowName: step.flowId,
                    status: 'error',
                    message: `Prerequisites not met: ${prerequisiteCheck.reason}`,
                    guidance: [],
                    checklist: [],
                });
                continue;
            }
            // Enrich context FIRST so canExecute sees the same data as execute (T11 carryover fix).
            const enrichedCtx = this.enrichContextForHandler(executionContext, step.flowId);
            if (handler.canExecute(enrichedCtx)) {
                try {
                    // Track flow entry in execution chain
                    this.contextManager.addToExecutionChain(step.flowId, step.flowId);
                    // Execute the handler
                    const result = await handler.execute(enrichedCtx);
                    // Track flow completion in execution chain
                    this.contextManager.completeInChain(step.flowId, result.status === 'success' ? 'completed' : 'error', result.message);
                    // Store execution metadata in result
                    result.executionMetadata = {
                        executionChain: this.contextManager.getExecutionChain(),
                        executionDuration: this.contextManager.getExecutionDuration(step.flowId),
                    };
                    this.runTasteValidationGate(step.flowId, executionContext, result);
                    this.recordFlowWithMemory(result);
                    // Apply automatic domain validators based on flow type (soft-fail)
                    if (result.status === 'success') {
                        const validatorsForFlow = (0, flow_domain_validators_1.getValidatorsForFlow)(step.flowId);
                        if (validatorsForFlow.length > 0) {
                            const validations = this.compositionEngine.validateMultipleDomains(validatorsForFlow, result);
                            result.validationResults = validations;
                            // Log validation failures as warnings (soft-fail mode)
                            const failedValidations = validations.filter(v => v.status !== 'pass');
                            if (failedValidations.length > 0) {
                                const warningMsg = failedValidations
                                    .map(v => `[${v.domain}] ${v.failedRules.join(', ')}`)
                                    .join('; ');
                                result.message = `${result.message}\n\nValidation warnings: ${warningMsg}`;
                            }
                        }
                    }
                    // Also support explicit domain validation if configured in the step
                    if (step.domainValidation?.domains && step.domainValidation.domains.length > 0) {
                        const validations = this.compositionEngine.validateMultipleDomains(step.domainValidation.domains, result);
                        result.validationResults = validations;
                        // Check if any validation failed
                        const allPassed = flow_composition_1.FlowCompositionEngine.allValidationsPassed(validations);
                        if (!allPassed && step.domainValidation.failOnError) {
                            // Halt composition on validation failure
                            return {
                                success: false,
                                message: `Composite flow halted: ${step.flowId} failed domain validation`,
                                detectedFlow: null,
                                flowResults: [...flowResults, result],
                            };
                        }
                    }
                    flowResults.push(result);
                    // Phase 6 part 2: persist a checkpoint after each successful step.
                    if (result.status === 'success' && this.checkpointStore && !checkpointDisabled) {
                        const checkpoint = {
                            schemaVersion: 1,
                            checkpointId: runCheckpointId,
                            compositeFlowId: compositeFlow.id,
                            createdAt: new Date().toISOString(),
                            cursor: stepIndex + 1,
                            completedStepIds: flowResults.map((r) => r.flowId),
                            flowResults,
                            executionContext,
                            utterance,
                        };
                        try {
                            this.checkpointStore.writeCheckpoint(checkpoint);
                            lastCheckpointId = runCheckpointId;
                        }
                        catch (err) {
                            process.stderr.write(`[sidecoach] checkpoint write failed at step ${stepIndex} (continuing without resume capability): ${err.message}\n`);
                            checkpointDisabled = true;
                        }
                    }
                    // Sprint 7 T6: ClaudemdMandate validation -> push ValidationResult so BuildReport picks it up.
                    if (result.status === 'success') {
                        try {
                            const mandateReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(result, executionContext);
                            result.validationResults = result.validationResults || [];
                            result.validationResults.push(clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(mandateReport));
                        }
                        catch (err) {
                            process.stderr.write(`[sidecoach] ClaudemdMandate validation failed at step ${stepIndex} (continuing): ${err.message}\n`);
                        }
                    }
                    // Apply context transformation if defined
                    if (step.transformContext) {
                        Object.assign(executionContext, step.transformContext(executionContext, result));
                    }
                    else {
                        // Default: propagate context
                        Object.assign(executionContext, flow_composition_1.FlowCompositionEngine.propagateContext(executionContext, result));
                    }
                }
                catch (err) {
                    const errorResult = {
                        flowId: step.flowId,
                        flowName: step.flowId,
                        status: 'error',
                        message: `Flow execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                        guidance: [],
                        checklist: [],
                        error: err instanceof Error ? err.message : 'Unknown error',
                    };
                    // Track error in execution chain
                    this.contextManager.completeInChain(step.flowId, 'error', errorResult.message);
                    errorResult.executionMetadata = {
                        executionChain: this.contextManager.getExecutionChain(),
                        executionDuration: this.contextManager.getExecutionDuration(step.flowId),
                    };
                    flowResults.push(errorResult);
                    if (!step.skipOnError && compositeFlow.failOnFirstError) {
                        return {
                            success: false,
                            message: `Composite flow halted: ${step.flowId} failed`,
                            detectedFlow: null,
                            flowResults,
                        };
                    }
                }
            }
        }
        const totalTime = Date.now() - startTime;
        // Aggregate results if requested
        let aggregatedGuidance = [];
        let aggregatedChecklist = [];
        if (compositeFlow.aggregateResults) {
            const aggregated = flow_composition_1.FlowCompositionEngine.aggregateResults(flowResults);
            aggregatedGuidance = aggregated.guidance;
            aggregatedChecklist = aggregated.checklist;
        }
        // Phase 5 (Surface A): generate a Build Report aggregating validator findings.
        const buildReport = (0, build_report_aggregator_1.generateBuildReport)({
            source: 'flow-results',
            flowResults,
            composite: compositeFlow.id,
        });
        const buildReportMarkdown = (0, build_report_aggregator_1.renderBuildReportMarkdown)(buildReport);
        const buildReportArtifact = {
            type: 'reference',
            name: 'Build Report',
            content: buildReportMarkdown,
            description: `Build Report for ${compositeFlow.name}: verdict=${buildReport.verdict}, grade=${buildReport.overallGrade}`,
        };
        // Phase 6 part 2: composite finished naturally - delete the checkpoint.
        if (lastCheckpointId && this.checkpointStore) {
            try {
                this.checkpointStore.deleteCheckpoint(lastCheckpointId);
            }
            catch (err) {
                process.stderr.write(`[sidecoach] checkpoint cleanup failed (will be GC'd later): ${err.message}\n`);
            }
        }
        return {
            success: flowResults.some(r => r.status === 'success'),
            message: `Composite flow complete: ${compositeFlow.name} (${flowResults.filter(r => r.status === 'success').length}/${flowResults.length} flows successful, ${totalTime}ms)`,
            detectedFlow: {
                flowId: compositeFlow.id,
                flowName: compositeFlow.name,
                confidence: 1.0,
            },
            flowResults,
            guidance: aggregatedGuidance.length > 0 ? aggregatedGuidance : undefined,
            checklist: aggregatedChecklist.length > 0 ? aggregatedChecklist : undefined,
            artifacts: [buildReportArtifact],
            buildReport,
        };
    }
    /**
     * Resume a composite run from a saved checkpoint. Seeds runCompositeLoop with
     * the checkpoint's executionContext + flowResults + cursor + utterance. The
     * loop mints a fresh runStartIso, so the resumed run writes to a NEW
     * checkpoint file. The caller (process() resume branch) deletes the original
     * pre-resume checkpoint after this method returns. (Sprint 6 T5.)
     */
    async runCompositeFromCheckpoint(compositeFlow, checkpoint) {
        return this.runCompositeLoop(compositeFlow, checkpoint.executionContext, [...checkpoint.flowResults], checkpoint.cursor, checkpoint.utterance);
    }
    // Taste validator gate: run validateTaste against the produced HTML for craft/clone-match/layout/polish flows.
    // Mutates result -> status: 'error' with violations summary when target file fails taste checks.
    // Soft-skips when no target file is in context (metadata.targetFile or currentFile ending in .html/.htm).
    runTasteValidationGate(flowId, context, result) {
        if (!HTML_PRODUCING_FLOWS.has(flowId))
            return;
        if (result.status !== 'success')
            return;
        const metaTarget = context.metadata?.targetFile;
        const currentHtml = context.currentFile && /\.html?$/i.test(context.currentFile)
            ? context.currentFile
            : undefined;
        const targetFile = metaTarget || currentHtml;
        if (!targetFile)
            return;
        let html;
        try {
            html = fs.readFileSync(targetFile, 'utf8');
        }
        catch {
            return;
        }
        let css;
        const cssFile = context.metadata?.targetCss;
        if (cssFile) {
            try {
                css = fs.readFileSync(cssFile, 'utf8');
            }
            catch {
                // CSS optional
            }
        }
        const violations = (0, taste_validator_1.validateTaste)(html, css);
        // Sprint 7: always push a ValidationResult so BuildReport sees the outcome.
        result.validationResults = result.validationResults || [];
        result.validationResults.push((0, taste_validator_1.toValidationResult)(violations));
        if (violations.length === 0)
            return;
        const summary = violations
            .map((v) => `- [${v.ruleId}] ${v.message}`)
            .join('\n');
        result.status = 'error';
        result.error = `Taste validator: ${violations.length} violation(s) in ${targetFile}`;
        result.guidance = [
            ...(result.guidance || []),
            `Taste validation FAILED on ${targetFile}:`,
            summary,
        ];
        result.message = `${result.message}\n\nTaste validation FAILED on ${targetFile}:\n${summary}`;
    }
    enrichContextForHandler(context, _flowId) {
        const projectPath = context.projectPath || process.env.SIDECOACH_PROJECT_PATH;
        if (!projectPath)
            return context;
        // Per-orchestrator-lifetime cache (re-read only if path changes)
        if (!this.cachedProjectCtx || this.cachedProjectCtx.path !== projectPath) {
            try {
                const ctx = (0, context_loader_1.buildProjectContext)(projectPath);
                this.cachedProjectCtx = { path: projectPath, ctx };
            }
            catch {
                return context;
            }
        }
        const loaded = this.cachedProjectCtx.ctx;
        const enrichedMeta = {
            ...(context.metadata || {}),
            designTokens: context.metadata?.designTokens || loaded.parsedDesignTokens || {},
            techStack: context.metadata?.techStack || loaded.techStack,
            productContent: loaded.productContent,
            designContent: loaded.designContent,
        };
        const enrichedProjectContext = {
            ...(context.projectContext || {}),
            register: context.projectContext?.register || loaded.register,
            product: context.projectContext?.product || { content: loaded.productContent },
        };
        return {
            ...context,
            metadata: enrichedMeta,
            projectContext: enrichedProjectContext,
        };
    }
    // Phase III: Performance & Validation Integration
    validateFlowExecution(flowId, context, result) {
        // Run CLAUDE.md mandate validation first (hard blockers)
        const mandateValidation = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(result, context);
        if (mandateValidation.blockers.length > 0 || mandateValidation.violations.length > 0) {
            const report = clausemd_mandate_validator_1.ClaudemdMandateValidator.reportViolations(mandateValidation);
            console.log(`[CLAUDE.md Validation] ${flowId}:\n${report}`);
        }
        // Run flow-specific validators
        const validation = flow_specific_validators_1.FlowSpecificValidator.validateFlow(flowId, context, result);
        if (validation.warnings.length > 0) {
            console.log(`[Validation Warnings] ${flowId}:`, validation.warnings);
        }
    }
    cacheFlowResult(flowId, result) {
        // Cache execution result for performance
        flow_performance_cache_1.globalPerformanceCache.cacheHandlerResult(flowId, result);
    }
    trackFlowMetrics(flowId, flowName, executionId, result, context) {
        // Track metrics for this flow execution
        flow_metrics_tracker_1.globalMetricsTracker.startTracking(flowId, flowName, executionId);
        // Record guidance as decisions
        if (result.guidance && result.guidance.length > 0) {
            flow_metrics_tracker_1.globalMetricsTracker.recordDecision(executionId, `flow-executed-${flowId}`, result.message, 'high');
        }
        // Record checklist progress
        if (result.checklist) {
            const completed = result.checklist.filter(item => item.completed).length;
            flow_metrics_tracker_1.globalMetricsTracker.updateChecklistProgress(executionId, completed, result.checklist.length);
        }
        // Record artifacts
        if (result.artifacts && result.artifacts.length > 0) {
            for (const artifact of result.artifacts) {
                // Map FlowArtifact types to ArtifactRecord types
                const typeMap = {
                    'script': 'code',
                    'command': 'code',
                    'checklist': 'checklist',
                    'reference': 'reference',
                    'template': 'template',
                };
                const recordType = typeMap[artifact.type] || 'template';
                flow_metrics_tracker_1.globalMetricsTracker.recordArtifact(executionId, recordType, artifact.name, artifact.description || '');
            }
        }
        // Complete tracking and store metrics
        flow_metrics_tracker_1.globalMetricsTracker.completeTracking(executionId, {
            projectPath: context?.projectPath,
            userId: context?.userId,
            metadataKeys: context?.metadata ? Object.keys(context.metadata) : [],
        });
    }
    determineConditionalFlow(context) {
        // Evaluate conditional execution routing
        return flow_conditional_router_1.FlowConditionalRouter.determineRoute(context) || null;
    }
    getExecutablePath(context) {
        // Get the conditional execution path for a context
        return flow_conditional_router_1.FlowConditionalRouter.getExecutablePath(context);
    }
    processWithEntryPoint(utterance, context = {}) {
        // Process utterance through unified entry point system
        const entryPointRequest = {
            utterance,
            userId: context.userId || 'unknown',
            projectPath: context.projectPath || process.cwd(),
            sessionContext: context.metadata,
        };
        const entryPointResponse = sidecoach_entry_point_1.globalEntryPoint.process(entryPointRequest);
        // Record entry point request in context metadata if available
        if (context.metadata) {
            context.metadata.entryPointType = entryPointResponse.entryType;
            context.metadata.entryPointFlows = entryPointResponse.selectedFlows;
            context.metadata.entryPointReason = entryPointResponse.reason;
        }
        if (!entryPointResponse.isValid || entryPointResponse.selectedFlows.length === 0) {
            return null;
        }
        return {
            flowIds: entryPointResponse.selectedFlows,
            entryType: entryPointResponse.entryType,
            primaryFlow: entryPointResponse.primaryFlow,
        };
    }
    async process(utterance, context = {}) {
        // Step 0: Load project context (PRODUCT.md, DESIGN.md, register detection)
        const projectPath = context.projectPath || process.cwd();
        const loadedContext = (0, context_loader_1.buildProjectContext)(projectPath);
        const enrichedContext = {
            ...context,
            projectPath,
            metadata: {
                ...(context.metadata || {}),
                register: loadedContext.register,
                productContent: loadedContext.productContent,
                designContent: loadedContext.designContent,
                hasFullContext: loadedContext.hasFullContext,
            },
        };
        // Step 1: Check for empty input (show interactive menu)
        if (!utterance || utterance.trim() === '' || utterance === '/sidecoach') {
            return this.showInteractiveMenu(enrichedContext);
        }
        // Phase 6 part 2: lazy CheckpointStore boot + 7-day GC sweep (runs once per engine instance).
        // Must run BEFORE the slash-command branch so the composite-flow path can write checkpoints.
        if (!this.checkpointStore || !this.gcRan) {
            this.checkpointStore = new checkpoint_store_1.CheckpointStore(context.projectPath || process.cwd());
            try {
                this.checkpointStore.gcOldCheckpoints(7);
            }
            catch (err) {
                process.stderr.write(`[sidecoach] checkpoint GC failed (continuing): ${err.message}\n`);
            }
            this.gcRan = true;
        }
        // Sprint 9 Bug 2: auto-stage parsed DESIGN.md tokens into context.metadata.designTokens
        try {
            const projCtx = (0, context_loader_1.buildProjectContext)(context.projectPath || process.cwd());
            if (projCtx.parsedDesignTokens && !context.metadata?.designTokens) {
                context.metadata = {
                    ...(context.metadata || {}),
                    designTokens: projCtx.parsedDesignTokens,
                };
            }
        }
        catch (err) {
            process.stderr.write(`[sidecoach] designTokens auto-load failed (continuing): ${err.message}\n`);
        }
        // Step 2: Check for slash commands (deterministic routing)
        const commandMatch = (0, slash_command_router_1.parseSlashCommand)(utterance);
        if (commandMatch.isCommand) {
            if (commandMatch.command === 'teach') {
                const teachHandler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
                const result = await teachHandler.execute({
                    utterance,
                    userId: context.userId,
                    projectPath: context.projectPath || process.cwd(),
                    currentFile: context.currentFile,
                    selectedText: context.selectedText,
                    metadata: context.metadata,
                });
                return {
                    success: true,
                    message: result.message,
                    detectedFlow: null,
                    flowResults: [result],
                    guidance: result.guidance,
                    checklist: result.checklist,
                    artifacts: result.artifacts,
                };
            }
            if (commandMatch.command === 'document') {
                const docHandler = new document_command_handler_1.DocumentCommandHandler();
                const result = await docHandler.execute({
                    utterance,
                    userId: context.userId,
                    projectPath: context.projectPath || process.cwd(),
                    currentFile: context.currentFile,
                    selectedText: context.selectedText,
                    metadata: context.metadata,
                });
                // Sprint 8 T7: append verb-command guidance after the document handler runs.
                const docGuidanceAppend = this.buildVerbGuidanceAppend('document');
                const docGuidance = [
                    ...(result.guidance || []),
                    ...(docGuidanceAppend || []),
                ];
                return {
                    success: result.status === 'success',
                    message: result.message,
                    detectedFlow: null,
                    flowResults: [result],
                    guidance: docGuidance.length > 0 ? docGuidance : undefined,
                    checklist: result.checklist,
                    artifacts: result.artifacts,
                };
            }
            if (commandMatch.command === 'list') {
                const byPhase = (0, slash_command_router_1.getCommandsByPhase)();
                const verbCommands = (0, slash_command_router_1.getVerbCommandInfo)();
                const groupedGuidance = [
                    'Available Sidecoach Commands',
                    '',
                ];
                // Build grouped output by phase (existing phase-based commands)
                groupedGuidance.push('## Phase commands');
                for (const phase of ['Research', 'Implement', 'Review', 'Special']) {
                    const phaseCommands = byPhase[phase]?.commands || [];
                    if (phaseCommands.length > 0) {
                        groupedGuidance.push(`\n### ${phase} Phase (${phaseCommands.length} commands)`);
                        for (const cmd of phaseCommands) {
                            groupedGuidance.push(`  /sidecoach ${cmd.command} - ${cmd.description} (${cmd.flowCount} flows)`);
                        }
                    }
                }
                // Sprint 8 T8: append the 22 verb commands under a separate heading
                groupedGuidance.push('');
                groupedGuidance.push('## Verb commands');
                for (const [verb, info] of Object.entries(verbCommands)) {
                    groupedGuidance.push(`  /sidecoach ${verb} - ${info.description}`);
                }
                groupedGuidance.push('');
                groupedGuidance.push('Use /sidecoach help <verb> for detail on any verb command.');
                return {
                    success: true,
                    message: 'Available Sidecoach Commands',
                    detectedFlow: null,
                    flowResults: [],
                    guidance: groupedGuidance,
                };
            }
            // Sprint 8 T8: /sidecoach help <verb> - dump registry detail for a verb.
            if (commandMatch.command === 'help') {
                const verb = commandMatch.target;
                if (!verb) {
                    return {
                        success: false,
                        message: 'Usage: /sidecoach help <verb>',
                        detectedFlow: null,
                        flowResults: [],
                        guidance: [
                            'Usage: /sidecoach help <verb>',
                            '',
                            'Run /sidecoach list to see all available verbs.',
                        ],
                    };
                }
                const entry = (0, verb_command_registry_1.getVerbEntry)(verb);
                if (!entry) {
                    return {
                        success: false,
                        message: `Unknown verb: ${verb}. Try /sidecoach list to see available commands.`,
                        detectedFlow: null,
                        flowResults: [],
                    };
                }
                return {
                    success: true,
                    message: `Help for /sidecoach ${verb}`,
                    detectedFlow: { flowId: 'help', flowName: 'Sidecoach Help', confidence: 1.0 },
                    flowResults: [],
                    guidance: [
                        `# /sidecoach ${verb}`,
                        '',
                        entry.description,
                        '',
                        `**Phase:** ${entry.phase}`,
                        `**Reference:** ${entry.skillRefPath}`,
                        '',
                        '**Flow chain:**',
                        ...entry.flowIds.map((f) => `- ${f}`),
                        '',
                        '**Parity checklist (verb command produces these):**',
                        ...entry.parityChecklist.map((s) => `- ${s}`),
                        '',
                        '**Sidecoach additions (parity-plus):**',
                        ...entry.parityPlus.map((s) => `- ${s}`),
                    ],
                };
            }
            // Handle composite flow execution
            if (commandMatch.command === 'composite') {
                const compositeFlowId = commandMatch.target;
                if (!compositeFlowId) {
                    return {
                        success: false,
                        message: 'Please specify composite flow ID: /sidecoach composite:<flow-id>',
                        detectedFlow: null,
                        flowResults: [],
                        guidance: [
                            'Available composite flows:',
                            '  /sidecoach composite:composite_research_to_impl - Research to Implementation (9 flows)',
                            '  /sidecoach composite:composite_qa_workflow - Quality Assurance (4 flows)',
                            '  /sidecoach composite:composite_optimization - Complete Optimization (5 flows)',
                        ],
                    };
                }
                // Find the composite flow definition
                const compositeFlow = flow_composition_1.PRESET_COMPOSITE_FLOWS.find(cf => cf.id === compositeFlowId);
                if (!compositeFlow) {
                    return {
                        success: false,
                        message: `Composite flow not found: ${compositeFlowId}`,
                        detectedFlow: null,
                        flowResults: [],
                    };
                }
                // Execute composite flow steps
                const executionContext = {
                    utterance,
                    userId: context.userId,
                    projectPath: context.projectPath || process.cwd(),
                    currentFile: context.currentFile,
                    selectedText: context.selectedText,
                    metadata: { ...context.metadata, compositeFlowId },
                };
                return this.runCompositeLoop(compositeFlow, executionContext, [], 0, utterance);
            }
            // Route to command's flow chain
            // Sprint 10 Bug 1 + Sprint 12 T5: always auto-build projectContext from
            // PRODUCT.md / DESIGN.md on the project root, then overlay any caller-passed
            // projectContext on top. Pre-T5 the auto-build was skipped entirely when
            // the caller supplied ANY partial projectContext (e.g. just `{ register }`),
            // which left handlers without product.brandPersonality and caused flowB/E
            // to reject in canExecute.
            let autoBuiltProjectContext = {};
            try {
                autoBuiltProjectContext = (0, context_loader_1.buildProjectContext)(context.projectPath || process.cwd()) || {};
            }
            catch (err) {
                // Soft-fail - autoBuiltProjectContext stays empty
            }
            const userPassedProjectContext = context.projectContext || {};
            const projectContextForChain = {
                ...autoBuiltProjectContext,
                ...userPassedProjectContext,
            };
            const executionContext = {
                utterance,
                userId: context.userId,
                projectPath: context.projectPath || process.cwd(),
                currentFile: context.currentFile,
                selectedText: context.selectedText,
                projectContext: projectContextForChain,
                metadata: { ...context.metadata, commandTarget: commandMatch.target },
            };
            const flowResults = [];
            let detectedFlow = null;
            const flowHistory = (0, flow_history_1.getFlowHistory)();
            for (const flowId of commandMatch.flowIds) {
                const handler = this.handlers.get(flowId);
                if (!handler)
                    continue;
                try {
                    // Sprint 12 T4: refresh history snapshot each iteration so chain-mates
                    // that just finished (recorded by recordFlowWithMemory) are visible to
                    // the next prereq check. The pre-Sprint-12 single-snapshot version
                    // caused every chain dependent (F needs A, G needs B, ...) to fail
                    // even though the prior step had just succeeded.
                    const historyEntries = flowHistory.getFlowSequence();
                    // Check prerequisites before executing
                    const prerequisiteCheck = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute(flowId, historyEntries);
                    if (!prerequisiteCheck.canExecute) {
                        flowResults.push({
                            flowId,
                            flowName: flowId,
                            status: 'error',
                            message: `Flow prerequisites not met: ${prerequisiteCheck.reason}`,
                            guidance: [`Cannot execute ${flowId}: ${prerequisiteCheck.reason}`],
                            checklist: [],
                            error: prerequisiteCheck.reason,
                        });
                        continue;
                    }
                    // Check context requirements
                    const contextCheck = flow_prerequisites_1.FlowPrerequisiteValidator.validateContextRequirements(flowId, executionContext);
                    if (!contextCheck.valid) {
                        flowResults.push({
                            flowId,
                            flowName: flowId,
                            status: 'error',
                            message: `Missing context: ${contextCheck.missing?.join(', ')}`,
                            guidance: [`Context requirements not met: ${contextCheck.missing?.join(', ')}`],
                            checklist: [],
                            error: `Missing: ${contextCheck.missing?.join(', ')}`,
                        });
                        continue;
                    }
                    // Enrich context FIRST so canExecute sees the same data as execute (T11 carryover fix).
                    const enrichedCtx = this.enrichContextForHandler(executionContext, flowId);
                    if (handler.canExecute(enrichedCtx)) {
                        // Track flow entry in execution chain
                        this.contextManager.addToExecutionChain(flowId, flowId);
                        const result = await handler.execute(enrichedCtx);
                        // Track flow completion and store metadata
                        this.contextManager.completeInChain(flowId, result.status === 'success' ? 'completed' : 'error', result.message);
                        // Store execution metadata in result
                        result.executionMetadata = {
                            executionChain: this.contextManager.getExecutionChain(),
                            executionDuration: this.contextManager.getExecutionDuration(flowId),
                        };
                        // Sprint 7 T6: ClaudemdMandate validation for single-flow execution path.
                        if (result.status === 'success') {
                            try {
                                const mandateReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(result, executionContext);
                                result.validationResults = result.validationResults || [];
                                result.validationResults.push(clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(mandateReport));
                            }
                            catch (err) {
                                process.stderr.write(`[sidecoach] ClaudemdMandate validation failed (continuing): ${err.message}\n`);
                            }
                        }
                        this.runTasteValidationGate(flowId, executionContext, result);
                        this.recordFlowWithMemory(result);
                        flowResults.push(result);
                        if (!detectedFlow) {
                            detectedFlow = {
                                flowId,
                                flowName: result.flowName || flowId,
                                confidence: 1.0
                            };
                        }
                    }
                    else {
                        // Sprint 10 T2: record canExecute=false as 'skipped' so flows don't
                        // silently drop from chain results. Dogfood showed flowH/flowI
                        // absent from craft chain when canExecute returned false.
                        flowResults.push({
                            flowId,
                            flowName: flowId,
                            status: 'skipped',
                            message: `Skipped: ${flowId} prerequisites not met (canExecute returned false)`,
                            guidance: [],
                            checklist: [],
                        });
                    }
                }
                catch (err) {
                    // Sprint 9 T3: continue past errors so downstream flows still attempt.
                    // Dogfood showed flowH/flowI silently dropped from the chain when an
                    // earlier flow threw. Record the error as a flowResult entry and let
                    // the for-loop proceed to the next flow.
                    const message = err?.message ?? String(err);
                    process.stderr.write(`[sidecoach] Flow ${flowId} threw (continuing chain): ${message}\n`);
                    flowResults.push({
                        flowId,
                        flowName: flowId,
                        status: 'error',
                        message: `Flow execution failed: ${message}`,
                        guidance: [`Flow ${flowId} threw an exception: ${message}`],
                        checklist: [],
                        error: String(err),
                    });
                }
            }
            // Sprint 8 T7: append verb-command guidance after the chain executes.
            // Only fires for verbs that have a registry entry (the 22 verb command
            // verbs); phase commands like 'research' or 'review' return null from
            // getVerbEntry and are unaffected.
            const chainGuidanceAppend = commandMatch.command
                ? this.buildVerbGuidanceAppend(commandMatch.command)
                : null;
            const chainGuidance = [];
            for (const fr of flowResults) {
                if (fr.guidance && fr.guidance.length > 0) {
                    chainGuidance.push(...fr.guidance);
                }
            }
            if (chainGuidanceAppend) {
                chainGuidance.push(...chainGuidanceAppend);
            }
            return {
                success: flowResults.some((r) => r.status === 'success'),
                message: `Executed ${commandMatch.command} flow chain (${flowResults.filter((r) => r.status === 'success').length}/${flowResults.length} flows successful)`,
                detectedFlow,
                flowResults,
                guidance: chainGuidance.length > 0 ? chainGuidance : undefined,
            };
        }
        // Step 1: Detect intent (falls back to intent detection if not a slash command).
        // metadata.forceFlowId bypass: skip intent detection and route directly to the
        // named flow. Used by the disambiguation UI to re-invoke after the user picks
        // a candidate (Sprint 5 / Phase 6 T3).
        const forceFlowId = context.metadata?.forceFlowId;
        let detection;
        if (forceFlowId) {
            const allFlowIds = this.getAllKnownFlowIds();
            if (!allFlowIds.includes(forceFlowId)) {
                return {
                    success: false,
                    message: `Unknown flowId: "${forceFlowId}". Cannot route via forceFlowId.`,
                    detectedFlow: null,
                    flowResults: [],
                };
            }
            detection = {
                flowId: forceFlowId,
                flowName: forceFlowId,
                confidence: 1.0,
                matchedTokens: ['forceFlowId'],
                reason: 'metadata.forceFlowId bypass',
            };
        }
        else {
            detection = this.intentDetector.detect(utterance);
        }
        // Phase 6 part 2: metadata.resumeFromCheckpoint bypass.
        // Routes process() directly to the saved composite from the checkpoint's cursor,
        // skipping intent detection and the normal composite-routing logic.
        const resumeId = context?.metadata?.resumeFromCheckpoint;
        if (resumeId) {
            if (!this.checkpointStore) {
                return {
                    success: false,
                    message: 'Cannot resume: checkpoint store not initialized',
                    detectedFlow: null,
                    flowResults: [],
                };
            }
            let checkpoint;
            try {
                checkpoint = this.checkpointStore.readCheckpoint(resumeId);
            }
            catch (err) {
                return {
                    success: false,
                    message: `Cannot resume: ${err.message}`,
                    detectedFlow: null,
                    flowResults: [],
                };
            }
            const compositeFlow = flow_composition_1.PRESET_COMPOSITE_FLOWS.find((cf) => cf.id === checkpoint.compositeFlowId);
            if (!compositeFlow) {
                return {
                    success: false,
                    message: `Cannot resume: unknown compositeFlowId in checkpoint: ${checkpoint.compositeFlowId}`,
                    detectedFlow: null,
                    flowResults: [],
                };
            }
            const result = await this.runCompositeFromCheckpoint(compositeFlow, checkpoint);
            // After a successful resumed run completes, delete the original pre-resume checkpoint.
            try {
                this.checkpointStore.deleteCheckpoint(resumeId);
            }
            catch (err) {
                process.stderr.write(`[sidecoach] resume cleanup of original checkpoint failed (will be GC'd later): ${err.message}\n`);
            }
            return result;
        }
        // Handle no matches
        if (Array.isArray(detection.candidates) && detection.candidates.length === 0) {
            return {
                success: false,
                message: 'Could not understand your request. Please try rephrasing.',
                detectedFlow: null,
                flowResults: [],
            };
        }
        // Handle ambiguous matches with tiered resolution.
        if (detection.isAmbiguous && !detection.flowId) {
            const disambig = detection;
            const candidates = disambig.candidates || [];
            // Silent path: if the intent-detector resolved the tie via a programmer-set
            // recommendation (not alphabetical fallback), promote the winner to a
            // MatchResult and let the normal execution path take over.
            if (disambig.tieBreak &&
                typeof disambig.tieBreak.reason === 'string' &&
                disambig.tieBreak.reason.startsWith('Used recommendation field')) {
                const winnerFlow = candidates.find((c) => c.flowId === disambig.tieBreak.chosenFlowId);
                if (winnerFlow) {
                    detection = winnerFlow;
                }
                else {
                    // Defensive: chosenFlowId doesn't match any candidate - fall through to prompt.
                    return {
                        success: false,
                        message: 'Multiple flows match - user input needed.',
                        detectedFlow: null,
                        flowResults: [],
                        ambiguousCandidates: candidates.map((c) => ({
                            flowId: c.flowId,
                            flowName: c.flowName,
                            confidence: c.confidence,
                        })),
                        needsDisambiguation: true,
                        disambiguationPrompt: `Your request "${utterance}" could match multiple flows. Which best matches your intent?`,
                    };
                }
            }
            else {
                // User-prompt path: alphabetical fallback or no chosenFlowId.
                return {
                    success: false,
                    message: 'Multiple flows match - user input needed.',
                    detectedFlow: null,
                    flowResults: [],
                    ambiguousCandidates: candidates.map((c) => ({
                        flowId: c.flowId,
                        flowName: c.flowName,
                        confidence: c.confidence,
                    })),
                    needsDisambiguation: true,
                    disambiguationPrompt: `Your request "${utterance}" could match multiple flows. Which best matches your intent?`,
                };
            }
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
        // Track Flow A execution in context chain
        this.contextManager.addToExecutionChain('flowA_brand_verify', 'Brand/PRODUCT.md Verification');
        const flowAResult = await flowAHandler.execute(executionContext);
        // Complete Flow A in execution chain and store metadata
        this.contextManager.completeInChain('flowA_brand_verify', flowAResult.status === 'success' ? 'completed' : 'error', flowAResult.message);
        flowAResult.executionMetadata = {
            executionChain: this.contextManager.getExecutionChain(),
            executionDuration: this.contextManager.getExecutionDuration('flowA_brand_verify'),
        };
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
            // Enrich context FIRST so canExecute sees the same data as execute (T11 carryover fix).
            const enrichedCtxForNatural = this.enrichContextForHandler(executionContext, currentFlowId);
            // Check if handler can execute (revive canExecute validation)
            if (!handler.canExecute(enrichedCtxForNatural)) {
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
            // Execute handler with context tracking
            let result;
            const enhancedContext = flow_execution_context_enhanced_1.EnhancedContextManager.createEnhancedContext(executionContext, currentFlowId, flowName);
            // Track flow entry in execution chain
            this.contextManager.addToExecutionChain(currentFlowId, flowName);
            try {
                // Execute the handler
                result = await handler.execute(enrichedCtxForNatural);
                // Track flow completion in execution chain
                this.contextManager.completeInChain(currentFlowId, result.status === 'success' ? 'completed' : 'error', result.message);
            }
            catch (error) {
                result = {
                    flowId: currentFlowId,
                    flowName,
                    status: 'error',
                    message: `Error executing flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    error: error instanceof Error ? error.message : String(error),
                };
                // Track error in execution chain
                this.contextManager.completeInChain(currentFlowId, 'error', result.message);
            }
            // Store execution metadata in result (both success and error paths)
            result.executionMetadata = {
                enhancedContext,
                executionChain: this.contextManager.getExecutionChain(),
                executionDuration: this.contextManager.getExecutionDuration(currentFlowId),
            };
            // Apply domain validators if configured for this flow (soft-fail: log but continue)
            const validatorsForFlow = (0, flow_domain_validators_1.getValidatorsForFlow)(currentFlowId);
            if (validatorsForFlow.length > 0 && result.status === 'success') {
                const validations = this.compositionEngine.validateMultipleDomains(validatorsForFlow, result);
                result.validationResults = validations;
                // Log any validation failures as warnings (soft-fail mode)
                const failedValidations = validations.filter(v => v.status !== 'pass');
                if (failedValidations.length > 0) {
                    const warningMsg = failedValidations
                        .map(v => `[${v.domain}] ${v.failedRules.join(', ')}`)
                        .join('; ');
                    result.message = `${result.message}\n\nValidation warnings: ${warningMsg}`;
                }
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
            // Sprint 7 T6: ClaudemdMandate validation for single-flow chain path.
            if (result.status === 'success') {
                try {
                    const mandateReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(result, executionContext);
                    result.validationResults = result.validationResults || [];
                    result.validationResults.push(clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(mandateReport));
                }
                catch (err) {
                    process.stderr.write(`[sidecoach] ClaudemdMandate validation failed (continuing): ${err.message}\n`);
                }
            }
            // Run taste validator gate (mutates result -> error if HTML produces violations)
            this.runTasteValidationGate(currentFlowId, executionContext, result);
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
        // Persist session memory for all executed flows
        (0, session_memory_writer_1.persistSessionMemory)(executionContext.projectPath);
        // Phase 5 (Surface B): opt-in build report for natural-language / single-flow execution.
        let buildReportSingle;
        if (context.metadata?.emitBuildReport === true && flowResults.length > 0) {
            buildReportSingle = (0, build_report_aggregator_1.generateBuildReport)({
                source: 'flow-results',
                flowResults,
            });
        }
        return {
            success: flowResults.some((r) => r.status === 'success'),
            message: finalMessage,
            detectedFlow: { flowId: match.flowId, flowName: match.flowName, confidence: match.confidence },
            flowResults,
            guidance: flowResults.flatMap((r) => r.guidance || []),
            checklist: flowResults.flatMap((r) => r.checklist || []),
            artifacts: flowResults.flatMap((r) => r.artifacts || []),
            buildReport: buildReportSingle,
        };
    }
    /**
     * Sprint 8 T7: Build the verb-command guidance-append block.
     * Returns the array of strings to append to result.guidance for verbs that
     * have a registry entry (the 22 verb commands). The returned
     * array includes the parityChecklist and parityPlus tokens verbatim so the
     * sprint8 parity test sees them in the flattened output.
     */
    buildVerbGuidanceAppend(command) {
        const entry = (0, verb_command_registry_1.getVerbEntry)(command);
        if (!entry)
            return null;
        const appended = [
            '',
            `## ${entry.command} (verb command)`,
            ...entry.guidanceAppend,
            '',
            '### Parity checklist',
            ...entry.parityChecklist.map((s) => `- ${s}`),
            '',
            '### Sidecoach additions (parity-plus)',
            ...entry.parityPlus.map((s) => `- ${s}`),
        ];
        return appended;
    }
    showInteractiveMenu(context) {
        const byPhase = (0, slash_command_router_1.getCommandsByPhase)();
        const menuItems = [];
        let itemNum = 1;
        const commandMap = {};
        menuItems.push('\n=== Sidecoach Interactive Menu ===\n');
        for (const phase of ['Research', 'Implement', 'Review', 'Special']) {
            const phaseCommands = byPhase[phase]?.commands || [];
            if (phaseCommands.length > 0) {
                menuItems.push(`\n[${phase} Phase]\n`);
                for (const cmd of phaseCommands) {
                    menuItems.push(`  ${itemNum}. /sidecoach ${cmd.command}`);
                    menuItems.push(`     ${cmd.description}`);
                    commandMap[itemNum] = cmd.command;
                    itemNum++;
                }
            }
        }
        menuItems.push('\n\nEnter a number (1-' + (itemNum - 1) + ') to execute that command.');
        menuItems.push('Or type: /sidecoach <command> [options]');
        menuItems.push('Or type: /sidecoach list to see commands grouped by phase');
        return {
            success: true,
            message: 'Sidecoach - Interactive Design Flow Engine',
            detectedFlow: null,
            flowResults: [],
            guidance: menuItems,
        };
    }
    registerHandler(handler) {
        this.handlers.set(handler.flowId, handler);
    }
    /**
     * Read-only view of the registered handler map. Used by CLI tools that need to
     * enumerate or dispatch by FlowId. Caller must not mutate.
     */
    getHandlers() {
        return this.handlers;
    }
    /**
     * Union of all known flow ids - single handlers + composite preset ids.
     * Used by the metadata.forceFlowId bypass to validate caller-supplied flow ids
     * before routing past intent detection.
     */
    getAllKnownFlowIds() {
        const handlerIds = Array.from(this.handlers.keys());
        const compositeIds = flow_composition_1.PRESET_COMPOSITE_FLOWS.map((cf) => cf.id);
        return [...handlerIds, ...compositeIds];
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
            // Tier 6: Composition & Copy
            'flowW_landing_composition',
            'flowX_copywriting',
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