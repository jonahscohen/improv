"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAGE_QUALITY_CHECKS = exports.checkButtonLabelSpecific = exports.checkChartA11yFallback = exports.checkColorSchemeDark = exports.checkTextOverflowStrategy = exports.checkImageLazyLoad = exports.checkImageDimensions = void 0;
const check_context_1 = require("../check-context");
// Comment-stripped lowercased haystack (HTML + JS/CSS block + JS line comments; line strip guarded against ':'
// so https:// survives) - same registry-quality posture as forms-checks.
const hay = (ctx) => `${ctx.markup || ''}\n${ctx.cssText || ''}\n${ctx.html || ''}`
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n\r]*/g, '$1 ')
    .toLowerCase();
// IMGPERF_001: <img> needs explicit width+height (or aspect-ratio) to reserve space and avoid layout shift (CLS).
const checkImageDimensions = (ctx) => {
    const imgs = hay(ctx).match(/<img\b[^>]*>/g);
    if (!imgs || imgs.length === 0)
        return (0, check_context_1.notApplicable)('no <img> elements');
    const missing = imgs.filter((t) => !(((/\bwidth\s*=/.test(t)) && (/\bheight\s*=/.test(t))) || /aspect-ratio/.test(t)));
    return missing.length === 0
        ? (0, check_context_1.pass)('images declare explicit dimensions (or aspect-ratio)')
        : (0, check_context_1.fail)(`${missing.length} image(s) lack width+height/aspect-ratio (causes layout shift)`, [], 'Set width and height (or aspect-ratio) on <img> so the browser reserves space before load');
};
exports.checkImageDimensions = checkImageDimensions;
// IMGPERF_002: below-the-fold images should lazy-load.
const checkImageLazyLoad = (ctx) => {
    const h = hay(ctx);
    const imgs = h.match(/<img\b[^>]*>/g);
    if (!imgs || imgs.length === 0)
        return (0, check_context_1.notApplicable)('no <img> elements');
    // PER-IMAGE, not "any image lazy" (Codex P1): the FIRST <img> (document order) is
    // treated as the likely above-the-fold/LCP hero and may load eagerly; every LATER
    // image that is neither loading="lazy" nor explicitly prioritized (fetchpriority="high")
    // should be lazy. So a page of eager below-the-fold images is no longer masked by one
    // lazy image elsewhere.
    const eager = imgs.filter((tag, i) => {
        if (/loading\s*=\s*["']?lazy/.test(tag))
            return false; // already deferred
        if (/fetchpriority\s*=\s*["']?high/.test(tag))
            return false; // intentionally eager
        return i > 0; // first image exempt
    });
    return eager.length === 0
        ? (0, check_context_1.pass)('below-the-fold images use loading="lazy" (the first/hero image may load eagerly)')
        : (0, check_context_1.fail)(`${eager.length} below-the-fold image(s) not lazy-loaded`, [], 'Add loading="lazy" to images past the first/hero (or fetchpriority="high" if intentionally eager) so below-the-fold images defer their fetch');
};
exports.checkImageLazyLoad = checkImageLazyLoad;
// CONTENT_002: overflow-prone text containers need a wrap/clamp strategy.
const checkTextOverflowStrategy = (ctx) => {
    const h = hay(ctx);
    if (!/text-overflow:\s*ellipsis|\btruncate\b|line-clamp/.test(h))
        return (0, check_context_1.notApplicable)('no overflow-prone text container');
    return /overflow-wrap|word-break|break-words|line-clamp|-webkit-line-clamp|text-wrap/.test(h)
        ? (0, check_context_1.pass)('long text has a wrap/clamp strategy')
        : (0, check_context_1.fail)('text container can overflow without a wrap/clamp strategy', [], 'Add overflow-wrap/word-break or a line-clamp so long strings (URLs, emails) do not break the layout');
};
exports.checkTextOverflowStrategy = checkTextOverflowStrategy;
// DARKMODE_001: when the page expresses dark-mode intent, declare the color-scheme: dark CSS property (NOT the
// prefers-color-scheme media feature) so native form controls/scrollbars adapt.
const checkColorSchemeDark = (ctx) => {
    const h = hay(ctx);
    if (!/prefers-color-scheme|dark-mode|darkmode|data-theme|\.dark\b|theme.*dark/.test(h))
        return (0, check_context_1.notApplicable)('no dark-mode intent');
    return /(?<!prefers-)color-scheme\s*:\s*[^;}]*\bdark\b/.test(h)
        ? (0, check_context_1.pass)('color-scheme: dark declared for native control theming')
        : (0, check_context_1.fail)('dark mode without a color-scheme: dark declaration', [], 'Add color-scheme: dark (or light dark) so native controls, scrollbars, and form fields adapt');
};
exports.checkColorSchemeDark = checkColorSchemeDark;
// CHART_003: a chart needs a text or table fallback for assistive tech.
const checkChartA11yFallback = (ctx) => {
    const h = hay(ctx);
    // Detect a chart STRUCTURALLY (canvas, a charting-library marker, or a chart/graph CLASS) - NOT the prose word
    // "chart"/"graph", which appears in ordinary copy. Under-detecting a bare unclassed <svg> is acceptable; a bare
    // svg is indistinguishable from an icon, and a false N/A is far better than failing every page that says "chart".
    if (!/<canvas\b|recharts|chart\.?js|chartjs|highcharts|echarts|amcharts|\bnivo\b|\bvisx\b|class=["'][^"']*\b(chart|graph|sparkline|plot)/.test(h)) {
        return (0, check_context_1.notApplicable)('no chart/visualization');
    }
    return /<table\b|<figcaption\b|aria-label=|aria-describedby=|sr-only|visually-hidden|role=["']table["']/.test(h)
        ? (0, check_context_1.pass)('chart provides a text/table fallback')
        : (0, check_context_1.fail)('chart has no text/table fallback for assistive tech', [], 'Add a <table>, aria-label/aria-describedby, or an sr-only summary so the data is reachable without sight');
};
exports.checkChartA11yFallback = checkChartA11yFallback;
// COPY_003: button labels should be specific, not generic ("submit"/"click here"/"ok").
const checkButtonLabelSpecific = (ctx) => {
    // Pull visible <button> text from the raw markup (comment-stripped), then check for generic labels.
    const stripped = `${ctx.markup || ''}\n${ctx.html || ''}`.replace(/<!--[\s\S]*?-->/g, ' ');
    const texts = [];
    for (const m of stripped.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
        const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (t)
            texts.push(t);
    }
    if (!texts.length)
        return (0, check_context_1.notApplicable)('no button text to evaluate');
    const generic = texts.filter((l) => /^(submit|ok|okay|click here|button|go|next|done|yes|no)$/i.test(l.trim()));
    return generic.length === 0
        ? (0, check_context_1.pass)('button labels are specific')
        : (0, check_context_1.fail)(`generic button label(s): ${generic.slice(0, 3).join(', ')}`, [], 'Use action-specific labels ("Save changes", "Send invite") so the purpose is clear out of context');
};
exports.checkButtonLabelSpecific = checkButtonLabelSpecific;
exports.PAGE_QUALITY_CHECKS = {
    'perf/image-dimensions': exports.checkImageDimensions,
    'perf/image-lazy-load': exports.checkImageLazyLoad,
    'polish/text-overflow-strategy': exports.checkTextOverflowStrategy,
    'theming/color-scheme-dark': exports.checkColorSchemeDark,
    'a11y/chart-text-fallback': exports.checkChartA11yFallback,
    'a11y/button-label-specific': exports.checkButtonLabelSpecific,
};
//# sourceMappingURL=page-quality-checks.js.map