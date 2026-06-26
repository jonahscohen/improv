"use strict";
// Flow P: Constraint Design
// Design within explicit limits, final refinement
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowPConstraintDesignHandler = void 0;
exports.createFlowPHandler = createFlowPHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
class FlowPConstraintDesignHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowP_constraint_design_special');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(_context) {
        try {
            const checklist = this.createChecklist([
                { label: 'Define constraints (tokens, budget, timeline)', required: true },
                { label: 'Identify design variations within constraints', required: true },
                { label: 'Evaluate trade-offs per constraint', required: true },
                { label: 'Finalize design that meets all constraints', required: true },
                { label: 'Document constraint decisions', required: true },
                { label: 'Validate against all constraints', required: true },
            ]);
            const guidance = [
                'Constraint Design finalizes interface design within explicit limits: tokens, performance budget, timeline, or feature scope.',
                '',
                'CONSTRAINT TYPES:',
                '- Design tokens (colors, spacing, typography)',
                '- Bundle size (<250KB)',
                '- Animation budget (reduced-motion support required)',
                '- Browser support (IE11, or modern-only)',
                '- Device support (mobile-first, iOS/Android)',
                '- Feature scope (MVP vs phase 2)',
                '- Timeline (must ship this sprint)',
                '',
                'CONSTRAINT ANALYSIS:',
                '- List all constraints',
                '- Rank by strictness (hard vs soft)',
                '- Identify conflicts (conflicting constraints)',
                '- Design within intersection of all hard constraints',
                '',
                'FINALIZATION:',
                '- Explore variations within constraints',
                '- Select final design',
                '- Document why this design meets constraints',
                '- Get sign-off from stakeholders',
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Constraint design: finalize within explicit limits (tokens, budget, timeline)')
                .addRule('constraints', ['tokens', 'budget', 'timeline', 'scope', 'devices'])
                .addRule('analysis', ['rank hard vs soft', 'identify conflicts', 'design in intersection'])
                .addRule('finalization', ['explore variations', 'select final', 'document rationale', 'get sign-off'])
                .addDecision('Constraint strategy', 'Explicit constraint definition with hard/soft ranking and conflict resolution')
                .addArtifact('constraints', 1);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Constraint Design workflow initialized - design within explicit limits',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Constraint Framework', 'Tokens | Budget | Timeline | Scope | Devices | Performance | Browser', 'Explicit design constraints'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Constraint design failed: ${String(err).substring(0, 40)}`)
                .addValidation('constraint-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize constraint design',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowPConstraintDesignHandler = FlowPConstraintDesignHandler;
function createFlowPHandler() {
    return new FlowPConstraintDesignHandler();
}
//# sourceMappingURL=flow-handler-constraint-design.js.map