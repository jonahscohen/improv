// Flow T: Ambitious Motion
// Advanced animation sequences and micro-interactions

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

import { applyModelSelection } from './model-routing';
export class FlowTAmbitiousMotionHandler extends BaseFlowHandler {
  constructor() {
    super('flowT_ambitious_motion' as any);
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    const enhancedContext = context as EnhancedFlowExecutionContext;
    try {
      if (enhancedContext?.flowMetadata) {
        enhancedContext.flowMetadata.tags = ['flowT', 'ambitious-motion', 'advanced-animations'];
        enhancedContext.flowMetadata.customData = {
          'animation-sequences': 12,
        };
      }

      const checklist = this.createChecklist([
        { label: 'Define motion tokens (duration, easing)', required: true },
        { label: 'Design entrance animations (fade, slide, scale)', required: true },
        { label: 'Design exit animations (fade, scale, collapse)', required: true },
        { label: 'Design state transitions (active, hover, focus, disabled)', required: true },
        { label: 'Test with prefers-reduced-motion', required: true },
        { label: 'Verify stagger timing for sequences', required: true },
        { label: 'Document animation library (Framer Motion, GSAP, etc.)', required: true },
      ]);

      const guidance = [
        'Ambitious Motion: Advanced animation sequences and micro-interactions for delight.',
        '',
        'MOTION TOKENS:',
        '- Duration: 150ms (micro), 300ms (standard), 500ms (deliberate)',
        '- Easing: exponential-out (easeOutExpo) for all motion',
        '- Stagger: 30-50ms between sequence items',
        '',
        'ANIMATION TYPES:',
        '- Entrance: fade-in, slide-up, scale-up (200ms)',
        '- Exit: fade-out, scale-down, collapse (150ms)',
        '- State: hover (scale 1.05), active (scale 0.95), focus (ring animation)',
        '',
        'ACCESSIBILITY:',
        '- Respect prefers-reduced-motion (no animation)',
        '- Provide instant fallback for unsupported browsers',
        '- Ensure animation is not essential to understanding',
      ];

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Ambitious motion: advanced animation sequences and micro-interactions')
        .addDecision('Motion strategy', 'Exponential easing with deliberate timing for entrance/exit/state animations')
        .addArtifact('animation-library', 1);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'Ambitious motion workflow initialized - advanced animations',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Animation Library',
            'Motion tokens and animation patterns',
            'Animation system documentation'
          ),
        ],
        memory: memoryBuilder.build(),
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Ambitious motion failed: ${String(err).substring(0, 40)}`)
        .addValidation('motion-execution', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to initialize ambitious motion',
        error: String(err),
        memory,
      };
    }
  }
}

export function createFlowTHandler(): FlowTAmbitiousMotionHandler {
  return new FlowTAmbitiousMotionHandler();
}
