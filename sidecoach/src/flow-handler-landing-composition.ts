// Flow W: Landing Page Composition
// Register-aware section taxonomy + rhythm rules + anti-pattern callouts.
// Reads register from project context, dispatches into landing-composition-data.

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { Register } from './project-context';
import {
  getSectionTaxonomy,
  getRhythmRules,
  getAntiPatternCallouts,
  SectionDescriptor,
} from './landing-composition-data';
import { FlowMemoryBuilder } from './flow-memory-schema';

export class FlowWLandingCompositionHandler extends BaseFlowHandler {
  constructor() {
    super('flowW_landing_composition');
  }

  canExecute(context: FlowExecutionContext): boolean {
    const register = (context.projectContext as any)?.register as Register | undefined;
    return register === 'brand' || register === 'product';
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const register = ((context.projectContext as any)?.register as Register) || 'product';
    const taxonomy = getSectionTaxonomy(register);
    const rhythm = getRhythmRules(register);
    const antiPatterns = getAntiPatternCallouts(register);

    const guidance: string[] = [
      `Register: ${register}`,
      `Section taxonomy (${taxonomy.length} sections):`,
      ...taxonomy.map((s: SectionDescriptor) => `- ${s.name} (${s.id}): ${s.purpose}`),
      '',
      'Rhythm:',
      `- Vertical gap between sections: ${rhythm.verticalGapPx}px`,
      `- Max sections per viewport: ${rhythm.maxSectionsPerScreen}`,
      `- Hierarchy guidance: ${rhythm.hierarchyGuidance}`,
      '',
      'Anti-pattern callouts:',
      ...antiPatterns.map((a: string) => `- ${a}`),
    ];

    const checklist = this.createChecklist([
      { label: 'Register selected matches PRODUCT.md', required: true, description: `register=${register}` },
      { label: 'Each section has slot definitions filled', required: true, description: `${taxonomy.length} sections to populate` },
      { label: 'Vertical rhythm applied to layout', required: true, description: `${rhythm.verticalGapPx}px between sections` },
      { label: 'Anti-pattern callouts reviewed', required: true, description: `${antiPatterns.length} register-specific anti-patterns` },
    ]);

    const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
      .setSummary(`Composed landing page: ${taxonomy.length} sections for ${register} register, ${rhythm.verticalGapPx}px rhythm`)
      .addDecision('section-taxonomy', `Selected ${register} register taxonomy: ${taxonomy.map((s: SectionDescriptor) => s.id).join(', ')}`)
      .addDecision('rhythm', `${rhythm.verticalGapPx}px vertical gap, ${rhythm.maxSectionsPerScreen} sections per viewport`)
      .addMetric('sections-planned', taxonomy.length, 'pass')
      .addMetric('anti-patterns-flagged', antiPatterns.length, 'pass')
      .addArtifact('section-taxonomy', taxonomy.length, ['flowX_copywriting', 'flowG_component_implementation'])
      .build();

    const artifacts = [
      this.createArtifact(
        'reference',
        'Section taxonomy',
        taxonomy.map((s: SectionDescriptor) => `${s.id}: ${s.slots.map((sl) => sl.id).join(', ')}`).join('\n'),
        `${taxonomy.length} sections with slots for ${register} register`
      ),
      this.createArtifact(
        'reference',
        'Anti-pattern callouts',
        antiPatterns.join('\n'),
        `${antiPatterns.length} register-specific anti-patterns`
      ),
    ];

    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: `Landing composed: ${taxonomy.length} sections for ${register} register`,
      guidance,
      checklist,
      artifacts,
      memory,
    };
  }
}
