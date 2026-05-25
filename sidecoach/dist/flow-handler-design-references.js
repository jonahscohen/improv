"use strict";
// Flow D: Design References
// Search visual inspiration and design patterns against color + spatial domain rules
// Applies color domain (OKLCH, contrast, semantics) + spatial domain (grid, spacing)
// Includes category-reflex AI slop detection
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowDReferenceSearchHandler = void 0;
exports.createFlowDHandler = createFlowDHandler;
const flow_handler_1 = require("./flow-handler");
const design_references_reference_1 = require("./design-references-reference");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
class FlowDReferenceSearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowD_reference_inspiration');
        this.designReferencesRef = new design_references_reference_1.DesignReferencesSystemImpl();
    }
    canExecute(context) {
        // Flow D requires project context with register (to get design approach)
        return !!(context.projectContext?.register);
    }
    async execute(context) {
        const register = context.projectContext?.register || 'product';
        const designApproach = context.projectContext?.design?.visual?.approach || 'modern';
        try {
            // Get color domain rules (OKLCH, contrast, semantics, saturation, dark mode)
            const colorDomain = design_laws_1.SHARED_DESIGN_LAWS.color;
            const colorRules = colorDomain.rules.map((rule) => `- ${rule}`);
            // Get spatial domain rules (4pt grid, gap/margin, touch targets, white space)
            const spatialDomain = design_laws_1.SHARED_DESIGN_LAWS.spatial;
            const spatialRules = spatialDomain.rules.map((rule) => `- ${rule}`);
            // Search for design references by approach
            const references = await this.designReferencesRef.searchReferences(designApproach, register, 10);
            // Get category-reflex patterns for slop detection
            const categoryReflex = design_laws_1.CATEGORY_REFLEX;
            // Analyze each reference for AI slop
            const referenceAnalysis = await Promise.all(references.map(async (ref) => {
                const reflexIssues = await this.designReferencesRef.getCategoryReflex(ref.category);
                const oversaturated = reflexIssues.includes('oversaturated') ||
                    reflexIssues.length > 0;
                // Genericidad score: 0-1 where 0 is unique/specific, 1 is generic AI slop
                const isOversaturatedCategory = categoryReflex.oversaturated_families?.includes(ref.category) || false;
                const genericityScore = isOversaturatedCategory ? 0.8 : oversaturated ? 0.5 : 0.2;
                return {
                    title: ref.title,
                    category: ref.category,
                    hasColorPalette: !!ref.colorPalette,
                    hasSpacingPattern: !!ref.spacingPattern,
                    slopDetectionResults: {
                        categoryReflex: oversaturated,
                        oversaturated: isOversaturatedCategory,
                        genericityScore,
                    },
                };
            }));
            // Filter high-genericity (AI slop) references
            const lowSlopReferences = referenceAnalysis.filter((r) => r.slopDetectionResults.genericityScore < 0.6);
            const oversaturatedCount = referenceAnalysis.filter((r) => r.slopDetectionResults.oversaturated).length;
            // Cache context for downstream flows
            this.cachedReferenceContext = {
                referencesFound: references.length,
                colorDomainRules: colorDomain.rules,
                spatialDomainRules: spatialDomain.rules,
                references: referenceAnalysis,
            };
            // Domain validation integration
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { references: references.length },
                cssRules: context.metadata?.cssRules || [],
                colors: context.metadata?.colors,
                spacing: context.metadata?.spacing,
                accessibility: context.metadata?.accessibility,
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const colorDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('color');
            const spatialDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('spatial');
            const colorPassRate = extendedValidationReport.passRateByDomain['color'] || '0%';
            const spatialPassRate = extendedValidationReport.passRateByDomain['spatial'] || '0%';
            const colorPassed = Math.round((parseFloat(colorPassRate) / 100) * colorDomainRules.length);
            const spatialPassed = Math.round((parseFloat(spatialPassRate) / 100) * spatialDomainRules.length);
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'Register defined', required: true, description: register },
                { label: 'Design approach specified', required: true, description: designApproach },
                { label: 'Color domain rules reviewed (OKLCH, contrast)', required: true, description: `${colorRules.length} rules loaded` },
                { label: 'Color domain validation', required: false, description: `${colorPassed}/${colorDomainRules.length} rules passing (${colorPassRate})` },
                { label: 'Spatial domain rules reviewed (grid, spacing)', required: true, description: `${spatialRules.length} rules loaded` },
                { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
                { label: 'Design references found', required: false, description: `${references.length} references available` },
                { label: 'Category-reflex AI slop detection applied', required: false, description: `${referenceAnalysis.length - lowSlopReferences.length} high-slop filtered` },
            ]);
            // Build guidance
            const guidance = [
                `Register: ${register}`,
                `Design approach: ${designApproach}`,
                '',
                'Color Domain Rules (OKLCH Commitment):',
                ...colorRules,
                '',
                'Semantic Colors: ensure meaning is consistent across light/dark modes',
                'Contrast Validation: WCAG AA minimum 4.5:1 for text, 3:1 for UI',
                'Saturation & Vibrancy: appropriate for register (product vs brand)',
                '',
                'Domain Validation Results:',
                '',
                'Spatial Domain Rules (4pt Grid System):',
                ...spatialRules,
                '',
                'Touch Targets: minimum 40x40px for interactive elements',
                'White Space: balance density with breathing room',
                'Container Queries: responsive without media queries',
                '',
                'Design References Analysis:',
                `- Total found: ${references.length}`,
                `- High quality (low AI slop): ${lowSlopReferences.length}`,
                `- Flagged as oversaturated: ${oversaturatedCount}`,
                '',
                'High-Quality References (genericityScore < 0.6):',
                ...lowSlopReferences.map((r) => `- ${r.title} (${r.category}${r.hasColorPalette ? ' + color' : ''}${r.hasSpacingPattern ? ' + spacing' : ''})`),
                '',
                `Proceed to Flow E (Motion Patterns) for animation design validation.`,
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Design references: ${references.length} patterns with color + spatial domain validation (color: ${colorPassRate}, spatial: ${spatialPassRate}) + AI slop detection`)
                .addRule('color', colorRules)
                .addRule('spatial', spatialRules)
                .addDecision(`Selected ${lowSlopReferences.length} high-quality references`, `Filtered oversaturated/AI-slop references (genericityScore < 0.6)`)
                .addMetric('references-analyzed', references.length, 'pass')
                .addMetric('color-domain-validation', colorPassed, 'pass', colorDomainRules.length)
                .addMetric('spatial-domain-validation', spatialPassed, 'pass', spatialDomainRules.length)
                .addMetric('high-quality-references', lowSlopReferences.length, 'pass', references.length)
                .addMetric('ai-slop-filtered', oversaturatedCount, 'pass')
                .addValidation('Color domain compliance', colorPassed === colorDomainRules.length ? 'pass' : 'warning', `${colorPassed}/${colorDomainRules.length} pass`)
                .addValidation('Spatial domain compliance', spatialPassed === spatialDomainRules.length ? 'pass' : 'warning', `${spatialPassed}/${spatialDomainRules.length} pass`)
                .addValidation('Category-reflex AI slop detection', oversaturatedCount === 0 ? 'pass' : 'warning', `${oversaturatedCount} oversaturated categories`)
                .addReference('design-references', lowSlopReferences.length, 'design inspiration patterns')
                .addArtifact('reference-patterns', lowSlopReferences.length, ['flowE_motion_patterns', 'flowG_component_implementation', 'flowN_design_refine']);
            const memory = memoryBuilder.build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Design references: ${references.length} patterns researched with color + spatial rules + category-reflex AI slop detection`,
                guidance,
                checklist,
                artifacts: lowSlopReferences.length > 0
                    ? [
                        this.createArtifact('reference', 'Design References (Filtered)', lowSlopReferences.map((r) => `${r.title} (${r.category})`).join('\n'), `${lowSlopReferences.length} high-quality references matching color & spatial domain rules`),
                        this.createArtifact('reference', 'Color Domain Rules', colorRules.join('\n'), 'OKLCH color space, contrast validation, semantic meaning, dark mode strategies'),
                        this.createArtifact('reference', 'Spatial Domain Rules', spatialRules.join('\n'), '4pt grid foundation, gap vs margin, touch targets, white space balance'),
                    ]
                    : [],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Design reference search failed: ${String(err).substring(0, 40)}`)
                .addValidation('design-references-query', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to search design references',
                error: String(err),
                guidance: [],
                checklist: [],
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedReferenceContext;
    }
}
exports.FlowDReferenceSearchHandler = FlowDReferenceSearchHandler;
function createFlowDHandler() {
    return new FlowDReferenceSearchHandler();
}
//# sourceMappingURL=flow-handler-design-references.js.map