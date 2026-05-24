// Flow P: Constraint Design
// Design within explicit limits, final refinement

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';

export class FlowPConstraintDesignHandler extends BaseFlowHandler {
  constructor() {
    super('flowP_constraint_design_special');
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    try {
      // Domain validation integration - comprehensive constraint audit across all 7 domains
      const domainCheckContext: DomainCheckContext = {
        designTokens: context.metadata?.designTokens || {},
        componentTree: context.metadata?.componentTree || { nodeCount: 0 },
        cssRules: context.metadata?.cssRules || [],
        colors: context.metadata?.colors || {},
        typography: context.metadata?.typography || {},
        spacing: context.metadata?.spacing || {},
        motion: context.metadata?.motion || {},
        accessibility: context.metadata?.accessibility || {},
      };

      const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext);

      // Get all 7 domain rules for comprehensive constraint validation
      const colorDomainRules = ExtendedDomainValidator.getRulesByDomain('color');
      const typographyDomainRules = ExtendedDomainValidator.getRulesByDomain('typography');
      const spatialDomainRules = ExtendedDomainValidator.getRulesByDomain('spatial');
      const motionDomainRules = ExtendedDomainValidator.getRulesByDomain('motion');
      const interactionDomainRules = ExtendedDomainValidator.getRulesByDomain('interaction');
      const responsiveDomainRules = ExtendedDomainValidator.getRulesByDomain('responsive');
      const writingDomainRules = ExtendedDomainValidator.getRulesByDomain('writing');

      // Extract pass rates
      const colorPassRate = extendedValidationReport.passRateByDomain['color'] || '0%';
      const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
      const spatialPassRate = extendedValidationReport.passRateByDomain['spatial'] || '0%';
      const motionPassRate = extendedValidationReport.passRateByDomain['motion'] || '0%';
      const interactionPassRate = extendedValidationReport.passRateByDomain['interaction'] || '0%';
      const responsivePassRate = extendedValidationReport.passRateByDomain['responsive'] || '0%';
      const writingPassRate = extendedValidationReport.passRateByDomain['writing'] || '0%';

      // Calculate rules passing per domain
      const colorPassed = Math.round((parseFloat(colorPassRate) / 100) * colorDomainRules.length);
      const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);
      const spatialPassed = Math.round((parseFloat(spatialPassRate) / 100) * spatialDomainRules.length);
      const motionPassed = Math.round((parseFloat(motionPassRate) / 100) * motionDomainRules.length);
      const interactionPassed = Math.round((parseFloat(interactionPassRate) / 100) * interactionDomainRules.length);
      const responsivePassed = Math.round((parseFloat(responsivePassRate) / 100) * responsiveDomainRules.length);
      const writingPassed = Math.round((parseFloat(writingPassRate) / 100) * writingDomainRules.length);

      const checklist = this.createChecklist([
        { label: 'Define constraints (tokens, budget, timeline)', required: true },
        { label: 'Color domain validation', required: false, description: `${colorPassed}/${colorDomainRules.length} rules passing (${colorPassRate})` },
        { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
        { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
        { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
        { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
        { label: 'Responsive domain validation', required: false, description: `${responsivePassed}/${responsiveDomainRules.length} rules passing (${responsivePassRate})` },
        { label: 'Writing domain validation', required: false, description: `${writingPassed}/${writingDomainRules.length} rules passing (${writingPassRate})` },
        { label: 'Identify design variations within constraints', required: true },
        { label: 'Evaluate trade-offs per constraint', required: true },
        { label: 'Finalize design that meets all constraints', required: true },
        { label: 'Document constraint decisions', required: true },
        { label: 'Validate against all constraints', required: true },
      ]);

      const guidance = [
        'Constraint Design finalizes interface design within explicit limits: tokens, performance budget, timeline, or feature scope.',
        '',
        'Domain Validation Results:',
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

      const getSeverity = (percentage: string): 'pass' | 'warning' | 'fail' => {
        const num = parseFloat(percentage);
        if (num >= 80) return 'pass';
        if (num >= 50) return 'warning';
        return 'fail';
      };

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Constraint design: finalize within explicit limits (tokens, budget, timeline)')
        .addRule('color', colorDomainRules.map((r) => r.name))
        .addRule('typography', typographyDomainRules.map((r) => r.name))
        .addRule('spatial', spatialDomainRules.map((r) => r.name))
        .addRule('motion', motionDomainRules.map((r) => r.name))
        .addRule('interaction', interactionDomainRules.map((r) => r.name))
        .addRule('responsive', responsiveDomainRules.map((r) => r.name))
        .addRule('writing', writingDomainRules.map((r) => r.name))
        .addRule('constraints', ['tokens', 'budget', 'timeline', 'scope', 'devices'])
        .addRule('analysis', ['rank hard vs soft', 'identify conflicts', 'design in intersection'])
        .addRule('finalization', ['explore variations', 'select final', 'document rationale', 'get sign-off'])
        .addDecision('Constraint strategy', 'Explicit constraint definition with hard/soft ranking and conflict resolution')
        .addMetric('color-rules-passing', colorPassed, getSeverity(colorPassRate), colorDomainRules.length)
        .addMetric('typography-rules-passing', typographyPassed, getSeverity(typographyPassRate), typographyDomainRules.length)
        .addMetric('spatial-rules-passing', spatialPassed, getSeverity(spatialPassRate), spatialDomainRules.length)
        .addMetric('motion-rules-passing', motionPassed, getSeverity(motionPassRate), motionDomainRules.length)
        .addMetric('interaction-rules-passing', interactionPassed, getSeverity(interactionPassRate), interactionDomainRules.length)
        .addMetric('responsive-rules-passing', responsivePassed, getSeverity(responsivePassRate), responsiveDomainRules.length)
        .addMetric('writing-rules-passing', writingPassed, getSeverity(writingPassRate), writingDomainRules.length)
        .addValidation('Color domain', getSeverity(colorPassRate), `${colorPassed}/${colorDomainRules.length} rules passing`)
        .addValidation('Typography domain', getSeverity(typographyPassRate), `${typographyPassed}/${typographyDomainRules.length} rules passing`)
        .addValidation('Spatial domain', getSeverity(spatialPassRate), `${spatialPassed}/${spatialDomainRules.length} rules passing`)
        .addValidation('Motion domain', getSeverity(motionPassRate), `${motionPassed}/${motionDomainRules.length} rules passing`)
        .addValidation('Interaction domain', getSeverity(interactionPassRate), `${interactionPassed}/${interactionDomainRules.length} rules passing`)
        .addValidation('Responsive domain', getSeverity(responsivePassRate), `${responsivePassed}/${responsiveDomainRules.length} rules passing`)
        .addValidation('Writing domain', getSeverity(writingPassRate), `${writingPassed}/${writingDomainRules.length} rules passing`)
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
