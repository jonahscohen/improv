import { createDetector, IntentDetector } from './intent-detector';
import { FlowHandler, FlowExecutionContext, FlowExecutionResult, BaseFlowHandler } from './flow-handler';
import { FlowId, MatchResult, DisambiguationResult } from './types';
import { getFlow } from './flows';
import { getFlowHistory } from './flow-history';
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

export class SidecoachOrchestrator {
  private intentDetector: IntentDetector;
  private handlers: Map<FlowId, FlowHandler>;

  constructor() {
    this.intentDetector = createDetector();
    this.handlers = new Map();
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    // Register all flow handlers with their implementations
    const handlerMap: Array<[FlowId, () => FlowHandler]> = [
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

    // Step 2: Get the handler
    const handler = this.handlers.get(match.flowId);
    if (!handler) {
      return {
        success: false,
        message: `No handler found for flow: ${match.flowName}`,
        detectedFlow: { flowId: match.flowId, flowName: match.flowName, confidence: match.confidence },
        flowResults: [],
      };
    }

    // Step 3: Prepare execution context
    const executionContext: FlowExecutionContext = {
      utterance,
      userId: context.userId,
      projectPath: context.projectPath,
      currentFile: context.currentFile,
      selectedText: context.selectedText,
      metadata: context.metadata,
    };

    // Step 4: Execute handler
    let result: FlowExecutionResult;
    try {
      result = await handler.execute(executionContext);
    } catch (error) {
      result = {
        flowId: match.flowId,
        flowName: match.flowName,
        status: 'error',
        message: `Error executing flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Step 5: Record to FlowHistory and add flow marker
    const flowHistory = getFlowHistory();
    flowHistory.recordFlow({
      flowId: match.flowId,
      flowName: match.flowName,
      status: result.status as 'success' | 'error' | 'skipped',
      message: result.message,
      guidance: result.guidance,
      checklist: result.checklist,
      artifacts: result.artifacts,
      error: result.error,
    });

    // Add explicit flow marker to message so users see which flow executed
    const flowMarker = `[Flow: ${match.flowName}]`;
    const messageWithMarker = `${flowMarker}\n\n${result.message}`;

    return {
      success: result.status === 'success',
      message: messageWithMarker,
      detectedFlow: { flowId: match.flowId, flowName: match.flowName, confidence: match.confidence },
      flowResults: [result],
      guidance: result.guidance,
      checklist: result.checklist,
      artifacts: result.artifacts,
    };
  }

  registerHandler(handler: FlowHandler): void {
    this.handlers.set(handler.flowId, handler);
  }

  getAvailableFlows(): FlowInfo[] {
    const flowIds: FlowId[] = [
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

export function createOrchestrator(): SidecoachOrchestrator {
  return new SidecoachOrchestrator();
}
