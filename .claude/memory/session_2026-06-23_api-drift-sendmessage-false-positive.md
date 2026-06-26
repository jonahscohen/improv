---
name: API-drift guard false-positive on SendMessage content - accommodated (skip successful sends)
description: The api-drift Stop hook blocked end-of-turn on tool=SendMessage sig="has been removed". It was a false positive - the phrase was in the DELIVERED message body (a teammate's prose: "the fix-gate suppressor ... has been removed"), not a real API-contract break. Fixed the detector to skip SendMessage results with success=true; failed sends still get scanned.
type: project
relates_to: [session_2026-06-22_api-drift-guard.md, session_2026-06-22_api-drift-first-fire-accommodation.md]
---

Collaborator: Jonah Cohen

## What blocked
api-drift-stop.sh blocked the turn: `tool=SendMessage sig=has been removed`. Trace from ~/.claude/.api-drift.log:
`DRIFT tool=SendMessage sig=has been removed :: {"success": true, ... "routing": {... "summary":"DONE - A+B+C complete...", "content":"DELIVERABLE COMPLETE..."}}`

## Root cause (false positive)
The api-drift-detector PostToolUse hook scans tool results for breaking-contract phrases. It already excludes content tools (Read/Grep/...) for this exact reason, but it INCLUDES SendMessage - and a SendMessage result's `routing.content` / `routing.summary` carry the arbitrary DELIVERED message body. The ref-integrator teammate's completion message contained the natural-language phrase "a previous fix-gate suppressor was used during harness/fold iteration and has been removed (gate restored)". The detector matched "has been removed" in that prose. SendMessage itself returned success=true and worked all session (dozens of calls). This is the same false-positive class as the Read-content hits already in the log. (Cross-session: the teammate's own copy of the hook fired and wrote the SHARED ~/.claude/.api-drift-pending, which then blocked the lead's Stop.)

## Fix (accommodation)
claude/hooks/api-drift-detector.sh: before scanning, skip SendMessage results that returned success=true - a successful send means the tool contract held, so there is no API drift in its result; the body is arbitrary user/teammate text. Real SendMessage drift surfaces as a FAILED send (success != true / an error), which still falls through to the scan.
Editing a claude/hooks/ file is itself the accommodation (clear-on-accommodate path), so this edit cleared ~/.claude/.api-drift-pending.

## Verified
- bash -n OK.
- pending flag cleared by the edit.
- TEST: successful SendMessage with "has been removed" in routing.content -> {} (skipped). The exact real-world payload -> {} (fixed).
- TEST: FAILED SendMessage (success:false) with a real signal -> drift still DETECTED (capability preserved, not nerfed); cleaned up the test flag.

## Note
This detector file had pre-existing uncommitted edits at session start; my fix is on top, still uncommitted (left out of the two feature commits). Worth committing as its own small accommodation if desired.

## Files
- claude/hooks/api-drift-detector.sh (SendMessage success-skip carve-out)
- .claude/memory/session_2026-06-23_api-drift-sendmessage-false-positive.md (this)
