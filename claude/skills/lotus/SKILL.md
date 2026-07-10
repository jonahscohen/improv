---
name: lotus
description: Connect Lotus (Jonah's AI Figma plugin, formerly Chiaroscuro) to Claude Code and get it driving Figma. /lotus opens Figma, confirms the Lotus MCP bridge (port 9527) is up, walks the one-time plugin connect, and verifies with a live tool call. Also triggers on "start lotus", "launch lotus", "connect lotus", "open lotus", "fire up lotus", "lotus".
---

# Lotus (/lotus)

Lotus is Jonah's AI Figma plugin, vendored into this dotfiles repo at `__LOTUS_SRC__` (renamed from Chiaroscuro). It has an MCP bridge: a single server process exposes MCP tools over **stdio** (to Claude Code) AND an **HTTP bridge on port 9527** (to the Lotus plugin running inside Figma, which long-polls it via fetch). A Lotus tool call proxies through the bridge into Figma. `/lotus` gets that connection live so I can create / modify / inspect Figma designs directly (e.g. rebuild a vector with real bezier handles, then export the path back out).

## Architecture (why the steps are what they are)
- The Lotus MCP server is registered in **`~/.claude.json`** (global `mcpServers`): `lotus -> node __LOTUS_SRC__/mcp-server/dist/server.js`. Claude Code SPAWNS it at session start; on spawn it opens BOTH the stdio MCP transport (for me) and the HTTP bridge on 9527 (for the plugin). So the server + bridge are already up in any session where the lotus MCP loaded - there is no separate "start the server" step.
- The Lotus plugin (inside Figma) connects to `http://localhost:9527` (HTTP long-poll: GET /poll, POST /respond, GET /status). Once connected, my Lotus tool calls reach Figma.
- PORT CONTENTION IS NON-FATAL (fixed 2026-06-29): if 9527 is already held - a stale orphan bridge from an ungracefully-closed prior session, or a second concurrent Claude session - the new MCP server no longer crashes on `EADDRINUSE`. It falls back to PROXY mode and forwards tool calls to the bridge that owns the port (via POST /exec). Previously the unhandled bind error killed the whole stdio transport and lotus showed up "disconnected". If a stale orphan (old code) is holding the port, free it so a fresh session owns a clean bridge: `lsof -nP -iTCP:9527 -sTCP:LISTEN` then `kill <pid>`.
- KEY: MCP servers load at SESSION START. If `mcp__lotus__*` tools are NOT present in this session, lotus was registered after the session began -> the user must restart Claude Code ONCE. After that, /lotus is a one-liner each session.

## Steps when /lotus is invoked
1. **Check the tools are loaded.** Look for `mcp__lotus__*` (ToolSearch "lotus").
   - If NONE: the lotus MCP is registered in `~/.claude.json` but MCP servers load at startup, so it is not in this session. Tell the user to **restart Claude Code once**, then run `/lotus` again. STOP here.
   - If present: continue.
2. **Ensure the build exists.** Check `__LOTUS_SRC__/mcp-server/dist/server.js` and `__LOTUS_SRC__/dist/code.js`. If either is missing: `cd __LOTUS_SRC__ && npm run build && (cd mcp-server && npm run build)` (or re-run `bash __LOTUS_SRC__/install.sh`).
3. **Open Figma:** `open -a Figma`. Then tell the user: in Figma, run the **Lotus** plugin (Plugins -> Development -> Lotus; first time only: *Import plugin from manifest...* -> `__LOTUS_SRC__/manifest.json`), and Settings -> **MCP Bridge** -> port **9527** -> **Connect** (it auto-connects when the server is detected).
4. **Verify the connection** with one lightweight Lotus tool call: `mcp__lotus__get_page_structure` (or `get_selection_context`).
   - Returns Figma data -> CONNECTED. Report: "Lotus is connected - I can create / modify / inspect your Figma file now." Then proceed with the user's actual request.
   - Errors / times out -> the plugin is not connected to the bridge yet. Ask the user to open the Lotus plugin in Figma and click Connect (Settings -> MCP Bridge, port 9527), then re-run the verify.

## Notes
- Lotus is an official dotfiles component: install/reinstall it with `./install.sh --only lotus` (builds the plugin + mcp-server in place and registers the MCP server in `~/.claude.json`).
- The MCP server is registered in **`~/.claude.json`**, NOT `claude/settings.json` - this Claude Code version does not reliably read MCP server definitions from settings.json (it never spawned a process/port/log across 3 restarts when lotus lived there). The single authoritative registration is `~/.claude.json`.
- The `claude mcp` CLI is BROKEN in the cmux shell (`_claude_inside_cmux: command not found`). Never use it. Register/inspect MCP servers by editing `~/.claude.json` directly.
- Default bridge port is 9527 (override with `LOTUS_PORT`); the plugin's MCP Bridge port must match.
- Useful Lotus tools: `create_svg_node`, `modify_node`, `set_fill` / `set_stroke` / `set_effects`, `get_page_structure`, `get_selection_context`, `screenshot_node`, `export_as_svg`. Use `export_as_svg` to pull a cleaned vector path back out to a file.
