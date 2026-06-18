"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/a11y-checks.test.ts
const a11y_checks_1 = require("../validators/checks/a11y-checks");
const ctxCss = (css) => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const empty = { cssText: '', markup: '', files: [] };
function run() {
    const fv = a11y_checks_1.A11Y_CHECKS['a11y/focus-visible'];
    const mh = a11y_checks_1.A11Y_CHECKS['a11y/min-hit-area'];
    const cc = a11y_checks_1.A11Y_CHECKS['a11y/color-contrast'];
    if (!fv || !mh || !cc)
        throw new Error('all three a11y checks must be present');
    if (fv(ctxCss('a:focus-visible { outline: 2px solid; }')).status !== 'pass')
        throw new Error('focus-visible present must pass');
    if (fv(ctxCss('.btn:hover { color: red; }')).status !== 'fail')
        throw new Error('focus-visible missing for an applicable interactive target must fail');
    if (fv(ctxCss('.prose { color: red; }')).status !== 'not_applicable')
        throw new Error('known no focusable target must be N/A');
    if (fv(empty).status !== 'inconclusive')
        throw new Error('focus-visible no-css must be inconclusive');
    // dom-only rule: inconclusive without DOM evidence, never pass
    if (mh(ctxCss('.btn { min-height: 48px; }')).status !== 'inconclusive')
        throw new Error('min-hit-area must be inconclusive without DOM evidence');
    // contrast-only rule stays inconclusive until P4b's trusted browser collector
    if (cc(empty).status !== 'inconclusive')
        throw new Error('color-contrast must be inconclusive without contrast evidence');
    if (cc({ ...empty, contrast: { wcagAA: true, ratio: 5 } }).status !== 'inconclusive')
        throw new Error('ad hoc contrast evidence must not bypass P4b collector');
    console.log('a11y-checks: OK');
}
run();
//# sourceMappingURL=a11y-checks.test.js.map