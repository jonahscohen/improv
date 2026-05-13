---
name: Improv uses file-based prompt buffer
description: Prompts stored in ~/.claude/improv/prompts.json instead of in-memory arrays so all MCP server instances share the same queue
type: decision
relates_to: [session_2026-05-13_improv-server-resilience.md, session_2026-05-13_improv-loop-phase1.md]
---

Each Claude Code session spawns its own improv MCP server process (type: stdio). The browser connects to whichever instance grabbed port 9223 via WebSocket. A second session (e.g. Claude Agents) gets its own process on port 9224+. In-memory prompt buffers meant browser prompts went to process A while Claude Agents' watch loop polled process B - they never met.

**Alternatives considered:**
- Shared in-memory state via IPC: complex, fragile across restarts
- Single server with proxy: requires coordination, still has startup race

**Why file-based:** Simple, zero dependencies, survives restarts, any process can read/write. JSON file at a known path. Atomic enough for single-user workstation use.

**Revisit when:** Multiple users on the same machine, or high-frequency prompt submission (file I/O becomes a bottleneck). Neither is likely for a dev tool.
