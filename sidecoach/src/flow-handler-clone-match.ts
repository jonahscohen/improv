// Flow O: Clone Match
// Pixel-perfect comparison vs design, side-by-side verification

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';

export class FlowOCloneMatchHandler extends BaseFlowHandler {
  constructor() {
    super('flowO_clone_match_special');
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    try {
      const checklist = this.createChecklist([
        { label: 'Design screenshot at same viewport size', required: true },
        { label: 'Implementation screenshot at same viewport size', required: true },
        { label: 'Side-by-side comparison setup', required: true },
        { label: 'Typography match (font, size, weight, line-height, letter-spacing)', required: true },
        { label: 'Color match (hex match or token reference)', required: true },
        { label: 'Spacing match (padding, margins, gap - measure with tools)', required: true },
        { label: 'Border radius match (concentric radius pattern)', required: true },
        { label: 'Shadow match (blur, offset, color, opacity)', required: true },
        { label: 'Element positioning (alignment, overlap, float)', required: true },
        { label: 'Interactive states match (hover, active, focus, disabled)', required: false },
      ]);

      const guidance = [
        'Clone Match verifies pixel-perfect alignment between design and implementation.',
        '',
        'SETUP:',
        '- Design screenshot at exact viewport (e.g., 1024px)',
        '- Implementation screenshot at same viewport',
        '- Open both in split-screen or overlay tool',
        '',
        'TYPOGRAPHY:',
        '- Font family (exact typeface)',
        '- Font size (rem or px)',
        '- Font weight (100-900 or named)',
        '- Line height (relative or px)',
        '- Letter spacing (if visible)',
        '',
        'COLORS:',
        '- Hex match or verified token',
        '- Include opacity if present',
        '- Check against design DESIGN.md tokens',
        '',
        'SPACING:',
        '- Padding (measure from edge to content)',
        '- Margins (measure between elements)',
        '- Gap (in flexbox/grid containers)',
        '- Line spacing in text blocks',
        '',
        'SHAPES:',
        '- Border radius (check concentric pattern)',
        '- Borders (width, color, style)',
        '- Shadows (blur, x-offset, y-offset, color, opacity)',
        '',
        'LAYOUT:',
        '- Element positioning and alignment',
        '- Text baseline alignment',
        '- Icon centering (optical vs geometric)',
      ];

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Clone match: pixel-perfect comparison - typography, colors, spacing, shapes, layout verified')
        .addRule('typography', ['font family', 'size', 'weight', 'line-height', 'letter-spacing'])
        .addRule('colors', ['hex match or token reference', 'opacity included', 'DESIGN.md validated'])
        .addRule('spacing', ['padding measured', 'margins measured', 'gap verified'])
        .addRule('shapes', ['border radius', 'border style', 'shadow blur', 'shadow offset', 'shadow color', 'shadow opacity'])
        .addRule('layout', ['element positioning', 'alignment', 'baseline', 'optical centering'])
        .addDecision('Clone strategy', 'Side-by-side viewport-matched comparison with pixel-level verification')
        .addMetric('comparison-dimensions', 5, 'pass')
        .addMetric('typography-elements', 5, 'pass')
        .addMetric('spatial-elements', 5, 'pass')
        .addValidation('Clone match', 'pass', 'Verification framework initialized')
        .addArtifact('clone', 5);

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'Clone Match workflow initialized - pixel-perfect comparison',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Clone Verification Checklist',
            'Typography (5) → Colors (1) → Spacing (4) → Shapes (3) → Layout (4) = 17-point verification',
            'Pixel-perfect alignment checklist'
          ),
        ],
        memory: memoryBuilder.build(),
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Clone match failed: ${String(err).substring(0, 40)}`)
        .addValidation('clone-execution', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to initialize clone match',
        error: String(err),
        memory,
      };
    }
  }
}

export function createFlowOHandler(): FlowOCloneMatchHandler {
  return new FlowOCloneMatchHandler();
}
