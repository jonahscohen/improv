# Sidecoach Phase 5: Graded Validation + Build Report - Design Spec

**Date:** 2026-05-24
**Project:** Sidecoach (`/Users/spare3/Documents/Github/claude-dotfiles/sidecoach`)
**Sprint:** Sprint 4 (Phase 5 of `~/.claude/plans/misty-jingling-plum.md`)
**Status:** Approved by Jonah; ready for implementation planning.

## Goal

Aggregate the outputs of Sidecoach's existing validator stack (DeterministicValidator, ExtendedDomainValidator, ClaudemdMandateValidator, PolishStandardValidator, TasteValidator, plus per-flow `FlowMemoryBuilder.addValidation` entries) into a single coherent **Build Report** that answers two questions after a flow run:

1. **Can I ship this?** (severity-based verdict: clean / warnings-only / blocked)
2. **How is the quality across design domains?** (letter grades per domain, A through F)

The report surfaces automatically after composite flow execution, is opt-in for single flows, and is available retrospectively via a CLI that reads memory files.

## Why this matters

Today's validators each emit their own findings in their own shape - DeterministicValidator returns `{valid, violations}`, ExtendedDomainValidator returns `{passRateByDomain, ...}`, taste/mandate/polish each emit guidance lines. There is no single place that answers "given everything that just ran, can I ship this?" or "where is quality strongest/weakest across my domains?" Yes&'s actual workflow at the end of a craft-landing-page composite is to manually scan multiple validator outputs and synthesize the answer. The Build Report does that synthesis once, consistently, on every composite run.

## Architecture

```
                        Validators (existing, unchanged)
                                  v
              FlowMemoryBuilder.addValidation()  +  ExtendedDomainValidator.passRateByDomain  +  guidance lines
                                  v
                  FlowExecutionResult[] (composite) or FlowMemoryEntry[] (CLI mode)
                                  v
        generateBuildReport({source, flowResults | memoryPaths}, options)
                                  v
                  +-------------------------------+
                  |          BuildReport          |
                  |  (struct: verdict, grades,    |
                  |   findings, next steps)       |
                  +-------------------------------+
                                  v
                renderBuildReportMarkdown(report) -> string
                                  v
            Three surfaces emit it:
              A. Composite end-of-loop -> result.buildReport + 'reference' artifact
              B. Single flow opt-in (metadata.emitBuildReport: true)
              C. CLI bin/sidecoach-build-report.js (reads memory files)
```

The aggregator is a **central module** (not per-validator contributions, not memory-first). One file owns the report shape; validators stay unchanged. The CLI consumer reads memory anyway, so the aggregator accepts either FlowExecutionResults or memory paths as input.

## Data model

New file `sidecoach/src/build-report-types.ts`:

```typescript
export type ShipVerdict = 'clean' | 'warnings-only' | 'blocked';

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SeverityCounts {
  blocking: number;
  warning: number;
  info: number;
}

export interface DomainGrade {
  domain: string;             // 'color' | 'typography' | 'motion' | 'spatial' |
                              // 'interaction' | 'responsive' | 'writing' |
                              // 'accessibility' | 'performance' | 'data-viz' | 'i18n'
  passRate: number;           // 0 to 100
  letter: LetterGrade;
  rulesPassed: number;
  rulesTotal: number;
}

export interface FindingEntry {
  severity: 'blocking' | 'warning' | 'info';
  source: string;             // 'deterministic' | 'extended-domain' |
                              // 'claudemd-mandate' | 'polish-standard' | 'taste'
                              // | flow id (when sourced from FlowMemoryBuilder)
  flowId: string;             // which flow this finding came from
  rule: string;               // rule identifier (e.g. 'DESIGN.md_exists')
  message: string;
  fix?: string;               // suggested fix if validator provided one
}

export interface BuildReport {
  reportId: string;           // ISO timestamp + short uuid
  generatedAt: string;        // ISO 8601
  composite?: string;         // composite id if this was a composite run
  flowsExecuted: string[];    // ordered list of flow ids that ran
  verdict: ShipVerdict;
  severityCounts: SeverityCounts;
  overallGrade: LetterGrade;
  overallPassRate: number;
  domainGrades: DomainGrade[];
  findings: FindingEntry[];   // sorted by severity (blocking first)
  nextSteps: string[];        // top 3-5 actionable items
}
```

### Grading thresholds

Default `passRateToLetter(rate)`:

- `rate >= 90` -> `A`
- `rate >= 80` -> `B`
- `rate >= 70` -> `C`
- `rate >= 60` -> `D`
- else -> `F`

Overall pass rate = arithmetic mean of domain pass rates (every domain weighted equally - a project with no motion does not penalize the grade because the motion domain only appears if there are motion rules to evaluate).

### Ship verdict logic

```typescript
function computeVerdict(counts: SeverityCounts): ShipVerdict {
  if (counts.blocking > 0) return 'blocked';
  if (counts.warning > 0) return 'warnings-only';
  return 'clean';
}
```

`info`-level findings never affect the verdict. They are filtered from the default report (opt in via `options.includeInfo`).

## Aggregator function

New file `sidecoach/src/build-report-aggregator.ts`:

```typescript
import { FlowExecutionResult } from './flow-handler';
import { BuildReport, ShipVerdict, LetterGrade, SeverityCounts, DomainGrade, FindingEntry } from './build-report-types';

export interface AggregatorInput {
  source: 'flow-results' | 'memory';
  flowResults?: FlowExecutionResult[];
  memoryPaths?: string[];
  composite?: string;
}

export interface AggregatorOptions {
  includeInfo?: boolean;       // default false
  maxFindings?: number;        // default 50
  thresholds?: {               // override grading thresholds
    a: number; b: number; c: number; d: number;
  };
}

export function generateBuildReport(
  input: AggregatorInput,
  options?: AggregatorOptions
): BuildReport;

export function renderBuildReportMarkdown(report: BuildReport): string;
```

### Aggregator flow

1. **Resolve input.** If `source === 'flow-results'`, walk each result's `memory.validations[]` + `executionMetadata.validationResults`. If `source === 'memory'`, read each path, parse the frontmatter + extract the `validations` block from each `FlowMemoryEntry`.
2. **Bucket findings** by severity into `SeverityCounts`.
3. **Per-domain aggregation.** For each domain seen, sum `rulesPassed`/`rulesTotal` across all flows. Compute `passRate` and map to letter via thresholds.
4. **Overall grade.** `overallPassRate = mean(domainGrades.map(d => d.passRate))`, then `overallGrade = passRateToLetter(overallPassRate)`.
5. **Verdict.** Apply `computeVerdict` to severity counts.
6. **Next steps.** Top blockers (up to 3) + first 1-2 warnings, deduped by rule id. If verdict is clean, fall back to suggesting follow-up flows (e.g., "Run flowL_design_critique for an additional design-review lens").
7. **Return** the `BuildReport` struct.

### Markdown renderer

Pure function `renderBuildReportMarkdown(report): string`. Format spec'd by example:

```markdown
# Build Report - Craft a landing page

**Generated:** 2026-05-24 11:42 UTC
**Composite:** composite_craft_landing_page
**Flows executed:** flowA -> flowW -> flowF -> flowX -> flowG -> flowH -> flowJ -> flowK -> flowV

## Verdict: WARNINGS-ONLY

Ship after addressing the 3 warnings below. No blocking issues.

## Severity totals

| Severity | Count |
|----------|------:|
| Blocking | 0 |
| Warning  | 3 |
| Info     | 7 (hidden, pass --include-info to show) |

## Overall grade: B+ (83.4%)

## Per-domain grades

| Domain         | Pass rate | Grade | Rules |
|----------------|----------:|:-----:|------:|
| Color          | 100.0%    | A     | 22/22 |
| Typography     | 87.5%     | B     | 14/16 |
| ...

## Findings (3 warnings)

### Warning 1: motion.duration_consistency
- **Source:** extended-domain (motion)
- **Flow:** flowH_motion_integration
- **Message:** 3 distinct motion durations used; aim for 2-3 canonical values
- **Fix:** Consolidate the 200ms/250ms/300ms transitions into one of: 200ms, 250ms, 300ms

...

## Next steps

1. Resolve the 3 warnings above before shipping
2. Re-run flowJ_tactical_polish after fixes to verify
3. (Optional) Run flowL_design_critique for an additional design-review lens
```

Variations:
- `verdict === 'clean'`: findings section replaced with "No findings - ship clean."
- `verdict === 'blocked'`: verdict block names the specific blockers explicitly.

## Surfaces (three call sites)

### Surface A: Composite flow execution (automatic)

Modify `FlowCompositionEngine.execute()` in `sidecoach/src/flow-composition.ts`. After the step loop completes, generate a build report from the collected `FlowExecutionResult[]` and attach it to the composite's aggregate result. Composite result shape gains an optional `buildReport?: BuildReport` field and a `'reference'`-typed artifact named `Build Report` whose content is the markdown rendering.

### Surface B: Single flow opt-in

A caller can pass `metadata.emitBuildReport: true` to `engine.process(...)`. After single-flow execution, if the flag is set, run the aggregator on the one-element `[result]` array and attach the report to the result. Default off so one-shot flow calls do not pay the aggregation cost.

### Surface C: Standalone CLI

New `bin/sidecoach-build-report.js`. Flags:

- `--since <iso-date>` (default: last 24 hours)
- `--composite <id>` (filter by composite preset id if applicable)
- `--output-file <path>` (write markdown to file instead of stdout)
- `--json` (emit structured `BuildReport` JSON instead of markdown)
- `--include-info` (include info-level findings)

Scans `.claude/memory/session_*.md` files for `FlowMemoryEntry` blocks matching the filter window, passes them to `generateBuildReport({source: 'memory', memoryPaths: [...]})`, prints to stdout (or file).

Implementation uses `require('../dist/build-report-aggregator')` after `npm run build`.

## Tests

Four test files mirroring Sprint 2/3 conventions:

1. **`sprint4-build-report-grading.test.ts`** - Unit test for grading helpers. Cases: 95% -> A, 89.9% -> B, 70% -> C, 59% -> F, edge cases at thresholds.
2. **`sprint4-build-report-aggregator.test.ts`** - Unit test for aggregator with synthetic `FlowExecutionResult[]` input. Cases: zero findings -> clean verdict; 1 blocking + 2 warnings -> blocked verdict with right counts; multiple flows with overlapping domains aggregate correctly.
3. **`sprint4-build-report-composite.test.ts`** - Integration test that runs a composite via `FlowCompositionEngine.execute()` and asserts the result includes a `buildReport` field + a `'reference'`-typed artifact named `Build Report`.
4. **`sprint4-build-report-cli.test.ts`** - Smoke test that runs `node bin/sidecoach-build-report.js --since 1970-01-01 --json` against a temp memory dir with fixture entries and asserts the JSON output contains expected fields.

## Task breakdown (8 tasks)

1. **T1** Build `build-report-types.ts` + grading helpers (`passRateToLetter`, `computeOverallGrade`) + unit test (Test #1).
2. **T2** Build `build-report-aggregator.ts` (`generateBuildReport` working on FlowExecutionResult input) + unit test (Test #2).
3. **T3** Add markdown renderer `renderBuildReportMarkdown(report)` + unit test that snapshots a fixture report -> expected markdown shape.
4. **T4** Wire into composite execution: `FlowCompositionEngine.execute()` end-of-loop generates report + attaches to result + emits artifact. Integration test (Test #3).
5. **T5** Single-flow opt-in: `engine.process()` honors `metadata.emitBuildReport: true` for single flows.
6. **T6** CLI: `bin/sidecoach-build-report.js` with `--since`, `--composite`, `--output-file`, `--json`, `--include-info` flags. Smoke test (Test #4).
7. **T7** Memory-input mode: extend `generateBuildReport` to accept `{source: 'memory', memoryPaths}` and parse `FlowMemoryEntry` blocks from markdown files. Add test variant.
8. **T8** Sprint close: full test suite green check + sprint-close memory + MEMORY.md index entry.

## Files

**New (5 source + 4 test + 1 CLI = 10 new files):**
- `sidecoach/src/build-report-types.ts`
- `sidecoach/src/build-report-aggregator.ts`
- `sidecoach/src/__tests__/sprint4-build-report-grading.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-aggregator.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-composite.test.ts`
- `sidecoach/src/__tests__/sprint4-build-report-cli.test.ts`
- `sidecoach/bin/sidecoach-build-report.js`
- `.claude/memory/session_2026-05-24_sprint4_execution.md` (new sprint log)
- `.claude/memory/session_2026-05-24_sprint4_closed.md` (sprint close memory)

**Modified (3):**
- `sidecoach/src/flow-composition.ts` (Surface A wiring + extend CompositeFlowResult shape)
- `sidecoach/src/sidecoach-orchestrator.ts` (Surface B `metadata.emitBuildReport` opt-in handling)
- `.claude/memory/MEMORY.md` (index entry)

## Out of scope (filed as future work)

- **Grade trends over time.** This sprint emits one-shot reports; tracking deltas across runs is its own feature (would require a `build-report-history.json` store + diff logic).
- **Custom grading thresholds per project.** Uses defaults; could be made configurable in DESIGN.md frontmatter later (e.g., `quality.thresholds.a: 95`).
- **Report HTML rendering for browser preview.** Markdown only this sprint. Could ship as a follow-up that runs markdown-it on the report and saves to `.sidecoach/last-report.html`.
- **Auto-fix suggestions beyond what validators already provide.** The report surfaces existing `fix` strings; it does not synthesize new ones.
- **Slack/Discord notifications of report results.** Could integrate with existing Discord MCP for the user later.
- **Snippet accuracy verification for non-mainstream stacks.** Inherited from Phase 4 - still pending real-engagement validation.

## Open questions resolved during brainstorming

- **Q: Primary use case?** A: Both - ship verdict AND domain grades in the same report.
- **Q: When does the report fire?** A: All three triggers - automatic on composite, opt-in on single flows, CLI for retrospective.
- **Q: Aggregator architecture?** A: Central module - one file owns the report shape; validators stay unchanged.

## Risk / confidence flags

- **High confidence:** the grading scheme (pass-rate -> letter), the verdict logic, the markdown format. All three are mechanical and unambiguous.
- **Medium confidence:** the memory-mode parsing in T7. `FlowMemoryEntry` is documented in `flow-memory-schema.ts` but the markdown rendering of it in session files may have shape drift; we'll add fixtures to lock the parse contract.
- **Lower confidence:** the CLI scanning heuristic (which session_*.md files are flow runs vs. other memory entries). The implementation will use the frontmatter `type: project` + presence of `validations` block as the filter, but real session files vary.

## Next step

Invoke `superpowers:writing-plans` to convert this spec into a task-by-task implementation plan (~8 tasks per the breakdown above).
