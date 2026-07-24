---
name: api-drift-detector-teammate-mcp-falsepos-2026-07-23
description: Fixed two false-positive classes in claude/hooks/api-drift-detector.sh - named cmux teammate spawns (status teammate_spawned) and content-returning MCP reads (browser console / ClickUp bodies full of "deprecated") - that were tripping the drift Stop-gate
type: project
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

While running a ClickUp task fan-out in the **pidc** project (spawned 4 named cmux diagnosis teammates), the api-drift Stop-gate fired twice on FALSE POSITIVES and blocked the lead from ending its turn. Fixed both durably in the detector. Collaborator: Jonah Cohen. Detector authored against improv HEAD 4d61ba1f.

## What broke (two false-positive classes)
1. **Named teammate spawn.** `Agent` tool result for a visible cmux teammate is `{"status":"teammate_spawned", name/agent_id, "prompt": "<echoed NL prompt>"}`. The prompt echoed a diagnosis brief that legitimately contained the word "deprecated" (describing a WordPress Gutenberg block being deprecated). The detector's Agent success carve-out only recognized ASYNC subagents (`agentId` / `status=="async_launched"` / `isAsync`), NOT the newer named-teammate shape, so the soft-signal scanner matched "deprecated" in the echoed prompt and set `.api-drift-pending`.
2. **Content-returning MCP reads.** A teammate's `mcp__claude-in-chrome__read_console_messages` returned a Google Maps console warning containing "...is deprecated". The detector scans ALL `mcp__*` results (line ~62) for soft prose signals. Browser consoles, page text, network bodies, and ClickUp task descriptions are FULL of words like "deprecated" / "removed", so this is a false-positive factory. Worse: teammate sessions are Stop-exempt but still WRITE the GLOBAL `~/.claude/.api-drift-pending`, so a teammate's content read blocks the LEAD's Stop hook (cross-session contamination).

## Root cause / self-analysis
The detector is a substring scanner over the whole tool-result blob. Its carve-outs were written before (a) named cmux teammates existed as a distinct Agent success shape and (b) heavy MCP content-read usage (Chrome + ClickUp). The soft signals ("deprecated", "has been removed") are inherently ambiguous - they mean drift in a HARNESS contract result but are ordinary vocabulary in external content. The bug was treating one signal class as sufficient for every qualifying tool. Failure mode to catch earlier next time: any signal that is a common English word will false-positive on tools whose results echo prompts or return external content.

## Fix (claude/hooks/api-drift-detector.sh)
- Extended the Agent success carve-out to also skip named-teammate spawns: added `agent_id`, `name`, and `status=="teammate_spawned"` alongside the existing `agentId`/`async_launched`/`isAsync`.
- Split the signal set into HARD vs SOFT:
  - **HARD** (harness-generated contract failures - always drift for any tool): `unknown parameter/argument/option/field`, `unexpected keyword`, `InputValidationError`, `should have been initialized`, `not a valid tool`, `is not a recognized`, `no such tool`.
  - **SOFT** (prose that also appears in content - trusted ONLY for non-MCP contract tools): `deprecated`, `no longer supported/available/exists`, `has been removed`, `was removed`.
  - `is_mcp = tool.startswith("mcp__")`; MCP tools are scanned for HARD only, non-MCP contract tools (Agent/Workflow/SendMessage/ToolSearch/Task/Cron) for HARD+SOFT (they keep their existing success carve-outs). Genuine MCP drift is a HARD harness error, not page text, so nothing real is lost.

## Verification
- 11-case regression matrix, all PASS: both false positives now SKIP; genuine drift still FIRES for MCP `unknown parameter` / `no such tool`, Agent `InputValidationError`, SendMessage failed send, Workflow/ToolSearch soft signals; SendMessage/Agent success carve-outs still skip. Command pattern: pipe crafted `{tool_name, tool_response}` JSON into `bash ~/.claude/hooks/api-drift-detector.sh`, assert `{}` (skip) vs `API DRIFT DETECTED` (fire).
- Pending flag cleared (editing a `/claude/hooks/` file is itself the clear-on-accommodate path; also logs an ACCOMMODATED line).
- Live immediately via the `~/.claude/hooks/` symlink - no restart needed.

## Not done / follow-ups
- The cross-session pending-flag contamination (teammate writes global flag that blocks the lead) is MITIGATED (teammate content reads no longer soft-trip) but not structurally solved - a teammate hitting a HARD signal would still set the lead's global flag. Consider session-scoping the pending flag if this recurs.
- Files touched: claude/hooks/api-drift-detector.sh (only).
