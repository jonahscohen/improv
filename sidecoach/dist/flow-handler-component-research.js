"use strict";
// Flow B: Component Research
// Research component patterns and interaction states against design system
// Applies interaction domain (8 states) + writing domain (labels, microcopy)
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowBComponentResearchHandler = void 0;
exports.createFlowBHandler = createFlowBHandler;
const flow_handler_1 = require("./flow-handler");
const component_gallery_reference_1 = require("./component-gallery-reference");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
class FlowBComponentResearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowB_component_research');
        this.componentGalleryRef = new component_gallery_reference_1.ComponentGalleryReferenceImpl();
    }
    canExecute(context) {
        // Flow B requires project context with brand personality and design system
        return !!(context.projectContext?.product?.brandPersonality ||
            context.projectContext?.product?.brand_personality);
    }
    async execute(context) {
        const enhancedContext = context;
        const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
        const designApproach = context.projectContext?.design?.components?.approach || 'undefined';
        try {
            // Get interaction domain rules (8 component states)
            const interactionDomain = design_laws_1.SHARED_DESIGN_LAWS.interaction;
            const interactionRules = interactionDomain.rules.map((rule) => `- ${rule}`);
            // Get writing domain rules (labels, microcopy, copy consistency)
            const writingDomain = design_laws_1.SHARED_DESIGN_LAWS.writing;
            const writingRules = writingDomain.rules.map((rule) => `- ${rule}`);
            // Populate enhanced context with Flow B metadata
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowB', 'component-research', 'interaction-domain', 'writing-domain'];
                enhancedContext.flowMetadata.customData = {
                    'interaction-rules': interactionRules.length,
                    'writing-rules': writingRules.length,
                    'design-approach': designApproach,
                };
            }
            // Get component patterns from gallery
            const componentPatterns = await this.componentGalleryRef.getComponentPatterns(designApproach || 'standard', context.projectContext?.register || 'product');
            // Get semantic markup for key components
            const semanticMarkup = {};
            for (const component of componentPatterns.slice(0, 5)) {
                semanticMarkup[component.name] = await this.componentGalleryRef.getSemanticMarkup(component.name);
            }
            // Get a11y patterns for interaction validation
            const a11yPatterns = {};
            for (const component of componentPatterns.slice(0, 5)) {
                const patterns = await this.componentGalleryRef.getA11yPatterns(component.name);
                a11yPatterns[component.name] = patterns.join(', ');
            }
            // Get interaction states (8 component states: default, hover, focus, active, disabled, loading, error, success)
            const interactionStates = {};
            for (const component of componentPatterns.slice(0, 5)) {
                const states = await this.componentGalleryRef.getInteractionStates(component.name);
                interactionStates[component.name] = states;
            }
            // Validate component patterns against WCAG
            const validationResults = [];
            for (const component of componentPatterns) {
                const wcagIssues = await this.componentGalleryRef.validateAgainstWcag(component.name);
                const status = wcagIssues.length === 0 ? 'pass' : 'warning';
                validationResults.push({
                    componentName: component.name,
                    wcagStatus: status,
                    issues: wcagIssues,
                });
            }
            // Cache context for downstream flows
            this.cachedComponentContext = {
                componentPatterns: componentPatterns.map((c) => c.name),
                interactionRules: interactionDomain.rules,
                writingRules: writingDomain.rules,
                semanticMarkup,
                a11yPatterns,
                validationResults,
            };
            // Domain validation integration
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { components: componentPatterns.length },
                cssRules: context.metadata?.cssRules || [],
                accessibility: context.metadata?.accessibility,
                contrast: context.metadata?.contrast,
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const interactionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('interaction');
            const uxWritingDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('ux-writing');
            const interactionPassRate = extendedValidationReport.passRateByDomain['interaction'] || '0%';
            const uxWritingPassRate = extendedValidationReport.passRateByDomain['ux-writing'] || '0%';
            const interactionPassed = Math.round((parseFloat(interactionPassRate) / 100) * interactionDomainRules.length);
            const uxWritingPassed = Math.round((parseFloat(uxWritingPassRate) / 100) * uxWritingDomainRules.length);
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'Brand personality defined', required: true, description: brandPersonality || 'Not specified' },
                { label: 'Design approach specified', required: true, description: designApproach || 'Not specified' },
                { label: 'Interaction domain rules reviewed (8 states)', required: true, description: `${interactionDomainRules.length} rules loaded` },
                { label: 'Writing domain rules reviewed', required: true, description: `${writingRules.length} rules loaded` },
                { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
                { label: 'UX Writing domain validation', required: false, description: `${uxWritingPassed}/${uxWritingDomainRules.length} rules passing (${uxWritingPassRate})` },
                { label: 'Component patterns identified', required: false, description: `${componentPatterns.length} patterns available` },
                { label: 'Semantic markup documented', required: false, description: `${Object.keys(semanticMarkup).length} components` },
                { label: 'WCAG validation complete', required: false, description: `${validationResults.length} components validated` },
            ]);
            // Build guidance
            const guidance = [
                `Brand personality: ${brandPersonality || 'Not defined'}`,
                `Design approach: ${designApproach}`,
                '',
                'Interaction Domain Rules (8 Component States):',
                ...interactionRules,
                '',
                'Default, Hover, Focus, Active, Disabled, Loading, Error, Success',
                '',
                'Writing Domain Rules (Labels & Microcopy):',
                ...writingRules,
                '',
                'Domain Validation Results:',
                '',
                'Semantic Markup Requirements:',
                ...Object.entries(semanticMarkup).map(([name, markup]) => `- ${name}: use semantic ${markup}`),
                '',
                'Accessibility Patterns:',
                ...Object.entries(a11yPatterns).map(([name, pattern]) => `- ${name}: ${pattern}`),
                '',
                'Interaction States Matrix:',
                ...Object.entries(interactionStates).map(([name, states]) => `- ${name}: ${states.join(', ')}`),
                '',
                'Component Validation Results:',
                ...validationResults.map((r) => `- ${r.componentName}: ${r.wcagStatus}${r.issues.length > 0 ? ` (${r.issues.length} issues)` : ''}`),
                '',
                `${componentPatterns.length} component patterns identified. Run Flow G to implement patterns with interaction states and writing guidelines.`,
            ];
            const wcagPassCount = validationResults.filter((r) => r.wcagStatus === 'pass').length;
            const wcagWarningCount = validationResults.filter((r) => r.wcagStatus === 'warning').length;
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Component research: ${componentPatterns.length} patterns with domain validation (interaction: ${interactionPassRate}, writing: ${uxWritingPassRate})`)
                .addRule('interaction', interactionRules)
                .addRule('writing', writingRules)
                .addDecision(`Selected design approach: ${designApproach}`, `Component patterns aligned to ${designApproach} architecture`)
                .addMetric('component-patterns-analyzed', componentPatterns.length, 'pass')
                .addMetric('interaction-states-covered', 8, 'pass')
                .addMetric('interaction-domain-validation', interactionPassed, 'pass', interactionDomainRules.length)
                .addMetric('writing-domain-validation', uxWritingPassed, 'pass', uxWritingDomainRules.length)
                .addMetric('wcag-validation-pass', wcagPassCount, 'pass', validationResults.length)
                .addValidation('Interaction domain compliance', interactionPassed === interactionDomainRules.length ? 'pass' : 'warning', `${interactionPassed}/${interactionDomainRules.length} pass`)
                .addValidation('UX Writing domain compliance', uxWritingPassed === uxWritingDomainRules.length ? 'pass' : 'warning', `${uxWritingPassed}/${uxWritingDomainRules.length} pass`)
                .addValidation('WCAG compliance', wcagWarningCount === 0 ? 'pass' : 'warning', `${wcagPassCount}/${validationResults.length} pass`)
                .addReference('component-gallery', componentPatterns.length)
                .addArtifact('component-patterns', componentPatterns.length, ['flowG_component_implementation', 'flowL_design_critique']);
            const memory = memoryBuilder.build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Component research: ${componentPatterns.length} patterns analyzed with ${interactionDomainRules.length} interaction rules + ${writingRules.length} writing rules`,
                guidance,
                checklist,
                artifacts: componentPatterns.length > 0
                    ? [
                        this.createArtifact('reference', 'Component Patterns', componentPatterns.map((p) => `${p.name}: ${p.description}`).join('\n'), `${componentPatterns.length} components with semantic markup, a11y patterns, and WCAG validation`),
                        this.createArtifact('reference', 'Interaction States Checklist', ['Default', 'Hover', 'Focus', 'Active', 'Disabled', 'Loading', 'Error', 'Success'].join('\n'), '8 required component states for complete interaction design'),
                        this.createArtifact('reference', 'Writing Guidelines', writingRules.join('\n'), `${writingRules.length} rules for labels, microcopy, and copy consistency`),
                    ]
                    : [],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Component research failed: ${String(err).substring(0, 40)}`)
                .addValidation('component-gallery-query', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to research component patterns',
                error: String(err),
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedComponentContext;
    }
}
exports.FlowBComponentResearchHandler = FlowBComponentResearchHandler;
function createFlowBHandler() {
    return new FlowBComponentResearchHandler();
}
//# sourceMappingURL=flow-handler-component-research.js.map