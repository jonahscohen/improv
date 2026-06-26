import { POLISH_CHECKS } from '../validators/checks/polish-checks';
import { A11Y_CHECKS } from '../validators/checks/a11y-checks';
import type { EvidenceKind } from '../product-rule-types';
import type { ProductCheckContext } from '../validators/check-context';

const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };
const trusted = (kinds: EvidenceKind[], over: Partial<ProductCheckContext>): ProductCheckContext => ({
  ...empty,
  ...over,
  browserEvidence: { available: true, kinds, renderUrl: 'data:text/html,test' },
});
const status = (key: string, ctx: ProductCheckContext) => {
  const fn = POLISH_CHECKS[key] || A11Y_CHECKS[key];
  if (!fn) throw new Error(`missing check ${key}`);
  return fn(ctx).status;
};

function run() {
  // a11y/color-contrast is NO LONGER here: Stage 6 migrated it to the rendered scan (checkLowContrast), so it is
  // not a collector/browser-evidence rule. Its coverage lives in the rendered-scan tests.
  const keys = [
    'polish/concentric-radius',
    'polish/typography-rhythm',
    'a11y/min-hit-area',
  ];
  for (const key of keys) {
    if (status(key, empty) !== 'inconclusive') throw new Error(`${key}: absent browser evidence must be inconclusive`);
  }

  if (status('polish/concentric-radius', trusted(['computed-style'], {
    computedStyle: { 'concentric.checkedPairs': '2', 'concentric.failingPairs': '0' },
  })) !== 'pass') throw new Error('concentric trusted pass missing');
  if (status('polish/concentric-radius', trusted(['computed-style'], {
    computedStyle: { 'concentric.checkedPairs': '2', 'concentric.failingPairs': '1' },
  })) !== 'fail') throw new Error('concentric trusted fail missing');

  if (status('polish/typography-rhythm', trusted(['computed-style'], {
    computedStyle: { 'typography.checkedElements': '3', 'typography.invalidLineHeightElements': '0' },
  })) !== 'pass') throw new Error('typography trusted pass missing');
  if (status('polish/typography-rhythm', trusted(['computed-style'], {
    computedStyle: { 'typography.checkedElements': '3', 'typography.invalidLineHeightElements': '1' },
  })) !== 'fail') throw new Error('typography trusted fail missing');

  if (status('a11y/min-hit-area', trusted(['dom'], {
    dom: { minHitArea: { checked: 2, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
  })) !== 'pass') throw new Error('hit-area trusted pass missing');
  if (status('a11y/min-hit-area', trusted(['dom'], {
    dom: { minHitArea: { checked: 2, failing: 1, smallestWidth: 20, smallestHeight: 20 } },
  })) !== 'fail') throw new Error('hit-area trusted fail missing');

  if (status('polish/anti-pattern-genericity', trusted(['dom'], {
    dom: { minHitArea: { checked: 1, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
  })) !== 'inconclusive') {
    throw new Error('genericity must remain inconclusive when trusted collector DOM evidence is present');
  }
  console.log('browser-evidence-rules: OK');
}
run();
