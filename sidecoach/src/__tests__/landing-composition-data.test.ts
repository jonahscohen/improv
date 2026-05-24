import {
  getSectionTaxonomy,
  getRhythmRules,
  getAntiPatternCallouts,
  SectionDescriptor,
} from '../landing-composition-data';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

(() => {
  // Brand register: smaller, more atmospheric
  const brandSections = getSectionTaxonomy('brand');
  assertTrue(brandSections.length >= 4, 'brand has at least 4 sections');
  assertTrue(brandSections.length <= 7, 'brand stays atmospheric (<=7 sections)');
  const brandIds = brandSections.map((s) => s.id);
  assertTrue(brandIds.includes('hero'), 'brand has hero');
  assertTrue(brandIds.includes('selected_work') || brandIds.includes('manifesto'), 'brand has work/manifesto');

  // Product register: more sections (social proof, FAQ, pricing-style)
  const productSections = getSectionTaxonomy('product');
  assertTrue(productSections.length >= 7, 'product has at least 7 sections');
  const productIds = productSections.map((s) => s.id);
  assertTrue(productIds.includes('hero'), 'product has hero');
  assertTrue(productIds.includes('social_proof'), 'product has social_proof');
  assertTrue(productIds.includes('faq') || productIds.includes('final_cta'), 'product has faq or final_cta');

  // Each section descriptor has slots
  const heroBrand = brandSections.find((s) => s.id === 'hero') as SectionDescriptor;
  assertTrue(Array.isArray(heroBrand.slots), 'hero has slots array');
  assertTrue(heroBrand.slots.length >= 2, 'hero has at least 2 slots (headline, supporting)');
  assertTrue(heroBrand.slots.some((sl) => sl.id === 'headline'), 'hero slot includes headline');

  // Rhythm rules differ by register
  const brandRhythm = getRhythmRules('brand');
  const productRhythm = getRhythmRules('product');
  assertTrue(brandRhythm.verticalGapPx >= productRhythm.verticalGapPx, 'brand uses larger vertical gaps than product');
  assertTrue(brandRhythm.maxSectionsPerScreen <= productRhythm.maxSectionsPerScreen, 'brand shows fewer sections per screen');

  // Anti-pattern callouts are register-specific
  const brandAntis = getAntiPatternCallouts('brand');
  const productAntis = getAntiPatternCallouts('product');
  assertTrue(brandAntis.length >= 2, 'brand has at least 2 anti-pattern callouts');
  assertTrue(productAntis.length >= 2, 'product has at least 2 anti-pattern callouts');
  // The two lists must not be identical (proves register-awareness)
  assertTrue(JSON.stringify(brandAntis) !== JSON.stringify(productAntis), 'brand and product anti-patterns differ');

  console.log('landing-composition-data PASS');
})();
