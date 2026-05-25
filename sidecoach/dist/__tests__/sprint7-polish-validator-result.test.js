"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const polish_standard_validator_1 = require("../polish-standard-validator");
async function run() {
    const checks = [];
    // Real validateAll with minimal context
    const minimalContext = {};
    const realReport = polish_standard_validator_1.PolishStandardValidator.validateAll(minimalContext);
    const realVR = polish_standard_validator_1.PolishStandardValidator.toValidationResult(realReport);
    checks.push(['T1: real validateAll -> domain === polish-standard', realVR.domain === 'polish-standard']);
    checks.push(['T1: real validateAll -> status is valid', ['pass', 'partial', 'fail'].includes(realVR.status)]);
    checks.push(['T1: real validateAll -> message non-empty', typeof realVR.message === 'string' && realVR.message.length > 0]);
    // Synthetic clean report
    const cleanReport = {
        totalRules: 22,
        passed: 22,
        violations: 0,
        passRate: '100.0%',
        criticalViolations: 0,
        results: Array.from({ length: 22 }, (_, i) => ({
            ruleId: i + 1,
            passed: true,
            message: 'ok',
        })),
        summary: 'Polish Standard: 22/22 rules passed (100.0%)',
    };
    const cleanVR = polish_standard_validator_1.PolishStandardValidator.toValidationResult(cleanReport);
    checks.push(['T2: synthetic clean -> status === pass', cleanVR.status === 'pass']);
    checks.push(['T2: synthetic clean -> failedRules empty', Array.isArray(cleanVR.failedRules) && cleanVR.failedRules.length === 0]);
    checks.push(['T2: synthetic clean -> passedRules length 22', Array.isArray(cleanVR.passedRules) && cleanVR.passedRules.length === 22]);
    // Synthetic critical report
    const criticalReport = {
        totalRules: 22,
        passed: 21,
        violations: 1,
        passRate: '95.5%',
        criticalViolations: 1,
        results: Array.from({ length: 22 }, (_, i) => ({
            ruleId: i + 1,
            passed: i !== 0,
            message: i === 0 ? 'critical violation' : 'ok',
        })),
        summary: 'Polish Standard: 21/22 rules passed (95.5%)',
    };
    const criticalVR = polish_standard_validator_1.PolishStandardValidator.toValidationResult(criticalReport);
    checks.push(['T3: synthetic critical -> status === fail', criticalVR.status === 'fail']);
    checks.push(['T3: synthetic critical -> failedRules length 1', criticalVR.failedRules.length === 1]);
    // Synthetic warning-only report
    const warningReport = {
        totalRules: 22,
        passed: 21,
        violations: 1,
        passRate: '95.5%',
        criticalViolations: 0,
        results: Array.from({ length: 22 }, (_, i) => ({
            ruleId: i + 1,
            passed: i !== 0,
            message: i === 0 ? 'warning' : 'ok',
        })),
        summary: 'Polish Standard: 21/22 rules passed (95.5%)',
    };
    const warningVR = polish_standard_validator_1.PolishStandardValidator.toValidationResult(warningReport);
    checks.push(['T4: synthetic warning-only -> status === partial', warningVR.status === 'partial']);
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint7-polish-validator-result PASS' : 'sprint7-polish-validator-result FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint7-polish-validator-result.test.js.map