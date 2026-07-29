"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.focusableTargetApplicability = exports.opticalTargetApplicability = exports.shadowTargetApplicability = exports.willChangeApplicability = exports.framerApplicability = exports.rootStyleApplicability = exports.motionTargetApplicability = exports.headingTargetApplicability = exports.tabularTargetApplicability = exports.transitionTargetApplicability = exports.imageTargetApplicability = exports.iconTargetApplicability = exports.interactiveTargetApplicability = exports.WILL_CHANGE_TARGET_RE = exports.FRAMER_TARGET_RE = exports.TRANSITION_TARGET_RE = exports.TABULAR_TARGET_RE = exports.FOCUSABLE_RE = exports.OPTICAL_TARGET_RE = exports.SHADOW_TARGET_RE = exports.ROOT_TARGET_RE = exports.MOTION_RE = exports.HEADING_RE = exports.IMAGE_RE = exports.ICON_RE = exports.INTERACTIVE_RE = exports.browserNumber = exports.hasTrustedBrowserEvidence = exports.hasMarkup = exports.hasCss = exports.inconclusive = exports.notApplicable = exports.failAnchor = exports.fail = exports.pass = void 0;
exports.stampResult = stampResult;
exports.withRuleApplicability = withRuleApplicability;
const pass = (message, evidenceLocations = []) => ({ status: 'pass', message, evidenceLocations });
exports.pass = pass;
/** A check calling fail() with locations is pointing at the DEFECT itself. Absence findings
 *  leave locations empty and let withRuleApplicability fill in the anchor. */
const fail = (message, evidenceLocations = [], remediation) => ({
    status: 'fail', message, evidenceLocations, remediation,
    locationKind: evidenceLocations.length ? 'defect' : undefined,
});
exports.fail = fail;
/** fail() for an ABSENCE finding whose locations are the FIX SITE, not the defect. Use this
 *  whenever nothing at the reported line is itself wrong. */
const failAnchor = (message, evidenceLocations = [], remediation) => ({
    status: 'fail', message, evidenceLocations, remediation,
    locationKind: evidenceLocations.length ? 'anchor' : undefined,
});
exports.failAnchor = failAnchor;
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
        locationKind: (v.evidenceLocations && v.evidenceLocations.length) ? (v.locationKind ?? 'defect') : undefined,
        message: v.message,
        remediation: v.remediation,
    };
}
const textOf = (ctx) => `${ctx.cssText || ''}\n${ctx.markup || ''}`;
// EXPORTED so the source locator can report the line where the probe found the target.
// An ABSENCE finding ("no :active press feedback") has no defect line of its own, so its
// location is the ANCHOR: the site this probe matched, which is exactly where the missing
// rule has to be written. Both the applicability probe and the locator read these SAME
// consts, so a regex edit can never leave the reported line pointing somewhere the probe
// did not actually look.
exports.INTERACTIVE_RE = /:hover|:active|:focus|<button\b|<a\b|<input\b|<select\b|<textarea\b|role\s*=\s*["']?(?:button|link|tab|menuitem|switch|checkbox)\b|\b(?:btn|button|link|nav|menu|tabs?|toggle|input|select|textarea|chip|switch|control|interactive)\b/i;
exports.ICON_RE = /\bicon\b|<svg\b|lucide|heroicon|tabler|\bphosphor\b|material-symbols/i;
exports.IMAGE_RE = /img\s*\{|\.image\b|<img\b/i;
exports.HEADING_RE = /<h[1-6]\b|(?:^|[\s,}])h[1-6]\s*[,{:]|\.(?:title|heading|headline|hero-title|display|headline)\b/i;
exports.MOTION_RE = /transition\s*:|@keyframes\b|animation\s*:|animation-delay|framer-motion|<AnimatePresence|\bmotion\./i;
exports.ROOT_TARGET_RE = /(?:^|[\s,}])(?:\*|:root|html|body)\s*[,{]/i;
exports.SHADOW_TARGET_RE = /box-shadow\s*:|--shadow|\.(?:card|panel|dialog|modal|popover|surface|elevated|sheet|menu|dropdown|tooltip|tile)\b/i;
// A real optical-alignment target is an icon-text control / badge / labelled control -
// NOT plain `padding:` (that is the FEATURE the check then evaluates; treating it as the
// target made ordinary layout padding a false pass, Codex P2#3).
exports.OPTICAL_TARGET_RE = /\bbadge\b|\bicon\b|\bchip\b|\bbtn\b|\bbutton\b|\blabel\b|icon-text|\bpill\b|\btag\b/i;
exports.FOCUSABLE_RE = /:focus|:hover|:active|<button\b|<a\b|<input\b|<select\b|<textarea\b|role\s*=\s*["']?(?:button|link|tab|menuitem)\b|\b(?:btn|button|link|input|nav|tabs?|focusable|interactive|control)\b/i;
exports.TABULAR_TARGET_RE = /\.(?:counter|timer|stat|price|count|metric|number|kpi|tabular)\b/i;
exports.TRANSITION_TARGET_RE = /transition\s*:/i;
exports.FRAMER_TARGET_RE = /framer-motion|<AnimatePresence/i;
exports.WILL_CHANGE_TARGET_RE = /will-change\s*:/i;
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
const interactiveTargetApplicability = (ctx) => presence(ctx, exports.INTERACTIVE_RE, 'both');
exports.interactiveTargetApplicability = interactiveTargetApplicability;
const iconTargetApplicability = (ctx) => {
    const base = presence(ctx, exports.ICON_RE, 'both');
    if (base === true)
        return true;
    if (base === 'unknown')
        return 'unknown';
    return presence(ctx, exports.INTERACTIVE_RE, 'both'); // an interactive control can bear an icon swap
};
exports.iconTargetApplicability = iconTargetApplicability;
const imageTargetApplicability = (ctx) => presence(ctx, exports.IMAGE_RE, 'both');
exports.imageTargetApplicability = imageTargetApplicability;
const transitionTargetApplicability = (ctx) => presence(ctx, exports.TRANSITION_TARGET_RE, 'css');
exports.transitionTargetApplicability = transitionTargetApplicability;
const tabularTargetApplicability = (ctx) => presence(ctx, exports.TABULAR_TARGET_RE, 'css');
exports.tabularTargetApplicability = tabularTargetApplicability;
const headingTargetApplicability = (ctx) => presence(ctx, exports.HEADING_RE, 'both');
exports.headingTargetApplicability = headingTargetApplicability;
const motionTargetApplicability = (ctx) => presence(ctx, exports.MOTION_RE, 'both');
exports.motionTargetApplicability = motionTargetApplicability;
const rootStyleApplicability = (ctx) => presence(ctx, exports.ROOT_TARGET_RE, 'css');
exports.rootStyleApplicability = rootStyleApplicability;
const framerApplicability = (ctx) => presence(ctx, exports.FRAMER_TARGET_RE, 'markup');
exports.framerApplicability = framerApplicability;
const willChangeApplicability = (ctx) => presence(ctx, exports.WILL_CHANGE_TARGET_RE, 'css');
exports.willChangeApplicability = willChangeApplicability;
const shadowTargetApplicability = (ctx) => presence(ctx, exports.SHADOW_TARGET_RE, 'css');
exports.shadowTargetApplicability = shadowTargetApplicability;
const opticalTargetApplicability = (ctx) => presence(ctx, exports.OPTICAL_TARGET_RE, 'css');
exports.opticalTargetApplicability = opticalTargetApplicability;
const focusableTargetApplicability = (ctx) => presence(ctx, exports.FOCUSABLE_RE, 'both');
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
//
// It also fills in the ANCHOR location for an absence finding. This is the right place and
// the only place: the probe has just proven a target EXISTS in the collected source, so the
// wrapper is the one layer that knows both the rule key and that a target was found. A
// check body cannot report where the missing rule belongs without re-deriving what the
// probe already established - and a rule whose fix site is unstated is a chore, not a fix.
//
// Lazy require: source-locator imports this module for the target regexes, so a top-level
// import here would be a cycle.
function withRuleApplicability(canonicalRuleKey, rawCheck) {
    const probe = PROBES[canonicalRuleKey];
    return (ctx) => {
        if (!probe)
            return withAnchor(canonicalRuleKey, ctx, rawCheck(ctx));
        const a = probe(ctx);
        if (a === 'unknown')
            return (0, exports.inconclusive)(`cannot establish applicability for ${canonicalRuleKey} from collected evidence`, 'unreadable_input');
        if (a === false)
            return (0, exports.notApplicable)(`no applicable target for ${canonicalRuleKey} in collected evidence`);
        return withAnchor(canonicalRuleKey, ctx, rawCheck(ctx));
    };
}
/**
 * Fill an ABSENCE finding's location with its anchor. Only ever ADDS to an empty
 * evidenceLocations - a check that already pointed at a real defect keeps its own
 * 'defect' locations untouched. Finding nothing leaves the list empty, because no
 * location at all beats a made-up one.
 */
function withAnchor(canonicalRuleKey, ctx, v) {
    if (v.status !== 'fail' || (v.evidenceLocations && v.evidenceLocations.length))
        return v;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { locateRuleAnchor } = require('./source-locator');
    const anchor = locateRuleAnchor(ctx, canonicalRuleKey);
    if (!anchor.length)
        return v;
    return { ...v, evidenceLocations: anchor, locationKind: 'anchor' };
}
//# sourceMappingURL=check-context.js.map