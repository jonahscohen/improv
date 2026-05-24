// Flow O: Clone Match
// Pixel-perfect comparison vs design, side-by-side verification

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';
import { createIconSourceReference, buildIconSourceArtifactContent } from './icon-source-reference';

export class FlowOCloneMatchHandler extends BaseFlowHandler {
  constructor() {
    super('flowO_clone_match_special');
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    try {
      // Domain validation integration for spatial, responsive, color precision
      const domainCheckContext: DomainCheckContext = {
        designTokens: context.metadata?.designTokens || {},
        componentTree: context.metadata?.componentTree || { nodeCount: 0 },
        cssRules: context.metadata?.cssRules || [],
        colors: context.metadata?.colors || {},
        typography: context.metadata?.typography || {},
        spacing: context.metadata?.spacing || {},
      };

      const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext);
      const spatialDomainRules = ExtendedDomainValidator.getRulesByDomain('spatial');
      const responsiveDomainRules = ExtendedDomainValidator.getRulesByDomain('responsive');
      const colorDomainRules = ExtendedDomainValidator.getRulesByDomain('color');

      const spatialPassRate = extendedValidationReport.passRateByDomain['spatial'] || '0%';
      const responsivePassRate = extendedValidationReport.passRateByDomain['responsive'] || '0%';
      const colorPassRate = extendedValidationReport.passRateByDomain['color'] || '0%';

      const spatialPassed = Math.round((parseFloat(spatialPassRate) / 100) * spatialDomainRules.length);
      const responsivePassed = Math.round((parseFloat(responsivePassRate) / 100) * responsiveDomainRules.length);
      const colorPassed = Math.round((parseFloat(colorPassRate) / 100) * colorDomainRules.length);

      const checklist = this.createChecklist([
        { label: 'Design screenshot at same viewport size', required: true },
        { label: 'Implementation screenshot at same viewport size', required: true },
        { label: 'Side-by-side comparison setup', required: true },
        { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
        { label: 'Typography match (font, size, weight, line-height, letter-spacing)', required: true },
        { label: 'Color match (hex match or token reference)', required: true, description: `${colorPassed}/${colorDomainRules.length} rules passing (${colorPassRate})` },
        { label: 'Spacing match (padding, margins, gap - measure with tools)', required: true },
        { label: 'Border radius match (concentric radius pattern)', required: true },
        { label: 'Shadow match (blur, offset, color, opacity)', required: true },
        { label: 'Element positioning (alignment, overlap, float)', required: true },
        { label: 'Responsive domain validation', required: false, description: `${responsivePassed}/${responsiveDomainRules.length} rules passing (${responsivePassRate})` },
        { label: 'Interactive states match (hover, active, focus, disabled)', required: false },
      ]);

      const guidance = [
        'Clone Match verifies pixel-perfect alignment between design and implementation.',
        '',
        'Domain Validation Results:',
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

      const getSeverity = (percentage: string): 'pass' | 'warning' | 'fail' => {
        const num = parseFloat(percentage);
        if (num >= 80) return 'pass';
        if (num >= 50) return 'warning';
        return 'fail';
      };

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary('Clone match: pixel-perfect comparison - typography, colors, spacing, shapes, layout verified')
        .addRule('spatial', spatialDomainRules.map((r) => r.name))
        .addRule('color', colorDomainRules.map((r) => r.name))
        .addRule('responsive', responsiveDomainRules.map((r) => r.name))
        .addRule('typography', ['font family', 'size', 'weight', 'line-height', 'letter-spacing'])
        .addRule('spacing', ['padding measured', 'margins measured', 'gap verified'])
        .addRule('shapes', ['border radius', 'border style', 'shadow blur', 'shadow offset', 'shadow color', 'shadow opacity'])
        .addRule('layout', ['element positioning', 'alignment', 'baseline', 'optical centering'])
        .addDecision('Clone strategy', 'Side-by-side viewport-matched comparison with pixel-level verification')
        .addMetric('spatial-rules-passing', spatialPassed, 'pass', spatialDomainRules.length)
        .addMetric('color-rules-passing', colorPassed, 'pass', colorDomainRules.length)
        .addMetric('responsive-rules-passing', responsivePassed, 'pass', responsiveDomainRules.length)
        .addValidation('Spatial domain', getSeverity(spatialPassRate), `${spatialPassed}/${spatialDomainRules.length} rules passing`)
        .addValidation('Color domain', getSeverity(colorPassRate), `${colorPassed}/${colorDomainRules.length} rules passing`)
        .addValidation('Responsive domain', getSeverity(responsivePassRate), `${responsivePassed}/${responsiveDomainRules.length} rules passing`)
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
            'icon-source',
            buildIconSourceArtifactContent(createIconSourceReference()),
            '8 approved icon libraries with selection protocol and provenance markers (taste/fabricated-svg gate enforcement)'
          ),
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
