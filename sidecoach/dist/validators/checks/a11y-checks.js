"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.A11Y_CHECKS = exports.checkMinHitArea = exports.checkFocusVisible = void 0;
const check_context_1 = require("../check-context");
const polish_standard_validator_1 = require("../../polish-standard-validator");
const checkFocusVisible = (ctx) => {
    // Applicability FIRST: a focusable target can live in markup (e.g. a <button> in an
    // html file with no inline <style>). A file with no focusable target is N/A; a file
    // WITH a focusable target but no readable CSS is an inconclusive gap (we cannot verify
    // the focus styling here, which may be cross-file) - never a silent pass.
    const applicable = (0, check_context_1.focusableTargetApplicability)(ctx);
    if (applicable === false)
        return (0, check_context_1.notApplicable)('no focusable element or interactive selector');
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('focusable target present but no CSS collected to verify focus styling', 'unreadable_input');
    if (applicable === 'unknown')
        return (0, check_context_1.inconclusive)('cannot establish focusable targets from collected evidence', 'unreadable_input');
    return (0, polish_standard_validator_1.hasFocusVisible)(ctx.cssText)
        ? (0, check_context_1.pass)(':focus-visible present')
        : (0, check_context_1.fail)('implement :focus-visible for keyboard navigation', [], 'Add :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }');
};
exports.checkFocusVisible = checkFocusVisible;
const checkMinHitArea = (ctx) => {
    if (!(0, check_context_1.hasTrustedBrowserEvidence)(ctx, 'dom') || !ctx.dom) {
        return (0, check_context_1.inconclusive)('hit-area geometry needs trusted DOM evidence', 'unsupported_runtime');
    }
    const hit = ctx.dom.minHitArea;
    if (hit.checked === 0)
        return (0, check_context_1.notApplicable)('no visible interactive element found');
    return hit.failing === 0
        ? (0, check_context_1.pass)(`${hit.checked} visible interactive target(s) meet minimum hit area`)
        : (0, check_context_1.fail)(`${hit.failing}/${hit.checked} interactive target(s) miss minimum hit area; smallest is ${Math.round(hit.smallestWidth)}x${Math.round(hit.smallestHeight)}px`, [], 'Increase interactive target padding or dimensions to at least 40x40px, and buttons to 44x44px');
};
exports.checkMinHitArea = checkMinHitArea;
// a11y/color-contrast moved to rendered-checks.ts (checkLowContrast) in Stage 6 convergence -
// it reads the rendered scanner's low-contrast finding, the SAME detector the eval scores.
exports.A11Y_CHECKS = {
    'a11y/focus-visible': exports.checkFocusVisible,
    'a11y/min-hit-area': exports.checkMinHitArea,
};
//# sourceMappingURL=a11y-checks.js.map