---
name: sidecoach-v3-plan
description: Plan for Sidecoach v3 - Design System Guardian with 5 new enforcement systems surpassing oracle
metadata:
  type: project
  relates_to:
    - session_2026-05-21_sidecoach-tier5-completion.md
    - session_2026-05-21_oracle_gap_analysis.md
---

# Sidecoach v3: Design System Guardian - Plan

## Status: PLANNED + REVIEWED (not yet implemented)

## Review Findings (12 issues identified, all resolved in plan)

3 blockers fixed:
- Checklist `completed` never becomes `true` - regression signals replaced with observable output changes (status, guidance count, message length, checklist item count)
- DebtTracker had no interaction model - resolved: warning violations are auto-logged as debt with pre-filled metadata, no user prompt needed
- PersonaEngine parsing freeform PRODUCT.md - resolved: async LLM extraction, falls back to generic archetypes on failure

4 gaps added:
- `npx oracle detect` now wired into FlowK (makes the comparison table claim true)
- Session boundary defined: history keyed by projectPath not sessionId (enables cross-session regression)
- FlowHistory retention cap: 20 runs per flow max
- `projectPath` fallback: use `process.cwd()` if absent

Plan file: `/Users/spare3/.claude/plans/moonlit-purring-zebra.md`

## What the v3 Plan Adds

Turns Sidecoach from an oracle mapper into a design system guardian with 5 new systems:

1. **DeterministicValidator** - hard-blocks flows when prerequisites unmet (PRODUCT.md, DESIGN.md, motion deps)
2. **FlowHistory v2** - changes flowOutputs from single-entry to array-per-flow (enables regression detection)
3. **RegressionDetector** - compares each run against prior runs, blocks on required-item failures
4. **ProjectPersonaEngine** - generates 3 project-specific personas from PRODUCT.md (vs oracle's 5 generic archetypes)
5. **DesignDebtTracker** - formally tracks deferred design decisions with justification + due-by context

## Critical Fixes Identified (Phase 1)

The 3 explore agents found these bugs in current code:
- `validatePrerequisites()` always returns valid=true for artifact checks (stubbed)
- `canExecute()` is never called anywhere - dead code
- All handlers unconditionally return status='success'
- FlowHistory.recordFlow() deduplicates flowSequence, breaking getFlowCount()
- FlowHistoryEntry drops 'nextSteps' field vs FlowExecutionResult
- Flows K-T have no dependency entries - orchestrator returns valid=false for unknown flows
- IntentDetector creates its own SidecoachOrchestrator separately from engine's - duplicate instances

## What Genuinely Surpasses Oracle

- **No equivalent anywhere**: DesignDebtTracker + RegressionDetector
- **Project-aware critique**: Generated personas vs generic Alex/Jordan/Sam/Riley/Casey
- **Hard prerequisite gates**: Oracle never blocks, Sidecoach v3 will hard-fail without PRODUCT.md/DESIGN.md
- **Cross-session memory**: FlowHistory v2 persists all runs, oracle has zero cross-command state

## Implementation Order

Phase 1: Foundation fixes (unblock everything)
Phase 2: FlowHistory v2 (regression prerequisite)
Phase 3: DeterministicValidator
Phase 4: RegressionDetector
Phase 5: ProjectPersonaEngine
Phase 6: DesignDebtTracker

4 new files + 6 modified files
