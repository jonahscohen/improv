// Flow C: Font Research
// Research typefaces and pairing strategies against brand personality
// Applies typography domain rules from SHARED_DESIGN_LAWS

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';
import { FontshareReference } from './reference-systems';
import { FontshareReferenceImpl } from './fontshare-reference';
import { SHARED_DESIGN_LAWS } from './design-laws';

export interface FontResearchContext {
  brandPersonality?: string;
  typographyApproach?: string;
  selectedFonts: string[];
  pairingRules: string[];
  typographyRules: string[];
}

export class FlowCFontResearchHandler extends BaseFlowHandler {
  private fontshareRef: FontshareReference;
  private cachedFontContext?: FontResearchContext;

  constructor() {
    super('flowC_font_research');
    this.fontshareRef = new FontshareReferenceImpl();
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow C requires project context with brand personality
    return !!(context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality);
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
    const typographyApproach = context.projectContext?.design?.typography?.approach || 'undefined';

    try {
      // Get typography rules from shared design laws
      const typographyDomain = SHARED_DESIGN_LAWS.typography;
      const typographyRules = typographyDomain.rules.map((rule) => `- ${rule}`);

      // Get font pairing rules based on brand personality
      const pairingRules = await this.fontshareRef.getPairingRules(brandPersonality || 'default');

      // Get font candidates for this brand personality
      const fontCandidates = await this.fontshareRef.getFontCandidates(typographyApproach, context.projectContext?.register || 'product');

      // Cache context for downstream flows
      this.cachedFontContext = {
        brandPersonality,
        typographyApproach,
        selectedFonts: fontCandidates.map((f) => f.name),
        pairingRules,
        typographyRules: typographyDomain.rules,
      };

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Brand personality defined', required: true, description: brandPersonality || 'Not specified' },
        { label: 'Typography domain rules reviewed', required: true, description: `${typographyRules.length} rules loaded` },
        { label: 'Font pairing strategy selected', required: true, description: pairingRules.length > 0 ? `${pairingRules.length} rules` : 'None found' },
        { label: 'Font candidates identified', required: false, description: `${fontCandidates.length} candidates available` },
      ]);

      // Build guidance
      const guidance = [
        `Brand personality: ${brandPersonality || 'Not defined'}`,
        '',
        'Typography Domain Rules (8 principles):',
        ...typographyRules,
        '',
        'Font Pairing Strategy:',
        ...pairingRules,
        '',
        'Recommended approach:',
        '1. Select heading font that matches brand personality',
        '2. Pair with body font using the pairing rules above',
        '3. Validate font metrics (line height, ascent, descent)',
        '4. Test OpenType features for your typography needs',
        '5. Check web font loading performance',
        '',
        `${fontCandidates.length} font candidates available. Run Flow F to extract design tokens with selected typefaces.`,
      ];

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `Font research: ${fontCandidates.length} candidates analyzed against ${typographyRules.length} typography rules`,
        guidance,
        checklist,
        artifacts: fontCandidates.length > 0 ? [
          this.createArtifact(
            'reference',
            'Font Candidates',
            fontCandidates.map((f) => `${f.name} (${f.category}, weights: ${f.weights.join(',')})`).join('\n'),
            `${fontCandidates.length} fonts matching brand personality and typography requirements`
          ),
        ] : [],
      };
    } catch (err) {
      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to research fonts',
        error: String(err),
      };
    }
  }

  getCachedContext(): FontResearchContext | undefined {
    return this.cachedFontContext;
  }
}

export function createFlowCHandler(): FlowCFontResearchHandler {
  return new FlowCFontResearchHandler();
}
