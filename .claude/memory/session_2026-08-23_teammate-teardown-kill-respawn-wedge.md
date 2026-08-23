---
name: Teammate teardown - never kill (respawn wedges the pane); cooperative shutdown only
description: Standing an agent down is not tearing it down; a hard kill respawns the pane WEDGED and unclosable; teardown is cooperative-shutdown-only + verify the pane is gone
type: feedback
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: live (guard refused a live-pane close; kill-respawn observed)
confidence: high
relates_to: [session_2026-08-17_justify-watcher-shutdown-guard.md]
---

Jonah's correction (2026-08-23): "If you have agents you're done with, stand them down AND CLOSE THEIR PANES (cmux). The only one you may never stand down / pane-close on your own is the justify watcher."

WHAT WENT WRONG (self-analysis, both questions):
- WHY it happened: I treated "shutdown_request sent" as "torn down" and never VERIFIED the pane closed. Several agents even approved shutdown yet their process + pane lingered, and I moved on without looking at `cmux list-panels`. Standing down != tearing down; the pane is the other half and I skipped it.
- HOW it got worse: when shutdowns lagged, I reached for `kill -9` by name. A hard kill does NOT close a cmux teammate pane - the teams backend treats the death as a CRASH and RESPAWNS the pane, and the respawned agent comes back WEDGED (stops draining its inbox, so it no longer answers a shutdown_request). So the kill converted two cleanly-finishable agents (miner-design, pipeline-arch) into UNCLOSABLE ones. The cmux-close-guard then (correctly) refused to force-close their live panes - that refusal is the same mechanism that protects the justify watcher, so it is a feature, not an obstacle.

THE RULE (now in claude/CLAUDE.md Teammate Teardown, step 4 reversed):
- Teardown is COOPERATIVE ONLY: shutdown_request -> agent approves + EXITS -> cmux closes its own pane. Give approval a cycle or two; re-send once. VERIFY with `cmux list-panels` that the surface is GONE - teardown is done only when it's gone.
- NEVER `kill` a live teammate. Kill respawns it wedged and unclosable. The prior "if shutdown doesn't take, kill by name" advice was WRONG and is reversed.
- Identify a pane->agent DEFINITIVELY via `cmux list-panels --json` (each surface's resume_binding.command embeds `--agent-id <name>@session-<id>`), never by pane TYPE/elimination (general-purpose is also the justify-watch pane shape; peers' + justify's surfaces share the list and are off limits).
- FORCE-CLOSE (`CMUX_CLOSE_CONFIRM=surface:N cmux close-surface --surface surface:N`, literal, own line) is a rare last resort ONLY for a CONFIRMED-DEAD, positively-identified-as-yours pane. Since kill respawns, a process is normally only truly dead after cooperative shutdown - at which point the pane already closed - so this almost never applies.
- JUSTIFY WATCHER: never stood down or pane-closed without the user's explicit permission (unchanged).
- A wedged agent (already broken by a prior kill) that won't cooperate is a harness wedge: do NOT kill; ask the user to close it from the cmux app.

STATE at write time: two agents (miner-design, pipeline-arch) were wedged by my earlier kill; audit-capture + safe-ingest approved shutdown but lingered live. Fresh cooperative shutdowns re-sent; the durably-fixed protocol above is what governs future deboarding.

Files: claude/CLAUDE.md (Teammate Teardown section rewritten).
