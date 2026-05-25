"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build_report_aggregator_1 = require("../build-report-aggregator");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
function fixtureReport(verdict) {
    const findings = verdict === 'clean' ? [] : verdict === 'warnings-only' ? [
        { severity: 'warning', source: 'flowF_design_tokens', flowId: 'flowF_design_tokens', rule: 'motion.duration_consistency', message: '3 distinct durations used', fix: 'Consolidate to 200ms/250ms/300ms' },
    ] : [
        { severity: 'blocking', source: 'flowF_design_tokens', flowId: 'flowF_design_tokens', rule: 'DESIGN.md_lint', message: 'Lint check failed', fix: 'npx @google/design.md lint DESIGN.md' },
    ];
    return {
        reportId: '2026-05-24T11-42-00-000Z-abc123',
        generatedAt: '2026-05-24T11:42:00.000Z',
        composite: 'composite_craft_landing_page',
        flowsExecuted: ['flowA_brand_verify', 'flowW_landing_composition', 'flowF_design_tokens'],
        verdict,
        severityCounts: { blocking: verdict === 'blocked' ? 1 : 0, warning: verdict === 'warnings-only' ? 1 : 0, info: 0 },
        overallGrade: 'B',
        overallPassRate: 83.4,
        domainGrades: [
            { domain: 'color', passRate: 100, letter: 'A', rulesPassed: 22, rulesTotal: 22 },
            { domain: 'typography', passRate: 87.5, letter: 'B', rulesPassed: 14, rulesTotal: 16 },
        ],
        findings,
        nextSteps: verdict === 'clean' ? ['No findings - ship clean.'] : ['Resolve / address as listed above'],
    };
}
(() => {
    const cleanMd = (0, build_report_aggregator_1.renderBuildReportMarkdown)(fixtureReport('clean'));
    assertTrue(/# Build Report/.test(cleanMd), 'clean: has header');
    assertTrue(/Verdict: CLEAN/i.test(cleanMd), 'clean: verdict in header');
    assertTrue(/No findings - ship clean/i.test(cleanMd), 'clean: no-findings placeholder');
    assertTrue(/Overall grade: B/i.test(cleanMd), 'clean: overall grade shown');
    assertTrue(/color/i.test(cleanMd) && /typography/i.test(cleanMd), 'clean: domain rows present');
    const warnMd = (0, build_report_aggregator_1.renderBuildReportMarkdown)(fixtureReport('warnings-only'));
    assertTrue(/Verdict: WARNINGS-ONLY/i.test(warnMd), 'warnings: verdict in header');
    assertTrue(/motion\.duration_consistency/.test(warnMd), 'warnings: finding rule name visible');
    assertTrue(/Consolidate/.test(warnMd), 'warnings: finding fix visible');
    assertTrue(/Warning 1:/.test(warnMd), 'warnings: numbered finding header');
    const blockedMd = (0, build_report_aggregator_1.renderBuildReportMarkdown)(fixtureReport('blocked'));
    assertTrue(/Verdict: BLOCKED/i.test(blockedMd), 'blocked: verdict in header');
    assertTrue(/DESIGN\.md_lint/.test(blockedMd), 'blocked: blocker rule visible');
    assertTrue(/Blocker 1:/.test(blockedMd), 'blocked: numbered blocker header');
    for (const v of ['clean', 'warnings-only', 'blocked']) {
        const md = (0, build_report_aggregator_1.renderBuildReportMarkdown)(fixtureReport(v));
        assertTrue(/Severity totals/i.test(md), `${v}: severity totals section`);
        assertTrue(/Per-domain grades|Domain.*Grade/i.test(md), `${v}: per-domain table`);
        assertTrue(/Flows executed:/i.test(md), `${v}: flows executed line`);
        assertTrue(/composite_craft_landing_page/.test(md), `${v}: composite id in header`);
    }
    console.log('sprint4-build-report-renderer PASS');
})();
//# sourceMappingURL=sprint4-build-report-renderer.test.js.map