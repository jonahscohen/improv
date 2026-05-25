"use strict";
/**
 * Flow Prerequisites System
 * Defines and validates flow execution prerequisites and dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowPrerequisiteValidator = void 0;
const FLOW_DEPENDENCIES = new Map([
    // Tier 1: Strategy/Research - no prerequisites
    ['flowA_brand_verify', {
            flowId: 'flowA_brand_verify',
            prerequisites: [],
            contextRequirements: ['projectPath'],
        }],
    ['flowB_component_research', {
            flowId: 'flowB_component_research',
            prerequisites: [],
            contextRequirements: ['projectPath'],
        }],
    ['flowC_font_research', {
            flowId: 'flowC_font_research',
            prerequisites: [],
            contextRequirements: ['projectPath'],
        }],
    ['flowD_reference_inspiration', {
            flowId: 'flowD_reference_inspiration',
            prerequisites: [
                { flowId: 'flowA_brand_verify', required: false },
                { flowId: 'flowB_component_research', required: false },
            ],
            contextRequirements: ['projectPath'],
        }],
    ['flowE_motion_patterns', {
            flowId: 'flowE_motion_patterns',
            prerequisites: [],
            contextRequirements: ['projectPath'],
        }],
    // Tier 2: Execution - build on research
    ['flowF_design_tokens', {
            flowId: 'flowF_design_tokens',
            prerequisites: [
                { flowId: 'flowA_brand_verify', required: true, reasonIfFailed: 'Brand verification required for token generation' },
                { flowId: 'flowD_reference_inspiration', required: false },
            ],
            contextRequirements: ['projectPath', 'designTokens'],
        }],
    ['flowG_component_implementation', {
            flowId: 'flowG_component_implementation',
            prerequisites: [
                { flowId: 'flowB_component_research', required: true },
                { flowId: 'flowF_design_tokens', required: false },
            ],
            contextRequirements: ['projectPath'],
        }],
    ['flowH_motion_integration', {
            flowId: 'flowH_motion_integration',
            prerequisites: [
                { flowId: 'flowE_motion_patterns', required: true },
                { flowId: 'flowG_component_implementation', required: false },
            ],
            contextRequirements: ['projectPath'],
        }],
    ['flowI_accessibility', {
            flowId: 'flowI_accessibility',
            prerequisites: [
                { flowId: 'flowG_component_implementation', required: true },
            ],
            contextRequirements: ['projectPath'],
        }],
    // Tier 3: Polish/QA - build on execution
    ['flowJ_tactical_polish', {
            flowId: 'flowJ_tactical_polish',
            prerequisites: [
                { flowId: 'flowG_component_implementation', required: true },
                { flowId: 'flowH_motion_integration', required: false },
            ],
        }],
    ['flowK_multi_lens_audit', {
            flowId: 'flowK_multi_lens_audit',
            prerequisites: [
                { flowId: 'flowJ_tactical_polish', required: true },
            ],
        }],
    ['flowL_design_critique', {
            flowId: 'flowL_design_critique',
            prerequisites: [
                { flowId: 'flowK_multi_lens_audit', required: false },
                { flowId: 'flowJ_tactical_polish', required: false },
            ],
            minSuccessfulPrerequisites: 1,
        }],
    ['flowM_responsive_validation', {
            flowId: 'flowM_responsive_validation',
            prerequisites: [
                { flowId: 'flowG_component_implementation', required: true },
            ],
        }],
    ['flowN_rapid_iteration_refined', {
            flowId: 'flowN_rapid_iteration_refined',
            prerequisites: [
                { flowId: 'flowK_multi_lens_audit', required: false },
                { flowId: 'flowL_design_critique', required: false },
            ],
        }],
    // Tier 4 & 5: Special flows
    ['flowO_clone_match_special', {
            flowId: 'flowO_clone_match_special',
            prerequisites: [],
        }],
    ['flowP_constraint_design_special', {
            flowId: 'flowP_constraint_design_special',
            prerequisites: [
                { flowId: 'flowA_brand_verify', required: false },
            ],
        }],
    ['flowQ_migration_special', {
            flowId: 'flowQ_migration_special',
            prerequisites: [],
            contextRequirements: ['projectPath'],
        }],
    ['flowR_layout_optimization', {
            flowId: 'flowR_layout_optimization',
            prerequisites: [
                { flowId: 'flowG_component_implementation', required: false },
            ],
        }],
    ['flowS_typography_excellence', {
            flowId: 'flowS_typography_excellence',
            prerequisites: [
                { flowId: 'flowC_font_research', required: false },
            ],
        }],
    ['flowT_ambitious_motion', {
            flowId: 'flowT_ambitious_motion',
            prerequisites: [
                { flowId: 'flowE_motion_patterns', required: false },
            ],
        }],
    ['flowU_curate', {
            flowId: 'flowU_curate',
            prerequisites: [
                { flowId: 'flowA_brand_verify', required: false },
                { flowId: 'flowB_component_research', required: false },
                { flowId: 'flowD_reference_inspiration', required: false },
            ],
            minSuccessfulPrerequisites: 1,
        }],
    ['flowV_all_seven_qa', {
            flowId: 'flowV_all_seven_qa',
            prerequisites: [
                { flowId: 'flowJ_tactical_polish', required: false },
                { flowId: 'flowK_multi_lens_audit', required: false },
            ],
        }],
    // Legacy flows - no dependencies
    ['flow1_clone_match', { flowId: 'flow1_clone_match', prerequisites: [] }],
    ['flow2_polish_enhance', { flowId: 'flow2_polish_enhance', prerequisites: [] }],
    ['flow3_audit_page', { flowId: 'flow3_audit_page', prerequisites: [] }],
    ['flow4_explore_discovery', { flowId: 'flow4_explore_discovery', prerequisites: [] }],
    ['flow5_review_qa', { flowId: 'flow5_review_qa', prerequisites: [] }],
    ['flow6_constraint_design', { flowId: 'flow6_constraint_design', prerequisites: [] }],
    ['flow7_design_component', { flowId: 'flow7_design_component', prerequisites: [] }],
    ['flow8_refactor_layout', { flowId: 'flow8_refactor_layout', prerequisites: [] }],
    ['flow9_accessible', { flowId: 'flow9_accessible', prerequisites: [] }],
    ['flow10_implement_design', { flowId: 'flow10_implement_design', prerequisites: [] }],
    ['flow11_extract_tokens', { flowId: 'flow11_extract_tokens', prerequisites: [] }],
    ['flow12_responsive_review', { flowId: 'flow12_responsive_review', prerequisites: [] }],
    ['flow13_rapid_iteration', { flowId: 'flow13_rapid_iteration', prerequisites: [] }],
    ['flow14_migration', { flowId: 'flow14_migration', prerequisites: [] }],
]);
class FlowPrerequisiteValidator {
    static getDependencies(flowId) {
        return FLOW_DEPENDENCIES.get(flowId) || null;
    }
    static canExecute(flowId, flowHistory) {
        const deps = FLOW_DEPENDENCIES.get(flowId);
        if (!deps || deps.prerequisites.length === 0) {
            return { canExecute: true };
        }
        const completedFlows = new Set(flowHistory
            .filter((entry) => entry.status === 'success')
            .map((entry) => entry.flowId));
        const requiredPrereqs = deps.prerequisites.filter((p) => p.required);
        const optionalPrereqs = deps.prerequisites.filter((p) => !p.required);
        // Check all required prerequisites
        for (const req of requiredPrereqs) {
            if (!completedFlows.has(req.flowId)) {
                return {
                    canExecute: false,
                    reason: req.reasonIfFailed || `Required flow ${req.flowId} has not been executed`,
                };
            }
        }
        // Check minimum successful optional prerequisites
        if (deps.minSuccessfulPrerequisites) {
            const successfulOptional = optionalPrereqs.filter((p) => completedFlows.has(p.flowId)).length;
            if (successfulOptional < deps.minSuccessfulPrerequisites) {
                return {
                    canExecute: false,
                    reason: `Need at least ${deps.minSuccessfulPrerequisites} of ${optionalPrereqs.length} optional prerequisites`,
                };
            }
        }
        return { canExecute: true };
    }
    static validateContextRequirements(flowId, context) {
        const deps = FLOW_DEPENDENCIES.get(flowId);
        if (!deps || !deps.contextRequirements) {
            return { valid: true };
        }
        // Sprint 9 T2: also consult context.metadata so requirements like 'designTokens'
        // resolve against the canonical metadata location used by flow handlers.
        const meta = (context && typeof context.metadata === 'object' && context.metadata) || {};
        const missing = deps.contextRequirements.filter((req) => !context[req] && !meta[req]);
        return {
            valid: missing.length === 0,
            missing: missing.length > 0 ? missing : undefined,
        };
    }
    static getPrerequisiteChain(flowId) {
        const chain = [];
        const visited = new Set();
        const traverse = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            const deps = FLOW_DEPENDENCIES.get(id);
            if (deps) {
                for (const prereq of deps.prerequisites.filter((p) => p.required)) {
                    traverse(prereq.flowId);
                    chain.push(prereq.flowId);
                }
            }
        };
        traverse(flowId);
        chain.push(flowId);
        return chain;
    }
}
exports.FlowPrerequisiteValidator = FlowPrerequisiteValidator;
//# sourceMappingURL=flow-prerequisites.js.map