"use strict";
// Flow Q: Migration
// API migration and dependency mapping for design system updates
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowQMigrationHandler = void 0;
exports.createFlowQHandler = createFlowQHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
class FlowQMigrationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowQ_migration_special');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        try {
            // Domain validation for migration impact assessment across all domains
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { nodeCount: 0 },
                cssRules: context.metadata?.cssRules || [],
                colors: context.metadata?.colors || {},
                typography: context.metadata?.typography || {},
                spacing: context.metadata?.spacing || {},
                motion: context.metadata?.motion || {},
                accessibility: context.metadata?.accessibility || {},
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            // Get all 7 domain rules for comprehensive migration validation
            const colorDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('color');
            const typographyDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('typography');
            const spatialDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('spatial');
            const motionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('motion');
            const interactionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('interaction');
            const responsiveDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('responsive');
            const writingDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('writing');
            // Extract pass rates
            const colorPassRate = extendedValidationReport.passRateByDomain['color'] || '0%';
            const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
            const spatialPassRate = extendedValidationReport.passRateByDomain['spatial'] || '0%';
            const motionPassRate = extendedValidationReport.passRateByDomain['motion'] || '0%';
            const interactionPassRate = extendedValidationReport.passRateByDomain['interaction'] || '0%';
            const responsivePassRate = extendedValidationReport.passRateByDomain['responsive'] || '0%';
            const writingPassRate = extendedValidationReport.passRateByDomain['writing'] || '0%';
            // Calculate rules passing per domain
            const colorPassed = Math.round((parseFloat(colorPassRate) / 100) * colorDomainRules.length);
            const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);
            const spatialPassed = Math.round((parseFloat(spatialPassRate) / 100) * spatialDomainRules.length);
            const motionPassed = Math.round((parseFloat(motionPassRate) / 100) * motionDomainRules.length);
            const interactionPassed = Math.round((parseFloat(interactionPassRate) / 100) * interactionDomainRules.length);
            const responsivePassed = Math.round((parseFloat(responsivePassRate) / 100) * responsiveDomainRules.length);
            const writingPassed = Math.round((parseFloat(writingPassRate) / 100) * writingDomainRules.length);
            const checklist = this.createChecklist([
                { label: 'List all affected components', required: true },
                { label: 'Map old API to new API', required: true },
                { label: 'Identify breaking changes', required: true },
                { label: 'Identify deprecations vs removals', required: true },
                { label: 'Document migration path per component', required: true },
                { label: 'Color domain validation', required: false, description: `${colorPassed}/${colorDomainRules.length} rules passing (${colorPassRate})` },
                { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
                { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
                { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
                { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
                { label: 'Responsive domain validation', required: false, description: `${responsivePassed}/${responsiveDomainRules.length} rules passing (${responsivePassRate})` },
                { label: 'Writing domain validation', required: false, description: `${writingPassed}/${writingDomainRules.length} rules passing (${writingPassRate})` },
                { label: 'Create dependency graph of affected components', required: true },
                { label: 'Test migration on non-critical pages first', required: true },
                { label: 'Version bump and changelog entry', required: true },
            ]);
            const guidance = [
                'Migration: Map old design system API to new design system API, identify breaking changes and deprecations.',
                '',
                'Domain Validation Results:',
                '',
                'MIGRATION STRATEGY:',
                '1. Inventory: List all affected components and their usage',
                '2. Mapping: Document old API → new API transformations',
                '3. Breaking changes: Identify APIs that were removed or substantially changed',
                '4. Deprecations: Mark APIs that still work but will be removed in next major version',
                '5. Dependency graph: Build a dependency graph to plan migration order',
                '6. Testing strategy: Test migration on non-critical pages first, then roll out',
                '7. Documentation: Create migration guide with examples for each breaking change',
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
                .setSummary('Migration: API mapping and dependency analysis for design system updates')
                .addRule('color', colorDomainRules.map((r) => r.name))
                .addRule('typography', typographyDomainRules.map((r) => r.name))
                .addRule('spatial', spatialDomainRules.map((r) => r.name))
                .addRule('motion', motionDomainRules.map((r) => r.name))
                .addRule('interaction', interactionDomainRules.map((r) => r.name))
                .addRule('responsive', responsiveDomainRules.map((r) => r.name))
                .addRule('writing', writingDomainRules.map((r) => r.name))
                .addRule('migration', ['inventory', 'mapping', 'breaking changes', 'deprecations', 'dependency graph', 'testing strategy', 'documentation'])
                .addDecision('Migration strategy', 'Inventory-driven migration with breaking change documentation and dependency graph planning')
                .addMetric('color-rules-passing', colorPassed, getSeverity(colorPassRate), colorDomainRules.length)
                .addMetric('typography-rules-passing', typographyPassed, getSeverity(typographyPassRate), typographyDomainRules.length)
                .addMetric('spatial-rules-passing', spatialPassed, getSeverity(spatialPassRate), spatialDomainRules.length)
                .addMetric('motion-rules-passing', motionPassed, getSeverity(motionPassRate), motionDomainRules.length)
                .addMetric('interaction-rules-passing', interactionPassed, getSeverity(interactionPassRate), interactionDomainRules.length)
                .addMetric('responsive-rules-passing', responsivePassed, getSeverity(responsivePassRate), responsiveDomainRules.length)
                .addMetric('writing-rules-passing', writingPassed, getSeverity(writingPassRate), writingDomainRules.length)
                .addValidation('Color domain', getSeverity(colorPassRate), `${colorPassed}/${colorDomainRules.length} rules passing`)
                .addValidation('Typography domain', getSeverity(typographyPassRate), `${typographyPassed}/${typographyDomainRules.length} rules passing`)
                .addValidation('Spatial domain', getSeverity(spatialPassRate), `${spatialPassed}/${spatialDomainRules.length} rules passing`)
                .addValidation('Motion domain', getSeverity(motionPassRate), `${motionPassed}/${motionDomainRules.length} rules passing`)
                .addValidation('Interaction domain', getSeverity(interactionPassRate), `${interactionPassed}/${interactionDomainRules.length} rules passing`)
                .addValidation('Responsive domain', getSeverity(responsivePassRate), `${responsivePassed}/${responsiveDomainRules.length} rules passing`)
                .addValidation('Writing domain', getSeverity(writingPassRate), `${writingPassed}/${writingDomainRules.length} rules passing`)
                .addArtifact('reference', 1);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Migration workflow initialized - API mapping and dependency analysis',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Migration Guide', 'Old API → New API mappings with breaking change notes', 'Design system API migration documentation'),
                    this.createArtifact('reference', 'Dependency Graph', 'Component dependency map for migration order planning', 'Component impact analysis'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const errorMsg = String(err);
            console.error(`FlowQ Error: ${errorMsg}`);
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Migration failed: ${errorMsg.substring(0, 40)}`)
                .addValidation('migration-execution', 'fail', errorMsg)
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize migration',
                guidance: ['Error occurred during migration flow'],
                checklist: this.createChecklist([
                    { label: 'Error occurred', required: false, description: errorMsg },
                ]),
                error: errorMsg,
                memory,
            };
        }
    }
}
exports.FlowQMigrationHandler = FlowQMigrationHandler;
function createFlowQHandler() {
    return new FlowQMigrationHandler();
}
//# sourceMappingURL=flow-handler-migration.js.map