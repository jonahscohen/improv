"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taste_validator_1 = require("../taste-validator");
async function run() {
    const checks = [];
    // Empty violations -> pass
    const cleanVR = (0, taste_validator_1.toValidationResult)([]);
    checks.push(['T1: empty violations -> status === pass', cleanVR.status === 'pass']);
    checks.push(['T1: empty violations -> domain === taste', cleanVR.domain === 'taste']);
    checks.push(['T1: empty violations -> failedRules empty', cleanVR.failedRules.length === 0]);
    // 1+ error violation -> fail
    const errorVR = (0, taste_validator_1.toValidationResult)([
        { ruleId: 'observer-race', severity: 'error', category: 'animation', message: 'IntersectionObserver race condition detected.' },
    ]);
    checks.push(['T2: 1 error violation -> status === fail', errorVR.status === 'fail']);
    checks.push(['T2: 1 error violation -> failedRules length 1', errorVR.failedRules.length === 1]);
    checks.push(['T2: 1 error violation -> message contains rule', typeof errorVR.message === 'string' && errorVR.message.includes('observer-race')]);
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint7-taste-validator-result PASS' : 'sprint7-taste-validator-result FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint7-taste-validator-result.test.js.map