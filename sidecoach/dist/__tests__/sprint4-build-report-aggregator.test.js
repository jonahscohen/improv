"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build_report_aggregator_1 = require("../build-report-aggregator");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
function assertEq(actual, expected, label) {
    if (actual !== expected) {
        console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        process.exit(1);
    }
}
function makeFlowResult(flowId, validations, metrics = []) {
    return {
        flowId: flowId,
        flowName: flowId,
        status: 'success',
        message: `${flowId} ok`,
        memory: {
            flowId: flowId,
            flowName: flowId,
            timestamp: new Date().toISOString(),
            status: 'success',
            rulesAppliedByDomain: {},
            decisions: [],
            userDecisions: [],
            metrics,
            validationResults: validations,
            referencesUsed: [],
            gates: [],
            artifactProduced: [],
            summary: `${flowId} summary`,
        },
    };
}
(() => {
    const cleanReport = (0, build_report_aggregator_1.generateBuildReport)({
        source: 'flow-results',
        flowResults: [makeFlowResult('flowA_brand_verify', [{ check: 'brand-detected', result: 'pass' }])],
    });
    assertEq(cleanReport.verdict, 'clean', 'no failures -> clean verdict');
    assertEq(cleanReport.severityCounts.blocking, 0, 'no blocking findings');
    assertEq(cleanReport.severityCounts.warning, 0, 'no warning findings');
    assertEq(cleanReport.findings.length, 0, 'findings list empty when all pass');
    const blockedReport = (0, build_report_aggregator_1.generateBuildReport)({
        source: 'flow-results',
        flowResults: [
            makeFlowResult('flowF_design_tokens', [
                { check: 'DESIGN.md_lint', result: 'fail', details: 'lint failed' },
                { check: 'color-contrast', result: 'warning', details: 'WCAG AA borderline' },
            ]),
            makeFlowResult('flowG_component_implementation', [
                { check: 'aria-labels', result: 'warning', details: '2 buttons missing labels' },
            ]),
        ],
    });
    assertEq(blockedReport.verdict, 'blocked', 'any fail -> blocked');
    assertEq(blockedReport.severityCounts.blocking, 1, 'one fail -> 1 blocking');
    assertEq(blockedReport.severityCounts.warning, 2, 'two warnings -> 2 warning');
    assertEq(blockedReport.findings.length, 3, 'all 3 findings included');
    assertEq(blockedReport.findings[0].severity, 'blocking', 'blocking sorted first');
    const gradedReport = (0, build_report_aggregator_1.generateBuildReport)({
        source: 'flow-results',
        flowResults: [
            makeFlowResult('flowF_design_tokens', [], [
                { name: 'color.contrast-pass-rate', value: 100, status: 'pass' },
                { name: 'typography.scale-pass-rate', value: 80, status: 'warning' },
            ]),
        ],
    });
    const colorGrade = gradedReport.domainGrades.find((d) => d.domain === 'color');
    const typoGrade = gradedReport.domainGrades.find((d) => d.domain === 'typography');
    assertTrue(colorGrade != null, 'color domain grade present');
    assertTrue(typoGrade != null, 'typography domain grade present');
    assertEq(colorGrade.letter, 'A', 'color 100% -> A');
    assertEq(typoGrade.letter, 'B', 'typography 80% -> B');
    const compositeReport = (0, build_report_aggregator_1.generateBuildReport)({
        source: 'flow-results',
        flowResults: [
            makeFlowResult('flowA_brand_verify', []),
            makeFlowResult('flowF_design_tokens', []),
        ],
        composite: 'composite_craft_landing_page',
    });
    assertEq(compositeReport.composite, 'composite_craft_landing_page', 'composite id preserved');
    assertEq(compositeReport.flowsExecuted.length, 2, 'flowsExecuted matches input');
    assertEq(compositeReport.flowsExecuted[0], 'flowA_brand_verify', 'first flow id preserved');
    const withInfo = (0, build_report_aggregator_1.generateBuildReport)({
        source: 'flow-results',
        flowResults: [makeFlowResult('flowA_brand_verify', [{ check: 'info-only', result: 'pass', details: 'note' }])],
    });
    assertEq(withInfo.severityCounts.info, 0, 'info default-filtered (no info findings in current schema)');
    assertTrue(blockedReport.nextSteps.length > 0, 'nextSteps populated when findings exist');
    assertTrue(typeof blockedReport.reportId === 'string' && blockedReport.reportId.length > 0, 'reportId present');
    assertTrue(typeof blockedReport.generatedAt === 'string' && blockedReport.generatedAt.length > 0, 'generatedAt present');
    console.log('sprint4-build-report-aggregator PASS');
})();
//# sourceMappingURL=sprint4-build-report-aggregator.test.js.map