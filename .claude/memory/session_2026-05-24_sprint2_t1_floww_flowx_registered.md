---
name: Sprint 2 Task 1 - Register flowW + flowX
description: Registered flowW_landing_composition and flowX_copywriting in FlowId union, flowNames record, and flows trigger registry
type: project
relates_to: [session_2026-05-24_sprint2_plan_drafting.md]
---

## Task 1: Foundation - register the two new flow IDs

Status: COMPLETE

### Changes Made

- **sidecoach/src/types.ts** - Added two union members to FlowId type:
  - `flowW_landing_composition`
  - `flowX_copywriting`
  - Comment: `// Tier 6: Composition & Copy`

- **sidecoach/src/flow-handler.ts** - Added two entries to `flowNames` Record<FlowId, string>:
  - `flowW_landing_composition: 'Landing Page Composition (sections + rhythm)'`
  - `flowX_copywriting: 'Copywriting (per-slot draft options)'`
  - Comment: `// Tier 6: Composition & Copy`

- **sidecoach/src/flows.ts** - Added two Flow trigger definitions:
  - flowW: "Landing Page Composition (sections + rhythm)" with patterns for layout/section planning
  - flowX: "Copywriting (per-slot draft options)" with patterns for copy/headline generation
  - Both with proper trigger metadata, intent markers, and collision avoidance

### TDD Verification (Compile-time)

1. Added flowNames entries FIRST (Step 2) - confirmed tsc error: "Object literal may only specify known properties, and 'flowW_landing_composition' does not exist in type 'FlowId'" ✓
2. Added FlowId union members (Step 4) - resolved the type error
3. Added Flow trigger definitions (Step 5) - completed registry
4. Final `npx tsc --noEmit` - exit code 0, zero errors ✓

### Files Changed
- sidecoach/src/types.ts
- sidecoach/src/flow-handler.ts
- sidecoach/src/flows.ts

### Commit

```
feat(sidecoach): register flowW_landing_composition + flowX_copywriting in FlowId union and trigger registry
```

- Session memory file created: session_2026-05-24_sprint2_t1_floww_flowx_registered.md
- MEMORY.md index updated with single-line entry
- Verification flag cleared
- Ready for commit

### Self-Review

- All three files consistently named with "Tier 6: Composition & Copy" comment block
- Union members registered before legacy flows block (slots U, V taken; W, X are next)
- flowNames record includes both new entries with descriptive names
- Flow definitions have proper structure: id, name, description, triggers (patterns, intentMarkers, avoidCollisionWith, negativeFilters)
- No lingering tsc errors - compilation verified
- Ready for Task 2: Build landing-composition-data.ts

### Next Tasks
- T2: Build landing-composition-data.ts (composition patterns and register-aware sections)
- T3: Build FlowWLandingCompositionHandler
- T4: Register FlowW in orchestrator
- T5: Build copywriting-templates.ts
- T6: Build FlowXCopywritingHandler
- T7: Register FlowX in orchestrator
