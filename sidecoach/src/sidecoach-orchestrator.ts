import * as fs from 'fs';
import { validateTaste, TasteViolation, toValidationResult as tasteToValidationResult } from './taste-validator';
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
import { parseSlashCommand, getAvailableCommands, getCommandsByPhase, getVerbCommandInfo, resolveSidecoachInput } from './slash-command-router';
import { LANES, getLane } from './lanes.generated';
import { convergencePreflight } from './lane-convergence-preflight';
import * as path from 'path';
import { createHash } from 'crypto';
import { SidecoachEntryPoint, globalEntryPoint, EntryPointRequest } from './sidecoach-entry-point';
import { TeachCommandHandlerV2 } from './teach-command-handler-v2';
import { DocumentCommandHandler } from './document-command-handler';
import { FlowPrerequisiteValidator } from './flow-prerequisites';
import * as laneRunner from './lane-runner';
import { LaneCheckpointStore } from './lane-checkpoint-store';
import { getValidatorRegistration } from './flow-validation-capabilities';
import type { LaneTransition, LaneStepResult } from './lane-types';
import { FlowCompositionEngine, PRESET_COMPOSITE_FLOWS, CompositeFlowDefinition } from './flow-composition';
import { registerFlowDomainValidators, getValidatorsForFlow } from './flow-domain-validators';
import { EnhancedContextManager, EnhancedFlowExecutionContext, COMMON_PROPAGATION_RULES } from './flow-execution-context-enhanced';
import { FlowABrandVerifyHandler } from './flow-handler-brand-verify';
import { FlowBComponentResearchHandler } from './flow-handler-component-research';
import { FlowCFontResearchHandler } from './flow-handler-font-research';
import { FlowDReferenceSearchHandler } from './flow-handler-design-references';
import { FlowEMotionPatternsHandler } from './flow-handler-motion-patterns';
// T-0015: legacy number-prefixed handlers were culled (12 duplicates removed; flow7 -> flowZ, flow4 -> flowY).
import { FlowZDesignHandler } from './flow-handlers-core';
import { FlowYExploreHandler } from './flow-handlers-extended';
import { FlowFDesignTokensHandler } from './flow-handler-design-tokens';
import { FlowGComponentImplementationHandler } from './flow-handler-component-implementation';
import { FlowHMotionIntegrationHandler } from './flow-handler-motion-integration';
import { FlowIAccessibilityHandler } from './flow-handler-accessibility';
import { FlowJTacticalPolishHandler } from './flow-handler-tactical-polish';
import { FlowMResponsiveValidationHandler } from './flow-handler-responsive-validation';
import {
  FlowKMultiLensAuditHandler,
  FlowLDesignCritiqueHandler,
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
import { BuildReport } from './build-report-types';
import { generateBuildReport, renderBuildReportMarkdown } from './build-report-aggregator';
import { assemblePanelModel, laneStepToPanelModel } from './panel-model';
import { renderSidecoachPanel } from './panel-renderer';
import { CheckpointStore, SidecoachCheckpoint } from './checkpoint-store';
import { getVerbEntry, VerbCommandEntry } from './verb-command-registry';

// Flows that produce HTML output and must clear the taste gate before declaring success.
// craft / clone-match / layout / polish families. Post-T-0015 cull: legacy flowN_* IDs gone;
// flow7_design_component renamed to flowZ_design_component.
const HTML_PRODUCING_FLOWS = new Set<string>([
  'flowG_component_implementation',
  'flowJ_tactical_polish',
  'flowO_clone_match_special',
  'flowR_layout_optimization',
  'flowZ_design_component',
]);

export class FlowExecutionEngine {
  private intentDetector: IntentDetector;
  private handlers: Map<FlowId, FlowHandler>;
  private orchestrator: IntelligentOrchestrator;
  private compositionEngine: FlowCompositionEngine;
  private contextManager: EnhancedContextManager;
  private checkpointStore: CheckpointStore | null = null;
  private gcRan = false;

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
      // Tier 5: Specialized refinement (NEW - v2.1.9 coverage)
      ['flowR_layout_optimization', () => new FlowRLayoutOptimizationHandler()],
      ['flowS_typography_excellence', () => new FlowSTypographyExcellenceHandler()],
      ['flowT_ambitious_motion', () => new FlowTAmbitiousMotionHandler()],
      // Special: Curate + All-Seven QA (addresses two concrete gaps)
      ['flowU_curate', () => new FlowUCurateHandler()],
      ['flowV_all_seven_qa', () => new FlowVAllSevenQAHandler()],
      // Tier 6: Composition & Copy
      ['flowW_landing_composition', () => new FlowWLandingCompositionHandler()],
      ['flowX_copywriting', () => new FlowXCopywritingHandler()],
      // Tier 7: Renamed legacy (T-0015) - genuinely separate flows kept with letter prefix
      ['flowY_explore_discovery', () => new FlowYExploreHandler()],
      ['flowZ_design_component', () => new FlowZDesignHandler()],
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

  /**
   * Run the composite-flow execution loop. Extracted from `process()` so both the
   * new-run path and the (forthcoming T5) resume path can share it.
   * Pure refactor in T3 - no new behavior, no checkpoint writes (those come in T4).
   */
  private async runCompositeLoop(
    compositeFlow: CompositeFlowDefinition,
    executionContext: FlowExecutionContext,
    flowResults: FlowExecutionResult[],
    startIndex: number,
    utterance: string,
  ): Promise<SidecoachResult> {
    const flowHistory = getFlowHistory();
    const historyEntries = flowHistory.getFlowSequence();
    const startTime = Date.now();

    // Phase 6 part 2: stable run-start timestamp so the same file is overwritten in place across steps.
    const runStartIso = new Date().toISOString().replace(/[:.]/g, '');
    const runCheckpointId = `sidecoach-${compositeFlow.id}-${runStartIso}`;
    let lastCheckpointId: string | undefined;
    let checkpointDisabled = false;

    for (let stepIndex = startIndex; stepIndex < compositeFlow.steps.length; stepIndex++) {
      const step = compositeFlow.steps[stepIndex];
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

          // Phase 6 part 2: persist a checkpoint after each successful step.
          if (result.status === 'success' && this.checkpointStore && !checkpointDisabled) {
            const checkpoint: SidecoachCheckpoint = {
              schemaVersion: 1,
              checkpointId: runCheckpointId,
              compositeFlowId: compositeFlow.id as any,
              createdAt: new Date().toISOString(),
              cursor: stepIndex + 1,
              completedStepIds: flowResults.map((r) => r.flowId as any),
              flowResults,
              executionContext,
              utterance,
            };
            try {
              this.checkpointStore.writeCheckpoint(checkpoint);
              lastCheckpointId = runCheckpointId;
            } catch (err) {
              process.stderr.write(`[sidecoach] checkpoint write failed at step ${stepIndex} (continuing without resume capability): ${(err as Error).message}\n`);
              checkpointDisabled = true;
            }
          }

          // Sprint 7 T6: ClaudemdMandate validation -> push ValidationResult so BuildReport picks it up.
          if (result.status === 'success') {
            try {
              const mandateReport = ClaudemdMandateValidator.validateOutput(result, executionContext);
              result.validationResults = result.validationResults || [];
              result.validationResults.push(ClaudemdMandateValidator.toValidationResult(mandateReport));
            } catch (err) {
              process.stderr.write(`[sidecoach] ClaudemdMandate validation failed at step ${stepIndex} (continuing): ${(err as Error).message}\n`);
            }
          }

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

    // Phase 5 (Surface A): generate a Build Report aggregating validator findings.
    const buildReport = generateBuildReport({
      source: 'flow-results',
      flowResults,
      composite: compositeFlow.id,
    });
    const buildReportMarkdown = renderBuildReportMarkdown(buildReport);
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
      } catch (err) {
        process.stderr.write(`[sidecoach] checkpoint cleanup failed (will be GC'd later): ${(err as Error).message}\n`);
      }
    }

    return {
      success: flowResults.some(r => r.status === 'success'),
      message: `Composite flow complete: ${compositeFlow.name} (${flowResults.filter(r => r.status === 'success').length}/${flowResults.length} flows successful, ${totalTime}ms)`,
      detectedFlow: {
        flowId: compositeFlow.id as FlowId,
        flowName: compositeFlow.name,
        confidence: 1.0,
      },
      flowResults,
      guidance: aggregatedGuidance.length > 0 ? aggregatedGuidance : undefined,
      checklist: aggregatedChecklist.length > 0 ? aggregatedChecklist : undefined,
      artifacts: [buildReportArtifact],
      buildReport,
      panel: renderSidecoachPanel(assemblePanelModel({ flowResults, report: buildReport, confidence: 1.0 })),
    };
  }

  /**
   * Resume a composite run from a saved checkpoint. Seeds runCompositeLoop with
   * the checkpoint's executionContext + flowResults + cursor + utterance. The
   * loop mints a fresh runStartIso, so the resumed run writes to a NEW
   * checkpoint file. The caller (process() resume branch) deletes the original
   * pre-resume checkpoint after this method returns. (Sprint 6 T5.)
   */
  private async runCompositeFromCheckpoint(
    compositeFlow: CompositeFlowDefinition,
    checkpoint: SidecoachCheckpoint,
  ): Promise<SidecoachResult> {
    return this.runCompositeLoop(
      compositeFlow,
      checkpoint.executionContext,
      [...checkpoint.flowResults],
      checkpoint.cursor,
      checkpoint.utterance,
    );
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

    // Sprint 7: always push a ValidationResult so BuildReport sees the outcome.
    result.validationResults = result.validationResults || [];
    result.validationResults.push(tasteToValidationResult(violations));

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

  private enrichContextForHandler(
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

    // Phase 6 part 2: lazy CheckpointStore boot + 7-day GC sweep (runs once per engine instance).
    // Must run BEFORE the slash-command branch so the composite-flow path can write checkpoints.
    if (!this.checkpointStore || !this.gcRan) {
      this.checkpointStore = new CheckpointStore(context.projectPath || process.cwd());
      try {
        this.checkpointStore.gcOldCheckpoints(7);
      } catch (err) {
        process.stderr.write(`[sidecoach] checkpoint GC failed (continuing): ${(err as Error).message}\n`);
      }
      this.gcRan = true;
    }

    // Sprint 9 Bug 2: auto-stage parsed DESIGN.md tokens into context.metadata.designTokens
    try {
      const projCtx = buildProjectContext(context.projectPath || process.cwd());
      if (projCtx.parsedDesignTokens && !context.metadata?.designTokens) {
        context.metadata = {
          ...(context.metadata || {}),
          designTokens: projCtx.parsedDesignTokens,
        };
      }
    } catch (err) {
      process.stderr.write(`[sidecoach] designTokens auto-load failed (continuing): ${(err as Error).message}\n`);
    }

    // Step 2: Check for slash commands (deterministic routing)
    const commandMatch = parseSlashCommand(utterance);
    if (commandMatch.isCommand) {
      if (commandMatch.command === 'teach') {
        const teachHandler = new TeachCommandHandlerV2();
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
        const docHandler = new DocumentCommandHandler();
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
        const byPhase = getCommandsByPhase();
        const verbCommands = getVerbCommandInfo();
        const groupedGuidance: string[] = [
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
        const entry = getVerbEntry(verb);
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
          detectedFlow: { flowId: 'help' as any, flowName: 'Sidecoach Help', confidence: 1.0 },
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

        return this.runCompositeLoop(compositeFlow, executionContext, [], 0, utterance);
      }

      // Route to command's flow chain
      // Sprint 10 Bug 1 + Sprint 12 T5: always auto-build projectContext from
      // PRODUCT.md / DESIGN.md on the project root, then overlay any caller-passed
      // projectContext on top. Pre-T5 the auto-build was skipped entirely when
      // the caller supplied ANY partial projectContext (e.g. just `{ register }`),
      // which left handlers without product.brandPersonality and caused flowB/E
      // to reject in canExecute.
      let autoBuiltProjectContext: any = {};
      try {
        autoBuiltProjectContext = buildProjectContext(context.projectPath || process.cwd()) || {};
      } catch (err) {
        // Soft-fail - autoBuiltProjectContext stays empty
      }
      const userPassedProjectContext: any = (context as any).projectContext || {};
      const projectContextForChain: any = {
        ...autoBuiltProjectContext,
        ...userPassedProjectContext,
      };
      const executionContext: FlowExecutionContext = {
        utterance,
        userId: context.userId,
        projectPath: context.projectPath || process.cwd(),
        currentFile: context.currentFile,
        selectedText: context.selectedText,
        projectContext: projectContextForChain,
        metadata: { ...context.metadata, commandTarget: commandMatch.target },
      };
      const flowResults: FlowExecutionResult[] = [];
      let detectedFlow: { flowId: FlowId; flowName: string; confidence: number } | null = null;
      const flowHistory = getFlowHistory();

      for (const flowId of commandMatch.flowIds) {
        const handler = this.handlers.get(flowId);
        if (!handler) continue;

        try {
          // Sprint 12 T4: refresh history snapshot each iteration so chain-mates
          // that just finished (recorded by recordFlowWithMemory) are visible to
          // the next prereq check. The pre-Sprint-12 single-snapshot version
          // caused every chain dependent (F needs A, G needs B, ...) to fail
          // even though the prior step had just succeeded.
          const historyEntries = flowHistory.getFlowSequence();

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

            // Sprint 7 T6: ClaudemdMandate validation for single-flow execution path.
            if (result.status === 'success') {
              try {
                const mandateReport = ClaudemdMandateValidator.validateOutput(result, executionContext);
                result.validationResults = result.validationResults || [];
                result.validationResults.push(ClaudemdMandateValidator.toValidationResult(mandateReport));
              } catch (err) {
                process.stderr.write(`[sidecoach] ClaudemdMandate validation failed (continuing): ${(err as Error).message}\n`);
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
          } else {
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
            } as any);
          }
        } catch (err) {
          // Sprint 9 T3: continue past errors so downstream flows still attempt.
          // Dogfood showed flowH/flowI silently dropped from the chain when an
          // earlier flow threw. Record the error as a flowResult entry and let
          // the for-loop proceed to the next flow.
          const message = (err as Error)?.message ?? String(err);
          process.stderr.write(`[sidecoach] Flow ${flowId} threw (continuing chain): ${message}\n`);
          flowResults.push({
            flowId,
            flowName: flowId,
            status: 'error',
            message: `Flow execution failed: ${message}`,
            guidance: [`Flow ${flowId} threw an exception: ${message}`],
            checklist: [],
            error: String(err),
          } as FlowExecutionResult);
        }
      }
      // Sprint 8 T7: append verb-command guidance after the chain executes.
      // Only fires for verbs that have a registry entry (the 22 verb command
      // verbs); phase commands like 'research' or 'review' return null from
      // getVerbEntry and are unaffected.
      const chainGuidanceAppend = commandMatch.command
        ? this.buildVerbGuidanceAppend(commandMatch.command)
        : null;
      const chainGuidance: string[] = [];
      for (const fr of flowResults) {
        if (fr.guidance && fr.guidance.length > 0) {
          chainGuidance.push(...fr.guidance);
        }
      }
      if (chainGuidanceAppend) {
        chainGuidance.push(...chainGuidanceAppend);
      }

      // Round 2 (C4): generate BuildReport for verb-chain executions too.
      // The composite path and single-flow opt-in path both already generated
      // BuildReports; the verb-chain path (used by every /sidecoach <verb>
      // invocation) silently dropped them, which is why `buildReport: (none)`
      // showed in dogfood output even though flowJ pushed validationResults.
      let chainBuildReport: BuildReport | undefined;
      try {
        chainBuildReport = generateBuildReport({
          source: 'flow-results',
          flowResults,
          composite: commandMatch.command,
        });
      } catch (err) {
        process.stderr.write(`[sidecoach] BuildReport generation failed (chain): ${(err as Error).message}\n`);
      }

      return {
        success: flowResults.some((r) => r.status === 'success'),
        message: `Executed ${commandMatch.command} flow chain (${flowResults.filter((r) => r.status === 'success').length}/${flowResults.length} flows successful)`,
        detectedFlow,
        flowResults,
        guidance: chainGuidance.length > 0 ? chainGuidance : undefined,
        buildReport: chainBuildReport,
        panel: renderSidecoachPanel(assemblePanelModel({ flowResults, report: chainBuildReport, confidence: detectedFlow?.confidence })),
      };
    }

    // Step 2.5: /sidecoach <phrase> live wiring. Known verbs/phase commands were
    // handled above (commandMatch.isCommand). Only an unrecognized `/sidecoach
    // <phrase>` reaches the classifier here; everything else (bare /sidecoach,
    // non-/sidecoach utterances) is 'not-addressed' and falls through unchanged.
    const laneResolution = resolveSidecoachInput(utterance, path.resolve(__dirname, '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json'));
    if (laneResolution.source === 'phrase' && laneResolution.phrase) {
      const pr = laneResolution.phrase;
      if (pr.kind === 'ROUTE' && pr.lane) {
        // deterministic id: a literal retry of the same phrase+project does NOT
        // double-start (startLane dedups on startRequestId).
        const startReq = laneStartRequestId(utterance, projectPath);
        const lane = await this.startLane(pr.lane, utterance, { projectPath, userId: context.userId, metadata: context.metadata }, startReq);
        return { success: true, message: `Routed to ${lane.laneLabel}: ${lane.message}`, detectedFlow: null, flowResults: [], guidance: lane.guidance, checklist: lane.checklist, lane };
      }
      if (pr.kind === 'CLASSIFY' && pr.lane) {
        // One-question interview: surface the candidate so the model can confirm.
        // Confirmation dispatches IDENTICALLY to ROUTE - the model calls
        // engine.startLane(classify.laneId, ...), the same terminal path ROUTE uses.
        // (The AskUserQuestion surface itself is a P4 hook/MCP concern; P2 exposes
        // the candidate + the dispatch path so CLASSIFY is not a dead end.)
        const cand = LANES.find((l) => l.lane === pr.lane);
        return { success: true, message: `That reads like the "${cand?.interviewLabel ?? pr.lane}" direction. Confirm to start it, or rephrase for a different lane.`, detectedFlow: null, flowResults: [], guidance: [], checklist: [], classify: { laneId: pr.lane, label: cand?.label ?? pr.lane, interviewLabel: cand?.interviewLabel ?? pr.lane } };
      }
      if (pr.kind === 'OUT_OF_SCOPE') {
        return { success: true, message: pr.redirect || 'That reads as non-UI work. Sidecoach covers UI/design only.', detectedFlow: null, flowResults: [], guidance: [], checklist: [] };
      }
      // UNKNOWN
      return { success: true, message: pr.suggestion ? `Unrecognized - ${pr.suggestion}` : 'Unrecognized /sidecoach phrase.', detectedFlow: null, flowResults: [], guidance: [], checklist: [] };
    }

    // Step 1: Detect intent (falls back to intent detection if not a slash command).
    // metadata.forceFlowId bypass: skip intent detection and route directly to the
    // named flow. Used by the disambiguation UI to re-invoke after the user picks
    // a candidate (Sprint 5 / Phase 6 T3).
    const forceFlowId = (context.metadata as any)?.forceFlowId as string | undefined;
    let detection: MatchResult | DisambiguationResult;
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
        flowId: forceFlowId as FlowId,
        flowName: forceFlowId,
        confidence: 1.0,
        matchedTokens: ['forceFlowId'],
        reason: 'metadata.forceFlowId bypass',
      } as MatchResult;
    } else {
      detection = this.intentDetector.detect(utterance);
    }

    // Phase 6 part 2: metadata.resumeFromCheckpoint bypass.
    // Routes process() directly to the saved composite from the checkpoint's cursor,
    // skipping intent detection and the normal composite-routing logic.
    const resumeId = (context as any)?.metadata?.resumeFromCheckpoint as string | undefined;
    if (resumeId) {
      if (!this.checkpointStore) {
        return {
          success: false,
          message: 'Cannot resume: checkpoint store not initialized',
          detectedFlow: null,
          flowResults: [],
        };
      }
      let checkpoint: SidecoachCheckpoint;
      try {
        checkpoint = this.checkpointStore.readCheckpoint(resumeId);
      } catch (err) {
        return {
          success: false,
          message: `Cannot resume: ${(err as Error).message}`,
          detectedFlow: null,
          flowResults: [],
        };
      }
      const compositeFlow = PRESET_COMPOSITE_FLOWS.find((cf) => cf.id === checkpoint.compositeFlowId);
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
      } catch (err) {
        process.stderr.write(`[sidecoach] resume cleanup of original checkpoint failed (will be GC'd later): ${(err as Error).message}\n`);
      }
      return result;
    }

    // Handle no matches
    if (Array.isArray((detection as DisambiguationResult).candidates) && (detection as DisambiguationResult).candidates.length === 0) {
      return {
        success: false,
        message: 'Could not understand your request. Please try rephrasing.',
        detectedFlow: null,
        flowResults: [],
      };
    }

    // Handle ambiguous matches with tiered resolution.
    if ((detection as DisambiguationResult).isAmbiguous && !(detection as MatchResult).flowId) {
      const disambig = detection as DisambiguationResult;
      const candidates = disambig.candidates || [];

      // Silent path: if the intent-detector resolved the tie via a programmer-set
      // recommendation (not alphabetical fallback), promote the winner to a
      // MatchResult and let the normal execution path take over.
      if (
        disambig.tieBreak &&
        typeof disambig.tieBreak.reason === 'string' &&
        disambig.tieBreak.reason.startsWith('Used recommendation field')
      ) {
        const winnerFlow = candidates.find((c) => c.flowId === disambig.tieBreak!.chosenFlowId);
        if (winnerFlow) {
          detection = winnerFlow as MatchResult;
        } else {
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
      } else {
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

      // Sprint 7 T6: ClaudemdMandate validation for single-flow chain path.
      if (result.status === 'success') {
        try {
          const mandateReport = ClaudemdMandateValidator.validateOutput(result, executionContext);
          result.validationResults = result.validationResults || [];
          result.validationResults.push(ClaudemdMandateValidator.toValidationResult(mandateReport));
        } catch (err) {
          process.stderr.write(`[sidecoach] ClaudemdMandate validation failed (continuing): ${(err as Error).message}\n`);
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

    // Phase 5 (Surface B): opt-in build report for natural-language / single-flow execution.
    let buildReportSingle: BuildReport | undefined;
    if ((context.metadata as any)?.emitBuildReport === true && flowResults.length > 0) {
      buildReportSingle = generateBuildReport({
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
      panel: renderSidecoachPanel(assemblePanelModel({ flowResults, report: buildReportSingle, confidence: match.confidence })),
    };
  }

  /**
   * Sprint 8 T7: Build the verb-command guidance-append block.
   * Returns the array of strings to append to result.guidance for verbs that
   * have a registry entry (the 22 verb commands). The returned
   * array includes the parityChecklist and parityPlus tokens verbatim so the
   * sprint8 parity test sees them in the flattened output.
   */
  private buildVerbGuidanceAppend(command: string): string[] | null {
    const entry: VerbCommandEntry | undefined = getVerbEntry(command);
    if (!entry) return null;
    const appended: string[] = [
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

  // ---- Lane execution (P2) -------------------------------------------------
  // The engine's runFlow reuses the SAME private path process() uses: enrich
  // context, check the REAL prerequisite graph + canExecute (degraded guidance
  // if either fails), then execute (wrapped in try/catch). So lane guidance
  // matches normal flow guidance, and a throwing/degraded flow is NEVER attested.
  private laneDeps(projectPath: string): laneRunner.LaneRunnerDeps {
    return {
      store: new LaneCheckpointStore(projectPath),
      runFlow: async (flowId, context) => {
        const handler = this.getHandlers().get(flowId);
        if (!handler) return { flowId, flowName: String(flowId), status: 'skipped', message: `no handler for ${flowId}`, guidance: [], checklist: [] };
        // Honor the REAL prerequisite graph (same posture as process():917-948):
        // treat the lane's waived edges for THIS flow as satisfied, then check
        // against the flows completed so far in this lane run.
        const completed: string[] = Array.isArray(context.completedFlowIds) ? context.completedFlowIds : [];
        const waivedForFlow = (Array.isArray(context.waivers) ? context.waivers : [])
          .filter((w: any) => w.dependentFlowId === flowId).map((w: any) => w.prerequisiteFlowId);
        const history = [...new Set<string>([...completed, ...waivedForFlow])].map((f) => ({ flowId: f, status: 'success' } as any));
        const prereq = FlowPrerequisiteValidator.canExecute(flowId, history);
        const enriched = this.enrichContextForHandler({ utterance: '', projectPath, ...context }, flowId);
        if (!prereq.canExecute || !handler.canExecute(enriched)) {
          const why = prereq.reason || 'context not fully ready';
          // degraded: coach, but do NOT let the model attest this flow's work as run
          return { flowId, flowName: String(flowId), status: 'needs_input', message: `coaching-only: ${flowId} (${why})`, guidance: [`(${flowId}) ${why} - coaching guidance only; this flow's work is not attested as done.`], checklist: [] };
        }
        // Mirror process()'s exception posture: a throwing handler degrades to an
        // 'error' result (NOT a success), so it is never attested into completedFlowIds.
        try {
          return await handler.execute(enriched);
        } catch (e) {
          return { flowId, flowName: String(flowId), status: 'error', message: `handler ${flowId} threw: ${(e as Error).message}`, guidance: [`(${flowId}) the flow handler errored; coaching only - not attested as done.`], checklist: [] };
        }
      },
      now: () => new Date().toISOString(),
      newCheckpointId: () => `lane-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      newOperationId: () => 'op-' + createHash('sha256').update(`${process.pid}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16),
      runValidator: async (validatorId, validatorContext, signal) => {
        const reg = getValidatorRegistration(validatorId);
        if (!reg || !reg.validateProduct) throw new Error(`laneDeps.runValidator: no validator "${validatorId}"`);
        return reg.validateProduct(validatorContext, signal);
      },
    };
  }
  async startLane(laneId: string, target: string, context: { projectPath?: string } & Record<string, any>, startRequestId: string, renderUrl?: string): Promise<LaneStepResult> {
    const projectPath = context.projectPath || process.cwd();
    // Loop lanes get the policy-wide coverage-plan preflight (spec lines 1018-1023): a
    // target that cannot satisfy the release floor is rejected here, not started into a
    // permanently-inconclusive loop. (laneRunner.startLane keeps the cheap policy check.)
    if (getLane(laneId)?.executionKind === 'loop') {
      const pf = await convergencePreflight(projectPath, laneId);
      if (!pf.ok) throw new Error(pf.message);
    }
    const started = await laneRunner.startLane(laneId, target, { ...context, projectPath }, startRequestId, this.laneDeps(projectPath), renderUrl);
    try { started.panel = renderSidecoachPanel(laneStepToPanelModel(started)); } catch { /* panel is best-effort */ }
    return started;
  }
  async advanceLane(projectPath: string, checkpointId: string, transition: LaneTransition): Promise<LaneStepResult> {
    const advanced = await laneRunner.advanceLane(projectPath, checkpointId, transition, this.laneDeps(projectPath));
    try { advanced.panel = renderSidecoachPanel(laneStepToPanelModel(advanced)); } catch { /* panel is best-effort */ }
    return advanced;
  }
  laneStatus(projectPath: string, checkpointId: string) { return laneRunner.laneStatus(projectPath, checkpointId, this.laneDeps(projectPath)); }
  listLanes(projectPath: string, options?: { all?: boolean }) { return laneRunner.listLanes(projectPath, this.laneDeps(projectPath), options); }

  /**
   * Union of all known flow ids - single handlers + composite preset ids.
   * Used by the metadata.forceFlowId bypass to validate caller-supplied flow ids
   * before routing past intent detection.
   */
  private getAllKnownFlowIds(): string[] {
    const handlerIds = Array.from(this.handlers.keys()) as string[];
    const compositeIds = PRESET_COMPOSITE_FLOWS.map((cf) => cf.id);
    return [...handlerIds, ...compositeIds];
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
      // Tier 7: Renamed legacy (T-0015) - unique flows preserved
      'flowY_explore_discovery',
      'flowZ_design_component',
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
  buildReport?: BuildReport;
  // Pre-rendered compact panel (route/flow/checklist/gates/verdict) the caller
  // prints verbatim - the at-a-glance progress card that replaces verbose output.
  panel?: string;
  // Phase 6 disambiguation: when set, the caller should render an AskUserQuestion
  // with `ambiguousCandidates` and re-invoke engine.process(utterance, {metadata: {forceFlowId: chosenFlowId}}).
  needsDisambiguation?: boolean;
  // Pre-rendered prompt string the caller can surface directly. Includes the original utterance.
  disambiguationPrompt?: string;
  // Lane execution (P2): set when a /sidecoach <phrase> ROUTEs to and starts a lane.
  lane?: LaneStepResult;
  // Lane execution (P2): set when a /sidecoach <phrase> CLASSIFYs to a candidate lane
  // the model can confirm (confirming dispatches engine.startLane, same path as ROUTE).
  classify?: { laneId: string; label: string; interviewLabel: string };
}

// module-level helper: deterministic start-request id from phrase + project so a
// literal retry of the same phrase does not create a second lane. Canonicalize the
// project path (realpath) so it keys on the SAME canonical path the checkpoint
// store uses - otherwise a symlinked vs real spelling of the same dir would hash
// to different ids and defeat dedup against the (realpath-scoped) store.
function laneStartRequestId(utterance: string, projectPath: string): string {
  let canon = projectPath;
  try { canon = fs.realpathSync(projectPath); } catch { /* unresolvable path -> hash the raw spelling */ }
  return 'proc-' + createHash('sha256').update(`${canon}\n${utterance.trim()}`).digest('hex').slice(0, 24);
}

export function createExecutionEngine(): FlowExecutionEngine {
  return new FlowExecutionEngine();
}
