---
name: API-drift guard's first live fire was a false positive on Read - accommodated (allowlist scope)
description: The new api-drift-detector fired when I Read a beat that QUOTES the old cmux error ("should have been initialized"). Content/search tools (Read/Grep/Bash/web) return arbitrary text, so detection is now restricted to actual tool-API calls (Agent/Workflow/SendMessage/ToolSearch/Task*/Cron*/mcp__*). The flag self-cleared on the hook edit.
type: project
relates_to: [session_2026-06-22_api-drift-guard.md]
---

Collaborator: Jonah Cohen

First live fire of the api-drift-detector ([[session_2026-06-22_api-drift-guard.md]]), same session it shipped: I ran `Read` on session_2026-06-22_sidecoach-reference-integration-deploy.md, which QUOTES the cmux-teams error "should have been initialized at startup." The detector matched that signature in the Read result and raised the pending flag. False positive - the phrase was documentation of a PAST drift, not a live tool-contract error.

Root cause: the detector scanned every non-Bash tool result. But content/search/web tools (Read, Grep, Glob, WebFetch, Skill, ...) return arbitrary data that legitimately contains "deprecated" / "removed" / "should have been initialized" (beats, docs, source). Scanning them is a false-positive factory.

Accommodation (the system working as designed - it surfaced its own flaw and I fixed the mechanism rather than dismissing): changed the DETECT scope from a Bash denylist to an ALLOWLIST of tools whose results are actual tool/harness contracts:
`re.match(r"^(Agent|Workflow|SendMessage|ToolSearch|Task|Cron|mcp__)", tool)`.
Everything else is skipped. Editing the hook (a `/claude/hooks/` file) triggered the detector's own clear-on-accommodate path, so the pending flag cleared automatically - no manual dismiss needed.

Verification: 11/11 isolated tests, now including the false-positive cases - Read/Grep/WebFetch with drift-text -> NO pending; Agent/mcp__/Task* drift -> pending; accommodate/stop/ack unchanged. `bash -n` clean. Real pending flag confirmed cleared.

Lesson logged for the guard: a detector that scans content tools erodes its own trust (becomes noise to ignore - the exact failure mode the hardening exists to prevent). Drift lives in tool-API results, not in data the tools return.

## Files
- claude/hooks/api-drift-detector.sh (DETECT scope -> allowlist)
