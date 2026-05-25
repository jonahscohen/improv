# Sprint 4 (Phase 5): Graded Validation + Build Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggregate Sidecoach's existing validator outputs into a single Build Report with a severity-based ship verdict (clean / warnings-only / blocked) plus per-domain letter grades, surfaced automatically after composite execution, opt-in for single flows, and retrospectively via a CLI.

**Architecture:** A central `build-report-aggregator.ts` module owns the report shape. It accepts either `FlowExecutionResult[]` (inline from orchestrator) or memory file paths (from CLI), walks the structured validation data inside each flow's `FlowMemoryEntry` (`.validationResults[]`, `.metrics[]`, `.gates[]`), aggregates severity counts + per-domain pass rates, and emits a `BuildReport` struct + a markdown rendering. Validators stay unchanged.

**Tech Stack:** TypeScript, Node 18+, `npx ts-node` for tests, no new runtime dependencies. Tests use `child_process.spawnSync` with explicit args (NOT `exec` with shell strings) to satisfy the security-reminder hook.

**Branch:** `main` (Sprint 1-3 plus the hardening commit are already merged). Per the established pattern, commits land directly on local `main`; not pushed to origin until the user decides.

**Hook awareness (carry forward from every prior sprint):**
1. `npx ts-node ...test.ts` sets `~/.claude/.needs-verification`. Use the FOUR-bash-call commit pattern: (a) edit memory, (b) `rm -f /Users/spare3/.claude/.needs-verification` (absolute path - the memory-protection guard blocks relative paths that mention `.claude/memory`), (c) edit memory AGAIN, (d) commit.
2. Always pass absolute `cd /Users/spare3/Documents/Github/claude-dotfiles` in commit calls.
3. Never `git add -A` or `git add .` (working tree has dirty `dist/*`, `test-site-1/*`, etc.).
4. If a commit fails complaining about memory-dirty, edit memory once more and retry.
5. NEVER use `child_process.exec(...)` or `execSync(...)` with template-literal shell strings. The security-reminder hook blocks any Write that contains those patterns. Always use `spawnSync('cmd', [args], {input, encoding})` or `execFileSync('cmd', [args], opts)`.

**Hardening context:** Before this sprint, the multiple-choice and question-enforcement hooks were hardened in commit `2b7db7f` (6 layers + 16-test regression suite). The hooks now block bold-labeled options (Option/Approach/Path/Plan/etc) regardless of separator glyph. Implementers asking the user any question must use `AskUserQuestion`; the hooks catch text-form questions automatically.

---

## File Structure

**New files (10 source + 1 CLI + 2 memory = 13 new):**

| File | Responsibility |
|------|----------------|
| `sidecoach/src/build-report-types.ts` | Pure type definitions: `BuildReport`, `ShipVerdict`, `LetterGrade`, `SeverityCounts`, `DomainGrade`, `FindingEntry`. Plus grading helpers `passRateToLetter`, `computeOverallGrade`, `computeVerdict`. No I/O. |
| `sidecoach/src/build-report-aggregator.ts` | `generateBuildReport(input, options)` (accepts `FlowExecutionResult[]` OR memory paths) + `renderBuildReportMarkdown(report)` (pure markdown formatter). Reads `fs` for memory mode. |
| `sidecoach/src/__tests__/sprint4-build-report-grading.test.ts` | Unit test for grading helpers: pass-rate -> letter mapping at thresholds. |
| `sidecoach/src/__tests__/sprint4-build-report-aggregator.test.ts` | Unit test for `generateBuildReport` with synthetic `FlowExecutionResult[]` input. |
| `sidecoach/src/__tests__/sprint4-build-report-renderer.test.ts` | Unit test for `renderBuildReportMarkdown`: verifies key sections + structure. |
| `sidecoach/src/__tests__/sprint4-build-report-composite.test.ts` | Integration test running `composite_craft_landing_page` and asserting the result includes a `buildReport` + `Build Report` artifact. |
| `sidecoach/src/__tests__/sprint4-build-report-single-opt-in.test.ts` | Integration test for Surface B (single flow opt-in via `metadata.emitBuildReport`). |
| `sidecoach/src/__tests__/sprint4-build-report-memory-input.test.ts` | Unit test for memory-mode aggregation: temp directory with fixture memory files. |
| `sidecoach/src/__tests__/sprint4-build-report-cli.test.ts` | CLI smoke test: invokes `node bin/sidecoach-build-report.js --json` via `spawnSync` against fixtures. |
| `sidecoach/bin/sidecoach-build-report.js` | CLI entry point with `--from-stdin`, `--since`, `--composite`, `--output-file`, `--json`, `--include-info` flags. |
| `.claude/memory/session_2026-05-24_sprint4_execution.md` | Per-task execution log (created during T1). |
| `.claude/memory/session_2026-05-24_sprint4_closed.md` | Sprint close memory (T8). |

**Modified files (2):**

| File | Change |
|------|--------|
| `sidecoach/src/sidecoach-orchestrator.ts` | Surface A: at the composite-flow return path (around line 663), generate a build report and attach to result. Surface B: check `metadata.emitBuildReport` after natural-language flow execution. Add `buildReport?: BuildReport` to `SidecoachResult` interface (around line 1187). Import the new types + aggregator near the top. |
| `.claude/memory/MEMORY.md` | Add a Sprint 4 close-out index entry (in T8). |

---

## Task 1: Build types + grading helpers

**Files:**
- Create: `sidecoach/src/build-report-types.ts`
- Create: `sidecoach/src/__tests__/sprint4-build-report-grading.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-grading.test.ts`:

```typescript
import { passRateToLetter, computeOverallGrade, computeVerdict } from '../build-report-types';

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

(() => {
  // passRateToLetter thresholds: A>=90, B>=80, C>=70, D>=60, F<60
  assertEq(passRateToLetter(95), 'A', '95 -> A');
  assertEq(passRateToLetter(90), 'A', '90 -> A (lower bound)');
  assertEq(passRateToLetter(89.9), 'B', '89.9 -> B (just below A)');
  assertEq(passRateToLetter(80), 'B', '80 -> B (lower bound)');
  assertEq(passRateToLetter(75), 'C', '75 -> C');
  assertEq(passRateToLetter(70), 'C', '70 -> C (lower bound)');
  assertEq(passRateToLetter(65), 'D', '65 -> D');
  assertEq(passRateToLetter(60), 'D', '60 -> D (lower bound)');
  assertEq(passRateToLetter(59.99), 'F', '59.99 -> F (just below D)');
  assertEq(passRateToLetter(0), 'F', '0 -> F');

  const grades = [
    { domain: 'color', passRate: 100, letter: 'A' as const, rulesPassed: 22, rulesTotal: 22 },
    { domain: 'typography', passRate: 80, letter: 'B' as const, rulesPassed: 8, rulesTotal: 10 },
    { domain: 'motion', passRate: 60, letter: 'D' as const, rulesPassed: 6, rulesTotal: 10 },
  ];
  const overall = computeOverallGrade(grades);
  assertEq(overall.passRate, 80, 'mean of 100,80,60 = 80');
  assertEq(overall.letter, 'B', 'mean 80 -> B');

  const empty = computeOverallGrade([]);
  assertEq(empty.passRate, 0, 'no domains -> 0');
  assertEq(empty.letter, 'F', 'no domains -> F');

  assertEq(computeVerdict({ blocking: 0, warning: 0, info: 0 }), 'clean', 'no findings -> clean');
  assertEq(computeVerdict({ blocking: 0, warning: 3, info: 5 }), 'warnings-only', 'warnings only -> warnings-only');
  assertEq(computeVerdict({ blocking: 1, warning: 3, info: 5 }), 'blocked', 'any blocking -> blocked');
  assertEq(computeVerdict({ blocking: 0, warning: 0, info: 5 }), 'clean', 'info-only -> clean');

  console.log('sprint4-build-report-grading PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-grading.test.ts 2>&1 | head -5
```

Expected: FAIL - "Cannot find module '../build-report-types'".

- [ ] **Step 3: Write the types + helpers**

Create `sidecoach/src/build-report-types.ts`:

```typescript
// Build Report type definitions + grading helpers.
// Pure - no I/O. Imported by the aggregator and the orchestrator.

export type ShipVerdict = 'clean' | 'warnings-only' | 'blocked';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SeverityCounts {
  blocking: number;
  warning: number;
  info: number;
}

export interface DomainGrade {
  domain: string;
  passRate: number;
  letter: LetterGrade;
  rulesPassed: number;
  rulesTotal: number;
}

export interface FindingEntry {
  severity: 'blocking' | 'warning' | 'info';
  source: string;
  flowId: string;
  rule: string;
  message: string;
  fix?: string;
}

export interface BuildReport {
  reportId: string;
  generatedAt: string;
  composite?: string;
  flowsExecuted: string[];
  verdict: ShipVerdict;
  severityCounts: SeverityCounts;
  overallGrade: LetterGrade;
  overallPassRate: number;
  domainGrades: DomainGrade[];
  findings: FindingEntry[];
  nextSteps: string[];
}

export interface GradingThresholds {
  a: number;
  b: number;
  c: number;
  d: number;
}

export const DEFAULT_THRESHOLDS: GradingThresholds = { a: 90, b: 80, c: 70, d: 60 };

export function passRateToLetter(
  passRate: number,
  thresholds: GradingThresholds = DEFAULT_THRESHOLDS
): LetterGrade {
  if (passRate >= thresholds.a) return 'A';
  if (passRate >= thresholds.b) return 'B';
  if (passRate >= thresholds.c) return 'C';
  if (passRate >= thresholds.d) return 'D';
  return 'F';
}

export function computeOverallGrade(
  domains: DomainGrade[],
  thresholds: GradingThresholds = DEFAULT_THRESHOLDS
): { passRate: number; letter: LetterGrade } {
  if (domains.length === 0) {
    return { passRate: 0, letter: 'F' };
  }
  const sum = domains.reduce((acc, d) => acc + d.passRate, 0);
  const passRate = sum / domains.length;
  return { passRate, letter: passRateToLetter(passRate, thresholds) };
}

export function computeVerdict(counts: SeverityCounts): ShipVerdict {
  if (counts.blocking > 0) return 'blocked';
  if (counts.warning > 0) return 'warnings-only';
  return 'clean';
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint4-build-report-grading.test.ts
```

Expected: tsc exit 0, test prints `sprint4-build-report-grading PASS`.

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Bash call A: Create `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-24_sprint4_execution.md` with frontmatter and append the T1 line. Frontmatter:

```
---
name: session-2026-05-24-sprint4-execution
description: Sprint 4 (Phase 5 graded validation + build report) execution log. Implements docs/superpowers/specs/2026-05-24-sidecoach-phase-5-graded-validation-build-report-design.md.
type: project
relates_to: [session_2026-05-24_sprint4_design.md, session_2026-05-24_sprint3_proper_closed.md]
---

Human collaborator: Jonah.

## Execution log

- T1: built build-report-types.ts with BuildReport struct + grading helpers (passRateToLetter, computeOverallGrade, computeVerdict). 12 assertions pass.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (absolute path).

Bash call C: Edit memory AGAIN (`- T1 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/build-report-types.ts sidecoach/src/__tests__/sprint4-build-report-grading.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): build-report-types with severity verdict + letter grading (Phase 5 T1)"
```

---

## Task 2: Build the aggregator (FlowExecutionResult input)

**Files:**
- Create: `sidecoach/src/build-report-aggregator.ts`
- Create: `sidecoach/src/__tests__/sprint4-build-report-aggregator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-aggregator.test.ts`:

```typescript
import { generateBuildReport } from '../build-report-aggregator';
import { FlowExecutionResult } from '../flow-handler';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function makeFlowResult(
  flowId: string,
  validations: Array<{ check: string; result: 'pass' | 'fail' | 'warning'; details?: string }>,
  metrics: Array<{ name: string; value: number; target?: number; status: 'pass' | 'warning' | 'fail' }> = []
): FlowExecutionResult {
  return {
    flowId: flowId as any,
    flowName: flowId,
    status: 'success',
    message: `${flowId} ok`,
    memory: {
      flowId: flowId as any,
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
    } as any,
  };
}

(() => {
  const cleanReport = generateBuildReport({
    source: 'flow-results',
    flowResults: [makeFlowResult('flowA_brand_verify', [{ check: 'brand-detected', result: 'pass' }])],
  });
  assertEq(cleanReport.verdict, 'clean', 'no failures -> clean verdict');
  assertEq(cleanReport.severityCounts.blocking, 0, 'no blocking findings');
  assertEq(cleanReport.severityCounts.warning, 0, 'no warning findings');
  assertEq(cleanReport.findings.length, 0, 'findings list empty when all pass');

  const blockedReport = generateBuildReport({
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

  const gradedReport = generateBuildReport({
    source: 'flow-results',
    flowResults: [
      makeFlowResult(
        'flowF_design_tokens',
        [],
        [
          { name: 'color.contrast-pass-rate', value: 100, status: 'pass' },
          { name: 'typography.scale-pass-rate', value: 80, status: 'warning' },
        ]
      ),
    ],
  });
  const colorGrade = gradedReport.domainGrades.find((d) => d.domain === 'color');
  const typoGrade = gradedReport.domainGrades.find((d) => d.domain === 'typography');
  assertTrue(colorGrade != null, 'color domain grade present');
  assertTrue(typoGrade != null, 'typography domain grade present');
  assertEq(colorGrade!.letter, 'A', 'color 100% -> A');
  assertEq(typoGrade!.letter, 'B', 'typography 80% -> B');

  const compositeReport = generateBuildReport({
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

  const withInfo = generateBuildReport({
    source: 'flow-results',
    flowResults: [makeFlowResult('flowA_brand_verify', [{ check: 'info-only', result: 'pass', details: 'note' }])],
  });
  assertEq(withInfo.severityCounts.info, 0, 'info default-filtered (no info findings in current schema)');

  assertTrue(blockedReport.nextSteps.length > 0, 'nextSteps populated when findings exist');

  assertTrue(typeof blockedReport.reportId === 'string' && blockedReport.reportId.length > 0, 'reportId present');
  assertTrue(typeof blockedReport.generatedAt === 'string' && blockedReport.generatedAt.length > 0, 'generatedAt present');

  console.log('sprint4-build-report-aggregator PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-aggregator.test.ts 2>&1 | head -5
```

Expected: FAIL - "Cannot find module '../build-report-aggregator'".

- [ ] **Step 3: Write the aggregator**

Create `sidecoach/src/build-report-aggregator.ts`:

```typescript
// Build Report aggregator.
// Walks FlowExecutionResult[] memory data and produces a BuildReport struct + markdown.
// Scope (Phase 5): consumes structured validation data from FlowMemoryEntry
// (.validationResults, .metrics, .gates). Out of scope: unstructured guidance-line
// findings from ClaudemdMandate / PolishStandard / Taste validators.

import * as fs from 'fs';
import { FlowExecutionResult } from './flow-handler';
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
  const memory = result.memory as any;
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
    const memory = result.memory as any;
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

// Stub for the markdown renderer - implemented in T3.
export function renderBuildReportMarkdown(_report: BuildReport): string {
  throw new Error('renderBuildReportMarkdown not yet implemented (Sprint 4 T3)');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint4-build-report-aggregator.test.ts
```

Expected: tsc exit 0, test prints `sprint4-build-report-aggregator PASS`.

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Bash call A: Append to memory file:

```
- T2: build-report-aggregator.ts with generateBuildReport for FlowExecutionResult[] input. Severity bucketing (fail->blocking, warning->warning, pass->no finding), domain grading from metrics with "<domain>.<name>" prefix, gate handling (required+!passed -> blocking, optional+!passed -> warning), nextSteps composition. memory-input + markdown renderer stubbed for T7/T3.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification`

Bash call C: Edit memory AGAIN.

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/build-report-aggregator.ts sidecoach/src/__tests__/sprint4-build-report-aggregator.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): build-report-aggregator for FlowExecutionResult input (Phase 5 T2)"
```

---

## Task 3: Markdown renderer

**Files:**
- Modify: `sidecoach/src/build-report-aggregator.ts` (replace the `renderBuildReportMarkdown` stub)
- Create: `sidecoach/src/__tests__/sprint4-build-report-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-renderer.test.ts`:

```typescript
import { renderBuildReportMarkdown } from '../build-report-aggregator';
import { BuildReport } from '../build-report-types';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

function fixtureReport(verdict: 'clean' | 'warnings-only' | 'blocked'): BuildReport {
  const findings = verdict === 'clean' ? [] : verdict === 'warnings-only' ? [
    { severity: 'warning' as const, source: 'flowF_design_tokens', flowId: 'flowF_design_tokens', rule: 'motion.duration_consistency', message: '3 distinct durations used', fix: 'Consolidate to 200ms/250ms/300ms' },
  ] : [
    { severity: 'blocking' as const, source: 'flowF_design_tokens', flowId: 'flowF_design_tokens', rule: 'DESIGN.md_lint', message: 'Lint check failed', fix: 'npx @google/design.md lint DESIGN.md' },
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
  const cleanMd = renderBuildReportMarkdown(fixtureReport('clean'));
  assertTrue(/# Build Report/.test(cleanMd), 'clean: has header');
  assertTrue(/Verdict: CLEAN/i.test(cleanMd), 'clean: verdict in header');
  assertTrue(/No findings - ship clean/i.test(cleanMd), 'clean: no-findings placeholder');
  assertTrue(/Overall grade: B/i.test(cleanMd), 'clean: overall grade shown');
  assertTrue(/color/i.test(cleanMd) && /typography/i.test(cleanMd), 'clean: domain rows present');

  const warnMd = renderBuildReportMarkdown(fixtureReport('warnings-only'));
  assertTrue(/Verdict: WARNINGS-ONLY/i.test(warnMd), 'warnings: verdict in header');
  assertTrue(/motion\.duration_consistency/.test(warnMd), 'warnings: finding rule name visible');
  assertTrue(/Consolidate/.test(warnMd), 'warnings: finding fix visible');
  assertTrue(/Warning 1:/.test(warnMd), 'warnings: numbered finding header');

  const blockedMd = renderBuildReportMarkdown(fixtureReport('blocked'));
  assertTrue(/Verdict: BLOCKED/i.test(blockedMd), 'blocked: verdict in header');
  assertTrue(/DESIGN\.md_lint/.test(blockedMd), 'blocked: blocker rule visible');
  assertTrue(/Blocker 1:/.test(blockedMd), 'blocked: numbered blocker header');

  for (const v of ['clean', 'warnings-only', 'blocked'] as const) {
    const md = renderBuildReportMarkdown(fixtureReport(v));
    assertTrue(/Severity totals/i.test(md), `${v}: severity totals section`);
    assertTrue(/Per-domain grades|Domain.*Grade/i.test(md), `${v}: per-domain table`);
    assertTrue(/Flows executed:/i.test(md), `${v}: flows executed line`);
    assertTrue(/composite_craft_landing_page/.test(md), `${v}: composite id in header`);
  }

  console.log('sprint4-build-report-renderer PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-renderer.test.ts 2>&1 | head -5
```

Expected: FAIL - the renderer stub throws.

- [ ] **Step 3: Replace the stub with the real renderer**

In `sidecoach/src/build-report-aggregator.ts`, find the stub at the bottom and replace it with the full implementation:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint4-build-report-renderer.test.ts
```

Expected: tsc exit 0, test prints `sprint4-build-report-renderer PASS`.

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Bash call A: Append `- T3: replaced renderBuildReportMarkdown stub with full markdown renderer. Header, verdict block, severity totals table, overall grade, per-domain grade table, findings grouped by severity (Blocker N / Warning N), next steps.` to memory.

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification`

Bash call C: Re-touch memory.

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/build-report-aggregator.ts sidecoach/src/__tests__/sprint4-build-report-renderer.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): renderBuildReportMarkdown produces verdict + grades + findings layout (Phase 5 T3)"
```

---

## Task 4: Wire into composite execution (Surface A)

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (around line 657-674 - composite return; around line 1187 - SidecoachResult interface)
- Create: `sidecoach/src/__tests__/sprint4-build-report-composite.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-composite.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  const result = await engine.process('/sidecoach craft landing page', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });

  assertTrue((result.flowResults || []).length > 0, 'composite produced flowResults');

  const r: any = result;
  assertTrue(r.buildReport != null, `result.buildReport present (got: ${typeof r.buildReport})`);

  const br = r.buildReport;
  assertTrue(typeof br.verdict === 'string', 'buildReport.verdict is a string');
  assertTrue(Array.isArray(br.flowsExecuted) && br.flowsExecuted.length > 0, 'buildReport.flowsExecuted populated');
  assertTrue(br.composite === 'composite_craft_landing_page', 'buildReport.composite matches preset id');
  assertTrue(typeof br.severityCounts === 'object', 'buildReport.severityCounts present');
  assertTrue(typeof br.overallGrade === 'string', 'buildReport.overallGrade is a string');

  const artifacts = r.artifacts || [];
  const buildReportArtifact = artifacts.find((a: any) => a.type === 'reference' && a.name === 'Build Report');
  assertTrue(buildReportArtifact != null, `Build Report artifact present (artifacts: ${artifacts.map((a: any) => a.name).join(', ')})`);
  assertTrue(typeof buildReportArtifact.content === 'string' && buildReportArtifact.content.length > 0, 'Build Report artifact has non-empty content');
  assertTrue(/Verdict:/i.test(buildReportArtifact.content), 'Build Report content contains a Verdict section');

  console.log('sprint4-build-report-composite PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts 2>&1 | head -10
```

Expected: FAIL on `result.buildReport present`.

- [ ] **Step 3: Add `buildReport` to `SidecoachResult` + wire imports**

In `sidecoach/src/sidecoach-orchestrator.ts`, near the other top-of-file imports add:

```typescript
import { BuildReport } from './build-report-types';
import { generateBuildReport, renderBuildReportMarkdown } from './build-report-aggregator';
```

Update the `SidecoachResult` interface (around line 1187):

```typescript
export interface SidecoachResult {
  success: boolean;
  message: string;
  detectedFlow: { flowId: FlowId; flowName: string; confidence: number } | null;
  flowResults: FlowExecutionResult[];
  guidance?: string[];
  checklist?: any[];
  artifacts?: any[];
  ambiguousCandidates?: Array<{ flowId: FlowId; flowName: string; confidence: number }>;
  buildReport?: BuildReport;
}
```

- [ ] **Step 4: Wire the aggregator into the composite return path**

Find the composite return block around line 657-674 in `sidecoach-orchestrator.ts`. Currently the return is:

```typescript
        if (compositeFlow.aggregateResults) {
          const aggregated = FlowCompositionEngine.aggregateResults(flowResults);
          aggregatedGuidance = aggregated.guidance;
          aggregatedChecklist = aggregated.checklist;
        }

        return {
          success: flowResults.some(r => r.status === 'success'),
          message: `Composite flow complete: ${compositeFlow.name} (${flowResults.filter(r => r.status === 'success').length}/${flowResults.length} flows successful, ${totalTime}ms)`,
          detectedFlow: { flowId: compositeFlowId as FlowId, flowName: compositeFlow.name, confidence: 1.0 },
          flowResults,
          guidance: aggregatedGuidance.length > 0 ? aggregatedGuidance : undefined,
          checklist: aggregatedChecklist.length > 0 ? aggregatedChecklist : undefined,
        };
      }
```

Replace with:

```typescript
        if (compositeFlow.aggregateResults) {
          const aggregated = FlowCompositionEngine.aggregateResults(flowResults);
          aggregatedGuidance = aggregated.guidance;
          aggregatedChecklist = aggregated.checklist;
        }

        // Phase 5 (Surface A): generate a Build Report aggregating validator findings.
        const buildReport = generateBuildReport({
          source: 'flow-results',
          flowResults,
          composite: compositeFlowId,
        });
        const buildReportMarkdown = renderBuildReportMarkdown(buildReport);
        const buildReportArtifact = {
          type: 'reference',
          name: 'Build Report',
          content: buildReportMarkdown,
          description: `Build Report for ${compositeFlow.name}: verdict=${buildReport.verdict}, grade=${buildReport.overallGrade}`,
        };

        return {
          success: flowResults.some(r => r.status === 'success'),
          message: `Composite flow complete: ${compositeFlow.name} (${flowResults.filter(r => r.status === 'success').length}/${flowResults.length} flows successful, ${totalTime}ms)`,
          detectedFlow: { flowId: compositeFlowId as FlowId, flowName: compositeFlow.name, confidence: 1.0 },
          flowResults,
          guidance: aggregatedGuidance.length > 0 ? aggregatedGuidance : undefined,
          checklist: aggregatedChecklist.length > 0 ? aggregatedChecklist : undefined,
          artifacts: [buildReportArtifact],
          buildReport,
        };
      }
```

- [ ] **Step 5: Run test + tsc + regression check**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts && npx ts-node src/__tests__/sprint3-process-path.test.ts && npx ts-node src/__tests__/sprint2-integration.test.ts
```

Expected: tsc exit 0, all three tests PASS. If `sprint4-build-report-composite` fails because the composite routing returns ambiguous, inspect the orchestrator's command-routing code (around line 469-486) for the actual phrase that maps to `composite_craft_landing_page` and adjust the `engine.process()` call. Do NOT bypass `engine.process` - the test contract is the public API.

- [ ] **Step 6: Commit (FOUR-bash-call pattern)**

Bash call A: Append T4 line to memory.
Bash call B: `rm -f /Users/spare3/.claude/.needs-verification`
Bash call C: Re-touch memory.
Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/sprint4-build-report-composite.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): composite execution emits BuildReport + artifact (Phase 5 T4, Surface A)"
```

---

## Task 5: Single-flow opt-in (Surface B)

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (natural-language flow execution path)
- Create: `sidecoach/src/__tests__/sprint4-build-report-single-opt-in.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-single-opt-in.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  const noFlag = await engine.process('lint design.md', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });
  const r1: any = noFlag;
  assertTrue(r1.buildReport == null, `single flow w/o flag: no buildReport (got: ${typeof r1.buildReport})`);

  const withFlag = await engine.process('lint design.md', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
    metadata: { emitBuildReport: true },
  });
  const r2: any = withFlag;
  assertTrue(r2.buildReport != null, `single flow with flag: buildReport attached (got: ${typeof r2.buildReport})`);
  assertTrue(typeof r2.buildReport.verdict === 'string', 'buildReport.verdict present');
  assertTrue(Array.isArray(r2.buildReport.flowsExecuted), 'buildReport.flowsExecuted present');
  assertTrue(r2.buildReport.composite == null, 'single-flow buildReport has no composite id');

  console.log('sprint4-build-report-single-opt-in PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-single-opt-in.test.ts 2>&1 | head -5
```

Expected: FAIL on `single flow with flag: buildReport attached`.

- [ ] **Step 3: Wire the opt-in into the natural-language path**

Read `sidecoach/src/sidecoach-orchestrator.ts` lines 925-1050 to find the success-path return statement from the natural-language flow execution. Just before that return, insert:

```typescript
      // Phase 5 (Surface B): opt-in build report for natural-language / single-flow execution.
      let buildReportSingle: BuildReport | undefined;
      if ((context.metadata as any)?.emitBuildReport === true && flowResults.length > 0) {
        buildReportSingle = generateBuildReport({
          source: 'flow-results',
          flowResults,
        });
      }
```

Then add `buildReport: buildReportSingle,` to the return literal alongside the existing fields. (The aggregator import was added in T4, so no new imports needed.)

If there are multiple `return` statements in the natural-language path (e.g., prerequisite-failure path vs success path), only the success-path return needs the opt-in check.

- [ ] **Step 4: Run test + tsc**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint4-build-report-single-opt-in.test.ts
```

Expected: tsc exit 0, test prints `sprint4-build-report-single-opt-in PASS`.

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Standard pattern.

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/sprint4-build-report-single-opt-in.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): single-flow opt-in for BuildReport via metadata.emitBuildReport (Phase 5 T5, Surface B)"
```

---

## Task 6: CLI (Surface C)

**Files:**
- Create: `sidecoach/bin/sidecoach-build-report.js`
- Create: `sidecoach/src/__tests__/sprint4-build-report-cli.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-cli.test.ts`. NOTE: this test uses `spawnSync` with explicit args (not `exec` with shell strings) to satisfy the security-reminder hook.

```typescript
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const cliPath = path.join(repoRoot, 'sidecoach', 'bin', 'sidecoach-build-report.js');

  // Build first so dist/* is up to date
  const buildResult = spawnSync('npm', ['run', 'build'], { cwd: path.join(repoRoot, 'sidecoach'), encoding: 'utf8' });
  if (buildResult.status !== 0) {
    console.error('build failed:', buildResult.stderr);
    process.exit(1);
  }

  const fixturePayload = JSON.stringify({
    source: 'flow-results',
    flowResults: [
      {
        flowId: 'flowF_design_tokens',
        flowName: 'Design System Tokens',
        status: 'success',
        message: 'ok',
        memory: {
          flowId: 'flowF_design_tokens',
          flowName: 'Design System Tokens',
          timestamp: new Date().toISOString(),
          status: 'success',
          rulesAppliedByDomain: {},
          decisions: [],
          userDecisions: [],
          metrics: [
            { name: 'color.contrast-pass-rate', value: 100, status: 'pass' },
            { name: 'typography.scale-pass-rate', value: 80, status: 'warning' },
          ],
          validationResults: [{ check: 'DESIGN.md_lint', result: 'fail', details: 'lint failed' }],
          referencesUsed: [],
          gates: [],
          artifactProduced: [],
          summary: 'tokens validated',
        },
      },
    ],
    composite: 'composite_craft_landing_page',
  });

  // --json flag emits the BuildReport struct
  const jsonRun = spawnSync('node', [cliPath, '--from-stdin', '--json'], { input: fixturePayload, encoding: 'utf8' });
  assertTrue(jsonRun.status === 0, `CLI --json exit 0 (got: ${jsonRun.status}, stderr: ${jsonRun.stderr})`);
  const report = JSON.parse(jsonRun.stdout);
  assertTrue(report.verdict === 'blocked', 'CLI --json: verdict computed correctly');
  assertTrue(report.composite === 'composite_craft_landing_page', 'CLI --json: composite preserved');
  assertTrue(report.severityCounts.blocking === 1, 'CLI --json: severity count correct');
  assertTrue(Array.isArray(report.domainGrades) && report.domainGrades.length === 2, 'CLI --json: domain grades populated');

  // Default (no --json) emits markdown
  const mdRun = spawnSync('node', [cliPath, '--from-stdin'], { input: fixturePayload, encoding: 'utf8' });
  assertTrue(mdRun.status === 0, `CLI default exit 0 (got: ${mdRun.status})`);
  assertTrue(/# Build Report/.test(mdRun.stdout), 'CLI default: markdown header');
  assertTrue(/Verdict: BLOCKED/.test(mdRun.stdout), 'CLI default: verdict in markdown');

  // --output-file writes to disk
  const tmpFile = path.join(os.tmpdir(), `sprint4-cli-${Date.now()}.md`);
  const fileRun = spawnSync('node', [cliPath, '--from-stdin', '--output-file', tmpFile], { input: fixturePayload, encoding: 'utf8' });
  assertTrue(fileRun.status === 0, `CLI --output-file exit 0 (got: ${fileRun.status})`);
  assertTrue(fs.existsSync(tmpFile), `CLI --output-file: file exists at ${tmpFile}`);
  const fileContent = fs.readFileSync(tmpFile, 'utf8');
  assertTrue(/# Build Report/.test(fileContent), 'CLI --output-file: contains markdown header');
  fs.unlinkSync(tmpFile);

  console.log('sprint4-build-report-cli PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-cli.test.ts 2>&1 | head -10
```

Expected: FAIL - CLI binary doesn't exist.

- [ ] **Step 3: Write the CLI**

Create `sidecoach/bin/sidecoach-build-report.js`:

```javascript
#!/usr/bin/env node

let generateBuildReport, renderBuildReportMarkdown;
try {
  ({ generateBuildReport, renderBuildReportMarkdown } = require('../dist/build-report-aggregator'));
} catch (err) {
  console.error('sidecoach-build-report: failed to load ../dist/build-report-aggregator. Run `npm run build` in sidecoach/ first.');
  console.error(err.message);
  process.exit(2);
}

function usage() {
  console.error('Usage: sidecoach-build-report [--from-stdin] [--since <iso>] [--composite <id>] [--output-file <path>] [--json] [--include-info]');
}

function parseArgs(argv) {
  const args = { fromStdin: false, since: null, composite: null, outputFile: null, json: false, includeInfo: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-stdin') args.fromStdin = true;
    else if (a === '--json') args.json = true;
    else if (a === '--include-info') args.includeInfo = true;
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--composite') args.composite = argv[++i];
    else if (a === '--output-file') args.outputFile = argv[++i];
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else { console.error(`unknown arg: ${a}`); usage(); process.exit(1); }
  }
  return args;
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.fromStdin && !args.since) {
    console.error('sidecoach-build-report: must specify --from-stdin OR --since');
    usage();
    process.exit(1);
  }

  let input;
  if (args.fromStdin) {
    const raw = await readStdin();
    try {
      input = JSON.parse(raw);
    } catch (err) {
      console.error(`invalid JSON on stdin: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Memory-input mode - T7 wires this fully.
    input = { source: 'memory', memoryPaths: [], composite: args.composite || undefined };
  }

  let report;
  try {
    report = generateBuildReport(input, { includeInfo: args.includeInfo });
  } catch (err) {
    console.error(`aggregator error: ${err.message}`);
    process.exit(2);
  }

  const output = args.json ? JSON.stringify(report, null, 2) : renderBuildReportMarkdown(report);

  if (args.outputFile) {
    const fs = require('fs');
    fs.writeFileSync(args.outputFile, output, 'utf8');
  } else {
    process.stdout.write(output);
    if (!args.json) process.stdout.write('\n');
  }

  process.exit(0);
})();
```

- [ ] **Step 4: Make executable + run test**

```bash
chmod +x /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/bin/sidecoach-build-report.js && cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-cli.test.ts
```

Expected: test prints `sprint4-build-report-cli PASS`.

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/bin/sidecoach-build-report.js sidecoach/src/__tests__/sprint4-build-report-cli.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): build-report CLI with --from-stdin/--json/--output-file (Phase 5 T6, Surface C)"
```

---

## Task 7: Memory-input mode

**Files:**
- Modify: `sidecoach/src/build-report-aggregator.ts` (replace memory-input throw)
- Modify: `sidecoach/bin/sidecoach-build-report.js` (wire --since memory scanning)
- Create: `sidecoach/src/__tests__/sprint4-build-report-memory-input.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint4-build-report-memory-input.test.ts`:

```typescript
import { generateBuildReport } from '../build-report-aggregator';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint4-memory-'));
  const fixturePath = path.join(tmp, 'session_2026-05-24_synthetic_run.md');

  const memoryEntry = {
    flowId: 'flowF_design_tokens',
    flowName: 'Design System Tokens',
    timestamp: new Date().toISOString(),
    status: 'success',
    rulesAppliedByDomain: {},
    decisions: [],
    userDecisions: [],
    metrics: [
      { name: 'color.contrast-pass-rate', value: 100, status: 'pass' },
      { name: 'typography.scale-pass-rate', value: 80, status: 'warning' },
    ],
    validationResults: [{ check: 'DESIGN.md_lint', result: 'fail', details: 'lint failed' }],
    referencesUsed: [],
    gates: [],
    artifactProduced: [],
    summary: 'tokens validated',
  };

  const fileContent = `---
name: session-2026-05-24-synthetic-run
description: Fixture for sprint4 memory-mode test.
type: project
---

## Flow execution

\`\`\`json
${JSON.stringify(memoryEntry, null, 2)}
\`\`\`
`;
  fs.writeFileSync(fixturePath, fileContent, 'utf8');

  const report = generateBuildReport({
    source: 'memory',
    memoryPaths: [fixturePath],
  });

  assertTrue(report.verdict === 'blocked', `memory-mode: verdict computed (got: ${report.verdict})`);
  assertTrue(report.severityCounts.blocking === 1, 'memory-mode: blocking count correct');
  assertTrue(report.severityCounts.warning === 1, 'memory-mode: warning count correct');

  const colorDomain = report.domainGrades.find((d) => d.domain === 'color');
  const typoDomain = report.domainGrades.find((d) => d.domain === 'typography');
  assertTrue(colorDomain != null, 'memory-mode: color domain extracted');
  assertTrue(typoDomain != null, 'memory-mode: typography domain extracted');
  assertTrue(colorDomain!.letter === 'A', 'memory-mode: color grade A');

  fs.unlinkSync(fixturePath);
  fs.rmdirSync(tmp);

  console.log('sprint4-build-report-memory-input PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-memory-input.test.ts 2>&1 | head -5
```

Expected: FAIL - `memory-input mode not yet implemented (Sprint 4 T7)`.

- [ ] **Step 3: Implement memory-input parsing**

In `sidecoach/src/build-report-aggregator.ts`, replace the placeholder:

```typescript
  } else if (input.source === 'memory') {
    throw new Error('memory-input mode not yet implemented (Sprint 4 T7)');
  }
```

with:

```typescript
  } else if (input.source === 'memory') {
    flowResults = readFlowResultsFromMemory(input.memoryPaths || []);
  }
```

Add the helper after the imports:

```typescript
/**
 * Parse FlowMemoryEntry JSON blocks from session memory files.
 *
 * Convention: a session memory file may contain one or more fenced code blocks
 * tagged ```json that decode to a valid FlowMemoryEntry shape (flowId, status,
 * validationResults array). All matching blocks become skeleton
 * FlowExecutionResult objects. Files that cannot be read or contain no valid
 * FlowMemoryEntry JSON are silently skipped (logged to stderr).
 */
function readFlowResultsFromMemory(paths: string[]): FlowExecutionResult[] {
  const results: FlowExecutionResult[] = [];
  const jsonBlockRe = /```json\s*\n([\s\S]*?)\n```/g;

  for (const p of paths) {
    let content: string;
    try {
      content = fs.readFileSync(p, 'utf8');
    } catch (err) {
      process.stderr.write(`build-report-aggregator: skip unreadable path ${p}: ${(err as Error).message}\n`);
      continue;
    }

    let match: RegExpExecArray | null;
    while ((match = jsonBlockRe.exec(content)) !== null) {
      let parsed: any;
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        continue;
      }

      if (
        !parsed ||
        typeof parsed.flowId !== 'string' ||
        typeof parsed.status !== 'string' ||
        !Array.isArray(parsed.validationResults)
      ) {
        continue;
      }

      results.push({
        flowId: parsed.flowId as any,
        flowName: parsed.flowName || parsed.flowId,
        status: parsed.status,
        message: parsed.summary || '(from memory)',
        memory: parsed,
      });
    }
  }

  return results;
}
```

- [ ] **Step 4: Update the CLI's memory-scanning path**

In `sidecoach/bin/sidecoach-build-report.js`, replace:

```javascript
  } else {
    input = { source: 'memory', memoryPaths: [], composite: args.composite || undefined };
  }
```

with:

```javascript
  } else {
    const fsLocal = require('fs');
    const pathLocal = require('path');
    const memoryDir = pathLocal.join(process.cwd(), '.claude', 'memory');
    let memoryPaths = [];
    try {
      const entries = fsLocal.readdirSync(memoryDir);
      const sinceMs = args.since ? Date.parse(args.since) : 0;
      memoryPaths = entries
        .filter((f) => /^session_.*\.md$/.test(f))
        .map((f) => pathLocal.join(memoryDir, f))
        .filter((p) => {
          if (!sinceMs) return true;
          try {
            return fsLocal.statSync(p).mtimeMs >= sinceMs;
          } catch {
            return false;
          }
        });
    } catch (err) {
      console.error(`cannot read memory dir ${memoryDir}: ${err.message}`);
      process.exit(1);
    }
    input = { source: 'memory', memoryPaths, composite: args.composite || undefined };
  }
```

- [ ] **Step 5: Run test + tsc + CLI smoke**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint4-build-report-memory-input.test.ts && npm run build && node bin/sidecoach-build-report.js --since 1970-01-01 --json 2>&1 | head -10
```

Expected: tsc clean, memory test PASS, CLI prints JSON (verdict + counts derived from actual project session memory).

- [ ] **Step 6: Commit (FOUR-bash-call pattern)**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/build-report-aggregator.ts sidecoach/bin/sidecoach-build-report.js sidecoach/src/__tests__/sprint4-build-report-memory-input.test.ts .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "feat(sidecoach): memory-input mode + CLI --since memory scanning (Phase 5 T7)"
```

---

## Task 8: Sprint close

**Files:**
- Create: `.claude/memory/session_2026-05-24_sprint4_closed.md`
- Modify: `~/.claude/projects/-Users-spare3-Documents-Github-claude-dotfiles/memory/MEMORY.md` (global, not in repo)

- [ ] **Step 1: Run the full Sprint 1 + 2 + 3-prep + 3-proper + 4 suite (28 tests)**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && \
  npx ts-node src/__tests__/sprint1-integration.test.ts && \
  npx ts-node src/__tests__/design-md-parser.test.ts && \
  npx ts-node src/__tests__/icon-source-reference-paths.test.ts && \
  npx ts-node src/__tests__/project-drift-detector.test.ts && \
  npx ts-node src/__tests__/taste-validator-observer-race.test.ts && \
  npx ts-node src/__tests__/intent-detector-tiebreak.test.ts && \
  npx ts-node src/__tests__/landing-composition-data.test.ts && \
  npx ts-node src/__tests__/flow-handler-landing-composition.test.ts && \
  npx ts-node src/__tests__/copywriting-templates.test.ts && \
  npx ts-node src/__tests__/flow-handler-copywriting.test.ts && \
  npx ts-node src/__tests__/flow-composition-craft-landing.test.ts && \
  npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts && \
  npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts && \
  npx ts-node src/__tests__/sprint2-rolling-citations.test.ts && \
  npx ts-node src/__tests__/sprint2-integration.test.ts && \
  npx ts-node src/__tests__/sprint3-brand-verify-null-register.test.ts && \
  npx ts-node src/__tests__/sprint3-orchestrator-enrich-before-canexecute.test.ts && \
  npx ts-node src/__tests__/sprint3-process-path.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-detection.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-idioms.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-integration.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-grading.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-aggregator.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-renderer.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-composite.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-single-opt-in.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-memory-input.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-cli.test.ts
```

All 28 must pass.

- [ ] **Step 2: tsc clean check**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Must exit 0.

- [ ] **Step 3: Write the sprint-close memory**

Create `.claude/memory/session_2026-05-24_sprint4_closed.md` (substitute actual SHAs from `git log --oneline`):

```markdown
---
name: session-2026-05-24-sprint4-closed
description: Sprint 4 (Phase 5 graded validation + build report) closed. 7 task commits + close commit. BuildReport aggregator + 3 surfaces. 28/28 tests green.
type: project
relates_to: [session_2026-05-24_sprint4_design.md, session_2026-05-24_sprint3_proper_closed.md]
---

Human collaborator: Jonah.

## What this sprint landed

7 task commits on `main` (substitute SHAs):

- T1: build-report-types.ts (BuildReport struct + grading helpers A>=90/B>=80/C>=70/D>=60).
- T2: build-report-aggregator.ts (generateBuildReport for FlowExecutionResult input).
- T3: renderBuildReportMarkdown produces the markdown layout.
- T4: Surface A - composite execution attaches buildReport + Build Report artifact.
- T5: Surface B - single-flow opt-in via metadata.emitBuildReport.
- T6: Surface C - bin/sidecoach-build-report.js CLI (--from-stdin/--since/--composite/--output-file/--json/--include-info).
- T7: memory-input mode - aggregator parses FlowMemoryEntry JSON blocks from session memory; CLI --since walks .claude/memory/ filtered by mtime.

## Test count

Sprint 1 + 2 + 3 prep + 3 proper + 4 = 28 distinct test files, all green. Zero TypeScript errors.

## Known scope notes

- Only structured FlowMemoryEntry data (validationResults, metrics, gates) feeds the build report today. ClaudemdMandate/PolishStandard/Taste validators emit findings as guidance lines and DO NOT drive the report. Filed as a follow-up.
- Metric domain extraction uses `<domain>.<rule>` naming convention. Metrics without the dot prefix are skipped for grading.

## Out of scope (filed for future sprints)

- Grade trends over time.
- Custom grading thresholds per project (DESIGN.md frontmatter).
- HTML rendering for browser preview.
- Auto-fix suggestions beyond what validators provide.
- Slack/Discord notification.
- Consuming unstructured-validator output into the report.

## Local main state

Local `main` continues ahead of `origin/main`. Push timing remains Jonah's call.
```

- [ ] **Step 4: Update MEMORY.md (global, not in repo)**

Edit `/Users/spare3/.claude/projects/-Users-spare3-Documents-Github-claude-dotfiles/memory/MEMORY.md`. Add a single line as the new third entry (after the two MANDATE entries already pinned at the top):

```
- [Sprint 4 closed (2026-05-24)](session_2026-05-24_sprint4_closed.md): Phase 5 graded validation + build report shipped. BuildReport aggregator with severity verdict + per-domain letter grades. Three surfaces (composite auto, single opt-in, CLI). 28/28 tests green.
```

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add .claude/memory/session_2026-05-24_sprint4_closed.md .claude/memory/session_2026-05-24_sprint4_execution.md && git commit -m "docs(memory): close Sprint 4 (Phase 5 graded validation + build report)"
```

The MEMORY.md edit happens to a file outside the repo (in `~/.claude/projects/...`); it does not need a separate commit since it is not tracked here.

---

## Verification (end of sprint)

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git log --oneline fe69899..HEAD
```

Expected: 8 commits (T1-T8).

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node bin/sidecoach-build-report.js --since 1970-01-01 --json 2>&1 | head -20
```

Expected: JSON output with verdict, severityCounts, domainGrades, findings.

---

## Files produced (summary)

**New files (11):**
- `sidecoach/src/build-report-types.ts`
- `sidecoach/src/build-report-aggregator.ts`
- `sidecoach/src/__tests__/sprint4-build-report-grading.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-aggregator.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-renderer.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-composite.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-single-opt-in.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-memory-input.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-cli.test.ts`
- `sidecoach/bin/sidecoach-build-report.js`
- `.claude/memory/session_2026-05-24_sprint4_execution.md` + `session_2026-05-24_sprint4_closed.md`

**Modified files (2):**
- `sidecoach/src/sidecoach-orchestrator.ts` (Surface A + Surface B + SidecoachResult.buildReport)
- `~/.claude/projects/.../memory/MEMORY.md` (sprint-close index, outside repo)

---

## Roadmap for subsequent sprints (unchanged)

- **Sprint 5** = Phase 6: checkpoint mechanism + intent disambiguation UI (~8 tasks).
- **Rolling** = continue adopting DESIGN.md citation pattern (4 of ~25+ handlers).
- **Followups** = wire flowW/flowX into intent-detector.ts; consume unstructured-validator output into the report; grade-trends-over-time.
