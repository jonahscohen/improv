"use strict";
// Flow L: Design Critique
// Nielsen heuristics, AI-slop detection, cognitive load analysis
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowLDesignCritiqueHandler = void 0;
exports.createFlowLHandler = createFlowLHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const model_routing_1 = require("./model-routing");
const retry_control_1 = require("./retry-control");
const CRITIQUE_LENSES = {
    heuristics: [
        'System visibility: Status, error messages, feedback',
        'User control: Undo/redo, exit strategies, non-destructive actions',
        'Error prevention: Constraints, confirmations, recovery',
        'Recognition vs recall: Visible options, minimize memory load',
        'Flexibility: Shortcuts, customization, advanced modes',
        'Aesthetics & minimalism: Remove clutter, focus on essentials',
        'Help & documentation: Clear, task-focused, concrete steps',
        'Match system & real world: User language, real-world conventions',
        'Error recovery: Plain language, suggest solutions',
    ],
    aiSlop: [
        'Generic placeholder copy (Lorem ipsum, "Click here")',
        'Overwritten tone ("delighted", "amazing", "powered by AI")',
        'Unnecessary complexity (hamburger menus, modal overflow)',
        'Unfamiliar patterns (unconventional navigation, unclear purpose)',
        'Low contrast or unreadable fonts',
    ],
    cognitiveLoad: [
        'Information density per screen',
        'Number of decision points',
        'Visual hierarchy clarity',
        'Interaction depth (steps to goal)',
        'Consistency across flows',
    ],
};
class FlowLDesignCritiqueHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowL_design_critique');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        try {
            // T-0009: Phase-gated retry control. Halt BEFORE doing work if the
            // orchestrator has looped past maxCycles or against an identical-error
            // signature.
            const retryConfig = (0, retry_control_1.readRetryConfig)(context);
            const retryState = (0, retry_control_1.readRetryState)(context);
            const haltDecision = (0, retry_control_1.evaluateHaltConditions)(retryState, retryConfig);
            if (haltDecision.halt) {
                return (0, retry_control_1.buildHaltResult)(this.flowId, this.getFlowName(), haltDecision, 'design-critique', `[${this.flowId}]`);
            }
            const checklist = this.createChecklist([
                { label: 'Nielsen heuristics: 9 heuristics reviewed', required: true },
                { label: 'AI-slop detection: 5 slop patterns identified', required: true },
                { label: 'Cognitive load: density, decisions, clarity, depth, consistency', required: true },
                { label: 'Copy audit: generic, overwritten, or unclear language', required: false },
                { label: 'Navigation patterns: clarity, consistency, intuitiveness', required: false },
                { label: 'Error messages: plain language, solutions, recovery paths', required: false },
                { label: 'Feedback: status visibility, user confirmation, response time', required: false },
                { label: 'Control: undo/redo, exit strategies, non-destructive actions', required: false },
            ]);
            const guidance = [
                'Design Critique reviews interfaces through 3 critical lenses: Nielsen heuristics, AI-slop detection, and cognitive load.',
                '',
                'NIELSEN HEURISTICS (9 usability principles):',
                '1. System visibility: Keep users informed with real-time feedback',
                '2. User control: Provide undo/redo, clear exits, non-destructive actions',
                '3. Error prevention: Use constraints, confirmations, recovery options',
                '4. Recognition vs recall: Make options visible, minimize memory load',
                '5. Flexibility: Offer shortcuts for expert users, customization',
                '6. Aesthetics: Remove clutter, focus on essential functions',
                '7. Help & documentation: Clear, task-focused, concrete steps',
                '8. Match real world: Use user language, real-world conventions',
                '9. Error recovery: Plain language, suggest solutions',
                '',
                'AI-SLOP DETECTION (5 warning signs):',
                '- Generic placeholder copy ("Lorem ipsum", "Click here", "Learn more")',
                '- Overwritten marketing tone ("delighted", "amazing", "revolutionize")',
                '- Unnecessary complexity (modal overflow, hamburger menus without cause)',
                '- Unfamiliar patterns (unconventional navigation, unclear purpose)',
                '- Accessibility failures (low contrast, unreadable fonts)',
                '',
                'COGNITIVE LOAD (5 metrics):',
                '- Information density per screen (aim for <7 items)',
                '- Decision points per user task (minimize branches)',
                '- Visual hierarchy (clear primary > secondary > tertiary)',
                '- Interaction depth (steps to complete goal)',
                '- Consistency (same patterns, same meanings, same visual language)',
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Design critique: Nielsen heuristics (9), AI-slop detection (5), cognitive load (5 metrics)')
                .addRule('heuristics', ['visibility', 'control', 'error prevention', 'recognition', 'flexibility', 'aesthetics', 'help documentation', 'real-world language', 'recovery'])
                .addRule('ai-slop', ['generic copy', 'marketing tone', 'unnecessary complexity', 'unfamiliar patterns', 'accessibility failures'])
                .addRule('cognitive-load', ['optimize density <7 items', 'minimize decisions', 'clear visual hierarchy', 'shallow interaction depth', 'strong consistency'])
                .addDecision('Critique framework', 'Three-lens analysis: Nielsen heuristics, AI-slop patterns, cognitive load metrics')
                .addMetric('heuristics-reviewed', 9, 'pass')
                .addMetric('ai-slop-patterns', 5, 'pass')
                .addMetric('cognitive-dimensions', 5, 'pass')
                .addValidation('Design critique', 'pass', 'Framework initialized')
                .addArtifact('critique', 3);
            const critiqueResult = {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Design Critique workflow initialized - Nielsen heuristics, AI-slop detection, cognitive load',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Critique Framework', `NIELSEN HEURISTICS:\n${CRITIQUE_LENSES.heuristics.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\nAI-SLOP PATTERNS:\n${CRITIQUE_LENSES.aiSlop.map((s) => `- ${s}`).join('\n')}\n\nCOGNITIVE LOAD METRICS:\n${CRITIQUE_LENSES.cognitiveLoad.map((c) => `- ${c}`).join('\n')}`, 'Multi-lens design critique framework'),
                ],
                memory: memoryBuilder.build(),
            };
            // T-0009: Phase-gated retry control. Design critique is a framework-
            // initializer flow with no automated validator results today, so the
            // "failed rules" set is intentionally empty - the signature still
            // varies by file path, and the identical-error halt is what stops a
            // critique loop that the orchestrator keeps re-firing against the
            // same target without any change between iterations.
            const errorSignature = (0, retry_control_1.computeErrorSignature)({
                validator: 'design-critique',
                failedRules: [],
                filePath: context.projectPath || '',
            });
            const nextState = (0, retry_control_1.recordIteration)(retryState, errorSignature);
            (0, retry_control_1.attachRetryStateToResult)(critiqueResult, nextState, retryConfig);
            return critiqueResult;
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Design critique failed: ${String(err).substring(0, 40)}`)
                .addValidation('critique-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize design critique',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowLDesignCritiqueHandler = FlowLDesignCritiqueHandler;
function createFlowLHandler() {
    return new FlowLDesignCritiqueHandler();
}
//# sourceMappingURL=flow-handler-design-critique.js.map