"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLISH_CHECKS = exports.checkGenericity = exports.checkTypographyRhythm = exports.checkConcentricRadius = exports.checkOpticalAlignment = exports.checkTextWrapBalance = exports.checkFontSmoothing = exports.checkStaggeredEnter = exports.checkStateCompleteness = exports.checkShadowHierarchy = exports.checkShadowsOverBorders = exports.checkAnimatePresenceInitial = exports.checkImageOutline = exports.checkSubtleExit = exports.checkTabularNums = exports.checkSparseWillChange = exports.checkNoTransitionAll = exports.checkIconSwapCompound = exports.checkScaleOnPress = exports.checkReducedMotion = void 0;
const check_context_1 = require("../check-context");
const polish_standard_validator_1 = require("../../polish-standard-validator");
// A css-rule presence verdict: no CSS -> inconclusive; needle present -> pass; absent -> fail.
function cssPresence(ctx, needle, okMsg, badMsg, fix) {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return needle(ctx.cssText) ? (0, check_context_1.pass)(okMsg) : (0, check_context_1.fail)(badMsg, [], fix);
}
// id 19, css-rule. Old code absence-failed silently; new code keys on collected evidence.
const checkReducedMotion = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasReducedMotion, 'prefers-reduced-motion media query present', 'no prefers-reduced-motion media query found in collected CSS', 'Add: @media (prefers-reduced-motion: reduce) { animation: none; }');
exports.checkReducedMotion = checkReducedMotion;
const checkScaleOnPress = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasScaleOnPress, 'scale-on-press present', 'no :active scale(0.96) press feedback', 'Add :active { transform: scale(0.96); }');
exports.checkScaleOnPress = checkScaleOnPress;
const checkIconSwapCompound = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasCompoundIconTransition, 'compound icon transition present', 'icon transitions need opacity + scale (+ blur)', 'Use opacity, transform scale, and filter blur in icon transitions');
exports.checkIconSwapCompound = checkIconSwapCompound;
const checkNoTransitionAll = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return (0, polish_standard_validator_1.hasTransitionAll)(ctx.cssText)
        ? (0, check_context_1.fail)('transition: all found; use explicit properties', [], 'Replace transition: all with specific properties')
        : (0, check_context_1.pass)('no transition: all');
};
exports.checkNoTransitionAll = checkNoTransitionAll;
const checkSparseWillChange = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return (0, polish_standard_validator_1.hasWillChangeAll)(ctx.cssText)
        ? (0, check_context_1.fail)('will-change: all found', [], 'Use will-change for specific properties only')
        : (0, check_context_1.pass)('no will-change: all');
};
exports.checkSparseWillChange = checkSparseWillChange;
const checkTabularNums = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return (0, polish_standard_validator_1.hasTabularNums)(ctx.cssText)
        ? (0, check_context_1.pass)('tabular-nums applied')
        : (0, check_context_1.fail)('numeric fields should use tabular-nums', [], 'Add font-variant-numeric: tabular-nums');
};
exports.checkTabularNums = checkTabularNums;
const checkSubtleExit = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    const ok = (0, polish_standard_validator_1.hasExitOpacity)(ctx.cssText) && (0, polish_standard_validator_1.hasExitScale)(ctx.cssText);
    return ok ? (0, check_context_1.pass)('exit choreography present') : (0, check_context_1.fail)('exit animations need opacity + scale', [], 'Fade opacity to 0 and scale toward 0.96 on exit');
};
exports.checkSubtleExit = checkSubtleExit;
const checkImageOutline = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx) && !(0, check_context_1.hasMarkup)(ctx))
        return (0, check_context_1.inconclusive)('no source collected', 'unreadable_input');
    const text = `${ctx.cssText}\n${ctx.markup}`;
    if ((0, polish_standard_validator_1.hasNoImages)(text))
        return (0, check_context_1.notApplicable)('no img rules in project');
    return (0, polish_standard_validator_1.hasImageOutlineRule)(ctx.cssText)
        ? (0, check_context_1.pass)('neutral image outline present')
        : (0, check_context_1.fail)('image outlines should use neutral transparency', [], 'border: 1px solid rgba(0,0,0,0.1)');
};
exports.checkImageOutline = checkImageOutline;
const checkAnimatePresenceInitial = (ctx) => {
    if (!(0, check_context_1.hasMarkup)(ctx))
        return (0, check_context_1.inconclusive)('no markup source collected', 'unreadable_input');
    return /initial\s*=\s*\{?\s*false/.test(ctx.markup)
        ? (0, check_context_1.pass)('AnimatePresence initial={false} present')
        : (0, check_context_1.fail)('AnimatePresence children need initial={false}', [], 'Set initial={false} on AnimatePresence children');
};
exports.checkAnimatePresenceInitial = checkAnimatePresenceInitial;
const checkShadowsOverBorders = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasBoxShadowElevation, 'box-shadow elevation present', 'use box-shadow for elevation', 'Add box-shadow: 0 1px 3px rgba(0,0,0,0.1) or elevation tokens');
exports.checkShadowsOverBorders = checkShadowsOverBorders;
const checkShadowHierarchy = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return ((0, polish_standard_validator_1.hasShadowTokenTiers)(ctx.cssText) || (0, polish_standard_validator_1.countBoxShadowRules)(ctx.cssText) >= 3)
        ? (0, check_context_1.pass)('shadow hierarchy present')
        : (0, check_context_1.fail)('use an elevation-based shadow hierarchy', [], 'Define --shadow-sm/md/lg or 3+ elevation tiers');
};
exports.checkShadowHierarchy = checkShadowHierarchy;
const checkStateCompleteness = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    const defined = (0, polish_standard_validator_1.countDefinedStates)(ctx.cssText);
    return defined >= 8 ? (0, check_context_1.pass)('all 8 component states defined') : (0, check_context_1.fail)(`${defined}/8 component states defined`, [], 'Define all 8 component states');
};
exports.checkStateCompleteness = checkStateCompleteness;
const checkStaggeredEnter = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasStaggerDelay, 'stagger delays present', 'animations should use stagger delays', 'Apply animation-delay: calc(30ms * var(--index))');
exports.checkStaggeredEnter = checkStaggeredEnter;
const checkFontSmoothing = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasFontSmoothing, 'font smoothing present', 'apply font smoothing', 'Add -webkit-font-smoothing: antialiased');
exports.checkFontSmoothing = checkFontSmoothing;
const checkTextWrapBalance = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasTextWrapBalance, 'heading balance present', 'headings should use text-wrap: balance', 'Add text-wrap: balance to heading styles');
exports.checkTextWrapBalance = checkTextWrapBalance;
const checkOpticalAlignment = (ctx) => cssPresence(ctx, polish_standard_validator_1.hasOpticalPadding, 'optical alignment padding present', 'apply optical alignment adjustments', 'Subtract 2-4px from top padding for descender allowance');
exports.checkOpticalAlignment = checkOpticalAlignment;
const checkConcentricRadius = (ctx) => {
    if (!(0, check_context_1.hasTrustedBrowserEvidence)(ctx, 'computed-style')) {
        return (0, check_context_1.inconclusive)('concentric radius needs trusted computed-style evidence', 'unsupported_runtime');
    }
    const checked = (0, check_context_1.browserNumber)(ctx, 'concentric.checkedPairs');
    const failing = (0, check_context_1.browserNumber)(ctx, 'concentric.failingPairs');
    if (checked === undefined || failing === undefined)
        return (0, check_context_1.inconclusive)('concentric radius evidence is incomplete', 'unreadable_input');
    if (checked === 0)
        return (0, check_context_1.notApplicable)('no visible nested rounded pair found');
    return failing === 0
        ? (0, check_context_1.pass)(`${checked} concentric radius pair(s) satisfy outer = inner + padding`)
        : (0, check_context_1.fail)(`${failing}/${checked} concentric radius pair(s) violate outer = inner + padding`, [], 'Set outer radius to inner radius plus parent padding');
};
exports.checkConcentricRadius = checkConcentricRadius;
const checkTypographyRhythm = (ctx) => {
    if (!(0, check_context_1.hasTrustedBrowserEvidence)(ctx, 'computed-style')) {
        return (0, check_context_1.inconclusive)('typography rhythm needs trusted computed-style evidence', 'unsupported_runtime');
    }
    const checked = (0, check_context_1.browserNumber)(ctx, 'typography.checkedElements');
    const invalid = (0, check_context_1.browserNumber)(ctx, 'typography.invalidLineHeightElements');
    if (checked === undefined || invalid === undefined)
        return (0, check_context_1.inconclusive)('typography rhythm evidence is incomplete', 'unreadable_input');
    if (checked === 0)
        return (0, check_context_1.notApplicable)('no visible text-bearing element found');
    return invalid === 0
        ? (0, check_context_1.pass)(`${checked} visible text element(s) have resolved line-height`)
        : (0, check_context_1.fail)(`${invalid}/${checked} visible text element(s) have invalid line-height`, [], 'Set an explicit usable line-height on visible text');
};
exports.checkTypographyRhythm = checkTypographyRhythm;
const checkGenericity = (_ctx) => (0, check_context_1.inconclusive)('genericity needs browser/design-token evidence (P4b)', 'unsupported_runtime');
exports.checkGenericity = checkGenericity;
const RAW_POLISH_CHECKS = {
    'polish/reduced-motion-respect': exports.checkReducedMotion,
    'polish/scale-on-press': exports.checkScaleOnPress,
    'polish/concentric-radius': exports.checkConcentricRadius,
    'polish/icon-swap-compound': exports.checkIconSwapCompound,
    'polish/image-outline-neutral': exports.checkImageOutline,
    'polish/no-transition-all': exports.checkNoTransitionAll,
    'polish/tabular-nums': exports.checkTabularNums,
    'polish/text-wrap-balance': exports.checkTextWrapBalance,
    'polish/staggered-enter': exports.checkStaggeredEnter,
    'polish/subtle-exit': exports.checkSubtleExit,
    'polish/font-smoothing': exports.checkFontSmoothing,
    'polish/animatepresence-initial': exports.checkAnimatePresenceInitial,
    'polish/sparse-will-change': exports.checkSparseWillChange,
    'polish/shadows-over-borders': exports.checkShadowsOverBorders,
    'polish/optical-alignment': exports.checkOpticalAlignment,
    'polish/typography-rhythm': exports.checkTypographyRhythm,
    'polish/shadow-hierarchy': exports.checkShadowHierarchy,
    'polish/state-completeness': exports.checkStateCompleteness,
    'polish/anti-pattern-genericity': exports.checkGenericity,
};
// Every static Polish check is wrapped with its applicability probe (the browser-only
// rules have no probe, so withRuleApplicability runs their raw inconclusive directly).
exports.POLISH_CHECKS = Object.fromEntries(Object.entries(RAW_POLISH_CHECKS).map(([key, fn]) => [key, (0, check_context_1.withRuleApplicability)(key, fn)]));
//# sourceMappingURL=polish-checks.js.map