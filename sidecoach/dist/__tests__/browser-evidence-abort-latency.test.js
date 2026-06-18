"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// P1 (abort latency): an abort during a STALLED launch must return PROMPTLY, not block
// until chromium.launch() eventually settles. We inject a launcher whose promise NEVER
// resolves and assert the collector's returned promise settles (with the abort reason)
// while that launch is still pending - bounded abort latency, no real Chromium needed.
const browser_evidence_collector_1 = require("../validators/browser-evidence-collector");
async function run() {
    let launcherSettled = false;
    // A launch that never resolves and never rejects - simulates a hung chromium.launch().
    const stalledLauncher = () => new Promise(() => { })
        .finally(() => { launcherSettled = true; });
    const ac = new AbortController();
    const collected = (0, browser_evidence_collector_1.collectBrowserEvidence)('data:text/html,test', ac.signal, stalledLauncher);
    // Abort while we are stuck in the launch phase (the launcher never resolves).
    setTimeout(() => ac.abort(), 5);
    // The collector MUST resolve promptly on the abort even though the launch is still
    // pending. If the finally awaits the stalled launch, the collector hangs and the
    // watchdog wins -> failure.
    const TIMEOUT = Symbol('timeout');
    const outcome = await Promise.race([
        collected,
        new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), 2000)),
    ]);
    if (outcome === TIMEOUT)
        throw new Error('collector did not return promptly on a stalled-launch abort (hung awaiting the launch)');
    if (launcherSettled)
        throw new Error('the injected launch should still be pending when the collector returns');
    if (outcome.available)
        throw new Error('stalled-launch abort must return available:false');
    if (!/aborted during launch/i.test(outcome.reason))
        throw new Error(`stalled-launch abort reason wrong: ${outcome.reason}`);
    console.log('browser-evidence-abort-latency: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=browser-evidence-abort-latency.test.js.map