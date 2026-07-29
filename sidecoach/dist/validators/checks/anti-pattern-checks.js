"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANTI_PATTERN_CHECKS = exports.checkModalAsFirstThought = exports.checkHeroMetricTemplate = exports.checkSideStripeBorders = exports.checkGlassmorphism = exports.checkGradientText = void 0;
const check_context_1 = require("../check-context");
const source_locator_1 = require("../source-locator");
const absolute_ban_detector_1 = require("../../absolute-ban-detector");
function verdictFromBanFindings(findings, cleanMessage) {
    if (!findings.length)
        return (0, check_context_1.pass)(cleanMessage);
    const f = findings[0];
    // Preserve ALL rewrite options across the matched findings, not just the first.
    const rewrites = [...new Set(findings.flatMap((x) => x.rewriteOptions))];
    return (0, check_context_1.fail)(`${f.banName}: ${f.reason}`, findings.map((x) => `${x.file}:${x.line ?? '?'}`), rewrites.length ? rewrites.join('; ') : undefined);
}
/**
 * Run a CSS ban scanner over every collected file's CSS REGIONS, remapping each finding's
 * line back to the line in the REAL FILE.
 *
 * This replaces `scanner(ctx.cssText, ctx.files[0].path)`, which was wrong twice over.
 * ctx.cssText is project-collector's concatenation of `<style>` bodies with the file
 * positions discarded, so a line computed in it is a line in an anonymous slice - yet it
 * was printed as `${file}:${line}` under a real filename. Measured 2026-07-29 on the
 * canary: the gradient-text rule lives on file line 6 and this path reported line 3. It
 * also labelled EVERY file's findings with files[0].path, so in a multi-file project a
 * finding in the second file named the first.
 *
 * cssRegionsOf re-derives the regions from the markup WITH their file start lines, so the
 * remap is exact. Evidence is untouched (cssText is still what the predicates read), so no
 * pass/fail verdict can move - only the reported location changes.
 */
function scanCssPerRegion(ctx, scanner) {
    const out = [];
    for (const f of ctx.files || []) {
        for (const region of (0, source_locator_1.cssRegionsOf)(f)) {
            if (!region.text.trim())
                continue;
            for (const finding of scanner(region.text, region.path)) {
                // Scanner lines are 1-based within region.text, which begins at region.startLine.
                const line = finding.line === undefined ? undefined : region.startLine + finding.line - 1;
                out.push({ ...finding, line });
            }
        }
    }
    return out;
}
// Markup heuristics are scope:project, so the assembled context carries every markup
// file. Scan EACH originating file with its real path (source-mapping the assembly back
// to files) instead of one placeholder over the joined blob.
function scanMarkupPerFile(ctx, scanner) {
    const out = [];
    for (const f of ctx.files) {
        if (!f.markup || !f.markup.trim())
            continue;
        out.push(...scanner(f.markup, f.path));
    }
    return out;
}
const checkGradientText = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return verdictFromBanFindings(scanCssPerRegion(ctx, absolute_ban_detector_1.scanGradientText), 'no gradient-text ban');
};
exports.checkGradientText = checkGradientText;
const checkGlassmorphism = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return verdictFromBanFindings(scanCssPerRegion(ctx, absolute_ban_detector_1.scanGlassmorphism), 'no glassmorphism-default ban');
};
exports.checkGlassmorphism = checkGlassmorphism;
const checkSideStripeBorders = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return verdictFromBanFindings(scanCssPerRegion(ctx, absolute_ban_detector_1.scanSideStripeBorders), 'no side-stripe-borders ban');
};
exports.checkSideStripeBorders = checkSideStripeBorders;
// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
// (checkIdenticalCardGrids deleted Stage-2 2026-06-24 - the underlying scanIdenticalCardGrids had a ReDoS + was a
// low-precision over-firing detector; removed, no replacement.)
const checkHeroMetricTemplate = (ctx) => {
    if (!(0, check_context_1.hasMarkup)(ctx))
        return (0, check_context_1.inconclusive)('no markup source collected', 'unreadable_input');
    return verdictFromBanFindings(scanMarkupPerFile(ctx, absolute_ban_detector_1.scanHeroMetricTemplate), 'no hero-metric-template shape');
};
exports.checkHeroMetricTemplate = checkHeroMetricTemplate;
const checkModalAsFirstThought = (ctx) => {
    if (!(0, check_context_1.hasMarkup)(ctx))
        return (0, check_context_1.inconclusive)('no markup source collected', 'unreadable_input');
    return verdictFromBanFindings(scanMarkupPerFile(ctx, absolute_ban_detector_1.scanModalAsFirstThought), 'no modal-as-first-thought shape');
};
exports.checkModalAsFirstThought = checkModalAsFirstThought;
exports.ANTI_PATTERN_CHECKS = {
    'anti-pattern/gradient-text': exports.checkGradientText,
    'anti-pattern/glassmorphism-default': exports.checkGlassmorphism,
    'anti-pattern/side-stripe-borders': exports.checkSideStripeBorders,
    'anti-pattern/hero-metric-template': exports.checkHeroMetricTemplate,
    'anti-pattern/modal-as-first-thought': exports.checkModalAsFirstThought,
};
//# sourceMappingURL=anti-pattern-checks.js.map