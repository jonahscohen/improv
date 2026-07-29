// sidecoach/src/validators/checks/page-quality-checks.ts
//
// Page-quality checks (Stage 2 convergence): the genuinely-strong DOM-evidence rules cherry-picked from
// ExtendedDomainValidator's Tier-2 set (the rest - JS-keyword proxies, always-pass, NLP heuristics - were
// retired with the theater). Each reads collected markup/CSS (comment-stripped) and is N/A when its target is
// absent, so a page without the relevant element is never failed. DOM-visible evidence only (img attrs, CSS
// properties, aria/structural fallbacks, visible button text) - reliable regardless of framework.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, failAnchor, notApplicable } from '../check-context';
import { locate, locateWhere } from '../source-locator';

// The <img> tag pattern the checks below both count and locate. ONE source so the located
// lines cannot describe a different set of tags than the count in the message.
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const hasExplicitDims = (tag: string): boolean =>
  ((/\bwidth\s*=/i.test(tag) && /\bheight\s*=/i.test(tag)) || /aspect-ratio/i.test(tag));

// Comment-stripped lowercased haystack (HTML + JS/CSS block + JS line comments; line strip guarded against ':'
// so https:// survives) - same registry-quality posture as forms-checks.
const hay = (ctx: ProductCheckContext): string =>
  `${ctx.markup || ''}\n${ctx.cssText || ''}\n${(ctx as { html?: string }).html || ''}`
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n\r]*/g, '$1 ')
    .toLowerCase();

// IMGPERF_001: <img> needs explicit width+height (or aspect-ratio) to reserve space and avoid layout shift (CLS).
export const checkImageDimensions = (ctx: ProductCheckContext): RuleVerdict => {
  const imgs = hay(ctx).match(/<img\b[^>]*>/g);
  if (!imgs || imgs.length === 0) return notApplicable('no <img> elements');
  const missing = imgs.filter((t) => !hasExplicitDims(t));
  return missing.length === 0
    ? pass('images declare explicit dimensions (or aspect-ratio)')
    : fail(
      `${missing.length} image(s) lack width+height/aspect-ratio (causes layout shift)`,
      locateWhere(ctx, IMG_TAG_RE, (tag) => !hasExplicitDims(tag), 'markup'),
      'Set width and height (or aspect-ratio) on <img> so the browser reserves space before load',
    );
};

// IMGPERF_002: below-the-fold images should lazy-load.
export const checkImageLazyLoad = (ctx: ProductCheckContext): RuleVerdict => {
  const h = hay(ctx);
  const imgs = h.match(/<img\b[^>]*>/g);
  if (!imgs || imgs.length === 0) return notApplicable('no <img> elements');
  // PER-IMAGE, not "any image lazy" (Codex P1): the FIRST <img> (document order) is
  // treated as the likely above-the-fold/LCP hero and may load eagerly; every LATER
  // image that is neither loading="lazy" nor explicitly prioritized (fetchpriority="high")
  // should be lazy. So a page of eager below-the-fold images is no longer masked by one
  // lazy image elsewhere.
  const eager = imgs.filter((tag, i) => {
    if (/loading\s*=\s*["']?lazy/.test(tag)) return false;       // already deferred
    if (/fetchpriority\s*=\s*["']?high/.test(tag)) return false; // intentionally eager
    return i > 0;                                                // first image exempt
  });
  const isEager = (tag: string, i: number): boolean => {
    if (/loading\s*=\s*["']?lazy/i.test(tag)) return false;
    if (/fetchpriority\s*=\s*["']?high/i.test(tag)) return false;
    return i > 0;
  };
  return eager.length === 0
    ? pass('below-the-fold images use loading="lazy" (the first/hero image may load eagerly)')
    : fail(
      `${eager.length} below-the-fold image(s) not lazy-loaded`,
      locateWhere(ctx, IMG_TAG_RE, isEager, 'markup'),
      'Add loading="lazy" to images past the first/hero (or fetchpriority="high" if intentionally eager) so below-the-fold images defer their fetch',
    );
};

// CONTENT_002: overflow-prone text containers need a wrap/clamp strategy.
export const checkTextOverflowStrategy = (ctx: ProductCheckContext): RuleVerdict => {
  const h = hay(ctx);
  if (!/text-overflow:\s*ellipsis|\btruncate\b|line-clamp/.test(h)) return notApplicable('no overflow-prone text container');
  return /overflow-wrap|word-break|break-words|line-clamp|-webkit-line-clamp|text-wrap/.test(h)
    ? pass('long text has a wrap/clamp strategy')
    // ANCHOR: the overflow-prone container that needs the strategy. Nothing at this line is
    // itself wrong, so it must not be reported as a defect site.
    : failAnchor(
      'text container can overflow without a wrap/clamp strategy',
      locate(ctx, /text-overflow\s*:\s*ellipsis|\btruncate\b|line-clamp/i, 'both', 3),
      'Add overflow-wrap/word-break or a line-clamp so long strings (URLs, emails) do not break the layout',
    );
};

// DARKMODE_001: when the page expresses dark-mode intent, declare the color-scheme: dark CSS property (NOT the
// prefers-color-scheme media feature) so native form controls/scrollbars adapt.
export const checkColorSchemeDark = (ctx: ProductCheckContext): RuleVerdict => {
  const h = hay(ctx);
  if (!/prefers-color-scheme|dark-mode|darkmode|data-theme|\.dark\b|theme.*dark/.test(h)) return notApplicable('no dark-mode intent');
  return /(?<!prefers-)color-scheme\s*:\s*[^;}]*\bdark\b/.test(h)
    ? pass('color-scheme: dark declared for native control theming')
    : failAnchor(
      'dark mode without a color-scheme: dark declaration',
      locate(ctx, /prefers-color-scheme|dark-mode|darkmode|data-theme|\.dark\b/i, 'both', 3),
      'Add color-scheme: dark (or light dark) so native controls, scrollbars, and form fields adapt',
    );
};

// CHART_003: a chart needs a text or table fallback for assistive tech.
export const checkChartA11yFallback = (ctx: ProductCheckContext): RuleVerdict => {
  const h = hay(ctx);
  // Detect a chart STRUCTURALLY (canvas, a charting-library marker, or a chart/graph CLASS) - NOT the prose word
  // "chart"/"graph", which appears in ordinary copy. Under-detecting a bare unclassed <svg> is acceptable; a bare
  // svg is indistinguishable from an icon, and a false N/A is far better than failing every page that says "chart".
  if (!/<canvas\b|recharts|chart\.?js|chartjs|highcharts|echarts|amcharts|\bnivo\b|\bvisx\b|class=["'][^"']*\b(chart|graph|sparkline|plot)/.test(h)) {
    return notApplicable('no chart/visualization');
  }
  return /<table\b|<figcaption\b|aria-label=|aria-describedby=|sr-only|visually-hidden|role=["']table["']/.test(h)
    ? pass('chart provides a text/table fallback')
    : failAnchor(
      'chart has no text/table fallback for assistive tech',
      locate(ctx, /<canvas\b|recharts|highcharts|echarts|amcharts|class=["'][^"']*\b(?:chart|graph|sparkline|plot)/i, 'both', 3),
      'Add a <table>, aria-label/aria-describedby, or an sr-only summary so the data is reachable without sight',
    );
};

// COPY_003: button labels should be specific, not generic ("submit"/"click here"/"ok").
export const checkButtonLabelSpecific = (ctx: ProductCheckContext): RuleVerdict => {
  // Pull visible <button> text from the raw markup (comment-stripped), then check for generic labels.
  const stripped = `${ctx.markup || ''}\n${(ctx as { html?: string }).html || ''}`.replace(/<!--[\s\S]*?-->/g, ' ');
  const texts: string[] = [];
  for (const m of stripped.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (t) texts.push(t);
  }
  if (!texts.length) return notApplicable('no button text to evaluate');
  const GENERIC_LABEL_RE = /^(submit|ok|okay|click here|button|go|next|done|yes|no)$/i;
  const generic = texts.filter((l) => GENERIC_LABEL_RE.test(l.trim()));
  return generic.length === 0
    ? pass('button labels are specific')
    : fail(
      `generic button label(s): ${generic.slice(0, 3).join(', ')}`,
      // DEFECT: the offending <button> itself. Same normalization the count uses, so the
      // located tags are exactly the counted ones.
      locateWhere(ctx, /<button\b[^>]*>([\s\S]*?)<\/button>/gi,
        (tag) => GENERIC_LABEL_RE.test(tag.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()), 'markup'),
      'Use action-specific labels ("Save changes", "Send invite") so the purpose is clear out of context',
    );
};

export const PAGE_QUALITY_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'perf/image-dimensions': checkImageDimensions,
  'perf/image-lazy-load': checkImageLazyLoad,
  'polish/text-overflow-strategy': checkTextOverflowStrategy,
  'theming/color-scheme-dark': checkColorSchemeDark,
  'a11y/chart-text-fallback': checkChartA11yFallback,
  'a11y/button-label-specific': checkButtonLabelSpecific,
};
