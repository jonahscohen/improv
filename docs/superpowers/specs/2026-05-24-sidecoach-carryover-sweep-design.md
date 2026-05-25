# Sidecoach Carryover Sweep - Design Spec

**Date:** 2026-05-24
**Author:** Jonah Cohen (collaborator)
**Sprint:** Sprint 7 (carryover sweep)
**Predecessors:** Sprints 2 (flowW/flowX), 4 (composite parser + BuildReport), 5+6 closed

## Goal

Close three loose ends from Sprints 2-4 in one focused sprint:

1. **Natural-language routing to flowW + flowX.** Today the landing-composition (flowW) and copywriting (flowX) handlers are reachable only via composite presets and direct flowId. Natural-language utterances like "compose a landing page" or "draft hero copy" do NOT route to them.
2. **Composite slash-command parser inconsistency.** Help text in `sidecoach-orchestrator.ts:746-753` advertises `/sidecoach composite:<flow-id>` (colon form). The parser regex `^/(?:sidecoach\s+)?(\w+)(?:\s+(.*))?$` uses `\w+` which does NOT span colons, so `composite:foo` parses as command=`composite`, target=undefined.
3. **Unstructured validators do not feed BuildReport.** Today `build-report-aggregator.ts` reads only structured FlowMemoryEntry data (`validationResults`, `metrics`, `gates`). The ClaudemdMandate, PolishStandard, and Taste validators emit violation streams that never reach the report, so a flow with three em-dash violations gets the same verdict as a clean run.

## Why

These items have been filed across sprint close memories since Sprint 4 and Sprint 5. They're small, mostly mechanical, and each one closes a real loose end users can hit. Bundling them into one sprint is the right scope (smaller than Sprint 6, larger than a one-task fix).

## Scope decisions resolved during brainstorming

- **flowW triggers (composition-focused):** keywords `['landing', 'composition', 'compose', 'sections', 'section layout', 'page sections']`, excluder `['research', 'reference', 'inspiration']`, score 0.8.
- **flowX triggers (copy + draft focused):** keywords `['copywriting', 'copy', 'draft copy', 'headline', 'hero copy', 'section copy', 'marketing copy', 'tagline']`, excluder `['code', 'function', 'component']`, score 0.85.
- **Parser fix:** accept both colon AND space forms. Regex updated; help text stays as the colon form (more readable, documents canonical syntax).
- **Validator -> BuildReport contract:** each validator gets a `toValidationResult()` adapter that returns the existing `ValidationResult` shape. Orchestrator pushes the converted result onto `result.validationResults`. BuildReport picks them up via the existing aggregator path. Severity mapping: critical -> fail, warning -> partial, none -> pass.

## Architecture overview

Three independent changes that share an integration test at the end. No new modules. Pure additions + minor regex change + adapter methods.

### Change 1: intent-detector wiring

Add two private factory methods to `IntentDetector` mirroring `createFlowADetector` through `createFlowVDetector`:

```typescript
private createFlowWDetector(): FlowDetector {
  return {
    flowId: 'flowW_landing_composition',
    score: (u) => {
      if (this.hasAny(u, ['landing', 'composition', 'compose', 'sections', 'section layout', 'page sections'])) {
        if (this.hasNone(u, ['research', 'reference', 'inspiration'])) {
          return 0.8;
        }
      }
      return 0;
    },
  };
}

private createFlowXDetector(): FlowDetector {
  return {
    flowId: 'flowX_copywriting',
    score: (u) => {
      if (this.hasAny(u, ['copywriting', 'copy', 'draft copy', 'headline', 'hero copy', 'section copy', 'marketing copy', 'tagline'])) {
        if (this.hasNone(u, ['code', 'function', 'component'])) {
          return 0.85;
        }
      }
      return 0;
    },
  };
}
```

Both detectors get registered in the existing detector array (find where existing `createFlow<X>Detector()` calls are wired and add these alongside).

### Change 2: composite slash-command parser

Current regex:
```typescript
const slashMatch = utterance.match(/^\/(?:sidecoach\s+)?(\w+)(?:\s+(.*))?$/);
```

New regex:
```typescript
const slashMatch = utterance.match(/^\/(?:sidecoach\s+)?(\w+)(?::([\w-]+)|\s+(.*))?$/);
```

Destructuring:
```typescript
const [, command, colonTarget, spaceTarget] = slashMatch;
const target = colonTarget || spaceTarget;
const commandMatch = { command, target };
```

The new regex's two alternation groups for the trailing argument:
- `:([\w-]+)` matches the colon form (`composite:composite_qa_workflow`)
- `\s+(.*)` matches the space form (`composite composite_qa_workflow`)

Either capture group is set depending on which form the caller used. Both reduce to the same `target` string.

Help text (lines 746-753) is unchanged because the colon form was always the documented intent. Both forms now work.

### Change 3: unstructured-validator -> ValidationResult adapters

Each of the three validators gets a static `toValidationResult()` method that converts its native violation shape into the existing `ValidationResult` shape that BuildReport already reads.

**ClaudemdMandate (signature):**
```typescript
static toValidationResult(report: MandateValidationResult): ValidationResult {
  const critical = report.violations.filter(v => v.severity === 'critical');
  const warning = report.violations.filter(v => v.severity === 'warning');
  const status: 'pass' | 'fail' | 'partial' =
    critical.length > 0 ? 'fail' :
    warning.length > 0 ? 'partial' :
    'pass';
  return {
    domain: 'claudemd-mandate',
    status,
    passedRules: [],
    failedRules: report.violations.map(v => `${v.severity}:${v.location}`),
    message: report.violations.map(v => v.message).join('; ') || 'No violations',
  };
}
```

**PolishStandard (signature):** identical pattern, `domain: 'polish-standard'`.

**Taste (signature):** identical pattern, `domain: 'taste'`. The TasteViolation shape uses `severity` field too; if naming differs ('error' vs 'critical', 'warn' vs 'warning'), normalize in the adapter.

**Orchestrator wiring** in `runCompositeLoop` (and the natural-language single-flow return path - the same logic applies for the Sprint 4 Surface B opt-in flag):

After the existing automatic-validator block (`getValidatorsForFlow + validateMultipleDomains`), append:

```typescript
if (result.status === 'success') {
  result.validationResults = result.validationResults || [];

  // ClaudemdMandate
  const mandateReport = ClaudemdMandateValidator.validateOutput(result, context);
  result.validationResults.push(ClaudemdMandateValidator.toValidationResult(mandateReport));

  // PolishStandard
  const polishReport = PolishStandardValidator.validate(result);
  result.validationResults.push(PolishStandardValidator.toValidationResult(polishReport));
}
```

The Taste validator currently runs via `runTasteValidationGate(...)` which mutates `result.status` and emits a violations summary into `result.message` on failure. For BuildReport integration, the gate also needs to push a ValidationResult onto `result.validationResults` regardless of whether it changed `result.status`. Add this to the gate's end:

```typescript
private runTasteValidationGate(flowId, context, result): void {
  // existing logic that may mutate result.status...

  // NEW: always push a ValidationResult so BuildReport sees the outcome.
  result.validationResults = result.validationResults || [];
  result.validationResults.push(TasteValidator.toValidationResult(tasteViolations));
}
```

The existing ClaudemdMandate call site in the orchestrator at `~line 558` already runs the validator but does NOT push to validationResults today. That's the gap this fills.

## BuildReport impact

The aggregator already reads `result.validationResults` via `findingsFromResult` and `domainGradesFromResults`. With Change 3 in place, three new domain grades will appear in the report: `claudemd-mandate`, `polish-standard`, `taste`. Findings are severity-bucketed (fail -> blocking, partial -> warning, pass -> no finding).

No aggregator code changes needed. The integration is by contract: validators now write to `result.validationResults`; aggregator reads from there.

## Testing strategy

Five tests, all using ts-node + console.log PASS/FAIL pattern:

### 1. sprint7-intent-detector-flowwx.test.ts

- Utterance "compose a landing page" routes to `flowW_landing_composition` with confidence >= 0.8.
- Utterance "draft hero copy" routes to `flowX_copywriting` with confidence >= 0.85.
- Utterance "research components" still routes to `flowB_component_research` (regression - no over-match).
- Utterance "copy this function to that file" does NOT route to flowX (excluder check).

### 2. sprint7-composite-parser-both-forms.test.ts

- `/sidecoach composite:composite_qa_workflow` parses with target `composite_qa_workflow`.
- `/sidecoach composite composite_qa_workflow` parses with the same target.
- `/sidecoach composite` (no target) returns the help-text response listing the 3 available composites.
- `/sidecoach unknown_command` falls through to natural-language routing (no parse match for the slash branch).

### 3. sprint7-claudemd-validator-result.test.ts

- A clean result with no violations -> `toValidationResult` returns `status: 'pass'`, empty failedRules.
- A result with an em-dash in `message` -> `status: 'fail'`, failedRules contains `critical:message`.
- A result with a warning-only violation (e.g. a soft-info issue) -> `status: 'partial'`, failedRules has the warning entry.

### 4. sprint7-polish-validator-result.test.ts

- Analogous structure to #3 for PolishStandardValidator.

### 5. sprint7-buildreport-includes-unstructured.test.ts

- End-to-end. Run a composite that produces a clean flowResult plus a result with a forbidden em-dash. Generate BuildReport via the orchestrator's existing Surface A path. Assert:
  - The buildReport's `domainGrades` contains entries for `claudemd-mandate` and `polish-standard`.
  - The buildReport's `verdict` is `blocked` (because the em-dash is a critical violation).
  - The findings list contains a `claudemd-mandate` finding with severity `blocking`.

## Plan size

Estimated 7 tasks (Sprint 7):

- T1: flowW + flowX detectors + registration + intent-detector test (TDD).
- T2: composite-parser regex change + destructuring + parser test (TDD).
- T3: ClaudemdMandate `toValidationResult` adapter + unit test (TDD).
- T4: PolishStandard `toValidationResult` adapter + unit test (TDD).
- T5: Taste `toValidationResult` adapter + integration into `runTasteValidationGate` (TDD).
- T6: Orchestrator wiring (push adapter results onto `result.validationResults`) + end-to-end BuildReport test.
- T7: Sprint close.

Comparable to Sprint 6 in scope. Sprint name: Sprint 7.

## Failure modes

- **A validator's `validateOutput` throws unexpectedly.** Wrap each push in try/catch and log to stderr; do NOT kill the composite. Pattern matches the soft-fail discipline established in Sprint 6 (checkpoint write failures don't kill the run).
- **`result.validationResults` is mutated by a downstream consumer.** Today the orchestrator reads it after validator calls; with this change, validators write to it. If a future flow handler clears it post-validation, the BuildReport will be incomplete. Document the contract in the orchestrator and add a regression test (no current handler does this, but the constraint is now load-bearing).
- **Naming collision.** If two validators emit the same `domain` field (e.g. someone copy-pastes a `'claudemd-mandate'` literal), the BuildReport's grade computation will merge them. The current adapter pattern uses literal-typed domain strings; a code review catches collisions.

## Open questions / risk flags

- **Taste validator structural mismatch.** The Taste violation shape uses different severity vocabulary (`error`/`warn` vs `critical`/`warning`). Confirmed during T5 design - the adapter handles normalization.
- **Single-flow path coverage.** Sprint 4 added Surface B (single-flow opt-in via `metadata.emitBuildReport`). The new validator wiring needs to fire on both the composite-loop path AND the single-flow natural-language path. T6 covers the composite path; the single-flow path may need its own assertion in the same test file or a small adjunct test.
- **Existing Sprint 4 BuildReport tests may need updates.** If sprint4-build-report-composite.test.ts asserted a specific shape of `validationResults` or `domainGrades`, the new entries may break those assertions. T7 runs the full suite; any regression surfaces during the close.

## Files to create / modify

**New:**
- `sidecoach/src/__tests__/sprint7-intent-detector-flowwx.test.ts`
- `sidecoach/src/__tests__/sprint7-composite-parser-both-forms.test.ts`
- `sidecoach/src/__tests__/sprint7-claudemd-validator-result.test.ts`
- `sidecoach/src/__tests__/sprint7-polish-validator-result.test.ts`
- `sidecoach/src/__tests__/sprint7-buildreport-includes-unstructured.test.ts`

**Modified:**
- `sidecoach/src/intent-detector.ts` (2 new detectors + registration)
- `sidecoach/src/sidecoach-orchestrator.ts` (regex + destructuring + validator-result pushes in runCompositeLoop + single-flow path + runTasteValidationGate addition)
- `sidecoach/src/clausemd-mandate-validator.ts` (toValidationResult method)
- `sidecoach/src/polish-standard-validator.ts` (toValidationResult method)
- `sidecoach/src/taste-validator.ts` (toValidationResult method)

## Acceptance criteria

- All 5 new test files pass via ts-node.
- The existing 42-test sidecoach suite from Sprint 6 close remains green (no new regressions).
- `npx tsc --noEmit` exits 0.
- A natural-language utterance "compose a landing page" routes to flowW.
- A natural-language utterance "draft hero copy" routes to flowX.
- `/sidecoach composite:composite_qa_workflow` and `/sidecoach composite composite_qa_workflow` both execute the same composite.
- A composite result containing a forbidden em-dash produces a BuildReport with `verdict: 'blocked'` and a `claudemd-mandate` domain grade of F.
- A clean composite produces three new domain grades (`claudemd-mandate`, `polish-standard`, `taste`) all graded A.
