import { FlowABrandVerifyHandler } from '../flow-handler-brand-verify';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const handler = new FlowABrandVerifyHandler();

  // Reach into the private method via `as any`. Sprint 1 set the convention
  // that exercising private methods directly in tests is acceptable for
  // defensive-guard regression coverage.
  const fn = (handler as any).cacheDesignLawsForRegister.bind(handler);

  // The crash path: register is undefined (no PRODUCT.md, raw context, etc).
  let didThrow = false;
  let laws: string[] = [];
  try {
    laws = fn(undefined);
  } catch (err) {
    didThrow = true;
    console.error('threw on undefined register:', err);
  }
  assertTrue(!didThrow, 'cacheDesignLawsForRegister(undefined) does not throw');
  assertTrue(Array.isArray(laws), 'returns an array');
  assertTrue(laws.length >= 1, 'returns at least one law entry (the shared-domain rules)');
  assertTrue(
    laws.some((l: string) => /Register-specific/i.test(l)),
    'still includes a Register-specific line (even if fallback)'
  );

  // Valid registers still work.
  const brandLaws = fn('brand');
  assertTrue(brandLaws.some((l: string) => /Design IS the product/.test(l)), 'brand register still resolves correctly');

  const productLaws = fn('product');
  assertTrue(productLaws.some((l: string) => /Design SERVES the product/.test(l)), 'product register still resolves correctly');

  console.log('sprint3-brand-verify-null-register PASS');
})();
