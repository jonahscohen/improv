"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const copywriting_templates_1 = require("../copywriting-templates");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(() => {
    // Hero headline templates differ by register
    const brandHero = (0, copywriting_templates_1.getTemplate)('brand', 'hero', 'headline');
    const productHero = (0, copywriting_templates_1.getTemplate)('product', 'hero', 'headline');
    assertTrue(brandHero != null, 'brand hero headline template exists');
    assertTrue(productHero != null, 'product hero headline template exists');
    assertTrue(brandHero.wordCountMax <= productHero.wordCountMax || brandHero.wordCountMax === 8, 'brand keeps headlines short');
    assertTrue(brandHero.voicePrompt !== productHero.voicePrompt, 'brand and product voice prompts differ');
    // Unknown slot returns null (not undefined - explicit contract)
    assertTrue((0, copywriting_templates_1.getTemplate)('brand', 'hero', 'no_such_slot') === null, 'unknown slot returns null');
    // getDraftOptions returns 2-3 options
    const brandOptions = (0, copywriting_templates_1.getDraftOptions)('brand', 'hero', 'headline', { productName: 'Atelier' });
    assertTrue(brandOptions.length >= 2 && brandOptions.length <= 3, 'brand draft options count 2-3');
    brandOptions.forEach((o, i) => {
        const wc = o.split(/\s+/).filter(Boolean).length;
        assertTrue(wc <= 12, `brand option ${i} respects word ceiling: got ${wc} for "${o}"`);
    });
    // Product CTA template
    const productCta = (0, copywriting_templates_1.getTemplate)('product', 'hero', 'primary_cta');
    assertTrue(productCta != null, 'product hero primary_cta template exists');
    const ctaOptions = (0, copywriting_templates_1.getDraftOptions)('product', 'hero', 'primary_cta', { productName: 'Acme' });
    assertTrue(ctaOptions.length >= 2, 'product CTA has 2+ options');
    assertTrue(ctaOptions.some((o) => /start|get|try/i.test(o)), 'product CTA options use action verbs (start/get/try)');
    console.log('copywriting-templates PASS');
})();
//# sourceMappingURL=copywriting-templates.test.js.map