"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/anti-pattern-checks.test.ts
const anti_pattern_checks_1 = require("../validators/checks/anti-pattern-checks");
const ctxCss = (css) => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const ctxMarkup = (html) => ({ cssText: '', markup: html, files: [{ path: 'a.html', sourceKind: 'html', cssText: '', markup: html, evidenceKindsPresent: ['html'] }] });
const empty = { cssText: '', markup: '', files: [] };
function run() {
    const gt = anti_pattern_checks_1.ANTI_PATTERN_CHECKS['anti-pattern/gradient-text'];
    const gl = anti_pattern_checks_1.ANTI_PATTERN_CHECKS['anti-pattern/glassmorphism-default'];
    const ss = anti_pattern_checks_1.ANTI_PATTERN_CHECKS['anti-pattern/side-stripe-borders'];
    const mo = anti_pattern_checks_1.ANTI_PATTERN_CHECKS['anti-pattern/modal-as-first-thought'];
    // (identical-card-grids check deleted Stage-2 2026-06-24 - ReDoS + low-precision)
    if (anti_pattern_checks_1.ANTI_PATTERN_CHECKS['anti-pattern/identical-card-grids'])
        throw new Error('identical-card-grids should be DELETED (Stage-2)');
    for (const [k, f] of Object.entries({ gt, gl, ss, mo }))
        if (!f)
            throw new Error(`missing ${k}`);
    // gradient-text: clip + gradient -> fail; clean css -> pass; no css -> inconclusive
    if (gt(ctxCss('.h { background-clip: text; background: linear-gradient(#a,#b); }')).status !== 'fail')
        throw new Error('gradient-text must fail');
    if (gt(ctxCss('.h { color: red; }')).status !== 'pass')
        throw new Error('clean css gradient-text must pass');
    if (gt(empty).status !== 'inconclusive')
        throw new Error('gradient-text no-css must be inconclusive');
    // glassmorphism: blur + low alpha -> fail
    if (gl(ctxCss('.g { backdrop-filter: blur(8px); background: rgba(255,255,255,0.2); }')).status !== 'fail')
        throw new Error('glassmorphism must fail');
    // markup heuristic: dialog+form -> fail; no markup -> inconclusive (not pass)
    if (mo(ctxMarkup('<div class="modal"><form><input></form></div>')).status !== 'fail')
        throw new Error('modal-as-first-thought must fail');
    if (mo(empty).status !== 'inconclusive')
        throw new Error('markup detector with no markup must be inconclusive');
    // P2#4: findings must carry the REAL file path (not a placeholder) and preserve ALL
    // rewrite options in remediation.
    const gtFail = gt(ctxCss('.h { background-clip: text; background: linear-gradient(#a,#b); }'));
    if (gtFail.status !== 'fail')
        throw new Error('precondition: gradient-text must fail');
    if (!gtFail.evidenceLocations || !gtFail.evidenceLocations.some((l) => l.startsWith('a.css')))
        throw new Error('gradient-text finding must reference the real file, not a placeholder');
    for (const opt of ['Solid color', 'Emphasis via weight or size', 'Use the brand accent on one word with text-decoration-color instead']) {
        if (!gtFail.remediation || !gtFail.remediation.includes(opt))
            throw new Error(`remediation must preserve every rewrite option (missing: ${opt})`);
    }
    const moFail = mo(ctxMarkup('<div class="modal"><form><input></form></div>'));
    if (!moFail.evidenceLocations || !moFail.evidenceLocations.some((l) => l.startsWith('a.html')))
        throw new Error('modal finding must reference the real markup file, not <assembled-markup>');
    if (!moFail.remediation || !moFail.remediation.includes('Toast for confirmation'))
        throw new Error('modal remediation must preserve all rewrite options');
    console.log('anti-pattern-checks: OK');
}
run();
//# sourceMappingURL=anti-pattern-checks.test.js.map