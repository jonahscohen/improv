---
name: Sprint 2 Task 3 - FlowWLandingCompositionHandler
description: FlowHandler subclass consuming landing-composition-data, emitting guidance + checklist + memory
type: project
relates_to: [session_2026-05-24_sprint2_execution.md, session_2026-05-24_sprint2_t1_floww_flowx_registered.md, session_2026-05-24_sprint2_execution.md]
---

## Task 3: Build flow-handler-landing-composition.ts

**Status: IN PROGRESS**

### Files to Create
- `sidecoach/src/flow-handler-landing-composition.ts` - handler implementation
- `sidecoach/src/__tests__/flow-handler-landing-composition.test.ts` - test suite

### Step 1: Test file written
- 13 assertions covering: flowId, canExecute guards, brand/product register handling, guidance divergence, memory emission, checklist structure, artifacts
- File: `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/__tests__/flow-handler-landing-composition.test.ts`
- Tests brand register (Hero, Rhythm, Anti-pattern mentions) and product register (Social Proof, FAQ mentions)
- Verifies guidance differs between registers and artifacts include section references

### Step 2: Test ran, failed as expected
- Error: "Cannot find module '../flow-handler-landing-composition'" (correct)

### Step 3: Implementation written
- File: `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/flow-handler-landing-composition.ts`
- Extends BaseFlowHandler with flowId 'flowW_landing_composition'
- canExecute checks for register === 'brand' || 'product'
- execute dispatches to getSectionTaxonomy, getRhythmRules, getAntiPatternCallouts
- Emits guidance (register, taxonomy, rhythm, anti-patterns)
- Builds checklist with 4 items (register, slots, rhythm, anti-patterns)
- FlowMemoryBuilder chain: setSummary → addDecision (2x) → addMetric (2x) → addArtifact → build
- Creates 2 artifacts: section-taxonomy reference, anti-pattern-callouts reference
- Returns FlowExecutionResult with all required fields

### Step 4: Test passed
- Command: `npx ts-node src/__tests__/flow-handler-landing-composition.test.ts`
- Output: `flow-handler-landing-composition PASS`
- Exit code: 0
- All 13 assertions passed:
  - flowId is 'flowW_landing_composition'
  - canExecute false without register
  - canExecute true with brand register
  - Brand execute success
  - Brand guidance non-empty and contains Hero, Rhythm, Anti-pattern
  - Brand memory emitted
  - Brand checklist has >= 3 items
  - Product execute success
  - Product guidance differs from brand (contains Social Proof, FAQ)
  - Product guidance differs from brand
  - Product artifacts has >= 1
  - Product artifacts has section reference

### Task 3 COMPLETE - Ready for Step 5 Commit
