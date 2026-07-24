---
name: Sidecoach v3 Important Issues - In Progress
description: Fixing 3 important issues from code review - FlowV chaining, FlowHistory instantiation, Tier enforcement
type: project
relates_to: [session_2026-05-21_sidecoach-v3-critical-fixes-phase2.md]
---

## Important Issues Phase

### Issue 4: FlowV is documentation-only - doesn't chain flows ✓
- **Status:** FIXED
- **Problem:** FlowV was defined with ALL flows A-T as prerequisites + empty nextFlowsIfSuccess, making it a validator not an orchestrator
- **Fix:** Changed orchestrator.ts FlowV dependency definition (lines 250-279):
  - prerequisiteFlows: [] (was all 20 flows)
  - nextFlowsIfSuccess: ['flowA_brand_verify'] (was empty)
  - prerequisiteArtifacts: [] (validation now handled by DeterministicValidator)
- **Result:** FlowV now serves as entry point orchestrator - returns success and chains to Flow A, which triggers the entire A-T sequence via existing dependency map
- **Verified:** npm run build clean

### Issue 5: Tier 4/5 flows bypass sequencing gate enforcement ✓
- **Status:** FIXED
- **Problem:** DeterministicValidator had Gate 4 (Tier 3 requires Tier 2) but was missing Gate 5 (Tier 4/5 require Tier 3)
- **Fix:** Added Gate 5 to deterministic-validator.ts (lines 213-239):
  - Defines tier45FlowIds: flowQ, flowR, flowS, flowT
  - Checks history for at least one successful Tier 3 flow (J, K, L, M, N, O, P)
  - Blocks flow execution if prerequisite Tier 3 not met
- **Verified:** npm run build clean

### Issue 6: FlowHistory instantiated multiple times - stale state between calls ✓
- **Status:** FIXED
- **Problem:** flowHistory instance at line 178 but also duplicated via getFlowHistory() call at line 251 inside loop
- **Fix:** Removed duplicate instantiation at line 251; now reuses the instance from line 178 for entire execution
- **Result:** Single flowHistory instance persists across all loop iterations, eliminating stale state
- **Verified:** npm run build clean

### Issue 7: Complete validation testing
- **Status:** PENDING
- **Plan:** Run comprehensive end-to-end test with test project context after all important issues fixed

**Next:** Address Issue 5 (Tier 4/5 enforcement) and Issue 6 (FlowHistory consolidation)
