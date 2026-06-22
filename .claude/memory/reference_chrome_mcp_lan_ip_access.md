---
name: Chrome MCP can hit this host's dev server via LAN IP when it is a different machine on the same network
description: When the claude-in-chrome browser is a different machine than Claude Code but on the same LAN, localhost:PORT fails (error page) but http://<this-host-LAN-IP>:PORT works because serve.py binds *:PORT. Decisive host test = compare ipinfo.io public IPs.
type: reference
relates_to: [session_2026-06-19_chrome-host-not-claude-code-host.md, reference_browser_validation_tool_precedence.md]
---

Extends [[session_2026-06-19_chrome-host-not-claude-code-host.md]] with the workaround.

Situation (2026-06-22): the claude-in-chrome MCP browser and the Claude Code terminal were BOTH on the same Verizon LAN (public IP 74.96.31.117, Ashburn VA) but were DIFFERENT physical machines. Symptom: navigating Chrome to `http://localhost:4830` "succeeds" per the navigate tool but `computer screenshot` returns "Frame with ID 0 is showing error page", and the tab title is the bare host ("localhost") - Chrome's connection-failed page. localhost is per-machine, so Chrome hit ITS OWN (empty) localhost.

FIX: serve.py binds `*:4830` (all interfaces, confirmed via `lsof -nP -iTCP:4830 -sTCP:LISTEN` showing `TCP *:4830`). So a same-LAN Chrome can reach this host's dev server by its LAN IP instead of localhost:
- Get this host's LAN IP: `ipconfig getifaddr en0` (got 192.168.1.178).
- Navigate Chrome to `http://192.168.1.178:4830/sidecoach.html` -> loads, screenshots work. Verified.

DECISIVE host test (do this when a Chrome screenshot errors on localhost): navigate Chrome to https://ipinfo.io/json + `get_page_text`, and `curl -s https://ipinfo.io/json` on this host. Same public IP = same LAN (LAN-IP trick works). Different public IP = different network (no shared route; fall back to engine-side Playwright on this host).

Validation-layer ladder used this session (per [[reference_browser_validation_tool_precedence.md]]):
1. curl = content only, NOT visual validation (Jonah correction).
2. cmux browser = narrow split pane, unreliable for desktop-width layout (Jonah vetoed).
3. Engine-side Playwright on THIS host = always works (sees localhost directly); used as the reliable secondary. (Throwaway script gotcha: `require('playwright')` resolves from the SCRIPT's dir, not CWD - run the script from inside the project, or set NODE_PATH=<project>/node_modules; hardcoding an absolute node_modules path works but is non-portable.)
4. Chrome MCP = primary once on the same LAN via the LAN-IP trick above.
