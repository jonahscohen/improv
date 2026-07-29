// Flow X: Copywriting
// Given a register + a list of section IDs (from upstream Flow W) + product context,
// emit 2-3 draft copy options per slot.

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { Register } from './project-context';
import { findSection } from './landing-composition-data';
import { getDraftOptions, listSlotsFor, DraftContext } from './copywriting-templates';
import { FlowMemoryBuilder } from './flow-memory-schema';

import { applyModelSelection } from './model-routing';
import { flowCraft, craftGuidanceBlock } from './craft-flow';
export class FlowXCopywritingHandler extends BaseFlowHandler {
  constructor() {
    super('flowX_copywriting');
  }

  canExecute(context: FlowExecutionContext): boolean {
    const register = (context.projectContext as any)?.register as Register | undefined;
    return register === 'brand' || register === 'product';
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    const register = ((context.projectContext as any)?.register as Register) || 'product';
    const explicitSectionIds = (context.metadata?.sectionIds as string[] | undefined) || [];
    const productName =
      (context.metadata?.productName as string | undefined) ||
      (context.projectContext as any)?.product?.name ||
      '[Product]';

    // If no sectionIds were passed in, default to the hero (the first section every register has)
    const sectionIds = explicitSectionIds.length > 0 ? explicitSectionIds : ['hero'];

    const draftCtx: DraftContext = {
      productName,
      productPurpose: (context.projectContext as any)?.product?.purpose,
      brandPersonality: (context.projectContext as any)?.product?.brandPersonality,
    };

    // TEACH, THEN CHECK. This flow drafts copy, so the brief is the writing standard it must hold to:
    // no rhetorical templates, no slop words, error messages with all three parts, and the specific
    // verb-plus-object rule for buttons. The two copy rules the registry can actually measure -
    // buzzword density and generic button labels - are enumerated below, so a draft written into a page
    // that already fails them is told so.
    const craft = await flowCraft(context.projectPath, {
      shape: 'produce',
      ruleKeys: ['polish/marketing-buzzword', 'a11y/button-label-specific', 'a11y/chart-text-fallback'],
      lawDomains: ['writing'],
      domainLabel: 'copy',
    });

    const guidance: string[] = [
      ...craftGuidanceBlock(craft, 'no copy rules were measurable on this project.'),
      `Register: ${register}`, `Product name: ${productName}`, '',
    ];
    const artifacts = [];
    let totalSlots = 0;
    let totalOptions = 0;

    for (const sectionId of sectionIds) {
      const section = findSection(register, sectionId);
      if (!section) {
        guidance.push(`Section "${sectionId}" not in ${register} taxonomy - skipping.`);
        continue;
      }
      const slotTemplates = listSlotsFor(register, sectionId);
      guidance.push(`Section: ${section.name} (${section.id})`);
      guidance.push(`Purpose: ${section.purpose}`);
      guidance.push('');

      // Build per-section options map keyed by slot.id, used by both guidance and the artifact below.
      const optionsBySlot: Record<string, string[]> = {};

      for (const slot of section.slots) {
        const tmpl = slotTemplates.find((t) => t.slotId === slot.id);
        if (!tmpl) {
          guidance.push(`  Slot "${slot.id}": no template (skip)`);
          continue;
        }
        totalSlots += 1;
        guidance.push(`  Slot: ${slot.id} (${slot.label})`);
        guidance.push(`    Voice: ${tmpl.voicePrompt}`);
        guidance.push(`    Word count: ${tmpl.wordCountMin}-${tmpl.wordCountMax}`);
        const options = getDraftOptions(register, sectionId, slot.id, draftCtx);
        optionsBySlot[slot.id] = options;
        totalOptions += options.length;
        options.forEach((opt, idx) => {
          guidance.push(`    Option ${idx + 1}: ${opt}`);
        });
        guidance.push('');
      }

      artifacts.push(
        this.createArtifact(
          'template',
          `Copy drafts: ${section.name}`,
          section.slots
            .filter((sl) => optionsBySlot[sl.id] && optionsBySlot[sl.id].length > 0)
            .map((sl) => {
              const opts = optionsBySlot[sl.id];
              return `${sl.id}:\n${opts.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}`;
            })
            .join('\n\n'),
          `Draft copy options for the ${section.name} section`
        )
      );
    }

    const checklist = this.createChecklist([
      { label: 'Each slot has 2-3 draft options', required: true, description: `${totalOptions} options across ${totalSlots} slots` },
      { label: 'Voice matches register', required: true, description: `${register} voice applied` },
      { label: 'Word-count limits respected', required: true, description: 'Verify before publishing' },
      { label: 'Product name substituted where needed', required: false, description: `productName=${productName}` },
    ]);

    const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
      .setSummary(`Drafted copy: ${totalOptions} options across ${totalSlots} slots in ${sectionIds.length} section(s), ${register} register`)
      .addDecision('register-applied', register)
      .addMetric('slots-covered', totalSlots, 'pass')
      .addMetric('options-generated', totalOptions, 'pass')
      .addArtifact('copy-drafts', sectionIds.length, ['flowG_component_implementation', 'flowJ_tactical_polish'])
      .build();

    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: `Copy drafts ready: ${totalOptions} options for ${totalSlots} slots (${register})`,
      guidance,
      checklist,
      artifacts,
      memory,
    };
  }
}
