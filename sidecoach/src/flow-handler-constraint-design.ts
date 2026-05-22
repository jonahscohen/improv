// Flow P: Constraint Design
// Design within explicit limits, final refinement

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';

export class FlowPConstraintDesignHandler extends BaseFlowHandler {
  constructor() {
    super('flowP_constraint_design_special');
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
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

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Constraint design: finalize within explicit limits (tokens, budget, timeline)')
        .addRule('constraints', ['tokens', 'budget', 'timeline', 'scope', 'devices'])
        .addRule('analysis', ['rank hard vs soft', 'identify conflicts', 'design in intersection'])
        .addRule('finalization', ['explore variations', 'select final', 'document rationale', 'get sign-off'])
        .addDecision('Constraint strategy', 'Explicit constraint definition with hard/soft ranking and conflict resolution')
        .addMetric('constraints-identified', 0, 'pass')
        .addMetric('hard-constraints', 0, 'pass')
        .addMetric('soft-constraints', 0, 'pass')
        .addValidation('Constraint design', 'pass', 'Framework initialized')
        .addArtifact('constraints', 1);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'Constraint Design workflow initialized - design within explicit limits',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Constraint Framework',
            'Tokens | Budget | Timeline | Scope | Devices | Performance | Browser',
            'Explicit design constraints'
          ),
        ],
        memory: memoryBuilder.build(),
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
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

export function createFlowPHandler(): FlowPConstraintDesignHandler {
  return new FlowPConstraintDesignHandler();
}
