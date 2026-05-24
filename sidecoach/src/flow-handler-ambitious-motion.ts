// Flow T: Ambitious Motion
// Advanced animation sequences and micro-interactions

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

export class FlowTAmbitiousMotionHandler extends BaseFlowHandler {
  constructor() {
    super('flowT_ambitious_motion' as any);
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const enhancedContext = context as EnhancedFlowExecutionContext;
    try {
      const domainCheckContext: DomainCheckContext = {
        designTokens: context.metadata?.designTokens || {},
        motion: context.metadata?.motion || {},
        accessibility: context.metadata?.accessibility || {},
      };

      const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext);
      const motionDomainRules = ExtendedDomainValidator.getRulesByDomain('motion');
      const interactionDomainRules = ExtendedDomainValidator.getRulesByDomain('interaction');

      const motionPassRate = extendedValidationReport.passRateByDomain['motion'] || '0%';
      const interactionPassRate = extendedValidationReport.passRateByDomain['interaction'] || '0%';

      const motionPassed = Math.round((parseFloat(motionPassRate) / 100) * motionDomainRules.length);
      const interactionPassed = Math.round((parseFloat(interactionPassRate) / 100) * interactionDomainRules.length);

      if (enhancedContext?.flowMetadata) {
        enhancedContext.flowMetadata.tags = ['flowT', 'ambitious-motion', 'advanced-animations'];
        enhancedContext.flowMetadata.customData = {
          'motion-rules': motionDomainRules.length,
          'motion-rules-passed': motionPassed,
          'interaction-rules-passed': interactionPassed,
          'animation-sequences': 12,
        };
      }

      const checklist = this.createChecklist([
        { label: 'Define motion tokens (duration, easing)', required: true },
        { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
        { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
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
        'Domain Validation Results:',
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

      const getSeverity = (percentage: string): 'pass' | 'warning' | 'fail' => {
        const num = parseFloat(percentage);
        if (num >= 80) return 'pass';
        if (num >= 50) return 'warning';
        return 'fail';
      };

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Ambitious motion: advanced animation sequences and micro-interactions')
        .addRule('motion', motionDomainRules.map((r) => r.name))
        .addRule('interaction', interactionDomainRules.map((r) => r.name))
        .addDecision('Motion strategy', 'Exponential easing with deliberate timing for entrance/exit/state animations')
        .addMetric('motion-rules-passing', motionPassed, getSeverity(motionPassRate), motionDomainRules.length)
        .addMetric('interaction-rules-passing', interactionPassed, getSeverity(interactionPassRate), interactionDomainRules.length)
        .addValidation('Motion domain', getSeverity(motionPassRate), `${motionPassed}/${motionDomainRules.length} rules passing`)
        .addValidation('Interaction domain', getSeverity(interactionPassRate), `${interactionPassed}/${interactionDomainRules.length} rules passing`)
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
