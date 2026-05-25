"use strict";
// Flow X: Copywriting
// Given a register + a list of section IDs (from upstream Flow W) + product context,
// emit 2-3 draft copy options per slot.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowXCopywritingHandler = void 0;
const flow_handler_1 = require("./flow-handler");
const landing_composition_data_1 = require("./landing-composition-data");
const copywriting_templates_1 = require("./copywriting-templates");
const flow_memory_schema_1 = require("./flow-memory-schema");
class FlowXCopywritingHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowX_copywriting');
    }
    canExecute(context) {
        const register = context.projectContext?.register;
        return register === 'brand' || register === 'product';
    }
    async execute(context) {
        const register = context.projectContext?.register || 'product';
        const explicitSectionIds = context.metadata?.sectionIds || [];
        const productName = context.metadata?.productName ||
            context.projectContext?.product?.name ||
            '[Product]';
        // If no sectionIds were passed in, default to the hero (the first section every register has)
        const sectionIds = explicitSectionIds.length > 0 ? explicitSectionIds : ['hero'];
        const draftCtx = {
            productName,
            productPurpose: context.projectContext?.product?.purpose,
            brandPersonality: context.projectContext?.product?.brandPersonality,
        };
        const guidance = [`Register: ${register}`, `Product name: ${productName}`, ''];
        const artifacts = [];
        let totalSlots = 0;
        let totalOptions = 0;
        for (const sectionId of sectionIds) {
            const section = (0, landing_composition_data_1.findSection)(register, sectionId);
            if (!section) {
                guidance.push(`Section "${sectionId}" not in ${register} taxonomy - skipping.`);
                continue;
            }
            const slotTemplates = (0, copywriting_templates_1.listSlotsFor)(register, sectionId);
            guidance.push(`Section: ${section.name} (${section.id})`);
            guidance.push(`Purpose: ${section.purpose}`);
            guidance.push('');
            // Build per-section options map keyed by slot.id, used by both guidance and the artifact below.
            const optionsBySlot = {};
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
                const options = (0, copywriting_templates_1.getDraftOptions)(register, sectionId, slot.id, draftCtx);
                optionsBySlot[slot.id] = options;
                totalOptions += options.length;
                options.forEach((opt, idx) => {
                    guidance.push(`    Option ${idx + 1}: ${opt}`);
                });
                guidance.push('');
            }
            artifacts.push(this.createArtifact('template', `Copy drafts: ${section.name}`, section.slots
                .filter((sl) => optionsBySlot[sl.id] && optionsBySlot[sl.id].length > 0)
                .map((sl) => {
                const opts = optionsBySlot[sl.id];
                return `${sl.id}:\n${opts.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}`;
            })
                .join('\n\n'), `Draft copy options for the ${section.name} section`));
        }
        const checklist = this.createChecklist([
            { label: 'Each slot has 2-3 draft options', required: true, description: `${totalOptions} options across ${totalSlots} slots` },
            { label: 'Voice matches register', required: true, description: `${register} voice applied` },
            { label: 'Word-count limits respected', required: true, description: 'Verify before publishing' },
            { label: 'Product name substituted where needed', required: false, description: `productName=${productName}` },
        ]);
        const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
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
exports.FlowXCopywritingHandler = FlowXCopywritingHandler;
//# sourceMappingURL=flow-handler-copywriting.js.map