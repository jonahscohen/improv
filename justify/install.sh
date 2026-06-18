#!/bin/bash
set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"
JUSTIFY_DIR="${CLAUDE_DIR}/justify"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Justify..."

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required. Install it first."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is required. Install it first."
  exit 1
fi

# Create directories
mkdir -p "$JUSTIFY_DIR"

# Copy all source files preserving structure
cp -r "$SCRIPT_DIR/server" "$JUSTIFY_DIR/"
cp -r "$SCRIPT_DIR/core" "$JUSTIFY_DIR/"
cp -r "$SCRIPT_DIR/adapters" "$JUSTIFY_DIR/"
# assets/ holds the Claudebar sprite sheets (build.js copies spark-*.svg into
# dist/, served at /spark-<name>.svg). fonts/ is served by the daemon from the
# install root at /fonts/<name>. Without these the status icon 404s (blank) and
# the toolbar font silently falls back to system-ui.
cp -r "$SCRIPT_DIR/assets" "$JUSTIFY_DIR/"
[ -d "$SCRIPT_DIR/fonts" ] && cp -r "$SCRIPT_DIR/fonts" "$JUSTIFY_DIR/"
cp "$SCRIPT_DIR/package.json" "$JUSTIFY_DIR/"
cp "$SCRIPT_DIR/tsconfig.json" "$JUSTIFY_DIR/"
cp "$SCRIPT_DIR/tsconfig.server.json" "$JUSTIFY_DIR/"
cp "$SCRIPT_DIR/tsconfig.core.json" "$JUSTIFY_DIR/"
cp "$SCRIPT_DIR/build.js" "$JUSTIFY_DIR/"

# Install dependencies (needs devDeps for typescript + esbuild build step)
echo "Installing dependencies..."
(cd "$JUSTIFY_DIR" && npm install 2>/dev/null) || {
  echo "WARNING: npm install failed. Run manually: cd $JUSTIFY_DIR && npm install"
}

# Build core script
echo "Building core script..."
(cd "$JUSTIFY_DIR" && node build.js 2>/dev/null) || {
  echo "WARNING: Build failed. Run manually: cd $JUSTIFY_DIR && node build.js"
}

# Build server
echo "Building server..."
(cd "$JUSTIFY_DIR" && npx -y tsc -p tsconfig.server.json 2>/dev/null) || {
  echo "WARNING: Server build failed. Run manually: cd $JUSTIFY_DIR && npx tsc -p tsconfig.server.json"
}

# Install CLI tools
echo "Installing CLI tools..."
cp "$SCRIPT_DIR/cli/init.sh" "$JUSTIFY_DIR/init.sh"
cp "$SCRIPT_DIR/cli/remove.sh" "$JUSTIFY_DIR/remove.sh"
cp "$SCRIPT_DIR/cli/justify-watch.sh" "$JUSTIFY_DIR/justify-watch.sh"
cp "$SCRIPT_DIR/cli/justify-done.sh" "$JUSTIFY_DIR/justify-done.sh"
chmod +x "$JUSTIFY_DIR/init.sh" "$JUSTIFY_DIR/remove.sh" "$JUSTIFY_DIR/justify-watch.sh" "$JUSTIFY_DIR/justify-done.sh"

# Put commands in PATH - try /usr/local/bin first, then homebrew, then ~/.local/bin
BIN_DIR=""
for d in /usr/local/bin /opt/homebrew/bin "${HOME}/.local/bin"; do
  if [ -d "$d" ] && [ -w "$d" ]; then
    BIN_DIR="$d"
    break
  fi
done
if [ -z "$BIN_DIR" ]; then
  mkdir -p "${HOME}/.local/bin"
  BIN_DIR="${HOME}/.local/bin"
fi
ln -sf "$JUSTIFY_DIR/init.sh" "$BIN_DIR/justify-init"
ln -sf "$JUSTIFY_DIR/remove.sh" "$BIN_DIR/justify-remove"
ln -sf "$JUSTIFY_DIR/justify-watch.sh" "$BIN_DIR/justify-watch"
ln -sf "$JUSTIFY_DIR/justify-done.sh" "$BIN_DIR/justify-done"
echo "Installed justify-init, justify-remove, justify-watch, justify-done to $BIN_DIR"

# Register MCP server in ~/.claude.json
python3 -c "
import json, os
p = os.path.expanduser('~/.claude.json')
if not os.path.exists(p):
    d = {}
else:
    d = json.load(open(p))
if 'mcpServers' not in d:
    d['mcpServers'] = {}
d['mcpServers']['justify'] = {
    'type': 'stdio',
    'command': 'node',
    'args': [os.path.expanduser('~/.claude/justify/dist/server/index.js')]
}
json.dump(d, open(p, 'w'), indent=2)
print('MCP server registered in ~/.claude.json')
"

# Install skill
SKILL_DIR="${CLAUDE_DIR}/skills/justify"
mkdir -p "$SKILL_DIR"

cat > "$SKILL_DIR/SKILL.md" << 'SKILLEOF'
---
name: justify
description: Start and run Justify, the in-browser micro-adjustment tool. Invoke with /justify to bootstrap everything in the project the session is open in - bring up the Justify server, inject justify-core into the running site, trust the self-signed cert, activate the toolbar, and verify it live in the browser, self-healing past any failure. Also triggers on "start justify", "launch justify", "wire up justify", "fire up justify". Once running, this is the reference for Justify's modes and MCP tools.
---

# Justify

Justify is a live in-browser design tool: visually tweak a running page, hand the changes back to Claude as structured diffs over a WebSocket. `/justify` is the single command that gets it running in whatever project the session is open in.

It runs entirely in THIS session: the Claude session that runs `/justify` owns the Justify connection and applies the changes - there is no separate launcher, daemon, or operative. A teammate just runs `/justify` in the Claude of their project directory and Justify starts working. The only one-time prerequisites per machine are that Justify is installed (its MCP server registered) and the session was started after that - both true for any normal install; the steps below detect and fix the cold-start cases.

The source lives at `__JUSTIFY_SRC__` (the dotfiles `justify/` dir); the installed runtime lives at `~/.claude/justify/`.

## /justify - bootstrap everything (self-healing)

When the user runs `/justify` (or asks to start / launch / wire up / fire up Justify), run this sequence against the CURRENT project. Do NOT stop at the first failure: diagnose, fix, and retry until Justify is verified live - a connected tab in `justify_status` AND the toolbar visible in a browser screenshot. Report success only when both are true. If a step genuinely needs the user (a session restart or a sudo), say exactly what to do, then continue once they confirm.

### Step 1 - Server up (and installed)
The Justify server runs as the `justify` MCP server (`node ~/.claude/justify/dist/server/index.js`, registered in `~/.claude.json`). When connected it listens on **9223** (ws+http) and **9224** (https, serving `justify-core.js`).
- Probe: load the `justify_status` MCP tool (ToolSearch "justify_status") and call it; and `curl -sk https://localhost:9224/justify-core.js | head -c 80` should return JS.
- If the `justify_*` tools are MISSING, the MCP server is not connected this session:
  - If `~/.claude/justify/dist/server/index.js` does not exist, Justify is not installed -> run `bash __JUSTIFY_SRC__/install.sh` (builds the server + core, registers the MCP server, installs `justify-init`).
  - Then the session MUST be restarted for the MCP server to attach (MCP servers only connect at session start - there is no mid-session workaround). Tell the user to restart, then re-run `/justify`.
  - Note: a legacy `improv` MCP server may also be registered (the pre-rename install). It binds the same 9223 and will fight `justify`. If present, recommend retiring it (unregister `improv` from `~/.claude.json` mcpServers); do not delete its files without asking.
- If the tools exist but `curl` to 9224 fails, the HTTPS listener did not start -> rebuild via `install.sh`; confirm `justify` (not `improv`) is the live MCP server.

### Step 2 - Trust the cert (once per machine)
9224 uses a self-signed cert at `~/.claude/justify/dist/server/certs/cert.pem`. Until trusted, browsers block `justify-core` as untrusted / mixed-content on https pages.
- If `curl -sk` works but the browser will not load the script: run `bash __JUSTIFY_SRC__/setup-cert.sh` once (sudo; adds the cert to the macOS System Keychain), or open `https://localhost:9224/justify-core.js` in the browser and accept the cert. The cert only exists after the server has started at least once.

### Step 3 - Inject justify-core into the project
From the project, run `justify-init <project-root>` (or `bash __JUSTIFY_SRC__/cli/init.sh <project-root>`). It detects the stack and wires the `https://localhost:9224/justify-core.js` tag:
- WordPress: sets `WP_DEBUG=true` in `wp-config.php` and adds a `WP_DEBUG`-gated `wp_enqueue_script('justify-dev', ...)` to the active (non-`twenty*`) theme's `functions.php`.
- Vite / Next / Drupal / generic: edits `index.html` / the layout / theme libraries.
It is idempotent (grep-guarded). If it prints a WARNING that it could not find the wiring point, do that wiring manually per its printed instruction.

### Step 4 - Site running
The project's own dev server must be up. For a Lando WordPress site: `lando start` -> the `*.lndo.site` URL. Confirm with `curl`, and that the SERVED html now contains the script: `curl -sk <url> | grep justify-core`.

### Step 5 - Load, activate, VERIFY
- Open the site in the browser (chrome MCP or cmux). Hard-reload so the injected script loads.
- Call `justify_activate` (preferred - no keyboard needed) to show the toolbar. Keyboard fallback: `cmd+shift+.`.
- VERIFY both: `justify_status` shows >=1 connected tab at the site URL, AND a screenshot shows the Justify toolbar. Read the screenshot and describe it.
- If the tab is NOT connected, the core did not load. Re-check in order: cert trusted (step 2); the script tag is in the SERVED html (curl + grep, not the source - check `WP_DEBUG` is true and the right theme); a hard reload (cache). Fix and retry from the failing point.

### Step 6 - Listen (the active loop: HTTP polling, NOT the MCP watch)
This session is the live operative - there is no separate process. The reliable listen loop is HTTP polling against the local server, NOT the MCP `justify_watch` tool. Per `decision_improv_http_polling_watch`, the MCP long-poll disconnects unreliably and silently drops prompts; `curl` against localhost never does. (`justify_watch` also just returns `idle` immediately when empty - it is not a real block.) Loop, and stay in it:

1. POLL (blocking until a prompt arrives, or `IDLE` after ~60s so you stay responsive - then immediately re-run it):
   ```bash
   for i in $(seq 1 30); do P=$(curl -s http://localhost:9223/prompts); [ "$P" != "[]" ] && [ -n "$P" ] && { printf '%s' "$P"; exit 0; }; sleep 2; done; echo IDLE
   ```
   Each prompt is `{id, context, prompt, elementCount, timestamp}`.
2. APPLY: for each prompt, make the user's intended change in this project's source files.
3. RESPOND - this is what fills the bottom-left **Changes** panel and flips the claudebar to "Review":
   ```bash
   curl -s -X POST http://localhost:9223/respond -H 'Content-Type: application/json' \
     -d '{"promptId":"<id>","summary":"<what changed>","filesChanged":["<file>"],"changes":[{"selector":"<sel>","property":"<prop>","oldValue":"<old>","newValue":"<new>"}],"status":"completed"}'
   ```
4. CLEAR: `curl -s -X POST http://localhost:9223/prompts/clear`
5. Re-run the poll. Keep looping until the user says stop. Tell the user once: "Justify is live - tweak or prompt in the browser and I'll apply it; results show in the bottom-left Changes panel."

The bottom-left tray (queuebar + claudebar pills + Changes panel, per `decision_improv_claudebar_architecture`) is driven by this loop: a prompt fires `justify_working` (claudebar "Working") and your `/respond` fires `justify_response` (claudebar "Review", Changes panel fills). If the bottom-left stays empty, the loop is not running or `/respond` was never POSTed - fix the loop; do not blame the panel.

### Self-heal quick map
- `justify_*` tools missing -> not installed / not connected: `install.sh` + restart session (retire legacy `improv` if present).
- `curl :9224` fails -> server/https down: rebuild (`install.sh`); confirm `justify` is the live MCP server.
- page loads, no connection -> cert untrusted (`setup-cert.sh`) OR tag missing from served html (re-init / `WP_DEBUG` / theme) OR cached (hard reload).
- connected but no toolbar -> call `justify_activate`; check the page console for errors.

## Usage once running

Activate per tab with `justify_activate` (or `cmd+shift+.`). Two modes:
- **Manipulate** - click an element, scrub a CSS property in the panel (mouse left/right = decrease/increase); changes buffer server-side until `justify_apply_changes`.
- **Prompt** (`p`) - click an element, type an instruction inline ("make this button more rounded"); sent to Claude with the selector + computed styles.

### MCP tools (11)
`justify_activate`, `justify_status`, `justify_get_selection`, `justify_get_pending_changes`, `justify_apply_changes`, `justify_get_annotations`, `justify_watch`, `justify_acknowledge`, `justify_get_layout`, `justify_get_components`, `justify_clear`.

### Typical loop
activate -> Manipulate to scrub -> `justify_get_pending_changes` to preview -> `justify_apply_changes` for clean diffs -> apply to source.
SKILLEOF

# The heredoc is quoted, so bake the absolute source path in now.
sed -i.bak "s|__JUSTIFY_SRC__|$SCRIPT_DIR|g" "$SKILL_DIR/SKILL.md" && rm -f "$SKILL_DIR/SKILL.md.bak"

echo "Justify installed successfully."
echo "  Core script: $JUSTIFY_DIR/dist/justify-core.js"
echo "  MCP server: $JUSTIFY_DIR/dist/server/index.js"
echo "  Skill: $SKILL_DIR/SKILL.md"
echo "  CLI: justify-init / justify-remove (symlinked to $CLAUDE_DIR)"
