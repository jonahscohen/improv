"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANTI_PATTERN_CHECKS = exports.checkModalAsFirstThought = exports.checkHeroMetricTemplate = exports.checkIdenticalCardGrids = exports.checkSideStripeBorders = exports.checkGlassmorphism = exports.checkGradientText = void 0;
const check_context_1 = require("../check-context");
const absolute_ban_detector_1 = require("../../absolute-ban-detector");
function verdictFromBanFindings(findings, cleanMessage) {
    if (!findings.length)
        return (0, check_context_1.pass)(cleanMessage);
    const f = findings[0];
    // Preserve ALL rewrite options across the matched findings, not just the first.
    const rewrites = [...new Set(findings.flatMap((x) => x.rewriteOptions))];
    return (0, check_context_1.fail)(`${f.banName}: ${f.reason}`, findings.map((x) => `${x.file}:${x.line ?? '?'}`), rewrites.length ? rewrites.join('; ') : undefined);
}
// CSS detectors run per-file (executeRule passes a one-file context for scope:file);
// use the REAL collected file path so a finding points at the actual source.
function cssFile(ctx) {
    return ctx.files[0]?.path ?? '<collected-css>';
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
    return verdictFromBanFindings((0, absolute_ban_detector_1.scanGradientText)(ctx.cssText, cssFile(ctx)), 'no gradient-text ban');
};
exports.checkGradientText = checkGradientText;
const checkGlassmorphism = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return verdictFromBanFindings((0, absolute_ban_detector_1.scanGlassmorphism)(ctx.cssText, cssFile(ctx)), 'no glassmorphism-default ban');
};
exports.checkGlassmorphism = checkGlassmorphism;
const checkSideStripeBorders = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected', 'unreadable_input');
    return verdictFromBanFindings((0, absolute_ban_detector_1.scanSideStripeBorders)(ctx.cssText, cssFile(ctx)), 'no side-stripe-borders ban');
};
exports.checkSideStripeBorders = checkSideStripeBorders;
// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
const checkIdenticalCardGrids = (ctx) => {
    if (!(0, check_context_1.hasMarkup)(ctx))
        return (0, check_context_1.inconclusive)('no markup source collected', 'unreadable_input');
    return verdictFromBanFindings(scanMarkupPerFile(ctx, absolute_ban_detector_1.scanIdenticalCardGrids), 'no identical-card-grids shape');
};
exports.checkIdenticalCardGrids = checkIdenticalCardGrids;
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
    'anti-pattern/identical-card-grids': exports.checkIdenticalCardGrids,
    'anti-pattern/hero-metric-template': exports.checkHeroMetricTemplate,
    'anti-pattern/modal-as-first-thought': exports.checkModalAsFirstThought,
};
//# sourceMappingURL=anti-pattern-checks.js.map