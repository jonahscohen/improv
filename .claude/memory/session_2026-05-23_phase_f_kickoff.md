---
name: Phase F Kickoff - Production Integration & E2E Testing (2026-05-23)
description: Phase F scope - comprehensive integration testing of all flows A-V with validator framework
type: project
relates_to: [session_2026-05-23_phase_e_complete.md, session_2026-05-23_phase2_3_complete.md]
---

# Phase F: Production Integration & End-to-End Testing

## Scope
Validate that all 22 flows (A-V) + 14 legacy flows execute correctly with the validator framework integrated. Phase F is the final validation layer before production deployment.

## Completed Foundation (Prerequisite)
- Phase E: All flows A-I wired with ExtendedDomainValidator (137-rule framework)
- Phase 1: Tasks 4-7 embedded validators, critique, polish into flows J-N
- Phase 2-3: Slash command infrastructure complete
- All 36 flows: Built, compiled, zero TypeScript errors

## Phase F Work Blocks

### Block 1: Orchestrator Integration Test Suite
Create comprehensive test file validating:
- All 22 flows (A-V) execute without errors
- All flows return proper FlowExecutionResult structure
- Domain validation metrics are extracted correctly
- FlowMemoryBuilder integration works for each flow
- Pass rate calculations are accurate

Test each flow with:
- Minimal context (edge case)
- Complete context (golden path)
- Mixed context (missing optional fields)

### Block 2: Validator Framework Verification
For each flow:
- Verify ExtendedDomainValidator.validateAll() executes
- Verify getRulesByDomain() returns expected rule counts
- Verify passRateByDomain has correct domain keys
- Verify checklist items reflect domain validations
- Verify guidance section includes domain metrics

### Block 3: Flow Chaining Validation
Test that flows can be chained correctly:
- Flows A → B (brand verify → component research)
- Flows F → G → H → I (design tokens → impl → motion → a11y)
- Flows J → K → L → M (polish → audit → critique → responsive)
- Full chain A → B → C → D → E → F → G → H → I

### Block 4: Command Routing Integration
Verify slash command routing works:
- /sidecoach research → Flow A
- /sidecoach teach → generates PRODUCT.md
- /sidecoach list → shows all 22 flows grouped by phase
- /rapid → Flow N with Improv detection

### Block 5: Memory Persistence
Validate FlowMemoryBuilder integration:
- Each flow generates valid memory structure
- Memory includes: summary, decisions, metrics, validations, artifacts
- Memory can be persisted and retrieved
- Cross-flow memory chaining works (Flow A output → Flow B input)

## Expected Deliverables
1. **integration-test-suite.ts** - Comprehensive test covering all flows
2. **validator-verification-report.md** - Domain validation per flow
3. **flow-chaining-test.ts** - Test full workflow chains
4. **e2e-memory-chain-test.ts** - Test memory persistence across flows
5. **production-readiness-checklist.md** - Sign-off document

## Success Criteria
- All 36 flows execute without errors
- 100% of flows return valid FlowExecutionResult
- Domain validation metrics extracted for 22 flows (A-N all have validators)
- No TypeScript errors during build
- Memory persistence works across flow chains
- All slash commands route correctly

## Next: Block 1 Implementation
Start creating comprehensive integration test suite.
