"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flow_handler_copywriting_1 = require("../flow-handler-copywriting");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const handler = new flow_handler_copywriting_1.FlowXCopywritingHandler();
    assertTrue(handler.flowId === 'flowX_copywriting', 'flowId is flowX_copywriting');
    // canExecute requires register
    assertTrue(handler.canExecute({ utterance: 'copy' }) === false, 'canExecute false without register');
    assertTrue(handler.canExecute({ utterance: 'copy', projectContext: { register: 'product' } }) === true, 'canExecute true with product register');
    // execute with explicit sectionIds in metadata
    const result = await handler.execute({
        utterance: 'draft hero copy',
        projectContext: {
            register: 'product',
            product: { content: 'Acme is a workspace for customer feedback.' },
            design: {},
        },
        metadata: {
            sectionIds: ['hero'],
            productName: 'Acme',
        },
    });
    assertTrue(result.status === 'success', 'execute success');
    const guidance = (result.guidance || []).join('\n');
    assertTrue(/headline/i.test(guidance), 'guidance mentions headline slot');
    assertTrue(/primary_cta|CTA/i.test(guidance), 'guidance mentions CTA slot');
    // 2-3 options per slot - count "Option 1" / "Option 2" markers
    const option1Count = (guidance.match(/Option 1:/g) || []).length;
    const option2Count = (guidance.match(/Option 2:/g) || []).length;
    assertTrue(option1Count >= 1, 'at least one slot has Option 1');
    assertTrue(option2Count >= 1, 'at least one slot has Option 2');
    // Product name substitution
    assertTrue(guidance.includes('Acme'), 'product name substituted into samples');
    // Artifact assertions
    const artifacts = result.artifacts || [];
    assertTrue(artifacts.length >= 1, 'at least one artifact emitted');
    assertTrue(artifacts.some((a) => a.type === 'template' && /Copy drafts:/.test(a.name)), 'has Copy drafts template artifact');
    const heroArtifact = artifacts.find((a) => /Hero/.test(a.name));
    assertTrue(heroArtifact != null, 'hero artifact present');
    assertTrue(/headline:/.test(heroArtifact.content), 'hero artifact content lists headline slot');
    assertTrue(/Acme/.test(heroArtifact.content), 'hero artifact content has product name substituted');
    // Default to first hero section when no sectionIds given
    const fallbackResult = await handler.execute({
        utterance: 'draft copy',
        projectContext: { register: 'brand', product: {}, design: {} },
        metadata: {},
    });
    assertTrue(fallbackResult.status === 'success', 'fallback (no sectionIds) succeeds');
    const fallbackGuidance = (fallbackResult.guidance || []).join('\n');
    assertTrue(/Hero/i.test(fallbackGuidance), 'fallback covers Hero section');
    console.log('flow-handler-copywriting PASS');
})();
//# sourceMappingURL=flow-handler-copywriting.test.js.map