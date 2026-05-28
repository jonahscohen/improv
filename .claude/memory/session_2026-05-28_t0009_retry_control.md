---
name: T-0009 phase-gated retry control for polish/audit/critique
description: Cap iterations at 5, halt early after 3 identical errors. New retry-control.ts module wired into the three flow handlers with 52-check test.
type: project
relates_to: [session_2026-05-28_omc-research-synthesis.md]
---

T-0009 done (Jonah) - phase-gated retry control for sidecoach polish/audit/critique flow handlers. Pattern adapted from OMC's autopilot flow (5-cycle cap + identical-error halt).

**Why:** Without a cap, when the orchestrator loops a polish/audit/critique handler against an unchanging fix, it would re-run validators indefinitely producing the same failures. Phase-gated retry control stops that failure mode cold.

**How:**
- New module `sidecoach/src/retry-control.ts` exposes:
  - `computeErrorSignature({validator, failedRules, filePath})` -> sha256 hash sliced to 12 chars. Sorts `failedRules` before hashing so order doesn't matter.
  - `evaluateHaltConditions(state, config)` -> `HaltDecision`. Checks `max_cycles` first (cycleCount >= maxCycles), then `identical_error_loop` (last N entries all match, where N = identicalErrorThreshold). The window check on the last N entries gives the natural "reset on a non-identical iteration" behavior the task spec asked for.
  - `recordIteration`, `readRetryConfig`, `readRetryState`, `buildHaltResult`, `attachRetryStateToResult` helpers.
- Each of the three handlers (`flow-handler-tactical-polish`, `flow-handler-multi-lens-audit`, `flow-handler-design-critique`) gets the same three additions at the top of `execute()` and the end:
  1. Read `retryConfig` + `retryState` from `context.metadata` (defaults: maxCycles=5, identicalErrorThreshold=3).
  2. Call `evaluateHaltConditions` BEFORE running validators - if halt, emit log line and return error result.
  3. After validators complete, compute the error signature from the validator's failed-rule set, record the iteration, and attach the new state to `result.executionMetadata.enhancedContext.retryState` for the next round-trip.
- Per-handler signature inputs:
  - polish: `validator='polish-standard'`, `failedRules = polishReport.results.filter(!passed).map(r => String(r.ruleId))`
  - audit: `validator='multi-lens-audit'`, `failedRules = dimensions.filter(status !== 'pass').map(d => d.name)`
  - critique: `validator='design-critique'`, `failedRules = []` (no automated validator today; filePath still varies so the signature does too, and the identical-error halt is what stops a repeated critique loop)
- Halt log format:
  - `[flowJ_tactical_polish] halted: max cycles reached (cycleCount=5 maxCycles=5)`
  - `[flowK_multi_lens_audit] halted after 3 identical attempts at signature=samesig123! (validator=multi-lens-audit, attemptCount=3)`

**Tests:** `sidecoach/src/__tests__/t9-retry-control.test.ts` covers the four mandated scenarios + handler integration:
- Scenario 1 (hits maxCycles cap): 5 different signatures, halt on 6th check with `max_cycles`
- Scenario 2 (3 identical): same signature 3x in a row, halt with `identical_error_loop`
- Scenario 3 (A,B,A,B,A,B alternating): never halts on identical-error (maxCycles bumped high so only the identical-error rule could fire)
- Scenario 4 (A,A,B,A,A): never halts because every 3-window contains a mix; sanity check verifies adding one more A flips to halt
- Plus 12 controller-unit checks (signature determinism, config defaults/overrides, fresh state)
- Plus 7 handler-integration checks (each of the 3 handlers returns a halt result with proper status/message/log/metadata; polish and critique success paths attach incremented state)

Result: **52/52 passed**. `tsc --noEmit` clean.

**Files touched:**
- `sidecoach/src/retry-control.ts` (new, 178 lines)
- `sidecoach/src/flow-handler-tactical-polish.ts` (import + halt check at top + signature record at end)
- `sidecoach/src/flow-handler-multi-lens-audit.ts` (same shape)
- `sidecoach/src/flow-handler-design-critique.ts` (same shape)
- `sidecoach/src/__tests__/t9-retry-control.test.ts` (new, 52 checks)
- `TASKS.md` (T-0009 marked [x] with completion summary)

**Notes for next wave (T-0012 territory):** The retry-control module is generic - any other handler that wants the same cap can import the same helpers without duplicating logic. When T-0012's per-flow model-tier routing lands, retry state can flow alongside model-routing state in the same `executionMetadata.enhancedContext` namespace.

**Pre-existing baseline notes (not introduced by this change):** `phase-h-block7-flow-validator-integration.test.ts` was at 16/20 passing before T-0009 and remains 16/20 after. Confirmed via stash-and-rerun.
