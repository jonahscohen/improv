"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowZDesignHandler = void 0;
const flow_handler_1 = require("./flow-handler");
const model_routing_1 = require("./model-routing");
const craft_flow_1 = require("./craft-flow");
// T-0015 (2026-05-28): legacy Flow2/Flow5/Flow10 handlers removed as duplicates of
// flowJ_tactical_polish / flowK_multi_lens_audit / flowG_component_implementation.
// Flow7DesignHandler renamed to FlowZDesignHandler (designing from scratch is a
// distinct flow from flowG implement-from-design and flowO clone-exactly).
/**
 * Flow Z: Design a New Component (from scratch)
 * Consolidates /sidecoach craft + QA triad (audit -> critique -> polish).
 * Previously flow7_design_component; renamed in T-0015.
 */
class FlowZDesignHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowZ_design_component');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        // TEACH, THEN CHECK. This flow's payload was a description of the QA triad it will run later -
        // "1. Audit, 2. Critique, 3. Polish" - which tells the producer what will be checked and nothing
        // about how to make the component good in the first place. Teaching only at the gate is the
        // expensive order: every defect the brief prevents here is one the triad does not have to find.
        const craft = await (0, craft_flow_1.flowCraft)(context.projectPath, {
            shape: 'produce',
            findingClasses: ['a11y', 'theming'],
            lawDomains: ['interaction', 'research'],
            domainLabel: 'a new component',
        });
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Design Component workflow with QA Triad',
            guidance: [
                ...(0, craft_flow_1.craftGuidanceBlock)(craft, 'no accessibility or theming rules were measurable on this project.'),
                'This flow executes a 3-step QA triad after design:',
                '1. Audit: Technical scan (a11y, perf, responsive, etc.)',
                '2. Critique: Design review via independent agents (Nielsen heuristics, cognitive load)',
                '3. Polish: Final visual alignment against design system',
                'Each step must complete before moving to the next',
            ],
            checklist: this.getDesignComponentChecklist(),
            nextSteps: [
                'Extract the new component from your design file',
                'Implement in code with all required states',
                'Run Audit: /sidecoach audit <component>',
                'Address all Critical and High findings',
                'Run Critique: /sidecoach critique <component>',
                'Refine design based on feedback',
                'Run Polish: /sidecoach polish <component>',
                'Verify final visual correctness against design system',
            ],
        };
    }
    getDesignComponentChecklist() {
        return [
            {
                id: 'extract-design',
                label: 'Extract component from design source',
                required: true,
                description: 'Get exact specs: colors, typography, spacing, states',
                completed: false,
            },
            {
                id: 'implement-all-states',
                label: 'Implement all component states',
                required: true,
                description: 'Default, hover, active, focus, disabled, loading, error',
                completed: false,
            },
            {
                id: 'audit-technical',
                label: 'QA Triad - Audit: Technical scan',
                required: true,
                description: 'Run /sidecoach audit to check a11y, perf, responsive, anti-patterns',
                completed: false,
            },
            {
                id: 'audit-fixes',
                label: 'Fix all Audit Critical/High findings',
                required: true,
                description: 'Address accessibility, performance, and responsive issues',
                completed: false,
            },
            {
                id: 'critique-design',
                label: 'QA Triad - Critique: Design review',
                required: true,
                description: 'Run /sidecoach critique for Nielsen heuristics and UX feedback',
                completed: false,
            },
            {
                id: 'critique-refinement',
                label: 'Refine based on Critique feedback',
                required: true,
                description: 'Address design concerns and usability issues',
                completed: false,
            },
            {
                id: 'polish-alignment',
                label: 'QA Triad - Polish: Design system alignment',
                required: true,
                description: 'Run /sidecoach polish to verify design token usage and visual correctness',
                completed: false,
            },
            {
                id: 'design-vs-code',
                label: 'Compare: Design vs Implementation side-by-side',
                required: true,
                description: 'Verify all details match (colors, spacing, typography, radius, shadows)',
                completed: false,
            },
        ];
    }
}
exports.FlowZDesignHandler = FlowZDesignHandler;
//# sourceMappingURL=flow-handlers-core.js.map