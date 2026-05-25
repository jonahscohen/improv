"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build_report_types_1 = require("../build-report-types");
function assertEq(actual, expected, label) {
    if (actual !== expected) {
        console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        process.exit(1);
    }
}
(() => {
    // passRateToLetter thresholds: A>=90, B>=80, C>=70, D>=60, F<60
    assertEq((0, build_report_types_1.passRateToLetter)(95), 'A', '95 -> A');
    assertEq((0, build_report_types_1.passRateToLetter)(90), 'A', '90 -> A (lower bound)');
    assertEq((0, build_report_types_1.passRateToLetter)(89.9), 'B', '89.9 -> B (just below A)');
    assertEq((0, build_report_types_1.passRateToLetter)(80), 'B', '80 -> B (lower bound)');
    assertEq((0, build_report_types_1.passRateToLetter)(75), 'C', '75 -> C');
    assertEq((0, build_report_types_1.passRateToLetter)(70), 'C', '70 -> C (lower bound)');
    assertEq((0, build_report_types_1.passRateToLetter)(65), 'D', '65 -> D');
    assertEq((0, build_report_types_1.passRateToLetter)(60), 'D', '60 -> D (lower bound)');
    assertEq((0, build_report_types_1.passRateToLetter)(59.99), 'F', '59.99 -> F (just below D)');
    assertEq((0, build_report_types_1.passRateToLetter)(0), 'F', '0 -> F');
    const grades = [
        { domain: 'color', passRate: 100, letter: 'A', rulesPassed: 22, rulesTotal: 22 },
        { domain: 'typography', passRate: 80, letter: 'B', rulesPassed: 8, rulesTotal: 10 },
        { domain: 'motion', passRate: 60, letter: 'D', rulesPassed: 6, rulesTotal: 10 },
    ];
    const overall = (0, build_report_types_1.computeOverallGrade)(grades);
    assertEq(overall.passRate, 80, 'mean of 100,80,60 = 80');
    assertEq(overall.letter, 'B', 'mean 80 -> B');
    const empty = (0, build_report_types_1.computeOverallGrade)([]);
    assertEq(empty.passRate, 0, 'no domains -> 0');
    assertEq(empty.letter, 'F', 'no domains -> F');
    assertEq((0, build_report_types_1.computeVerdict)({ blocking: 0, warning: 0, info: 0 }), 'clean', 'no findings -> clean');
    assertEq((0, build_report_types_1.computeVerdict)({ blocking: 0, warning: 3, info: 5 }), 'warnings-only', 'warnings only -> warnings-only');
    assertEq((0, build_report_types_1.computeVerdict)({ blocking: 1, warning: 3, info: 5 }), 'blocked', 'any blocking -> blocked');
    assertEq((0, build_report_types_1.computeVerdict)({ blocking: 0, warning: 0, info: 5 }), 'clean', 'info-only -> clean');
    console.log('sprint4-build-report-grading PASS');
})();
//# sourceMappingURL=sprint4-build-report-grading.test.js.map