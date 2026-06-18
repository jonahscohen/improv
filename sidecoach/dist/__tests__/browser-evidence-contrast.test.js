"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// P1-1: the collector must NEVER emit a trusted contrast verdict it could not
// faithfully measure. If zero visible text was measured, OR any unsupported
// background (image/gradient) or unparseable computed color was encountered, the
// collector must DROP 'contrast' from the trusted evidence kinds so a11y.color-contrast
// stays INCONCLUSIVE (never a false blocker PASS).
const browser_evidence_collector_1 = require("../validators/browser-evidence-collector");
const a11y_checks_1 = require("../validators/checks/a11y-checks");
const dataUrl = (html) => `data:text/html,${encodeURIComponent(html)}`;
// (a) no visible text at all -> nothing to measure.
const noText = `<!doctype html><main><div style="width:40px;height:40px;background:#ffffff"></div></main>`;
// (b) text over a gradient background -> background not faithfully determinable.
const gradientBg = `<!doctype html><body style="background:linear-gradient(#000000,#ffffff)"><main><p style="color:#111111;line-height:20px">Over a gradient</p></main></body>`;
// (c) wide-gamut color() the rgb parser cannot read -> unparseable foreground.
const unparseable = `<!doctype html><body style="background:#ffffff"><main><p style="color:color(display-p3 1 0.4 0);line-height:20px">Wide gamut</p></main></body>`;
async function unmeasurable(label, html) {
    const r = await (0, browser_evidence_collector_1.collectBrowserEvidence)(dataUrl(html));
    if (!r.available) {
        console.log(`browser-evidence-contrast: SKIP (${r.reason})`);
        return 'skip';
    }
    const e = r.evidence;
    if (e.browserEvidence.kinds.includes('contrast'))
        throw new Error(`${label}: 'contrast' must NOT be a trusted kind when unmeasurable`);
    const ctx = { cssText: '', markup: '', files: [], renderUrl: dataUrl(html), ...e };
    const status = a11y_checks_1.A11Y_CHECKS['a11y/color-contrast'](ctx).status;
    if (status !== 'inconclusive')
        throw new Error(`${label}: color-contrast must be inconclusive, got ${status}`);
    // The collector still completes; only contrast is withheld.
    if (!e.browserEvidence.kinds.includes('computed-style') || !e.browserEvidence.kinds.includes('dom')) {
        throw new Error(`${label}: computed-style and dom evidence must still be collected`);
    }
    return 'ok';
}
async function run() {
    for (const [label, html] of [['no-text', noText], ['gradient', gradientBg], ['unparseable', unparseable]]) {
        if ((await unmeasurable(label, html)) === 'skip')
            return;
    }
    // Faithfully-measurable page: contrast IS trusted and reaches a real verdict (a low
    // ratio fails, not inconclusive) - proving the gate did not over-withhold.
    const lowContrast = `<!doctype html><body style="background:#ffffff"><main><p style="color:#aaaaaa;line-height:20px">Low contrast</p></main></body>`;
    const r = await (0, browser_evidence_collector_1.collectBrowserEvidence)(dataUrl(lowContrast));
    if (r.available) {
        const e = r.evidence;
        if (!e.browserEvidence.kinds.includes('contrast'))
            throw new Error('a fully-measurable page must include trusted contrast');
        const ctx = { cssText: '', markup: '', files: [], renderUrl: dataUrl(lowContrast), ...e };
        if (a11y_checks_1.A11Y_CHECKS['a11y/color-contrast'](ctx).status !== 'fail')
            throw new Error('low-contrast measurable text must FAIL, not inconclusive/pass');
    }
    console.log('browser-evidence-contrast: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=browser-evidence-contrast.test.js.map