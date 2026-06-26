// sidecoach/src/__tests__/a11y-checks.test.ts
import { A11Y_CHECKS } from '../validators/checks/a11y-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  const fv = A11Y_CHECKS['a11y/focus-visible']; const mh = A11Y_CHECKS['a11y/min-hit-area'];
  if (!fv || !mh) throw new Error('focus-visible + min-hit-area a11y checks must be present');
  // a11y/color-contrast MIGRATED to rendered-checks (checkLowContrast) in Stage 6 - it is no longer in A11Y_CHECKS.
  if (A11Y_CHECKS['a11y/color-contrast']) throw new Error('color-contrast must NOT be collector-backed in A11Y_CHECKS (migrated to rendered scan)');

  if (fv(ctxCss('a:focus-visible { outline: 2px solid; }')).status !== 'pass') throw new Error('focus-visible present must pass');
  if (fv(ctxCss('.btn:hover { color: red; }')).status !== 'fail') throw new Error('focus-visible missing for an applicable interactive target must fail');
  if (fv(ctxCss('.prose { color: red; }')).status !== 'not_applicable') throw new Error('known no focusable target must be N/A');
  if (fv(empty).status !== 'inconclusive') throw new Error('focus-visible no-css must be inconclusive');

  // dom-only rule: inconclusive without DOM evidence, never pass
  if (mh(ctxCss('.btn { min-height: 48px; }')).status !== 'inconclusive') throw new Error('min-hit-area must be inconclusive without DOM evidence');

  console.log('a11y-checks: OK');
}
run();
