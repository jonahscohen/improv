"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOCUSABLE_ANCHOR = exports.RULE_ANCHOR_TARGETS = void 0;
exports.lineOfOffset = lineOfOffset;
exports.fileLineOf = fileLineOf;
exports.cssRegionsOf = cssRegionsOf;
exports.markupRegionOf = markupRegionOf;
exports.sourceRegions = sourceRegions;
exports.locate = locate;
exports.locateFirst = locateFirst;
exports.locateWhere = locateWhere;
exports.locateAnchor = locateAnchor;
exports.locateRuleAnchor = locateRuleAnchor;
const check_context_1 = require("./check-context");
const CSS_SOURCE_KINDS = new Set(['css', 'scss', 'sass', 'less']);
/** 1-based line of a character offset. Counts newlines only - no allocation per line. */
function lineOfOffset(text, offset) {
    if (offset <= 0)
        return 1;
    const stop = Math.min(offset, text.length);
    let line = 1;
    for (let i = 0; i < stop; i++)
        if (text.charCodeAt(i) === 10)
            line++;
    return line;
}
/** Map an offset inside a region back to its file line. */
function fileLineOf(region, offsetInRegion) {
    return region.startLine + lineOfOffset(region.text, offsetInRegion) - 1;
}
/**
 * The CSS regions of one collected file, each carrying the file line it starts on.
 *
 * A css-family file is one region starting at line 1. A markup file's regions are its
 * `<style>` bodies, re-derived from `markup` (NOT from `cssText`, which has already lost
 * the positions). A markup file with no `<style>` block has no CSS regions, which is the
 * honest answer: there is no CSS in this file to point at.
 */
function cssRegionsOf(file) {
    if (CSS_SOURCE_KINDS.has(file.sourceKind)) {
        return file.cssText ? [{ path: file.path, text: file.cssText, startLine: 1 }] : [];
    }
    const out = [];
    const html = file.markup || '';
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
        if (m.index === undefined)
            continue;
        const bodyOffset = m.index + m[0].indexOf('>') + 1; // first char after the opening tag
        out.push({ path: file.path, text: m[1], startLine: lineOfOffset(html, bodyOffset) });
    }
    return out;
}
/** The markup region of one collected file (the whole file), or none for a pure CSS file. */
function markupRegionOf(file) {
    if (!file.markup)
        return undefined;
    return { path: file.path, text: file.markup, startLine: 1 };
}
/** EXPORTED region accessor for callers that must scan source themselves (e.g. the patternSpec
 *  interpreter, which runs UNTRUSTED regexes through re2 rather than a native RegExp and so cannot
 *  use locate()). Same regions locate() uses, so reported lines stay consistent. */
function sourceRegions(ctx, scope) {
    return regionsFor(ctx, scope);
}
function regionsFor(ctx, scope) {
    const files = Array.isArray(ctx.files) ? ctx.files : [];
    const out = [];
    for (const f of files) {
        if (scope === 'css' || scope === 'both')
            out.push(...cssRegionsOf(f));
        if (scope === 'markup' || scope === 'both') {
            const m = markupRegionOf(f);
            if (m)
                out.push(m);
        }
    }
    return out;
}
/**
 * Every `path:line` where `re` matches, across the requested scope, capped at `limit`.
 *
 * Returns [] when nothing matched - and [] is what a check must then report, because an
 * invented location is worse than none. The caller never fabricates a fallback.
 */
function locate(ctx, re, scope = 'both', limit = 5) {
    const seen = new Set();
    // A caller's regex is reused across regions, so it must not carry lastIndex state.
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    for (const region of regionsFor(ctx, scope)) {
        const rx = new RegExp(re.source, flags);
        for (const m of region.text.matchAll(rx)) {
            if (m.index === undefined)
                continue;
            seen.add(`${region.path}:${fileLineOf(region, m.index)}`);
            if (seen.size >= limit)
                return [...seen];
        }
    }
    return [...seen];
}
/** First location only - the common case for a single-anchor finding. */
function locateFirst(ctx, re, scope = 'both') {
    return locate(ctx, re, scope, 1);
}
/**
 * Locations of the matches of `re` that ALSO satisfy `keep`, indexed by match order.
 *
 * For rules that fail on a SUBSET of matches - "3 of 5 images lack width+height" - so the
 * reported lines are the three offending tags and not all five. `index` is the running
 * position across the whole scope, matching the order the check itself counts in, so an
 * order-sensitive predicate (the first image is the exempt hero) stays consistent with the
 * verdict it decorates.
 */
function locateWhere(ctx, re, keep, scope = 'both', limit = 5) {
    const out = [];
    const seen = new Set();
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    let index = 0;
    for (const region of regionsFor(ctx, scope)) {
        const rx = new RegExp(re.source, flags);
        for (const m of region.text.matchAll(rx)) {
            if (m.index === undefined)
                continue;
            const i = index++;
            if (!keep(m[0], i))
                continue;
            const loc = `${region.path}:${fileLineOf(region, m.index)}`;
            if (seen.has(loc))
                continue;
            seen.add(loc);
            out.push(loc);
            if (out.length >= limit)
                return out;
        }
    }
    return out;
}
/**
 * The anchor target per rule: the SAME regex that rule's applicability probe tested, in
 * probe order for the composite ones. Keyed by canonicalRuleKey so it lines up 1:1 with
 * check-context's PROBES table; `source-locator.test.ts` asserts the two key sets are
 * identical, so adding a probe without an anchor (or the reverse) fails the suite rather
 * than silently shipping a rule that can never report where to fix it.
 */
exports.RULE_ANCHOR_TARGETS = {
    'polish/scale-on-press': [{ re: check_context_1.INTERACTIVE_RE, scope: 'both' }],
    'polish/state-completeness': [{ re: check_context_1.INTERACTIVE_RE, scope: 'both' }],
    'polish/icon-swap-compound': [{ re: check_context_1.ICON_RE, scope: 'both' }, { re: check_context_1.INTERACTIVE_RE, scope: 'both' }],
    'polish/image-outline-neutral': [{ re: check_context_1.IMAGE_RE, scope: 'both' }],
    'polish/no-transition-all': [{ re: check_context_1.TRANSITION_TARGET_RE, scope: 'css' }],
    'polish/tabular-nums': [{ re: check_context_1.TABULAR_TARGET_RE, scope: 'css' }],
    'polish/text-wrap-balance': [{ re: check_context_1.HEADING_RE, scope: 'both' }],
    'polish/staggered-enter': [{ re: check_context_1.MOTION_RE, scope: 'both' }],
    'polish/subtle-exit': [{ re: check_context_1.MOTION_RE, scope: 'both' }],
    'polish/reduced-motion-respect': [{ re: check_context_1.MOTION_RE, scope: 'both' }],
    'polish/font-smoothing': [{ re: check_context_1.ROOT_TARGET_RE, scope: 'css' }],
    'polish/animatepresence-initial': [{ re: check_context_1.FRAMER_TARGET_RE, scope: 'markup' }],
    'polish/sparse-will-change': [{ re: check_context_1.WILL_CHANGE_TARGET_RE, scope: 'css' }],
    'polish/shadows-over-borders': [{ re: check_context_1.SHADOW_TARGET_RE, scope: 'css' }],
    'polish/shadow-hierarchy': [{ re: check_context_1.SHADOW_TARGET_RE, scope: 'css' }],
    'polish/optical-alignment': [{ re: check_context_1.OPTICAL_TARGET_RE, scope: 'css' }],
};
/** The focusable anchor is used by a11y/focus-visible, which has no PROBES entry. */
exports.FOCUSABLE_ANCHOR = [{ re: check_context_1.FOCUSABLE_RE, scope: 'both' }];
/** Resolve an anchor location list by trying each target in probe order. */
function locateAnchor(ctx, targets) {
    for (const t of targets) {
        const hit = locateFirst(ctx, t.re, t.scope);
        if (hit.length)
            return hit;
    }
    return [];
}
/** Anchor location for a rule identified by canonicalRuleKey. [] when it has no anchor. */
function locateRuleAnchor(ctx, canonicalRuleKey) {
    const targets = exports.RULE_ANCHOR_TARGETS[canonicalRuleKey];
    return targets ? locateAnchor(ctx, targets) : [];
}
//# sourceMappingURL=source-locator.js.map