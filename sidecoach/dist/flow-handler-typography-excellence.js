"use strict";
// Flow S: Typography Excellence
// Kerning, variable fonts, and type system mastery
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowSTypographyExcellenceHandler = void 0;
exports.createFlowSHandler = createFlowSHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
const design_md_parser_1 = require("./design-md-parser");
const model_routing_1 = require("./model-routing");
class FlowSTypographyExcellenceHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowS_typography_excellence');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        try {
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                typography: context.metadata?.typography || {},
                cssRules: context.metadata?.cssRules || [],
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const typographyDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('typography');
            const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
            const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowS', 'typography-excellence', 'type-mastery'];
                enhancedContext.flowMetadata.customData = {
                    'typography-rules': typographyDomainRules.length,
                    'typography-rules-passed': typographyPassed,
                    'type-scale-levels': 12,
                    'font-pairing-guidance': true,
                };
            }
            const checklist = this.createChecklist([
                { label: 'Audit current typography system', required: true },
                { label: 'Define type scale (headings + body)', required: true },
                { label: 'Select primary and fallback fonts', required: true },
                { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
                { label: 'Implement line height and letter spacing', required: true },
                { label: 'Apply optical adjustments (baseline shift)', required: true },
                { label: 'Test variable font axes (if using)', required: true },
                { label: 'Verify kerning pairs and ligatures', required: true },
                { label: 'Test readability at all text sizes', required: true },
            ]);
            const designContent = context.metadata?.designContent || '';
            const designTokens = context.metadata?.designTokens || {};
            const cite = (dottedPath) => {
                const ln = designContent ? (0, design_md_parser_1.findTokenLine)(designContent, dottedPath) : -1;
                return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
            };
            const displayFamily = designTokens.typography?.display?.family || '(undefined in DESIGN.md)';
            const bodyFamily = designTokens.typography?.body?.family || '(undefined in DESIGN.md)';
            const baseSize = designTokens.typography?.scale?.base || '(undefined in DESIGN.md)';
            const lineHeight = designTokens.typography?.scale?.line_height || '(undefined in DESIGN.md)';
            const guidance = [
                'Typography Excellence: Master type scales, kerning, variable fonts, and reading comfort.',
                '',
                'Domain Validation Results:',
                '',
                'TYPE SCALE:',
                `- Display family: ${displayFamily}${cite('typography.display.family')}`,
                `- Body family: ${bodyFamily}${cite('typography.body.family')}`,
                `- Base body size: ${baseSize}${cite('typography.scale.base')}`,
                '- Heading: 32px, semibold (h2)',
                '- Subheading: 24px, semibold (h3)',
                '- Small: 14px, regular',
                '- Tiny: 12px, regular',
                '',
                'KERNING & SPACING:',
                `- Body line height: ${lineHeight}${cite('typography.scale.line_height')}`,
                '- Letter spacing: normal (0) for body, 0.02em for all-caps',
                '- Optical adjustments: shift baseline -1px for descenders',
                '',
                'VARIABLE FONTS:',
                '- Axes: weight (wght), optical size (opsz), slant',
                '- Usage: wght 400-700, opsz auto on font-size',
            ];
            const getSeverity = (percentage) => {
                const num = parseFloat(percentage);
                if (num >= 80)
                    return 'pass';
                if (num >= 50)
                    return 'warning';
                return 'fail';
            };
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Typography excellence: kerning, variable fonts, and type system mastery')
                .addRule('typography', typographyDomainRules.map((r) => r.name))
                .addDecision('Type scale', 'Display → Heading → Body → Small with comfortable line height and kerning')
                .addMetric('typography-rules-passing', typographyPassed, getSeverity(typographyPassRate), typographyDomainRules.length)
                .addValidation('Typography domain', getSeverity(typographyPassRate), `${typographyPassed}/${typographyDomainRules.length} rules passing`)
                .addArtifact('type-scale', 1);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Typography excellence workflow initialized - type system mastery',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Type Scale', 'Display/Heading/Body/Small with line height and kerning', 'Typography system documentation'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Typography excellence failed: ${String(err).substring(0, 40)}`)
                .addValidation('typography-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize typography excellence',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowSTypographyExcellenceHandler = FlowSTypographyExcellenceHandler;
function createFlowSHandler() {
    return new FlowSTypographyExcellenceHandler();
}
//# sourceMappingURL=flow-handler-typography-excellence.js.map