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
            flow1_clone_match: 'Clone/Match from Reference',
            flow2_polish_enhance: 'Polish/Enhance Interaction',
            flow3_audit_page: 'Audit Page/Section',
            flow4_explore_discovery: 'Exploration/Discovery Mode',
            flow5_review_qa: 'Review/QA Mode',
            flow6_constraint_design: 'Constraint-Based Design',
            flow7_design_component: 'Design a New Component',
            flow8_refactor_layout: 'Refactor/Improve Section',
            flow9_accessible: 'Make Accessible',
            flow10_implement_design: 'Implement from Design',
            flow11_extract_tokens: 'Extract Design Tokens',
            flow12_responsive_review: 'Responsive Design Review',
            flow13_rapid_iteration: 'Rapid Iteration/Refinement',
            flow14_migration: 'Migration/API Changes',
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