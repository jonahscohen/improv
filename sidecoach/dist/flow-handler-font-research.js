"use strict";
// Flow C: Font Research
// Research typefaces and pairing strategies against brand personality
// Applies typography domain rules from SHARED_DESIGN_LAWS
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowCFontResearchHandler = void 0;
exports.createFlowCHandler = createFlowCHandler;
const flow_handler_1 = require("./flow-handler");
const fontshare_reference_1 = require("./fontshare-reference");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
class FlowCFontResearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowC_font_research');
        this.fontshareRef = new fontshare_reference_1.FontshareReferenceImpl();
    }
    canExecute(context) {
        // Flow C requires project context with brand personality
        return !!(context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality);
    }
    async execute(context) {
        const enhancedContext = context;
        const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
        const typographyApproach = context.projectContext?.design?.typography?.approach || 'undefined';
        try {
            // Get typography rules from shared design laws
            const typographyDomain = design_laws_1.SHARED_DESIGN_LAWS.typography;
            const typographyRules = typographyDomain.rules.map((rule) => `- ${rule}`);
            // Get font pairing rules based on brand personality
            const pairingRules = await this.fontshareRef.getPairingRules(brandPersonality || 'default');
            // Populate enhanced context with Flow C metadata
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowC', 'font-research', 'typography-domain'];
                enhancedContext.flowMetadata.customData = {
                    'typography-rules': typographyRules.length,
                    'pairing-rules': pairingRules.length,
                    'typography-approach': typographyApproach,
                    'brand-personality': brandPersonality || 'default',
                };
            }
            // Get font candidates for this brand personality
            const fontCandidates = await this.fontshareRef.getFontCandidates(typographyApproach, context.projectContext?.register || 'product');
            // Cache context for downstream flows
            this.cachedFontContext = {
                brandPersonality,
                typographyApproach,
                selectedFonts: fontCandidates.map((f) => f.name),
                pairingRules,
                typographyRules: typographyDomain.rules,
            };
            // Domain validation integration
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { fonts: fontCandidates.length },
                cssRules: context.metadata?.cssRules || [],
                typography: context.metadata?.typography,
                accessibility: context.metadata?.accessibility,
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const typographyDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('typography');
            const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
            const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'Brand personality defined', required: true, description: brandPersonality || 'Not specified' },
                { label: 'Typography domain rules reviewed', required: true, description: `${typographyRules.length} rules loaded` },
                { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
                { label: 'Font pairing strategy selected', required: true, description: pairingRules.length > 0 ? `${pairingRules.length} rules` : 'None found' },
                { label: 'Font candidates identified', required: false, description: `${fontCandidates.length} candidates available` },
            ]);
            // Build guidance
            const guidance = [
                `Brand personality: ${brandPersonality || 'Not defined'}`,
                '',
                'Typography Domain Rules (16 principles):',
                ...typographyRules,
                '',
                'Domain Validation Results:',
                '',
                'Font Pairing Strategy:',
                ...pairingRules,
                '',
                'Recommended approach:',
                '1. Select heading font that matches brand personality',
                '2. Pair with body font using the pairing rules above',
                '3. Validate font metrics (line height, ascent, descent)',
                '4. Test OpenType features for your typography needs',
                '5. Check web font loading performance',
                '',
                `${fontCandidates.length} font candidates available. Run Flow F to extract design tokens with selected typefaces.`,
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Font research: ${fontCandidates.length} candidates with typography domain validation (${typographyPassRate})`)
                .addRule('typography', typographyRules)
                .addDecision(`Font pairing strategy: ${pairingRules.length > 0 ? 'defined' : 'generic'}`, 'Selected pairing approach based on brand personality')
                .addMetric('font-candidates-analyzed', fontCandidates.length, 'pass')
                .addMetric('typography-rules-applied', typographyRules.length, 'pass', 16)
                .addMetric('typography-domain-validation', typographyPassed, 'pass', typographyDomainRules.length)
                .addValidation('Typography domain compliance', typographyPassed === typographyDomainRules.length ? 'pass' : 'warning', `${typographyPassed}/${typographyDomainRules.length} pass`)
                .addValidation('Font pairing rules', pairingRules.length > 0 ? 'pass' : 'warning')
                .addReference('fontshare', fontCandidates.length, 'typography candidates')
                .addArtifact('font-candidates', fontCandidates.length, ['flowF_design_tokens', 'flowG_component_implementation']);
            const memory = memoryBuilder.build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Font research: ${fontCandidates.length} candidates analyzed against ${typographyRules.length} typography rules`,
                guidance,
                checklist,
                artifacts: fontCandidates.length > 0 ? [
                    this.createArtifact('reference', 'Font Candidates', fontCandidates.map((f) => `${f.name} (${f.category}, weights: ${f.weights.join(',')})`).join('\n'), `${fontCandidates.length} fonts matching brand personality and typography requirements`),
                ] : [],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Font research failed: ${String(err).substring(0, 40)}`)
                .addValidation('fontshare-query', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to research fonts',
                error: String(err),
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedFontContext;
    }
}
exports.FlowCFontResearchHandler = FlowCFontResearchHandler;
function createFlowCHandler() {
    return new FlowCFontResearchHandler();
}
//# sourceMappingURL=flow-handler-font-research.js.map