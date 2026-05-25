"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clausemd_mandate_validator_1 = require("../clausemd-mandate-validator");
async function run() {
    const checks = [];
    // Clean result -> pass
    const cleanResult = {
        flowId: 'flowA_brand_verify',
        flowName: 'flowA_brand_verify',
        status: 'success',
        message: 'Clean result with no issues.',
        guidance: ['Step one.', 'Step two.'],
        checklist: [],
    };
    const cleanReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(cleanResult);
    const cleanVR = clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(cleanReport);
    checks.push(['T1: clean result -> status === pass', cleanVR.status === 'pass']);
    checks.push(['T1: clean result -> domain === claudemd-mandate', cleanVR.domain === 'claudemd-mandate']);
    checks.push(['T1: clean result -> failedRules empty', Array.isArray(cleanVR.failedRules) && cleanVR.failedRules.length === 0]);
    // Long-dash result -> partial (warning violation)
    const longDash = String.fromCharCode(0x2014);
    const dashyResult = {
        flowId: 'flowA_brand_verify',
        flowName: 'flowA_brand_verify',
        status: 'success',
        message: `Result with a forbidden ${longDash} in message.`,
        guidance: [],
        checklist: [],
    };
    const dashyReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(dashyResult);
    const dashyVR = clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(dashyReport);
    checks.push(['T2: long-dash result -> status === partial', dashyVR.status === 'partial']);
    checks.push(['T2: long-dash result -> failedRules non-empty', Array.isArray(dashyVR.failedRules) && dashyVR.failedRules.length > 0]);
    checks.push(['T2: long-dash result -> message non-empty', typeof dashyVR.message === 'string' && dashyVR.message.length > 0]);
    // Self-credit result -> fail (critical violation)
    const creditResult = {
        flowId: 'flowA_brand_verify',
        flowName: 'flowA_brand_verify',
        status: 'success',
        message: 'Built by Claude to solve your design problem.',
        guidance: [],
        checklist: [],
    };
    const creditReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(creditResult);
    const creditVR = clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(creditReport);
    checks.push(['T2b: self-credit result -> status === fail', creditVR.status === 'fail']);
    checks.push(['T2b: self-credit result -> failedRules non-empty', Array.isArray(creditVR.failedRules) && creditVR.failedRules.length > 0]);
    // Warning-only result -> NOT fail
    const warningResult = {
        flowId: 'flowA_brand_verify',
        flowName: 'flowA_brand_verify',
        status: 'success',
        message: 'No issues here.',
        guidance: [],
        checklist: [],
        artifacts: [
            { type: 'code', name: 'sample.css', content: 'body { background: #ffffff; }' },
        ],
    };
    const warningReport = clausemd_mandate_validator_1.ClaudemdMandateValidator.validateOutput(warningResult);
    const warningVR = clausemd_mandate_validator_1.ClaudemdMandateValidator.toValidationResult(warningReport);
    checks.push(['T3: warning-only result -> status is "partial" or "pass" (NOT fail)', warningVR.status !== 'fail']);
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint7-claudemd-validator-result PASS' : 'sprint7-claudemd-validator-result FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint7-claudemd-validator-result.test.js.map