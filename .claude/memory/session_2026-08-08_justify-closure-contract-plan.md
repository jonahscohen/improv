---
name: Justify closure-contract plan authored (report findings verified + two corrected)
description: The JUSTIFY-SESSION-FINDINGS-2026-08-08 report (from a ppai session) was verified against the live justify/server code before planning. Its two HIGH findings were substantially WRONG - both respond paths already flip the browser, and claim is already atomic/durable/TTL-recoverable, not destructive. Authored a 3-task server-side plan for the real gaps at docs/superpowers/plans/2026-08-08-justify-closure-contract.md (stamped a2e768d5). NOT executed yet.
type: project
relates_to: [reference_browser_change_dependency_chain.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: code-read (ws-server.ts respond/claim/status handlers, mcp-tools.ts, dispatcher.ts)
confidence: high
---

Collaborator: Jonah. Task: "review new reports in the project dir and address issues." The new report was JUSTIFY-SESSION-FINDINGS-2026-08-08.md at the improv repo root (written in a ppai session, about the Justify PROGRAM which lives in improv/justify).

## The framing (Jonah's, replacing the report's)
Jonah rejected the report's "add recovery to a stuck spinner" framing. Governing framing = TWO challenges:
1. CONTRACT: the moment justify-watch claims a task from the browser it is bound to (a) do the work and (b) keep the browser updated to a terminal, user-readable outcome. The obligation OUTLIVES the watcher - if it dies, the task still goes back to the user with feedback. A silent "Working" forever is a broken contract.
2. INTERRUPTIBLE: the watch must run as a BACKGROUND process of the dispatched agent (cmux agents can't spawn panes but can run background jobs) so the agent stays reachable by the boss/manager/other agents mid-watch.
Plus 6 sub-challenges I surfaced and Jonah accepted ("you got it").

## VERIFICATION beat the report against the code (the important part)
Before planning I read the live handlers. The report's two HIGH findings do NOT match improv HEAD a2e768d5:
- F1 ("MCP justify_respond does NOT flip the browser, only HTTP /respond does") = WRONG. mcp-tools.ts:588 AND ws-server.ts:494 BOTH `broadcastToClients('justify_response', ...)`. The REAL gap: the MCP path is impoverished - no headless persistence (HTTP persists to responses.json when `manager.size()===0`, ws-server.ts:502-503), no `targetSelectors` join, no `diffs`. So a headless MCP respond is LOST -> that is the actual stuck-Working cause, not "doesn't flip."
- F2 ("claim removes the prompt, no longer re-claimable, no recovery") = WRONG. claim stamps claimedBy/claimedAt and writes the WHOLE array via tmp+rename (atomic+durable, ws-server.ts:1116-1122); re-claimable after JUSTIFY_CLAIM_TTL_MS (default 30 min, line 1090). The REAL gap: 30 min is far too long and recovery is passive (TTL steal), never a user-facing "here's your task back."
- F3 ("/status can't detect a stuck browser") = HOLDS. /status (1157-1187) has no in-flight/claimed field.
This validated Jonah's instinct ("if that's what the reports said, that's wrong") and the verify-before-planning discipline. Prereq #3 from my own list (atomic claim) was ALSO already done - dropped.

## The plan (authored, NOT executed)
docs/superpowers/plans/2026-08-08-justify-closure-contract.md, stamped a2e768d5, scoped to Challenge 1 server-side (3 sequential tasks, all in ws-server.ts which solely owns respond/prompt state):
- Task 1: extract one public `emitResponse` helper (enrich + broadcast + persist-when-headless + stamp the prompt `respondedAt`); route BOTH HTTP /respond and MCP justify_respond through it. Fixes the real prereq #1.
- Task 2: short-timeout daemon sweep (JUSTIFY_INFLIGHT_TIMEOUT_MS default 90s, << the 30-min claim TTL) that auto-returns a claimed-but-unresponded prompt via emitResponse(status:failed, "worker stopped, retry"), stamping respondedAt so it returns once. The daemon (outlives the agent) is the closure backstop.
- Task 3: add `inFlight` (claimed && !responded) list to /status.
Verification gate: vitest green + tsc + independent cross-model review; do NOT redeploy the live daemon.

## Deferred
Challenge 2 (interruptible background watcher, progress heartbeat, disarm-owes-closure) = a SEPARATE second plan against the skill + CLI (different subsystem), not this one.

## Files
- docs/superpowers/plans/2026-08-08-justify-closure-contract.md (new)
- this beat + MEMORY.md pointer
