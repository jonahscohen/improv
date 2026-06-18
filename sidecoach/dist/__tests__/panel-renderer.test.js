"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Standalone test (sidecoach convention: no vitest; assert + process.exit).
// Run directly via ts-node, or through scripts/run-tests.ts.
const panel_model_1 = require("../panel-model");
const panel_renderer_1 = require("../panel-renderer");
let failures = 0;
function ok(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}`);
        failures++;
    }
}
function contains(hay, needle, label) {
    if (!hay.includes(needle)) {
        console.error(`FAIL ${label}: missing ${JSON.stringify(needle)}`);
        failures++;
    }
}
function absent(hay, needle, label) {
    if (hay.includes(needle)) {
        console.error(`FAIL ${label}: should not contain ${JSON.stringify(needle)}`);
        failures++;
    }
}
const ESC = '';
function flow(id, name, status = 'success') {
    return { flowId: id, flowName: name, status, message: '' };
}
function report(partial) {
    return {
        reportId: 'r', generatedAt: '2026-06-18T00:00:00.000Z', flowsExecuted: [],
        verdict: 'clean', severityCounts: { blocking: 0, warning: 0, info: 0 },
        overallGrade: 'A', overallPassRate: 100, domainGrades: [], findings: [], nextSteps: [],
        ...partial,
    };
}
const chain = [
    flow('flowA_brand_verify', 'Brand/PRODUCT.md Verification'),
    flow('flowK_multi_lens_audit', 'Multi-Lens Audit (5 dimensions)'),
    flow('flowL_design_critique', 'Design Critique (Nielsen heuristics)'),
];
// assemblePanelModel
const clean = (0, panel_model_1.assemblePanelModel)({
    flowResults: chain,
    report: report({}),
    confidence: 0.85,
    dims: ['accessibility', 'performance', 'theming', 'responsive', 'anti-patterns'],
});
ok(clean.chain.length === 3, 'chain length');
ok(clean.checklist.every((c) => c.done), 'all phases done');
ok(clean.flowId === 'flowL_design_critique', 'headline = last flow');
ok(clean.verdict === 'clean' && clean.grade === 'A' && clean.findings === 0, 'clean verdict/grade/findings');
ok(clean.gates.every((g) => g.ok === true), 'all gates pass when no findings');
const warned = (0, panel_model_1.assemblePanelModel)({
    flowResults: chain,
    report: report({ verdict: 'warnings-only', overallGrade: 'B', severityCounts: { blocking: 0, warning: 1, info: 0 }, findings: [{ severity: 'warning', source: 'polish-standard', flowId: 'flowJ', rule: 'shadows', message: 'm' }] }),
});
ok(warned.gates.find((g) => g.name === 'polish')?.ok === false, 'polish gate fails from finding');
ok(warned.gates.find((g) => g.name === 'taste')?.ok === true, 'taste gate still passes');
ok(warned.findings === 1, 'finding count = 1');
const snap = (0, panel_model_1.assemblePanelModel)({ flowResults: [chain[0], flow('flowK_multi_lens_audit', 'Multi-Lens Audit', 'needs_input')] });
ok(snap.verdict === undefined && snap.partial === true, 'partial snapshot, no verdict');
ok(snap.gates.every((g) => g.ok === null), 'gates pending in partial');
// renderSidecoachPanel
const out = (0, panel_renderer_1.renderSidecoachPanel)(clean, { color: false });
['sidecoach', 'route', 'flowL_design_critique', 'conf 0.85', 'checklist', '3/3', '[done]', 'accessibility', 'gates', 'verdict', 'clean', 'grade A', '0 findings'].forEach((s) => contains(out, s, `clean card has "${s}"`));
const outWarn = (0, panel_renderer_1.renderSidecoachPanel)(warned, { color: false });
contains(outWarn, 'warnings-only', 'warn card verdict');
contains(outWarn, '1 finding', 'singular finding');
absent(outWarn, '1 findings', 'no plural for 1');
const outBlocked = (0, panel_renderer_1.renderSidecoachPanel)((0, panel_model_1.assemblePanelModel)({ flowResults: chain, report: report({ verdict: 'blocked', overallGrade: 'F', severityCounts: { blocking: 2, warning: 0, info: 0 } }) }), { color: false });
contains(outBlocked, 'blocked', 'blocked verdict');
const outSnap = (0, panel_renderer_1.renderSidecoachPanel)(snap, { color: false });
contains(outSnap, '[running]', 'partial shows running');
absent(outSnap, 'verdict', 'partial omits verdict');
absent((0, panel_renderer_1.renderSidecoachPanel)(clean, { color: false }), ESC, 'color:false has no ANSI');
contains((0, panel_renderer_1.renderSidecoachPanel)(clean, { color: true }), ESC, 'color:true has ANSI');
// laneStepToPanelModel: partial (no gate) + terminal (with gate)
const laneSnap = (0, panel_model_1.laneStepToPanelModel)({
    currentVerb: 'audit',
    flowIds: ['flowA_brand_verify', 'flowK_multi_lens_audit'],
    checklist: [{ id: 'flowA_brand_verify:1', label: 'verify', completed: true }, { id: 'flowK_multi_lens_audit:1', label: 'a11y', completed: false }],
});
ok(laneSnap.partial === true && laneSnap.verdict === undefined, 'lane partial');
ok(laneSnap.checklist[0].done === true && laneSnap.checklist[1].done === false, 'lane checklist done states');
const laneDone = (0, panel_model_1.laneStepToPanelModel)({
    currentVerb: 'audit',
    flowIds: ['flowK_multi_lens_audit'],
    checklist: [{ id: 'flowK_multi_lens_audit:1', label: 'a11y', completed: true }],
    gate: { status: 'pass', validators: [{ validatorId: 'taste', status: 'pass' }, { validatorId: 'polish-standard', status: 'pass' }], findings: [] },
});
ok(laneDone.partial === false && laneDone.verdict === 'clean', 'lane terminal -> clean verdict');
ok(laneDone.gates.find((g) => g.name === 'taste')?.ok === true, 'lane gate taste pass');
if (failures > 0) {
    console.error(`panel-renderer: ${failures} failure(s)`);
    process.exit(1);
}
console.log('panel-renderer: all checks passed');
//# sourceMappingURL=panel-renderer.test.js.map