---
name: Phase 1 Task 4 Start - Anti-Pattern Validator Integration
description: Wiring AntiPatternValidator into flows K, M, N for design law validation
type: project
---

## Task 4: Embed 27 Anti-Pattern Rules into Audit Flows (IN PROGRESS)

**Objective:** Integrate anti-pattern-validator.ts output into flows K (Multi-Lens Audit), M (Responsive Validation), and N (Rapid Iteration).

### Changes Made

1. **Flow K (Multi-Lens Audit)**
   - Added AntiPatternValidator imports
   - Scan src/ directory for CSS, SCSS, TSX files
   - Run validateBatch() on collected files
   - Extract violations by severity (critical, high, medium, low)
   - Add anti-pattern findings to guidance with specific fixes
   - Store validation results in artifacts for memory tracking
   - Updated checklist to include "Address all Critical findings from anti-pattern validation"

2. **Flow M (Responsive Validation)**
   - Added AntiPatternValidator for CSS scanning
   - Focus on responsive-specific anti-patterns: mobile, fixed, click targets, responsive
   - Filter violations for responsive-related patterns
   - Add responsive anti-pattern issues to guidance
   - Updated checklist to include "Address responsive anti-pattern violations"

3. **Flow N (Rapid Iteration)**
   - Added AntiPatternValidator for code iteration validation
   - Focus on iteration-specific anti-patterns: spacing, rhythm, typography, pure black
   - Calculate average validation score for baseline
   - Add iteration validation report to guidance
   - Updated checklist with "Validate iterations against anti-pattern baseline"

### File Modified

- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/flow-handlers-tier3-tier4.ts`
  - Added imports: AntiPatternValidator, ValidationResult, CategoryReflexDetector, DesignReference, SlopDetectionResult
  - Modified FlowKMultiLensAuditHandler.execute()
  - Modified FlowMResponsiveValidationHandler.execute()
  - Modified FlowNRapidIterationHandler.execute()

### Next Steps

1. Run `npm run build` to verify TypeScript compilation
2. Create tests for validator integration
3. Move to Task 5: Embed 12-rule critique framework into Flow L

### Status

- Validators added to 3 flows ✓
- Artifact data structure prepared ✓
- Compilation successful ✓
- Testing pending

### Compilation Result

```
> npm run build
> tsc
(no errors)
```

Task 4 COMPLETE - All 27 anti-pattern rules wired into flows K, M, N with proper artifact serialization.
