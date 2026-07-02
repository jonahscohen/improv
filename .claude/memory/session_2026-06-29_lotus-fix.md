---
name: Lotus MCP bridge EADDRINUSE crash fix (port-contention -> proxy mode + reacquire)
description: Lotus showed "MCP server disconnected" because a stale orphan bridge held port 9527 and the new spawn crashed on an unhandled EADDRINUSE; fixed durably with graceful bind-failure handling, proxy-mode fallback, owner-reacquire, and shape-validated forwarding. Plus stale skill path + WebSocket->HTTP doc corrections.
type: project
---

# Lotus fix - 2026-06-29 (Jonah)

## Symptom
Harness reported `mcp__lotus__* MCP server disconnected` at session start. `/lotus` could not drive Figma.

## Root cause (reproduced before theorizing)
Two coupled defects:

1. **The real bug - unhandled bind error crashes the whole MCP process.** `mcp-server/src/bridge.ts` did `this.server.listen(port)` with **no `'error'` handler**, and `FigmaBridge` is constructed *synchronously* at server startup (`server.js` line 8, before `main()`). When port 9527 was already held, `listen` emitted an unhandled `EADDRINUSE` `'error'` event -> Node threw `Unhandled 'error' event` -> `process.exit(1)`. The crash killed the stdio MCP transport, so the server showed up "disconnected." Reproduced directly: spawning `dist/server.js` while the port was held printed `[lotus-mcp] MCP server started` then the full `Error: listen EADDRINUSE :::9527` throw stack and `Node.js v20.19.6` exit.

2. **What was holding the port - a stale orphan bridge.** PID 53279 (`node .../improv/lotus/mcp-server/dist/server.js`), started **Sun Jun 28 22:16** by *last night's* cmux Claude session (53182), was still listening on 9527. Every new session's lotus spawn then hit EADDRINUSE and crashed. (When did it last work: before that orphan existed / when only one session ran. First fail: any new session started while 53279 lived.)

## The durable fix (`mcp-server/src/bridge.ts`)
Make port contention **non-fatal and self-healing** instead of crashing:

- **Graceful bind failure:** attach a permanent `server.on('error')`. On `EADDRINUSE`, drop to **PROXY mode** instead of crashing; on any other error, log it.
- **Proxy mode (`forwardToOwner`):** when this process doesn't own the port, forward each tool message to the owning bridge's existing `POST /exec` endpoint and relay `{success,data,error}`. Keeps tool calls working across concurrent Claude sessions (cmux teams) and stale-orphan situations instead of dead-ending with "not connected."
- **Reacquire (`reacquire`):** if a proxied request fails with `ECONNREFUSED`/`ECONNRESET` (owner died), attempt to re-bind the freed port and promote to owner so future calls are served locally. Guarded against overlap (`reacquiring`) and post-shutdown (`closed`).
- **Single `'listening'` handler:** owner-promotion logic lives in one persistent `server.on('listening')` listener; `startListening()` calls `listen()` with **no** callback. (Passing a callback re-registers it every bind attempt, including the failed initial one whose callback lingered and then double-fired on reacquire.)
- **Leak-safe shutdown:** `close()` now sets a `closed` flag and **always** calls `server.close()` (was guarded to owner-mode only). The `'listening'` handler tears the server back down if it fires after close, so an in-flight reacquire mid-shutdown cannot leak a live server + watchdog. Double-close is safe.

Also corrected a misleading log: `server.ts` `"WebSocket port"` -> `"HTTP bridge port"` (the bridge is HTTP long-poll: `/poll`, `/respond`, `/status`, `/exec` - the plugin's `McpBridgeClient` uses `fetch(http://localhost:9527/...)`, confirmed in `src/ui/lib/mcp-bridge.ts`; there is no WebSocket server anywhere).

### Why proxy-mode over the alternatives
- *Crash-guard only (log and continue):* rejected - a second session would then own no bridge and every tool call dead-ends "not connected" forever. Bad in the cmux-teams setup Jonah runs.
- *Kill the stale process automatically on EADDRINUSE:* rejected - cannot safely distinguish "stale orphan" from "legitimate concurrent session" from a bare port holder; killing arbitrary processes is dangerous.
- *Proxy + reacquire (chosen):* survives stale orphans AND concurrent sessions, self-heals when the owner dies, never kills anyone. Revisit if Lotus ever moves to a true singleton-daemon model (then a different ownership protocol may be simpler).

## Skill / path corrections
- The **installed** skill `~/.claude/skills/lotus/SKILL.md` had a stale hard-coded path `/Users/spare3/Documents/Github/claude-dotfiles/lotus` - the dotfiles repo is now `improv`, not `claude-dotfiles`. The source skill correctly uses the `__LOTUS_SRC__` placeholder; `install.sh` bakes the real path. Regenerated the installed skill via the same `cp` + `sed` install.sh uses -> now points at `/Users/spare3/Documents/Github/improv/lotus`. (The MCP registration in `~/.claude.json` was already correct: `.../improv/lotus/mcp-server/dist/server.js`, exists.)
- Fixed the source skill's `WebSocket`/`ws://` wording -> `HTTP`/`http://` and added a "port contention is non-fatal" troubleshooting note.

## Verification evidence (all from this terminal, no Figma needed)
Reproduced the crash, then after the fix:
- **Build:** `tsc` exit 0, strict mode, both `improv/lotus` and standalone `Github/lotus` copies (byte-identical src).
- **In-process suite (7/7):** owner serves `/status`; owner `request()` -> "plugin not connected"; proxy `isConnected=false`; proxy relays owner error via `/exec`; proxy reclaims a freed port; reacquired instance serves as owner; non-Lotus JSON on the port -> "Unexpected response" (shape validation).
- **Leak suite (deterministic, 3/3):** `close()` while still in proxy mode blocks the deferred reacquire (no leaked listener, no "attempting to reclaim" log); owner listening before close; owner `close()` tears down. Double-close safe.
- **Process-level (real `server.js`, 2 spawns on 9527):** owner + proxy node procs coexist; crash-signature count = 0 in both logs; `/status` = `{status:ok}`; `/exec` tool call returns the proper "plugin not connected"; port left free afterward.
- **Codex cross-model review (2 completed passes):** pass 1 flagged permanent-proxy + unvalidated-response -> both folded (reacquire + shape validation). Pass 2 flagged the proxy-mode `close()` leak -> folded (`closed` flag + unconditional `server.close()`) and verified with the deterministic leak test. A 3rd confirmation pass timed out during file exploration (no new finding); gate already satisfied by the two completed passes.

## State left for Jonah
- Stale orphan PID 53279 **killed**; port 9527 **free**; no stray `server.js` procs. Next Claude Code restart will cleanly own a fresh bridge running the fixed code.

## Human-in-the-loop steps still required (cannot be done from a terminal)
1. **Restart Claude Code once** - MCP servers load at session start; this session's lotus MCP already crashed and will not respawn until restart. After restart, `mcp__lotus__*` tools load from the fixed build.
2. **In Figma (desktop app):** run the Lotus plugin (Plugins -> Development -> Lotus; first time: Import plugin from manifest -> `improv/lotus/manifest.json`), then Settings -> MCP Bridge -> port 9527 -> Connect.
3. Then a live `mcp__lotus__get_page_structure` will return real Figma data, confirming the full path. Everything up to the Figma click is verified.

## Files touched
- `lotus/mcp-server/src/bridge.ts` (the fix) + rebuilt `dist/`
- `lotus/mcp-server/src/server.ts` (log wording) + rebuilt `dist/`
- `claude/skills/lotus/SKILL.md` (source: WebSocket->HTTP, port-contention note)
- `~/.claude/skills/lotus/SKILL.md` (regenerated installed copy, correct path)
- Mirrored bridge.ts + server.ts to standalone `Github/lotus/mcp-server/src` (upstream `raiderforge/chiaroscuro`, byte-identical) + rebuilt its dist
