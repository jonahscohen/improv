import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';

import { applyModelSelection } from './model-routing';

// T-0015 (2026-05-28): legacy Flow2/Flow5/Flow10 handlers removed as duplicates of
// flowJ_tactical_polish / flowK_multi_lens_audit / flowG_component_implementation.
// Flow7DesignHandler renamed to FlowZDesignHandler (designing from scratch is a
// distinct flow from flowG implement-from-design and flowO clone-exactly).

/**
 * Flow Z: Design a New Component (from scratch)
 * Consolidates /sidecoach craft + QA triad (audit -> critique -> polish).
 * Previously flow7_design_component; renamed in T-0015.
 */
export class FlowZDesignHandler extends BaseFlowHandler {
  constructor() {
    super('flowZ_design_component');
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: 'Initiating Design Component workflow with QA Triad',
      guidance: [
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

  private getDesignComponentChecklist(): ChecklistItem[] {
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
