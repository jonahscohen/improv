"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseFlowHandler = void 0;
class BaseFlowHandler {
    constructor(flowId) {
        this.flowId = flowId;
    }
    canExecute(context) {
        return true;
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'skipped',
            message: 'Flow handler not implemented',
        };
    }
    getFlowName() {
        const flowNames = {
            // Tier 1: Strategy/Research
            flowA_brand_verify: 'Brand/PRODUCT.md Verification',
            flowB_component_research: 'Component Research (component.gallery)',
            flowC_font_research: 'Font Research (fontshare.com)',
            flowD_reference_inspiration: 'Reference/Inspiration Search',
            flowE_motion_patterns: 'Motion Pattern Library (GSAP/Lenis)',
            // Tier 2: Execution
            flowF_design_tokens: 'Design System Tokens (DESIGN.md)',
            flowG_component_implementation: 'Component Implementation',
            flowH_motion_integration: 'Motion Integration (GSAP/Lenis)',
            flowI_accessibility: 'Accessibility Compliance (WCAG 2.1 AA)',
            // Tier 3: Polish/QA
            flowJ_tactical_polish: '16-Point Tactical Polish',
            flowK_multi_lens_audit: 'Multi-Lens Audit (5 dimensions)',
            flowL_design_critique: 'Design Critique (Nielsen heuristics)',
            flowM_responsive_validation: 'Responsive Design Validation',
            flowN_rapid_iteration_refined: 'Rapid Iteration (Token-based)',
            // Tier 4: Special
            flowO_clone_match_special: 'Clone/Match from Reference (Special)',
            flowP_constraint_design_special: 'Constraint-Based Design (Special)',
            flowQ_migration_special: 'Migration/Refactor (Special)',
            // Tier 5: Specialized Refinement (NEW - v2.1.9)
            flowR_layout_optimization: 'Layout & Spacing Optimization',
            flowS_typography_excellence: 'Typography Excellence',
            flowT_ambitious_motion: 'Ambitious Motion & Physics',
            // Special: Curate & All-Seven QA
            flowU_curate: 'Curate Design References',
            flowV_all_seven_qa: 'All-Seven QA Pipeline',
            // Tier 6: Composition & Copy
            flowW_landing_composition: 'Landing Page Composition (sections + rhythm)',
            flowX_copywriting: 'Copywriting (per-slot draft options)',
            // Tier 7: Renamed legacy (T-0015)
            flowY_explore_discovery: 'Exploration/Discovery Mode',
            flowZ_design_component: 'Design a New Component (from scratch)',
        };
        return flowNames[this.flowId] || 'Unknown Flow';
    }
    createChecklist(items) {
        return items.map((item, index) => ({
            id: `item-${index}`,
            ...item,
            completed: false,
        }));
    }
    createArtifact(type, name, content, description) {
        return { type, name, content, description };
    }
}
exports.BaseFlowHandler = BaseFlowHandler;
//# sourceMappingURL=flow-handler.js.map