"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPOGRAPHY_MOTION_TELL_CHECKS = exports.checkBounceEasing = exports.checkSingleFont = exports.checkOverusedFont = void 0;
const check_context_1 = require("../check-context");
const source_locator_1 = require("../source-locator");
/**
 * Typefaces so widely defaulted-to that they no longer signal a choice.
 *
 * OURS, not borrowed. Two distinct reasons a face is on this list, and both are stated because
 * a list of names with no rationale rots into cargo cult:
 *
 *  - SYSTEM/BROWSER DEFAULTS (arial, helvetica, times new roman, courier new): reaching for one
 *    is usually the absence of a decision rather than a decision.
 *  - GENERATED-UI CONVERGENCE (inter, roboto, open sans, lato, montserrat, poppins, nunito,
 *    raleway, work sans, dm sans, manrope, plus jakarta sans, space grotesk, geist, fraunces,
 *    instrument serif, sora, outfit, figtree, epilogue): each wave of AI-generated interfaces
 *    lands on the same short list, which is exactly what makes a page look generated.
 *
 * This is a TASTE tell, declared `minor`. It is never a blocker: a deliberate Inter is a
 * legitimate call, and the finding's job is to make the reader confirm the choice was made.
 */
const OVERUSED_FAMILIES = [
    'arial', 'helvetica', 'helvetica neue', 'times new roman', 'courier new', 'verdana', 'tahoma',
    'inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'nunito', 'raleway',
    'work sans', 'dm sans', 'manrope', 'plus jakarta sans', 'space grotesk', 'geist',
    'geist sans', 'geist mono', 'mona sans', 'fraunces', 'instrument sans', 'instrument serif',
    'recoleta', 'sora', 'outfit', 'figtree', 'epilogue',
];
/** CSS generic families are not typefaces - they must never count as "a font was chosen". */
const GENERIC_FAMILIES = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
    'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'inherit', 'initial', 'unset', 'revert',
    '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'emoji', 'math', 'fangsong',
]);
const FONT_FAMILY_RE = /font-family\s*:\s*([^;{}]+)/gi;
const GOOGLE_FONTS_RE = /fonts\.googleapis\.com\/css2?\?[^"'\s)<>]*/gi;
/** Normalize one comma-separated font-family value into lowercase family names. */
function familiesIn(value) {
    return value
        .split(',')
        .map((f) => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
        .filter(Boolean);
}
/** Family names named in a Google Fonts href (`?family=Space+Grotesk:wght@400`). */
function googleFamilies(text) {
    const out = [];
    for (const m of text.matchAll(GOOGLE_FONTS_RE)) {
        for (const fam of m[0].matchAll(/family=([^&:]+)/gi)) {
            out.push(decodeURIComponent(fam[1]).replace(/\+/g, ' ').trim().toLowerCase());
        }
    }
    return out;
}
const isOverused = (family) => OVERUSED_FAMILIES.includes(family);
/** Every non-generic family the collected source commits to, from CSS and Google Fonts hrefs. */
function committedFamilies(ctx) {
    const out = new Set();
    for (const m of (ctx.cssText || '').matchAll(FONT_FAMILY_RE)) {
        for (const f of familiesIn(m[1]))
            if (!GENERIC_FAMILIES.has(f))
                out.add(f);
    }
    for (const f of googleFamilies(`${ctx.cssText || ''}\n${ctx.markup || ''}`)) {
        if (!GENERIC_FAMILIES.has(f))
            out.add(f);
    }
    return out;
}
// ---------------------------------------------------------------------------
// overused-font
// ---------------------------------------------------------------------------
const checkOverusedFont = (ctx) => {
    const declared = committedFamilies(ctx);
    // No declared family at all is not "no overused font" - it is nothing to judge. N/A, never a
    // pass, so a CSS-free file cannot be certified as having chosen well.
    if (declared.size === 0) {
        if (!(0, check_context_1.hasCss)(ctx))
            return (0, check_context_1.inconclusive)('no CSS source collected to read font-family from', 'unreadable_input');
        return (0, check_context_1.notApplicable)('no font-family or webfont link declared');
    }
    const hits = [...declared].filter(isOverused);
    if (hits.length === 0)
        return (0, check_context_1.pass)(`declared typefaces are not in the overused set (${[...declared].join(', ')})`);
    return (0, check_context_1.fail)(`overused typeface: ${hits.join(', ')} - a default or generated-UI convergence face, so it reads as unchosen`, [
        ...(0, source_locator_1.locateWhere)(ctx, FONT_FAMILY_RE, (decl) => familiesIn(decl.replace(/^[^:]*:/, '')).some(isOverused), 'css', 4),
        ...(0, source_locator_1.locateWhere)(ctx, GOOGLE_FONTS_RE, (href) => googleFamilies(href).some(isOverused), 'both', 2),
    ].slice(0, 5), 'Pick a typeface with a point of view, or state in DESIGN.md why this one is the deliberate choice');
};
exports.checkOverusedFont = checkOverusedFont;
// ---------------------------------------------------------------------------
// single-font
// ---------------------------------------------------------------------------
/**
 * Minimum collected CSS+markup lines before a single family is read as a MISSING PAIRING.
 *
 * A small file legitimately uses one face; a whole page carrying exactly one non-generic family
 * is the tell. 20 lines is the same floor the comparison tool uses, adopted deliberately rather
 * than tuned here: this session has no labeled corpus for this rule, and inventing a threshold
 * that happens to fire on our own canary would be fitting to the test. When a corpus exists,
 * sweep it and record the operating point the way subjective-rendered-scanner.ts does.
 */
const SINGLE_FONT_MIN_LINES = 20;
const checkSingleFont = (ctx) => {
    if (!(0, check_context_1.hasCss)(ctx))
        return (0, check_context_1.inconclusive)('no CSS source collected to read font-family from', 'unreadable_input');
    const declared = committedFamilies(ctx);
    if (declared.size === 0)
        return (0, check_context_1.notApplicable)('no font-family or webfont link declared');
    const lineCount = `${ctx.cssText || ''}\n${ctx.markup || ''}`.split('\n').length;
    if (lineCount < SINGLE_FONT_MIN_LINES) {
        return (0, check_context_1.notApplicable)(`source is ${lineCount} lines, under the ${SINGLE_FONT_MIN_LINES}-line floor for a page-level type-pairing judgment`);
    }
    if (declared.size > 1)
        return (0, check_context_1.pass)(`${declared.size} typefaces declared (${[...declared].join(', ')})`);
    const only = [...declared][0];
    return (0, check_context_1.fail)(`only one typeface is used for the whole page (${only}) - no display/body pairing`, (0, source_locator_1.locate)(ctx, FONT_FAMILY_RE, 'css', 3), 'A single family works when weight and size contrast carry the hierarchy; otherwise pair a display face with a body face');
};
exports.checkSingleFont = checkSingleFont;
// ---------------------------------------------------------------------------
// bounce-easing
// ---------------------------------------------------------------------------
/**
 * Overshoot tolerance on a cubic-bezier control point.
 *
 * A cubic-bezier's y values are the PROGRESS axis. y outside [0,1] means the animation travels
 * past its destination and comes back - the bounce/elastic character. The 0.1 slack keeps a
 * value that only grazes the boundary (a deliberate, barely-perceptible overshoot, or a rounding
 * artifact) from firing.
 */
const OVERSHOOT_TOLERANCE = 0.1;
const CUBIC_BEZIER_RE = /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/gi;
// Named bounce/elastic character, in a CSS animation shorthand or a utility class.
const BOUNCE_NAME_RE = /animation(?:-name|-timing-function)?\s*:\s*[^;{}]*\b(?:bounce|elastic|wobble|jiggle|spring|rubber)[\w-]*/gi;
const BOUNCE_UTILITY_RE = /\banimate-bounce\b/g;
function isOvershoot(bezier) {
    const m = new RegExp(CUBIC_BEZIER_RE.source, 'i').exec(bezier);
    if (!m)
        return false;
    const y1 = parseFloat(m[2]);
    const y2 = parseFloat(m[4]);
    return [y1, y2].some((y) => Number.isFinite(y) && (y < -OVERSHOOT_TOLERANCE || y > 1 + OVERSHOOT_TOLERANCE));
}
const checkBounceEasing = (ctx) => {
    const text = `${ctx.cssText || ''}\n${ctx.markup || ''}`;
    const hasMotion = /transition\s*:|transition-timing-function|animation\s*:|animation-name|animation-timing-function|@keyframes|\banimate-[a-z]/i.test(text);
    if (!hasMotion) {
        if (!(0, check_context_1.hasCss)(ctx))
            return (0, check_context_1.inconclusive)('no CSS source collected to read easing from', 'unreadable_input');
        return (0, check_context_1.notApplicable)('no transition or animation declared');
    }
    const reasons = [];
    const locations = [];
    const overshoots = [...text.matchAll(new RegExp(CUBIC_BEZIER_RE.source, 'gi'))]
        .map((m) => m[0])
        .filter(isOvershoot);
    if (overshoots.length) {
        reasons.push(`overshoot easing ${[...new Set(overshoots)].slice(0, 2).join(', ')}`);
        locations.push(...(0, source_locator_1.locateWhere)(ctx, CUBIC_BEZIER_RE, isOvershoot, 'both', 3));
    }
    const named = [...text.matchAll(new RegExp(BOUNCE_NAME_RE.source, 'gi'))].map((m) => m[0].trim());
    if (named.length) {
        reasons.push(`bounce/elastic animation (${[...new Set(named)].slice(0, 2).join(', ')})`);
        locations.push(...(0, source_locator_1.locate)(ctx, BOUNCE_NAME_RE, 'both', 3));
    }
    if (BOUNCE_UTILITY_RE.test(text)) {
        reasons.push('animate-bounce utility class');
        locations.push(...(0, source_locator_1.locate)(ctx, BOUNCE_UTILITY_RE, 'markup', 2));
    }
    if (reasons.length === 0)
        return (0, check_context_1.pass)('no bounce or elastic easing');
    return (0, check_context_1.fail)(`bounce/elastic easing: ${reasons.join('; ')} - real objects decelerate, they do not spring back`, [...new Set(locations)].slice(0, 5), 'Use a decelerating curve (ease-out quart/quint/expo, e.g. cubic-bezier(0.16, 1, 0.3, 1)) so motion settles instead of overshooting');
};
exports.checkBounceEasing = checkBounceEasing;
exports.TYPOGRAPHY_MOTION_TELL_CHECKS = {
    'anti-pattern/overused-font': exports.checkOverusedFont,
    'anti-pattern/single-font': exports.checkSingleFont,
    'anti-pattern/bounce-easing': exports.checkBounceEasing,
};
//# sourceMappingURL=typography-motion-tells.js.map