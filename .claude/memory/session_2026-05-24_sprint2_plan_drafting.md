---
name: session-2026-05-24-sprint2-plan-drafting
description: Sprint 2 (Phase 3) plan being written using superpowers:writing-plans. Composition + copywriting flows + Sprint 1 prep carryover. Output to docs/superpowers/plans/.
type: project
relates_to: [handoff_2026-05-24_sprint1_closed_sprint2_ready.md, session_2026-05-24_sprint1_execution.md, session_2026-05-24_sprint1_holistic_review.md]
---

Human collaborator: Jonah.

## What this session is doing

Reading `handoff_2026-05-24_sprint1_closed_sprint2_ready.md` and writing the Sprint 2 implementation plan for Phase 3 of the misty-jingling-plum roadmap.

## Sprint 2 scope (confirmed from handoff)

Core (Phase 3 = headline creation gap):
- New flow handler: `flow-handler-landing-composition.ts` (returns section taxonomy + rhythm + anti-pattern callouts per register)
- New flow handler: `flow-handler-copywriting.ts` (takes section descriptor + register + product context, returns 2-3 draft copy options per slot)
- Wire both into orchestrator handler registry + `FlowId` type union + `flows.ts` trigger registry
- New preset composite workflow "craft landing page": composition -> tokens -> copywriting -> component -> motion -> polish -> audit -> taste gate

Sprint 1 prep carryover (must land in or before Sprint 2):
1. T5 process()-path test gap - new integration test that exercises `engine.process()`, not just `enrichContextForHandler` directly
2. `bin/sidecoach-artifacts.js` reads `engine.handlers` (private field) - expose `getHandlers()` method on orchestrator and update CLI
3. `parsedDesignTokens: any` in `context-loader.ts` - tighten to `DesignTokens | null`
4. Rolling: adopt DESIGN.md citation pattern in 3 additional flow handlers (typography-excellence, component-implementation, motion-integration)

## Plan structure decided

13 tasks total. Each TDD with: failing test -> verify fail -> minimal implementation -> verify pass -> commit (using the 3-bash-call commit pattern from Sprint 1 hook workarounds).

File decomposition: data modules separate from handler dispatch (mirrors the design-md-parser/flow-handler-design-tokens split that worked in Sprint 1). Data modules are independently testable; handlers stay focused on dispatch.

New flow IDs: `flowW_landing_composition` and `flowX_copywriting` (flowU/V are taken by Curate/AllSevenQA).

## Output location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/plans/2026-05-24-sprint2-composition-copywriting.md`

## Files touched in this session so far

- `docs/superpowers/plans/2026-05-24-sprint2-composition-copywriting.md` (written - 13-task plan)
- `.claude/memory/session_2026-05-24_sprint2_plan_drafting.md` (this file)
- `.claude/memory/MEMORY.md` (will add index entry)

## Plan written - status

13 tasks total, TDD throughout, each with the 3-bash-call commit sequence baked in to clear `~/.claude/.needs-verification` between npx ts-node and git commit.

Task breakdown:
- T1: register flowW + flowX in FlowId union + flow-handler flowNames + flows.ts triggers
- T2: build landing-composition-data (register-aware section taxonomy + rhythm + anti-patterns) with unit tests
- T3: build FlowWLandingCompositionHandler
- T4: register FlowW in orchestrator handlerMap + getAvailableFlows
- T5: build copywriting-templates (register/section/slot keyed) with unit tests
- T6: build FlowXCopywritingHandler (2-3 draft options per slot)
- T7: register FlowX in orchestrator
- T8: composite "craft landing page" flow (composition->tokens->copywriting->component->motion->polish->audit->QA)
- T9: expose engine.getHandlers() public method + swap artifacts CLI off private field
- T10: tighten parsedDesignTokens from `any` to `DesignTokens | null`
- T11: process()-path integration test (closes T5 gap from Sprint 1 review)
- T12: rolling - adopt DESIGN.md citation pattern in 3 more handlers (typography, component, motion)
- T13: full Sprint 2 integration smoke + final sprint-close memory

Next step for the user: pick subagent-driven-development (recommended) or executing-plans inline to run the plan.
