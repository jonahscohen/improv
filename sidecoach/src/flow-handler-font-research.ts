// Flow C: Font Research
// Research typefaces and pairing strategies against brand personality
// Applies typography domain rules from SHARED_DESIGN_LAWS

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';
import { FontshareReference } from './reference-systems';
import { FontshareReferenceImpl } from './fontshare-reference';
import { SHARED_DESIGN_LAWS } from './design-laws';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

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
    const enhancedContext = context as EnhancedFlowExecutionContext;
    const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
    const typographyApproach = context.projectContext?.design?.typography?.approach || 'undefined';

    try {
      // Get typography rules from shared design laws
      const typographyDomain = SHARED_DESIGN_LAWS.typography;
      const typographyRules = typographyDomain.rules.map((rule) => `- ${rule}`);

      // Get font pairing rules based on brand personality
      const pairingRules = await this.fontshareRef.getPairingRules(brandPersonality || 'default');

      // Populate enhanced context with Flow C metadata
      if (enhancedContext?.flowMetadata) {
        enhancedContext.flowMetadata.tags = ['flowC', 'font-research', 'typography-domain'];
        enhancedContext.flowMetadata.customData = {
          'typography-rules': typographyRules.length,
          'pairing-rules': pairingRules.length,
          'typography-approach': typographyApproach,
          'brand-personality': brandPersonality || 'default',
        };
      }

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

      // Domain validation integration
      const domainCheckContext: DomainCheckContext = {
        designTokens: context.metadata?.designTokens || {},
        componentTree: context.metadata?.componentTree || { fonts: fontCandidates.length },
        cssRules: context.metadata?.cssRules || [],
        typography: context.metadata?.typography,
        accessibility: context.metadata?.accessibility,
      };

      const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext);
      const typographyDomainRules = ExtendedDomainValidator.getRulesByDomain('typography');
      const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
      const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Brand personality defined', required: true, description: brandPersonality || 'Not specified' },
        { label: 'Typography domain rules reviewed', required: true, description: `${typographyRules.length} rules loaded` },
        { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
        { label: 'Font pairing strategy selected', required: true, description: pairingRules.length > 0 ? `${pairingRules.length} rules` : 'None found' },
        { label: 'Font candidates identified', required: false, description: `${fontCandidates.length} candidates available` },
      ]);

      // Build guidance
      const guidance = [
        `Brand personality: ${brandPersonality || 'Not defined'}`,
        '',
        'Typography Domain Rules (16 principles):',
        ...typographyRules,
        '',
        'Domain Validation Results:',
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

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(`Font research: ${fontCandidates.length} candidates with typography domain validation (${typographyPassRate})`)
        .addRule('typography', typographyRules)
        .addDecision(`Font pairing strategy: ${pairingRules.length > 0 ? 'defined' : 'generic'}`, 'Selected pairing approach based on brand personality')
        .addMetric('font-candidates-analyzed', fontCandidates.length, 'pass')
        .addMetric('typography-rules-applied', typographyRules.length, 'pass', 16)
        .addMetric('typography-domain-validation', typographyPassed, 'pass', typographyDomainRules.length)
        .addValidation('Typography domain compliance', typographyPassed === typographyDomainRules.length ? 'pass' : 'warning', `${typographyPassed}/${typographyDomainRules.length} pass`)
        .addValidation('Font pairing rules', pairingRules.length > 0 ? 'pass' : 'warning')
        .addReference('fontshare', fontCandidates.length, 'typography candidates')
        .addArtifact('font-candidates', fontCandidates.length, ['flowF_design_tokens', 'flowG_component_implementation']);

      const memory = memoryBuilder.build();

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
        memory,
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Font research failed: ${String(err).substring(0, 40)}`)
        .addValidation('fontshare-query', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to research fonts',
        error: String(err),
        memory,
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
