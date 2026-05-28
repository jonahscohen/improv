"use strict";
// Flow U: Curate
// Design reference capture wizard for ongoing research
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowUCurateHandler = void 0;
exports.createFlowUHandler = createFlowUHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const model_routing_1 = require("./model-routing");
class FlowUCurateHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowU_curate');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        try {
            const checklist = this.createChecklist([
                { label: 'Define curation criteria (category, quality, rarity)', required: true },
                { label: 'Identify reference sources', required: true },
                { label: 'Capture reference screenshots/videos', required: true },
                { label: 'Document reference metadata (source, date, context)', required: true },
                { label: 'Tag references by design domain', required: true },
                { label: 'Organize references into collections', required: true },
                { label: 'Create reference playbook (patterns, anti-patterns)', required: true },
                { label: 'Share reference library with team', required: true },
            ]);
            const guidance = [
                'Curate: Build an ongoing reference library of design patterns and anti-patterns.',
                '',
                'CURATION STRATEGY:',
                '1. Define criteria: What makes a reference worth capturing? (novelty, quality, applicability)',
                '2. Sources: Design inspiration sites, competitor products, open-source projects, small interactions',
                '3. Capture: Screenshot/video + annotation of what makes it interesting',
                '4. Metadata: Source URL, date captured, design domains covered, quality rating',
                '5. Tagging: Assign design domains (color, typography, spatial, motion, interaction, responsive, writing)',
                '6. Organization: Collections by domain, pattern type, or project phase',
                '7. Playbook: Document recurring patterns and anti-patterns found in the library',
                '8. Team sharing: Regular reference reviews and discussions',
                '',
                'REFERENCE LIBRARY STRUCTURE:',
                '- Patterns: Reusable design solutions (button states, form layouts, navigation)',
                '- Anti-patterns: What to avoid (clashing colors, unclear affordances, confusing flows)',
                '- Trends: Current design trends worth exploring vs. avoiding',
                '- Inspiration: Beautiful or innovative designs for creative stimulation',
            ];
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowU', 'curate', 'reference-library'];
                enhancedContext.flowMetadata.customData = {
                    'design-domains': 7,
                    'curation-phases': 8,
                    'library-categories': ['patterns', 'anti-patterns', 'trends', 'inspiration'].length,
                    'reference-organization': 'domain-based',
                };
            }
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Curate: Design reference library for ongoing research and inspiration')
                .addRule('curation', ['criteria definition', 'source identification', 'screenshot capture', 'metadata tagging', 'collection organization', 'playbook creation', 'team sharing'])
                .addDecision('Curation strategy', 'Domain-based reference library with pattern/anti-pattern categorization')
                .addMetric('reference-quality-score', 0, 'pass')
                .addValidation('Curation process', 'pass', 'Reference library framework initialized')
                .addArtifact('reference-library', 0);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Curate workflow initialized - design reference library',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Reference Library', 'Curated design patterns and anti-patterns', 'Design reference collection'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Curate failed: ${String(err).substring(0, 40)}`)
                .addValidation('curate-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize curate',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowUCurateHandler = FlowUCurateHandler;
function createFlowUHandler() {
    return new FlowUCurateHandler();
}
//# sourceMappingURL=flow-handler-curate.js.map