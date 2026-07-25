"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/typography-extremes.test.ts
//
// OWNED test for the Stage 4b typographic-extreme rendered SUBJECTIVE classes:
//   extreme-negative-tracking, all-caps-body, oversized-h1, sub-11px-ui. (tight-leading PULLED 2026-07-25.)
//
// Two layers:
//   1. SYNTHETIC-SCORE boundary tests (no browser) - pin each frozen threshold in typographyExtremesFindingsFromScore
//      exactly at its edge, and pin the min-content guard (proportion classes) vs its absence (h1 / sub-11px).
//   2. BROWSER end-to-end over the on-disk fixtures (the SAME pages eval/typography-extremes-calibrate.mjs sweeps)
//      plus the shipped known-good page - the A2 precision non-regression: clean-page.html fires NONE of the five.
//
// Precision-first: every negative fixture is asserted to NOT fire its class; the known-good page is asserted clean.
const playwright_1 = require("playwright");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const subjective_rendered_scanner_1 = require("../validators/subjective-rendered-scanner");
const MY_RULES = ['extreme-negative-tracking', 'all-caps-body', 'oversized-h1', 'sub-11px-ui'];
const failures = [];
let asserted = 0;
const check = (cond, msg) => { asserted++; if (!cond)
    failures.push(msg); };
// ---- layer 1: synthetic-score boundary tests -----------------------------------------------------------------
// A full zeroed score with enough content to clear the proportion guard; each test overrides one slice.
const baseScore = (over = {}) => ({
    contentChars: 1000, viewportWidth: 1280,
    tightTrackingChars: 0, tightTrackingShare: 0, tightestTrackingEm: 0,
    allCapsBodyChars: 0, allCapsShare: 0,
    largestH1Px: 0, h1Ratio: 0,
    sub11Chars: 0, sub11MinPx: 0,
    ...over,
});
const rulesOf = (s) => new Set((0, subjective_rendered_scanner_1.typographyExtremesFindingsFromScore)(s).map((f) => f.rule));
// extreme-negative-tracking: fires at exactly TRACKING_SHARE_MIN, not just below; guarded by min content chars.
check(rulesOf(baseScore({ tightTrackingShare: subjective_rendered_scanner_1.TRACKING_SHARE_MIN })).has('extreme-negative-tracking'), `tracking must fire at share=${subjective_rendered_scanner_1.TRACKING_SHARE_MIN}`);
check(!rulesOf(baseScore({ tightTrackingShare: subjective_rendered_scanner_1.TRACKING_SHARE_MIN - 0.01 })).has('extreme-negative-tracking'), 'tracking must NOT fire just below the share floor');
check(!rulesOf(baseScore({ tightTrackingShare: 1, contentChars: subjective_rendered_scanner_1.TYPO_MIN_CONTENT_CHARS - 1 })).has('extreme-negative-tracking'), 'tracking must NOT fire below the min-content guard even at share 1.0');
// all-caps-body: fires at exactly ALLCAPS_SHARE_MIN; guarded by min content chars.
check(rulesOf(baseScore({ allCapsShare: subjective_rendered_scanner_1.ALLCAPS_SHARE_MIN })).has('all-caps-body'), `all-caps must fire at share=${subjective_rendered_scanner_1.ALLCAPS_SHARE_MIN}`);
check(!rulesOf(baseScore({ allCapsShare: subjective_rendered_scanner_1.ALLCAPS_SHARE_MIN - 0.01 })).has('all-caps-body'), 'all-caps must NOT fire just below the share floor');
check(!rulesOf(baseScore({ allCapsShare: 1, contentChars: subjective_rendered_scanner_1.TYPO_MIN_CONTENT_CHARS - 1 })).has('all-caps-body'), 'all-caps must NOT fire below the min-content guard');
// oversized-h1: fires at exactly H1_VW_RATIO; NOT guarded by content chars (an h1 on a sparse page still fires).
check(rulesOf(baseScore({ h1Ratio: subjective_rendered_scanner_1.H1_VW_RATIO, largestH1Px: subjective_rendered_scanner_1.H1_VW_RATIO * 1280 })).has('oversized-h1'), `h1 must fire at ratio=${subjective_rendered_scanner_1.H1_VW_RATIO}`);
check(!rulesOf(baseScore({ h1Ratio: subjective_rendered_scanner_1.H1_VW_RATIO - 0.005, largestH1Px: 130 })).has('oversized-h1'), 'h1 must NOT fire just below the ratio');
check(rulesOf(baseScore({ h1Ratio: subjective_rendered_scanner_1.H1_VW_RATIO, largestH1Px: 141, contentChars: 10 })).has('oversized-h1'), 'h1 must fire regardless of content-char count (no proportion guard)');
// sub-11px-ui: fires at exactly SUB11_MIN_CHARS; NOT guarded by content-char proportion.
check(rulesOf(baseScore({ sub11Chars: subjective_rendered_scanner_1.SUB11_MIN_CHARS, sub11MinPx: 9 })).has('sub-11px-ui'), `sub-11px must fire at ${subjective_rendered_scanner_1.SUB11_MIN_CHARS} chars`);
check(!rulesOf(baseScore({ sub11Chars: subjective_rendered_scanner_1.SUB11_MIN_CHARS - 1, sub11MinPx: 9 })).has('sub-11px-ui'), 'sub-11px must NOT fire just below the char floor');
check(rulesOf(baseScore({ sub11Chars: subjective_rendered_scanner_1.SUB11_MIN_CHARS, sub11MinPx: 8, contentChars: 5 })).has('sub-11px-ui'), 'sub-11px must fire regardless of content-char count');
// a score that trips several slices returns several findings (each class is independent).
{
    const multi = rulesOf(baseScore({ tightTrackingShare: 0.5, h1Ratio: 0.2, largestH1Px: 256, sub11Chars: 400, sub11MinPx: 8 }));
    check(multi.has('extreme-negative-tracking') && multi.has('oversized-h1') && multi.has('sub-11px-ui'), 'a multi-defect score must return one finding per firing class');
    check(!multi.has('all-caps-body'), 'silent slices must not emit findings');
}
// ---- layer 2: browser end-to-end over the on-disk fixtures + the shipped known-good page ---------------------
const FIX = node_path_1.default.resolve(__dirname, '..', '..', 'eval', 'fixtures', 'typography-extremes');
const KNOWN_GOOD = node_path_1.default.resolve(__dirname, '..', '..', 'eval', 'fixtures', 'known-good', 'clean-page.html');
const classOfFixture = (id) => MY_RULES.find((r) => id.includes(r));
async function run() {
    const browser = await playwright_1.chromium.launch({ headless: true });
    try {
        for (const f of (0, node_fs_1.readdirSync)(FIX).filter((x) => x.endsWith('.html')).sort()) {
            const id = f.replace('.html', '');
            const cls = classOfFixture(id);
            if (!cls) {
                failures.push(`fixture ${id} names no known class`);
                continue;
            }
            const findings = await (0, subjective_rendered_scanner_1.analyzeHtmlOnBrowserSubjective)(browser, (0, node_fs_1.readFileSync)(node_path_1.default.join(FIX, f), 'utf8'));
            const fired = new Set(findings.map((x) => x.rule));
            if (f.startsWith('p'))
                check(fired.has(cls), `positive fixture ${id} must fire ${cls}`);
            else
                check(!fired.has(cls), `negative fixture ${id} must NOT fire ${cls}`);
        }
        // A2 precision non-regression: the shipped known-good page fires NONE of the five typographic-extreme classes.
        const kg = new Set((await (0, subjective_rendered_scanner_1.analyzeHtmlOnBrowserSubjective)(browser, (0, node_fs_1.readFileSync)(KNOWN_GOOD, 'utf8'))).map((x) => x.rule));
        for (const r of MY_RULES)
            check(!kg.has(r), `known-good clean-page.html must NOT fire ${r} (A2 precision non-regression)`);
    }
    finally {
        await browser.close();
    }
    if (failures.length)
        throw new Error(`typography-extremes FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
    console.log(`typography-extremes: OK (${asserted} asserted; classes: [${MY_RULES.join(', ')}])`);
}
run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
//# sourceMappingURL=typography-extremes.test.js.map