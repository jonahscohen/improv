"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THEMING_CHECKS = exports.checkBorderRadiusConsistency = exports.checkHexInInteractiveState = exports.radiusApplicability = exports.interactiveTokenApplicability = void 0;
const check_context_1 = require("../check-context");
const taste_validator_1 = require("../../taste-validator");
// Reconstruct the analyzed CSS exactly as validateTaste does: external CSS plus the
// inline <style> blocks lifted out of the markup.
function buildAllCss(ctx) {
    const inline = (0, taste_validator_1.extractInlineStyles)(ctx.markup || '').map((b) => b.content).join('\n');
    return `${ctx.cssText || ''}\n${inline}`;
}
function tasteOpts(ctx) {
    return ctx.tasteOptions?.componentsJson ? { componentsJson: true } : undefined;
}
const hasTokenSystem = (css) => /--[\w-]+\s*:/.test(css) || /var\(\s*--[\w-]+/.test(css);
const hasInteractiveState = (css) => /(:hover|:active)\b/.test(css);
// Applicable only when BOTH an interactive state and a token system are established;
// absence of either is N/A (no token system to violate).
const interactiveTokenApplicability = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return 'unknown';
    const css = buildAllCss(ctx);
    return hasInteractiveState(css) && hasTokenSystem(css);
};
exports.interactiveTokenApplicability = interactiveTokenApplicability;
// Applicable when at least one radius declaration or rounded utility is established.
const radiusApplicability = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx) && !(ctx.markup || '').trim())
        return 'unknown';
    const css = buildAllCss(ctx);
    return /border-radius\s*:/.test(css) || /\brounded(?:-(?:sm|md|lg|xl|2xl|3xl|full|none))?\b/.test(`${css} ${ctx.markup || ''}`);
};
exports.radiusApplicability = radiusApplicability;
const checkHexInInteractiveState = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    const applicability = (0, exports.interactiveTokenApplicability)(ctx);
    if (applicability === 'unknown')
        return (0, check_context_1.inconclusive)('cannot establish interactive token applicability', 'unreadable_input');
    if (!applicability)
        return (0, check_context_1.notApplicable)('no interactive token-system target');
    const allCss = buildAllCss(ctx);
    const tailwind = (0, taste_validator_1.detectTailwindContext)(ctx.markup || '', allCss, tasteOpts(ctx));
    const offenders = (0, taste_validator_1.checkHexInHoverWithCssVars)(allCss, tailwind);
    return offenders.length
        ? (0, check_context_1.fail)(`interactive state(s) use hardcoded hex while tokens exist: ${offenders.map((o) => o.message).join(' | ')}`, offenders.map((o) => o.excerpt ?? o.ruleId), 'Derive the interactive state from a token, e.g. var(--c-brand-hover)')
        : (0, check_context_1.pass)('interactive states are token-driven');
};
exports.checkHexInInteractiveState = checkHexInInteractiveState;
const checkBorderRadiusConsistency = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    if (!(0, exports.radiusApplicability)(ctx))
        return (0, check_context_1.notApplicable)('no radius declaration or rounded utility');
    const allCss = buildAllCss(ctx);
    const tailwind = (0, taste_validator_1.detectTailwindContext)(ctx.markup || '', allCss, tasteOpts(ctx));
    const violations = (0, taste_validator_1.checkBorderRadiusInconsistency)(allCss, tailwind);
    return violations.length
        ? (0, check_context_1.fail)(violations[0].message, [], 'Use 1-2 named radius tokens from a radius scale')
        : (0, check_context_1.pass)('radius usage satisfies taste scanner');
};
exports.checkBorderRadiusConsistency = checkBorderRadiusConsistency;
exports.THEMING_CHECKS = {
    'theming/token-driven-interactive-state': exports.checkHexInInteractiveState,
    'theming/border-radius-consistency': exports.checkBorderRadiusConsistency,
};
//# sourceMappingURL=theming-checks.js.map