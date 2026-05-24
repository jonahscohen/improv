// Flow V: All-Seven QA
// End-to-end QA orchestration across all 7 design domains

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

export class FlowVAllSevenQAHandler extends BaseFlowHandler {
  constructor() {
    super('flowV_all_seven_qa' as any);
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const enhancedContext = context as EnhancedFlowExecutionContext;
    try {
      // Comprehensive validation across all 7 design domains
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

      // Get all 7 domain rules
      const colorDomainRules = ExtendedDomainValidator.getRulesByDomain('color');
      const typographyDomainRules = ExtendedDomainValidator.getRulesByDomain('typography');
      const spatialDomainRules = ExtendedDomainValidator.getRulesByDomain('spatial');
      const motionDomainRules = ExtendedDomainValidator.getRulesByDomain('motion');
      const interactionDomainRules = ExtendedDomainValidator.getRulesByDomain('interaction');
      const responsiveDomainRules = ExtendedDomainValidator.getRulesByDomain('responsive');
      const writingDomainRules = ExtendedDomainValidator.getRulesByDomain('writing');

      // Extract pass rates for all domains
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

      // Calculate total pass rate across all domains
      const totalRules = colorDomainRules.length + typographyDomainRules.length + spatialDomainRules.length +
                        motionDomainRules.length + interactionDomainRules.length + responsiveDomainRules.length +
                        writingDomainRules.length;
      const totalPassed = colorPassed + typographyPassed + spatialPassed + motionPassed +
                         interactionPassed + responsivePassed + writingPassed;
      const overallPassRate = totalRules > 0 ? Math.round((totalPassed / totalRules) * 100) : 0;

      if (enhancedContext?.flowMetadata) {
        enhancedContext.flowMetadata.tags = ['flowV', 'all-seven-qa', 'comprehensive-qa'];
        enhancedContext.flowMetadata.customData = {
          'design-domains': 7,
          'total-rules': totalRules,
          'rules-passed': totalPassed,
          'overall-pass-rate': overallPassRate,
          'qa-checkpoints': 12,
        };
      }

      const checklist = this.createChecklist([
        { label: 'Color domain validation', required: false, description: `${colorPassed}/${colorDomainRules.length} rules passing (${colorPassRate})` },
        { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
        { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
        { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
        { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
        { label: 'Responsive domain validation', required: false, description: `${responsivePassed}/${responsiveDomainRules.length} rules passing (${responsivePassRate})` },
        { label: 'Writing domain validation', required: false, description: `${writingPassed}/${writingDomainRules.length} rules passing (${writingPassRate})` },
        { label: 'Overall quality score', required: false, description: `${totalPassed}/${totalRules} rules passing (${overallPassRate}%)` },
        { label: 'Manual testing complete (browser, devices, accessibility)', required: true },
        { label: 'Performance audit complete', required: true },
        { label: 'Accessibility audit complete', required: true },
        { label: 'Sign-off from design and product', required: true },
      ]);

      const guidance = [
        'All-Seven QA: End-to-end quality assurance across all 7 design domains.',
        '',
        'QA CHECKLIST:',
        '1. Automated validation: All 7 domains passed through validator',
        '2. Manual QA: Test on actual devices and browsers',
        '3. Accessibility: Screen readers (VoiceOver/NVDA), keyboard navigation, contrast ratios',
        '4. Performance: Page load time, animation smoothness, memory usage',
        '5. Responsive: Mobile, tablet, desktop viewports tested',
        '6. Cross-browser: Chrome, Firefox, Safari, Edge support verified',
        '7. Sign-off: Design lead and product manager approval',
      ];

      const getSeverity = (percentage: string): 'pass' | 'warning' | 'fail' => {
        const num = parseFloat(percentage);
        if (num >= 80) return 'pass';
        if (num >= 50) return 'warning';
        return 'fail';
      };

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(`All-Seven QA: ${totalPassed}/${totalRules} rules passing (${overallPassRate}%) - end-to-end QA complete`)
        .addRule('color', colorDomainRules.map((r) => r.name))
        .addRule('typography', typographyDomainRules.map((r) => r.name))
        .addRule('spatial', spatialDomainRules.map((r) => r.name))
        .addRule('motion', motionDomainRules.map((r) => r.name))
        .addRule('interaction', interactionDomainRules.map((r) => r.name))
        .addRule('responsive', responsiveDomainRules.map((r) => r.name))
        .addRule('writing', writingDomainRules.map((r) => r.name))
        .addDecision('QA strategy', 'Comprehensive 7-domain validation with manual testing and stakeholder sign-off')
        .addMetric('overall-pass-rate', overallPassRate, getSeverity(`${overallPassRate}%`), 100)
        .addMetric('color-rules-passing', colorPassed, getSeverity(colorPassRate), colorDomainRules.length)
        .addMetric('typography-rules-passing', typographyPassed, getSeverity(typographyPassRate), typographyDomainRules.length)
        .addMetric('spatial-rules-passing', spatialPassed, getSeverity(spatialPassRate), spatialDomainRules.length)
        .addMetric('motion-rules-passing', motionPassed, getSeverity(motionPassRate), motionDomainRules.length)
        .addMetric('interaction-rules-passing', interactionPassed, getSeverity(interactionPassRate), interactionDomainRules.length)
        .addMetric('responsive-rules-passing', responsivePassed, getSeverity(responsivePassRate), responsiveDomainRules.length)
        .addMetric('writing-rules-passing', writingPassed, getSeverity(writingPassRate), writingDomainRules.length)
        .addValidation('Overall QA', getSeverity(`${overallPassRate}%`), `${totalPassed}/${totalRules} rules passing`)
        .addValidation('Color domain', getSeverity(colorPassRate), `${colorPassed}/${colorDomainRules.length} rules passing`)
        .addValidation('Typography domain', getSeverity(typographyPassRate), `${typographyPassed}/${typographyDomainRules.length} rules passing`)
        .addValidation('Spatial domain', getSeverity(spatialPassRate), `${spatialPassed}/${spatialDomainRules.length} rules passing`)
        .addValidation('Motion domain', getSeverity(motionPassRate), `${motionPassed}/${motionDomainRules.length} rules passing`)
        .addValidation('Interaction domain', getSeverity(interactionPassRate), `${interactionPassed}/${interactionDomainRules.length} rules passing`)
        .addValidation('Responsive domain', getSeverity(responsivePassRate), `${responsivePassed}/${responsiveDomainRules.length} rules passing`)
        .addValidation('Writing domain', getSeverity(writingPassRate), `${writingPassed}/${writingDomainRules.length} rules passing`)
        .addArtifact('reference', 1);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `All-Seven QA workflow - Overall quality: ${overallPassRate}% (${totalPassed}/${totalRules} rules)`,
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'QA Report',
            `Overall: ${overallPassRate}% | Color: ${colorPassRate} | Typography: ${typographyPassRate} | Spatial: ${spatialPassRate} | Motion: ${motionPassRate} | Interaction: ${interactionPassRate} | Responsive: ${responsivePassRate} | Writing: ${writingPassRate}`,
            'Comprehensive QA metrics and domain results'
          ),
        ],
        memory: memoryBuilder.build(),
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`All-Seven QA failed: ${String(err).substring(0, 40)}`)
        .addValidation('qa-execution', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to initialize All-Seven QA',
        error: String(err),
        memory,
      };
    }
  }
}

export function createFlowVHandler(): FlowVAllSevenQAHandler {
  return new FlowVAllSevenQAHandler();
}
