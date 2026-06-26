// Flow S: Typography Excellence
// Kerning, variable fonts, and type system mastery

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';
import { findTokenLine } from './design-md-parser';

import { applyModelSelection } from './model-routing';
export class FlowSTypographyExcellenceHandler extends BaseFlowHandler {
  constructor() {
    super('flowS_typography_excellence' as any);
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
        enhancedContext.flowMetadata.tags = ['flowS', 'typography-excellence', 'type-mastery'];
        enhancedContext.flowMetadata.customData = {
          'type-scale-levels': 12,
          'font-pairing-guidance': true,
        };
      }

      const checklist = this.createChecklist([
        { label: 'Audit current typography system', required: true },
        { label: 'Define type scale (headings + body)', required: true },
        { label: 'Select primary and fallback fonts', required: true },
        { label: 'Implement line height and letter spacing', required: true },
        { label: 'Apply optical adjustments (baseline shift)', required: true },
        { label: 'Test variable font axes (if using)', required: true },
        { label: 'Verify kerning pairs and ligatures', required: true },
        { label: 'Test readability at all text sizes', required: true },
      ]);

      const designContent = (context.metadata?.designContent as string) || '';
      const designTokens = (context.metadata?.designTokens as any) || {};
      const cite = (dottedPath: string): string => {
        const ln = designContent ? findTokenLine(designContent, dottedPath) : -1;
        return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
      };

      const displayFamily = designTokens.typography?.display?.family || '(undefined in DESIGN.md)';
      const bodyFamily = designTokens.typography?.body?.family || '(undefined in DESIGN.md)';
      const baseSize = designTokens.typography?.scale?.base || '(undefined in DESIGN.md)';
      const lineHeight = designTokens.typography?.scale?.line_height || '(undefined in DESIGN.md)';

      const guidance = [
        'Typography Excellence: Master type scales, kerning, variable fonts, and reading comfort.',
        '',
        'TYPE SCALE:',
        `- Display family: ${displayFamily}${cite('typography.display.family')}`,
        `- Body family: ${bodyFamily}${cite('typography.body.family')}`,
        `- Base body size: ${baseSize}${cite('typography.scale.base')}`,
        '- Heading: 32px, semibold (h2)',
        '- Subheading: 24px, semibold (h3)',
        '- Small: 14px, regular',
        '- Tiny: 12px, regular',
        '',
        'KERNING & SPACING:',
        `- Body line height: ${lineHeight}${cite('typography.scale.line_height')}`,
        '- Letter spacing: normal (0) for body, 0.02em for all-caps',
        '- Optical adjustments: shift baseline -1px for descenders',
        '',
        'VARIABLE FONTS:',
        '- Axes: weight (wght), optical size (opsz), slant',
        '- Usage: wght 400-700, opsz auto on font-size',
      ];

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Typography excellence: kerning, variable fonts, and type system mastery')
        .addDecision('Type scale', 'Display → Heading → Body → Small with comfortable line height and kerning')
        .addArtifact('type-scale', 1);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'Typography excellence workflow initialized - type system mastery',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Type Scale',
            'Display/Heading/Body/Small with line height and kerning',
            'Typography system documentation'
          ),
        ],
        memory: memoryBuilder.build(),
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Typography excellence failed: ${String(err).substring(0, 40)}`)
        .addValidation('typography-execution', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to initialize typography excellence',
        error: String(err),
        memory,
      };
    }
  }
}

export function createFlowSHandler(): FlowSTypographyExcellenceHandler {
  return new FlowSTypographyExcellenceHandler();
}
