"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/objective-rendered-calibration.test.ts
//
// OWNED calibration for the rendered objective scanner. Proves the PRODUCT independently nails the spec on the
// HARD cases - including the referee's ADVERSARIAL INPUTS (cascade, ARIA aria-level, inert/hidden subtree,
// multi-layer alpha compositing, off-screen) authored here as HTML INPUTS from the public spec, NOT copied
// from the referee code. Per the lead's shared-blind-spot guard: "agreement = correctness" only holds if the
// product clears the hard cases on its own. (Codex item-8 on spec-correctness is the second guard.)
//
// Each clean (expect:null) fixture is asserted ALWAYS (the scanner must never false-positive). Each defect
// fixture is asserted once its class is in IMPLEMENTED_RULES; until then it is reported PENDING. So this file
// is green at S0 (no rules yet, clean-asserts hold) and tightens as S1-S4 each turn a class on.
const playwright_1 = require("playwright");
const objective_rendered_scanner_1 = require("../validators/objective-rendered-scanner");
// Grows as each step lands: S1 broken-image, S2 skipped-heading, S3 low-contrast+gray-on-color, S4 justified-text.
const IMPLEMENTED_RULES = ['broken-image', 'skipped-heading', 'low-contrast', 'gray-on-color', 'justified-text'];
const doc = (head, body) => `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
// 1x1 transparent PNG data URI - a VALID image source (renders, naturalWidth>0), for clean-image fixtures.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FIXTURES = [
    // ---- broken-image ----
    { name: 'bi/missing-src', expect: 'broken-image', html: doc('', '<img alt="logo">') },
    { name: 'bi/empty-src', expect: 'broken-image', html: doc('', '<img src="" alt="logo">') },
    { name: 'bi/valid-data-uri', expect: null, html: doc('', `<img src="${PNG}" alt="ok">`) },
    { name: 'bi/ADV-hidden-still-structural', expect: 'broken-image', note: 'a missing src is a STRUCTURAL defect regardless of CSS visibility (DOM-structural, not visual)', html: doc('', '<div style="display:none"><img alt="hidden but srcless"></div>') },
    { name: 'bi/ADV-valid-src-hidden-clean', expect: null, note: 'hidden img WITH a valid src is not a broken reference', html: doc('', `<div style="display:none"><img src="${PNG}" alt="ok"></div>`) },
    // ---- skipped-heading (WCAG 1.3.1) ----
    { name: 'sh/h1-then-h3', expect: 'skipped-heading', html: doc('', '<h1>Title</h1><h3>Sub</h3>') },
    { name: 'sh/proper-order', expect: null, html: doc('', '<h1>Title</h1><h2>Section</h2><h3>Sub</h3>') },
    { name: 'sh/ADV-aria-level-skip', expect: 'skipped-heading', note: 'role=heading aria-level 1 then 3 (a11y-tree, not tag)', html: doc('', '<div role="heading" aria-level="1">A</div><div role="heading" aria-level="3">B</div>') },
    { name: 'sh/ADV-sr-only-counts', expect: 'skipped-heading', note: 'visually-hidden heading still in a11y tree -> the skip still counts', html: doc('', '<h1>Title</h1><h2 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">hidden</h2><h4>Deep</h4>') },
    { name: 'sh/ADV-presentation-role-excluded', expect: null, note: 'role=presentation strips heading semantics -> the h4 is NOT in the outline, so h1->h2 has no skip (counting it would falsely read h1->h4)', html: doc('', '<h1>Title</h1><h4 role="presentation">decorative big text</h4><h2>Section</h2>') },
    // ---- low-contrast (WCAG 1.4.3 + CSS Color 4 compositing) ----
    { name: 'lc/gray-on-white', expect: 'low-contrast', note: '#999 on #fff ~ 2.85:1 < 4.5', html: doc('', '<p style="color:#999;background:#fff">body text that is too light to read comfortably</p>') },
    { name: 'lc/black-on-white-ok', expect: null, html: doc('', '<p style="color:#000;background:#fff">crisp readable body text</p>') },
    { name: 'lc/ADV-cascade-specificity', expect: 'low-contrast', note: 'a more-specific selector wins the color -> must use the CASCADED value', html: doc('<style>p{color:#000}body p.faint{color:#aaa}</style>', '<p class="faint" style="background:#fff">specificity makes this faint despite the base rule</p>') },
    { name: 'lc/ADV-multilayer-alpha', expect: 'low-contrast', note: 'text alpha over stacked translucent backgrounds (CSS Color 4 back-to-front compositing)', html: doc('', '<div style="background:#fff"><div style="background:rgba(0,0,0,0.05)"><p style="color:rgba(0,0,0,0.45);background:rgba(255,255,255,0.0)">composited faint text on near-white</p></div></div>') },
    { name: 'lc/ADV-opaque-container-under-bgimage-body', expect: 'low-contrast', note: 'CSS Color 4 paint order: an OPAQUE container occludes an ancestor background-image, so the bg behind the text is the opaque color (resolvable), not indeterminate', html: doc('<style>body{background-image:linear-gradient(#000,#000)}</style>', '<div style="background:#fff"><p style="color:#999">faint gray on an opaque white card inside a bg-image body</p></div>') },
    { name: 'lc/ADV-text-on-bgimage-no-opaque-base', expect: null, note: 'text directly over a background-image with NO opaque base beneath -> contrast is INDETERMINATE -> no finding (fail-safe, no false positive)', html: doc('', '<div style="background-image:linear-gradient(#222,#777)"><p style="color:#888">text on a gradient with no solid base</p></div>') },
    { name: 'lc/ADV-sronly-1px-clip-not-flagged', expect: null, note: 'sr-only 1px-clip variant rect(1px,1px,1px,1px) (older Bootstrap) hides text from sighted users; axe-core EXCLUDES sr-only from contrast - must NOT be flagged low-contrast despite #999 color', html: doc('', '<p style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);color:#999;background:#fff">visually hidden faint text</p>') },
    { name: 'lc/ADV-sronly-zeroarea-clip-large-box-not-flagged', expect: null, note: 'zero-area clip rect(0,0,0,0) on a NON-1px box still hides text -> excluded from contrast (clip-parse path, not the size path)', html: doc('', '<p style="position:absolute;width:200px;height:40px;overflow:hidden;clip:rect(0,0,0,0);color:#999;background:#fff">clipped-to-nothing faint text on a normal-sized box</p>') },
    // ---- gray-on-color (WCAG 1.4.3) ----
    { name: 'goc/gray-on-blue', expect: 'gray-on-color', note: 'desaturated #888 on chromatic #2a5db0', html: doc('', '<p style="color:#888;background:#2a5db0">washed-out gray text on a colored panel</p>') },
    { name: 'goc/white-on-blue-ok', expect: null, html: doc('', '<p style="color:#fff;background:#2a5db0">clear white on blue</p>') },
    // ---- justified-text (WCAG 1.4.8) ----
    { name: 'jt/justified-block', expect: 'justified-text', html: doc('', '<p style="text-align:justify;width:300px">This is a multi word paragraph of running body text that has been justified. It has more than one sentence producing uneven inter word spacing rivers.</p>') },
    { name: 'jt/left-aligned-ok', expect: null, html: doc('', '<p style="text-align:left;width:300px">This running body text is left aligned which is the readable default.</p>') },
    // ---- BATCH-2 general-spec fixtures (Codex item-8) ----
    { name: 'b2/color-oklch-low-contrast', expect: 'low-contrast', note: '#6 modern CSS Color 4 color() must parse (canvas) - light oklch gray on white', html: doc('', '<p style="color:oklch(0.78 0 0);background:#fff">faint oklch gray text that a legacy rgb-only parser would skip</p>') },
    { name: 'b2/bi-external-src-not-broken', expect: null, note: 'revert-#2: an external src whose LOAD aborts under the hermetic render is NOT a structural defect (src present) - the src-attribute basis must not over-flag it', html: doc('', '<img src="https://example.com/logo.png" alt="external">') },
    { name: 'b2/sh-aria-level-on-native-h', expect: 'skipped-heading', note: '#2 aria-level on a native h overrides tag level: h1 then h2[aria-level=4] = 1->4 skip', html: doc('', '<h1>Title</h1><h2 aria-level="4">deep</h2>') },
    { name: 'b2/sh-role-token-list', expect: 'skipped-heading', note: '#1 role token list "heading x" first token = heading: level1 then level3', html: doc('', '<div role="heading x" aria-level="1">A</div><div role="heading y" aria-level="3">B</div>') },
    { name: 'b2/sh-htag-nonheading-role', expect: null, note: '#1 an h-tag with a KNOWN non-heading explicit role (button) is NOT a heading (no outline -> no skip)', html: doc('', '<h1>Title</h1><h4 role="button">action styled big</h4><h2>Section</h2>') },
    { name: 'b2/sh-role-invalid-first-token', expect: 'skipped-heading', note: '#1 first VALID token wins: role="x heading" -> heading (x unknown, skipped); level1 then level3', html: doc('', '<div role="zzz heading" aria-level="1">A</div><div role="heading" aria-level="3">B</div>') },
    { name: 'b2/sh-htag-unknown-role-implicit', expect: 'skipped-heading', note: '#1 an h-tag with an UNKNOWN role falls back to IMPLICIT heading: h1 then h3[role=unknown] = 1->3 skip', html: doc('', '<h1>Title</h1><h3 role="zzzfoo">Sub</h3>') },
    { name: 'b2/sh-htag-real-nonheading-role-meter', expect: null, note: 'batch2-confirm #1: a REAL non-heading role (meter) on an h-tag strips heading semantics (no false skip); complete role set required', html: doc('', '<h1>Title</h1><h4 role="meter">75%</h4><h2>Section</h2>') },
    { name: 'b2/lc-visibility-visible-descendant', expect: 'low-contrast', note: '#8 visibility:hidden parent + visibility:visible child is VISIBLE', html: doc('', '<div style="visibility:hidden"><p style="visibility:visible;color:#999;background:#fff">faint visible-override text</p></div>') },
    { name: 'b2/lc-opacity-group-indeterminate', expect: null, note: '#4 ancestor opacity<1 = opacity group -> contrast indeterminate -> no finding (conservative)', html: doc('', '<div style="opacity:0.5"><p style="color:#999;background:#fff">faint text under a group opacity</p></div>') },
    { name: 'b2/lc-filter-detected', expect: 'low-contrast', note: 'revert-#3: axe-core/Lighthouse IGNORE CSS filter and compute declared-color contrast - filtered low-contrast text IS flagged (standard, not skipped)', html: doc('', '<div style="filter:contrast(0.5)"><p style="color:#999;background:#fff">faint text under a filter, still declared-color low-contrast</p></div>') },
    { name: 'b2/lc-below-fold-detected', expect: 'low-contrast', note: 'revert-#5: below-the-fold text is on the PAGE and must be scanned (a 2000px top margin pushes it past the 800px viewport fold)', html: doc('', '<div style="margin-top:2000px"><p style="color:#999;background:#fff">faint text far below the fold must still be detected</p></div>') },
];
async function run() {
    const impl = new Set(IMPLEMENTED_RULES);
    const browser = await playwright_1.chromium.launch({ headless: true });
    const failures = [];
    let asserted = 0, pending = 0;
    try {
        for (const f of FIXTURES) {
            const findings = await (0, objective_rendered_scanner_1.analyzeHtmlOnBrowser)(browser, f.html, 20000);
            const firedImplemented = findings.filter((x) => impl.has(x.rule)).map((x) => x.rule);
            if (f.expect === null) {
                // clean / adversarial-exclusion fixture: NO implemented rule may fire. Asserted always.
                asserted++;
                if (firedImplemented.length)
                    failures.push(`${f.name}: expected CLEAN but fired [${firedImplemented.join(',')}]${f.note ? ' (' + f.note + ')' : ''}`);
            }
            else if (impl.has(f.expect)) {
                asserted++;
                if (!findings.some((x) => x.rule === f.expect))
                    failures.push(`${f.name}: expected ${f.expect} not detected${f.note ? ' (' + f.note + ')' : ''}`);
            }
            else {
                pending++; // class not implemented yet
            }
        }
    }
    finally {
        await browser.close();
    }
    if (failures.length)
        throw new Error(`objective-rendered calibration FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
    console.log(`objective-rendered-calibration: OK (${asserted} asserted, ${pending} pending; implemented: [${IMPLEMENTED_RULES.join(', ') || 'none yet (S0 scaffold)'}])`);
}
run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
//# sourceMappingURL=objective-rendered-calibration.test.js.map