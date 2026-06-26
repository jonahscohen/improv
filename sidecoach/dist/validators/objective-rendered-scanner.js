"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBJECTIVE_RULES = void 0;
exports.stripScripts = stripScripts;
exports.inPageObjective = inPageObjective;
exports.analyzeHtmlOnBrowser = analyzeHtmlOnBrowser;
exports.scanObjectiveRendered = scanObjectiveRendered;
/**
 * OWNED rendered OBJECTIVE scanner (Sidecoach Stage 1 - reimplement-and-own).
 *
 * Detects the spec-grounded OBJECTIVE a11y/quality classes by RENDERING the page and reading the real DOM +
 * computed styles - the classes a faithful implementation of the public spec must agree on:
 *   - broken-image        : <img> with no usable source / fails to render (renders as a broken box)
 *   - skipped-heading     : WCAG 1.3.1 - the heading outline skips a level (e.g. h1 then h3)
 *   - low-contrast        : WCAG 1.4.3 - text/background contrast below the AA ratio (CSS Color 4 compositing)
 *   - gray-on-color       : WCAG 1.4.3 - desaturated (gray) text on a chromatic background, AA-failing
 *   - justified-text      : WCAG 1.4.8 - justified body text (uneven spacing / rivers; AAA 1.4.8 disallows)
 *
 * AUTHORED FROM PUBLIC SPECS ONLY (WCAG 2.x SC 1.3.1 / 1.4.3 / 1.4.8 ; CSS Color Module Level 4 alpha
 * compositing ; WAI-ARIA heading roles). Copies NOTHING from oracle.
 *
 * INDEPENDENCE (eval integrity): this is the PRODUCT scanner. It is a DISTINCT artifact from the eval
 * ground-truth referee (eval/objective-label-rendered.mjs). It MUST NOT import anything under eval/. Both
 * draw on the same PUBLIC specs; neither shares code with the other. The committed test
 * src/__tests__/referee-independence.test.ts mechanically enforces zero eval/ imports in this module's graph.
 *
 * ENGINE: reuses the product's already-shipped Playwright dependency + the same render-determinism +
 * hermeticity posture as src/validators/browser-evidence-collector.ts (no new engine / dependency). Render is
 * deterministic + spec-faithful: page scripts stripped, external subresources blocked (inline content only),
 * fixed 1280x800 viewport, reduced motion - so objective defects reflect the authored HTML/CSS, reproducibly.
 *
 * STAGE 1 / S0 STATUS: render harness + types + independence boundary established; the per-class in-page
 * classification (S1-S4) is added incrementally. With no rules implemented yet, scanObjectiveRendered renders
 * and returns []. Each subsequent step fills one class and turns its calibration fixtures green.
 */
const playwright_1 = require("playwright");
exports.OBJECTIVE_RULES = [
    'broken-image', 'skipped-heading', 'low-contrast', 'gray-on-color', 'justified-text',
];
// Spec-grounded render determinism (standard, NOT referee-specific): strip page scripts so JS cannot mutate
// the DOM non-deterministically; the objective classes are properties of the authored HTML/CSS.
function stripScripts(html) {
    return String(html)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<script\b[^>]*\/?>/gi, '');
}
/**
 * The in-page objective analysis. Runs INSIDE the rendered page (serialized to the browser by page.evaluate),
 * so it must be fully self-contained (no outer-scope references). S0: scaffold returning []. S1-S4 add each
 * class's spec-faithful detection here.
 */
/* istanbul ignore next - executes in the browser context (serialized by page.evaluate; must be self-contained) */
function inPageObjective() {
    const findings = [];
    const add = (rule, el, detail, severity = 'error') => findings.push({ rule, severity, selector: sel(el), detail });
    function sel(el) {
        const t = el.tagName.toLowerCase();
        if (el.id)
            return `${t}#${el.id}`;
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return cls ? `${t}.${cls}` : t;
    }
    // ---- WCAG color math (sRGB relative luminance + contrast ratio) ----
    // parseColor via a 2D canvas (Codex item-8 #6): getComputedStyle can return CSS Color 4 modern syntax
    // (space/slash rgb, lab(), oklch(), color(display-p3 ...)); a legacy rgb()/rgba() regex would silently drop
    // those. The canvas converts ANY valid CSS color to straight-alpha sRGB rgba, robustly. Memoized per string.
    const _cctx = (() => { try {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        return c.getContext('2d', { willReadFrequently: true });
    }
    catch {
        return null;
    } })();
    const _colorCache = new Map();
    function parseColor(s) {
        if (!s)
            return null;
        if (_colorCache.has(s))
            return _colorCache.get(s);
        let out = null;
        if (_cctx) {
            try {
                _cctx.clearRect(0, 0, 1, 1);
                _cctx.fillStyle = '#000';
                const before = _cctx.fillStyle;
                _cctx.fillStyle = s;
                if (_cctx.fillStyle !== before || /^(#000000|black|rgb\(0, ?0, ?0\))$/i.test(s.trim())) {
                    _cctx.fillRect(0, 0, 1, 1);
                    const d = _cctx.getImageData(0, 0, 1, 1).data;
                    out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
                }
            }
            catch {
                out = null;
            }
        }
        if (!out) { // fallback: legacy rgb()/rgba()
            const m = s.match(/rgba?\(([^)]+)\)/i);
            if (m) {
                const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()));
                if (![p[0], p[1], p[2]].some((n) => Number.isNaN(n)))
                    out = { r: p[0], g: p[1], b: p[2], a: Number.isNaN(p[3]) ? 1 : p[3] };
            }
        }
        _colorCache.set(s, out);
        return out;
    }
    // straight-alpha "over" compositing of src onto opaque dst (CSS Color 4 simple-alpha-compositing)
    function over(src, dst) {
        return { r: src.r * src.a + dst.r * (1 - src.a), g: src.g * src.a + dst.g * (1 - src.a), b: src.b * src.a + dst.b * (1 - src.a) };
    }
    function lum(c) {
        // sRGB linearization breakpoint 0.04045 (CSS Color 4 / current spec; Codex item-8 #7).
        const f = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function ratio(a, b) {
        const l1 = lum(a), l2 = lum(b);
        const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
        return (hi + 0.05) / (lo + 0.05);
    }
    const chroma = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    // ---- visibility predicates (two, per spec) ----
    // VISUAL: rendered to sighted users (contrast / broken-image / justified). Excludes display:none, visibility:hidden,
    // cumulative opacity ~0, zero box, off-screen, and sr-only (clipped/1px/indented) text.
    // CSS visibility INHERITS but a descendant can override it back to visible (Codex item-8 #8): so use the
    // ELEMENT's OWN computed visibility (already resolves inheritance + override) rather than failing on any
    // ancestor visibility:hidden. display:none on an ancestor removes the box -> caught by getClientRects().
    function visuallyVisible(el) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (parseFloat(getComputedStyle(n).opacity) === 0)
                return false;
        }
        const r = el.getClientRects();
        if (!r.length)
            return false; // display:none anywhere -> no box
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1)
            return false; // sub-1px = no rendered box
        // sr-only 1px box: an EXACTLY-1px box (older Bootstrap/framework .sr-only = width:1px;height:1px) renders no
        // perceptible glyphs ONLY when overflow clips them. Pair the 1px test with a non-visible overflow (Codex
        // review): a 1px box with overflow:visible would paint glyphs outside its box and IS readable, so don't
        // over-exclude it. Standard-aligned: axe-core excludes visually-hidden (clipped) text from contrast.
        if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible')
            return false;
        if (box.right <= 0 || box.bottom <= 0)
            return false; // off-screen top/left
        // (Reverted Codex batch2 #5's box.left>=innerWidth/box.top>=innerHeight: innerWidth/Height are the VIEWPORT,
        // not the page, so that excluded BELOW-THE-FOLD content as if off-screen - a bug that ate most page text.
        // Below-the-fold is on the page and must be scanned; genuine off-screen is handled by the top/left + sr-only checks.)
        if (parseFloat(cs.textIndent) <= -999)
            return false; // text-indent off-screen
        // sr-only clip: a rect() that clips to ZERO AREA hides the text. The all-zeros rect(0,0,0,0) AND the
        // collapse-to-empty rect(1px,1px,1px,1px) variant (older Bootstrap .sr-only) both qualify - parse the four
        // edges and exclude when right<=left or bottom<=top (zero-area clip), not just the literal all-zeros form.
        const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
        if (clipM) {
            const [t, rr, b, l] = [parseFloat(clipM[1]), parseFloat(clipM[2]), parseFloat(clipM[3]), parseFloat(clipM[4])];
            if (rr <= l || b <= t)
                return false;
        }
        if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || ''))
            return false; // sr-only clip-path inset(100%)
        return true;
    }
    // A11Y TREE (heading order): use the element's OWN computed visibility (inheritance/override) + walk ancestors
    // for display:none / aria-hidden (normalized) / inert. INCLUDES sr-only (still announced).
    function ariaVisible(el) {
        if (getComputedStyle(el).visibility !== 'visible')
            return false;
        for (let n = el; n && n instanceof Element; n = n.parentElement) {
            if (getComputedStyle(n).display === 'none')
                return false;
            if ((n.getAttribute('aria-hidden') || '').trim().toLowerCase() === 'true')
                return false;
            if (n.hasAttribute('inert'))
                return false;
        }
        return true;
    }
    // resolved opaque background behind an element, by CSS paint order (CSS Color 4 / painting): backgrounds
    // paint back-to-front, ancestor-first, so the element's own bg is topmost behind its text. Walk element->root
    // (topmost first), compositing translucent layers, and STOP at the first OPAQUE background-color: it occludes
    // everything painted behind it (including any ancestor background-image). Return null (indeterminate) ONLY
    // when a non-solid backdrop (background-image/gradient) is the nearest backdrop with no opaque base above it -
    // i.e. a bg-image is reached before any opaque color. (Fixes the bug where ANY ancestor bg-image forced
    // indeterminate even when a nearer opaque color exists.)
    function resolvedBg(el) {
        // Phase 1 (#4, opacity): return INDETERMINATE if any element on the path to root applies group opacity<1.
        // Justified by the STANDARD: a partial group opacity composites the WHOLE subtree (incl an opaque-bg
        // descendant) over whatever is behind it, so the EFFECTIVE backdrop color the text is read against can't be
        // determined from the static cascade alone - axe-core returns "incomplete" (a needs-review, not a pass/fail)
        // for exactly this case rather than guessing an effective contrast. We mirror that: don't fabricate a verdict
        // we can't ground. This must be a FULL-PATH check (not folded into phase 2) because phase 2 stops at the first
        // opaque bg and would miss an ancestor opacity above it.
        for (let cur = el; cur && cur instanceof Element; cur = cur.parentElement) {
            const cs = getComputedStyle(cur);
            if (parseFloat(cs.opacity) < 1)
                return null; // group opacity<1 -> indeterminate (axe-core "incomplete")
            // (Reverted Codex batch2 #3's filter/mix-blend/backdrop-filter indeterminate: axe-core + Lighthouse IGNORE
            // CSS filter and compute declared-color contrast; skipping filtered text was non-standard over-conservatism
            // that under-detected. Justified by the standard tools, referee-invisible.)
        }
        // Phase 2: paint-order backdrop resolution - walk element->root (topmost first), composite translucent
        // layers, STOP at the first opaque background-color (it occludes everything behind, incl an ancestor
        // background-image). Indeterminate if a background-image is the nearest backdrop with no opaque base above.
        const layers = []; // topmost (element) first
        for (let cur = el; cur && cur instanceof Element; cur = cur.parentElement) {
            const cs = getComputedStyle(cur);
            if (cs.backgroundImage && cs.backgroundImage !== 'none')
                return null;
            const bc = parseColor(cs.backgroundColor);
            if (bc && bc.a > 0) {
                layers.push(bc);
                if (bc.a === 1) {
                    let base = { r: bc.r, g: bc.g, b: bc.b };
                    for (let i = layers.length - 2; i >= 0; i--)
                        base = over(layers[i], base);
                    return base;
                }
            }
        }
        let base = { r: 255, g: 255, b: 255 }; // reached root with only translucent layers -> page canvas (white)
        for (let i = layers.length - 1; i >= 0; i--)
            base = over(layers[i], base);
        return base;
    }
    function hasDirectText(el) {
        for (const n of Array.from(el.childNodes))
            if (n.nodeType === 3 && (n.textContent || '').trim().length >= 2)
                return true;
        return false;
    }
    const all = Array.from(document.body ? document.body.querySelectorAll('*') : []);
    // ---- S1: broken-image (STRUCTURAL: an <img> whose src attribute is absent/empty references no image) ----
    // DOM-structural, not load-state: under a deterministic hermetic render external loads are blocked, so
    // naturalWidth/load-failure is meaningless (it would flag every external <img>); the spec-faithful signal is
    // the AUTHORED src attribute. Structural defects are flagged regardless of CSS visibility (a missing src is a
    // defect whether or not the element is painted).
    for (const img of Array.from(document.querySelectorAll('img'))) {
        // STRUCTURAL: src attribute absent/empty references no image. (Reverted Codex batch2 #2's currentSrc check:
        // under our hermetic ABORT-EXTERNAL render an external img's load is aborted -> currentSrc is EMPTY even
        // though a source was authored, so !currentSrc over-flagged every external img. src-attribute is the
        // load-independent structural signal that is correct under abort-external.)
        const srcAttr = img.getAttribute('src');
        if (srcAttr === null || srcAttr.trim() === '')
            add('broken-image', img, 'missing/empty src');
    }
    // ---- S2: skipped-heading (WCAG 1.3.1; a11y-tree heading outline) ----
    // ARIA role-token processing (Codex item-8 #1): the role is a space-separated token list; the FIRST valid
    // token is the element's role (an explicit role overrides the implicit one). aria-level (Codex #2) defines the
    // heading level and applies to NATIVE h1-h6 too (HTML-AAM maps h1-h6 -> heading w/ tag level; aria-level overrides).
    // WAI-ARIA role resolution: the effective role is the FIRST VALID (known, non-abstract) token of the role
    // list; unknown tokens are skipped, and if no valid token is present the IMPLICIT role applies (Codex batch2 #1).
    // So role="x heading" -> heading (x unknown), and <h2 role="x"> -> implicit heading (x unknown).
    // Complete non-abstract WAI-ARIA 1.2 role set (Codex batch2-confirm #1): an incomplete set would mis-resolve a
    // real role as unknown and wrongly fall back to the implicit heading. Abstract roles (command, composite,
    // input, landmark, range, roletype, section, sectionhead, select, structure, widget, window) are excluded.
    const KNOWN_ROLES = new Set(['alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption', 'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem']);
    const headings = [];
    for (const el of all) {
        const isHTag = /^h[1-6]$/i.test(el.tagName);
        const tokens = (el.getAttribute('role') || '').toLowerCase().split(/\s+/).filter(Boolean);
        let effRole = '';
        for (const t of tokens) {
            if (KNOWN_ROLES.has(t)) {
                effRole = t;
                break;
            }
        } // first VALID token
        if (!effRole)
            effRole = isHTag ? 'heading' : ''; // no valid explicit role -> implicit
        if (effRole !== 'heading')
            continue; // presentation/none/non-heading explicit role strips heading semantics
        const alStr = (el.getAttribute('aria-level') || '').trim();
        const al = /^[1-9][0-9]*$/.test(alStr) ? parseInt(alStr, 10) : NaN; // valid positive integer only (#4)
        const level = Number.isFinite(al) ? al : (isHTag ? Number(el.tagName[1]) : 2);
        if (!ariaVisible(el))
            continue;
        headings.push({ level, el });
    }
    for (let i = 1; i < headings.length; i++) {
        if (headings[i].level > headings[i - 1].level + 1) {
            add('skipped-heading', headings[i].el, `h${headings[i - 1].level} -> h${headings[i].level} skips a level`);
        }
    }
    // ---- S3: low-contrast + gray-on-color (WCAG 1.4.3; CSS Color 4 compositing) ----
    for (const el of all) {
        if (!hasDirectText(el) || !visuallyVisible(el))
            continue;
        const cs = getComputedStyle(el);
        const fg0 = parseColor(cs.color);
        if (!fg0)
            continue;
        const bg = resolvedBg(el);
        if (!bg)
            continue; // indeterminate (background-image)
        const fg = fg0.a < 1 ? over(fg0, bg) : { r: fg0.r, g: fg0.g, b: fg0.b };
        const sizePx = parseFloat(cs.fontSize) || 16;
        const weight = parseInt(cs.fontWeight, 10) || 400;
        // WCAG "large text" = 18pt (24px) or 14pt bold; 14pt = 14*96/72 = 18.6666...px. Use a threshold just below
        // so a computed 14pt (which can serialize as 18.6667px) is correctly classified large (Codex batch2 #3).
        const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
        const threshold = large ? 3.0 : 4.5;
        const cr = ratio(fg, bg);
        if (cr < threshold) {
            add('low-contrast', el, `${cr.toFixed(2)}:1 (need ${threshold}:1)`);
            // gray-on-color is a PRODUCT SUBTYPE of WCAG 1.4.3 low-contrast (NOT a separate WCAG SC; Codex item-8 #9):
            // an AA-failing case where the text is (near-)achromatic and the background is chromatic. Thresholds are
            // a documented product heuristic (RGB channel spread), not a spec constant.
            if (chroma(fg) <= 16 && chroma(bg) >= 24)
                add('gray-on-color', el, `gray text ${cr.toFixed(2)}:1 on colored bg`);
        }
    }
    // ---- S4: justified-text (WCAG 1.4.8; justified BLOCK of text) ----
    // WCAG 1.4.8 applies to a "block of text" (more than one sentence). text-align (incl justify-all) applies to
    // block containers (Codex item-8 #10): require a block-ish display + multi-sentence running text, not a word count.
    const BLOCKISH = new Set(['block', 'list-item', 'table-cell', 'flow-root', 'table-caption']);
    for (const el of all) {
        if (!hasDirectText(el) || !visuallyVisible(el))
            continue;
        const cs = getComputedStyle(el);
        if (cs.textAlign !== 'justify' && cs.textAlign !== 'justify-all')
            continue;
        if (!BLOCKISH.has(cs.display))
            continue; // text-align justifies block containers, not inline boxes
        const text = (el.textContent || '').trim();
        const sentences = (text.match(/[.!?](\s|$)/g) || []).length;
        if (sentences >= 2 || text.length >= 120)
            add('justified-text', el, 'justified block of text (uneven word spacing)', 'warning');
    }
    return findings;
}
const HERMETIC = { stripScripts: true, abortExternal: true, viewport: { width: 1280, height: 800 } };
async function analyzeHtmlOnBrowser(browser, html, timeoutMs = 30000, render = {}) {
    const r = { ...HERMETIC, ...render };
    const context = await browser.newContext({ viewport: r.viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    try {
        const page = await context.newPage();
        if (r.abortExternal) {
            await page.route('**/*', (route) => { const u = route.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? route.continue() : route.abort(); });
        }
        await page.setContent(r.stripScripts ? stripScripts(html) : html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        return await page.evaluate(inPageObjective);
    }
    finally {
        try {
            await context.close();
        }
        catch { /* */ }
    }
}
/**
 * Render an HTML string deterministically and return the objective findings. FAIL-CLOSED: a launch/render
 * error or timeout returns { available:false } - never a false "0 findings = clean" result.
 */
async function scanObjectiveRendered(html, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 30000;
    const launch = opts.launcher ?? (() => playwright_1.chromium.launch({ headless: true }));
    let browser;
    try {
        browser = await launch();
        const findings = await analyzeHtmlOnBrowser(browser, html, timeoutMs);
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
//# sourceMappingURL=objective-rendered-scanner.js.map