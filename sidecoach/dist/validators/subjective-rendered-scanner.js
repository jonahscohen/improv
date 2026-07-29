"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARQUEE_MIN_COUNT = exports.MARQUEE_MIN_X_PX = exports.MARQUEE_MIN_X_PCT = exports.IHT_MIN_COUNT = exports.GLOW_MIN_COUNT = exports.GLOW_MIN_AREA = exports.GLOW_BLUR_MIN_PX = exports.DOTGRID_MIN_COUNT = exports.DOTGRID_TILE_MAX_PX = exports.FVO_OVERFLOW_MAX_PX = exports.FVO_OVERFLOW_MIN_PX = exports.FVO_TOP_MAX_PX = exports.FVO_VH_FRAC = exports.TUO_MIN_COUNT = exports.STRIPE_MIN_COUNT = exports.STRIPE_MIN_DIM = exports.TBWS_MIN_COUNT = exports.TBWS_PANEL_MIN_H = exports.TBWS_PANEL_MIN_W = exports.TBWS_RATIO_MIN = exports.TBWS_SPREAD_MIN_PX = exports.TBWS_BORDER_MAX_PX = exports.SUB11_MIN_CHARS = exports.H1_VW_RATIO = exports.ALLCAPS_SHARE_MIN = exports.TRACKING_SHARE_MIN = exports.TYPO_MIN_CONTENT_CHARS = exports.SUB11_MAX_PX = exports.ALLCAPS_MIN_CASED = exports.ALLCAPS_MAX_BODY_PX = exports.ALLCAPS_MIN_RUN_CHARS = exports.TRACKING_EXTREME_EM = exports.DEFAULT_STACK_GROUND_GATED = exports.DEFAULT_TYPEFACE_GROUND_BRAND_MISMATCH = exports.DEFAULT_TYPEFACE_GROUND_DEFAULT_STACK = exports.TYPEFACE_MIN_CONTENT_CHARS = exports.BRAND_PRESENCE_MIN = exports.DEFAULT_STACK_SHARE = exports.BUZZ_DENSITY_THRESHOLD = exports.BUZZ_MIN_DISTINCT_PEAK = exports.SUBJECTIVE_RULES = void 0;
exports.stripScripts = stripScripts;
exports.inPageSubjective = inPageSubjective;
exports.inPageNestedCards = inPageNestedCards;
exports.nestedCardsFindingFromScore = nestedCardsFindingFromScore;
exports.inPageBuzzword = inPageBuzzword;
exports.buzzwordFindingFromScore = buzzwordFindingFromScore;
exports.inPageTypeface = inPageTypeface;
exports.typefaceFindingFromScore = typefaceFindingFromScore;
exports.typefaceGroundOf = typefaceGroundOf;
exports.inPageTypographyExtremes = inPageTypographyExtremes;
exports.typographyExtremesFindingsFromScore = typographyExtremesFindingsFromScore;
exports.inPageStructural = inPageStructural;
exports.structuralFindingsFromScore = structuralFindingsFromScore;
exports.inPageMotionMarker = inPageMotionMarker;
exports.motionMarkerFindingsFromScore = motionMarkerFindingsFromScore;
exports.analyzeHtmlOnBrowserSubjective = analyzeHtmlOnBrowserSubjective;
exports.scanSubjectiveRendered = scanSubjectiveRendered;
/**
 * The playwright chromium driver, resolved AT LAUNCH TIME instead of at module load.
 *
 * `import { chromium } from 'playwright'` at module scope cost every consumer 134ms even when
 * no browser was ever launched (measured 2026-07-29: it was the single largest cost in a static
 * scan of bin/sidecoach-detect.js, which never renders). The `import type` above keeps every
 * `typeof chromium.launch` annotation in this file working and is erased at runtime.
 *
 * FAIL-CLOSED: a missing or broken playwright now throws from inside the launch path, where the
 * existing try/catch turns it into `available: false` with a reason - rather than crashing the
 * whole module at import. That is strictly safer: an unavailable scan is still never clean.
 */
function chromiumDriver() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('playwright').chromium;
}
exports.SUBJECTIVE_RULES = [
    'tiny-text', 'nested-cards', 'marketing-buzzword', 'default-typeface',
    'extreme-negative-tracking', 'all-caps-body', 'oversized-h1', 'sub-11px-ui',
    // Stage 4c structural taste classes.
    'thin-border-wide-shadow', 'repeating-stripe-gradients', 'text-under-overlay', 'first-viewport-overflow',
    'decorative-dot-grid', 'soft-radial-glow', 'image-hover-transform',
    // Stage 4d detectable motion/marker classes.
    'marquee',
];
function stripScripts(html) {
    return String(html)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<script\b[^>]*\/?>/gi, '');
}
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageSubjective() {
    const findings = [];
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    // VISUAL visibility: rendered to sighted users. Excludes display:none, visibility:hidden, cumulative opacity 0,
    // sub-/1px boxes, off-screen, and sr-only (clipped/1px/indented) text. Mirrors the objective scanner's hardened
    // predicate so tiny sr-only text is never counted as visible tiny-text.
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const rects = el.getClientRects();
        if (!rects.length)
            return false;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false;
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false;
        if (parseFloat(cs.textIndent) <= -999)
            return false;
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]);
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false;
        return true;
    }
    // own (direct) text of an element, with whitespace collapsed (source indentation/newlines between inline
    // children must NOT inflate the rendered char count - Codex review).
    function ownText(el) {
        let t = '';
        for (const n of Array.from(el.childNodes))
            if (n.nodeType === 3 && n.textContent)
                t += n.textContent;
        return t.replace(/\s+/g, ' ').trim();
    }
    // text that is painted invisibly (transparent fill / near-zero alpha) must not count - it isn't rendered to a
    // sighted user, and transparent fill is also how gradient-text is done (Codex review).
    function paintedInvisible(cs) {
        const fill = cs.webkitTextFillColor;
        const colors = [cs.color, fill].filter(Boolean);
        return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m)
            return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
    }
    // ---- tiny-text: CONTENT-REGION small-text DENSITY (readability-grounded, precision-first) ----
    // "tiny-text" is a HOLISTIC "strains readability" judgment, not a min-font-size: it tracks how MUCH of the
    // page's content text is rendered small (the labeler's signal: "many/much ... very small"). We measure the
    // PROPORTION of CONTENT text (by character amount) rendered at/below the small threshold. CONTENT excludes
    // peripheral footer/nav, so an isolated small footer on top of a readable body does NOT trigger (that is the
    // standard "absent" pattern). Standard-grounded: 16px is the comfortable body standard; <=14px is below it,
    // and a SUBSTANTIAL share of content text that small strains reading. Precision guards: a minimum content
    // size (ignore near-empty pages) and a proportion floor (one small caption is not enough).
    // SMALL_PX = 13: 14px is a COMMON READABLE body size (GitHub, many apps), so a readable-14px page must NOT
    // fire (precision, co-equal with recall - Codex High#1 + lead ruling). The operating point is set by the
    // synthetic readable-14px NEGATIVE fixture + the readability standard, NOT by held-out/milestone feedback.
    // At/below 13px is below that readable floor; a substantial share that small strains reading.
    const SMALL_PX = 13;
    const PROPORTION_MIN = 0.15; // >= 15% of content text (by char amount) small => a substantial, straining share
    const MIN_CONTENT_CHARS = 200; // ignore near-empty pages (avoid a 1-element page reading as 100%)
    // PERIPHERAL chrome (excluded): footer/nav AND their ARIA-role equivalents + asides/menus (Codex review: UI
    // chrome is often 12-14px; counting it over-fires). Excludes <footer>/<nav>/<aside>/<menu> and role=
    // navigation/contentinfo/complementary/menubar/menu. Deliberately NOT <header>/role=banner (the hero lives
    // there and is content).
    const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
    const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
    const peripheral = (el) => {
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase()))
                return true;
            const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
            if (role && PERIPHERAL_ROLES.has(role))
                return true;
        }
        return false;
    };
    let contentChars = 0, smallChars = 0;
    const offenders = [];
    for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
        const text = ownText(el);
        if (!text || !visuallyVisible(el) || peripheral(el))
            continue;
        const cs0 = getComputedStyle(el);
        if (paintedInvisible(cs0))
            continue;
        const fontPx = parseFloat(cs0.fontSize);
        if (!(fontPx > 0))
            continue;
        const c = text.length;
        contentChars += c;
        if (fontPx <= SMALL_PX) {
            smallChars += c;
            offenders.push(el);
        }
    }
    const proportion = contentChars > 0 ? smallChars / contentChars : 0;
    if (contentChars >= MIN_CONTENT_CHARS && proportion >= PROPORTION_MIN) {
        // ONE finding per page. tiny-text is a PAGE-LEVEL proportion judgment - the threshold is a share of the
        // page's content text, not a property of any single element - so the previous emission repeated the same
        // page verdict once per offending element (measured: 20 identical lines carrying the same parenthetical on
        // a single real page). The page-level finding now carries the offender COUNT and one representative
        // element, which is the evidence a reader actually needs.
        const rep = offenders[0];
        const repPx = Math.round(parseFloat(getComputedStyle(rep).fontSize) * 10) / 10;
        findings.push({
            rule: 'tiny-text', severity: 'warning', selector: sel(rep),
            detail: `${Math.round(proportion * 100)}% of content text <=${SMALL_PX}px across ${offenders.length} element(s) (e.g. ${sel(rep)} at ${repPx}px)`,
        });
    }
    // nested-cards moved to its own single-source scorer (inPageNestedCards + nestedCardsFindingFromScore),
    // matching the inPageBuzzword / inPageTypeface split, so the calibration harness sweeps the SHIPPING geometry
    // instead of a reimplementation. It is no longer computed here.
    // marketing-buzzword is computed by the SEPARATE self-contained inPageBuzzword() below (the SINGLE source
    // for the taxonomy + weighted-density math, shared by the production scan AND the calibration harness so the
    // harness measures EXACTLY what ships). Its finding is merged in by the Node render wrappers via the threshold.
    return findings;
}
/**
 * nested-cards: a card-like container holding a meaningfully-smaller card-like container.
 *
 * Rubric: "cards inside other cards - layered bordered containers holding sub-containers." A card READS as a
 * discrete panel: rounded corners + STRONG card treatment (a visible BORDER or a SHADOW) of real panel size,
 * with children. The bg-distinct signal was dropped earlier (it over-fired on incidental tinted layout regions).
 *
 * KNOWN LIMIT: nesting inside a product-mockup IMAGE (raster) is DOM-invisible to any DOM detector - never OCR.
 *
 * Returns the SCORE only; the firing thresholds are applied in Node by nestedCardsFindingFromScore, so the
 * calibration harness sweeps EXACTLY what ships (the inPageBuzzword / buzzwordFindingFromScore contract).
 */
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageNestedCards() {
    const CARD_MIN_W = 100, CARD_MIN_H = 60, CARD_RADIUS = 4, INNER_MAX_AREA_FRAC = 0.85;
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    function treatment(el) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden')
            return null;
        const box = el.getBoundingClientRect();
        if (box.width < CARD_MIN_W || box.height < CARD_MIN_H)
            return null;
        if (!el.firstElementChild)
            return null; // a container, not a leaf
        const radius = Math.max(parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0, parseFloat(cs.borderBottomLeftRadius) || 0, parseFloat(cs.borderBottomRightRadius) || 0);
        if (radius < CARD_RADIUS)
            return null;
        const border = parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none';
        const shadow = !!cs.boxShadow && cs.boxShadow !== 'none';
        if (!border && !shadow)
            return null; // strong card treatment only
        return { border, shadow, radius };
    }
    const cards = [];
    for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
        const t = treatment(el);
        if (t)
            cards.push({ el, t });
    }
    const byEl = new Map();
    for (const c of cards)
        byEl.set(c.el, c.t);
    const viewportWidth = Math.max(1, document.documentElement ? document.documentElement.clientWidth : 1280);
    const pairs = [];
    for (const { el: outer, t: ot } of cards) {
        const oBox = outer.getBoundingClientRect();
        const oArea = oBox.width * oBox.height;
        if (!(oArea > 0))
            continue;
        // The SMALLEST qualifying inner card is the most card-like evidence (a near-full-size wrapper child is the
        // weak case), so pick it rather than the first in document order.
        let best = null;
        for (const d of Array.from(outer.querySelectorAll('*'))) {
            if (!byEl.has(d))
                continue;
            const dBox = d.getBoundingClientRect();
            const dArea = dBox.width * dBox.height;
            if (!(dArea > 0) || dArea >= INNER_MAX_AREA_FRAC * oArea)
                continue;
            if (!best || dArea < best.area)
                best = { el: d, area: dArea };
        }
        if (!best)
            continue;
        const it = byEl.get(best.el);
        const iBox = best.el.getBoundingClientRect();
        pairs.push({
            outerSelector: sel(outer), innerSelector: sel(best.el),
            outerW: Math.round(oBox.width), outerH: Math.round(oBox.height),
            innerW: Math.round(iBox.width), innerH: Math.round(iBox.height),
            areaFrac: best.area / oArea,
            outerRadius: ot.radius, innerRadius: it.radius,
            outerBorder: ot.border, outerShadow: ot.shadow,
            innerBorder: it.border, innerShadow: it.shadow,
            outerViewportWidthFrac: oBox.width / viewportWidth,
        });
        if (pairs.length >= 200)
            break;
    }
    return { cardCount: cards.length, viewportWidth, pairs };
}
// nested-cards operating point: UNCHANGED, and that is a RESULT, not an omission.
//
// A retune was attempted on 2026-07-28 and REJECTED by its own held-out measurement. The record, because the
// next person to look at this will otherwise repeat it:
//
//   Attempted guard: an outer box spanning most of the VIEWPORT WIDTH reads as a SECTION or page shell, not a
//   card, so its nested children are ordinary layout. Best plateau at outerViewportWidthFrac <= 0.80.
//
//   | population              | fires | OLD P          | NEW P          |
//   |-------------------------|-------|----------------|----------------|
//   | dev (48, 27 pos)        | 10->8 | 0.900 (9/10)   | 0.875 (7/8)    |
//   | candidates (90, 7 pos)  | 5->2  | 0.400 (2/5)    | 0.500 (1/2)    |
//   | TUNE (138, 34 pos)      | 15->10| 0.733 (11/15)  | 0.800 (8/10)   |
//   | HELD-OUT (37, 9 pos)    | 4->2  | 0.750 (3/4)    | 0.500 (1/2)    |
//
//   The tuning population said +0.067. The untouched held-out said -0.250: the guard removed TWO true positives
//   and ZERO false positives there, which is the opposite of what it was for. Direction is inconsistent across
//   all three corpora (dev down, candidates up, held-out down), which is what noise looks like.
//
// WHY NOT PICK A DIFFERENT POINT: the class fires 4 times on the whole held-out corpus. At that denominator a
// one-page difference moves precision by 0.25, so NO operating point can be validated out of sample here -
// including the one that ships. The corpus is too small to support a nested-cards retune, and saying that is
// more useful than a number nobody can defend. To make this class tunable, the corpus needs materially more
// labeled positives (the 9 in held-out and 7 in candidates are the binding constraint, not the sweep).
//
// The 0.85 inner-area cut inside inPageNestedCards is the ONLY geometric filter, exactly as before. Sweeping it
// to 0.60 changed nothing on all 138 real pages, and requiring BORDER (not shadow) on both boxes lowered
// precision at every point measured - both recorded here so neither is retried as if it were untested.
//
// WHAT DID CHANGE: the detector moved into this single-source score/threshold split (so it is sweepable without
// a reimplementation), and it now emits ONE page-level finding instead of up to 20. Neither alters WHICH PAGES
// FIRE - verified page-for-page against the pre-change predicate on all 176 corpus pages by
// eval/nested-cards-equivalence.mjs.
//
// The EVIDENCE PAYLOAD is deliberately NOT claimed identical, and the difference is worth naming: the old code
// took the FIRST qualifying descendant, this one takes the SMALLEST, because a near-full-size wrapper child is
// the weakest evidence of a card-in-card. So a finding's selector and detail can differ from the old output even
// though the fire decision cannot. Pair collection is also capped at 200 per page.
/** Node-side: turn a nested-cards score into ONE page-level finding (or null). The ONE place the production
 *  threshold is applied; the calibration harness sweeps the same pairs.
 *
 *  ONE FINDING PER PAGE. nested-cards is a PAGE-LEVEL judgment, so the previous emission (one finding per
 *  offending outer card, capped at 20) restated a single verdict up to 20 times. The count and a representative
 *  pair carry the same evidence in one line. */
function nestedCardsFindingFromScore(s) {
    const pairs = s.pairs || [];
    if (pairs.length < 1)
        return null;
    const rep = pairs[0];
    return {
        rule: 'nested-cards', severity: 'warning', selector: rep.outerSelector,
        detail: `${pairs.length} card-in-card nesting(s) on the page (e.g. ${rep.outerSelector} ${rep.outerW}x${rep.outerH} holding ${rep.innerSelector} ${rep.innerW}x${rep.innerH}, ${Math.round(rep.areaFrac * 100)}% of its area)`,
    };
}
/**
 * marketing-buzzword (v2): the SINGLE SOURCE of the buzzword taxonomy + weighted-density computation, serialized
 * into the browser by page.evaluate. Returns the SCORE only - the firing THRESHOLD (BUZZ_DENSITY_THRESHOLD) is
 * applied in Node by BOTH the production scan (buzzwordFindingFromScore) AND the calibration harness, so the harness
 * sweeps EXACTLY what ships (no reimplementation - the integrity fix).
 *
 * The page LEANS on generic marketing buzzwords rather than concrete specifics - a HOLISTIC density over the content
 * copy (v1's tight prominent-cluster overfit a homogeneous corpus and collapsed on the diverse held-out). SCOPE =
 * all VISIBLE, non-peripheral content text, EXCLUDING testimonial/quote/review/case-study regions (customer social
 * proof != the brand's own copy). SCORE = (sum of VACUITY-tier weights over ALL occurrences) / content_words * 100,
 * tiers PEAK 4 / STRONG 2 / MILD 0.5 (v3 reweight). WHY vacuity-weighting: v2's FP mode (frozen p=0.333) = pages
 * that USE marketing vocabulary CONCRETELY (nasa "groundbreaking discoveries" = real science; onepassword "powerful
 * security" = a real feature) rather than leaning on empty fluff. The dev-FP analysis showed the FPs fire on
 * concrete-prone STRONG/MILD words (modern/advanced/enterprise-grade/ai-powered) with ~0 pure-hype PEAK terms (FP
 * peak=0.33 vs TP peak=1.36), while the TP fluff leans on PEAK clichés (seamless/supercharge/revolution/world-class).
 * So PEAK (content-free hype, impossible to use concretely) is upweighted and the concrete-prone MILD tier is
 * heavily discounted. QUALIFY guard (precision): a page firing WITHOUT any pure-hype/strong term (MILD-only product
 * descriptors) is not "leaning on buzzwords" - require >=1 STRONG/PEAK term. Each term is a bounded regex matched
 * with non-consuming lookarounds (counts ALL occurrences incl. adjacent repeats) - linear, ReDoS-safe.
 */
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageBuzzword() {
    // INLINE copy of the exported BUZZ_MIN_DISTINCT_PEAK (an in-page function cannot import; same self-contained
    // rule as inPageMotionMarker's thresholds). buzzword-gate-vocabulary.test.ts asserts the two stay identical,
    // so drift is a test failure rather than a silent detector change.
    const BUZZ_MIN_DISTINCT_PEAK = 2;
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    // VISUAL visibility: the SAME hardened predicate as inPageSubjective (each in-page fn must be self-contained for
    // page.evaluate, so a verbatim duplicate is correct). Excludes display:none, visibility:hidden, cumulative
    // opacity 0, sub-/1px boxes, off-screen, and sr-only (clipped/1px-overflow/indented) text - so a11y sr-only text
    // never corrupts the buzzword density (numerator AND denominator).
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const rects = el.getClientRects();
        if (!rects.length)
            return false;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false;
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false;
        if (parseFloat(cs.textIndent) <= -999)
            return false;
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]);
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false;
        return true;
    }
    function ownText(el) {
        let t = '';
        for (const n of Array.from(el.childNodes))
            if (n.nodeType === 3 && n.textContent)
                t += n.textContent;
        return t.replace(/\s+/g, ' ').trim();
    }
    // text painted invisibly (transparent fill / near-zero alpha) must not count - it isn't rendered to a sighted
    // user (parity with inPageSubjective). Applied per-element in the scope loop below.
    function paintedInvisible(cs) {
        const fill = cs.webkitTextFillColor;
        const colors = [cs.color, fill].filter(Boolean);
        return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m)
            return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
    }
    const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
    const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
    const peripheral = (el) => {
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase()))
                return true;
            const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
            if (role && PERIPHERAL_ROLES.has(role))
                return true;
        }
        return false;
    };
    const QUOTE_TAGS = new Set(['blockquote', 'q', 'cite', 'figure']);
    const QUOTE_RE = /testimonial|quote|review|case[-_ ]?stud|customer[-_ ]?stor/i;
    const inQuote = (el) => {
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (QUOTE_TAGS.has((n.tagName || '').toLowerCase()))
                return true;
            if (QUOTE_RE.test((n.getAttribute('class') || '') + ' ' + (n.id || '')))
                return true;
        }
        return false;
    };
    // [key, pattern, weight]. THE single taxonomy. PEAK 4 / STRONG 2 / MILD 0.5 (v3 vacuity reweight).
    const BUZZ_TAX = [
        ['revolutionary', 'revolutionary', 4], ['revolutionize', 'revolutioniz(?:e|es|ed|ing)', 4], ['revolution', 'revolution', 4],
        ['game-changing', 'game[- ]chang(?:ing|er|ers)', 4], ['world-class', 'world[- ]class', 4], ['best-in-class', 'best[- ]in[- ]class', 4],
        ['best-in-breed', 'best[- ]in[- ]breed', 4], ['cutting-edge', 'cutting[- ]edge', 4], ['bleeding-edge', 'bleeding[- ]edge', 4],
        ['next-gen', 'next[- ]gen(?:eration)?', 4], ['state-of-the-art', 'state[- ]of[- ]the[- ]art', 4], ['unparalleled', 'unparalleled', 4],
        ['unrivaled', 'unrivall?ed', 4], ['industry-leading', 'industry[- ]leading', 4], ['groundbreaking', 'groundbreaking', 4],
        ['paradigm-shift', 'paradigm[- ]shift(?:ing)?', 4], ['disruptive', 'disrupt(?:ive|ion)', 4], ['supercharge', 'supercharg(?:e|es|ed|ing)', 4],
        ['turbocharge', 'turbocharg(?:e|es|ed|ing)', 4], ['frictionless', 'frictionless', 4], ['seamless', 'seamless(?:ly)?', 4],
        ['effortless', 'effortless(?:ly)?', 4], ['magical', 'magical', 4], ['invincible', 'invincible', 4], ['limitless', 'limitless', 4],
        ['unstoppable', 'unstoppable', 4], ['lightning-fast', 'lightning[- ]fast', 4], ['blazing', 'blazing(?:[- ]fast)?', 4],
        ['10x', '10x', 4], ['mission-critical', 'mission[- ]critical', 4], ['unlock', 'unlock(?:s|ed|ing)?', 4], ['unleash', 'unleash(?:es|ed|ing)?', 4],
        ['powerful', 'powerful(?:ly)?', 2], ['innovative', 'innovat(?:e|es|ed|ing|ive|ion|ions)', 2], ['transformative', 'transformat(?:ive|ion)', 2],
        ['transform', 'transform(?:s|ed|ing)?', 2], ['reimagine', 'reimagin(?:e|es|ed|ing)', 2], ['redefine', 'redefin(?:e|es|ed|ing)', 2],
        ['empower', 'empower(?:s|ed|ing|ment)?', 2], ['elevate', 'elevat(?:e|es|ed|ing)', 2], ['accelerate', 'accelerat(?:e|es|ed|ing|ion)', 2],
        ['future-proof', 'future[- ]proof', 2], ['all-in-one', 'all[- ]in[- ]one', 2], ['end-to-end', 'end[- ]to[- ]end', 2],
        ['turnkey', 'turnkey', 2], ['holistic', 'holistic', 2], ['synergy', 'synerg(?:y|ies|ize|istic)', 2], ['leverage', 'leverag(?:e|es|ed|ing)', 2],
        ['streamline', 'streamlin(?:e|es|ed|ing)', 2], ['harness', 'harness(?:es|ed|ing)?', 2], ['amplify', 'amplif(?:y|ies|ied)', 2],
        ['ai-powered', 'ai[- ](?:powered|driven|native|first)', 2], ['next-level', 'next[- ]level', 2], ['built-for-scale', 'built[- ]for[- ]scale', 2],
        ['enterprise-grade', 'enterprise[- ]grade', 2], ['purpose-built', 'purpose[- ]built', 2], ['delightful', 'delightful', 2],
        ['at-scale', 'at[- ]scale', 2], ['compounding-growth', 'compounding[- ]growth', 2], ['out-of-the-box', 'out[- ]of[- ]the[- ]box', 2],
        ['powered-by-ai', 'powered[- ]by[- ]ai', 2],
        ['advanced', 'advanced', 0.5], ['modern', 'modern', 0.5], ['robust', 'robust', 0.5], ['scalable', 'scalab(?:le|ility)', 0.5],
        ['performant', 'performant', 0.5], ['intuitive', 'intuitive(?:ly)?', 0.5], ['sophisticated', 'sophisticated', 0.5],
        ['comprehensive', 'comprehensive', 0.5], ['flexible', 'flexible', 0.5], ['dynamic', 'dynamic', 0.5], ['smart', 'smart', 0.5],
        ['ambitious', 'ambitious', 0.5], ['optimize', 'optimiz(?:e|es|ed|ing|ation)', 0.5], ['unified', 'unified', 0.5], ['integrated', 'integrated', 0.5],
        ['automate', 'automat(?:e|ed|ion)', 0.5], ['intelligent', 'intelligent', 0.5], ['productivity', 'productivity', 0.5],
        ['efficient', 'efficien(?:t|cy)', 0.5], ['premium', 'premium', 0.5],
    ];
    const BUZZ_MIN_WORDS = 40;
    const buzzEls = [];
    let buzzText = '';
    for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
        const text = ownText(el);
        if (!text || !visuallyVisible(el) || peripheral(el) || inQuote(el))
            continue;
        if (paintedInvisible(getComputedStyle(el)))
            continue;
        buzzText += ' ' + text;
        buzzEls.push(el);
    }
    const buzzNorm = ' ' + buzzText.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const words = buzzNorm.trim() ? buzzNorm.trim().split(' ').filter(Boolean).length : 0;
    let weighted = 0, distinctTerms = 0, hasStrongOrPeak = false;
    const matched = [];
    let peakOccurrences = 0, strongOccurrences = 0, mildOccurrences = 0, distinctPeak = 0, distinctStrong = 0;
    const termCounts = [];
    for (const [key, pat, w] of BUZZ_TAX) {
        // non-consuming lookarounds: counts ALL occurrences (incl. adjacent repeats), unlike a space-consuming match.
        const m = buzzNorm.match(new RegExp('(?<= )(?:' + pat + ')(?= )', 'g'));
        if (m && m.length) {
            weighted += w * m.length;
            distinctTerms++;
            matched.push(key);
            if (w >= 2)
                hasStrongOrPeak = true;
            termCounts.push({ term: key, tier: w, count: m.length });
            if (w >= 4) {
                peakOccurrences += m.length;
                distinctPeak++;
            }
            else if (w >= 2) {
                strongOccurrences += m.length;
                distinctStrong++;
            }
            else {
                mildOccurrences += m.length;
            }
        }
    }
    const density = words >= BUZZ_MIN_WORDS ? (weighted / words) * 100 : 0;
    const peakDensity = words >= BUZZ_MIN_WORDS ? (peakOccurrences / words) * 100 : 0;
    // v4 QUALIFY GATE (precision). v3 required >= 1 STRONG/PEAK term, which any page describing real engineering
    // clears ("powerful", "transform", "accelerate", "end-to-end" are all ordinary technical vocabulary). The
    // measured FP set was MDN, Rust, Django, Kubernetes and Vercel docs - every one of them qualified on STRONG
    // alone. PEAK terms are the ones that CANNOT be used concretely (seamless, revolutionary, world-class,
    // supercharge, game-changing): a page leaning on marketing language reaches for them, and a page describing
    // engineering does not. The gate therefore requires PEAK evidence: >= BUZZ_MIN_DISTINCT_PEAK distinct PEAK
    // terms, i.e. the hype is a REGISTER rather than one stray word in a sentence about latency.
    const qualifies = distinctPeak >= BUZZ_MIN_DISTINCT_PEAK;
    const effectiveDensity = qualifies ? density : 0;
    let selector;
    for (const el of buzzEls) {
        const t = ' ' + ownText(el).toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ') + ' ';
        if (BUZZ_TAX.some(([, pat]) => new RegExp('(?<= )(?:' + pat + ')(?= )').test(t))) {
            selector = sel(el);
            break;
        }
    }
    return {
        density, effectiveDensity, words, weighted, distinctTerms, hasStrongOrPeak, matched, selector,
        peakOccurrences, strongOccurrences, mildOccurrences, distinctPeak, distinctStrong, peakDensity, termCounts,
    };
}
// v4 QUALIFY GATE threshold: distinct PEAK terms required before a page can fire at all. The exported copy; the
// in-page scorer carries an inline duplicate (it must be self-contained for page.evaluate) and
// buzzword-gate-vocabulary.test.ts asserts they never drift apart.
exports.BUZZ_MIN_DISTINCT_PEAK = 2;
// Firing threshold for marketing-buzzword (vacuity-weighted density per 100 content words). UNCHANGED at 0.75.
//
// The 2026-07-28 precision retune deliberately left this number alone and moved the QUALIFY GATE instead
// (BUZZ_MIN_DISTINCT_PEAK, above). That was a measured choice, not a conservative one. Sweeping the gate against
// the density threshold on the tuning population (dev 48 + candidates 90, 39 labeled positives) showed the gate
// carrying the entire precision gain and the threshold carrying almost none: at gate 2, thresholds 0.50 / 0.75 /
// 1.00 score P 0.750 / 0.800 / 0.800 with recall flat, so the decision rests on a plateau rather than on a fitted
// number. Higher thresholds do reach P 0.909 at 2.00 - on ONE false positive out of eleven fires, a knife edge of
// exactly the kind that produced the collapse this retune exists to fix. Dropping the MILD tier out of the
// numerator entirely was also swept and scores IDENTICALLY once the gate is in place, which is the direct
// evidence that the gate, not the weighting, is the fix.
//
// MEASURED, gate 2 / threshold 0.75, precision first with recall reported honestly:
//   TUNE     (dev 48 + candidates 90, 39 pos): P 0.600 (33/55) -> 0.800 (12/15), R 0.846 -> 0.308
//   HELD-OUT (buzzword-heldout 37, 19 pos)   : P 0.783 (18/23) -> 1.000 (8/8),   R 0.947 -> 0.421
// The held-out was not consulted while choosing the point. Recall roughly halves; that is the accepted trade.
exports.BUZZ_DENSITY_THRESHOLD = 0.75;
/** Node-side: turn a buzzword score into a marketing-buzzword finding (or null). The ONE place the production
 * threshold is applied; the calibration harness sweeps the same effectiveDensity. */
function buzzwordFindingFromScore(s) {
    if (s.effectiveDensity < exports.BUZZ_DENSITY_THRESHOLD)
        return null;
    return { rule: 'marketing-buzzword', severity: 'warning', selector: s.selector, detail: `buzzword density ${s.density.toFixed(1)}/100 words (e.g. ${s.matched.slice(0, 8).join(', ')})` };
}
/**
 * default-typeface: the page's CONTENT text is not set in a typeface anyone CHOSE.
 *
 * ONE page-level judgment with two grounds, both expressed as a share of content text:
 *   (A) default stack   - the content text computes to a bare system/generic stack (the vocabulary in
 *                         reference-data.ts SYSTEM_FONT_STACK_FAMILIES), i.e. no typeface was chosen at all.
 *                         The historically over-used monoculture faces (Arial, Helvetica, Times, Georgia,
 *                         Verdana, Segoe UI) live IN that vocabulary - they are the families you get when
 *                         nobody chose, which is exactly what "monoculture" means for a rendered read.
 *   (B) brand mismatch  - a committed family IS known (caller-supplied, from PRODUCT.md / DESIGN.md) but it
 *                         barely paints the content text, so the commitment did not land.
 *
 * MEASUREMENT BASIS = the computed `font-family` STACK, not the painted face. This is deliberate and it is
 * the only honest basis here: the hermetic render aborts external subresources, so a page that loads its
 * typeface from a CDN paints in the fallback no matter how well it is built. Scoring the painted face would
 * therefore fire on nearly every real page as an artifact of the harness rather than a defect of the page.
 * The declared stack is render-independent and is what the page actually asked for.
 *
 * HONEST EXCLUSION (deliberately NOT detected): "over-used Google-font monoculture" in the Inter/Poppins
 * sense. Inter and Poppins are RECOMMENDED entries in our own catalog (reference-data.ts loadFontCatalog),
 * and 13 of the 48 real dev-corpus pages lead with Inter as a deliberate, well-executed choice. Firing on
 * them would be a low-precision taste guess about a family that is frequently the right answer - the
 * category the plan says to mark out-of-scope rather than ship. Recorded here so no later pass claims this
 * detector covers it.
 *
 * Returns the SCORE only; the firing thresholds are applied in Node by typefaceFindingFromScore, so the
 * calibration harness sweeps EXACTLY what ships (the inPageBuzzword / buzzwordFindingFromScore contract).
 */
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageTypeface() {
    // SINGLE-SOURCE vocabulary: the concrete expansion of the font catalog's `system_fonts` entry. An in-page
    // function cannot import, so this is a verbatim copy of reference-data.ts SYSTEM_FONT_STACK_FAMILIES;
    // typeface-vocabulary.test.ts asserts the two lists stay identical (drift is a test failure, not a silent
    // detector change).
    const SYSTEM_FAMILIES = new Set([
        'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
        'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'math', 'emoji', 'fangsong',
        '-apple-system', 'blinkmacsystemfont',
        'segoe ui', 'helvetica', 'helvetica neue', 'arial', 'arial black',
        'times', 'times new roman', 'georgia', 'courier', 'courier new',
        'verdana', 'tahoma', 'trebuchet ms', 'palatino', 'palatino linotype', 'book antiqua',
        'lucida grande', 'lucida sans unicode', 'geneva', 'menlo', 'monaco', 'consolas',
        'liberation sans', 'liberation serif', 'liberation mono',
        'dejavu sans', 'dejavu serif', 'dejavu sans mono', 'ms sans serif', 'ms serif',
        'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji',
    ]);
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    // The SAME hardened visibility predicate as inPageSubjective (each in-page fn must be self-contained for
    // page.evaluate, so a verbatim duplicate is correct).
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const rects = el.getClientRects();
        if (!rects.length)
            return false;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false;
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false;
        if (parseFloat(cs.textIndent) <= -999)
            return false;
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]);
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false;
        return true;
    }
    function ownText(el) {
        let t = '';
        for (const n of Array.from(el.childNodes))
            if (n.nodeType === 3 && n.textContent)
                t += n.textContent;
        return t.replace(/\s+/g, ' ').trim();
    }
    function paintedInvisible(cs) {
        const fill = cs.webkitTextFillColor;
        const colors = [cs.color, fill].filter(Boolean);
        return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m)
            return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
    }
    // CONTENT scope: footer/nav/aside/menu chrome is excluded exactly as in tiny-text - UI chrome routinely
    // rides the system stack on purpose, and counting it would over-fire on well-typeset pages.
    const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
    const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
    const peripheral = (el) => {
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase()))
                return true;
            const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
            if (role && PERIPHERAL_ROLES.has(role))
                return true;
        }
        return false;
    };
    // QUOTE-AWARE font-family splitter. A naive split(',') is not CSS-correct: a legal quoted family name may
    // CONTAIN a comma, and splitting first turns `"Arial, Sans"` (one custom family) into a leading token of
    // `arial` - a default-vocabulary hit and therefore a false positive on a page that chose a typeface
    // (Codex review P2). Walking the declaration character by character and only honouring commas OUTSIDE a
    // quoted run keeps such a name whole. Quote characters are consumed as delimiters, so the emitted token is
    // already unquoted; each token is then whitespace-collapsed and lowercased to match the vocabulary.
    function splitFamilies(decl) {
        const out = [];
        let cur = '', quote = '';
        for (const ch of String(decl)) {
            if (quote) {
                if (ch === quote)
                    quote = '';
                else
                    cur += ch;
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }
            if (ch === ',') {
                out.push(cur);
                cur = '';
                continue;
            }
            cur += ch;
        }
        out.push(cur);
        return out.map((f) => f.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean);
    }
    const normFamily = (f) => f.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').toLowerCase();
    let contentChars = 0, defaultStackChars = 0;
    const tally = new Map();
    let defaultSelector;
    // SCOPE: document.body itself plus its descendants. Including body is deliberate - a bare page can put text
    // directly in <body>, and omitting it would under-count exactly the unstyled pages this class exists to
    // catch (Codex review P2).
    // KNOWN LIMIT (documented, not silently accepted): text inside a SHADOW ROOT is invisible to this walk, as
    // it is to every other class on this scanner. A page that renders its content entirely in web components
    // would be scored on its light-DOM shell alone. Rather than special-case shadow traversal for one class and
    // diverge from tiny-text / marketing-buzzword, the limit is recorded here so no later pass claims coverage
    // this detector does not have.
    const scope = document.body ? [document.body, ...Array.from(document.body.querySelectorAll('*'))] : [];
    for (const el of scope) {
        const text = ownText(el);
        if (!text || !visuallyVisible(el) || peripheral(el))
            continue;
        const cs = getComputedStyle(el);
        if (paintedInvisible(cs))
            continue;
        const stack = splitFamilies(cs.fontFamily || '');
        const chars = text.length;
        contentChars += chars;
        const lead = stack[0] || '';
        if (lead)
            tally.set(lead, (tally.get(lead) || 0) + chars);
        // THE LEADING FAMILY IS THE DECISION. A stack resolves left to right, so the first family is what the
        // page actually asked for and everything after it is fallback. If the lead is system vocabulary, the
        // page's first choice was a default; if the lead is a chosen face, a typeface was picked no matter what
        // the fallbacks are.
        // (An earlier draft required EVERY family in the stack to be system vocabulary. That was wrong and the
        // calibration harness caught it: the canonical system-font boilerplate -
        //   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
        // - carries Roboto mid-stack, and Roboto is deliberately NOT in the vocabulary because it is a real
        // downloadable typeface pages choose on purpose. The conjunction therefore scored the single most common
        // default stack on the web as "chosen". Leading-family is both simpler and correct, and it keeps Roboto's
        // exclusion working the way it was meant to: it only matters when Roboto LEADS, which is a real choice.)
        if (!lead || SYSTEM_FAMILIES.has(lead)) {
            defaultStackChars += chars;
            if (!defaultSelector)
                defaultSelector = sel(el);
        }
    }
    // Families the page itself commits to via @font-face. Cross-origin stylesheets throw on cssRules access;
    // that is caught per-sheet so an unreadable sheet degrades this DETAIL field instead of failing the scan.
    const declared = [];
    for (const sheet of Array.from(document.styleSheets)) {
        let rules = [];
        try {
            rules = Array.from(sheet.cssRules || []);
        }
        catch {
            continue;
        }
        for (const rule of rules) {
            const style = rule.style;
            if (!style || rule.constructor?.name !== 'CSSFontFaceRule')
                continue;
            const fam = normFamily(style.getPropertyValue('font-family') || '');
            if (fam && declared.indexOf(fam) === -1)
                declared.push(fam);
        }
    }
    const families = Array.from(tally.entries()).map(([family, chars]) => ({ family, chars })).sort((a, b) => b.chars - a.chars).slice(0, 25);
    const dominant = families[0];
    return {
        contentChars,
        defaultStackChars,
        defaultStackShare: contentChars > 0 ? defaultStackChars / contentChars : 0,
        families,
        dominantFamily: dominant ? dominant.family : undefined,
        dominantShare: dominant && contentChars > 0 ? dominant.chars / contentChars : 0,
        declaredFamilies: declared.slice(0, 25),
        defaultSelector,
    };
}
// DEFAULT_STACK_SHARE = 0.75. Frozen on PRINCIPLE, confirmed (not set) by the dev corpus; never on held-out.
// PRINCIPLE: the finding claims "this page has no chosen typeface", and that claim is only true when the
// default stack is the page's DOMINANT typographic voice by a clear margin - not a bare majority. A page that
// sets even a quarter of its content text in a chosen face HAS made a typographic decision, and a code block
// on ui-monospace or a data table on system-ui is a normal, deliberate part of a well-typeset page. 0.75 is
// that margin: three quarters of the content text must carry no chosen typeface before the page reads as
// unstyled. It also satisfies the precision floor by construction - a single element (or a handful) on a
// fallback stack can never reach it.
// DEV CONFIRMATION (48 externally-sourced real shipped pages, char-weighted, via eval/typeface-calibrate.mjs):
// the MAXIMUM default-stack share anywhere in the corpus is 0.058 (inngest); the next are 0.038 (monday) and
// 0.036 (tailscale), and 40 of 48 pages sit at 0.000. The frozen 0.75 therefore sits ~13x above the worst real
// page and fires on ZERO of them.
// HONEST READING OF THE SWEEP: the score distribution is BIMODAL - real pages land in 0.000-0.058, pages with
// no chosen typeface land at 1.000 - so every threshold from 0.30 to 0.95 scores identically (R 1.000 /
// P 1.000) on the current data. The sweep therefore CONFIRMS that 0.75 sits inside a wide safe band; it does
// NOT empirically discriminate 0.75 from its neighbours, and nobody should quote it as if it had. The number
// is set by the principle above and by nothing else.
exports.DEFAULT_STACK_SHARE = 0.75;
// BRAND_PRESENCE_MIN = 0.25, the complement of the same principle. When a committed family is genuinely
// KNOWN, that family must carry at least a quarter of the content text for the commitment to have landed.
// Below that it is a decorative accent at best, and the page is really set in something else.
// DEV CONFIRMATION (typeface-calibrate ground-B sweep, 48 real pages, each scanned against its OWN dominant
// family as a must-stay-silent negative and against a family it provably does not use as a must-fire
// positive): unlike ground A's sweep this one DISCRIMINATES. 0.05-0.40 give P 1.000 / R 1.000; 0.50 produces
// the first false positive (a real page whose committed family legitimately carries under half the content),
// and 0.75 produces ten. The frozen 0.25 therefore sits a full step below the first real-world failure while
// still catching a family that never lands.
exports.BRAND_PRESENCE_MIN = 0.25;
// A page with almost no text cannot support a page-level typographic judgment (a 1-element page would read
// as 100% of anything). Same guard, same value, as tiny-text's MIN_CONTENT_CHARS.
exports.TYPEFACE_MIN_CONTENT_CHARS = 200;
// Ground tags carried at the head of the finding detail, so a consumer can phrase the right verdict.
exports.DEFAULT_TYPEFACE_GROUND_DEFAULT_STACK = 'default-stack';
exports.DEFAULT_TYPEFACE_GROUND_BRAND_MISMATCH = 'brand-mismatch';
// GROUND A IS GATED OFF (2026-07-28). Its precision on real pages is UNDEFINED, not low - and that distinction
// is the reason for the gate.
//
// What the corpus actually contains for this class:
//   - The ONLY default-typeface labels anywhere are the 23-page A5a set: 11 synthetic fixtures + 12 real pages.
//   - All 5 labeled POSITIVES are synthetic fixtures authored alongside the detector (p01-p05). It scores
//     P 1.000 / R 1.000 on that set, which measures that it can satisfy its own specification.
//   - All 12 labeled REAL pages are NEGATIVES, and it correctly stays silent on every one (0 fires / 48 on the
//     whole dev corpus).
//   - It fires on 31 of 90 candidate pages and 9 of 37 held-out pages. NONE of those 40 pages carries a
//     default-typeface label. Not one real-page fire has ever been adjudicated.
//
// So precision = 0 true positives / 0 labeled fires. There is no number, and the 1.000 above cannot stand in for
// one: it is carried entirely by fixtures written to exhibit the defect. Shipping ground A means telling users
// their page has "no chosen typeface" on evidence nobody has checked, on a population (Wikipedia, Hacker News,
// Bootstrap examples, archived pages, internal docs) where the system stack is frequently a deliberate
// typographic decision rather than the absence of one.
//
// TO UN-GATE: label the default-typeface class on real pages that FIRE - the 40 above are the sampling frame -
// with an independent labeler, then measure precision on a held-out slice of them. If it clears the precision
// bar the other taste classes are held to, flip the default. Nothing else un-gates it; another synthetic
// fixture cannot, because synthetic positives are what produced the unfalsifiable 1.000 in the first place.
//
// GROUND B IS UNAFFECTED. It requires a caller-supplied committed family, has its own discriminating dev sweep
// (0.05-0.40 give P/R 1.000; 0.50 produces the first false positive), and cannot fire unsupervised.
exports.DEFAULT_STACK_GROUND_GATED = true;
/** Node-side: turn a typeface score into a default-typeface finding (or null). The ONE place the production
 * thresholds are applied; the calibration harness sweeps the same defaultStackShare. */
function typefaceFindingFromScore(s, opts = {}) {
    if (s.contentChars < exports.TYPEFACE_MIN_CONTENT_CHARS)
        return null;
    const pct = (x) => `${Math.round(x * 100)}%`;
    // (A) default stack. GATED OFF by default (DEFAULT_STACK_GROUND_GATED) - unmeasured on real pages. `ground:`
    // prefixes the detail so the consuming check can phrase the verdict for the ground that actually fired instead
    // of always claiming the default-stack story (Codex review P2).
    const groundAEnabled = opts.enableDefaultStackGround === true || !exports.DEFAULT_STACK_GROUND_GATED;
    if (groundAEnabled && s.defaultStackShare >= exports.DEFAULT_STACK_SHARE) {
        const declared = s.declaredFamilies.length ? `; the page loads ${s.declaredFamilies.slice(0, 3).join(', ')} but the content text does not use it` : '';
        return {
            rule: 'default-typeface', severity: 'warning', selector: s.defaultSelector,
            detail: `${exports.DEFAULT_TYPEFACE_GROUND_DEFAULT_STACK}: ${pct(s.defaultStackShare)} of content text renders on the default system stack (${s.dominantFamily || 'unset'})${declared}`,
        };
    }
    // (B) brand mismatch - only where a committed family is known.
    const brand = (opts.brandFamilies || []).map((f) => f.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').toLowerCase()).filter(Boolean);
    if (brand.length) {
        const brandChars = s.families.filter((f) => brand.indexOf(f.family) !== -1).reduce((n, f) => n + f.chars, 0);
        const brandShare = s.contentChars > 0 ? brandChars / s.contentChars : 0;
        if (brandShare < exports.BRAND_PRESENCE_MIN) {
            return {
                rule: 'default-typeface', severity: 'warning', selector: s.defaultSelector,
                detail: `${exports.DEFAULT_TYPEFACE_GROUND_BRAND_MISMATCH}: the committed family (${opts.brandFamilies.slice(0, 3).join(', ')}) carries only ${pct(brandShare)} of content text; the page renders in ${s.dominantFamily || 'the default stack'} (${pct(s.dominantShare)})`,
            };
        }
    }
    return null;
}
/** Which ground fired, for a consumer that phrases a user-facing verdict. Ground B can fire on a page that is
 *  set in a perfectly good CHOSEN face which simply is not the committed one, so a consumer must not describe
 *  every default-typeface finding as "renders on the default system stack" (Codex review P2). */
function typefaceGroundOf(detail) {
    if (!detail)
        return 'unknown';
    if (detail.startsWith(exports.DEFAULT_TYPEFACE_GROUND_DEFAULT_STACK + ':'))
        return 'default-stack';
    if (detail.startsWith(exports.DEFAULT_TYPEFACE_GROUND_BRAND_MISMATCH + ':'))
        return 'brand-mismatch';
    return 'unknown';
}
// ---- per-element classification constants (the "what counts" definitions, baked into the in-page scorer the way
//      SMALL_PX = 13 is baked into tiny-text). Each is frozen on a perceptual/readability PRINCIPLE. ----
// TRACKING_EXTREME_EM = -0.05. letter-spacing is perceptually a fraction of the font size, so the honest measure
// is letterSpacing/fontSize (the em value the author effectively set). Tasteful optical tightening on display
// type runs -0.02 to -0.03em and is everywhere; -0.04em is the edge. At -0.05em (five percent of the type size
// pulled out from between every pair of glyphs) the crowding is visible on running text, and by -0.07/-0.08em
// letters begin to touch. -0.05 is the conservative "beyond optical tightening, into crowding" bar - it sits
// below the near-universal tasteful band so a well-tracked headline never trips it (precision), and it is the
// per-element definition of "extreme"; the page-level firing threshold is the share below.
exports.TRACKING_EXTREME_EM = -0.05;
// ALLCAPS_MIN_RUN_CHARS = 40 / ALLCAPS_MAX_BODY_PX = 28 / ALLCAPS_MIN_CASED = 20. The rubric scopes all-caps-body
// to "running body text (sentences/paragraphs, not short labels)". The 40-char run guard excludes every short
// label, eyebrow, button, kicker and nav item (the "conventional label spacing which is normal" the rubric sets
// aside); the 28px body-scale cap excludes deliberate all-caps DISPLAY heroes (a poster choice, not body text);
// the 20-cased-letter minimum means a paragraph merely containing an acronym (NASA, API) is not misread as caps.
exports.ALLCAPS_MIN_RUN_CHARS = 40;
exports.ALLCAPS_MAX_BODY_PX = 28;
exports.ALLCAPS_MIN_CASED = 20;
// SUB11_MAX_PX = 10. The class is the plan's "interface text rendered below ~11px" (the tilde is load-bearing).
// The dev corpus DISPROVED a literal 11px floor: 10px (0.625rem / a common Tailwind micro size) is everywhere on
// competently built pages - clerk renders 1421 chars, dub 252, linear 113, calcom 238 of legitimate 10px
// metadata / timestamps / component labels - so firing at 11px is a precision disaster (6/48 real pages). Below
// 10px (9px and smaller) is where interface text is unambiguously too small to read, and it is genuinely rare on
// good pages. Unlike tiny-text (a content-region proportion at <= 13px), this is an ABSOLUTE floor applied to all
// visible text with chrome INCLUDED (SVG diagram labels excluded) - tiny UI chrome below the floor is the target.
exports.SUB11_MAX_PX = 10;
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageTypographyExtremes() {
    // per-element definitions (must be inside the serialized fn - it cannot close over module scope).
    const TRACKING_EXTREME_EM = -0.05;
    const ALLCAPS_MIN_RUN_CHARS = 40;
    const ALLCAPS_MAX_BODY_PX = 28;
    const ALLCAPS_MIN_CASED = 20;
    const SUB11_MAX_PX = 10;
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    // The SAME hardened visibility predicate as inPageSubjective / inPageTypeface (each in-page fn must be
    // self-contained for page.evaluate, so a verbatim duplicate is correct).
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const rects = el.getClientRects();
        if (!rects.length)
            return false;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false;
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false;
        if (parseFloat(cs.textIndent) <= -999)
            return false;
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]);
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false;
        return true;
    }
    function ownText(el) {
        let t = '';
        for (const n of Array.from(el.childNodes))
            if (n.nodeType === 3 && n.textContent)
                t += n.textContent;
        return t.replace(/\s+/g, ' ').trim();
    }
    function paintedInvisible(cs) {
        const fill = cs.webkitTextFillColor;
        const colors = [cs.color, fill].filter(Boolean);
        return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m)
            return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
    }
    // CONTENT scope excludes peripheral chrome exactly as tiny-text / default-typeface do (footer/nav/aside/menu and
    // their ARIA roles) - four of the five classes are content-typography judgments. sub-11px-ui is the deliberate
    // exception: the 11px floor applies to chrome too, so it is measured BEFORE the peripheral guard below.
    const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
    const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
    const peripheral = (el) => {
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase()))
                return true;
            const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
            if (role && PERIPHERAL_ROLES.has(role))
                return true;
        }
        return false;
    };
    // A heading OR any element INSIDE a heading (h1-h6 / role=heading) is excluded from all-caps-body: all-caps is
    // correct, deliberate typography on headings, and all-caps-body is a BODY-copy defect. Walking ANCESTORS (not
    // just the element) is what catches the common `<h2><span>...</span></h2>`, where the text-bearing span is not
    // itself a heading (Codex P1).
    const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
    const inHeading = (el) => {
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (HEADING_TAGS.has((n.tagName || '').toLowerCase()))
                return true;
            const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
            if (role === 'heading')
                return true;
        }
        return false;
    };
    const scope = document.body ? [document.body, ...Array.from(document.body.querySelectorAll('*'))] : [];
    const viewportWidth = window.innerWidth || 1280;
    let contentChars = 0;
    let tightTrackingChars = 0, tightestTrackingEm = 0;
    let trackingSelector;
    let allCapsBodyChars = 0;
    let allCapsSelector;
    let sub11Chars = 0, sub11MinPx = 0;
    let sub11Selector;
    for (const el of scope) {
        const text = ownText(el);
        if (!text || !visuallyVisible(el))
            continue;
        // SVG graphic text (<text>/<tspan> inside a diagram/illustration) is illustrative content, not the page's
        // typographic copy or interface chrome, so it is excluded from EVERY class - it is the DOM-visible cousin of
        // the raster-art honest exclusion, and the dev corpus confirms it (a server-diagram's 5.8px tspan labels are
        // not "interface text rendered too small"). HTML inside <foreignObject> keeps the XHTML namespace and is NOT
        // excluded.
        if (el.namespaceURI === 'http://www.w3.org/2000/svg')
            continue;
        const cs = getComputedStyle(el);
        if (paintedInvisible(cs))
            continue;
        const fontPx = parseFloat(cs.fontSize);
        if (!(fontPx > 0))
            continue;
        const chars = text.length;
        // sub-11px-ui: ALL visible painted text, chrome INCLUDED (measured before the peripheral guard).
        if (fontPx < SUB11_MAX_PX) {
            sub11Chars += chars;
            if (sub11MinPx === 0 || fontPx < sub11MinPx)
                sub11MinPx = fontPx;
            if (!sub11Selector)
                sub11Selector = sel(el);
        }
        // the remaining four classes are CONTENT-scope (peripheral chrome excluded).
        if (peripheral(el))
            continue;
        contentChars += chars;
        // extreme-negative-tracking. letter-spacing:normal computes to the keyword and is 0 tracking.
        const lsRaw = cs.letterSpacing;
        const lsPx = !lsRaw || lsRaw === 'normal' ? 0 : parseFloat(lsRaw);
        if (Number.isFinite(lsPx) && lsPx < 0) {
            const em = lsPx / fontPx;
            if (em < tightestTrackingEm)
                tightestTrackingEm = em;
            if (em <= TRACKING_EXTREME_EM) {
                tightTrackingChars += chars;
                if (!trackingSelector)
                    trackingSelector = sel(el);
            }
        }
        // all-caps-body: long, body-scale, NON-heading runs rendered entirely in capitals. The cased-letter minimum
        // gates BOTH branches, so a long CJK / numeric / punctuation run inside a text-transform:uppercase wrapper
        // (which uppercase does not actually capitalise) is not misread as caps (Codex P2). \p{Lu}/\p{Ll} count only
        // cased letters; the source-caps branch also requires near-zero lowercase (a stray lowercase char tolerated).
        if (!inHeading(el) && fontPx <= ALLCAPS_MAX_BODY_PX && chars >= ALLCAPS_MIN_RUN_CHARS) {
            const upper = (text.match(/\p{Lu}/gu) || []).length;
            const lower = (text.match(/\p{Ll}/gu) || []).length;
            const cased = upper + lower;
            const renderedCaps = cased >= ALLCAPS_MIN_CASED && (cs.textTransform === 'uppercase' || lower / cased <= 0.05);
            if (renderedCaps) {
                allCapsBodyChars += chars;
                if (!allCapsSelector)
                    allCapsSelector = sel(el);
            }
        }
    }
    // oversized-h1: a separate pass so a heading whose text lives in a child (`<h1><span>...</span></h1>`) is still
    // measured. For each visible h1 with rendered text, the h1 size is the MAX computed font-size over the h1 and
    // its text-bearing descendants (the size the reader actually sees).
    let largestH1Px = 0;
    let h1Selector;
    for (const h1 of Array.from(document.body ? document.body.querySelectorAll('h1') : [])) {
        if (!visuallyVisible(h1) || !(h1.textContent || '').trim())
            continue;
        let maxPx = parseFloat(getComputedStyle(h1).fontSize) || 0;
        for (const d of Array.from(h1.querySelectorAll('*'))) {
            if (!ownText(d) || !visuallyVisible(d))
                continue;
            const px = parseFloat(getComputedStyle(d).fontSize) || 0;
            if (px > maxPx)
                maxPx = px;
        }
        if (maxPx > largestH1Px) {
            largestH1Px = maxPx;
            h1Selector = sel(h1);
        }
    }
    const share = (n) => (contentChars > 0 ? n / contentChars : 0);
    return {
        contentChars, viewportWidth,
        tightTrackingChars, tightTrackingShare: share(tightTrackingChars), tightestTrackingEm, trackingSelector,
        allCapsBodyChars, allCapsShare: share(allCapsBodyChars), allCapsSelector,
        largestH1Px, h1Ratio: viewportWidth > 0 ? largestH1Px / viewportWidth : 0, h1Selector,
        sub11Chars, sub11MinPx, sub11Selector,
    };
}
// ---- page-level FIRING thresholds (applied in Node; the calibration harness sweeps exactly these). Each is
//      frozen on principle + the dev signal, NEVER on held-out. ----
// A page with almost no text cannot support a page-level proportion judgment (a 1-element page reads as 100% of
// anything). Same guard, same value, as tiny-text / default-typeface. Applies to the two proportion classes
// (tracking, all-caps); oversized-h1 and sub-11px-ui use absolute measures and do not need it.
exports.TYPO_MIN_CONTENT_CHARS = 200;
// TRACKING_SHARE_MIN = 0.15. Once "extreme" is defined per-element (<= -0.05em), the page fires only when a
// SUBSTANTIAL share of content text is that tightly tracked - extreme tracking as a page-level characteristic, not
// one incidental word. 15% mirrors tiny-text's proportion floor: a single tightly-tracked hero word can never
// reach it, a page that tracks its headings-and-body tight does. Confirmed by the dev corpus (no real page reaches
// it; see the calibration report).
exports.TRACKING_SHARE_MIN = 0.15;
// ALLCAPS_SHARE_MIN = 0.15. A substantial share of content text set as long all-caps body runs. The dev signal
// set this: at 0.10 the detector false-fired on polygon (10.7% of its content is incidental long all-caps labels,
// Codex-labeled NOT all-caps-body); 0.15 clears polygon (P=1.000) while the fixture (94%) fires cleanly. 0.15 also
// aligns with the tracking floor, and reads as "a real page-level all-caps-body characteristic" rather than a few
// incidental long caps runs.
exports.ALLCAPS_SHARE_MIN = 0.15;
// H1_VW_RATIO = 0.09. The h1 firing threshold IS the size ratio (no proportion - the h1 is inherently one
// prominent element). The A5a real-world grade set this: at the old 0.11 (about 141px at 1280) real-world recall
// was 0.000 - every Codex-present real page whose hero IS an <h1> sat below it. The dev-corpus h1 distribution
// shows a clean gap that decides the operating point: the largest <h1> Codex reads as NOT oversized is asana at
// 102px = 0.080, and the only Codex-present real hero that is actually an <h1> is upstash at 128px = 0.100. 0.09
// (115px) is the midpoint of that gap - ~13px of margin on each side - so it catches the genuinely-oversized hero
// while staying above every tasteful real <h1> (asana 0.080) and the tasteful-hero negative fixture (0.069). It
// holds precision exactly (0/36 dev-negative false fires, 0/43 constructed-negative, verified) and preserves the
// constructed-positive fixture (p01 at 0.148 still fires).
// HONEST CEILING (recorded, not papered over): this raises real recall only to ~0.167 (1 of 6 Codex-present real
// pages). The other five are structurally out of reach of ANY <h1>-scoped detector - four (resend/inngest/polygon/
// nasa) render their dominating hero headline as a NON-h1 element (a div or h2), so largestH1Px is 0, and gong's
// h1 (60px = 0.047) is indistinguishable from a dozen tasteful absent h1s at the same size. Catching the four
// no-<h1> heroes would require re-scoping the class from "<h1> size" to "largest hero-scale text in the first
// viewport", which trades this class's identity and adds a big-non-heading-text failure mode (a giant stat or
// wordmark); that is a lead product call, deliberately not taken here. See the A5a taste-revisit results beat.
exports.H1_VW_RATIO = 0.09;
// SUB11_MIN_CHARS = 150. A SUBSTANTIAL body of genuinely-tiny (sub-10px) interface text, not a handful of
// incidental micro-labels. The dev signal set this: after the sub-10px floor + SVG exclusion, the only real page
// still carrying sub-floor text is calcom (113 chars of Framer product-mockup timestamps like "Just now" at 8px);
// 150 clears that incidental amount while the fixture (~295 chars of 9px metadata/legal) fires. 150 chars is about
// a full sentence or a dozen tiny labels - enough to read as "the page systematically sets interface text below
// the legibility floor" rather than one mockup badge. Confirmed 0/48 dev false positives at this point.
exports.SUB11_MIN_CHARS = 150;
/** Node-side: turn a typography-extremes score into 0-5 findings (one page-level verdict per firing class). The
 * ONE place these production thresholds are applied; the calibration harness sweeps the same raw score fields, so
 * the sweep measures exactly what ships (the inPageBuzzword / inPageTypeface contract). */
function typographyExtremesFindingsFromScore(s) {
    const out = [];
    const pct = (x) => `${Math.round(x * 100)}%`;
    const enoughContent = s.contentChars >= exports.TYPO_MIN_CONTENT_CHARS;
    if (enoughContent && s.tightTrackingShare >= exports.TRACKING_SHARE_MIN) {
        out.push({ rule: 'extreme-negative-tracking', severity: 'warning', selector: s.trackingSelector,
            detail: `${pct(s.tightTrackingShare)} of content text is tracked <= ${exports.TRACKING_EXTREME_EM}em (tightest ${s.tightestTrackingEm.toFixed(3)}em); letters crowd` });
    }
    if (enoughContent && s.allCapsShare >= exports.ALLCAPS_SHARE_MIN) {
        out.push({ rule: 'all-caps-body', severity: 'warning', selector: s.allCapsSelector,
            detail: `${pct(s.allCapsShare)} of content text is long-run all-caps body copy (slows reading)` });
    }
    if (s.h1Ratio >= exports.H1_VW_RATIO) {
        out.push({ rule: 'oversized-h1', severity: 'warning', selector: s.h1Selector,
            detail: `h1 renders at ${Math.round(s.largestH1Px)}px, ${pct(s.h1Ratio)} of the ${s.viewportWidth}px viewport width (oversized)` });
    }
    if (s.sub11Chars >= exports.SUB11_MIN_CHARS) {
        out.push({ rule: 'sub-11px-ui', severity: 'warning', selector: s.sub11Selector,
            detail: `${s.sub11Chars} chars of interface text render below ${exports.SUB11_MAX_PX}px (smallest ${s.sub11MinPx.toFixed(1)}px)` });
    }
    return out;
}
// ---- per-element classification constants (the "what counts" definitions, baked into the in-page scorer). Each
//      is frozen on a perceptual/structural PRINCIPLE and duplicated inside inPageStructural (a serialized in-page
//      fn cannot close over module scope). ----
// thin-border-wide-shadow. The DEFECT is a hairline border fighting a wide SOLID shadow halo - redundant double
// elevation that reads muddy. It is NOT "a border and a shadow" (that is normal, and the polish standard even
// prefers shadows to borders): the discriminator is shadow SPREAD (the 4th box-shadow length), which extends a
// solid halo, versus the 0-spread soft blur normal cards use. Border must be genuinely hairline (<= 1.5px) and
// the shadow spread genuinely wide (>= 6px), on a real panel (>= card min), with the spread at least 4x the
// border. Normal cards (1px border, 0-spread blur) never reach it.
exports.TBWS_BORDER_MAX_PX = 1.5;
exports.TBWS_SPREAD_MIN_PX = 6;
exports.TBWS_RATIO_MIN = 4;
exports.TBWS_PANEL_MIN_W = 100;
exports.TBWS_PANEL_MIN_H = 60;
exports.TBWS_MIN_COUNT = 1;
// repeating-stripe-gradients. A "stripe" is definitionally a REPEATING linear-gradient (hard-edged repeated
// bands), NOT a smooth many-stop wash, and it must fill a real 2D AREA (both dims >= STRIPE_MIN_DIM), not a 1px
// divider or graph line. The dev corpus set this: an earlier many-stop-linear-gradient rule fired on 15 gradient
// graph-lines (linear), a code block (posthog) and thin dividers (retool); requiring repeating-linear-gradient +
// a real area clears every one of those false positives while the barber-pole stripe fixture still fires. One
// striped surface is the idiom.
exports.STRIPE_MIN_DIM = 60;
exports.STRIPE_MIN_COUNT = 1;
// text-under-overlay. The scrim layer must carry real translucency (alpha strictly between 0 and 1, or the
// `transparent` keyword) layered with a url() image; a fully-opaque overlay is not a scrim and a 0-alpha layer is
// not painted. One such text-bearing surface is the idiom.
exports.TUO_MIN_COUNT = 1;
// first-viewport-overflow. A top SECTION (starts within FVO_TOP_MAX_PX of the page top, and is NOT body/html)
// that is viewport-height locked (rendered >= FVO_VH_FRAC of the viewport height) AND clips (overflow hidden/clip)
// content that overflows its frame by a bounded amount in [FVO_OVERFLOW_MIN_PX, FVO_OVERFLOW_MAX_PX]. This is the
// "hero doesn't fit its own first screen and gets clipped" defect - not "the page is taller than the viewport"
// (which is every page). MIN excludes a rounding artifact; MAX excludes an element acting as the page scroll
// container (a body/wrapper clipping the whole 2000-11000px page), which is not a clipped hero. Both guards, and
// the body/html exclusion, were set by the dev corpus (loom/redis-docs fired the whole <body>).
exports.FVO_VH_FRAC = 0.85;
exports.FVO_TOP_MAX_PX = 8;
exports.FVO_OVERFLOW_MIN_PX = 64;
exports.FVO_OVERFLOW_MAX_PX = 1200;
// decorative-dot-grid. A radial-gradient (dots) or a two-linear-gradient grid tiled at a SMALL cell (both
// background-size dims <= DOTGRID_TILE_MAX_PX), or any repeating-radial-gradient. The small tile is what makes it
// a repeated decorative FIELD rather than a single large radial wash (which is the glow class). One field is the
// idiom.
exports.DOTGRID_TILE_MAX_PX = 40;
exports.DOTGRID_MIN_COUNT = 1;
// soft-radial-glow. A large soft decoration: a heavy blur() filter (>= GLOW_BLUR_MIN_PX) on a real-area element,
// or a large radial-gradient that fades to transparent on a large element whose tile is NOT small (separating it
// from the dot-grid field). The large area + soft fade is the "ambient glow blob" gesture.
exports.GLOW_BLUR_MIN_PX = 40;
exports.GLOW_MIN_AREA = 200 * 200;
exports.GLOW_MIN_COUNT = 1;
// image-hover-transform. A stylesheet :hover rule whose selector explicitly targets an image (`img`) and whose
// declaration sets a non-none transform (hover zoom/slide/rotate). Reading the rule (not a live :hover) is the
// only render-independent way to see a hover effect; recall is bounded to selectors that name `img` (a
// background-image div or <picture> hover is not caught) - stated, not papered over.
exports.IHT_MIN_COUNT = 1;
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageStructural() {
    // per-element definitions (inlined - the serialized fn cannot close over module scope).
    const TBWS_BORDER_MAX_PX = 1.5, TBWS_SPREAD_MIN_PX = 6, TBWS_RATIO_MIN = 4, TBWS_PANEL_MIN_W = 100, TBWS_PANEL_MIN_H = 60;
    const STRIPE_MIN_DIM = 60;
    const FVO_VH_FRAC = 0.85, FVO_TOP_MAX_PX = 8, FVO_OVERFLOW_MIN_PX = 64, FVO_OVERFLOW_MAX_PX = 1200;
    const DOTGRID_TILE_MAX_PX = 40;
    const GLOW_BLUR_MIN_PX = 40, GLOW_MIN_AREA = 200 * 200;
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    // The SAME hardened visibility predicate as the other in-page scorers (self-contained duplicate).
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const rects = el.getClientRects();
        if (!rects.length)
            return false;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false;
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false;
        if (parseFloat(cs.textIndent) <= -999)
            return false;
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]);
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false;
        return true;
    }
    // split a comma-separated value at TOP LEVEL only (commas inside rgba()/gradient() parens are not delimiters).
    function splitTopLevel(s, sep) {
        const out = [];
        let depth = 0, cur = '';
        for (const ch of s) {
            if (ch === '(')
                depth++;
            else if (ch === ')')
                depth = Math.max(0, depth - 1);
            if (ch === sep && depth === 0) {
                out.push(cur);
                cur = '';
            }
            else
                cur += ch;
        }
        out.push(cur);
        return out;
    }
    // a scrim carries at least one colour STOP that is genuinely translucent (0 < alpha < 1). Scans EVERY colour
    // function in the layer (not just the first - Codex), and reads the slash-alpha form rgb(... / .4). A bare
    // `transparent`-only or fully-opaque gradient is NOT a scrim (the former paints nothing, the latter hides the
    // image), so the earlier `transparent`-keyword shortcut is dropped.
    function hasScrimAlpha(layer) {
        for (const c of layer.match(/(?:rgba?|hsla?)\([^)]*\)/gi) || []) {
            const parts = c.slice(c.indexOf('(') + 1, -1).split(/[,/]/).map((x) => x.trim()).filter(Boolean);
            if (parts.length < 4)
                continue;
            const raw = parts[3];
            const a = parseFloat(raw.replace('%', ''));
            const alpha = raw.includes('%') ? a / 100 : a;
            if (Number.isFinite(alpha) && alpha > 0 && alpha < 1)
                return true;
        }
        return false;
    }
    // max shadow SPREAD (4th length) and max BLUR (3rd length) across the comma-separated box-shadow layers. INSET
    // layers are SKIPPED entirely: an inset ring is not an elevation halo, so its spread must not trip the
    // thin-border-wide-shadow "double-elevation" defect (Codex).
    function shadowLengths(boxShadow) {
        if (!boxShadow || boxShadow === 'none')
            return null;
        let maxSpread = 0, maxBlur = 0, any = false;
        for (const layer of splitTopLevel(boxShadow, ',')) {
            if (/\binset\b/i.test(layer))
                continue;
            const noColor = layer.replace(/(?:rgba?|hsla?)\([^)]*\)/gi, ' ');
            const lens = (noColor.match(/-?\d*\.?\d+px/g) || []).map(parseFloat);
            if (lens.length >= 1) {
                any = true;
                const blur = lens.length >= 3 ? lens[2] : 0, spread = lens.length >= 4 ? lens[3] : 0;
                if (spread > maxSpread)
                    maxSpread = spread;
                if (blur > maxBlur)
                    maxBlur = blur;
            }
        }
        return any ? { spread: maxSpread, blur: maxBlur } : null;
    }
    // small tiled background-size: BOTH dims explicit px and <= tileMax (a repeated field, not a cover wash).
    function isSmallTile(backgroundSize, tileMax) {
        const first = splitTopLevel(backgroundSize, ',')[0].trim().toLowerCase();
        if (!first || /cover|contain|auto/.test(first))
            return false;
        const dims = first.split(/\s+/).map((d) => parseFloat(d));
        if (!dims.length || dims.some((d) => !Number.isFinite(d)))
            return false;
        const x = dims[0], y = dims.length > 1 ? dims[1] : dims[0];
        return x > 0 && y > 0 && x <= tileMax && y <= tileMax;
    }
    const scope = document.body ? [document.body, ...Array.from(document.body.querySelectorAll('*'))] : [];
    const viewportWidth = window.innerWidth || 1280;
    const viewportHeight = window.innerHeight || 800;
    let thinBorderWideShadowCount = 0, tbwsMaxRatio = 0;
    let tbwsSelector;
    let stripeGradientCount = 0;
    let stripeSelector;
    let textUnderOverlayCount = 0;
    let overlaySelector;
    let firstViewportOverflowPx = 0;
    let overflowSelector;
    let dotGridCount = 0;
    let dotGridSelector;
    let radialGlowCount = 0;
    let glowSelector;
    for (const el of scope) {
        if (!visuallyVisible(el))
            continue;
        if (el.namespaceURI === 'http://www.w3.org/2000/svg')
            continue; // SVG graphic nodes are illustrative, not chrome
        const cs = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        const bg = cs.backgroundImage || '';
        // thin-border-wide-shadow: hairline border + wide-spread shadow on a real panel.
        if (box.width >= TBWS_PANEL_MIN_W && box.height >= TBWS_PANEL_MIN_H) {
            const bw = parseFloat(cs.borderTopWidth) || 0;
            const hasBorder = bw > 0 && bw <= TBWS_BORDER_MAX_PX && cs.borderTopStyle !== 'none' && cs.borderTopStyle !== 'hidden';
            if (hasBorder) {
                const sh = shadowLengths(cs.boxShadow);
                if (sh && sh.spread >= TBWS_SPREAD_MIN_PX) {
                    const ratio = sh.spread / bw;
                    if (ratio >= TBWS_RATIO_MIN) {
                        thinBorderWideShadowCount++;
                        if (ratio > tbwsMaxRatio)
                            tbwsMaxRatio = ratio;
                        if (!tbwsSelector)
                            tbwsSelector = sel(el);
                    }
                }
            }
        }
        // repeating-stripe-gradients: a repeating-linear-gradient filling a real 2D area (not a thin line/divider).
        if (bg && /repeating-linear-gradient\(/i.test(bg) && box.width >= STRIPE_MIN_DIM && box.height >= STRIPE_MIN_DIM) {
            stripeGradientCount++;
            if (!stripeSelector)
                stripeSelector = sel(el);
        }
        // text-under-overlay: a translucent scrim gradient layered OVER (earlier index = higher z-order) a url()
        // image, on a text-bearing surface. LAYER ORDER matters (Codex): `linear-gradient(scrim), url(photo)` is the
        // defect (scrim on top of the image); `url(photo), linear-gradient(scrim)` is NOT (the image paints over the
        // scrim). So the scrim layer must sit at a lower index than the image layer.
        if (bg && /url\(/i.test(bg) && (el.textContent || '').trim().length > 0) {
            const layers = splitTopLevel(bg, ',');
            const urlIdx = layers.findIndex((l) => /url\(/i.test(l));
            const scrimIdx = layers.findIndex((l) => /gradient\(/i.test(l) && hasScrimAlpha(l));
            if (urlIdx >= 0 && scrimIdx >= 0 && scrimIdx < urlIdx) {
                textUnderOverlayCount++;
                if (!overlaySelector)
                    overlaySelector = sel(el);
            }
        }
        // first-viewport-overflow: a viewport-height TOP SECTION that clips overflowing content. Excludes body/html
        // (a viewport-height scroll-root with a taller page is not a "clipped hero" - it is the page), and caps the
        // overflow window: below FVO_OVERFLOW_MIN_PX is a rounding artifact, above FVO_OVERFLOW_MAX_PX the element is
        // acting as the page scroll container (loom/redis-docs fired the whole body at 2000-11000px), not clipping a
        // hero. The dev corpus set both guards.
        const tag = el.tagName.toLowerCase();
        if (tag !== 'body' && tag !== 'html' && box.top <= FVO_TOP_MAX_PX && box.height >= FVO_VH_FRAC * viewportHeight) {
            // key off overflowY ONLY (Codex): a section with overflow-x:hidden but overflow-y:auto scrolls its vertical
            // content rather than clipping it, so the horizontal clip must not count as a vertical first-viewport clip.
            const clips = /hidden|clip/.test(cs.overflowY);
            const he = el;
            const overflow = he.scrollHeight - he.clientHeight;
            if (clips && overflow >= FVO_OVERFLOW_MIN_PX && overflow <= FVO_OVERFLOW_MAX_PX && overflow > firstViewportOverflowPx) {
                firstViewportOverflowPx = overflow;
                overflowSelector = sel(el);
            }
        }
        // decorative-dot-grid: a radial-gradient / grid tiled at a small cell, or a repeating-radial-gradient.
        if (bg && bg !== 'none') {
            const isRepeatingRadial = /repeating-radial-gradient\(/i.test(bg);
            const hasRadial = /(^|\s|,)radial-gradient\(/i.test(bg);
            const linearLayers = splitTopLevel(bg, ',').filter((l) => /(^|\s)linear-gradient\(/i.test(l)).length;
            const smallTile = isSmallTile(cs.backgroundSize || '', DOTGRID_TILE_MAX_PX);
            if (isRepeatingRadial || (hasRadial && smallTile) || (linearLayers >= 2 && smallTile)) {
                dotGridCount++;
                if (!dotGridSelector)
                    dotGridSelector = sel(el);
            }
        }
        // soft-radial-glow: a heavy blur() filter, or a large radial-gradient fading to transparent on a large area.
        {
            const filterBlur = ((cs.filter || '').match(/blur\(\s*([\d.]+)px\s*\)/i) || [])[1];
            const bigBlur = filterBlur !== undefined && parseFloat(filterBlur) >= GLOW_BLUR_MIN_PX;
            const area = box.width * box.height;
            const bigRadialGlow = /radial-gradient\(/i.test(bg) && !/repeating-radial-gradient\(/i.test(bg)
                && area >= GLOW_MIN_AREA && !isSmallTile(cs.backgroundSize || '', DOTGRID_TILE_MAX_PX)
                && splitTopLevel(bg, ',').some((l) => /radial-gradient\(/i.test(l) && (/\btransparent\b/i.test(l) || hasScrimAlpha(l)));
            if ((bigBlur && area >= GLOW_MIN_AREA) || bigRadialGlow) {
                radialGlowCount++;
                if (!glowSelector)
                    glowSelector = sel(el);
            }
        }
    }
    // image-hover-transform: a stylesheet :hover rule that names an image and sets a non-none transform. Reading
    // the rule is the only render-independent way to see a hover effect (a live :hover cannot be simulated in a
    // static scan). Cross-origin sheets throw on cssRules access; caught per-sheet so an unreadable sheet degrades
    // this class instead of failing the scan. Grouping rules (@media/@supports) are recursed one universe deep.
    let imageHoverTransformCount = 0;
    let hoverSelector;
    // an `img` ELEMENT token, not the substring in `.img-card` (Codex): preceded by start or a combinator/space,
    // followed by end or a class/id/pseudo/attr/combinator - never by `-` or another word char.
    const IMG_TOKEN = /(^|[\s>+~(,])img([\s.:#[>+~,)]|$)/i;
    function scanRules(rules) {
        for (const rule of rules) {
            const grouping = rule.cssRules;
            if (grouping && !rule.selectorText) {
                try {
                    scanRules(Array.from(grouping));
                }
                catch { /* */ }
                continue;
            }
            const styleRule = rule;
            const selText = styleRule.selectorText;
            if (!selText || !/:hover/i.test(selText))
                continue;
            const tf = styleRule.style && styleRule.style.transform;
            if (!tf || tf === 'none' || tf.trim() === '')
                continue;
            // the TRANSFORMED element is the selector SUBJECT (the rightmost compound). Require the subject to BE an img
            // (Codex): `.card:hover img` / `img:hover` fire, but `img:hover + .caption` (caption is the subject) and
            // `.img-card:hover` (substring) do not.
            for (const one of selText.split(',')) {
                const subject = one.trim().split(/[\s>+~]+/).pop() || '';
                if (IMG_TOKEN.test(' ' + subject)) {
                    imageHoverTransformCount++;
                    if (!hoverSelector)
                        hoverSelector = selText.slice(0, 80);
                    break;
                }
            }
        }
    }
    for (const sheet of Array.from(document.styleSheets)) {
        let rules = [];
        try {
            rules = Array.from(sheet.cssRules || []);
        }
        catch {
            continue;
        }
        scanRules(rules);
    }
    return {
        viewportWidth, viewportHeight,
        thinBorderWideShadowCount, tbwsMaxRatio, tbwsSelector,
        stripeGradientCount, stripeSelector,
        textUnderOverlayCount, overlaySelector,
        firstViewportOverflowPx, overflowSelector,
        dotGridCount, dotGridSelector,
        radialGlowCount, glowSelector,
        imageHoverTransformCount, hoverSelector,
    };
}
/** Node-side: turn a structural score into 0-7 findings (one page-level verdict per firing class). The ONE place
 * these production thresholds are applied; the calibration harness sweeps the same raw score fields. */
function structuralFindingsFromScore(s) {
    const out = [];
    if (s.thinBorderWideShadowCount >= exports.TBWS_MIN_COUNT) {
        out.push({ rule: 'thin-border-wide-shadow', severity: 'warning', selector: s.tbwsSelector,
            detail: `${s.thinBorderWideShadowCount} panel(s) with a hairline border under a wide-spread shadow (spread/border up to ${s.tbwsMaxRatio.toFixed(1)}x)` });
    }
    if (s.stripeGradientCount >= exports.STRIPE_MIN_COUNT) {
        out.push({ rule: 'repeating-stripe-gradients', severity: 'warning', selector: s.stripeSelector,
            detail: `${s.stripeGradientCount} repeating-linear-gradient striped surface(s)` });
    }
    if (s.textUnderOverlayCount >= exports.TUO_MIN_COUNT) {
        out.push({ rule: 'text-under-overlay', severity: 'warning', selector: s.overlaySelector,
            detail: `${s.textUnderOverlayCount} text surface(s) over a translucent scrim layered on a background image (contrast unmeasured: image aborted in hermetic render)` });
    }
    if (s.firstViewportOverflowPx >= exports.FVO_OVERFLOW_MIN_PX) {
        out.push({ rule: 'first-viewport-overflow', severity: 'warning', selector: s.overflowSelector,
            detail: `a viewport-height top section clips ${Math.round(s.firstViewportOverflowPx)}px of overflowing content in the first screen` });
    }
    if (s.dotGridCount >= exports.DOTGRID_MIN_COUNT) {
        out.push({ rule: 'decorative-dot-grid', severity: 'warning', selector: s.dotGridSelector,
            detail: `${s.dotGridCount} small-tiled radial/grid decorative field(s)` });
    }
    if (s.radialGlowCount >= exports.GLOW_MIN_COUNT) {
        out.push({ rule: 'soft-radial-glow', severity: 'warning', selector: s.glowSelector,
            detail: `${s.radialGlowCount} large soft radial-glow / heavy-blur decoration(s)` });
    }
    if (s.imageHoverTransformCount >= exports.IHT_MIN_COUNT) {
        out.push({ rule: 'image-hover-transform', severity: 'warning', selector: s.hoverSelector,
            detail: `${s.imageHoverTransformCount} :hover rule(s) transform an image (hover zoom/slide)` });
    }
    return out;
}
// marquee. A <marquee> element is deprecated and always the idiom. A CSS marquee is an INFINITE animation whose
// keyframes translate content horizontally by a large delta (>= MARQUEE_MIN_X_PCT of its own box, or a large px
// span). The infinite iteration + large horizontal travel is what separates a scroller from an ordinary slide-in.
exports.MARQUEE_MIN_X_PCT = 50; // translateX delta as a % of the element's box, or...
exports.MARQUEE_MIN_X_PX = 200; // ...an absolute px delta, either qualifies
exports.MARQUEE_MIN_COUNT = 1;
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageMotionMarker() {
    const MARQUEE_MIN_X_PCT = 50, MARQUEE_MIN_X_PX = 200;
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const rects = el.getClientRects();
        if (!rects.length)
            return false;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false;
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false;
        if (parseFloat(cs.textIndent) <= -999)
            return false;
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]);
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false;
        return true;
    }
    function ownText(el) {
        let t = '';
        for (const n of Array.from(el.childNodes))
            if (n.nodeType === 3 && n.textContent)
                t += n.textContent;
        return t.replace(/\s+/g, ' ').trim();
    }
    // ---- collect @keyframes once: name -> classification (isMarquee via large translateX travel delta).
    //      Cross-origin sheets throw on cssRules; caught per-sheet. ----
    const marqueeKeyframes = new Set();
    function readKeyframes(rules) {
        for (const rule of rules) {
            const asKf = rule;
            if (asKf.name !== undefined && asKf.cssRules) {
                // marquee is TRAVEL DELTA, not max absolute translate (Codex): a set that sits at translateX(250px) at
                // every frame never MOVES, so track signed min/max per unit and require max-min >= the threshold.
                let pctMin = Infinity, pctMax = -Infinity, pxMin = Infinity, pxMax = -Infinity;
                for (const fr of Array.from(asKf.cssRules)) {
                    const st = fr.style;
                    if (!st)
                        continue;
                    const tf = st.transform || '';
                    const txm = tf.match(/translate(?:X|3d)?\(\s*(-?[\d.]+)(px|%)?/i) || tf.match(/translate\(\s*(-?[\d.]+)(px|%)?/i);
                    if (txm) {
                        const v = parseFloat(txm[1]);
                        const unit = txm[2];
                        // a 0 endpoint is unit-agnostic (0 = the origin in any unit): a `0 -> -100%` marquee mixes units, so a
                        // bare/0px/0% zero must count as 0 in BOTH unit tracks, or the %-track never sees its 0 endpoint.
                        if (v === 0) {
                            if (pctMin > 0)
                                pctMin = 0;
                            if (pctMax < 0)
                                pctMax = 0;
                            if (pxMin > 0)
                                pxMin = 0;
                            if (pxMax < 0)
                                pxMax = 0;
                        }
                        else if (unit === '%') {
                            if (v < pctMin)
                                pctMin = v;
                            if (v > pctMax)
                                pctMax = v;
                        }
                        else {
                            if (v < pxMin)
                                pxMin = v;
                            if (v > pxMax)
                                pxMax = v;
                        }
                    }
                }
                const pctDelta = pctMax >= pctMin ? pctMax - pctMin : 0;
                const pxDelta = pxMax >= pxMin ? pxMax - pxMin : 0;
                if (pctDelta >= MARQUEE_MIN_X_PCT || pxDelta >= MARQUEE_MIN_X_PX)
                    marqueeKeyframes.add(asKf.name);
                continue;
            }
            const grouping = rule.cssRules;
            if (grouping && !rule.selectorText) {
                try {
                    readKeyframes(Array.from(grouping));
                }
                catch { /* */ }
            }
        }
    }
    for (const sheet of Array.from(document.styleSheets)) {
        let rules = [];
        try {
            rules = Array.from(sheet.cssRules || []);
        }
        catch {
            continue;
        }
        readKeyframes(rules);
    }
    // pair each animation-name with its OWN iteration-count by index (CSS lists them positionally, cycling the
    // shorter list): an animation is endless only if ITS iteration count is infinite/large. An earlier version fired
    // if ANY animation on the element was infinite, so `animation-name: marquee, fade; iteration-count: 1, infinite`
    // wrongly counted the FINITE marquee (Codex). Returns the names of the element's endless animations.
    const infiniteAnimNames = (cs) => {
        const names = (cs.animationName || '').split(',').map((n) => n.trim());
        const counts = (cs.animationIterationCount || '').split(',').map((c) => c.trim());
        const out = [];
        for (let i = 0; i < names.length; i++) {
            const n = names[i];
            if (!n || n === 'none')
                continue;
            const c = counts.length ? counts[i % counts.length] : '';
            if (/^infinite$/i.test(c) || parseFloat(c) >= 10)
                out.push(n);
        }
        return out;
    };
    let marqueeElementCount = 0, marqueeAnimCount = 0;
    let marqueeSelector;
    // <marquee> elements (deprecated) - counted only when actually rendered (a display:none template must not fire).
    for (const m of Array.from(document.getElementsByTagName('marquee'))) {
        if (visuallyVisible(m)) {
            marqueeElementCount++;
            if (!marqueeSelector)
                marqueeSelector = sel(m);
        }
    }
    const scope = document.body ? [document.body, ...Array.from(document.body.querySelectorAll('*'))] : [];
    for (const el of scope) {
        if (el.namespaceURI === 'http://www.w3.org/2000/svg')
            continue;
        if (!visuallyVisible(el))
            continue; // gate marquee on visibility (no hidden-template fires - Codex)
        const cs = getComputedStyle(el);
        // marquee via animation usage (element runs an ENDLESS marquee keyframe - paired by index above).
        const inf = infiniteAnimNames(cs);
        if (inf.length) {
            if (inf.some((n) => marqueeKeyframes.has(n))) {
                marqueeAnimCount++;
                if (!marqueeSelector)
                    marqueeSelector = sel(el);
            }
        }
    }
    return { marqueeElementCount, marqueeAnimCount, marqueeSelector };
}
/** Node-side: turn a motion/marker score into 0-1 findings (one page-level verdict per firing class). */
function motionMarkerFindingsFromScore(s) {
    const out = [];
    const marquees = s.marqueeElementCount + s.marqueeAnimCount;
    if (marquees >= exports.MARQUEE_MIN_COUNT) {
        out.push({ rule: 'marquee', severity: 'warning', selector: s.marqueeSelector,
            detail: `${marquees} marquee(s) (${s.marqueeElementCount} <marquee> element(s), ${s.marqueeAnimCount} infinite horizontal-scroll animation(s))` });
    }
    return out;
}
const HERMETIC = { stripScripts: true, abortExternal: true, viewport: { width: 1280, height: 800 } };
async function analyzeHtmlOnBrowserSubjective(browser, html, timeoutMs = 30000, render = {}, typeface = {}) {
    const r = { ...HERMETIC, ...render };
    const context = await browser.newContext({ viewport: r.viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    try {
        const page = await context.newPage();
        if (r.abortExternal) {
            await page.route('**/*', (route) => { const u = route.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? route.continue() : route.abort(); });
        }
        await page.setContent(r.stripScripts ? stripScripts(html) : html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const findings = await page.evaluate(inPageSubjective);
        // nested-cards via the SAME single-source split: in-page geometry score, Node-side thresholds.
        const nested = nestedCardsFindingFromScore(await page.evaluate(inPageNestedCards));
        if (nested)
            findings.push(nested);
        // marketing-buzzword via the SINGLE-SOURCE score function + Node-side threshold (same path the harness sweeps).
        const buzz = buzzwordFindingFromScore(await page.evaluate(inPageBuzzword));
        if (buzz)
            findings.push(buzz);
        // default-typeface via the SAME split (Stage 4a): in-page score, Node-side threshold.
        const face = typefaceFindingFromScore(await page.evaluate(inPageTypeface), typeface);
        if (face)
            findings.push(face);
        // Stage 4b typographic-extreme classes via the SAME split: one in-page score, Node-side thresholds -> 0-4 findings.
        findings.push(...typographyExtremesFindingsFromScore(await page.evaluate(inPageTypographyExtremes)));
        // Stage 4c structural classes via the SAME split: one in-page score, Node-side thresholds -> 0-7 findings.
        findings.push(...structuralFindingsFromScore(await page.evaluate(inPageStructural)));
        // Stage 4d motion/marker classes via the SAME split: one in-page score, Node-side thresholds -> 0-1 findings
        // (numbered-section-markers was removed 2026-07-28; marquee is the only class left in this family).
        findings.push(...motionMarkerFindingsFromScore(await page.evaluate(inPageMotionMarker)));
        return findings;
    }
    finally {
        try {
            await context.close();
        }
        catch { /* */ }
    }
}
/** Render an HTML string deterministically and return subjective findings. FAIL-CLOSED: a launch/render error or
 * timeout returns { available:false } - never a false "clean". */
async function scanSubjectiveRendered(html, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 30000;
    const launch = opts.launcher ?? (() => chromiumDriver().launch({ headless: true }));
    let browser = null;
    try {
        browser = await launch();
        const findings = await analyzeHtmlOnBrowserSubjective(browser, html, timeoutMs, opts.render ?? {}, opts.typeface ?? {});
        return { available: true, findings };
    }
    catch (e) {
        return { available: false, reason: e instanceof Error ? e.message : String(e) };
    }
    finally {
        if (browser) {
            try {
                await browser.close();
            }
            catch { /* */ }
        }
    }
}
//# sourceMappingURL=subjective-rendered-scanner.js.map