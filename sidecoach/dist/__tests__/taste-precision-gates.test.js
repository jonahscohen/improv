"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/taste-precision-gates.test.ts
//
// OWNED test for the 2026-07-28 taste-precision retune. Each assertion pins a decision that was made from a
// MEASUREMENT, so a later change that silently reverts the decision fails here rather than in a corpus run
// nobody re-executes.
//
// What the retune decided, and what each block below locks:
//   1. marketing-buzzword v4 qualify gate = >= 2 distinct PEAK terms. The in-page scorer must carry an INLINE
//      copy of the threshold (it is serialized by page.evaluate and cannot import), so the two copies are
//      compared against the scanner's own source text - drift is a test failure, not a silent detector change.
//      Same guard shape as typeface-vocabulary.test.ts.
//   2. nested-cards ships its operating point UNCHANGED - the attempted viewport-width guard was REJECTED by
//      its own held-out measurement - and emits ONE finding per page.
//   3. default-typeface ground A is GATED OFF by default and reachable only by explicit opt-in.
//   4. numbered-section-markers is GONE - from the rule list and from the rendered registry manifest.
//   5. the page-level judgments emit ONE finding per page, and the detect CLI collapses the per-element
//      objective rules for display.
//
// Every browser assertion is paired: the anchor is asserted PRESENT before any absence is believed, so a
// "did not fire" can never pass because the fixture failed to render.
const playwright_1 = require("playwright");
const node_fs_1 = require("node:fs");
const path = __importStar(require("path"));
const subjective_rendered_scanner_1 = require("../validators/subjective-rendered-scanner");
const product_rule_registry_1 = require("../product-rule-registry");
const SC = path.resolve(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const detect = require(path.join(SC, 'bin', 'sidecoach-detect.js'));
const failures = [];
let asserted = 0;
const check = (cond, msg) => { asserted++; if (!cond)
    failures.push(msg); };
// Read a frozen constant WITHOUT letting TypeScript narrow it to its literal type. `const x: number = CONST`
// still narrows through the initializer, which turns `x === 2` into a COMPILE-time tautology that can never fail
// at runtime - the vacuous-assertion shape this repo has been repairing. A function's declared return type is not
// narrowed, so these two helpers make the comparisons below real.
const asNumber = (v) => v;
const asBoolean = (v) => v;
/* ---- 1. the buzzword gate's inline copy must equal the exported constant --------------------------------- */
{
    const src = (0, node_fs_1.readFileSync)(path.join(SC, 'src', 'validators', 'subjective-rendered-scanner.ts'), 'utf8');
    // SCOPED to the body of inPageBuzzword. An unscoped /const BUZZ_MIN_DISTINCT_PEAK = (\d+);/ also matches the
    // `export const` line, so deleting the inline copy entirely - which BREAKS the serialized in-page scorer,
    // because page.evaluate cannot close over a module binding - would still satisfy it. That assertion would have
    // passed while the detector was broken.
    const fnStart = src.indexOf('export function inPageBuzzword()');
    check(fnStart >= 0, 'ANCHOR: inPageBuzzword must exist in the scanner source');
    const fnBody = fnStart >= 0 ? src.slice(fnStart, src.indexOf('\nexport const BUZZ_MIN_DISTINCT_PEAK', fnStart)) : '';
    const m = fnBody.match(/^ {2}const BUZZ_MIN_DISTINCT_PEAK = (\d+);$/m);
    check(!!m, 'inPageBuzzword must declare an inline BUZZ_MIN_DISTINCT_PEAK in its OWN body (it cannot import one)');
    if (m) {
        check(Number(m[1]) === subjective_rendered_scanner_1.BUZZ_MIN_DISTINCT_PEAK, `inline BUZZ_MIN_DISTINCT_PEAK (${m[1]}) has drifted from the exported constant (${subjective_rendered_scanner_1.BUZZ_MIN_DISTINCT_PEAK})`);
    }
    const gate = asNumber(subjective_rendered_scanner_1.BUZZ_MIN_DISTINCT_PEAK);
    check(gate === 2, `the retune froze the buzzword gate at 2 distinct PEAK terms; it now reads ${gate}. Changing it is a re-tune and needs a fresh held-out measurement.`);
}
/* ---- 2. nested-cards: operating point UNCHANGED (the retune was rejected by its own held-out), ONE finding -- */
{
    const pair = (outerViewportWidthFrac) => ({
        outerSelector: 'div.outer', innerSelector: 'div.inner',
        outerW: 400, outerH: 300, innerW: 200, innerH: 120,
        areaFrac: 0.2, outerRadius: 12, innerRadius: 8,
        outerBorder: true, outerShadow: false, innerBorder: true, innerShadow: false,
        outerViewportWidthFrac,
    });
    const scoreWith = (frac) => ({ cardCount: 2, viewportWidth: 1280, pairs: [pair(frac)] });
    check((0, subjective_rendered_scanner_1.nestedCardsFindingFromScore)(scoreWith(0.3)) !== null, 'nested-cards must fire on a nested pair');
    // The 2026-07-28 viewport-width guard was REJECTED: it gained +0.067 precision on the tuning population and
    // LOST 0.250 on the untouched held-out, removing 2 true positives and 0 false positives there. This asserts the
    // rejection stuck - a full-bleed outer box must STILL fire, because no measurement supported suppressing it.
    check((0, subjective_rendered_scanner_1.nestedCardsFindingFromScore)(scoreWith(1.0)) !== null, 'nested-cards must still fire on a full-bleed outer box - the viewport-width guard was rejected by its held-out measurement, so re-adding it needs a fresh one');
    check((0, subjective_rendered_scanner_1.nestedCardsFindingFromScore)({ cardCount: 0, viewportWidth: 1280, pairs: [] }) === null, 'nested-cards must not fire with no nested pairs');
    // ONE finding per page even with many qualifying pairs (the dedupe). The COUNT assertion below is what proves
    // it: a 25-pair score must yield a single finding that SAYS 25, so an implementation that emitted 25 findings
    // (the old behaviour) or lost the count would fail. `nestedCardsFindingFromScore` returns at most one finding
    // by signature, so the real one-per-page proof for the production path is the browser check at the bottom of
    // this file, which counts findings out of the actual analyzer.
    const many = { cardCount: 40, viewportWidth: 1280, pairs: Array.from({ length: 25 }, () => pair(0.3)) };
    const f = (0, subjective_rendered_scanner_1.nestedCardsFindingFromScore)(many);
    check(f !== null, 'nested-cards must emit a finding for a 25-pair score');
    check(!!f && /25 card-in-card nesting/.test(f.detail || ''), `the single nested-cards finding must carry the COUNT (got: ${f ? f.detail : 'null'})`);
}
/* ---- 3. default-typeface ground A is gated off by default ------------------------------------------------- */
{
    const score = {
        contentChars: subjective_rendered_scanner_1.TYPEFACE_MIN_CONTENT_CHARS + 500,
        defaultStackChars: subjective_rendered_scanner_1.TYPEFACE_MIN_CONTENT_CHARS + 500,
        defaultStackShare: 1.0,
        families: [{ family: 'system-ui', chars: subjective_rendered_scanner_1.TYPEFACE_MIN_CONTENT_CHARS + 500 }],
        dominantFamily: 'system-ui', dominantShare: 1.0,
        declaredFamilies: [], defaultSelector: 'p',
    };
    const gated = asBoolean(subjective_rendered_scanner_1.DEFAULT_STACK_GROUND_GATED);
    check(gated === true, 'default-typeface ground A must stay GATED until its real-page precision is measured (see the scanner note)');
    check(score.defaultStackShare >= subjective_rendered_scanner_1.DEFAULT_STACK_SHARE, 'ANCHOR: the probe score must be above the ground-A threshold, or the silence below proves nothing');
    check((0, subjective_rendered_scanner_1.typefaceFindingFromScore)(score, { enableDefaultStackGround: true }) !== null, 'ANCHOR: ground A must still fire when explicitly opted in - the gate is a default, not a deletion');
    check((0, subjective_rendered_scanner_1.typefaceFindingFromScore)(score, {}) === null, 'default-typeface ground A must be SILENT with no opt-in');
    // ground B is unaffected by the gate and still fires on a known-but-absent committed family.
    const chosen = { ...score, defaultStackChars: 0, defaultStackShare: 0, dominantFamily: 'alluvium sans', families: [{ family: 'alluvium sans', chars: 700 }] };
    check((0, subjective_rendered_scanner_1.typefaceFindingFromScore)(chosen, { brandFamilies: ['Verge Serif'] }) !== null, 'ground B (brand mismatch) must be unaffected by the ground-A gate');
}
/* ---- 4. numbered-section-markers is gone ------------------------------------------------------------------ */
{
    check(!subjective_rendered_scanner_1.SUBJECTIVE_RULES.includes('numbered-section-markers'), 'numbered-section-markers must be removed from SUBJECTIVE_RULES (it was inert: 0 fires / 6 positives)');
    check(subjective_rendered_scanner_1.SUBJECTIVE_RULES.includes('marquee'), 'ANCHOR: its sibling marquee must still be present, or the absence above proves only that the list broke');
    const manifest = (0, product_rule_registry_1.listRenderedManifest)().map((m) => m.scannerRule);
    check(!manifest.includes('numbered-section-markers'), 'numbered-section-markers must be removed from the rendered registry manifest - an inert rule there is a claim nobody can cash');
    check(manifest.includes('marquee'), 'ANCHOR: marquee must still be registered');
}
/* ---- 5. the detect CLI collapses per-element objective findings for display -------------------------------- */
{
    const lc = Array.from({ length: 35 }, (_, i) => ({
        rule: 'low-contrast', lens: 'objective', severity: 'blocking',
        selector: `p.muted-${i}`, detail: '2.91:1 (need 4.5:1)',
    }));
    const other = { rule: 'skipped-heading', lens: 'objective', severity: 'blocking', selector: 'h4', detail: 'h1 -> h4' };
    const collapsed = detect.collapseForDisplay([...lc, other]);
    check(collapsed.length === 2, `35 low-contrast findings + 1 other must collapse to 2 display lines (got ${collapsed.length})`);
    const line = collapsed.find((f) => f.rule === 'low-contrast');
    check(!!line && /35 element\(s\)/.test(line.detail || ''), `the collapsed line must carry the element COUNT (got: ${line ? line.detail : 'missing'})`);
    check(!!line && /2\.91:1/.test(line.detail || ''), 'the collapsed line must carry a representative measurement');
    check(collapsed.some((f) => f.rule === 'skipped-heading'), 'ANCHOR: a non-collapsed rule must survive the collapse untouched');
    // a single finding is NOT rewritten into a "1 element(s)" line.
    const one = detect.collapseForDisplay([lc[0]]);
    check(one.length === 1 && one[0].detail === '2.91:1 (need 4.5:1)', 'a lone low-contrast finding must pass through with its original detail');
}
/* ---- 6. browser end-to-end: ONE finding per page for the page-level judgments ------------------------------ */
const S = 'This is a running body sentence with clearly more than six words of text. ';
const dedupeDoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:'Fixture Sans',sans-serif"><main>${Array.from({ length: 24 }, (_, i) => `<p style="font-size:1${i % 3}px">${S.repeat(2)}</p>`).join('')}</main></body></html>`;
// four independent card-in-card nestings on one page
const nestedCard = (i) => `<div style="width:400px;height:300px;border-radius:12px;border:1px solid #ddd"><p>Card ${i}</p><div style="width:200px;height:120px;border-radius:8px;border:1px solid #ccc"><p>Inner ${i}</p></div></div>`;
const nestedDoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:'Fixture Sans',sans-serif">${[1, 2, 3, 4].map(nestedCard).join('')}</body></html>`;
async function run() {
    const browser = await playwright_1.chromium.launch({ headless: true });
    try {
        const findings = await (0, subjective_rendered_scanner_1.analyzeHtmlOnBrowserSubjective)(browser, dedupeDoc);
        const tiny = findings.filter((f) => f.rule === 'tiny-text');
        check(tiny.length === 1, `tiny-text must emit exactly ONE page-level finding (got ${tiny.length}; it used to emit up to 20)`);
        check(tiny.length === 1 && /across \d+ element\(s\)/.test(tiny[0].detail || ''), `the single tiny-text finding must carry the offender COUNT (got: ${tiny[0] ? tiny[0].detail : 'none'})`);
        // nested-cards through the PRODUCTION analyzer: a page with several qualifying nestings must yield exactly
        // one finding. This is the assertion the synthetic-score check above cannot make, because the Node-side
        // function returns at most one finding by signature.
        const nestedFindings = await (0, subjective_rendered_scanner_1.analyzeHtmlOnBrowserSubjective)(browser, nestedDoc);
        const nc = nestedFindings.filter((f) => f.rule === 'nested-cards');
        check(nc.length === 1, `nested-cards must emit exactly ONE finding for a page with 4 nestings (got ${nc.length}; it used to emit one per outer card)`);
        check(nc.length === 1 && /4 card-in-card nesting/.test(nc[0].detail || ''), `the production nested-cards finding must carry the COUNT (got: ${nc[0] ? nc[0].detail : 'none'})`);
    }
    finally {
        await browser.close();
    }
    if (failures.length)
        throw new Error(`taste-precision-gates FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
    console.log(`taste-precision-gates: OK (${asserted} asserted)`);
}
run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
//# sourceMappingURL=taste-precision-gates.test.js.map