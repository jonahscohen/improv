#!/usr/bin/env node
/**
 * Contract-6 OBJECTIVE-LABEL RENDERED labeler (Stage 0) - the TERMINAL ground-truth referee.
 *
 * Codex item-8 proved a regex referee cannot resolve cascade/specificity/inheritance, so it
 * cannot know the APPLIED style - and the referee that grades A1-A4 must be MORE reliable than
 * the detectors it judges. This reads the AUTHORITATIVE rendered state via a real DOM +
 * getComputedStyle (Playwright). The browser resolves comments, quoting, data-* attrs, the
 * cascade, specificity, inheritance, hidden, and ARIA for free.
 *
 * OBJECTIVE classes (spec-constant thresholds only):
 *  - broken-image      HTML: an <img> with no resolvable src (DOM-parsed src attribute absent/empty).
 *  - justified-text    WCAG 1.4.8 (AAA): computed text-align === 'justify' on a BLOCK text container.
 *  - skipped-heading   WCAG 1.3.1: visible heading-level jump (h1-h6 + role~=heading/aria-level), using
 *                      the ACCESSIBILITY tree (presentational/aria-hidden/inert/display:none removed;
 *                      sr-only landmark headings counted).
 *  - low-contrast      WCAG 1.4.3: text/bg contrast < 4.5 (normal) / 3 (large) on a SOLID bg.
 *  - gray-on-color     low-contrast subcase where the background is chromatic.
 *
 * Folds Codex item-8 (rebuilt-referee review):
 *  - PAGE SCRIPTS STRIPPED before render (determinism, #12/#13): all <script> are removed from the
 *    HTML so the page's own JS cannot run or mutate state non-deterministically. (We cannot use
 *    Playwright's javaScriptEnabled:false because our OWN read runs via page.evaluate, which needs JS;
 *    stripping the page's scripts achieves the same determinism while our evaluation still works.)
 *  - back-to-front alpha compositing from an opaque base (#7); cumulative ANCESTOR opacity -> hidden
 *    at ~0, CONTRAST-INDETERMINATE when 0<opacity<1 (#1/#9, never wrong-math); justified-text on
 *    BLOCK containers only, not inline boxes (#2); headings use the a11y tree - role=presentation/none
 *    on the heading, tokenized role~=heading + aria-level, inert subtrees (#3/#5/#10); contrast text
 *    detection broadened to any element with direct text + form controls (#4).
 *  - KNOWN LIMITATIONS (documented, conservative - reported, never silently wrong; rare in static
 *    script-stripped captures): shadow DOM / srcdoc iframes not traversed (#6 - with JS disabled no JS
 *    shadow roots are created); backgrounds from positioned cross-stacking-context SIBLINGS not sampled
 *    (#8 - background-image already -> indeterminate); clip-path clipping not detected (#11 - deprecated
 *    `clip` zero-rect IS). pseudo-element generated content not contrast-checked (often decorative).
 *
 * DETERMINISM: fixed 1280x800 viewport, JS disabled, animations/transitions zeroed, all external
 * requests aborted (inlined CSS only), srgb; Chromium pinned via the playwright dep (recorded by meta()).
 * CONTRAST non-solid bg: background-image (gradient/image) or partial ancestor opacity =>
 * CONTRAST-INDETERMINATE, EXCLUDED-WITH-FLAG (counted in meta), never guessed.
 */

import { readFileSync } from 'node:fs';

const ANIM_OFF = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}';

/** Remove all <script> (inline + external) so the page's own JS cannot run (determinism, Codex #12/#13). */
function stripScripts(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '');
}

/* c8 ignore start - executes in the browser context, not under node coverage */
function inPageCompute() {
  const labels = new Set();        // FULL-PAGE objective defects (ground truth for A1 recall + A2 precision)
  const primary = new Set();       // defect classes with >=1 instance in PRIMARY content (known-good inclusion)
  let contrastIndeterminate = 0;
  let sawPrimaryContent = false;   // visible non-peripheral content exists (eligibility; consistent with the defect pass)

  const roleTokens = (el) => (el.getAttribute && el.getAttribute('role') || '').toLowerCase().split(/\s+/).filter(Boolean);

  // LANDMARK REGION (Jonah ruling B): PRIMARY = main/article/role=main; PERIPHERAL = nav/footer/aside/
  // header/role=contentinfo|banner|navigation|complementary; 'none' = no enclosing landmark. Nearest
  // landmark ancestor wins. Mechanical via ARIA + implicit roles -> stays objective.
  const PERIPH_TAGS = new Set(['NAV', 'FOOTER', 'ASIDE', 'HEADER']);
  const PERIPH_ROLES = new Set(['contentinfo', 'banner', 'navigation', 'complementary']);
  // Effective landmark of a SINGLE node: an explicit ARIA role OVERRIDES the implicit tag role (per ARIA),
  // so <main role="navigation"> is peripheral and <nav role="main"> is primary. Returns primary|peripheral|null.
  const effectiveRoleRegion = (n) => {
    const rt = roleTokens(n);
    if (rt.length) { // explicit role wins over the tag
      if (rt.includes('main')) return 'primary';
      if (rt.some((r) => PERIPH_ROLES.has(r))) return 'peripheral';
      return null; // explicit non-landmark role: this node is not one of our landmarks
    }
    if (n.tagName === 'MAIN' || n.tagName === 'ARTICLE') return 'primary';
    if (PERIPH_TAGS.has(n.tagName)) return 'peripheral';
    return null;
  };
  const landmarkRegion = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const r = effectiveRoleRegion(n); if (r) return r; }
    return 'none';
  };
  // FULL-PAGE ground truth always records the class; PRIMARY set records it if in primary content.
  // FALLBACK rule (lead pre-approved, adopted 2026-06-23 - exclusion held ~32%, structurally era-correlated,
  // + dashboard register-rep gap): PRIMARY = an explicit primary landmark (main/article/role=main) when
  // present, OR content NOT inside a PERIPHERAL landmark (region 'none' = non-chrome content). Only defects
  // inside a peripheral landmark (nav/footer/aside/header/...) are excluded from the known-good criterion.
  // This rescues div-based pages (admin dashboards, pre-<main> archives) that B-strict wrongly excluded.
  // (B's invariant still holds: FP ground truth stays full-page; peripheral defect = TRUE positive, not FP.)
  const addDefect = (cls, el) => { labels.add(cls); if (el && landmarkRegion(el) !== 'peripheral') primary.add(cls); };
  const cumOpacity = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const v = parseFloat(getComputedStyle(n).opacity); if (Number.isFinite(v)) o *= v; } return o; };

  // VISUAL visibility (contrast + justify): is this text actually PRESENTED to a sighted user?
  const isHidden = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return true;
    if (el.hasAttribute('hidden')) return true;
    if (cumOpacity(el) <= 0.01) return true; // self or ANCESTOR opacity ~0 (#1)
    if (el.getClientRects().length === 0) return true;
    if (s.clip === 'rect(0px, 0px, 0px, 0px)') return true; // legacy sr-only clip (#11, partial)
    const ti = parseFloat(s.textIndent);
    if (Number.isFinite(ti) && Math.abs(ti) >= 999) return true; // image-replacement / off-screen text
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return true;           // collapsed / sr-only (clip to ~1px)
    if (r.right <= 0 || r.bottom <= 0) return true;           // off-screen top/left (skip-links)
    if (r.left >= window.innerWidth) return true;             // off-screen right (Codex fallback #2); below-fold (top>=h) stays in-scope
    return false;
  };
  // ACCESSIBILITY-TREE visibility (skipped-heading): the programmatic outline AT reads.
  const isAriaHidden = (el) => {
    if (getComputedStyle(el).visibility === 'hidden') return true; // inherits
    const rt = roleTokens(el);
    if (rt.includes('presentation') || rt.includes('none')) return true; // role strips heading semantics (#3)
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (getComputedStyle(n).display === 'none') return true;
      if (n.hasAttribute('hidden') || n.hasAttribute('inert')) return true; // inert subtree (#10)
      if (n.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  };

  // --- broken-image (structural: DOM-parsed src absent/empty) ---
  for (const img of document.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (src === null || src.trim() === '') addDefect('broken-image', img);
  }

  // --- skipped-heading (a11y-tree heading-level jump; tokenized role + aria-level) ---
  const headings = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role~="heading"]')) {
    if (isAriaHidden(el)) continue;
    const tag = el.tagName.toLowerCase();
    let level = null;
    if (/^h[1-6]$/.test(tag)) level = parseInt(tag[1], 10);
    else if (roleTokens(el).includes('heading')) { const al = parseInt(el.getAttribute('aria-level'), 10); if (Number.isFinite(al)) level = al; } // (#5)
    if (level !== null) headings.push({ level, el });
  }
  for (let i = 1; i < headings.length; i++) { if (headings[i].level - headings[i - 1].level >= 2) addDefect('skipped-heading', headings[i].el); }

  // --- color / contrast helpers ---
  const parseColor = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x.trim())); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 }); // bg assumed opaque
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
  const isChromatic = (c) => (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) > 24;
  // Effective bg: composite background-color BACK-TO-FRONT from the first opaque layer (or white
  // canvas) toward the element (#7). background-image before opaque -> indeterminate.
  const effectiveBg = (el) => {
    const layers = []; let base = null;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return { indeterminate: true };
      const bc = parseColor(s.backgroundColor);
      if (bc && bc.a > 0) { if (bc.a >= 1) { base = bc; break; } layers.push(bc); }
    }
    let acc = base || { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc); // backmost first, frontmost last
    return { color: acc };
  };

  // --- justified-text (block containers only) + contrast (any element with direct text) ---
  const hasDirectText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 0) return true; return false; };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'svg', 'SVG']);
  const checkContrast = (el, s, fg) => {
    const op = cumOpacity(el);
    if (op > 0.01 && op < 0.999) { contrastIndeterminate++; return; } // partial ancestor opacity (#9)
    const bgr = effectiveBg(el);
    if (bgr.indeterminate) { contrastIndeterminate++; return; }
    const fgc = fg.a < 1 ? over(fg, bgr.color) : fg;
    const fontPx = parseFloat(s.fontSize) || 16;
    const weight = parseInt(s.fontWeight, 10) || 400;
    const large = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700);
    if (ratio(fgc, bgr.color) < (large ? 3.0 : 4.5)) { addDefect('low-contrast', el); if (isChromatic(bgr.color)) addDefect('gray-on-color', el); }
  };
  for (const el of document.querySelectorAll('*')) {
    if (SKIP.has(el.tagName)) continue;
    if (isHidden(el)) continue;
    const s = getComputedStyle(el);
    // eligibility: visible non-peripheral content exists (text or image) - SAME pass + visibility as the
    // defect detector, so primaryContentIdentified can't disagree with primaryDefects (Codex fallback #1).
    if (landmarkRegion(el) !== 'peripheral' && (hasDirectText(el) || el.tagName === 'IMG')) sawPrimaryContent = true;
    // justified-text: BLOCK container only (inline boxes don't justify their own text) (#2).
    if (s.textAlign === 'justify' && s.display !== 'inline' && hasDirectText(el)) addDefect('justified-text', el);
    // contrast: any element with its own direct visible text (broadened past a whitelist) (#4).
    if (hasDirectText(el)) { const fg = parseColor(s.color); if (fg) checkContrast(el, s, fg); }
  }
  // form controls render value text NOT in a child text node (#4). Buttons are handled by the main
  // loop via their direct text (icon-only buttons have none -> correctly skipped). Placeholder color
  // is the ::placeholder pseudo (out of scope), so gate inputs on an actual value, select always shows one.
  for (const el of document.querySelectorAll('input,textarea,select')) {
    if (isHidden(el)) continue;
    const hasVal = el.tagName === 'SELECT' || (el.value != null && String(el.value).trim().length > 0);
    if (!hasVal) continue;
    if (landmarkRegion(el) !== 'peripheral') sawPrimaryContent = true; // form-control content counts (eligibility, Codex fallback #1)
    const s = getComputedStyle(el); const fg = parseColor(s.color); if (fg) checkContrast(el, s, fg);
  }

  // primaryContentIdentified (FALLBACK rule): is there any VISIBLE non-chrome content? Computed from the
  // SAME passes/visibility as the defect detector (sawPrimaryContent: text/img/form-control), so eligibility
  // can never disagree with primaryDefects (Codex fallback #1). True unless the ENTIRE page is chrome - only
  // then EXCLUDE-WITH-FLAG. (classifyKnownGood also treats any primary defect as implying eligibility.)
  const primaryContentIdentified = sawPrimaryContent;
  return {
    labels: [...labels].sort(),                 // full-page ground truth (A1/A2)
    primaryDefects: [...primary].sort(),         // defects located in primary content
    primaryContentIdentified,
    contrastIndeterminate,
  };
}
/* c8 ignore stop */

let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  const { chromium } = await import('playwright');
  _browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  return _browser;
}
export async function closeBrowser() { if (_browser) { await _browser.close(); _browser = null; } }

export async function meta() {
  const b = await getBrowser();
  return { engine: 'chromium', browserVersion: b.version(), viewport: '1280x800', pageScripts: 'stripped', determinism: 'page-scripts stripped + reduced-motion + animations zeroed + external aborted + srgb; font-metric-independent classes' };
}

/** Render the (self-contained, script-stripped) HTML and read the objective labels authoritatively. */
export async function objectiveLabelsRendered(html, { browser } = {}) {
  const b = browser || (await getBrowser());
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.route('**/*', (route) => { const u = route.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? route.continue() : route.abort(); });
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: ANIM_OFF });
    return await page.evaluate(`(${inPageCompute.toString()})()`);
  } finally { await ctx.close(); }
}

export async function objectiveLabelsRenderedFile(file, opts) { return objectiveLabelsRendered(readFileSync(file, 'utf8'), opts); }

/**
 * Known-good classification (Jonah ruling B). Uses the referee output:
 *  - eligible: a deterministic PRIMARY region exists (main/article/role=main); else EXCLUDE-WITH-FLAG.
 *  - knownGood: eligible AND zero objective defects in PRIMARY content (peripheral chrome defects do NOT
 *    disqualify - they remain TRUE positives in full-page ground truth).
 *  - defectBearing: >=1 objective defect in PRIMARY content.
 * Full-page `labels` stay the A1/A2 ground truth regardless of this bucketing.
 */
export function classifyKnownGood(r) {
  // A primary defect implies there IS primary content (Codex fallback #1: never exclude a page that has a
  // primary defect, e.g. a broken-image in a non-chrome div with no text).
  const eligible = r.primaryContentIdentified === true || r.primaryDefects.length > 0;
  return {
    eligible,
    knownGood: eligible && r.primaryDefects.length === 0,
    defectBearing: r.primaryDefects.length > 0,
    excluded: !eligible,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('usage: objective-label-rendered.mjs <html-file>'); process.exit(2); }
  try { console.log(JSON.stringify(await objectiveLabelsRenderedFile(file), null, 2)); }
  finally { await closeBrowser(); }
}
