"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flow_handler_landing_composition_1 = require("../flow-handler-landing-composition");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const handler = new flow_handler_landing_composition_1.FlowWLandingCompositionHandler();
    assertTrue(handler.flowId === 'flowW_landing_composition', 'flowId is flowW_landing_composition');
    // canExecute requires a register
    assertTrue(handler.canExecute({ utterance: 'compose' }) === false, 'canExecute false without register');
    assertTrue(handler.canExecute({ utterance: 'compose', projectContext: { register: 'brand' } }) === true, 'canExecute true with brand register');
    // execute on brand register
    const brandResult = await handler.execute({
        utterance: 'lay out a landing page',
        projectContext: { register: 'brand', product: {}, design: {} },
    });
    assertTrue(brandResult.status === 'success', 'brand execute success');
    assertTrue(Array.isArray(brandResult.guidance) && brandResult.guidance.length > 0, 'brand guidance non-empty');
    const brandGuidance = (brandResult.guidance || []).join('\n');
    assertTrue(brandGuidance.includes('Hero'), 'brand guidance mentions Hero section');
    assertTrue(brandGuidance.includes('Rhythm') || brandGuidance.includes('rhythm'), 'brand guidance mentions rhythm');
    assertTrue(brandGuidance.includes('Anti-pattern') || brandGuidance.includes('anti-pattern'), 'brand guidance mentions anti-patterns');
    assertTrue(brandResult.memory != null, 'memory emitted');
    assertTrue((brandResult.checklist || []).length >= 3, 'checklist has at least 3 items');
    // execute on product register - taxonomy differs
    const productResult = await handler.execute({
        utterance: 'compose landing page',
        projectContext: { register: 'product', product: {}, design: {} },
    });
    const productGuidance = (productResult.guidance || []).join('\n');
    assertTrue(productGuidance.includes('Social Proof'), 'product guidance mentions Social Proof section');
    assertTrue(productGuidance.includes('FAQ'), 'product guidance mentions FAQ section');
    assertTrue(productGuidance !== brandGuidance, 'product guidance differs from brand');
    // Artifacts include the section taxonomy as a reference
    const artifacts = productResult.artifacts || [];
    assertTrue(artifacts.length >= 1, 'product result has at least 1 artifact');
    assertTrue(artifacts.some((a) => a.type === 'reference' && /section/i.test(a.name)), 'has a section reference artifact');
    console.log('flow-handler-landing-composition PASS');
})();
//# sourceMappingURL=flow-handler-landing-composition.test.js.map