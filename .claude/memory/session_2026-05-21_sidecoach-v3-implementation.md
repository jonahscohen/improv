---
name: sidecoach-v3-implementation
description: Building Option A (true replacement) for Sidecoach v3 - porting all skill content at complete fidelity
metadata:
  type: project
  relates_to:
    - session_2026-05-21_sidecoach-v3-plan.md
---

# Sidecoach v3 Implementation - Option A (True Replacement)

## Status: Phase 1 - Foundation Fixes (IN PROGRESS)

User mandate: "Make this real and make it good. Make it what I want it to be. THE REAL DEAL."

Option A approach: Port all 7 layers' full skill content into Sidecoach at complete fidelity, plus /curate equivalent, plus all-seven QA flow.

## Phase 1: Foundation Fixes (4 items)

**Fix 1: Dependency Injection for Orchestrator** (DONE)
- Modified: `intent-detector.ts` line 17-20
- Changed: Constructor accepts optional `orchestrator?: SidecoachOrchestrator` and `history?: FlowHistory`
- Reason: Eliminates duplicate SidecoachOrchestrator instances - engine and detector now share one
- Impact: Fixes the duplicate orchestrator bug that was causing state divergence

**Fix 2: Add Missing K-T Dependencies** (DONE)
- Modified: `orchestrator.ts` initializeDependencies()
- Added: All missing flows K-T (14 flows: K-N tier3, O-Q tier4, R-T tier5)
- Reason: Flows K-T had no orchestrator entries, causing validatePrerequisites() to return "unknown flow"
- Added prerequisites, next flows, and artifact requirements for each
- Impact: All 24 flows now known to orchestrator, chainable and validatable

**Fix 3: Revive canExecute() Validation** (DONE)
- Modified: `sidecoach-orchestrator.ts` before handler.execute()
- Added: Pre-execution check handler.canExecute(context), skip if false
- Reason: canExecute() was dead code - never called, always returns true
- Impact: Enforces flow-sequence prerequisite checks before execution

**Fix 4: Preserve nextSteps Field** (DONE)
- Modified: `flow-history.ts` FlowHistoryEntry interface
- Added: `nextSteps?: string[];` field
- Reason: nextSteps exists in FlowExecutionResult but was dropped in history
- Impact: Enables future flow chaining on handler recommendations

## Phase 1 Verification
✓ `npm run build` - TypeScript compiles cleanly, zero errors
✓ All 4 fixes integrated and building successfully

## Next: Phase 2-7 Implementation

After Phase 1 verification:
- Phase 2: FlowHistory v2 (schema change to array-per-flow, projectPath keying)
- Phase 3: DeterministicValidator (hard gates)
- Phase 4: RegressionDetector (compare against prior runs)
- Phase 5: ProjectPersonaEngine (async LLM extraction from PRODUCT.md)
- Phase 6: DesignDebtTracker (formal tracking of deferred decisions)
- Phase 7: Oracle Detect Integration (wire `npx oracle detect` into FlowK)

Plus: Port full skill content (component gallery, fontshare, motion patterns, curate wizard, all-seven QA flow)

## Files Modified So Far
- `src/intent-detector.ts` - DI support
- `src/orchestrator.ts` - K-T dependencies

## Files To Modify Next
- `src/sidecoach-orchestrator.ts` - canExecute() wiring
- `src/flow-handler.ts` - nextSteps preservation
- 4 new files (validator, detector, persona, debt)
- 6 total files (+ reference-data.ts for full skill content)
