---
name: api-drift-detector false-positived on successful Agent launches - fixed with an Agent success-skip
description: The api-drift-detector.sh PostToolUse hook scans the Agent tool_response, which ECHOES the dispatch prompt; a prompt containing a SIG phrase ("no longer exists", "removed", "deprecated") false-triggers a drift block. Fixed by skipping successful Agent calls (agentId / async_launched / isAsync), mirroring the existing SendMessage success-skip. Genuine Agent-API drift (failed call) still fires.
type: reference
relates_to: [session_2026-07-14_parallel-dispatch-plan.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-14. Surfaced while dispatching Wave 1 of the parallel-dispatch plan.

## The failure
Dispatching 5 background Agent subagents fired `api-drift-detector.sh` with `tool=Agent sig="no longer exists"`, set `~/.claude/.api-drift-pending`, and the `api-drift-stop.sh` Stop hook then BLOCKED the turn. Saying "drift handled" in prose did NOT clear it (the clear phrase is only honored from a real USER prompt via `api-drift-ack.sh`, or by an accommodation edit to a guard/config).

## Root cause (Debugging Protocol - traced to the delta)
The detector scans a non-Bash tool's `tool_response` for breaking-contract phrases. For an async Agent launch the response is `{"isAsync":true,"status":"async_launched","agentId":...,"prompt":"<the full dispatch prompt>"}` - it ECHOES my prompt. Unit 1's prompt described pruning "symlinks whose resolved target ... no longer exists". The SIG regex matched "no longer exists" in my own natural-language prompt, not any real tool-API drift. The file already had a `SendMessage success is True` skip for exactly this class (arbitrary text in a successful result), but no equivalent for Agent.

## The fix (durable, in the symlinked source)
Added, right after the SendMessage skip in `claude/hooks/api-drift-detector.sh` (symlinked to `~/.claude/hooks/`, so live immediately):
```
if tool == "Agent" and isinstance(resp, dict) and (
        resp.get("agentId") or resp.get("status") == "async_launched" or resp.get("isAsync") is True):
    print("{}"); sys.exit(0)
```
Rationale: a successful spawn (agentId / async_launched / isAsync) means the Agent contract held; genuine Agent drift is a FAILED call (InputValidationError, no agentId) and still falls through to the scan.

## Verified (behavioral, both directions, temp HOME)
- TEST 1: successful async Agent launch whose prompt contains "no longer exists" -> output `{}`, no pending flag (correctly does NOT fire).
- TEST 2: failed Agent call ("...that field has been removed", success:false) -> fires API DRIFT + sets the flag (genuine detection preserved).

## Follow-ups / notes
- Same echo-the-input false-positive vector may exist for SYNC Agent completions (the subagent's free-text report can contain "removed"/"deprecated"). Not hit here (Wave-1 agents are async; the launch result is the dict). If a sync-report false positive appears, extend the skip to string Agent responses.
- The improv dispatch-plan Unit 3 fixes a sibling class of hook false-positive (memory-nudge misclassifying read-only/redirect commands as writes), which fired repeatedly this same session.

## Files touched
- claude/hooks/api-drift-detector.sh (Agent success-skip)
- .claude/memory/reference_api_drift_agent_success_skip.md (this beat) + MEMORY.md
