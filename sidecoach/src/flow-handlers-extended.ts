import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';

import { applyModelSelection } from './model-routing';

// T-0015 (2026-05-28): legacy Flow1/Flow3/Flow6/Flow8/Flow9/Flow11/Flow12/Flow13/Flow14
// handlers removed as duplicates of their lettered canonicals
// (flowO/flowK/flowP/flowR/flowI/flowF/flowM/flowN/flowQ respectively).
// Flow4ExploreHandler renamed to FlowYExploreHandler (exploration mode is the only
// no-success-criteria, generate-ideas flow - distinct from flowN rapid-iteration which
// is goal-driven with success criteria).

/**
 * Flow Y: Exploration/Discovery Mode
 * Open-ended exploration without success criteria.
 * Previously flow4_explore_discovery; renamed in T-0015.
 */
export class FlowYExploreHandler extends BaseFlowHandler {
  constructor() {
    super('flowY_explore_discovery');
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: 'Entering Exploration/Discovery Mode - Open-Ended Brainstorming',
      guidance: [
        'This is an open-ended exploration with no success criteria',
        'Goal: generate ideas and variations without judgment',
        'Try multiple directions, not just one "best" answer',
        'Document what you learn, not just what works',
        'Keep experiments and dead ends - learning is the goal',
      ],
      checklist: this.getExploreChecklist(),
      nextSteps: [
        'Define the aspect being explored (e.g., color palette, layout approach, interaction pattern)',
        'Generate 3-5 distinct variations or approaches',
        'For each variation: screenshot, describe thinking, note tradeoffs',
        'Explore different directions: contrast vs harmony, minimalist vs rich, etc.',
        'Document learnings: what surprised you, what feels right, what doesn\'t',
        'No need to pick a "winner" - the exploration itself is the goal',
        'Review findings and reflect on what you discovered',
      ],
    };
  }

  private getExploreChecklist(): ChecklistItem[] {
    return [
      {
        id: 'aspect-defined',
        label: 'Define what aspect is being explored',
        required: true,
        description: 'What are you trying to understand or generate ideas about?',
        completed: false,
      },
      {
        id: 'variation-1',
        label: 'Direction 1: First variation/approach',
        required: true,
        description: 'Create and document first exploration direction',
        completed: false,
      },
      {
        id: 'variation-2',
        label: 'Direction 2: Contrasting variation',
        required: true,
        description: 'Try a different direction to expand the solution space',
        completed: false,
      },
      {
        id: 'variation-3',
        label: 'Direction 3: Third variation',
        required: true,
        description: 'Push further into the exploration space',
        completed: false,
      },
      {
        id: 'each-documented',
        label: 'Each variation documented with screenshot and rationale',
        required: true,
        description: 'Take screenshots and note thinking for each direction',
        completed: false,
      },
      {
        id: 'tradeoffs-noted',
        label: 'Note tradeoffs and constraints for each approach',
        required: false,
        description: 'What works well, what\'s limited, what surprised you',
        completed: false,
      },
      {
        id: 'learnings-captured',
        label: 'Capture learnings and insights',
        required: true,
        description: 'What did you discover? What changed your thinking?',
        completed: false,
      },
    ];
  }
}
