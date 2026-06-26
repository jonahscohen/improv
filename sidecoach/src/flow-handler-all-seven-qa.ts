// Flow V: All-Seven QA
// End-to-end QA orchestration across all 7 design domains

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

import { applyModelSelection } from './model-routing';
export class FlowVAllSevenQAHandler extends BaseFlowHandler {
  constructor() {
    super('flowV_all_seven_qa' as any);
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
        enhancedContext.flowMetadata.tags = ['flowV', 'all-seven-qa', 'comprehensive-qa'];
        enhancedContext.flowMetadata.customData = {
          'qa-checkpoints': 12,
        };
      }

      const checklist = this.createChecklist([
        { label: 'Manual testing complete (browser, devices, accessibility)', required: true },
        { label: 'Performance audit complete', required: true },
        { label: 'Accessibility audit complete', required: true },
        { label: 'Sign-off from design and product', required: true },
      ]);

      const guidance = [
        'All-Seven QA: End-to-end quality assurance across all 7 design domains.',
        '',
        'QA CHECKLIST:',
        '1. Automated checks: build, lint, and design.md token validation pass',
        '2. Manual QA: Test on actual devices and browsers',
        '3. Accessibility: Screen readers (VoiceOver/NVDA), keyboard navigation, contrast ratios',
        '4. Performance: Page load time, animation smoothness, memory usage',
        '5. Responsive: Mobile, tablet, desktop viewports tested',
        '6. Cross-browser: Chrome, Firefox, Safari, Edge support verified',
        '7. Sign-off: Design lead and product manager approval',
      ];

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('All-Seven QA: end-to-end manual QA checklist across browsers, devices, accessibility, and sign-off')
        .addDecision('QA strategy', 'Manual testing across browsers/devices/accessibility with stakeholder sign-off')
        .addArtifact('reference', 1);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'All-Seven QA workflow - end-to-end manual QA checklist',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'QA Report',
            'Manual QA across browsers, devices, accessibility, performance, and responsive viewports with stakeholder sign-off',
            'Comprehensive QA checklist'
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
