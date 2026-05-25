---
name: session-2026-05-24-sprint7-closed
description: Sprint 7 (carryover sweep) closed. flowW/flowX intent-detector, composite-parser colon+space, ClaudemdMandate/PolishStandard/Taste -> BuildReport adapters + aggregator dual-shape support. 48 PASS, 4 pre-existing FAIL.
type: project
relates_to: [session_2026-05-24_sprint7_design.md, session_2026-05-24_sprint6_execution.md]
---

Human collaborator: Jonah.

## What this sprint landed

6 task commits + close (7 total) on `main`:

- T1 `f3bf6e2` - flowW (landing_composition intent=0.8) and flowX (copywriting intent=0.85) intent detectors in intent-detector.ts. flowW excluder tightened to include 'component' (prevents flowG/flowB collision).
- T2 `538f9c0` - composite slash-command parser in slash-command-router.ts accepts both `composite:foo` (colon, canonical) and `composite foo` (space). Slash-command entry condition simplified to `command === 'composite'`.
- T3 `2e35eb0` - ClaudemdMandateValidator.toValidationResult adapter. Merges violations + blockers. Severity mapping: critical -> fail, warning -> partial, none -> pass. Note: long-dash is WARNING (not critical as brief assumed).
- T4 `eca9328` - PolishStandardValidator.toValidationResult adapter. Reads criticalViolations + violations from report. Rule IDs as `rule-<n>`.
- T5 `f88428d` - taste-validator.toValidationResult + runTasteValidationGate pushes ValidationResult on every call (before no-violations early-return). TasteSeverity 'error' only.
- T6 `d89ac7e` - wired ClaudemdMandate into runCompositeLoop AND single-flow path AND third dead-code site. PolishStandard from flow-handler-tactical-polish. Modified build-report-aggregator.ts to read BOTH original memory.validationResults shape (FlowMemoryEntry) AND new result.validationResults shape (composition). E2E test: clean composite produces claudemd-mandate grade A; self-credit critical violation produces verdict='blocked'.

## Test summary

56 total test files across all sprints. 48 PASS, 4 pre-existing FAIL (same as Sprint 6 close). Zero regressions from Sprint 7.

**New tests (all PASS):**
- sprint7-intent-detector-flowwx PASS
- sprint7-composite-parser-both-forms PASS
- sprint7-claudemd-validator-result PASS
- sprint7-polish-validator-result PASS
- sprint7-taste-validator-result PASS
- sprint7-buildreport-includes-unstructured PASS

**Pre-existing FAIL (unchanged):**
- phase-f-integration: 3 failed
- phase-h-block1-composition: 1 failed
- phase-h-block7-flow-validator-integration: FAILED
- phase-i-block3-context-tracking-e2e: FAILED

## Behavior contract

- **Natural-language routing:** "compose a landing page" -> flowW_landing_composition (confidence 0.8). "draft hero copy" -> flowX_copywriting (confidence 0.85).
- **Composite slash-command:** both `/sidecoach composite:composite_X` and `/sidecoach composite composite_X` route. `/sidecoach composite` (no target) returns help-text.
- **Validator to BuildReport:** every successful flow produces ValidationResult entries for ClaudemdMandate (always, soft-fail on validator throw). Tactical-polish produces PolishStandard. HTML-producing flows produce Taste. BuildReport.domainGrades has: `claudemd-mandate`, `polish-standard`, `taste`. Critical violations produces verdict='blocked'.

## Known scope

- ClaudemdMandate was dead code before Sprint 7 (validateFlowExecution defined, never called). Spec assumed existing call site; T6 wired it for the first time.
- PolishStandard pushed from flow-handler-tactical-polish (not orchestrator) -- orchestrator has no PolishCheckContext.
- BuildReport aggregator reads TWO ValidationResult shapes: original memory.validationResults (FlowMemoryEntry: check/result/details) and new result.validationResults (composition: domain/status/passedRules/failedRules/message). Aggregator preserves original block + adds new with explicit Sprint 7 T6 comments.
- (result as any).validationResults cast: FlowExecutionResult interface doesn't formally declare field. Interim acceptable; future sprint adds to type.

## Out of scope (queued)

- Push local main to origin (~97 commits unpushed).
- Sync repo claude/settings.json to live state.
- Triage 4 pre-existing sidecoach test failures.
- Add `validationResults` to FlowExecutionResult interface type.

## Local main state

Local `main` continues ahead of `origin/main`. Sprint 7 adds 6 commits to existing unpushed baseline. Push timing is Jonah's call.

## TypeScript compilation

`npx tsc --noEmit` zero errors. Project ready.
