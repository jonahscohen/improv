"use strict";
// Sidecoach Polish Standard Validator
// Utility for validating UI implementations against 24-point proprietary polish framework
// Separate from flow handlers - used by Flow J (Tactical Polish) and audit flows
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolishStandardValidator = exports.hasEntranceKeyframe = exports.hasKeyframeAnimationOnInteractiveState = exports.hasReducedMotion = exports.hasFocusVisible = exports.countDefinedStates = exports.POLISH_STATES = exports.hasOpticalPadding = exports.countBoxShadowRules = exports.hasShadowTokenTiers = exports.hasBoxShadowElevation = exports.hasWillChangeAll = exports.hasFramerSignal = exports.hasFontSmoothing = exports.hasAnyMotion = exports.hasExitScale = exports.hasExitOpacity = exports.hasStaggerDelay = exports.hasTextWrapBalance = exports.hasDynamicNumberSelectors = exports.hasTabularNums = exports.hasTransitionAll = exports.hasNoImages = exports.hasImageOutlineRule = exports.hasCompoundIconTransition = exports.hasScaleOnPress = exports.joinCssRules = void 0;
// ============================================================================
// Shared static source predicates (P4a-2). Extracted so the live POLISH_RULES
// callbacks below AND the four-status adapter in validators/checks/polish-checks.ts
// call the SAME predicate - no regex/threshold is implemented twice. Each operates
// on a joined CSS-family string; the callbacks join ctx.cssRules before calling.
// ============================================================================
const joinCssRules = (ctx) => (ctx.cssRules || []).join('\n');
exports.joinCssRules = joinCssRules;
const hasScaleOnPress = (css) => css.includes('scale(0.96)');
exports.hasScaleOnPress = hasScaleOnPress;
const hasCompoundIconTransition = (css) => css.includes('opacity') && css.includes('scale');
exports.hasCompoundIconTransition = hasCompoundIconTransition;
const hasImageOutlineRule = (css) => /img\s*\{[^}]*(?:outline|border)[^}]*rgba\s*\(\s*0\s*,\s*0\s*,\s*0/i.test(css)
    || /(?:img|\.image)[^{]*\{[^}]*box-shadow[^}]*inset[^}]*rgba/i.test(css);
exports.hasImageOutlineRule = hasImageOutlineRule;
const hasNoImages = (text) => !/img\s*\{|\.image\b|<img\b/.test(text);
exports.hasNoImages = hasNoImages;
const hasTransitionAll = (css) => css.includes('transition: all');
exports.hasTransitionAll = hasTransitionAll;
const hasTabularNums = (css) => /font-variant-numeric\s*:\s*(?:[^;]*\b)?tabular-nums/i.test(css);
exports.hasTabularNums = hasTabularNums;
const hasDynamicNumberSelectors = (css) => /\.(?:counter|timer|stat|price|count|metric|number|kpi|tabular)\b/i.test(css);
exports.hasDynamicNumberSelectors = hasDynamicNumberSelectors;
const hasTextWrapBalance = (css) => css.includes('text-wrap: balance');
exports.hasTextWrapBalance = hasTextWrapBalance;
const hasStaggerDelay = (css) => css.includes('animation-delay');
exports.hasStaggerDelay = hasStaggerDelay;
const hasExitOpacity = (css) => css.includes('opacity: 0');
exports.hasExitOpacity = hasExitOpacity;
const hasExitScale = (css) => css.includes('scale(0.8)') || css.includes('scale(0.96)');
exports.hasExitScale = hasExitScale;
const hasAnyMotion = (css) => /transition\s*:|@keyframes\b|animation\s*:/.test(css);
exports.hasAnyMotion = hasAnyMotion;
const hasFontSmoothing = (css) => css.includes('-webkit-font-smoothing');
exports.hasFontSmoothing = hasFontSmoothing;
const hasFramerSignal = (text) => /framer-motion|<AnimatePresence/.test(text);
exports.hasFramerSignal = hasFramerSignal;
const hasWillChangeAll = (css) => css.includes('will-change: all');
exports.hasWillChangeAll = hasWillChangeAll;
const hasBoxShadowElevation = (css) => /box-shadow\s*:\s*[^;]*\(/.test(css);
exports.hasBoxShadowElevation = hasBoxShadowElevation;
const hasShadowTokenTiers = (css) => /--shadow-(?:sm|xs|md|lg|xl|2xl|small|medium|large)/i.test(css);
exports.hasShadowTokenTiers = hasShadowTokenTiers;
const countBoxShadowRules = (css) => (css.match(/box-shadow\s*:/g) || []).length;
exports.countBoxShadowRules = countBoxShadowRules;
const hasOpticalPadding = (css) => css.includes('padding');
exports.hasOpticalPadding = hasOpticalPadding;
exports.POLISH_STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
const countDefinedStates = (css) => exports.POLISH_STATES.filter((s) => css.includes(`:${s}`)).length;
exports.countDefinedStates = countDefinedStates;
const hasFocusVisible = (css) => css.includes(':focus-visible');
exports.hasFocusVisible = hasFocusVisible;
const hasReducedMotion = (css) => css.includes('@media (prefers-reduced-motion');
exports.hasReducedMotion = hasReducedMotion;
// #4 Interruptible Animations: interactive state changes should use CSS transitions (interruptible),
// not keyframe `animation` (runs to completion). Flags :hover/:focus/:active blocks that declare an
// `animation:`/`animation-name:` property (shorthand/name set a keyframe; animation-delay/duration/play-state
// alone are not matched - those tune an existing animation and aren't the violation). The property must sit
// at a declaration boundary ({, ; or whitespace) so a `--animation` custom property or a `transition-property:
// animation` value does not false-match, while a `-webkit-`/`-moz-`/`-o-`/`-ms-` vendor prefix still counts.
// Bounded quantifiers (selectors <500, declaration blocks <4000) keep it linear/ReDoS-safe.
const hasKeyframeAnimationOnInteractiveState = (css) => /(?::hover|:focus|:active)[^{}]{0,500}\{(?:[^}]{0,4000}[\s;{])?(?:-(?:webkit|moz|o|ms)-)?animation(?:-name)?\s*:/i.test(css);
exports.hasKeyframeAnimationOnInteractiveState = hasKeyframeAnimationOnInteractiveState;
// #13 Skip Animation on Page Load (CSS-only complement to AnimatePresence initial={false}): an entrance
// @keyframes (a from/0% frame setting opacity:0) replays on every page load unless gated. Returns true when
// such a frame exists; the check then fails only when nothing gates it (no reduced-motion guard, no
// AnimatePresence initial={false}).
const hasEntranceKeyframe = (css) => {
    // Scan each @keyframes block body with a brace-balanced walk and test ONLY that body for a from/0% frame
    // setting opacity:0. Scoping to the block (vs an unbounded lazy span) avoids attributing an opacity:0 from
    // an unrelated rule to a keyframe, and the bounded inner quantifier keeps it ReDoS-safe.
    const blockStart = /@keyframes[^{]{0,200}\{/gi;
    let m;
    while ((m = blockStart.exec(css)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        const bodyStart = i;
        for (; i < css.length && depth > 0; i++) {
            if (css[i] === '{')
                depth++;
            else if (css[i] === '}')
                depth--;
        }
        const body = css.slice(bodyStart, i - 1);
        if (/(?:\bfrom\b|\b0%)\s*\{[^}]{0,1000}\bopacity\s*:\s*0\b/i.test(body))
            return true;
        blockStart.lastIndex = i;
    }
    return false;
};
exports.hasEntranceKeyframe = hasEntranceKeyframe;
// ============================================================================
// Registry-backed PolishStandardValidator (Stage 4 convergence).
// The private POLISH_RULES engine was DELETED - the 24 polish rules already live
// in the rule registry (21 under owner 'polish-standard' + 3 under 'static-a11y',
// each carrying a `polish-standard:N` sourceRuleAlias). validateAll now runs THOSE
// rules' checkProduct over a registry ProductCheckContext, so there is ONE engine.
// The exported helper predicates above are KEPT - the registry's checks/polish-checks.ts
// and checks/a11y-checks.ts import them. RULES is required LAZILY (not a top-level
// import) because those checks import from THIS module, so a static import would be
// circular. Behavior note: the registry checks are sync cssText/markup-only, so legacy
// ad-hoc computedStyle/contrast paths no longer force a pass (correct convergence).
// ============================================================================
const LEGACY_SEVERITY_POLISH = {
    blocker: 'critical', major: 'high', minor: 'medium', advisory: 'low',
};
let _polishRegistryRules = null;
function polishRegistryRules() {
    if (_polishRegistryRules === null) {
        // Lazy require breaks the cycle (the registry's checks import helpers from this file).
        const { RULES } = require('./product-rule-registry');
        _polishRegistryRules = RULES
            .map((r) => {
            const alias = (r.sourceRuleAliases || []).find((a) => /^polish-standard:\d+$/.test(a));
            return alias && typeof r.checkProduct === 'function'
                ? { n: parseInt(alias.split(':')[1], 10), rule: r }
                : null;
        })
            .filter((x) => x !== null)
            .sort((a, b) => a.n - b.n);
    }
    return _polishRegistryRules;
}
function polishContextToProduct(ctx) {
    let markup = '';
    if (ctx.htmlElement) {
        try {
            markup = ctx.htmlElement.outerHTML || '';
        }
        catch { /* no DOM */ }
    }
    return { cssText: (ctx.cssRules || []).join('\n'), markup, files: [] };
}
class PolishStandardValidator {
    static validateAll(context) {
        const entries = polishRegistryRules();
        const pctx = polishContextToProduct(context);
        const results = entries.map(({ n, rule }) => {
            const v = rule.checkProduct(pctx);
            return { ruleId: n, passed: v.status !== 'fail', message: v.message, remediation: v.remediation };
        });
        const passed = results.filter(r => r.passed).length;
        const violations = results.filter(r => !r.passed);
        const total = entries.length;
        const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
        // Registry 'blocker' severity maps to the legacy 'critical' tier.
        const critical = violations.filter(v => {
            const e = entries.find(x => x.n === v.ruleId);
            return !!e && e.rule.severity === 'blocker';
        }).length;
        return {
            totalRules: total,
            passed,
            violations: violations.length,
            passRate: `${passRate}%`,
            criticalViolations: critical,
            results,
            summary: `Polish Standard: ${passed}/${total} rules passed (${passRate}%)`
        };
    }
    static getRules() {
        return polishRegistryRules().map(({ n, rule }) => ({
            id: n,
            name: rule.canonicalRuleKey,
            category: n <= 16 ? 'baseline' : 'proprietary',
            description: rule.canonicalRuleKey,
            checkFunction: (ctx) => {
                const v = rule.checkProduct(polishContextToProduct(ctx));
                // Only a real pass or a genuine not_applicable counts as passed; 'inconclusive'
                // (e.g. evidence absent) must NOT clean-pass - it blocks a clean result (Codex P0).
                return { ruleId: n, passed: v.status === 'pass' || v.status === 'not_applicable', message: v.message, remediation: v.remediation };
            },
            severity: LEGACY_SEVERITY_POLISH[rule.severity] || 'medium',
        }));
    }
    static getSummary() {
        return 'Sidecoach Polish Standard (registry-backed): 24 polish rules for production UI quality';
    }
    static toValidationResult(report) {
        const failed = report.results.filter(r => !r.passed);
        const status = report.criticalViolations > 0 ? 'fail' :
            report.violations > 0 ? 'partial' :
                'pass';
        return {
            domain: 'polish-standard',
            status,
            passedRules: report.results.filter(r => r.passed).map(r => `rule-${r.ruleId}`),
            failedRules: failed.map(r => `rule-${r.ruleId}`),
            message: report.summary,
        };
    }
}
exports.PolishStandardValidator = PolishStandardValidator;
//# sourceMappingURL=polish-standard-validator.js.map