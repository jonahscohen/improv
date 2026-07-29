// Flow R: Layout Optimization
// Spacing and hierarchy refinement for visual clarity

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

import { applyModelSelection } from './model-routing';
import { flowCraft, craftGuidanceBlock } from './craft-flow';
export class FlowRLayoutOptimizationHandler extends BaseFlowHandler {
  constructor() {
    super('flowR_layout_optimization' as any);
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
        enhancedContext.flowMetadata.tags = ['flowR', 'layout-optimization', 'spacing-hierarchy'];
        enhancedContext.flowMetadata.customData = {
          'spacing-scale-units': 8,
        };
      }

      const checklist = this.createChecklist([
        { label: 'Audit current spacing system', required: true },
        { label: 'Identify visual hierarchy issues', required: true },
        { label: 'Define spacing scale (base unit and ratios)', required: true },
        { label: 'Apply spacing scale to all components', required: true },
        { label: 'Verify white space ratios', required: true },
        { label: 'Test on multiple viewport sizes', required: true },
        { label: 'Document spacing patterns', required: true },
      ]);

      // TEACH, THEN CHECK. What stood below was a constant block of values with no statement of what
      // good looks like and no reason - `- Base unit: 8px (standard web default)` is a fact, not
      // instruction, and it shipped identically whether the page had a spacing system or none. The
      // brief above it now carries the spatial craft (the 25% scale, proximity grouping, the squint
      // test, two-part shadows) with its source, and any spacing/polish rule that actually fails on
      // this project is enumerated underneath. The flow's own procedure is unchanged below that.
      // Scope is an explicit rule list rather than the whole `polish` class. A finding-class filter
      // pulled in tabular-nums, font-smoothing and icon-swap transitions - real defects that are not
      // this flow's business, and a payload that teaches another flow's domain is how a verb stops
      // meaning anything. These are the rules a spacing-and-hierarchy pass actually owns.
      const craft = await flowCraft(context.projectPath, {
        shape: 'produce',
        ruleKeys: [
          'polish/concentric-radius', 'polish/shadows-over-borders', 'polish/shadow-hierarchy',
          'polish/optical-alignment', 'polish/text-overflow-strategy', 'polish/tiny-text',
          'theming/border-radius-consistency', 'a11y/min-hit-area', 'anti-pattern/hero-metric-template',
        ],
        lawDomains: ['spatial'],
        domainLabel: 'spacing and visual hierarchy',
      });

      const guidance = [
        'Layout Optimization: Refine spacing and visual hierarchy for clarity and usability.',
        '',
        ...craftGuidanceBlock(craft, 'no spatial rules were measurable on this project.'),
        'SPACING SYSTEM (this flow\'s working scale):',
        '- Base unit: 8px (standard web default)',
        '- Scale: 8, 12, 16, 24, 32, 48, 64, 96 (multiples of 8)',
        '- Ratios: 1:1.5 (tight), 1:2 (comfortable), 1:3 (spacious)',
        '',
        'HIERARCHY PRINCIPLES:',
        '- Headings larger than body (ratio 1.5x minimum)',
        '- Primary content center-aligned or left-aligned',
        '- Secondary content smaller and lighter in color',
        '- Whitespace around important content',
      ];

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Layout optimization: spacing and hierarchy refinement')
        .addDecision('Spacing scale', 'Base 8px unit with 1.5x and 2x ratios for comfortable hierarchy')
        .addArtifact('reference', 1);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'Layout optimization workflow initialized - spacing and hierarchy',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Spacing Scale',
            '8px base unit with 1.5x/2x ratios',
            'Spacing system documentation'
          ),
        ],
        memory: memoryBuilder.build(),
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Layout optimization failed: ${String(err).substring(0, 40)}`)
        .addValidation('layout-execution', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to initialize layout optimization',
        error: String(err),
        memory,
      };
    }
  }
}

export function createFlowRHandler(): FlowRLayoutOptimizationHandler {
  return new FlowRLayoutOptimizationHandler();
}
