---
name: Sprint 7 T3 execution - ClaudemdMandateValidator.toValidationResult adapter
description: Adapter method converts MandateValidationResult to ValidationResult shape for orchestrator
type: project
relates_to: [session_2026-05-24_sprint7_design.md]
---

Human collaborator: Jonah.

## What T3 does

Adds static `toValidationResult(report: MandateValidationResult): ValidationResult` method to ClaudemdMandateValidator that converts mandate violations into the standard ValidationResult shape used by the orchestrator's validation framework.

## Implementation

**File:** `sidecoach/src/clausemd-mandate-validator.ts`

Added import:
```typescript
import type { ValidationResult } from './flow-composition';
```

Added static method after existing `validateOutput`:
```typescript
static toValidationResult(report: MandateValidationResult): ValidationResult {
  const allViolations = report.violations.concat(report.blockers);
  const critical = allViolations.filter(v => v.severity === 'critical');
  const warning = allViolations.filter(v => v.severity === 'warning');
  const status: 'pass' | 'fail' | 'partial' =
    critical.length > 0 ? 'fail' :
    warning.length > 0 ? 'partial' :
    'pass';
  return {
    domain: 'claudemd-mandate',
    status,
    passedRules: [],
    failedRules: allViolations.map(v => `${v.severity}:${v.location}`),
    message: allViolations.map(v => v.suggestion || v.rule).join('; ') || 'No violations',
  };
}
```

## Severity mapping

- critical violations (blockers or violations with severity 'critical') → status 'fail'
- warning violations only → status 'partial'
- no violations → status 'pass'

All violations (both violations and blockers arrays) are merged into failedRules with format `${severity}:${location}`.

## Test file

Created: `sidecoach/src/__tests__/sprint7-claudemd-validator-result.test.ts`

9 assertions across 3 scenarios:
- T1: clean result with no violations → status=pass, domain=claudemd-mandate, failedRules=[]
- T2: long-dash warning violation → status=partial, failedRules non-empty, message non-empty
- T2b: self-credit critical violation → status=fail, failedRules non-empty
- T3: hardcoded color warning → status is partial or pass (NOT fail)

All assertions PASS.

## Test results

```
PASS T1: clean result -> status === pass
PASS T1: clean result -> domain === claudemd-mandate
PASS T1: clean result -> failedRules empty
PASS T2: long-dash result -> status === partial
PASS T2: long-dash result -> failedRules non-empty
PASS T2: long-dash result -> message non-empty
PASS T2b: self-credit result -> status === fail
PASS T2b: self-credit result -> failedRules non-empty
PASS T3: warning-only result -> status is "partial" or "pass" (NOT fail)
sprint7-claudemd-validator-result PASS
```

TypeScript compilation: zero errors.

## Files modified

- `sidecoach/src/clausemd-mandate-validator.ts` (import + adapter method)
- `sidecoach/src/__tests__/sprint7-claudemd-validator-result.test.ts` (new test file)

## Task status

DONE. Ready for commit.
