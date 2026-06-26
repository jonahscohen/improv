/**
 * OWNED rendered SUBJECTIVE (taste) scanner (Sidecoach Stage 1 - reimplement-and-own).
 *
 * The taste-frontier sibling of objective-rendered-scanner.ts. Detects SUBJECTIVE design idioms by RENDERING the
 * page and reading the real DOM + computed styles - the same render-determinism + hermetic posture as the
 * objective scanner, so the computed-style the detector reads comes from the SAME render the dev labeler
 * screenshotted (render-basis parity). Authored from a readability/spec basis, independent of the eval labeler.
 *
 * STAGE 1 classes (added incrementally, highest eval-weight first):
 *   - tiny-text : text rendered small enough to strain readability (notably small body or interface text).
 *   - nested-cards : a card-like container holding a meaningfully-smaller card-like container.
 *   - marketing-buzzword : the page's copy LEANS on generic marketing buzzwords (seamless, powerful, revolutionary,
 *       ...) rather than concrete specifics - a holistic weighted-density measure over the content copy (Stage 5a
 *       v2 rebuild; reimplement-and-own; calibrated on a register-diverse dev corpus).
 *
 * PRECISION-FIRST (lead condition): tiny-text is prevalent and easy to over-fire (12px captions are near-
 * universal). The page-level trigger is therefore conservative and readability-grounded, NOT tuned to match the
 * vision labeler: a single 12px caption does not make a page "tiny-text".
 *
 * INDEPENDENCE: PRODUCT scanner; MUST NOT import anything under eval/. Distinct artifact from the eval referee.
 */
import { chromium } from 'playwright';
import type { Browser } from 'playwright';

export type SubjectiveRule = 'tiny-text' | 'nested-cards' | 'marketing-buzzword';

export interface SubjectiveFinding {
  rule: SubjectiveRule;
  severity: 'warning';
  selector?: string;
  detail?: string;
}

export type SubjectiveScan =
  | { available: true; findings: SubjectiveFinding[] }
  | { available: false; reason: string };

export const SUBJECTIVE_RULES: SubjectiveRule[] = ['tiny-text', 'nested-cards', 'marketing-buzzword'];

export function stripScripts(html: string): string {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '');
}

/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
export function inPageSubjective(): SubjectiveFinding[] {
  const findings: { rule: string; severity: string; selector?: string; detail?: string }[] = [];
  function sel(el: Element): string {
    const t = el.tagName.toLowerCase();
    if (el.id) return `${t}#${el.id}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return cls ? `${t}.${cls}` : t;
  }

  // VISUAL visibility: rendered to sighted users. Excludes display:none, visibility:hidden, cumulative opacity 0,
  // sub-/1px boxes, off-screen, and sr-only (clipped/1px/indented) text. Mirrors the objective scanner's hardened
  // predicate so tiny sr-only text is never counted as visible tiny-text.
  function visuallyVisible(el: Element): boolean {
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') return false;
    for (let n: Element | null = el; n && n instanceof Element; n = n.parentElement) { if (parseFloat(getComputedStyle(n).opacity) === 0) return false; }
    const rects = (el as HTMLElement).getClientRects();
    if (!rects.length) return false;
    const box = (el as HTMLElement).getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible') return false;
    if (box.right <= 0 || box.bottom <= 0) return false;
    if (parseFloat(cs.textIndent) <= -999) return false;
    const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
    if (clipM) { const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]); if (rr <= l || b <= t) return false; }
    if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || '')) return false;
    return true;
  }

  // own (direct) text of an element, with whitespace collapsed (source indentation/newlines between inline
  // children must NOT inflate the rendered char count - Codex review).
  function ownText(el: Element): string {
    let t = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  }
  // text that is painted invisibly (transparent fill / near-zero alpha) must not count - it isn't rendered to a
  // sighted user, and transparent fill is also how gradient-text is done (Codex review).
  function paintedInvisible(cs: CSSStyleDeclaration): boolean {
    const fill = (cs as unknown as { webkitTextFillColor?: string }).webkitTextFillColor;
    const colors = [cs.color, fill].filter(Boolean) as string[];
    return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m) return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
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
  const PROPORTION_MIN = 0.15;   // >= 15% of content text (by char amount) small => a substantial, straining share
  const MIN_CONTENT_CHARS = 200; // ignore near-empty pages (avoid a 1-element page reading as 100%)
  // PERIPHERAL chrome (excluded): footer/nav AND their ARIA-role equivalents + asides/menus (Codex review: UI
  // chrome is often 12-14px; counting it over-fires). Excludes <footer>/<nav>/<aside>/<menu> and role=
  // navigation/contentinfo/complementary/menubar/menu. Deliberately NOT <header>/role=banner (the hero lives
  // there and is content).
  const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
  const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
  const peripheral = (el: Element): boolean => {
    for (let n: Element | null = el; n && n instanceof Element; n = n.parentElement) {
      if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase())) return true;
      const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
      if (role && PERIPHERAL_ROLES.has(role)) return true;
    }
    return false;
  };
  let contentChars = 0, smallChars = 0;
  const offenders: Element[] = [];
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
    const text = ownText(el);
    if (!text || !visuallyVisible(el) || peripheral(el)) continue;
    const cs0 = getComputedStyle(el);
    if (paintedInvisible(cs0)) continue;
    const fontPx = parseFloat(cs0.fontSize);
    if (!(fontPx > 0)) continue;
    const c = text.length;
    contentChars += c;
    if (fontPx <= SMALL_PX) { smallChars += c; offenders.push(el); }
  }
  const proportion = contentChars > 0 ? smallChars / contentChars : 0;
  if (contentChars >= MIN_CONTENT_CHARS && proportion >= PROPORTION_MIN) {
    for (const el of offenders.slice(0, 20)) {
      const fontPx = Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
      findings.push({ rule: 'tiny-text', severity: 'warning', selector: sel(el), detail: `${fontPx}px (${Math.round(proportion * 100)}% of content text <=${SMALL_PX}px)` });
    }
  }

  // ---- nested-cards: a card-like container holding a meaningfully-smaller card-like container ----
  // Rubric: "cards inside other cards - layered bordered containers holding sub-containers." A card READS as a
  // discrete panel: rounded corners + STRONG card treatment (a visible BORDER or a SHADOW) of real panel size,
  // with children. TIGHTEN (milestone revival): the eval milestone exposed precision 0.27 - the bg-distinct
  // signal (a tinted background different from the parent) over-fired on INCIDENTAL tinted layout regions that
  // aren't visually "cards". Per lead, require strong card treatment (border|shadow) for BOTH outer + inner card;
  // bg-distinct alone no longer qualifies. (Recall cost accepted; precision governs.) KNOWN LIMIT: nesting inside
  // a product-mockup IMAGE (raster) is DOM-invisible to any DOM detector (hits oracle equally) - never OCR.
  const CARD_MIN_W = 100, CARD_MIN_H = 60, CARD_RADIUS = 4, INNER_MAX_AREA_FRAC = 0.85;
  function isCard(el: Element): boolean {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const box = el.getBoundingClientRect();
    if (box.width < CARD_MIN_W || box.height < CARD_MIN_H) return false;
    if (!el.firstElementChild) return false; // a container, not a leaf
    const br = Math.max(parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0, parseFloat(cs.borderBottomLeftRadius) || 0, parseFloat(cs.borderBottomRightRadius) || 0);
    if (br < CARD_RADIUS) return false;
    const hasBorder = parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none';
    const hasShadow = !!cs.boxShadow && cs.boxShadow !== 'none';
    return hasBorder || hasShadow; // strong card treatment only (bg-distinct dropped - it was the over-fire)
  }
  const cards: Element[] = [];
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) if (isCard(el)) cards.push(el);
  const cardSet = new Set(cards);
  let nestedCount = 0; const nestedOuter: Element[] = [];
  for (const outer of cards) {
    const oBox = outer.getBoundingClientRect(); const oArea = oBox.width * oBox.height;
    for (const d of Array.from(outer.querySelectorAll('*'))) {
      if (!cardSet.has(d)) continue;
      const dBox = d.getBoundingClientRect();
      if (dBox.width * dBox.height < INNER_MAX_AREA_FRAC * oArea) { nestedCount++; nestedOuter.push(outer); break; }
    }
  }
  if (nestedCount >= 1) {
    for (const el of nestedOuter.slice(0, 20)) findings.push({ rule: 'nested-cards', severity: 'warning', selector: sel(el), detail: `card-in-card (${nestedCount} nested on page)` });
  }

  // marketing-buzzword is computed by the SEPARATE self-contained inPageBuzzword() below (the SINGLE source
  // for the taxonomy + weighted-density math, shared by the production scan AND the calibration harness so the
  // harness measures EXACTLY what ships). Its finding is merged in by the Node render wrappers via the threshold.

  return findings as SubjectiveFinding[];
}

export interface BuzzwordScore {
  density: number;          // raw weighted buzzword density (per 100 content words)
  effectiveDensity: number; // density if the page QUALIFIES (v3: >=1 STRONG/PEAK term), else 0
  words: number;
  weighted: number;
  distinctTerms: number;
  hasStrongOrPeak: boolean;
  matched: string[];
  selector?: string;
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
export function inPageBuzzword(): BuzzwordScore {
  function sel(el: Element): string {
    const t = el.tagName.toLowerCase();
    if (el.id) return `${t}#${el.id}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return cls ? `${t}.${cls}` : t;
  }
  // VISUAL visibility: the SAME hardened predicate as inPageSubjective (each in-page fn must be self-contained for
  // page.evaluate, so a verbatim duplicate is correct). Excludes display:none, visibility:hidden, cumulative
  // opacity 0, sub-/1px boxes, off-screen, and sr-only (clipped/1px-overflow/indented) text - so a11y sr-only text
  // never corrupts the buzzword density (numerator AND denominator).
  function visuallyVisible(el: Element): boolean {
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') return false;
    for (let n: Element | null = el; n && n instanceof Element; n = n.parentElement) { if (parseFloat(getComputedStyle(n).opacity) === 0) return false; }
    const rects = (el as HTMLElement).getClientRects();
    if (!rects.length) return false;
    const box = (el as HTMLElement).getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible') return false;
    if (box.right <= 0 || box.bottom <= 0) return false;
    if (parseFloat(cs.textIndent) <= -999) return false;
    const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
    if (clipM) { const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]); if (rr <= l || b <= t) return false; }
    if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || '')) return false;
    return true;
  }
  function ownText(el: Element): string {
    let t = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  }
  // text painted invisibly (transparent fill / near-zero alpha) must not count - it isn't rendered to a sighted
  // user (parity with inPageSubjective). Applied per-element in the scope loop below.
  function paintedInvisible(cs: CSSStyleDeclaration): boolean {
    const fill = (cs as unknown as { webkitTextFillColor?: string }).webkitTextFillColor;
    const colors = [cs.color, fill].filter(Boolean) as string[];
    return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m) return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
  }
  const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
  const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
  const peripheral = (el: Element): boolean => {
    for (let n: Element | null = el; n && n instanceof Element; n = n.parentElement) {
      if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase())) return true;
      const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
      if (role && PERIPHERAL_ROLES.has(role)) return true;
    }
    return false;
  };
  const QUOTE_TAGS = new Set(['blockquote', 'q', 'cite', 'figure']);
  const QUOTE_RE = /testimonial|quote|review|case[-_ ]?stud|customer[-_ ]?stor/i;
  const inQuote = (el: Element): boolean => {
    for (let n: Element | null = el; n && n instanceof Element; n = n.parentElement) {
      if (QUOTE_TAGS.has((n.tagName || '').toLowerCase())) return true;
      if (QUOTE_RE.test((n.getAttribute('class') || '') + ' ' + (n.id || ''))) return true;
    }
    return false;
  };
  // [key, pattern, weight]. THE single taxonomy. PEAK 4 / STRONG 2 / MILD 0.5 (v3 vacuity reweight).
  const BUZZ_TAX: [string, string, number][] = [ // weights: PEAK 4 / STRONG 2 / MILD 0.5 (vacuity-reweighted, v3)
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
  const buzzEls: Element[] = [];
  let buzzText = '';
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
    const text = ownText(el);
    if (!text || !visuallyVisible(el) || peripheral(el) || inQuote(el)) continue;
    if (paintedInvisible(getComputedStyle(el))) continue;
    buzzText += ' ' + text; buzzEls.push(el);
  }
  const buzzNorm = ' ' + buzzText.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const words = buzzNorm.trim() ? buzzNorm.trim().split(' ').filter(Boolean).length : 0;
  let weighted = 0, distinctTerms = 0, hasStrongOrPeak = false; const matched: string[] = [];
  for (const [key, pat, w] of BUZZ_TAX) {
    // non-consuming lookarounds: counts ALL occurrences (incl. adjacent repeats), unlike a space-consuming match.
    const m = buzzNorm.match(new RegExp('(?<= )(?:' + pat + ')(?= )', 'g'));
    if (m && m.length) { weighted += w * m.length; distinctTerms++; matched.push(key); if (w >= 2) hasStrongOrPeak = true; }
  }
  const density = words >= BUZZ_MIN_WORDS ? (weighted / words) * 100 : 0;
  const qualifies = hasStrongOrPeak; // v3: require >=1 PEAK/STRONG term (pure-MILD = concrete descriptors, not buzzword-leaning)
  const effectiveDensity = qualifies ? density : 0;
  let selector: string | undefined;
  for (const el of buzzEls) {
    const t = ' ' + ownText(el).toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ') + ' ';
    if (BUZZ_TAX.some(([, pat]) => new RegExp('(?<= )(?:' + pat + ')(?= )').test(t))) { selector = sel(el); break; }
  }
  return { density, effectiveDensity, words, weighted, distinctTerms, hasStrongOrPeak, matched, selector };
}

// Firing threshold for marketing-buzzword (vacuity-weighted density per 100 content words). Frozen on the
// register-diverse dev signal + the vacuity principle, NEVER on held-out knowledge (frozen-90 is spent). v3 = 0.75
// under the PEAK4/STRONG2/MILD0.5 reweight + the >=1 PEAK/STRONG guard -> dev R0.839 / P0.839 (recall held, precision
// up from 0.806). Calibration sweeps this over inPageBuzzword's effectiveDensity; production applies it here.
export const BUZZ_DENSITY_THRESHOLD = 0.75;

/** Node-side: turn a buzzword score into a marketing-buzzword finding (or null). The ONE place the production
 * threshold is applied; the calibration harness sweeps the same effectiveDensity. */
export function buzzwordFindingFromScore(s: BuzzwordScore): SubjectiveFinding | null {
  if (s.effectiveDensity < BUZZ_DENSITY_THRESHOLD) return null;
  return { rule: 'marketing-buzzword', severity: 'warning', selector: s.selector, detail: `buzzword density ${s.density.toFixed(1)}/100 words (e.g. ${s.matched.slice(0, 8).join(', ')})` };
}

export interface RenderOpts { stripScripts?: boolean; abortExternal?: boolean; viewport?: { width: number; height: number }; }
const HERMETIC: Required<RenderOpts> = { stripScripts: true, abortExternal: true, viewport: { width: 1280, height: 800 } };

export async function analyzeHtmlOnBrowserSubjective(browser: Browser, html: string, timeoutMs = 30000, render: RenderOpts = {}): Promise<SubjectiveFinding[]> {
  const r = { ...HERMETIC, ...render };
  const context = await browser.newContext({ viewport: r.viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    if (r.abortExternal) {
      await page.route('**/*', (route) => { const u = route.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? route.continue() : route.abort(); });
    }
    await page.setContent(r.stripScripts ? stripScripts(html) : html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const findings = await page.evaluate(inPageSubjective);
    // marketing-buzzword via the SINGLE-SOURCE score function + Node-side threshold (same path the harness sweeps).
    const buzz = buzzwordFindingFromScore(await page.evaluate(inPageBuzzword));
    if (buzz) findings.push(buzz);
    return findings;
  } finally {
    try { await context.close(); } catch { /* */ }
  }
}

export interface ScanOptions { timeoutMs?: number; launcher?: () => Promise<Browser>; render?: RenderOpts; }

/** Render an HTML string deterministically and return subjective findings. FAIL-CLOSED: a launch/render error or
 * timeout returns { available:false } - never a false "clean". */
export async function scanSubjectiveRendered(html: string, opts: ScanOptions = {}): Promise<SubjectiveScan> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const launch = opts.launcher ?? (() => chromium.launch({ headless: true }));
  let browser: Browser | null = null;
  try {
    browser = await launch();
    const findings = await analyzeHtmlOnBrowserSubjective(browser, html, timeoutMs, opts.render ?? {});
    return { available: true, findings };
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    if (browser) { try { await browser.close(); } catch { /* */ } }
  }
}
