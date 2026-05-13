---
name: improv-server-hardening
description: Fixed improv MCP server crashes - added uncaughtException/unhandledRejection handlers, ws.on('error'), try/catch on all sends and HTTP handler
type: project
relates_to: [session_2026-05-13_improv-server-resilience.md, session_2026-05-13_improv-claude-connection.md]
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

### Files touched
- `~/.claude/improv/dist/server/index.js` - process error handlers
- `~/.claude/improv/dist/server/ws-server.js` - error handlers + try/catch hardening
- `~/.claude/improv/dist/server/connection-manager.js` - broadcast try/catch
- `improv/server/index.ts` - same (source)
- `improv/server/ws-server.ts` - same (source)
- `improv/server/connection-manager.ts` - same (source)
