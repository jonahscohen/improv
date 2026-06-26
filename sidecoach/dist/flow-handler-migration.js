"use strict";
// Flow Q: Migration
// API migration and dependency mapping for design system updates
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowQMigrationHandler = void 0;
exports.createFlowQHandler = createFlowQHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
class FlowQMigrationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowQ_migration_special');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        try {
            const checklist = this.createChecklist([
                { label: 'List all affected components', required: true },
                { label: 'Map old API to new API', required: true },
                { label: 'Identify breaking changes', required: true },
                { label: 'Identify deprecations vs removals', required: true },
                { label: 'Document migration path per component', required: true },
                { label: 'Create dependency graph of affected components', required: true },
                { label: 'Test migration on non-critical pages first', required: true },
                { label: 'Version bump and changelog entry', required: true },
            ]);
            const guidance = [
                'Migration: Map old design system API to new design system API, identify breaking changes and deprecations.',
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
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Migration: API mapping and dependency analysis for design system updates')
                .addRule('migration', ['inventory', 'mapping', 'breaking changes', 'deprecations', 'dependency graph', 'testing strategy', 'documentation'])
                .addDecision('Migration strategy', 'Inventory-driven migration with breaking change documentation and dependency graph planning')
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