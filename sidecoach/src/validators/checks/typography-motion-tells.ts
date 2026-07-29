// sidecoach/src/validators/checks/typography-motion-tells.ts
//
// Three STATIC AI-slop tells that our detector was blind to while a competing tool caught all
// three on the identical canary (benchmark/fixtures/canary/canary.html, measured 2026-07-29):
// overused-font, single-font, bounce-easing.
//
// All three are CSS-text tells, so they belong in the static lane, not behind a render. Each one
// reports a DEFECT location (the declaration itself), because each fires on the PRESENCE of
// something rather than the absence of it.
//
// Every rule here has a mutation control in benchmark/fixtures/mutation/: a fixture proven to
// trip it and a clean fixture proven not to. A detector nobody has watched fail is not a
// detector, it is a hope.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss } from '../check-context';
import { locate, locateWhere } from '../source-locator';

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
const OVERUSED_FAMILIES: readonly string[] = [
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
function familiesIn(value: string): string[] {
  return value
    .split(',')
    .map((f) => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean);
}

/** Family names named in a Google Fonts href (`?family=Space+Grotesk:wght@400`). */
function googleFamilies(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(GOOGLE_FONTS_RE)) {
    for (const fam of m[0].matchAll(/family=([^&:]+)/gi)) {
      out.push(decodeURIComponent(fam[1]).replace(/\+/g, ' ').trim().toLowerCase());
    }
  }
  return out;
}

const isOverused = (family: string): boolean => OVERUSED_FAMILIES.includes(family);

/** Every non-generic family the collected source commits to, from CSS and Google Fonts hrefs. */
function committedFamilies(ctx: ProductCheckContext): Set<string> {
  const out = new Set<string>();
  for (const m of (ctx.cssText || '').matchAll(FONT_FAMILY_RE)) {
    for (const f of familiesIn(m[1])) if (!GENERIC_FAMILIES.has(f)) out.add(f);
  }
  for (const f of googleFamilies(`${ctx.cssText || ''}\n${ctx.markup || ''}`)) {
    if (!GENERIC_FAMILIES.has(f)) out.add(f);
  }
  return out;
}

// ---------------------------------------------------------------------------
// overused-font
// ---------------------------------------------------------------------------
export const checkOverusedFont = (ctx: ProductCheckContext): RuleVerdict => {
  const declared = committedFamilies(ctx);
  // No declared family at all is not "no overused font" - it is nothing to judge. N/A, never a
  // pass, so a CSS-free file cannot be certified as having chosen well.
  if (declared.size === 0) {
    if (!hasCss(ctx)) return inconclusive('no CSS source collected to read font-family from', 'unreadable_input');
    return notApplicable('no font-family or webfont link declared');
  }
  const hits = [...declared].filter(isOverused);
  if (hits.length === 0) return pass(`declared typefaces are not in the overused set (${[...declared].join(', ')})`);
  return fail(
    `overused typeface: ${hits.join(', ')} - a default or generated-UI convergence face, so it reads as unchosen`,
    [
      ...locateWhere(ctx, FONT_FAMILY_RE, (decl) => familiesIn(decl.replace(/^[^:]*:/, '')).some(isOverused), 'css', 4),
      ...locateWhere(ctx, GOOGLE_FONTS_RE, (href) => googleFamilies(href).some(isOverused), 'both', 2),
    ].slice(0, 5),
    'Pick a typeface with a point of view, or state in DESIGN.md why this one is the deliberate choice',
  );
};

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

export const checkSingleFont = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected to read font-family from', 'unreadable_input');
  const declared = committedFamilies(ctx);
  if (declared.size === 0) return notApplicable('no font-family or webfont link declared');
  const lineCount = `${ctx.cssText || ''}\n${ctx.markup || ''}`.split('\n').length;
  if (lineCount < SINGLE_FONT_MIN_LINES) {
    return notApplicable(`source is ${lineCount} lines, under the ${SINGLE_FONT_MIN_LINES}-line floor for a page-level type-pairing judgment`);
  }
  if (declared.size > 1) return pass(`${declared.size} typefaces declared (${[...declared].join(', ')})`);
  const only = [...declared][0];
  return fail(
    `only one typeface is used for the whole page (${only}) - no display/body pairing`,
    locate(ctx, FONT_FAMILY_RE, 'css', 3),
    'A single family works when weight and size contrast carry the hierarchy; otherwise pair a display face with a body face',
  );
};

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

function isOvershoot(bezier: string): boolean {
  const m = new RegExp(CUBIC_BEZIER_RE.source, 'i').exec(bezier);
  if (!m) return false;
  const y1 = parseFloat(m[2]);
  const y2 = parseFloat(m[4]);
  return [y1, y2].some((y) => Number.isFinite(y) && (y < -OVERSHOOT_TOLERANCE || y > 1 + OVERSHOOT_TOLERANCE));
}

export const checkBounceEasing = (ctx: ProductCheckContext): RuleVerdict => {
  const text = `${ctx.cssText || ''}\n${ctx.markup || ''}`;
  const hasMotion = /transition\s*:|transition-timing-function|animation\s*:|animation-name|animation-timing-function|@keyframes|\banimate-[a-z]/i.test(text);
  if (!hasMotion) {
    if (!hasCss(ctx)) return inconclusive('no CSS source collected to read easing from', 'unreadable_input');
    return notApplicable('no transition or animation declared');
  }
  const reasons: string[] = [];
  const locations: string[] = [];

  const overshoots = [...text.matchAll(new RegExp(CUBIC_BEZIER_RE.source, 'gi'))]
    .map((m) => m[0])
    .filter(isOvershoot);
  if (overshoots.length) {
    reasons.push(`overshoot easing ${[...new Set(overshoots)].slice(0, 2).join(', ')}`);
    locations.push(...locateWhere(ctx, CUBIC_BEZIER_RE, isOvershoot, 'both', 3));
  }
  const named = [...text.matchAll(new RegExp(BOUNCE_NAME_RE.source, 'gi'))].map((m) => m[0].trim());
  if (named.length) {
    reasons.push(`bounce/elastic animation (${[...new Set(named)].slice(0, 2).join(', ')})`);
    locations.push(...locate(ctx, BOUNCE_NAME_RE, 'both', 3));
  }
  if (BOUNCE_UTILITY_RE.test(text)) {
    reasons.push('animate-bounce utility class');
    locations.push(...locate(ctx, BOUNCE_UTILITY_RE, 'markup', 2));
  }
  if (reasons.length === 0) return pass('no bounce or elastic easing');
  return fail(
    `bounce/elastic easing: ${reasons.join('; ')} - real objects decelerate, they do not spring back`,
    [...new Set(locations)].slice(0, 5),
    'Use a decelerating curve (ease-out quart/quint/expo, e.g. cubic-bezier(0.16, 1, 0.3, 1)) so motion settles instead of overshooting',
  );
};

export const TYPOGRAPHY_MOTION_TELL_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'anti-pattern/overused-font': checkOverusedFont,
  'anti-pattern/single-font': checkSingleFont,
  'anti-pattern/bounce-easing': checkBounceEasing,
};
