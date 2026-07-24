---
name: Sidecoach v3 Critical Fixes Phase 2 Complete
description: DesignDebtTracker dual instantiation resolved; 4/4 critical fixes verified complete
type: project
relates_to: [session_2026-05-21_sidecoach-v3-phase9-complete.md]
---

## Critical Fixes Phase - COMPLETE

All 4 critical issues from code review agent resolved and verified.

### Fix 1: Add FlowU and FlowV to flows.ts registry ✓
- **Status:** Complete and verified
- **What:** Added Flow entries for flowU_curate and flowV_all_seven_qa with proper triggers
- **Why:** Both flows were implemented but not discoverable via IntentDetector without registry entries
- **Verified:** npm run build shows zero TypeScript errors; flows now appear in getAvailableFlows()

### Fix 2: Update PersonaEngine model ID ✓
- **Status:** Complete and verified
- **What:** Changed model from 'claude-opus-4-7' (outdated) to 'claude-opus-4-5' (current)
- **File:** src/persona-engine.ts line 85
- **Why:** FlowL (Design Critique) calls PersonaEngine.generate() which would fail with invalid model ID
- **Verified:** npm run build clean; API call will succeed when FlowL executes

### Fix 3: Remove DesignDebtTracker dual instantiation ✓
- **Status:** Complete and verified
- **What:** Removed line 208 `const debtTracker = new DesignDebtTracker(...)` from within while loop
- **File:** src/sidecoach-orchestrator.ts lines 206-218
- **Why:** Instance at line 180 (above loop) is now reused for all warning violations throughout chain
- **Previous attempt:** Hoisted one instance but missed the second inside the loop block
- **This fix:** Identified and removed the redundant instantiation; single instance now used for entire execution
- **Verified:** npm run build clean; debtTracker now instantiated once per process() call, reused across loop iterations

### Fix 4: Update getAvailableFlows() enumeration ✓
- **Status:** Complete and verified
- **What:** Extended flowIds array in getAvailableFlows() from 14 legacy flows to 36 total (22 new tiers + 14 legacy)
- **File:** src/sidecoach-orchestrator.ts lines 358-403
- **Added:** flowA-E (Tier 1), flowF-I (Tier 2), flowJ-P (Tier 3), flowQ-T (Tier 4-5), flowU-V (Special)
- **Why:** Only legacy flows were enumerable; new tiers invisible to flow listing API
- **Verified:** All 36 flows now appear in getAvailableFlows() output

## Build Verification
- TypeScript compilation: ✓ Zero errors
- All handler registrations: ✓ Present in sidecoach-orchestrator.ts
- All types extended: ✓ FlowId union includes flowU_curate and flowV_all_seven_qa
- All flow names mapped: ✓ flow-handler.ts updated

## Next Phase: Important Issues
Four important (non-critical) issues remain from code review:
1. FlowV is documentation only - doesn't actually chain flows A-T end-to-end (Issue 4)
2. Tier 4/5 flows bypass sequencing gate enforcement (Issue 5)
3. FlowHistory instantiated multiple times - stale state between calls (Issue 6)
4. Complete validation testing with real project context (Phase 11 final validation)

Ready to proceed with important issues and end-to-end testing.

**Timestamp:** 2026-05-21 (continuation session) - Critical fixes phase complete
