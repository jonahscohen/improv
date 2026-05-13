---
name: Improv server startup resilience
description: Fixed MCP server crash on EADDRINUSE by adding stale process detection and kill before bind
type: project
relates_to: [session_2026-05-13_improv-loop-phase1.md]
---

**Problem:** MCP server crashes with EADDRINUSE when a stale server process holds port 9223. This happens when:
- A previous server instance wasn't cleanly shut down
- Someone manually ran `node index.js` and forgot to kill it
- Claude Code restarted but the old process lingered

The user hit this trying to demo "improv watch" to their team. The error message gives no guidance and the tool appears broken.

**Root cause:** The installed server dist at `~/.claude/improv/dist/server/` was compiled from stale source that lacked the port-retry logic present in the repo source. Additionally, no mechanism existed to detect and kill stale processes.

**Fix:**
- Added `killStaleProcess(port)` to `server/index.ts`: uses `lsof -ti :PORT` to find PIDs holding the port, kills any that aren't the current process, waits 500ms
- Runs before `wsServer.start()` so the port is always free
- `start()` already retries ports 9223-9232 if the first is still occupied (belt + suspenders)
- Copied all server source to installed location and rebuilt

**Deployment checklist for server changes:**
1. Edit `improv/server/*.ts` in the repo
2. `cp improv/server/*.ts ~/.claude/improv/server/`
3. `cd ~/.claude/improv && npx tsc -p tsconfig.server.json`
4. Restart Claude Code (or `/mcp reset improv`) to reload the MCP server

**Files touched:**
- improv/server/index.ts (added killStaleProcess)
- ~/.claude/improv/server/index.ts (copied)
- ~/.claude/improv/dist/server/index.js (rebuilt)
