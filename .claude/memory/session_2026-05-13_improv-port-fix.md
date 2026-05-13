---
name: improv-persistent-watch
description: HTTP API endpoints + error hardening + file-based polling for MCP-independent improv watch loop; committed to both installed and repo
type: project
relates_to: [session_2026-05-13_improv-server-resilience.md, session_2026-05-13_improv-claude-connection.md, decision_improv_shared_prompt_buffer.md]
---

## Improv server hardening - 2026-05-13

Collaborator: Jonah

**Problem:** Improv MCP server disconnected 3+ times in one session. The server had zero error resilience - any unhandled exception, WebSocket error, or failed send killed the entire Node process.

**Root causes identified (5 vectors):**
1. No `process.on('uncaughtException')` or `process.on('unhandledRejection')` - any unhandled error = process death
2. No `ws.on('error')` on individual WebSocket connections - network hiccup on any browser tab = crash
3. No error handler on WSS or HTTP server after startup - server-level errors fatal
4. `handleHttpRequest` had no try/catch - file read failure during HTTP serve = crash
5. `broadcast()` and `ws.send()` calls not wrapped - writing to closing socket = uncaught throw

**Fix:** Hardened all five vectors across both installed (`~/.claude/improv/dist/server/`) and repo source (`improv/server/`):
- index.js/ts: added uncaughtException + unhandledRejection handlers (log, don't exit)
- ws-server.js/ts: added ws.on('error') per connection, wss.on('error'), httpServer.on('error'), try/catch on all ws.close() and ws.send(), try/catch wrapping handleHttpRequest
- connection-manager.js/ts: try/catch around broadcast sends

**Also this session (port investigation):** Browser settings showing 3901 was toolbar config, not WS port. Port 9223 is correct. Changed all files to 3901 then reverted - no net port changes.

**Note:** Installed files at ~/.claude/improv/dist/ get reverted by external processes (likely another session or linter). HTTP endpoints must be re-added after each revert. The repo source at improv/server/ is canonical.

**Phase 2 - MCP-independent watch loop:**
The MCP stdio pipe drops unpredictably (Claude Code side, not server side). Added HTTP endpoints to the server so the watch loop can run entirely via Bash + curl, bypassing MCP:
- `GET /prompts` - read pending prompts from prompts.json
- `POST /prompts/clear` - clear prompts after reading
- `POST /respond` - broadcast response to browser via WebSocket
- `GET /status` - connection status (already existed)

Watch loop: Bash polls prompts.json or GET /prompts. Respond via POST /respond. No MCP dependency.

### Files touched
- `~/.claude/improv/dist/server/index.js` - process error handlers
- `~/.claude/improv/dist/server/ws-server.js` - error handlers + try/catch + HTTP endpoints (/prompts, /respond, /prompts/clear)
- `~/.claude/improv/dist/server/connection-manager.js` - broadcast try/catch
- `improv/server/index.ts` - same (source)
- `improv/server/ws-server.ts` - same (source, pending HTTP endpoint mirror)
- `improv/server/connection-manager.ts` - same (source)
