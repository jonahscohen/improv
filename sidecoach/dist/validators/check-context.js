"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.focusableTargetApplicability = exports.opticalTargetApplicability = exports.shadowTargetApplicability = exports.willChangeApplicability = exports.framerApplicability = exports.rootStyleApplicability = exports.motionTargetApplicability = exports.headingTargetApplicability = exports.tabularTargetApplicability = exports.transitionTargetApplicability = exports.imageTargetApplicability = exports.iconTargetApplicability = exports.interactiveTargetApplicability = exports.browserNumber = exports.hasTrustedBrowserEvidence = exports.hasMarkup = exports.hasCss = exports.inconclusive = exports.notApplicable = exports.fail = exports.pass = void 0;
exports.stampResult = stampResult;
exports.withRuleApplicability = withRuleApplicability;
const pass = (message, evidenceLocations = []) => ({ status: 'pass', message, evidenceLocations });
exports.pass = pass;
const fail = (message, evidenceLocations = [], remediation) => ({ status: 'fail', message, evidenceLocations, remediation });
exports.fail = fail;
const notApplicable = (message) => ({ status: 'not_applicable', message });
exports.notApplicable = notApplicable;
const inconclusive = (message, category = 'unreadable_input') => ({ status: 'inconclusive', message, normalizedErrorCategory: category });
exports.inconclusive = inconclusive;
// True only when at least one CSS-family file was collected with non-empty text.
const hasCss = (ctx) => !!ctx && typeof ctx.cssText === 'string' && ctx.cssText.trim().length > 0;
exports.hasCss = hasCss;
const hasMarkup = (ctx) => !!ctx && typeof ctx.markup === 'string' && ctx.markup.trim().length > 0;
exports.hasMarkup = hasMarkup;
const hasTrustedBrowserEvidence = (ctx, kind) => ctx.browserEvidence?.available === true && ctx.browserEvidence.kinds.includes(kind);
exports.hasTrustedBrowserEvidence = hasTrustedBrowserEvidence;
const browserNumber = (ctx, key) => {
    const raw = ctx.computedStyle?.[key];
    if (raw === undefined)
        return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
};
exports.browserNumber = browserNumber;
function stampResult(def, v) {
    return {
        ruleId: def.ruleId,
        canonicalRuleKey: def.canonicalRuleKey,
        status: v.status,
        normalizedErrorCategory: v.normalizedErrorCategory,
        severity: def.severity,
        findingClass: def.findingClass,
        evidenceKind: v.evidenceKind ?? def.evidenceRequirements[0],
        evidenceLocations: v.evidenceLocations ?? [],
        message: v.message,
        remediation: v.remediation,
    };
}
const textOf = (ctx) => `${ctx.cssText || ''}\n${ctx.markup || ''}`;
const INTERACTIVE_RE = /:hover|:active|:focus|<button\b|<a\b|<input\b|<select\b|<textarea\b|role\s*=\s*["']?(?:button|link|tab|menuitem|switch|checkbox)\b|\b(?:btn|button|link|nav|menu|tabs?|toggle|input|select|textarea|chip|switch|control|interactive)\b/i;
const ICON_RE = /\bicon\b|<svg\b|lucide|heroicon|tabler|\bphosphor\b|material-symbols/i;
const IMAGE_RE = /img\s*\{|\.image\b|<img\b/i;
const HEADING_RE = /<h[1-6]\b|(?:^|[\s,}])h[1-6]\s*[,{:]|\.(?:title|heading|headline|hero-title|display|headline)\b/i;
const MOTION_RE = /transition\s*:|@keyframes\b|animation\s*:|animation-delay|framer-motion|<AnimatePresence|\bmotion\./i;
const ROOT_TARGET_RE = /(?:^|[\s,}])(?:\*|:root|html|body)\s*[,{]/i;
const SHADOW_TARGET_RE = /box-shadow\s*:|--shadow|\.(?:card|panel|dialog|modal|popover|surface|elevated|sheet|menu|dropdown|tooltip|tile)\b/i;
// A real optical-alignment target is an icon-text control / badge / labelled control -
// NOT plain `padding:` (that is the FEATURE the check then evaluates; treating it as the
// target made ordinary layout padding a false pass, Codex P2#3).
const OPTICAL_TARGET_RE = /\bbadge\b|\bicon\b|\bchip\b|\bbtn\b|\bbutton\b|\blabel\b|icon-text|\bpill\b|\btag\b/i;
const FOCUSABLE_RE = /:focus|:hover|:active|<button\b|<a\b|<input\b|<select\b|<textarea\b|role\s*=\s*["']?(?:button|link|tab|menuitem)\b|\b(?:btn|button|link|input|nav|tabs?|focusable|interactive|control)\b/i;
const presence = (ctx, target, scope) => {
    const haveCss = (0, exports.hasCss)(ctx);
    const haveMarkup = (0, exports.hasMarkup)(ctx);
    if (scope === 'css' && !haveCss)
        return 'unknown';
    if (scope === 'markup' && !haveMarkup)
        return 'unknown';
    if (scope === 'both' && !haveCss && !haveMarkup)
        return 'unknown';
    const subject = scope === 'css' ? (ctx.cssText || '') : scope === 'markup' ? (ctx.markup || '') : textOf(ctx);
    return target.test(subject);
};
const interactiveTargetApplicability = (ctx) => presence(ctx, INTERACTIVE_RE, 'both');
exports.interactiveTargetApplicability = interactiveTargetApplicability;
const iconTargetApplicability = (ctx) => {
    const base = presence(ctx, ICON_RE, 'both');
    if (base === true)
        return true;
    if (base === 'unknown')
        return 'unknown';
    return presence(ctx, INTERACTIVE_RE, 'both'); // an interactive control can bear an icon swap
};
exports.iconTargetApplicability = iconTargetApplicability;
const imageTargetApplicability = (ctx) => presence(ctx, IMAGE_RE, 'both');
exports.imageTargetApplicability = imageTargetApplicability;
const transitionTargetApplicability = (ctx) => presence(ctx, /transition\s*:/i, 'css');
exports.transitionTargetApplicability = transitionTargetApplicability;
const tabularTargetApplicability = (ctx) => presence(ctx, /\.(?:counter|timer|stat|price|count|metric|number|kpi|tabular)\b/i, 'css');
exports.tabularTargetApplicability = tabularTargetApplicability;
const headingTargetApplicability = (ctx) => presence(ctx, HEADING_RE, 'both');
exports.headingTargetApplicability = headingTargetApplicability;
const motionTargetApplicability = (ctx) => presence(ctx, MOTION_RE, 'both');
exports.motionTargetApplicability = motionTargetApplicability;
const rootStyleApplicability = (ctx) => presence(ctx, ROOT_TARGET_RE, 'css');
exports.rootStyleApplicability = rootStyleApplicability;
const framerApplicability = (ctx) => presence(ctx, /framer-motion|<AnimatePresence/i, 'markup');
exports.framerApplicability = framerApplicability;
const willChangeApplicability = (ctx) => presence(ctx, /will-change\s*:/i, 'css');
exports.willChangeApplicability = willChangeApplicability;
const shadowTargetApplicability = (ctx) => presence(ctx, SHADOW_TARGET_RE, 'css');
exports.shadowTargetApplicability = shadowTargetApplicability;
const opticalTargetApplicability = (ctx) => presence(ctx, OPTICAL_TARGET_RE, 'css');
exports.opticalTargetApplicability = opticalTargetApplicability;
const focusableTargetApplicability = (ctx) => presence(ctx, FOCUSABLE_RE, 'both');
exports.focusableTargetApplicability = focusableTargetApplicability;
// canonicalRuleKey -> the probe gating that rule. Browser-only rules (computed-
// style/dom/contrast) are NOT listed: they bypass the N/A wrapper and return
// their honest inconclusive directly.
const PROBES = {
    'polish/scale-on-press': exports.interactiveTargetApplicability,
    'polish/state-completeness': exports.interactiveTargetApplicability,
    'polish/icon-swap-compound': exports.iconTargetApplicability,
    'polish/image-outline-neutral': exports.imageTargetApplicability,
    'polish/no-transition-all': exports.transitionTargetApplicability,
    'polish/tabular-nums': exports.tabularTargetApplicability,
    'polish/text-wrap-balance': exports.headingTargetApplicability,
    'polish/staggered-enter': exports.motionTargetApplicability,
    'polish/subtle-exit': exports.motionTargetApplicability,
    'polish/reduced-motion-respect': exports.motionTargetApplicability,
    'polish/font-smoothing': exports.rootStyleApplicability,
    'polish/animatepresence-initial': exports.framerApplicability,
    'polish/sparse-will-change': exports.willChangeApplicability,
    'polish/shadows-over-borders': exports.shadowTargetApplicability,
    'polish/shadow-hierarchy': exports.shadowTargetApplicability,
    'polish/optical-alignment': exports.opticalTargetApplicability,
};
// Wrap a faithful raw feature check with its applicability probe. unknown ->
// inconclusive, false -> not_applicable, true -> the raw check runs.
function withRuleApplicability(canonicalRuleKey, rawCheck) {
    const probe = PROBES[canonicalRuleKey];
    return (ctx) => {
        if (!probe)
            return rawCheck(ctx);
        const a = probe(ctx);
        if (a === 'unknown')
            return (0, exports.inconclusive)(`cannot establish applicability for ${canonicalRuleKey} from collected evidence`, 'unreadable_input');
        if (a === false)
            return (0, exports.notApplicable)(`no applicable target for ${canonicalRuleKey} in collected evidence`);
        return rawCheck(ctx);
    };
}
//# sourceMappingURL=check-context.js.map