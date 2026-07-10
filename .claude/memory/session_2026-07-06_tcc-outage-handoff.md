---
name: TCC outage handoff - beats backlog dispatch interrupted, restart chosen
description: macOS revoked Documents access for the whole app tree mid-session right as three Opus executors spawned for T-0044/45/46; all reads under ~/Documents EPERM while new-file writes still worked; Jonah chose stop-and-restart over re-granting live; this beat is the cross-restart continuity note - the three units are specced, dispatched, and UNSTARTED
type: project
relates_to: [session_2026-07-06_beats-backlog-dispatch.md, feedback_surface_backlog_on_completion.md]
---

Collaborator: Jonah. 2026-07-06, written DURING the outage (new-file writes worked; reads did not).

## What happened
- Three Opus executors (beats-prov T-0044, beats-reflect T-0045, beats-mcp T-0046) spawned; at that moment macOS TCC revoked Documents-folder access for the entire app process tree. Read matrix (beats-prov forensics + lead confirmation): stat OK, open EPERM on every pre-existing file, directory enumeration denied under ~/Documents, NEW-file writes OK, self-created reads OK, dangerouslyDisableSandbox inert (host-level denial, not tool sandboxing). ~/.claude/CLAUDE.md failures were symlink resolution into ~/Documents.
- All three executors halted CLEANLY: zero writes, zero workarounds, units intact and unstarted. Jonah chose stop-and-restart of the host app rather than live re-grant. Durable prevention recommended to him: Full Disk Access for cmux in System Settings Privacy and Security.

## FOR THE NEXT SESSION - resume checklist
1. Verify reads work (head TASKS.md). If EPERM persists after restart, the TCC grant itself is still missing - Full Disk Access for the hosting app, then relaunch again.
2. Add the two MISSING MEMORY.md index pointers (writes were blocked mid-update): feedback_surface_backlog_on_completion.md and session_2026-07-06_beats-backlog-dispatch.md. This handoff beat needs its pointer too.
3. RE-DISPATCH the three units - the old executor processes died with the restart. Full specs live in session_2026-07-06_beats-backlog-dispatch.md (ownership matrix, gates, ratified constraints). Key constraints to preserve verbatim: provenance validator WARNS never blocks (Plan B); scheduled reflect respects REFLECT_THRESHOLD both directions (skip below threshold, touch ~/.claude/last-reflect-timestamp on success only); MCP surface read-only, beats.py treated as frozen interface by the MCP unit (only beats-prov edits beats.py).
4. Lead retains: install.sh wiring, launchctl load decision, TASKS.md closure (T-0044/45/46), all .claude/memory writes.
5. Context: Jonah's standing directive for this workstream - "finish the beats stuff, all of it, use Opus agents and remain the orchestrator."

Files touched: this beat only (index pointer pending per item 2).
