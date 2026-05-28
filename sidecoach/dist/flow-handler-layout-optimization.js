"use strict";
// Flow R: Layout Optimization
// Spacing and hierarchy refinement for visual clarity
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowRLayoutOptimizationHandler = void 0;
exports.createFlowRHandler = createFlowRHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
const model_routing_1 = require("./model-routing");
class FlowRLayoutOptimizationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowR_layout_optimization');
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
                componentTree: context.metadata?.componentTree || { nodeCount: 0 },
                cssRules: context.metadata?.cssRules || [],
                spacing: context.metadata?.spacing || {},
                typography: context.metadata?.typography || {},
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const spatialDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('spatial');
            const typographyDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('typography');
            const responsiveDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('responsive');
            const spatialPassRate = extendedValidationReport.passRateByDomain['spatial'] || '0%';
            const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
            const responsivePassRate = extendedValidationReport.passRateByDomain['responsive'] || '0%';
            const spatialPassed = Math.round((parseFloat(spatialPassRate) / 100) * spatialDomainRules.length);
            const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);
            const responsivePassed = Math.round((parseFloat(responsivePassRate) / 100) * responsiveDomainRules.length);
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowR', 'layout-optimization', 'spacing-hierarchy'];
                enhancedContext.flowMetadata.customData = {
                    'spacing-domains': 3,
                    'spatial-rules-passed': spatialPassed,
                    'typography-rules-passed': typographyPassed,
                    'responsive-rules-passed': responsivePassed,
                    'spacing-scale-units': 8,
                };
            }
            const checklist = this.createChecklist([
                { label: 'Audit current spacing system', required: true },
                { label: 'Identify visual hierarchy issues', required: true },
                { label: 'Define spacing scale (base unit and ratios)', required: true },
                { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
                { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
                { label: 'Responsive domain validation', required: false, description: `${responsivePassed}/${responsiveDomainRules.length} rules passing (${responsivePassRate})` },
                { label: 'Apply spacing scale to all components', required: true },
                { label: 'Verify white space ratios', required: true },
                { label: 'Test on multiple viewport sizes', required: true },
                { label: 'Document spacing patterns', required: true },
            ]);
            const guidance = [
                'Layout Optimization: Refine spacing and visual hierarchy for clarity and usability.',
                '',
                'Domain Validation Results:',
                '',
                'SPACING SYSTEM:',
                '- Base unit: 8px (standard web default)',
                '- Scale: 8, 12, 16, 24, 32, 48, 64, 96 (multiples of 8)',
                '- Ratios: 1:1.5 (tight), 1:2 (comfortable), 1:3 (spacious)',
                '',
                'HIERARCHY PRINCIPLES:',
                '- Headings larger than body (ratio 1.5x minimum)',
                '- Primary content center-aligned or left-aligned',
                '- Secondary content smaller and lighter in color',
                '- Whitespace around important content',
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
                .setSummary('Layout optimization: spacing and hierarchy refinement')
                .addRule('spatial', spatialDomainRules.map((r) => r.name))
                .addRule('typography', typographyDomainRules.map((r) => r.name))
                .addRule('responsive', responsiveDomainRules.map((r) => r.name))
                .addDecision('Spacing scale', 'Base 8px unit with 1.5x and 2x ratios for comfortable hierarchy')
                .addMetric('spatial-rules-passing', spatialPassed, getSeverity(spatialPassRate), spatialDomainRules.length)
                .addMetric('typography-rules-passing', typographyPassed, getSeverity(typographyPassRate), typographyDomainRules.length)
                .addMetric('responsive-rules-passing', responsivePassed, getSeverity(responsivePassRate), responsiveDomainRules.length)
                .addValidation('Spatial domain', getSeverity(spatialPassRate), `${spatialPassed}/${spatialDomainRules.length} rules passing`)
                .addValidation('Typography domain', getSeverity(typographyPassRate), `${typographyPassed}/${typographyDomainRules.length} rules passing`)
                .addValidation('Responsive domain', getSeverity(responsivePassRate), `${responsivePassed}/${responsiveDomainRules.length} rules passing`)
                .addArtifact('reference', 1);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Layout optimization workflow initialized - spacing and hierarchy',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Spacing Scale', '8px base unit with 1.5x/2x ratios', 'Spacing system documentation'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Layout optimization failed: ${String(err).substring(0, 40)}`)
                .addValidation('layout-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize layout optimization',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowRLayoutOptimizationHandler = FlowRLayoutOptimizationHandler;
function createFlowRHandler() {
    return new FlowRLayoutOptimizationHandler();
}
//# sourceMappingURL=flow-handler-layout-optimization.js.map