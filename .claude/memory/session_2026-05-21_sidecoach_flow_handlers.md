---
name: Sidecoach flow handlers - Build phase 2
description: Flow handler implementation and integration architecture, continuing from complete intent detector
type: project
relates_to:
  - session_2026-05-21_sidecoach_intent_engine.md
---

# Sidecoach Flow Handler Implementation

## Status: IN PROGRESS - Architecture Complete

Continuing from completed intent detector. Building flow handler layer and orchestration architecture.

## Completed

✓ Intent detector (100% test accuracy, all 8 cases passing)
✓ flow-handler.ts: Base interface and abstract handler class (compiled, 1.8K)
✓ sidecoach-orchestrator.ts: Intent routing and flow execution (compiled, 5.6K)

## Architecture

**Intent → Execution Flow:**
1. Utterance → IntentDetector.detect() → MatchResult
2. MatchResult → SidecoachOrchestrator.process()
3. Orchestrator selects handler from registry
4. Handler.execute(context) → FlowExecutionResult
5. Result includes guidance, checklists, artifacts

**Key Components:**
- FlowExecutionContext: Parameters (utterance, userId, projectPath, file, text, metadata)
- FlowExecutionResult: Standardized output (status, message, guidance, checklist, artifacts)
- SidecoachOrchestrator: Routes intents to handlers, manages registry, handles errors
- BaseFlowHandler: Abstract base with utility methods for all implementations

**Files written:**
- sidecoach/src/flow-handler.ts (184 lines, compiled ✓)
- sidecoach/src/sidecoach-orchestrator.ts (183 lines, compiled ✓)

## Next Phase: Implement High-Priority Handlers

Starting with 4 flows that consolidate /impeccable and /make-interfaces-feel-better:

### Flow 2: Polish/Enhance Interaction
- Trigger: /make-interfaces-feel-better
- Guidance: 14-point tactile improvement checklist
- Artifacts: before/after comparison template

### Flow 5: Review/QA Mode  
- Trigger: /impeccable audit
- Guidance: 5-lens review framework (a11y, perf, theming, responsive, anti-patterns)
- Artifacts: issue prioritization checklist

### Flow 7: Design a New Component
- Trigger: /impeccable craft + QA triad (audit → critique → polish)
- Guidance: Component extraction + validation process
- Artifacts: design vs code comparison

### Flow 10: Implement from Design
- Trigger: Design-to-code workflow
- Guidance: State matrix (7 states), side-by-side verification
- Artifacts: responsive validation checklist

## Implementation Plan

1. Build Flow2Handler (polish/enhance)
2. Build Flow5Handler (review/qa)
3. Build Flow7Handler (design component + QA triad)
4. Build Flow10Handler (implement from design)
5. Create integration tests
6. Verify orchestrator routes to handlers correctly
