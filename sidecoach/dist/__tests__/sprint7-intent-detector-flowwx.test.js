"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const intent_detector_1 = require("../intent-detector");
async function run() {
    const detector = new intent_detector_1.IntentDetector();
    const checks = [];
    const r1 = detector.detect('compose a landing page');
    checks.push(['T1: compose-landing-page routes to flowW', r1.flowId === 'flowW_landing_composition']);
    checks.push(['T1: compose-landing-page confidence >= 0.8', (r1.confidence || 0) >= 0.8]);
    const r2 = detector.detect('draft hero copy');
    checks.push(['T2: draft-hero-copy routes to flowX', r2.flowId === 'flowX_copywriting']);
    checks.push(['T2: draft-hero-copy confidence >= 0.85', (r2.confidence || 0) >= 0.85]);
    const r3 = detector.detect('research components');
    const r3FlowId = r3.flowId || r3.recommendation?.flowId;
    checks.push(['T3: research-components routes to flowB (no over-match by flowW/flowX)', r3FlowId === 'flowB_component_research']);
    const r4 = detector.detect('copy this function to that file');
    checks.push(['T4: copy-function does NOT route to flowX (excluder)', r4.flowId !== 'flowX_copywriting']);
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint7-intent-detector-flowwx PASS' : 'sprint7-intent-detector-flowwx FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint7-intent-detector-flowwx.test.js.map