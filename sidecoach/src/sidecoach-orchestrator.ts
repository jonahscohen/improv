import * as fs from 'fs';
import { validateTaste, TasteViolation } from './taste-validator';
import { createDetector, IntentDetector } from './intent-detector';
import { FlowHandler, FlowExecutionContext, FlowExecutionResult, BaseFlowHandler } from './flow-handler';
import { FlowId, MatchResult, DisambiguationResult } from './types';
import { getFlow } from './flows';
import { getFlowHistory, FlowHistoryEntry } from './flow-history';
import { FlowMemoryEntry } from './flow-memory-schema';
import { SidecoachOrchestrator as IntelligentOrchestrator } from './orchestrator';
import { DeterministicValidator } from './deterministic-validator';
import { RegressionDetector } from './regression-detector';
import { DesignDebtTracker } from './design-debt-tracker';
import { ExtendedDomainValidator, DomainCheckContext, DomainValidationReport } from './extended-domain-validator';
import { ContextLoader } from './project-context';
import { buildProjectContext, ProjectContext } from './context-loader';
import { persistSessionMemory } from './session-memory-writer';
import { parseSlashCommand, getAvailableCommands, getCommandsByPhase } from './slash-command-router';
import { SidecoachEntryPoint, globalEntryPoint, EntryPointRequest } from './sidecoach-entry-point';
import { TeachCommandHandler } from './teach-command-handler';
import { FlowPrerequisiteValidator } from './flow-prerequisites';
import { FlowCompositionEngine, PRESET_COMPOSITE_FLOWS, CompositeFlowDefinition } from './flow-composition';
import { registerFlowDomainValidators, getValidatorsForFlow } from './flow-domain-validators';
import { EnhancedContextManager, EnhancedFlowExecutionContext, COMMON_PROPAGATION_RULES } from './flow-execution-context-enhanced';
import { FlowABrandVerifyHandler } from './flow-handler-brand-verify';
import { FlowBComponentResearchHandler } from './flow-handler-component-research';
import { FlowCFontResearchHandler } from './flow-handler-font-research';
import { FlowDReferenceSearchHandler } from './flow-handler-design-references';
import { FlowEMotionPatternsHandler } from './flow-handler-motion-patterns';
import {
  Flow2PolishHandler,
  Flow5ReviewHandler,
  Flow7DesignHandler,
  Flow10ImplementHandler,
} from './flow-handlers-core';
import {
  Flow1CloneHandler,
  Flow3AuditHandler,
  Flow4ExploreHandler,
  Flow6ConstraintHandler,
  Flow8RefactorHandler,
  Flow9AccessibleHandler,
  Flow11ExtractHandler,
  Flow12ResponsiveHandler,
  Flow13IterateHandler,
  Flow14MigrationHandler,
} from './flow-handlers-extended';
import { FlowFDesignTokensHandler } from './flow-handler-design-tokens';
import { FlowGComponentImplementationHandler } from './flow-handler-component-implementation';
import { FlowHMotionIntegrationHandler } from './flow-handler-motion-integration';
import { FlowIAccessibilityHandler } from './flow-handler-accessibility';
import {
  FlowJTacticalPolishHandler,
  FlowKMultiLensAuditHandler,
  FlowLDesignCritiqueHandler,
  FlowMResponsiveValidationHandler,
  FlowNRapidIterationHandler,
  FlowOCloneMatchHandler,
  FlowPConstraintDesignHandler,
  FlowQMigrationHandler,
} from './flow-handlers-tier3-tier4';
import {
  FlowRLayoutOptimizationHandler,
  FlowSTypographyExcellenceHandler,
  FlowTAmbitiousMotionHandler,
} from './flow-handlers-tier5-specialized';
import { FlowUCurateHandler, FlowVAllSevenQAHandler } from './flow-handlers-curate-qa';
import { FlowWLandingCompositionHandler } from './flow-handler-landing-composition';
import { FlowXCopywritingHandler } from './flow-handler-copywriting';
// Phase III: Performance, Validation, Metrics
import { FlowHandlerCache, globalPerformanceCache } from './flow-performance-cache';
import { FlowSpecificValidator } from './flow-specific-validators';
import { FlowMetricsTracker, globalMetricsTracker } from './flow-metrics-tracker';
import { FlowConditionalRouter } from './flow-conditional-router';
import { ClaudemdMandateValidator } from './clausemd-mandate-validator';

// Flows that produce HTML output and must clear the taste gate before declaring success.
// craft / clone-match / layout / polish families (both modern flowX_* and legacy flowN_* IDs).
const HTML_PRODUCING_FLOWS = new Set<string>([
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

export class FlowExecutionEngine {
  private intentDetector: IntentDetector;
  private handlers: Map<FlowId, FlowHandler>;
  private orchestrator: IntelligentOrchestrator;
  private compositionEngine: FlowCompositionEngine;
  private contextManager: EnhancedContextManager;

  constructor() {
    this.intentDetector = createDetector();
    this.handlers = new Map();
    const flowHistory = getFlowHistory();
    this.orchestrator = new IntelligentOrchestrator(flowHistory);
    this.compositionEngine = new FlowCompositionEngine();
    this.contextManager = new EnhancedContextManager();
    this.initializeHandlers();
    this.initializeValidators();
  }

  private initializeValidators(): void {
    // Register all domain validators for flow execution
    registerFlowDomainValidators(this.compositionEngine);

    // Register context propagation rules for flow sequences
    for (const rule of COMMON_PROPAGATION_RULES) {
      this.contextManager.registerPropagationRule(rule);
    }
  }

  private initializeHandlers(): void {
    // Register all flow handlers with their implementations
    const handlerMap: Array<[FlowId, () => FlowHandler]> = [
      // Tier 1: Strategy/Research
      ['flowA_brand_verify', () => new FlowABrandVerifyHandler()],
      ['flowB_component_research', () => new FlowBComponentResearchHandler()],
      ['flowC_font_research', () => new FlowCFontResearchHandler()],
      ['flowD_reference_inspiration', () => new FlowDReferenceSearchHandler()],
      ['flowE_motion_patterns', () => new FlowEMotionPatternsHandler()],
      // Tier 2: Execution
      ['flowF_design_tokens', () => new FlowFDesignTokensHandler()],
      ['flowG_component_implementation', () => new FlowGComponentImplementationHandler()],
      ['flowH_motion_integration', () => new FlowHMotionIntegrationHandler()],
      ['flowI_accessibility', () => new FlowIAccessibilityHandler()],
      // Tier 3: Polish/QA
      ['flowJ_tactical_polish', () => new FlowJTacticalPolishHandler()],
      ['flowK_multi_lens_audit', () => new FlowKMultiLensAuditHandler()],
      ['flowL_design_critique', () => new FlowLDesignCritiqueHandler()],
      ['flowM_responsive_validation', () => new FlowMResponsiveValidationHandler()],
      ['flowN_rapid_iteration_refined', () => new FlowNRapidIterationHandler()],
      // Tier 4: Special
      ['flowO_clone_match_special', () => new FlowOCloneMatchHandler()],
      ['flowP_constraint_design_special', () => new FlowPConstraintDesignHandler()],
      ['flowQ_migration_special', () => new FlowQMigrationHandler()],
      // Tier 5: Specialized refinement (NEW - impeccable v2.1.9 coverage)
      ['flowR_layout_optimization', () => new FlowRLayoutOptimizationHandler()],
      ['flowS_typography_excellence', () => new FlowSTypographyExcellenceHandler()],
      ['flowT_ambitious_motion', () => new FlowTAmbitiousMotionHandler()],
      // Special: Curate + All-Seven QA (addresses two concrete gaps)
      ['flowU_curate', () => new FlowUCurateHandler()],
      ['flowV_all_seven_qa', () => new FlowVAllSevenQAHandler()],
      // Tier 6: Composition & Copy
      ['flowW_landing_composition', () => new FlowWLandingCompositionHandler()],
      ['flowX_copywriting', () => new FlowXCopywritingHandler()],
      // Legacy flows
      ['flow1_clone_match', () => new Flow1CloneHandler()],
      ['flow2_polish_enhance', () => new Flow2PolishHandler()],
      ['flow3_audit_page', () => new Flow3AuditHandler()],
      ['flow4_explore_discovery', () => new Flow4ExploreHandler()],
      ['flow5_review_qa', () => new Flow5ReviewHandler()],
      ['flow6_constraint_design', () => new Flow6ConstraintHandler()],
      ['flow7_design_component', () => new Flow7DesignHandler()],
      ['flow8_refactor_layout', () => new Flow8RefactorHandler()],
      ['flow9_accessible', () => new Flow9AccessibleHandler()],
      ['flow10_implement_design', () => new Flow10ImplementHandler()],
      ['flow11_extract_tokens', () => new Flow11ExtractHandler()],
      ['flow12_responsive_review', () => new Flow12ResponsiveHandler()],
      ['flow13_rapid_iteration', () => new Flow13IterateHandler()],
      ['flow14_migration', () => new Flow14MigrationHandler()],
    ];

    for (const [flowId, createHandler] of handlerMap) {
      this.handlers.set(flowId, createHandler());
    }
  }

  private recordFlowWithMemory(result: FlowExecutionResult): void {
    const flowHistory = getFlowHistory();
    const entry: any = {
      flowId: result.flowId,
      flowName: result.flowName,
      status: result.status as 'success' | 'error' | 'skipped',
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

    flowHistory.recordFlow(entry as FlowHistoryEntry);
  }

  // Taste validator gate: run validateTaste against the produced HTML for craft/clone-match/layout/polish flows.
  // Mutates result -> status: 'error' with violations summary when target file fails taste checks.
  // Soft-skips when no target file is in context (metadata.targetFile or currentFile ending in .html/.htm).
  private runTasteValidationGate(
    flowId: string,
    context: FlowExecutionContext,
    result: FlowExecutionResult
  ): void {
    if (!HTML_PRODUCING_FLOWS.has(flowId)) return;
    if (result.status !== 'success') return;

    const metaTarget = context.metadata?.targetFile as string | undefined;
    const currentHtml =
      context.currentFile && /\.html?$/i.test(context.currentFile)
        ? context.currentFile
        : undefined;
    const targetFile = metaTarget || currentHtml;
    if (!targetFile) return;

    let html: string;
    try {
      html = fs.readFileSync(targetFile, 'utf8');
    } catch {
      return;
    }

    let css: string | undefined;
    const cssFile = context.metadata?.targetCss as string | undefined;
    if (cssFile) {
      try {
        css = fs.readFileSync(cssFile, 'utf8');
      } catch {
        // CSS optional
      }
    }

    const violations: TasteViolation[] = validateTaste(html, css);
    if (violations.length === 0) return;

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

  private cachedProjectCtx: { path: string; ctx: any } | null = null;

  enrichContextForHandler(
    context: FlowExecutionContext,
    _flowId: string
  ): FlowExecutionContext {
    const projectPath = context.projectPath || process.env.SIDECOACH_PROJECT_PATH;
    if (!projectPath) return context;

    // Per-orchestrator-lifetime cache (re-read only if path changes)
    if (!this.cachedProjectCtx || this.cachedProjectCtx.path !== projectPath) {
      try {
        const ctx = buildProjectContext(projectPath);
        this.cachedProjectCtx = { path: projectPath, ctx };
      } catch {
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
      product: (context.projectContext as any)?.product || { content: loaded.productContent },
    };
    return {
      ...context,
      metadata: enrichedMeta,
      projectContext: enrichedProjectContext as any,
    };
  }

  // Phase III: Performance & Validation Integration
  private validateFlowExecution(flowId: string, context: FlowExecutionContext, result: FlowExecutionResult): void {
    // Run CLAUDE.md mandate validation first (hard blockers)
    const mandateValidation = ClaudemdMandateValidator.validateOutput(result, context);
    if (mandateValidation.blockers.length > 0 || mandateValidation.violations.length > 0) {
      const report = ClaudemdMandateValidator.reportViolations(mandateValidation);
      console.log(`[CLAUDE.md Validation] ${flowId}:\n${report}`);
    }

    // Run flow-specific validators
    const validation = FlowSpecificValidator.validateFlow(flowId, context, result);
    if (validation.warnings.length > 0) {
      console.log(`[Validation Warnings] ${flowId}:`, validation.warnings);
    }
  }

  private cacheFlowResult(flowId: string, result: FlowExecutionResult): void {
    // Cache execution result for performance
    globalPerformanceCache.cacheHandlerResult(flowId as FlowId, result);
  }

  private trackFlowMetrics(flowId: string, flowName: string, executionId: string, result: FlowExecutionResult, context?: FlowExecutionContext): void {
    // Track metrics for this flow execution
    globalMetricsTracker.startTracking(flowId, flowName, executionId);

    // Record guidance as decisions
    if (result.guidance && result.guidance.length > 0) {
      globalMetricsTracker.recordDecision(
        executionId,
        `flow-executed-${flowId}`,
        result.message,
        'high'
      );
    }

    // Record checklist progress
    if (result.checklist) {
      const completed = result.checklist.filter(item => item.completed).length;
      globalMetricsTracker.updateChecklistProgress(executionId, completed, result.checklist.length);
    }

    // Record artifacts
    if (result.artifacts && result.artifacts.length > 0) {
      for (const artifact of result.artifacts) {
        // Map FlowArtifact types to ArtifactRecord types
        const typeMap: Record<string, 'code' | 'checklist' | 'reference' | 'template' | 'guide'> = {
          'script': 'code',
          'command': 'code',
          'checklist': 'checklist',
          'reference': 'reference',
          'template': 'template',
        };
        const recordType = typeMap[artifact.type] || 'template';
        globalMetricsTracker.recordArtifact(executionId, recordType, artifact.name, artifact.description || '');
      }
    }

    // Complete tracking and store metrics
    globalMetricsTracker.completeTracking(executionId, {
      projectPath: context?.projectPath,
      userId: context?.userId,
      metadataKeys: context?.metadata ? Object.keys(context.metadata) : [],
    });
  }

  private determineConditionalFlow(context: FlowExecutionContext): string | null {
    // Evaluate conditional execution routing
    return FlowConditionalRouter.determineRoute(context) || null;
  }

  private getExecutablePath(context: FlowExecutionContext): string[] {
    // Get the conditional execution path for a context
    return FlowConditionalRouter.getExecutablePath(context);
  }

  private processWithEntryPoint(utterance: string, context: Partial<FlowExecutionContext> = {}): { flowIds: FlowId[], entryType: string, primaryFlow?: FlowId } | null {
    // Process utterance through unified entry point system
    const entryPointRequest: EntryPointRequest = {
      utterance,
      userId: context.userId || 'unknown',
      projectPath: context.projectPath || process.cwd(),
      sessionContext: context.metadata,
    };

    const entryPointResponse = globalEntryPoint.process(entryPointRequest);

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

  async process(utterance: string, context: Partial<FlowExecutionContext> = {}): Promise<SidecoachResult> {
    // Step 0: Load project context (PRODUCT.md, DESIGN.md, register detection)
    const projectPath = context.projectPath || process.cwd();
    const loadedContext = buildProjectContext(projectPath);
    const enrichedContext: Partial<FlowExecutionContext> = {
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

    // Step 2: Check for slash commands (deterministic routing)
    const commandMatch = parseSlashCommand(utterance);
    if (commandMatch.isCommand) {
      if (commandMatch.command === 'teach') {
        const teachHandler = new TeachCommandHandler();
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

      if (commandMatch.command === 'list') {
        const byPhase = getCommandsByPhase();
        const groupedGuidance: string[] = [];

        // Build grouped output by phase
        for (const phase of ['Research', 'Implement', 'Review', 'Special']) {
          const phaseCommands = byPhase[phase]?.commands || [];
          if (phaseCommands.length > 0) {
            groupedGuidance.push(`\n## ${phase} Phase (${phaseCommands.length} commands)`);
            for (const cmd of phaseCommands) {
              groupedGuidance.push(`  /sidecoach ${cmd.command} - ${cmd.description} (${cmd.flowCount} flows)`);
            }
          }
        }

        return {
          success: true,
          message: 'Available Sidecoach Commands (grouped by workflow phase)',
          detectedFlow: null,
          flowResults: [],
          guidance: groupedGuidance,
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
        const compositeFlow = PRESET_COMPOSITE_FLOWS.find(cf => cf.id === compositeFlowId);
        if (!compositeFlow) {
          return {
            success: false,
            message: `Composite flow not found: ${compositeFlowId}`,
            detectedFlow: null,
            flowResults: [],
          };
        }

        // Execute composite flow steps
        const executionContext: FlowExecutionContext = {
          utterance,
          userId: context.userId,
          projectPath: context.projectPath || process.cwd(),
          currentFile: context.currentFile,
          selectedText: context.selectedText,
          metadata: { ...context.metadata, compositeFlowId },
        };

        const flowResults: FlowExecutionResult[] = [];
        const flowHistory = getFlowHistory();
        const historyEntries = flowHistory.getFlowSequence();
        const startTime = Date.now();

        for (const step of compositeFlow.steps) {
          const handler = this.handlers.get(step.flowId);
          if (!handler) continue;

          // Check prerequisites
          const prerequisiteCheck = FlowPrerequisiteValidator.canExecute(step.flowId, historyEntries);
          if (!prerequisiteCheck.canExecute) {
            if (step.skipOnError) {
              flowResults.push({
                flowId: step.flowId,
                flowName: step.flowId,
                status: 'skipped',
                message: `Prerequisites not met: ${prerequisiteCheck.reason}`,
                guidance: [],
                checklist: [],
              } as FlowExecutionResult);
              continue;
            } else if (compositeFlow.failOnFirstError) {
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
            } as FlowExecutionResult);
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
              this.contextManager.completeInChain(
                step.flowId,
                result.status === 'success' ? 'completed' : 'error',
                result.message
              );

              // Store execution metadata in result
              result.executionMetadata = {
                executionChain: this.contextManager.getExecutionChain(),
                executionDuration: this.contextManager.getExecutionDuration(step.flowId),
              };

              this.runTasteValidationGate(step.flowId, executionContext, result);
              this.recordFlowWithMemory(result);

              // Apply automatic domain validators based on flow type (soft-fail)
              if (result.status === 'success') {
                const validatorsForFlow = getValidatorsForFlow(step.flowId);
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
                const allPassed = FlowCompositionEngine.allValidationsPassed(validations);
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

              // Apply context transformation if defined
              if (step.transformContext) {
                Object.assign(executionContext, step.transformContext(executionContext, result));
              } else {
                // Default: propagate context
                Object.assign(executionContext,
                  FlowCompositionEngine.propagateContext(executionContext, result)
                );
              }
            } catch (err) {
              const errorResult: FlowExecutionResult = {
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
        let aggregatedGuidance: string[] = [];
        let aggregatedChecklist: any[] = [];
        if (compositeFlow.aggregateResults) {
          const aggregated = FlowCompositionEngine.aggregateResults(flowResults);
          aggregatedGuidance = aggregated.guidance;
          aggregatedChecklist = aggregated.checklist;
        }

        return {
          success: flowResults.some(r => r.status === 'success'),
          message: `Composite flow complete: ${compositeFlow.name} (${flowResults.filter(r => r.status === 'success').length}/${flowResults.length} flows successful, ${totalTime}ms)`,
          detectedFlow: {
            flowId: compositeFlowId as FlowId,
            flowName: compositeFlow.name,
            confidence: 1.0,
          },
          flowResults,
          guidance: aggregatedGuidance.length > 0 ? aggregatedGuidance : undefined,
          checklist: aggregatedChecklist.length > 0 ? aggregatedChecklist : undefined,
        };
      }

      // Route to command's flow chain
      const executionContext: FlowExecutionContext = {
        utterance,
        userId: context.userId,
        projectPath: context.projectPath || process.cwd(),
        currentFile: context.currentFile,
        selectedText: context.selectedText,
        metadata: { ...context.metadata, commandTarget: commandMatch.target },
      };
      const flowResults: FlowExecutionResult[] = [];
      let detectedFlow: { flowId: FlowId; flowName: string; confidence: number } | null = null;
      const flowHistory = getFlowHistory();
      const historyEntries = flowHistory.getFlowSequence();

      for (const flowId of commandMatch.flowIds) {
        const handler = this.handlers.get(flowId);
        if (!handler) continue;

        // Check prerequisites before executing
        const prerequisiteCheck = FlowPrerequisiteValidator.canExecute(flowId, historyEntries);
        if (!prerequisiteCheck.canExecute) {
          flowResults.push({
            flowId,
            flowName: flowId,
            status: 'error',
            message: `Flow prerequisites not met: ${prerequisiteCheck.reason}`,
            guidance: [`Cannot execute ${flowId}: ${prerequisiteCheck.reason}`],
            checklist: [],
            error: prerequisiteCheck.reason,
          } as FlowExecutionResult);
          continue;
        }

        // Check context requirements
        const contextCheck = FlowPrerequisiteValidator.validateContextRequirements(
          flowId,
          executionContext
        );
        if (!contextCheck.valid) {
          flowResults.push({
            flowId,
            flowName: flowId,
            status: 'error',
            message: `Missing context: ${contextCheck.missing?.join(', ')}`,
            guidance: [`Context requirements not met: ${contextCheck.missing?.join(', ')}`],
            checklist: [],
            error: `Missing: ${contextCheck.missing?.join(', ')}`,
          } as FlowExecutionResult);
          continue;
        }

        // Enrich context FIRST so canExecute sees the same data as execute (T11 carryover fix).
        const enrichedCtx = this.enrichContextForHandler(executionContext, flowId);
        if (handler.canExecute(enrichedCtx)) {
          // Track flow entry in execution chain
          this.contextManager.addToExecutionChain(flowId, flowId);

          const result = await handler.execute(enrichedCtx);

          // Track flow completion and store metadata
          this.contextManager.completeInChain(
            flowId,
            result.status === 'success' ? 'completed' : 'error',
            result.message
          );

          // Store execution metadata in result
          result.executionMetadata = {
            executionChain: this.contextManager.getExecutionChain(),
            executionDuration: this.contextManager.getExecutionDuration(flowId),
          };

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
      }
      return {
        success: flowResults.some((r) => r.status === 'success'),
        message: `Executed ${commandMatch.command} flow chain (${flowResults.filter((r) => r.status === 'success').length}/${flowResults.length} flows successful)`,
        detectedFlow,
        flowResults,
      };
    }

    // Step 1: Detect intent (falls back to intent detection if not a slash command)
    const detection = this.intentDetector.detect(utterance);

    // Handle no matches
    if (Array.isArray((detection as DisambiguationResult).candidates) && (detection as DisambiguationResult).candidates.length === 0) {
      return {
        success: false,
        message: 'Could not understand your request. Please try rephrasing.',
        detectedFlow: null,
        flowResults: [],
      };
    }

    // Handle ambiguous matches
    if ((detection as DisambiguationResult).isAmbiguous && !(detection as MatchResult).flowId) {
      const candidates = (detection as DisambiguationResult).candidates || [];
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
    const match = (detection as MatchResult).flowId
      ? (detection as MatchResult)
      : (detection as DisambiguationResult).recommendation;

    if (!match || !match.flowId) {
      return {
        success: false,
        message: 'Could not determine flow.',
        detectedFlow: null,
        flowResults: [],
      };
    }

    // Prepare execution context (shared across all flows in the chain)
    const executionContext: FlowExecutionContext = {
      utterance,
      userId: context.userId,
      projectPath: context.projectPath || process.cwd(),
      currentFile: context.currentFile,
      selectedText: context.selectedText,
      metadata: context.metadata,
    };

    // Execute flow chain: initial flow + any automatically recommended follow-ups
    const flowResults: FlowExecutionResult[] = [];
    const flowHistory = getFlowHistory();
    const validator = new DeterministicValidator();
    const debtTracker = new DesignDebtTracker(executionContext.projectPath);

    // CRITICAL: Load and cache project context before Flow A execution
    // All downstream flows depend on register detection and cached design laws
    const contextLoader = new ContextLoader();
    const projectContext = contextLoader.load(executionContext.projectPath!);
    executionContext.projectContext = projectContext;

    // Run Flow A to verify brand register and cache design laws
    const flowAHandler = new FlowABrandVerifyHandler();

    // Track Flow A execution in context chain
    this.contextManager.addToExecutionChain('flowA_brand_verify', 'Brand/PRODUCT.md Verification');

    const flowAResult = await flowAHandler.execute(executionContext);

    // Complete Flow A in execution chain and store metadata
    this.contextManager.completeInChain(
      'flowA_brand_verify',
      flowAResult.status === 'success' ? 'completed' : 'error',
      flowAResult.message
    );

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

    let currentFlowId: FlowId | undefined = match.flowId;
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
      const flowDef = getFlow(currentFlowId);
      const flowName = flowDef?.name || 'Unknown';

      // Validate real prerequisites (DeterministicValidator: hard gates)
      const validation = validator.validate(currentFlowId, executionContext, flowHistory);

      // Auto-log warning violations as design debt (DesignDebtTracker)
      if (currentFlowId) {
        const flowIdForDebt = currentFlowId as FlowId; // Type guard for TS
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
        const skipResult: FlowExecutionResult = {
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
        const skipResult: FlowExecutionResult = {
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
      let result: FlowExecutionResult;
      const enhancedContext = EnhancedContextManager.createEnhancedContext(
        executionContext,
        currentFlowId,
        flowName
      ) as EnhancedFlowExecutionContext;

      // Track flow entry in execution chain
      this.contextManager.addToExecutionChain(currentFlowId, flowName);

      try {
        // Execute the handler
        result = await handler.execute(enrichedCtxForNatural);

        // Track flow completion in execution chain
        this.contextManager.completeInChain(
          currentFlowId,
          result.status === 'success' ? 'completed' : 'error',
          result.message
        );
      } catch (error) {
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
      const validatorsForFlow = getValidatorsForFlow(currentFlowId);
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
      const regressionDetector = new RegressionDetector();
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
        } else if (warningRegressions.length > 0) {
          // Guidance/checklist drops: warn but continue
          const warningMessages = warningRegressions.map((w) => w.message).join('; ');
          result.message = `${result.message}\n\n⚠️ Warning: ${warningMessages}`;
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
      } else if (result.status === 'needs_input' || result.status === 'error') {
        // Stop chaining on error or incomplete flow
        currentFlowId = undefined;
      } else {
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
    persistSessionMemory(executionContext.projectPath);

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

  private showInteractiveMenu(context: Partial<FlowExecutionContext>): SidecoachResult {
    const byPhase = getCommandsByPhase();
    const menuItems: string[] = [];
    let itemNum = 1;
    const commandMap: Record<number, string> = {};

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

  registerHandler(handler: FlowHandler): void {
    this.handlers.set(handler.flowId, handler);
  }

  /**
   * Read-only view of the registered handler map. Used by CLI tools that need to
   * enumerate or dispatch by FlowId. Caller must not mutate.
   */
  getHandlers(): ReadonlyMap<FlowId, FlowHandler> {
    return this.handlers;
  }

  getAvailableFlows(): FlowInfo[] {
    const flowIds: FlowId[] = [
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
        const flow = getFlow(flowId);
        return flow
          ? {
              flowId,
              name: flow.name,
              description: flow.description,
            }
          : null;
      })
      .filter((f) => f !== null) as FlowInfo[];
  }
}

export interface FlowInfo {
  flowId: FlowId;
  name: string;
  description: string;
}

export interface SidecoachResult {
  success: boolean;
  message: string;
  detectedFlow: { flowId: FlowId; flowName: string; confidence: number } | null;
  flowResults: FlowExecutionResult[];
  guidance?: string[];
  checklist?: any[];
  artifacts?: any[];
  ambiguousCandidates?: Array<{ flowId: FlowId; flowName: string; confidence: number }>;
}

export function createExecutionEngine(): FlowExecutionEngine {
  return new FlowExecutionEngine();
}
