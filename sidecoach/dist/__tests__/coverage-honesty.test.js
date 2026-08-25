"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Standalone test (sidecoach convention: no vitest; assert + process.exit).
// Run directly: npx ts-node src/__tests__/coverage-honesty.test.ts
//
// GREEN MEANS CHECKED (Item 2, honesty line). Proves the #1 risk is closed: an INCONCLUSIVE /
// UNVERIFIED result can never render as an unqualified "clean" / "passed". Every executive report
// and panel that can show a clean or quiet result now opens with an explicit coverage line that
// distinguishes VERIFIED CLEAN from NOT FULLY CHECKED / PARTIALLY CHECKED. This test:
//   1. feeds an `inconclusive` audit verdict and asserts the render carries the not-fully-checked
//      banner AND carries NO bare "clean"/"passed" certification;
//   2. asserts a genuinely clean audit verdict renders the verified-clean line;
//   3. asserts partial coverage (clean verdict, a lens down) is NOT certified verified-clean;
//   4. asserts the panel and the ANSI audit report make the same distinction;
//   5. asserts an unmeasured (no-verdict) panel makes NO coverage claim.
// bin/ code is CommonJS, so it is required directly (matches executive-report.test.ts).
const path = __importStar(require("path"));
const panel_model_1 = require("../panel-model");
const panel_renderer_1 = require("../panel-renderer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const present = require(path.join(__dirname, '..', '..', 'bin', 'sidecoach-present'));
const renderExecutiveReport = present.renderExecutiveReport;
const renderAnsi = present.render;
let failures = 0;
function ok(cond, label) { if (!cond) {
    console.error('FAIL ' + label);
    failures++;
} }
function contains(hay, needle, label) {
    if (!hay.includes(needle)) {
        console.error('FAIL ' + label + ': missing ' + JSON.stringify(needle));
        failures++;
    }
}
function absent(hay, needle, label) {
    if (hay.includes(needle)) {
        console.error('FAIL ' + label + ': should not contain ' + JSON.stringify(needle));
        failures++;
    }
}
function absentRe(hay, re, label) {
    if (re.test(hay)) {
        console.error('FAIL ' + label + ': should not match ' + re);
        failures++;
    }
}
function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ''); }
function firstContentLine(s) {
    return s.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)[0] || '';
}
// A "bare clean/passed" certification: the unqualified positive claims this honesty line exists to
// prevent on an unverified result. (A negated phrase like "not a verified-clean result" is fine -
// it does not certify anything, so these patterns deliberately anchor on the certifying forms.)
function assertNoBarePass(out, label) {
    absentRe(out, /^Audit: clean/m, label + ': no bare "Audit: clean" status');
    absentRe(out, /Checks passed/i, label + ': no "Checks passed"');
    absentRe(out, /\bpassed\b/i, label + ': no bare "passed"');
    absent(out, 'Coverage: VERIFIED CLEAN', label + ': coverage line is not VERIFIED CLEAN');
    absent(out, 'No defects found', label + ': no certified no-defects block');
}
// ---- 1. INCONCLUSIVE audit -> not-fully-checked banner, and NO bare clean/passed --------------
const inconclusiveAudit = {
    audit: {
        renderUrl: 'http://localhost:59997', verdict: 'inconclusive', totalFindings: 0, rendered: false,
        unavailableReasons: ['ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_REFUSED'],
        lenses: { objective: { available: false }, subjective: { available: false } }, byRule: [], topFixes: [],
    },
};
const incOut = renderExecutiveReport(inconclusiveAudit, 'audit localhost:59997');
contains(incOut, 'NOT FULLY CHECKED', 'inconclusive: not-fully-checked banner present');
ok(/^Coverage: NOT FULLY CHECKED/.test(firstContentLine(incOut)), 'inconclusive: coverage line is the header (first content line)');
assertNoBarePass(incOut, 'inconclusive exec-report');
// The engine's own three-valued verdict is surfaced, not collapsed.
contains(incOut, 'Audit: inconclusive', 'inconclusive: status still names the inconclusive verdict');
// ---- 2. Genuinely CLEAN audit (both lenses ran, zero findings) -> verified-clean line ----------
const cleanAudit = {
    audit: {
        renderUrl: 'http://localhost:4830', verdict: 'clean', totalFindings: 0, rendered: true,
        unavailableReasons: [], lenses: { objective: { available: true, findings: 0 }, subjective: { available: true, findings: 0 } },
        byRule: [], topFixes: [],
    },
};
const cleanOut = renderExecutiveReport(cleanAudit, 'audit localhost:4830');
contains(cleanOut, 'Coverage: VERIFIED CLEAN', 'clean: verified-clean coverage line present');
ok(/^Coverage: VERIFIED CLEAN/.test(firstContentLine(cleanOut)), 'clean: verified-clean is the header (first content line)');
contains(cleanOut, 'Audit: clean. No findings.', 'clean: certified-clean status still present');
// ---- 3. CLEAN verdict but a lens is DOWN (partial coverage) -> never verified-clean ------------
const partialClean = {
    audit: {
        renderUrl: 'http://localhost:4830', verdict: 'clean', totalFindings: 0, rendered: true,
        unavailableReasons: [], lenses: { objective: { available: true, findings: 0 }, subjective: { available: false } },
        byRule: [], topFixes: [],
    },
};
const partialOut = renderExecutiveReport(partialClean, 'audit localhost:4830');
contains(partialOut, 'PARTIALLY CHECKED', 'partial: partially-checked banner present');
assertNoBarePass(partialOut, 'partial-coverage exec-report');
// ---- 4. FINDINGS audit, full coverage -> CHECKED (fully scanned, findings listed) --------------
const findingsAudit = {
    audit: {
        renderUrl: 'http://localhost:4830', verdict: 'blocked', totalFindings: 2, rendered: true, unavailableReasons: [],
        lenses: { objective: { available: true, findings: 2 }, subjective: { available: true, findings: 0 } },
        byRule: [{ rule: 'low-contrast', lens: 'objective', count: 2 }],
        topFixes: [{ selector: 'button.cta', metric: '3.1:1', rule: 'low-contrast' }],
    },
};
const findingsOut = renderExecutiveReport(findingsAudit, 'audit localhost:4830');
contains(findingsOut, 'Coverage: CHECKED', 'findings: checked coverage line present');
ok(/^Coverage: CHECKED/.test(firstContentLine(findingsOut)), 'findings: coverage line is the header');
// ---- 5. BUILD executive report: clean vs findings coverage lines -------------------------------
const cleanBuild = renderExecutiveReport({
    buildReport: { composite: 'brand verify', verdict: 'clean', overallGrade: 'A', severityCounts: { blocking: 0, warning: 0, info: 0 }, findings: [] },
    flowResults: [{ flowId: 'flowA_brand_verify', status: 'success' }],
}, 'verify the brand');
contains(cleanBuild, 'Coverage: VERIFIED CLEAN', 'build-clean: verified-clean coverage line present');
ok(/^Coverage: VERIFIED CLEAN/.test(firstContentLine(cleanBuild)), 'build-clean: coverage line is the header');
const findingsBuild = renderExecutiveReport({
    buildReport: {
        composite: 'polish pass', verdict: 'warnings-only', overallGrade: 'B', severityCounts: { blocking: 0, warning: 1, info: 0 },
        findings: [{ severity: 'warning', source: 'polish-standard', flowId: 'flowJ', rule: 'tiny-text', message: 'Footer legal text renders at 10px.' }],
    },
    flowResults: [{ flowId: 'flowJ_tactical_polish', status: 'success' }],
}, 'polish the pricing section');
contains(findingsBuild, 'Coverage: CHECKED', 'build-findings: checked coverage line present');
// ---- 6. ANSI audit report (present.render) makes the same distinction --------------------------
const incAnsi = stripAnsi(renderAnsi(inconclusiveAudit, 'audit localhost:59997'));
contains(incAnsi, 'coverage', 'ansi inconclusive: coverage headline present');
contains(incAnsi, 'NOT FULLY CHECKED', 'ansi inconclusive: not-fully-checked banner present');
absent(incAnsi, 'VERIFIED CLEAN', 'ansi inconclusive: never says VERIFIED CLEAN');
const cleanAnsi = stripAnsi(renderAnsi(cleanAudit, 'audit localhost:4830'));
contains(cleanAnsi, 'VERIFIED CLEAN', 'ansi clean: verified-clean headline present');
// ---- 7. coverageForVerdict maps the EXISTING verdict, invents no new state ---------------------
ok((0, panel_model_1.coverageForVerdict)('clean') === 'verified-clean', 'coverageForVerdict: clean -> verified-clean');
ok((0, panel_model_1.coverageForVerdict)('warnings-only') === 'checked', 'coverageForVerdict: warnings-only -> checked');
ok((0, panel_model_1.coverageForVerdict)('blocked') === 'checked', 'coverageForVerdict: blocked -> checked');
ok((0, panel_model_1.coverageForVerdict)(undefined) === undefined, 'coverageForVerdict: no verdict -> undefined (no claim)');
// ---- 8. PANEL: clean card carries VERIFIED CLEAN; a run with no verdict makes NO claim ----------
function flow(id, name, status = 'success') {
    return { flowId: id, flowName: name, status, message: '' };
}
function report(partial) {
    return {
        reportId: 'r', generatedAt: '2026-08-25T00:00:00.000Z', flowsExecuted: [],
        verdict: 'clean', severityCounts: { blocking: 0, warning: 0, info: 0 },
        overallGrade: 'A', overallPassRate: 100, domainGrades: [], findings: [], nextSteps: [],
        ...partial,
    };
}
const chain = [flow('flowA_brand_verify', 'Brand Verification'), flow('flowK_multi_lens_audit', 'Multi-Lens Audit')];
const cleanModel = (0, panel_model_1.assemblePanelModel)({ flowResults: chain, report: report({}), confidence: 0.9 });
ok(cleanModel.coverage === 'verified-clean', 'panel-model: clean verdict -> coverage verified-clean');
const cleanCard = (0, panel_renderer_1.renderSidecoachPanel)(cleanModel, { color: false });
contains(cleanCard, 'VERIFIED CLEAN', 'panel clean card: shows VERIFIED CLEAN coverage line');
const blockedModel = (0, panel_model_1.assemblePanelModel)({ flowResults: chain, report: report({ verdict: 'blocked', overallGrade: 'F', severityCounts: { blocking: 2, warning: 0, info: 0 } }) });
ok(blockedModel.coverage === 'checked', 'panel-model: blocked verdict -> coverage checked');
const blockedCard = (0, panel_renderer_1.renderSidecoachPanel)(blockedModel, { color: false });
contains(blockedCard, 'CHECKED', 'panel blocked card: shows CHECKED coverage line');
absent(blockedCard, 'VERIFIED CLEAN', 'panel blocked card: never says VERIFIED CLEAN');
// A run that measured nothing: no report -> no verdict -> no coverage claim on the card.
const unmeasured = (0, panel_model_1.assemblePanelModel)({
    flowResults: [flow('flowA_brand_verify', 'Brand Verification', 'needs_input')],
    notice: 'NO PAGE WAS RENDERED - nothing below is a measurement of a page.',
});
ok(unmeasured.coverage === undefined, 'panel-model: no verdict -> coverage undefined (no claim)');
const unmeasuredCard = (0, panel_renderer_1.renderSidecoachPanel)(unmeasured, { color: false });
absent(unmeasuredCard, 'VERIFIED CLEAN', 'panel unmeasured card: makes NO verified-clean claim');
absent(unmeasuredCard, 'coverage', 'panel unmeasured card: emits no coverage line at all');
contains(unmeasuredCard, 'NO PAGE WAS RENDERED', 'panel unmeasured card: notice still carries the honesty');
// ==============================================================================================
// CODEX 2026-08-25 re-review: 4 gaps where a NOT-fully-verified result still read as certified.
// Governing rule: VERIFIED CLEAN requires POSITIVE evidence BOTH lenses ran AND found nothing;
// anything less downgrades or makes no claim. One regression per finding.
// ==============================================================================================
// ---- FINDING 1 (High): a no-measurement executive result must make NO pass claim ---------------
// /sidecoach list returns no audit and no buildReport - it measured nothing, so no VERIFIED CLEAN,
// no "Checks passed", no coverage line at all.
const listResult = { success: true, message: 'Available Sidecoach Commands', detectedFlow: null, flowResults: [], guidance: ['Available Sidecoach Commands'] };
const listOut = renderExecutiveReport(listResult, '/sidecoach list');
absent(listOut, 'VERIFIED CLEAN', 'F1 list: makes no VERIFIED CLEAN claim');
absentRe(listOut, /Checks passed/i, 'F1 list: makes no "Checks passed" claim');
absentRe(listOut, /^Coverage:/m, 'F1 list: emits no coverage line at all (nothing measured)');
contains(listOut, 'nothing was measured', 'F1 list: explicitly says nothing was measured');
// CONTRAST: a real MEASURED clean build (a buildReport was attached) STILL certifies.
const measuredClean = { success: true, buildReport: { composite: 'polish', verdict: 'clean', overallGrade: 'A', findings: [], severityCounts: { blocking: 0, warning: 0, info: 0 } }, flowResults: [{ flowId: 'flowJ_tactical_polish', status: 'success' }] };
const measuredCleanOut = renderExecutiveReport(measuredClean, '/sidecoach polish x');
contains(measuredCleanOut, 'Coverage: VERIFIED CLEAN', 'F1 measured-clean: real report still certifies VERIFIED CLEAN');
contains(measuredCleanOut, 'Checks passed', 'F1 measured-clean: real report still reports Checks passed');
// ---- FINDING 2 (High): a lane panel with an INCONCLUSIVE/ERROR gate must not read as CHECKED ----
const laneInconclusive = (0, panel_model_1.laneStepToPanelModel)({
    currentVerb: 'audit',
    flowIds: ['flowK_multi_lens_audit'],
    checklist: [{ id: 'flowK_multi_lens_audit:1', label: 'a11y', completed: true }],
    gate: { status: 'inconclusive', validators: [{ validatorId: 'taste', status: 'inconclusive' }], findings: [] },
});
ok(laneInconclusive.coverage === 'not-fully-checked', 'F2 lane: inconclusive gate -> coverage not-fully-checked');
ok(laneInconclusive.verdict === undefined, 'F2 lane: inconclusive gate -> no clean/pass verdict claim');
const laneIncCard = (0, panel_renderer_1.renderSidecoachPanel)(laneInconclusive, { color: false });
contains(laneIncCard, 'NOT FULLY CHECKED', 'F2 lane card: shows NOT FULLY CHECKED');
absent(laneIncCard, 'VERIFIED CLEAN', 'F2 lane card: never VERIFIED CLEAN');
// error gate is treated the same
const laneError = (0, panel_model_1.laneStepToPanelModel)({
    currentVerb: 'audit', flowIds: ['flowK_multi_lens_audit'],
    checklist: [{ id: 'flowK_multi_lens_audit:1', label: 'a11y', completed: true }],
    gate: { status: 'error', validators: [{ validatorId: 'taste', status: 'error' }], findings: [] },
});
ok(laneError.coverage === 'not-fully-checked', 'F2 lane: error gate -> coverage not-fully-checked');
// CONTRAST: a genuinely clean gate still certifies verified-clean.
const laneClean = (0, panel_model_1.laneStepToPanelModel)({
    currentVerb: 'audit', flowIds: ['flowK_multi_lens_audit'],
    checklist: [{ id: 'flowK_multi_lens_audit:1', label: 'a11y', completed: true }],
    gate: { status: 'clean', validators: [{ validatorId: 'taste', status: 'pass' }], findings: [] },
});
ok(laneClean.coverage === 'verified-clean', 'F2 lane: clean gate -> verified-clean');
// ---- FINDING 3 (Med): a clean verdict with a MISSING lens must not certify verified-clean -------
const missingLensClean = {
    audit: { renderUrl: 'http://localhost:4830', verdict: 'clean', totalFindings: 0, rendered: true, unavailableReasons: [], lenses: { objective: { available: true, findings: 0 } }, byRule: [], topFixes: [] },
};
const missingLensOut = renderExecutiveReport(missingLensClean, 'audit localhost:4830');
contains(missingLensOut, 'PARTIALLY CHECKED', 'F3 missing-lens: PARTIALLY CHECKED (a lens is absent)');
assertNoBarePass(missingLensOut, 'F3 missing-lens exec-report');
// ---- FINDING 4 (Med): a forced-partial panel must not certify even with a clean verdict ---------
const partialCleanPanel = (0, panel_model_1.assemblePanelModel)({ flowResults: chain, report: report({}), partial: true });
ok(partialCleanPanel.coverage === 'not-fully-checked', 'F4 panel: partial + clean verdict -> not-fully-checked');
const partialCleanCard = (0, panel_renderer_1.renderSidecoachPanel)(partialCleanPanel, { color: false });
absent(partialCleanCard, 'VERIFIED CLEAN', 'F4 panel card: partial snapshot never VERIFIED CLEAN');
contains(partialCleanCard, 'NOT FULLY CHECKED', 'F4 panel card: shows NOT FULLY CHECKED');
// ==============================================================================================
// CODEX 2026-08-25 THIRD pass: 2 deeper paths where a run that never actually checked still read
// as certified. Same rule: VERIFIED CLEAN needs positive evidence checks ACTUALLY RAN and found
// nothing. One regression per finding, genuine-clean contrast preserved.
// ==============================================================================================
// ---- FINDING 5 (High): a ZERO-VALIDATOR 'clean' lane gate ran nothing - must NOT certify ---------
// `shape` uses only flowA_brand_verify, which has no product validators; the lane aggregates the
// empty validator list as 'clean'. Nothing actually ran, so this is "nothing measured", not clean.
const laneZeroValidators = (0, panel_model_1.laneStepToPanelModel)({
    currentVerb: 'shape',
    flowIds: ['flowA_brand_verify'],
    checklist: [{ id: 'flowA_brand_verify:1', label: 'brand', completed: true }],
    gate: { status: 'clean', validators: [], findings: [] },
});
ok(laneZeroValidators.coverage === 'not-fully-checked', 'F5 lane: zero-validator clean gate -> not-fully-checked');
ok(laneZeroValidators.verdict === undefined, 'F5 lane: zero-validator gate -> no clean/verified verdict claim');
const laneZeroCard = (0, panel_renderer_1.renderSidecoachPanel)(laneZeroValidators, { color: false });
contains(laneZeroCard, 'NOT FULLY CHECKED', 'F5 lane card: shows NOT FULLY CHECKED');
absent(laneZeroCard, 'VERIFIED CLEAN', 'F5 lane card: never VERIFIED CLEAN when nothing ran');
// CONTRAST (kept): a gate with >=1 validator all clean STILL certifies verified-clean.
ok(laneClean.coverage === 'verified-clean', 'F5 contrast: >=1 validator all clean -> still verified-clean');
// ---- FINDING 6 (Med): a PARTIAL rendered audit must read PARTIALLY CHECKED in the PANEL too -------
// The panel is built from the BuildReport alone, which cannot see audit.unavailableReasons; the
// orchestrator threads the incomplete-coverage signal via auditPartial so the panel does not show an
// unqualified CHECKED for a scan where a lens did not run.
const partialAuditReport = report({ verdict: 'blocked', overallGrade: 'F', severityCounts: { blocking: 1, warning: 0, info: 0 }, findings: [{ severity: 'blocking', source: 'a11y', flowId: 'flowK_multi_lens_audit', rule: 'low-contrast', message: 'x' }] });
const partialAuditPanel = (0, panel_model_1.assemblePanelModel)({ flowResults: chain, report: partialAuditReport, auditPartial: true });
ok(partialAuditPanel.coverage === 'partially-checked', 'F6 panel: partial audit (a lens did not run) -> partially-checked');
const partialAuditCard = (0, panel_renderer_1.renderSidecoachPanel)(partialAuditPanel, { color: false });
contains(partialAuditCard, 'PARTIALLY CHECKED', 'F6 panel card: shows PARTIALLY CHECKED');
absent(partialAuditCard, 'VERIFIED CLEAN', 'F6 panel card: never VERIFIED CLEAN for a partial scan');
// CONTRAST (kept): a full both-lens clean audit panel still certifies verified-clean.
ok(cleanModel.coverage === 'verified-clean', 'F6 contrast: full-coverage clean audit panel -> still verified-clean');
if (failures > 0) {
    console.error('coverage-honesty: ' + failures + ' failure(s)');
    process.exit(1);
}
console.log('coverage-honesty: all checks passed');
//# sourceMappingURL=coverage-honesty.test.js.map