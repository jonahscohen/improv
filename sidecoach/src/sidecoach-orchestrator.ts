import { createDetector, IntentDetector } from './intent-detector';
import { FlowHandler, FlowExecutionContext, FlowExecutionResult, BaseFlowHandler } from './flow-handler';
import { FlowId, MatchResult, DisambiguationResult } from './types';
import { getFlow } from './flows';
import { getFlowHistory } from './flow-history';
import { SidecoachOrchestrator as IntelligentOrchestrator } from './orchestrator';
import { DeterministicValidator } from './deterministic-validator';
import { RegressionDetector } from './regression-detector';
import { DesignDebtTracker } from './design-debt-tracker';
import { ContextLoader } from './project-context';
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

export class FlowExecutionEngine {
  private intentDetector: IntentDetector;
  private handlers: Map<FlowId, FlowHandler>;
  private orchestrator: IntelligentOrchestrator;

  constructor() {
    this.intentDetector = createDetector();
    this.handlers = new Map();
    const flowHistory = getFlowHistory();
    this.orchestrator = new IntelligentOrchestrator(flowHistory);
    this.initializeHandlers();
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

  async process(utterance: string, context: Partial<FlowExecutionContext> = {}): Promise<SidecoachResult> {
    // Step 1: Detect intent
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
    const flowAResult = await flowAHandler.execute(executionContext);
    flowResults.push(flowAResult);
    flowHistory.recordFlow({
      flowId: 'flowA_brand_verify',
      flowName: flowAResult.flowName,
      status: flowAResult.status as 'success' | 'error' | 'skipped',
      message: flowAResult.message,
      guidance: flowAResult.guidance,
      checklist: flowAResult.checklist,
      artifacts: flowAResult.artifacts,
      error: flowAResult.error,
    });

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

      // Check if handler can execute (revive canExecute validation)
      if (!handler.canExecute(executionContext)) {
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

      // Execute handler
      let result: FlowExecutionResult;
      try {
        result = await handler.execute(executionContext);
      } catch (error) {
        result = {
          flowId: currentFlowId,
          flowName,
          status: 'error',
          message: `Error executing flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error.message : String(error),
        };
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
          flowHistory.recordFlow({
            flowId: currentFlowId,
            flowName: result.flowName,
            status: 'error',
            message: result.message,
            guidance: result.guidance,
            checklist: result.checklist,
            artifacts: result.artifacts,
            error: result.error,
          });
          flowResults.push(result);
          currentFlowId = undefined; // Stop chaining
          break;
        } else if (warningRegressions.length > 0) {
          // Guidance/checklist drops: warn but continue
          const warningMessages = warningRegressions.map((w) => w.message).join('; ');
          result.message = `${result.message}\n\n⚠️ Warning: ${warningMessages}`;
        }
      }

      // Record to FlowHistory
      flowHistory.recordFlow({
        flowId: currentFlowId,
        flowName: result.flowName,
        status: result.status as 'success' | 'error' | 'skipped',
        message: result.message,
        guidance: result.guidance,
        checklist: result.checklist,
        artifacts: result.artifacts,
        error: result.error,
      });

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

  registerHandler(handler: FlowHandler): void {
    this.handlers.set(handler.flowId, handler);
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
