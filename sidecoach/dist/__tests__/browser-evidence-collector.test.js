"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const browser_evidence_collector_1 = require("../validators/browser-evidence-collector");
const polish_checks_1 = require("../validators/checks/polish-checks");
const a11y_checks_1 = require("../validators/checks/a11y-checks");
const html = `<!doctype html>
<style>
  body { color: #111; background: #fff; font-family: sans-serif; line-height: 20px; }
  .outer { border-radius: 12px; padding: 4px; }
  .inner { border-radius: 8px; }
  button { width: 20px; height: 20px; padding: 0; }
  .low { color: #aaa; background: #fff; }
</style>
<main>
  <div class="outer"><div class="inner">Nested text</div></div>
  <button>Go</button>
  <p class="low">Low contrast</p>
</main>`;
async function run() {
    const renderUrl = `data:text/html,${encodeURIComponent(html)}`;
    const result = await (0, browser_evidence_collector_1.collectBrowserEvidence)(renderUrl);
    if (!result.available) {
        console.log(`browser-evidence-collector: SKIP (${result.reason})`);
        return;
    }
    const e = result.evidence;
    for (const kind of ['computed-style', 'dom', 'contrast']) {
        if (!e.browserEvidence.kinds.includes(kind))
            throw new Error(`collector missing ${kind}`);
    }
    if (Number(e.computedStyle['concentric.checkedPairs']) < 1)
        throw new Error('no concentric pair collected');
    if (e.dom.minHitArea.failing < 1)
        throw new Error('small button must fail hit area');
    if (e.contrast.wcagAA)
        throw new Error('low contrast text must fail WCAG AA');
    const ctx = { cssText: '', markup: '', files: [], renderUrl, ...e };
    if (polish_checks_1.POLISH_CHECKS['polish/concentric-radius'](ctx).status !== 'pass')
        throw new Error('concentric rule must reach real pass');
    if (polish_checks_1.POLISH_CHECKS['polish/anti-pattern-genericity'](ctx).status !== 'inconclusive')
        throw new Error('genericity must remain inconclusive with collector evidence');
    if (a11y_checks_1.A11Y_CHECKS['a11y/min-hit-area'](ctx).status !== 'fail')
        throw new Error('hit-area rule must reach real fail');
    // a11y.color-contrast no longer consumes the collector contrast probe (Stage 6 migrated it to the rendered
    // scan). The collector still MEASURES contrast (asserted above: e.contrast.wcagAA), it is just orphaned.
    console.log('browser-evidence-collector: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=browser-evidence-collector.test.js.map