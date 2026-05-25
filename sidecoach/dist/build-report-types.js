"use strict";
// Build Report type definitions + grading helpers.
// Pure - no I/O. Imported by the aggregator and the orchestrator.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THRESHOLDS = void 0;
exports.passRateToLetter = passRateToLetter;
exports.computeOverallGrade = computeOverallGrade;
exports.computeVerdict = computeVerdict;
exports.DEFAULT_THRESHOLDS = { a: 90, b: 80, c: 70, d: 60 };
function passRateToLetter(passRate, thresholds = exports.DEFAULT_THRESHOLDS) {
    if (passRate >= thresholds.a)
        return 'A';
    if (passRate >= thresholds.b)
        return 'B';
    if (passRate >= thresholds.c)
        return 'C';
    if (passRate >= thresholds.d)
        return 'D';
    return 'F';
}
function computeOverallGrade(domains, thresholds = exports.DEFAULT_THRESHOLDS) {
    if (domains.length === 0) {
        return { passRate: 0, letter: 'F' };
    }
    const sum = domains.reduce((acc, d) => acc + d.passRate, 0);
    const passRate = sum / domains.length;
    return { passRate, letter: passRateToLetter(passRate, thresholds) };
}
function computeVerdict(counts) {
    if (counts.blocking > 0)
        return 'blocked';
    if (counts.warning > 0)
        return 'warnings-only';
    return 'clean';
}
//# sourceMappingURL=build-report-types.js.map