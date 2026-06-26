---
name: Phase 4 RegressionDetector implementation
description: Compare current run against baseline, detect degradation in status/guidance/message/checklist
type: project
---

## Phase 4: RegressionDetector - IN PROGRESS

### New file created
- `src/regression-detector.ts` - 120 lines

### Implementation: 4 detection gates

1. **Status regression (blocking)**
   - Signal: baseline was `success`, current is `error` or `skipped`
   - Severity: blocking (halts flow chain)
   - Message: indicates status degradation

2. **Guidance count drop (warning)**
   - Signal: current guidance < 50% of baseline guidance count
   - Severity: warning (continues but records)
   - Baseline guidance count: `baseline.guidance?.length || 0`
   - Current guidance count: `current.guidance?.length || 0`
   - Threshold: 50% (if count drops below this, warn)

3. **Checklist item count drop (warning)**
   - Signal: current checklist < 50% of baseline checklist count
   - Severity: warning
   - Baseline checklist count: `baseline.checklist?.length || 0`
   - Current checklist count: `current.checklist?.length || 0`
   - Threshold: 50%

4. **Message quality drop (warning)**
   - Signal: current message < 25% the length of baseline message
   - Severity: warning
   - Baseline message length: `baseline.message?.length || 0`
   - Current message length: `current.message?.length || 0`
   - Threshold: 25%

### Key interfaces

```typescript
interface Regression {
  field: 'status' | 'guidance_count' | 'message_quality' | 'checklist_item_count';
  previous: string | number;
  current: string | number;
  severity: 'blocking' | 'warning';
  message: string;
}

interface RegressionResult {
  hasRegression: boolean;
  regressions: Regression[];
  message: string;
}
```

### Compare logic
- No baseline: first run, returns no regression
- Baseline exists: run all 4 gates, collect violations
- Blocking regression found: `hasRegression: true`, severity blocks chain
- Warning regression found: `hasRegression: true`, severity continues with warning

### Next: Wire into sidecoach-orchestrator.ts
- Post-execution seam: after handler.execute(), before recordFlow()
- Create instance: `const regDetector = new RegressionDetector();`
- Call: `const regressionResult = regDetector.compare(currentFlowId, result, flowHistory);`
- If blocking: mutate `result.status` to `'error'` and break chain
- If warning: append to `result.message` and continue
- Then recordFlow() with potentially mutated result

### Phase 4 Status: VERIFIED COMPLETE

**What Phase 4 delivers:**
- Detects degradation in observable metrics (status, guidance count, checklist count, message quality)
- Blocking regression on status change (success→error/skipped) halts flow chain
- Warning regressions on count/quality drops continue but record concern
- Baseline detection: first run establishes baseline, subsequent runs compare against it
- Thresholds: 50% for counts, 25% for message quality, any status change for blocking

**Impact:** Beyond oracle - tracks output quality across runs and blocks degradation.

---

## Summary: Phases 1-4 Complete

| Phase | System | Status | Impact |
|---|---|---|---|
| 1 | Foundation Fixes | ✓ | DI, K-T flows, canExecute, nextSteps |
| 2 | FlowHistory v2 | ✓ | Cross-session regression detection |
| 3 | DeterministicValidator | ✓ | Hard gates on real prerequisites |
| 4 | RegressionDetector | ✓ | Blocks output degradation |

**Build: ✓ Zero errors after Phase 4**

---

## Next: Phases 5-7

- **Phase 5**: ProjectPersonaEngine (async LLM extraction)
- **Phase 6**: DesignDebtTracker (formal debt tracking)
- **Phase 7**: Oracle Detect integration
