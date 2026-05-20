---
name: Sending to Claude flash bug investigation
description: Three bugs - Promise.race race, HTTPS server missing WS handler, catch killing the bar - all needed to send to Claude reliably
type: project
relates_to: [session_2026-05-16_claudebar-timeout-retry.md, session_2026-05-19_https-safari-port-detection.md, session_2026-05-19_parallel-port-detection.md]
---

## Symptom (reported by Jonah, 2026-05-19)
Sending via "Send All" on the queue: "Sending to Claude" flashes briefly then disappears. After Fix A+B: bar transitions IMMEDIATELY to "Retry Send" on every send.

## Three separate bugs uncovered

### Bug 1: `Promise.race(attempts)` in transport.tryConnect rejects on first-failed
`core/transport.ts:64`. Race settles on first settle - failed ports reject in ms while winning port needs ~50ms for handshake. Result: connect() rejected even though winner would have succeeded. Orphaned successful attempts still set `this.ws` after-the-fact, causing intermittent "by accident" connectivity.

**Fix A applied**: `Promise.race(attempts)` → `Promise.any(attempts)`. Waits for first FULFILLMENT, ignores rejections.

### Bug 2: HTTPS server (port 9224) had no WebSocketServer attached
`server/ws-server.ts:80-99` (`tryListenHttps`). Created the HTTPS server with `createHttpsServer` but never did `new WebSocketServer({ server: httpsServer })`. WSS upgrade requests fell through to `handleHttpRequest` which returned 404.

External Node test confirmed: `9223 OPEN in 16ms`, `9224 ERR: Unexpected server response: 404`. So on HTTPS pages where browsers refuse `ws://` due to mixed-content blocking, ALL connect attempts failed. Bug 1's "by accident" connectivity was just the leftover orphan attempts on HTTP pages.

**Fix C applied**:
- Added `private attachConnectionHandlerTo(wss: WebSocketServer)` containing the connection-handling logic.
- `attachConnectionHandler()` now calls `attachConnectionHandlerTo(this.wss)`.
- `tryListenHttps` creates `new WebSocketServer({ server: httpsServer })` and calls `attachConnectionHandlerTo(wssSecure)`.
- Both WS instances share the same connection manager, so broadcast works uniformly.

### Bug 3 (symptom hardening): submit catches silently killed the claudebar
**Fix B applied**: On `transport.request("push_prompt")` rejection, catch handlers now call `_claudeToRetry()` instead of `_removeClaudeBar(false)`. Prompt is no longer silently lost; user sees the retry pill.
- `core/index.ts:1248` - Removed `private` from `_claudeToRetry()`.
- 5 catch sites updated (core/index.ts:400, 483; core/prompt/index.ts:626, 645, 669).
- Also added missing `_pendingResponses = 1` initialization in both submitFromQueue branches.

## Deploy & restart sequence
- `npm run deploy` builds only the browser bundle. For server-side changes, must ALSO run `npm run build:server` (compiles TS via tsconfig.server.json) and then re-run `bash deploy.sh` to sync `dist/server/` to `~/.claude/improv/dist/server/`.
- The old server process keeps OLD code in memory. To bring server fixes live without a full Claude Code restart: `kill <pid>`. The MCP harness detects improv disconnected and respawns it from the synced JS on disk. Confirmed working today (PID 25954 killed → MCP respawned as PID 61542 with new code; WSS handshake succeeded on 9224).

## Verification (post-restart, 2026-05-19)
- `9223 (ws): OPEN in 14ms`
- `9224 (wss): OPEN in 6ms` (was 404 before Fix C)
- Browser-side: hard-reload page, Send All - bar should stay up through send/working/review. On failure, bar transitions to clickable Retry Send pill.

## Latent issues NOT fixed this pass
- `transport.ts` never emits a `'connected'` event - toolbar's connection indicator stays stale after reconnect.
- Multiple parallel WS that successfully open each call `this.handshake()` - duplicate handshakes if both HTTP and HTTPS attempts succeed simultaneously (Promise.any prevents this for the connect() return value, but the side-effect of `this.ws = ws` and the handshake() still runs per successful attempt).

## Files touched
- improv/core/transport.ts
- improv/core/index.ts
- improv/core/prompt/index.ts
- improv/server/ws-server.ts

## Commit + push (2026-05-19)
Commit `b72a865` on branch `main`. Pushed to origin via `gh auth git-credential` HTTPS - SSH key (RSA spare3@Yes-JCohen.local) is loaded in ssh-agent but not authorized on GitHub for this account; `gh` CLI HTTPS auth worked. Bundled all accumulated unstaged work from prior sessions into this commit.

## Collaborator
Jonah
