"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Stage 1 convergence: the rendered scanner findings surface through the LIVE run-validator path as registry
// rules. Proves the end-to-end wiring (renderUrl -> activateRenderedPolicy promotion -> executeRule non-static
// branch -> rendered check reads ctx.renderedScan -> finding in ProductValidationResult) WITHOUT a real browser,
// by injecting a deterministic scanRenderedLive via the deps seam (mirrors how browser tests inject the
// collector). Covers: finding-surfaces (fail+block), clean-pass, fail-closed (scan unavailable + renderUrl ->
// required inconclusive -> blocks), dormant (no renderUrl -> not promoted -> baseline preserved), subjective
// tiny-text, and objective/subjective family independence.
const run_validator_1 = require("../validators/run-validator");
const URL = 'data:text/html,test';
const scanOf = (obj, subj = []) => ({
    objective: { available: true, findings: obj },
    subjective: { available: true, findings: subj },
});
const injectScan = (scan) => ({ scanRenderedLive: async () => scan });
function exec(detail, id) {
    const x = detail.executions.find((e) => e.result.ruleId === id);
    if (!x)
        throw new Error(`no execution for ${id}`);
    return x;
}
async function run() {
    // 1. FINDING SURFACES: a broken-image finding on a present renderUrl -> a11y.broken-image fails with the
    //    selector, the rule is PROMOTED to required, and the whole validation BLOCKS (broken-image is 'major').
    const withFinding = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [], renderUrl: URL }, injectScan(scanOf([{ rule: 'broken-image', severity: 'error', selector: 'img.hero', detail: 'no source' }])));
    const bi = exec(withFinding, 'a11y.broken-image');
    if (bi.result.status !== 'fail')
        throw new Error(`broken-image must FAIL when the scan reports it (got ${bi.result.status})`);
    if (!bi.result.evidenceLocations.includes('img.hero'))
        throw new Error('broken-image must carry the offending selector');
    if (!withFinding.activePolicy.requiredRuleIds.includes('a11y.broken-image'))
        throw new Error('renderUrl present must PROMOTE broken-image to required');
    if (withFinding.result.status === 'clean')
        throw new Error('a major rendered finding must block clean');
    // 1b. STAGE 6 - LOW-CONTRAST SURFACES LIVE: a low-contrast finding -> a11y.color-contrast (migrated off the
    //     collector contrast probe onto the rendered scanner) fails with the selector, is PROMOTED to required, and
    //     BLOCKS (color-contrast is a 'blocker'). This is the convergence fix: the live NL workflow now surfaces
    //     low-contrast, the biggest objective class, which was previously eval-only.
    const withLowContrast = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [], renderUrl: URL }, injectScan(scanOf([{ rule: 'low-contrast', severity: 'error', selector: 'p.muted', detail: '2.10:1 (need 4.5:1)' }])));
    const lc = exec(withLowContrast, 'a11y.color-contrast');
    if (lc.result.status !== 'fail')
        throw new Error(`color-contrast must FAIL when the scan reports low-contrast (got ${lc.result.status})`);
    if (!lc.result.evidenceLocations.includes('p.muted'))
        throw new Error('color-contrast must carry the offending selector');
    if (!withLowContrast.activePolicy.requiredRuleIds.includes('a11y.color-contrast'))
        throw new Error('renderUrl present must PROMOTE color-contrast to required');
    if (withLowContrast.result.status === 'clean')
        throw new Error('a blocker low-contrast finding must block clean');
    // 1c. STAGE 6 DE-DUP (Codex P1): a gray-on-color element trips BOTH low-contrast + gray-on-color in the scan
    //     (same selector). a11y.gray-on-color must fire on it; a11y.color-contrast must NOT double-fire on that same
    //     element - it fires only on the PURE low-contrast element. (Scanner emission untouched; de-dup is live-only.)
    const dual = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [], renderUrl: URL }, injectScan(scanOf([
        { rule: 'low-contrast', severity: 'error', selector: 'p.gray', detail: '2.00:1' },
        { rule: 'gray-on-color', severity: 'warning', selector: 'p.gray', detail: 'gray text on colored bg' },
        { rule: 'low-contrast', severity: 'error', selector: 'p.pure', detail: '3.00:1' },
    ])));
    const goc = exec(dual, 'a11y.gray-on-color');
    if (goc.result.status !== 'fail' || !goc.result.evidenceLocations.includes('p.gray'))
        throw new Error('gray-on-color must fire on the gray-on-color element');
    const ccDual = exec(dual, 'a11y.color-contrast');
    if (ccDual.result.status !== 'fail')
        throw new Error('color-contrast must still fire on the PURE low-contrast element');
    if (!ccDual.result.evidenceLocations.includes('p.pure'))
        throw new Error('color-contrast must report the pure low-contrast element');
    if (ccDual.result.evidenceLocations.includes('p.gray'))
        throw new Error('color-contrast must NOT double-fire on the gray-on-color element (de-dup: subtype wins)');
    // 2. CLEAN PASS: scan available, no findings -> every rendered a11y rule passes (the scan ran and saw nothing).
    const clean = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [], renderUrl: URL }, injectScan(scanOf([])));
    for (const id of ['a11y.broken-image', 'a11y.skipped-heading', 'a11y.gray-on-color', 'a11y.justified-text', 'a11y.color-contrast']) {
        const x = exec(clean, id);
        if (x.result.status !== 'pass')
            throw new Error(`${id} must PASS on an available scan with no finding (got ${x.result.status})`);
        if (!x.sufficientlyCovered)
            throw new Error(`${id} must be sufficiently covered by an available scan`);
    }
    // 3. FAIL-CLOSED: renderUrl present but the scan is UNAVAILABLE -> rendered rules are required AND inconclusive
    //    -> the run cannot be clean (a render we attempted and could not read must never read as clean).
    const unavailable = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [], renderUrl: URL }, { scanRenderedLive: async () => ({ objective: { available: false, reason: 'injected unavailable' }, subjective: { available: false, reason: 'injected unavailable' } }) });
    const biU = exec(unavailable, 'a11y.broken-image');
    if (biU.result.status !== 'inconclusive')
        throw new Error('scan unavailable must surface inconclusive');
    if (!unavailable.activePolicy.requiredRuleIds.includes('a11y.broken-image'))
        throw new Error('renderUrl present must promote even when the scan fails (fail-closed)');
    if (unavailable.result.status === 'clean')
        throw new Error('fail-closed: required+inconclusive must block clean');
    if (unavailable.result.status === 'error')
        throw new Error('scan failure must never become a validator error');
    // 4. DORMANT (no renderUrl): rendered rules surface inconclusive but are NOT promoted, so they cannot force a
    //    block from being required - the established no-render behavior is preserved (detection-preserving).
    //    STAGE 6 GUARDRAIL: a11y.color-contrast (migrated to rendered-scan) MUST stay dormant here too - a target
    //    that never renders must NOT suddenly start blocking/erroring on the contrast rule (no live regression).
    const noUrl = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [] });
    const biN = exec(noUrl, 'a11y.broken-image');
    if (biN.result.status !== 'inconclusive')
        throw new Error('no renderUrl must surface inconclusive');
    if (noUrl.activePolicy.requiredRuleIds.includes('a11y.broken-image'))
        throw new Error('no renderUrl must NOT promote a rendered rule (dormant)');
    const ccN = exec(noUrl, 'a11y.color-contrast');
    if (ccN.result.status !== 'inconclusive')
        throw new Error('no renderUrl: color-contrast must surface inconclusive (dormant), not fail/block');
    if (noUrl.activePolicy.requiredRuleIds.includes('a11y.color-contrast'))
        throw new Error('no renderUrl must NOT promote color-contrast (dormant - no live regression on non-rendering flows)');
    // 5. SUBJECTIVE tiny-text via polish-standard.
    const tiny = await (0, run_validator_1.runValidatorForTest)('polish-standard', { cssText: '', markup: '', files: [], renderUrl: URL }, injectScan(scanOf([], [{ rule: 'tiny-text', severity: 'warning', selector: 'p.fine', detail: '11px' }])));
    const tt = exec(tiny, 'polish.tiny-text');
    if (tt.result.status !== 'fail')
        throw new Error(`tiny-text must FAIL when the subjective scan reports it (got ${tt.result.status})`);
    if (!tiny.activePolicy.requiredRuleIds.includes('polish.tiny-text'))
        throw new Error('renderUrl present must promote tiny-text');
    // 5b. SUBJECTIVE marketing-buzzword via polish-standard (Stage 5a) - mirrors tiny-text: a finding FAILS and the
    //     rule is PROMOTED on renderUrl. (Codex P2: marketing-buzzword was absent from RENDERED_BACKED_RULE_IDS, so
    //     it was never promoted nor fail-closed; this asserts parity with its tiny-text sibling.)
    const buzz = await (0, run_validator_1.runValidatorForTest)('polish-standard', { cssText: '', markup: '', files: [], renderUrl: URL }, injectScan(scanOf([], [{ rule: 'marketing-buzzword', severity: 'warning', selector: 'h1.hero', detail: '3 buzzwords in prominent copy (2 strong)' }])));
    const mb = exec(buzz, 'polish.marketing-buzzword');
    if (mb.result.status !== 'fail')
        throw new Error(`marketing-buzzword must FAIL when the subjective scan reports it (got ${mb.result.status})`);
    if (!mb.result.evidenceLocations.includes('h1.hero'))
        throw new Error('marketing-buzzword must carry the offending selector');
    if (!buzz.activePolicy.requiredRuleIds.includes('polish.marketing-buzzword'))
        throw new Error('renderUrl present must promote marketing-buzzword');
    // 5c. FAIL-CLOSED for marketing-buzzword (the exact P2 fix): renderUrl present + subjective scan UNAVAILABLE ->
    //     required + inconclusive -> blocks clean. Without the RENDERED_BACKED_RULE_IDS membership it would stay
    //     dormant (non-required) and a render we attempted-but-could-not-read would read as a false clean.
    const buzzUnavail = await (0, run_validator_1.runValidatorForTest)('polish-standard', { cssText: '', markup: '', files: [], renderUrl: URL }, { scanRenderedLive: async () => ({ objective: { available: false, reason: 'injected' }, subjective: { available: false, reason: 'injected' } }) });
    const mbU = exec(buzzUnavail, 'polish.marketing-buzzword');
    if (mbU.result.status !== 'inconclusive')
        throw new Error('marketing-buzzword: scan unavailable must surface inconclusive (fail-closed), not pass');
    if (!buzzUnavail.activePolicy.requiredRuleIds.includes('polish.marketing-buzzword'))
        throw new Error('renderUrl present must promote marketing-buzzword even when the scan fails (fail-closed)');
    if (buzzUnavail.result.status === 'clean')
        throw new Error('fail-closed: marketing-buzzword required+inconclusive must block clean');
    // 5d. DORMANT (no renderUrl): marketing-buzzword surfaces inconclusive but is NOT promoted (no live regression
    //     on non-rendering flows - mirrors the color-contrast/broken-image dormant guard).
    const buzzNoUrl = await (0, run_validator_1.runValidatorForTest)('polish-standard', { cssText: '', markup: '', files: [] });
    const mbN = exec(buzzNoUrl, 'polish.marketing-buzzword');
    if (mbN.result.status !== 'inconclusive')
        throw new Error('no renderUrl: marketing-buzzword must surface inconclusive (dormant)');
    if (buzzNoUrl.activePolicy.requiredRuleIds.includes('polish.marketing-buzzword'))
        throw new Error('no renderUrl must NOT promote marketing-buzzword (dormant)');
    // 6. FAMILY INDEPENDENCE: objective available + subjective UNAVAILABLE -> objective rules still produce a
    //    verdict; the subjective rule alone goes inconclusive (one family's failure never hides the other).
    const mixed = await (0, run_validator_1.runValidatorForTest)('static-a11y', { cssText: '', markup: '', files: [], renderUrl: URL }, { scanRenderedLive: async () => ({ objective: { available: true, findings: [{ rule: 'justified-text', severity: 'warning', selector: 'p' }] }, subjective: { available: false, reason: 'detector threw' } }) });
    const jt = exec(mixed, 'a11y.justified-text');
    if (jt.result.status !== 'fail')
        throw new Error('objective family must produce a verdict even when subjective is unavailable');
    console.log('rendered-scan-integration: OK (finding surfaces, fail-closed, dormant-no-url, subjective, family independence)');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=rendered-scan-integration.test.js.map