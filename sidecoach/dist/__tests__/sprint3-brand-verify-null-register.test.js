"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flow_handler_brand_verify_1 = require("../flow-handler-brand-verify");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const handler = new flow_handler_brand_verify_1.FlowABrandVerifyHandler();
    // Reach into the private method via `as any`. Sprint 1 set the convention
    // that exercising private methods directly in tests is acceptable for
    // defensive-guard regression coverage.
    const fn = handler.cacheDesignLawsForRegister.bind(handler);
    // The crash path: register is undefined (no PRODUCT.md, raw context, etc).
    let didThrow = false;
    let laws = [];
    try {
        laws = fn(undefined);
    }
    catch (err) {
        didThrow = true;
        console.error('threw on undefined register:', err);
    }
    assertTrue(!didThrow, 'cacheDesignLawsForRegister(undefined) does not throw');
    assertTrue(Array.isArray(laws), 'returns an array');
    assertTrue(laws.length >= 1, 'returns at least one law entry (the shared-domain rules)');
    assertTrue(laws.some((l) => /Register-specific/i.test(l)), 'still includes a Register-specific line (even if fallback)');
    // Valid registers still work.
    const brandLaws = fn('brand');
    assertTrue(brandLaws.some((l) => /Design IS the product/.test(l)), 'brand register still resolves correctly');
    const productLaws = fn('product');
    assertTrue(productLaws.some((l) => /Design SERVES the product/.test(l)), 'product register still resolves correctly');
    console.log('sprint3-brand-verify-null-register PASS');
})();
//# sourceMappingURL=sprint3-brand-verify-null-register.test.js.map