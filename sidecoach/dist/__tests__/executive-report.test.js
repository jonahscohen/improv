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
// Verifies the CODE-ENFORCED executive report from bin/sidecoach-present.js:
//   - one `####` block per finding-category
//   - a valid Markdown table in each block (| separators + header + dash row)
//   - a non-empty prose summary sentence after each block's table
//   - exactly ONE closing status line
//   - NO occurrence of the retired panel's chrome (box rules, brand glyphs, ANSI)
// bin/ code is CommonJS, so it is required directly (matches lane-cli.test.ts driving
// bin/sidecoach-monitor.js). Run directly: npx ts-node src/__tests__/executive-report.test.ts
const path = __importStar(require("path"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const present = require(path.join(__dirname, '..', '..', 'bin', 'sidecoach-present'));
const renderExecutiveReport = present.renderExecutiveReport;
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
const ESC = '\x1b'; // ANSI escape - the panel colorized; the report must not.
// Representative panel chrome the executive report must never emit.
const PANEL_CHROME = ['◆', '◇', '✓', '✗', '▰', '▱', '─', '›',
    'handed to claude', 'priority fixes', 'conf ', ESC];
// Leading tokens that identify a closing status line (and only a status line).
const STATUS_RE = /^(Audit: |Checks passed\. |Clean: |Blocked: |Warnings-only: )/;
// Split a report into its `####` blocks (each string starts at its heading).
function blocks(report) {
    return report.split(/\n(?=#### )/).filter((b) => b.startsWith('#### '));
}
function nonEmptyLines(s) { return s.split('\n').map((l) => l).filter((l) => l.trim().length > 0); }
// Structural gate applied to every report: valid table per block, prose after each block,
// exactly one status line, no panel chrome, no ANSI.
function assertReportShape(report, label) {
    const bs = blocks(report);
    ok(bs.length >= 1, label + ': has at least one #### block');
    const lines = nonEmptyLines(report);
    // exactly one closing status line, and it is the final line.
    const statusLines = lines.filter((l) => STATUS_RE.test(l));
    ok(statusLines.length === 1, label + ': exactly one closing status line (got ' + statusLines.length + ')');
    ok(STATUS_RE.test(lines[lines.length - 1]), label + ': status line is last');
    bs.forEach((block, i) => {
        const bl = block.split('\n');
        ok(/^#### \S/.test(bl[0]), label + ' block ' + i + ': heading present');
        const header = bl.find((l) => /^\|.+\|.+\|$/.test(l.trim()));
        const divider = bl.find((l) => /^\|\s*-{2,}\s*\|\s*-{2,}\s*\|$/.test(l.trim()));
        ok(!!header, label + ' block ' + i + ': table header row present');
        ok(!!divider, label + ' block ' + i + ': table divider row present');
        // >= 1 data row (a | row that is neither header nor divider).
        const dataRows = bl.filter((l) => /^\|.+\|.+\|$/.test(l.trim()) && l !== header && !/^\|\s*-{2,}/.test(l.trim()));
        ok(dataRows.length >= 1, label + ' block ' + i + ': at least one data row');
        // header has exactly two columns.
        ok(!!header && header.trim().split('|').filter((c) => c.trim().length > 0).length === 2, label + ' block ' + i + ': table has two columns');
        // prose summary: a non-table, non-heading, non-status line after the divider.
        const divIdx = bl.indexOf(divider);
        const after = bl.slice(divIdx + 1);
        const prose = after.filter((l) => l.trim().length > 0 && !l.trim().startsWith('|') && !l.trim().startsWith('#### ') && !STATUS_RE.test(l.trim()));
        ok(prose.length >= 1, label + ' block ' + i + ': non-empty prose summary after table');
        ok(prose.some((l) => /[a-z]/i.test(l) && /\.$/.test(l.trim())), label + ' block ' + i + ': summary reads as a sentence');
    });
    PANEL_CHROME.forEach((ch) => absent(report, ch, label + ': no panel chrome ' + JSON.stringify(ch)));
}
// ---- Fixture 1: AUDIT-shaped (blocked, 2 rules across 2 lenses) ----------------------
const auditResult = {
    audit: {
        renderUrl: 'http://localhost:4830',
        verdict: 'blocked',
        totalFindings: 3,
        rendered: true,
        unavailableReasons: [],
        lenses: { objective: { available: true, findings: 2 }, subjective: { available: true, findings: 1 } },
        byRule: [
            { rule: 'low-contrast', lens: 'objective', count: 2 },
            { rule: 'marketing-buzzword', lens: 'subjective', count: 1 },
        ],
        topFixes: [
            { selector: 'button.cta', metric: '3.1:1', rule: 'low-contrast' },
            { selector: 'a.nav', metric: '4.2:1', rule: 'low-contrast' },
            { selector: 'h1.hero', rule: 'marketing-buzzword' },
        ],
    },
};
const auditReport = renderExecutiveReport(auditResult, 'audit localhost:4830');
assertReportShape(auditReport, 'audit');
contains(auditReport, '#### Low contrast', 'audit: low-contrast block heading');
contains(auditReport, '#### Marketing buzzword', 'audit: marketing-buzzword block heading');
contains(auditReport, '| Finding | Fix |', 'audit: Finding/Fix table header');
contains(auditReport, 'button.cta (3.1:1) - contrast under 4.5:1', 'audit: selector+metric finding cell');
contains(auditReport, 'h1.hero - vague marketing copy', 'audit: taste finding cell');
contains(auditReport, 'raise the text or background contrast to at least 4.5:1', 'audit: contrast fix cell');
contains(auditReport, 'low-contrast text is hard to read', 'audit: summary explains why it matters');
// exact status line: verdict, total, category count, per-lens breakdown.
const AUDIT_STATUS = 'Audit: blocked, 3 findings across 2 categories (2 accessibility findings, 1 taste finding).';
ok(auditReport.trim().endsWith(AUDIT_STATUS), 'audit: status line matches exactly');
ok(auditReport.split(AUDIT_STATUS).length === 2, 'audit: status line appears exactly once');
absent(auditReport, 'gates', 'audit: no gate-by-gate accounting');
absent(auditReport, 'route', 'audit: no routing narration');
// ---- Fixture 2: BUILD-shaped (warnings-only, 2 rules) ---------------------------------
const buildResult = {
    buildReport: {
        composite: 'polish pass',
        verdict: 'warnings-only',
        overallGrade: 'B',
        severityCounts: { blocking: 0, warning: 2, info: 0 },
        findings: [
            { severity: 'warning', source: 'polish-standard', flowId: 'flowJ', rule: 'tiny-text', message: 'Footer legal text renders at 10px.', fix: 'raise the footer text to 14px' },
            { severity: 'warning', source: 'polish-standard', flowId: 'flowJ', rule: 'nested-cards', message: 'Pricing card wraps a second card.' },
        ],
    },
    flowResults: [{ flowId: 'flowJ_tactical_polish', status: 'success' }],
};
const buildReport = renderExecutiveReport(buildResult, 'polish the pricing section');
assertReportShape(buildReport, 'build');
contains(buildReport, '#### Tiny text', 'build: tiny-text block heading');
contains(buildReport, '#### Nested cards', 'build: nested-cards block heading');
contains(buildReport, '| Before | After |', 'build: Before/After table header');
contains(buildReport, '| Footer legal text renders at 10px. | raise the footer text to 14px |', 'build: finding-carried fix used verbatim');
contains(buildReport, 'flatten the inner card or swap it for a lighter container', 'build: derived fix for fix-less finding');
const BUILD_STATUS = 'Warnings-only: 2 findings (2 warnings), grade B.';
ok(buildReport.trim().endsWith(BUILD_STATUS), 'build: status line matches exactly');
ok(buildReport.split(BUILD_STATUS).length === 2, 'build: status line appears exactly once');
// ---- Fixture 3: clean build (no findings) -> single block + Checks passed status ------
const cleanBuild = renderExecutiveReport({
    buildReport: { composite: 'brand verify', verdict: 'clean', overallGrade: 'A', severityCounts: { blocking: 0, warning: 0, info: 0 }, findings: [] },
    flowResults: [{ flowId: 'flowA_brand_verify', status: 'success' }],
}, 'verify the brand');
assertReportShape(cleanBuild, 'clean-build'); // clean blocks carry a table + prose too
contains(cleanBuild, 'Checks passed. Grade A, 0 findings.', 'clean: Checks passed status');
// ---- Fixture 4: inconclusive audit -> could-not-run block + inconclusive status -------
const inconclusive = renderExecutiveReport({
    audit: { renderUrl: 'http://localhost:59997', verdict: 'inconclusive', totalFindings: 0, rendered: false, unavailableReasons: ['ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_REFUSED'], lenses: { objective: { available: false }, subjective: { available: false } }, byRule: [], topFixes: [] },
}, 'audit localhost:59997');
contains(inconclusive, '#### Audit could not run', 'inconclusive: could-not-run block');
contains(inconclusive, 'connection refused', 'inconclusive: reason surfaced in plain English');
ok(/Audit: inconclusive\./.test(inconclusive), 'inconclusive: inconclusive status line');
ok(!/Audit: clean/.test(inconclusive), 'inconclusive: status never certifies clean');
contains(inconclusive, 'not a clean result', 'inconclusive: explicitly disclaims a clean result');
// ---- Fixture 5: clean audit (both lenses ran, zero findings) -> certified clean --------
const cleanAudit = renderExecutiveReport({
    audit: { renderUrl: 'http://localhost:4830', verdict: 'clean', totalFindings: 0, rendered: true, unavailableReasons: [], lenses: { objective: { available: true, findings: 0 }, subjective: { available: true, findings: 0 } }, byRule: [], topFixes: [] },
}, 'audit localhost:4830');
assertReportShape(cleanAudit, 'clean-audit'); // clean blocks carry a table + prose too
contains(cleanAudit, '#### No defects found', 'clean audit: no-defects block');
contains(cleanAudit, 'Audit: clean. No findings.', 'clean audit: certified-clean status');
// ---- Fixture 5b: clean verdict but a lens is unavailable with NO unavailableReasons ----
// Coverage is partial via the lens flag alone - the report must NOT certify clean.
const cleanButLensDown = renderExecutiveReport({
    audit: { renderUrl: 'http://localhost:4830', verdict: 'clean', totalFindings: 0, rendered: true, unavailableReasons: [], lenses: { objective: { available: true, findings: 0 }, subjective: { available: false } }, byRule: [], topFixes: [] },
}, 'audit localhost:4830');
ok(!/Audit: clean/.test(cleanButLensDown), 'partial-lens: never certifies clean when a lens is unavailable');
contains(cleanButLensDown, 'not certified clean', 'partial-lens: says coverage was partial');
// ---- Fixture 6: zero findings but NOT a certified-clean verdict -> never says clean -----
// Guards the fail-closed invariant: "clean" is a certification, not a bare zero count.
// A non-clean verdict with nothing enumerated must not be reported as clean.
const zeroNotClean = renderExecutiveReport({
    audit: { renderUrl: 'http://localhost:4830', verdict: 'blocked', totalFindings: 0, rendered: true, unavailableReasons: [], lenses: { objective: { available: true, findings: 0 }, subjective: { available: true, findings: 0 } }, byRule: [], topFixes: [] },
}, 'audit localhost:4830');
ok(!/Audit: clean/.test(zeroNotClean), 'zero-not-clean: never certifies clean on a non-clean verdict');
contains(zeroNotClean, '#### No findings to list', 'zero-not-clean: honest no-findings block');
const zeroLines = nonEmptyLines(zeroNotClean);
ok(zeroLines.filter((l) => STATUS_RE.test(l)).length === 1, 'zero-not-clean: exactly one status line');
if (failures > 0) {
    console.error('executive-report: ' + failures + ' failure(s)');
    process.exit(1);
}
console.log('executive-report: all checks passed');
//# sourceMappingURL=executive-report.test.js.map