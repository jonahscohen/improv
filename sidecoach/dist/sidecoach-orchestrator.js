"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidecoachOrchestrator = void 0;
exports.createOrchestrator = createOrchestrator;
const intent_detector_1 = require("./intent-detector");
const flows_1 = require("./flows");
const flow_history_1 = require("./flow-history");
const flow_handlers_core_1 = require("./flow-handlers-core");
const flow_handlers_extended_1 = require("./flow-handlers-extended");
class SidecoachOrchestrator {
    constructor() {
        this.intentDetector = (0, intent_detector_1.createDetector)();
        this.handlers = new Map();
        this.initializeHandlers();
    }
    initializeHandlers() {
        // Register all flow handlers with their implementations
        const handlerMap = [
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
        const executionContext = {
            utterance,
            userId: context.userId,
            projectPath: context.projectPath,
            currentFile: context.currentFile,
            selectedText: context.selectedText,
            metadata: context.metadata,
        };
        // Step 4: Execute handler
        let result;
        try {
            result = await handler.execute(executionContext);
        }
        catch (error) {
            result = {
                flowId: match.flowId,
                flowName: match.flowName,
                status: 'error',
                message: `Error executing flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: error instanceof Error ? error.message : String(error),
            };
        }
        // Step 5: Record to FlowHistory and add flow marker
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        flowHistory.recordFlow({
            flowId: match.flowId,
            flowName: match.flowName,
            status: result.status,
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
    registerHandler(handler) {
        this.handlers.set(handler.flowId, handler);
    }
    getAvailableFlows() {
        const flowIds = [
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
exports.SidecoachOrchestrator = SidecoachOrchestrator;
function createOrchestrator() {
    return new SidecoachOrchestrator();
}
//# sourceMappingURL=sidecoach-orchestrator.js.map