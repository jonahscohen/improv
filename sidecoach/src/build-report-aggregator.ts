// Build Report aggregator.
// Walks FlowExecutionResult[] memory data and produces a BuildReport struct + markdown.
// Scope (Phase 5): consumes structured validation data from FlowMemoryEntry
// (.validationResults, .metrics, .gates). Out of scope: unstructured guidance-line
// findings from ClaudemdMandate / PolishStandard / Taste validators.

import * as fs from 'fs';
import { FlowExecutionResult } from './flow-handler';
import { FlowMemoryEntry } from './flow-memory-schema';
import {
  BuildReport,
  SeverityCounts,
  DomainGrade,
  FindingEntry,
  GradingThresholds,
  DEFAULT_THRESHOLDS,
  passRateToLetter,
  computeOverallGrade,
  computeVerdict,
} from './build-report-types';

export interface AggregatorInput {
  source: 'flow-results' | 'memory';
  flowResults?: FlowExecutionResult[];
  memoryPaths?: string[];
  composite?: string;
}

export interface AggregatorOptions {
  includeInfo?: boolean;
  maxFindings?: number;
  thresholds?: GradingThresholds;
}

const DEFAULT_OPTIONS: Required<Omit<AggregatorOptions, 'thresholds'>> & { thresholds: GradingThresholds } = {
  includeInfo: false,
  maxFindings: 50,
  thresholds: DEFAULT_THRESHOLDS,
};

function statusToSeverity(status: 'pass' | 'warning' | 'fail'): 'blocking' | 'warning' | 'info' | null {
  if (status === 'fail') return 'blocking';
  if (status === 'warning') return 'warning';
  return null;
}

function findingsFromResult(result: FlowExecutionResult): FindingEntry[] {
  const findings: FindingEntry[] = [];
  const memory = result.memory as FlowMemoryEntry | undefined;
  if (!memory) return findings;

  for (const v of memory.validationResults || []) {
    const sev = statusToSeverity(v.result);
    if (!sev) continue;
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
    if (!sev) continue;
    findings.push({
      severity: sev,
      source: result.flowId,
      flowId: result.flowId,
      rule: m.name,
      message: `${m.name} = ${m.value}${m.target !== undefined ? ` (target ${m.target})` : ''}`,
    });
  }

  for (const g of memory.gates || []) {
    if (g.passed) continue;
    findings.push({
      severity: g.required ? 'blocking' : 'warning',
      source: result.flowId,
      flowId: result.flowId,
      rule: `gate:${g.name}`,
      message: g.error || `Gate "${g.name}" not passed`,
    });
  }

  return findings;
}

function domainGradesFromResults(
  results: FlowExecutionResult[],
  thresholds: GradingThresholds
): DomainGrade[] {
  const byDomain = new Map<string, { passSum: number; count: number; rulesPassed: number; rulesTotal: number }>();

  for (const result of results) {
    const memory = result.memory as FlowMemoryEntry | undefined;
    if (!memory) continue;
    for (const m of memory.metrics || []) {
      const dotIdx = String(m.name).indexOf('.');
      if (dotIdx < 0) continue;
      const domain = String(m.name).substring(0, dotIdx);
      const value = typeof m.value === 'number' ? m.value : Number(m.value);
      if (!Number.isFinite(value)) continue;
      const passed = m.status === 'pass' ? 1 : 0;
      const existing = byDomain.get(domain) || { passSum: 0, count: 0, rulesPassed: 0, rulesTotal: 0 };
      existing.passSum += value;
      existing.count += 1;
      existing.rulesPassed += passed;
      existing.rulesTotal += 1;
      byDomain.set(domain, existing);
    }
  }

  const grades: DomainGrade[] = [];
  for (const [domain, agg] of byDomain.entries()) {
    const passRate = agg.passSum / agg.count;
    grades.push({
      domain,
      passRate,
      letter: passRateToLetter(passRate, thresholds),
      rulesPassed: agg.rulesPassed,
      rulesTotal: agg.rulesTotal,
    });
  }
  grades.sort((a, b) => a.domain.localeCompare(b.domain));
  return grades;
}

function buildNextSteps(verdict: 'clean' | 'warnings-only' | 'blocked', findings: FindingEntry[]): string[] {
  const steps: string[] = [];
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

export function generateBuildReport(
  input: AggregatorInput,
  options: AggregatorOptions = {}
): BuildReport {
  const opts = { ...DEFAULT_OPTIONS, ...options, thresholds: options.thresholds || DEFAULT_THRESHOLDS };

  let flowResults: FlowExecutionResult[] = [];
  if (input.source === 'flow-results') {
    flowResults = input.flowResults || [];
  } else if (input.source === 'memory') {
    throw new Error('memory-input mode not yet implemented (Sprint 4 T7)');
  }

  const allFindings: FindingEntry[] = [];
  for (const r of flowResults) {
    allFindings.push(...findingsFromResult(r));
  }

  const severityCounts: SeverityCounts = { blocking: 0, warning: 0, info: 0 };
  for (const f of allFindings) {
    severityCounts[f.severity]++;
  }

  let visibleFindings = allFindings;
  if (!opts.includeInfo) {
    visibleFindings = visibleFindings.filter((f) => f.severity !== 'info');
  }
  visibleFindings.sort((a, b) => {
    const order: Record<string, number> = { blocking: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
  if (visibleFindings.length > opts.maxFindings) {
    visibleFindings = visibleFindings.slice(0, opts.maxFindings);
  }

  const domainGrades = domainGradesFromResults(flowResults, opts.thresholds);
  const overall = computeOverallGrade(domainGrades, opts.thresholds);
  const verdict = computeVerdict(severityCounts);

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
export function renderBuildReportMarkdown(report: BuildReport): string {
  const lines: string[] = [];

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
  } else if (report.verdict === 'warnings-only') {
    lines.push(`Ship after addressing the ${report.severityCounts.warning} warning${report.severityCounts.warning === 1 ? '' : 's'} below. No blocking issues.`);
  } else {
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
  } else {
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
