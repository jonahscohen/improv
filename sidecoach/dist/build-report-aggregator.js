"use strict";
// Build Report aggregator.
// Walks FlowExecutionResult[] memory data and produces a BuildReport struct + markdown.
// Scope (Phase 5): consumes structured validation data from FlowMemoryEntry
// (.validationResults, .metrics, .gates). Out of scope: unstructured guidance-line
// findings from ClaudemdMandate / PolishStandard / Taste validators.
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
exports.generateBuildReport = generateBuildReport;
exports.renderBuildReportMarkdown = renderBuildReportMarkdown;
const fs = __importStar(require("fs"));
const build_report_types_1 = require("./build-report-types");
// Parse FlowMemoryEntry JSON blocks from session memory files.
// Convention: a session memory file may contain one or more fenced code blocks
// tagged json that decode to a valid FlowMemoryEntry shape (flowId, status,
// validationResults array). All matching blocks become skeleton
// FlowExecutionResult objects. Files that cannot be read or contain no valid
// FlowMemoryEntry JSON are silently skipped (logged to stderr).
function readFlowResultsFromMemory(paths) {
    const results = [];
    const jsonBlockRe = /```json\s*\n([\s\S]*?)\n```/g;
    for (const p of paths) {
        let content;
        try {
            content = fs.readFileSync(p, 'utf8');
        }
        catch (err) {
            process.stderr.write(`build-report-aggregator: skip unreadable path ${p}: ${err.message}\n`);
            continue;
        }
        let match;
        while ((match = jsonBlockRe.exec(content)) !== null) {
            let parsed;
            try {
                parsed = JSON.parse(match[1]);
            }
            catch {
                continue;
            }
            if (!parsed ||
                typeof parsed.flowId !== 'string' ||
                typeof parsed.status !== 'string' ||
                !Array.isArray(parsed.validationResults)) {
                continue;
            }
            results.push({
                flowId: parsed.flowId,
                flowName: parsed.flowName || parsed.flowId,
                status: parsed.status,
                message: parsed.summary || '(from memory)',
                memory: parsed,
            });
        }
    }
    return results;
}
const DEFAULT_OPTIONS = {
    includeInfo: false,
    maxFindings: 50,
    thresholds: build_report_types_1.DEFAULT_THRESHOLDS,
};
function statusToSeverity(status) {
    if (status === 'fail')
        return 'blocking';
    if (status === 'warning')
        return 'warning';
    return null;
}
function findingsFromResult(result) {
    const findings = [];
    const memory = result.memory;
    if (memory) {
        for (const v of memory.validationResults || []) {
            const sev = statusToSeverity(v.result);
            if (!sev)
                continue;
            findings.push({
                severity: sev,
                source: result.flowId,
                flowId: result.flowId,
                rule: v.check,
                message: v.details || v.check,
            });
        }
        for (const m of memory.metrics || []) {
            const sev = statusToSeverity(m.status);
            if (!sev)
                continue;
            findings.push({
                severity: sev,
                source: result.flowId,
                flowId: result.flowId,
                rule: m.name,
                message: `${m.name} = ${m.value}${m.target !== undefined ? ` (target ${m.target})` : ''}`,
            });
        }
        for (const g of memory.gates || []) {
            if (g.passed)
                continue;
            findings.push({
                severity: g.required ? 'blocking' : 'warning',
                source: result.flowId,
                flowId: result.flowId,
                rule: `gate:${g.name}`,
                message: g.error || `Gate "${g.name}" not passed`,
            });
        }
    }
    // Sprint 7 T6: also read result.validationResults (flow-composition ValidationResult shape).
    // These come from ClaudemdMandate / PolishStandard / Taste validators pushed by the orchestrator.
    const vrs = result.validationResults;
    if (Array.isArray(vrs)) {
        for (const vr of vrs) {
            // Skip pass results - only emit findings for fail/partial.
            if (vr.status === 'pass')
                continue;
            const sev = vr.status === 'fail' ? 'blocking' : 'warning';
            const rules = vr.failedRules && vr.failedRules.length > 0 ? vr.failedRules : ['(unspecified)'];
            for (const rule of rules) {
                findings.push({
                    severity: sev,
                    source: result.flowId,
                    flowId: result.flowId,
                    rule: `${vr.domain}:${rule}`,
                    message: vr.message || rule,
                });
            }
        }
    }
    return findings;
}
function domainGradesFromResults(results, thresholds) {
    const byDomain = new Map();
    for (const result of results) {
        const memory = result.memory;
        if (memory) {
            for (const m of memory.metrics || []) {
                const dotIdx = String(m.name).indexOf('.');
                if (dotIdx < 0)
                    continue;
                const domain = String(m.name).substring(0, dotIdx);
                const value = typeof m.value === 'number' ? m.value : Number(m.value);
                if (!Number.isFinite(value))
                    continue;
                const passed = m.status === 'pass' ? 1 : 0;
                const existing = byDomain.get(domain) || { passSum: 0, count: 0, rulesPassed: 0, rulesTotal: 0 };
                existing.passSum += value;
                existing.count += 1;
                existing.rulesPassed += passed;
                existing.rulesTotal += 1;
                byDomain.set(domain, existing);
            }
        }
        // Sprint 7 T6: roll up flow-composition ValidationResult entries into domain grades.
        // Each ValidationResult contributes a 0-100 pass-rate contribution to its domain.
        // pass -> 100; fail -> 0; partial -> passedCount/total * 100.
        const vrs = result.validationResults;
        if (Array.isArray(vrs)) {
            for (const vr of vrs) {
                if (!vr || typeof vr.domain !== 'string')
                    continue;
                const passedCount = Array.isArray(vr.passedRules) ? vr.passedRules.length : 0;
                const failedCount = Array.isArray(vr.failedRules) ? vr.failedRules.length : 0;
                const total = Math.max(1, passedCount + failedCount);
                const passRateContribution = vr.status === 'pass' ? 100
                    : vr.status === 'fail' ? 0
                        : (passedCount / total) * 100;
                const passed = vr.status === 'pass' ? 1 : 0;
                const existing = byDomain.get(vr.domain) || { passSum: 0, count: 0, rulesPassed: 0, rulesTotal: 0 };
                existing.passSum += passRateContribution;
                existing.count += 1;
                existing.rulesPassed += passed;
                existing.rulesTotal += 1;
                byDomain.set(vr.domain, existing);
            }
        }
    }
    const grades = [];
    for (const [domain, agg] of byDomain.entries()) {
        const passRate = agg.passSum / agg.count;
        grades.push({
            domain,
            passRate,
            letter: (0, build_report_types_1.passRateToLetter)(passRate, thresholds),
            rulesPassed: agg.rulesPassed,
            rulesTotal: agg.rulesTotal,
        });
    }
    grades.sort((a, b) => a.domain.localeCompare(b.domain));
    return grades;
}
function buildNextSteps(verdict, findings) {
    const steps = [];
    if (verdict === 'clean') {
        steps.push('No findings - ship clean.');
        steps.push('Optionally run flowL_design_critique for an additional design-review lens.');
        return steps;
    }
    const blockers = findings.filter((f) => f.severity === 'blocking').slice(0, 3);
    const warnings = findings.filter((f) => f.severity === 'warning').slice(0, 2);
    blockers.forEach((b) => {
        steps.push(`Resolve blocker: ${b.rule} - ${b.fix || b.message}`);
    });
    warnings.forEach((w) => {
        steps.push(`Address warning: ${w.rule} - ${w.fix || w.message}`);
    });
    if (verdict === 'warnings-only') {
        steps.push('Re-run flowJ_tactical_polish after fixes to verify.');
    }
    return steps;
}
function generateBuildReport(input, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options, thresholds: options.thresholds || build_report_types_1.DEFAULT_THRESHOLDS };
    let flowResults = [];
    if (input.source === 'flow-results') {
        flowResults = input.flowResults || [];
    }
    else if (input.source === 'memory') {
        flowResults = readFlowResultsFromMemory(input.memoryPaths || []);
    }
    const allFindings = [];
    for (const r of flowResults) {
        allFindings.push(...findingsFromResult(r));
    }
    const severityCounts = { blocking: 0, warning: 0, info: 0 };
    for (const f of allFindings) {
        severityCounts[f.severity]++;
    }
    let visibleFindings = allFindings;
    if (!opts.includeInfo) {
        visibleFindings = visibleFindings.filter((f) => f.severity !== 'info');
    }
    visibleFindings.sort((a, b) => {
        const order = { blocking: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
    });
    if (visibleFindings.length > opts.maxFindings) {
        visibleFindings = visibleFindings.slice(0, opts.maxFindings);
    }
    const domainGrades = domainGradesFromResults(flowResults, opts.thresholds);
    const overall = (0, build_report_types_1.computeOverallGrade)(domainGrades, opts.thresholds);
    const verdict = (0, build_report_types_1.computeVerdict)(severityCounts);
    const generatedAt = new Date().toISOString();
    const reportId = `${generatedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).substring(2, 8)}`;
    return {
        reportId,
        generatedAt,
        composite: input.composite,
        flowsExecuted: flowResults.map((r) => String(r.flowId)),
        verdict,
        severityCounts,
        overallGrade: overall.letter,
        overallPassRate: overall.passRate,
        domainGrades,
        findings: visibleFindings,
        nextSteps: buildNextSteps(verdict, allFindings),
    };
}
/**
 * Render a BuildReport as human-readable markdown.
 * Pure function. No I/O.
 */
function renderBuildReportMarkdown(report) {
    const lines = [];
    const title = report.composite
        ? `Build Report - ${report.composite.replace(/^composite_/, '').replace(/_/g, ' ')}`
        : 'Build Report';
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`**Generated:** ${report.generatedAt}`);
    if (report.composite) {
        lines.push(`**Composite:** ${report.composite}`);
    }
    lines.push(`**Flows executed:** ${report.flowsExecuted.join(' -> ')}`);
    lines.push('');
    const verdictLabel = report.verdict.toUpperCase();
    lines.push(`## Verdict: ${verdictLabel}`);
    lines.push('');
    if (report.verdict === 'clean') {
        lines.push('Ship clean. No blocking issues, no warnings.');
    }
    else if (report.verdict === 'warnings-only') {
        lines.push(`Ship after addressing the ${report.severityCounts.warning} warning${report.severityCounts.warning === 1 ? '' : 's'} below. No blocking issues.`);
    }
    else {
        lines.push(`Cannot ship. ${report.severityCounts.blocking} blocking issue${report.severityCounts.blocking === 1 ? '' : 's'} must be resolved first.`);
    }
    lines.push('');
    lines.push('## Severity totals');
    lines.push('');
    lines.push('| Severity | Count |');
    lines.push('|----------|------:|');
    lines.push(`| Blocking | ${report.severityCounts.blocking} |`);
    lines.push(`| Warning  | ${report.severityCounts.warning} |`);
    const infoNote = report.severityCounts.info > 0 ? ` (hidden, pass --include-info to show)` : '';
    lines.push(`| Info     | ${report.severityCounts.info}${infoNote} |`);
    lines.push('');
    lines.push(`## Overall grade: ${report.overallGrade} (${report.overallPassRate.toFixed(1)}%)`);
    lines.push('');
    if (report.domainGrades.length > 0) {
        lines.push('## Per-domain grades');
        lines.push('');
        lines.push('| Domain | Pass rate | Grade | Rules |');
        lines.push('|--------|----------:|:-----:|------:|');
        for (const g of report.domainGrades) {
            lines.push(`| ${g.domain} | ${g.passRate.toFixed(1)}% | ${g.letter} | ${g.rulesPassed}/${g.rulesTotal} |`);
        }
        lines.push('');
    }
    if (report.findings.length === 0) {
        lines.push('## Findings');
        lines.push('');
        lines.push('No findings - ship clean.');
        lines.push('');
    }
    else {
        const blockers = report.findings.filter((f) => f.severity === 'blocking');
        const warnings = report.findings.filter((f) => f.severity === 'warning');
        lines.push(`## Findings (${blockers.length} blocking, ${warnings.length} warning)`);
        lines.push('');
        blockers.forEach((f, i) => {
            lines.push(`### Blocker ${i + 1}: ${f.rule}`);
            lines.push(`- **Source:** ${f.source}`);
            lines.push(`- **Flow:** ${f.flowId}`);
            lines.push(`- **Message:** ${f.message}`);
            if (f.fix) {
                lines.push(`- **Fix:** ${f.fix}`);
            }
            lines.push('');
        });
        warnings.forEach((f, i) => {
            lines.push(`### Warning ${i + 1}: ${f.rule}`);
            lines.push(`- **Source:** ${f.source}`);
            lines.push(`- **Flow:** ${f.flowId}`);
            lines.push(`- **Message:** ${f.message}`);
            if (f.fix) {
                lines.push(`- **Fix:** ${f.fix}`);
            }
            lines.push('');
        });
    }
    lines.push('## Next steps');
    lines.push('');
    report.nextSteps.forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`);
    });
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=build-report-aggregator.js.map