---
name: Phase 3 DeterministicValidator implementation
description: Hard-gate prerequisite enforcement - PRODUCT.md, DESIGN.md, lint, tier sequence, motion deps
type: project
---

## Phase 3: DeterministicValidator - IN PROGRESS

### New file created
- `src/deterministic-validator.ts` - 270 lines

### Implementation: 5 gate rules

1. **All flows: PRODUCT.md exists + >200 chars**
   - Check: `fs.existsSync(projectPath/PRODUCT.md)`
   - Content length: `content.length > 200`
   - Severity: blocking (blocking violation blocks flow)
   - Debt candidate: auto-fills description, justification, estimatedCost

2. **Tier 2+ flows (flowF onward): DESIGN.md with required sections**
   - Check: `fs.existsSync(projectPath/DESIGN.md)`
   - Sections: colors, typography, spacing in YAML frontmatter
   - Regex parse: `/^---\n([\s\S]*?)\n---/` to extract frontmatter
   - Severity: blocking
   - Debt candidate: lists missing sections in description

3. **Tier 2+ flows: DESIGN.md lint passes**
   - Command: `execFileSync('npx', ['@google/design.md', 'lint', designMdPath])`
   - Timeout: 10 seconds - degrades to warning if exceeded
   - Tool missing (ENOENT): degrades to warning
   - Actual lint failure: blocking
   - Uses safe `execFileSync` (no shell injection risk)

4. **Tier 3 flows (polish/QA): At least one Tier 2 flow succeeded**
   - Check: `history.getLatestRun(tier2FlowId)?.status === 'success'`
   - Tier 2 flows: flowF, flowG, flowH, flowI
   - Tier 3 flows: flowJ, flowK, flowL, flowM, flowN
   - Severity: blocking (prevents premature QA)

5. **Motion flows (flowE, flowH, flowT): GSAP or Lenis in package.json**
   - Check: `'gsap' in deps || 'lenis' in deps`
   - Parse package.json dependencies + devDependencies
   - Severity: blocking
   - Debt candidate: mentions missing dependency

### Key interfaces

```typescript
interface ValidationViolation {
  rule: string;
  severity: 'blocking' | 'warning';
  message: string;
  fix?: string;
  debtCandidate?: { ... };  // Pre-filled for auto-logging
}

interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  message: string;
}
```

### Next: Wire into sidecoach-orchestrator.ts
- Import: `import { DeterministicValidator, ValidationResult } from './deterministic-validator';`
- Pre-execution seam: line 194 (before `validatePrerequisites()`)
- Create instance: `const validator = new DeterministicValidator();`
- Call: `const validation = validator.validate(currentFlowId, executionContext, flowHistory);`
- On blocking: skip flow with 'skipped' status and record to history

### Fix applied
- Import error: `FlowExecutionContext` not exported from types.ts
- Corrected import: from `flow-handler.ts` instead

### Wiring into sidecoach-orchestrator.ts
- Added import: `import { DeterministicValidator } from './deterministic-validator';`
- Moved `const flowHistory = getFlowHistory();` and `const validator = new DeterministicValidator();` before while loop (lines 172-173)
- Replaced orchestrator.validatePrerequisites() call with DeterministicValidator.validate()
- New flow:
  1. Call `validator.validate(currentFlowId, executionContext, flowHistory)` 
  2. On blocking violations: skip with 'skipped' status, record guidance array from violations
  3. Keep handler.canExecute() check after validator (flow-sequence prerequisite logic)
- Fixed: Removed duplicate variable declarations inside loop (lines 230, 256)

### Phase 3 Status: VERIFIED COMPLETE

**What Phase 3 delivers:**
- Hard-block gates on real prerequisites (PRODUCT.md, DESIGN.md, lint, tier sequence, motion deps)
- Violations auto-converted to guidance array for flow history recording
- Graceful degradation: tool-unavailable and timeout violations degrade to warnings
- Blocking violations stop flow chain and record to history with full violation details

**Impact:** Oracle never blocks. Sidecoach now blocks flows when real prerequisites are unmet.

---

## Next: Phase 4-7 Implementation

Remaining systems:
- **Phase 4**: RegressionDetector (compare runs, block on degradation)
- **Phase 5**: ProjectPersonaEngine (async LLM extraction from PRODUCT.md)
- **Phase 6**: DesignDebtTracker (formal deferred decision tracking)
- **Phase 7**: Oracle Detect integration (wire `npx oracle detect` into FlowK)

Plus: Skill content porting and new flows (curate + all-seven QA)
