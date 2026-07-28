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

# replace_placeholder_atomically <file> <placeholder> <replacement>
#
# Bake a path into an installed SKILL.md. Replaces `sed -i.bak "s|...|...|g" FILE && rm -f
# FILE.bak`, which carried two defects that the top-level installer spent a session
# removing from its own call sites while these delegated installers went on running them
# under ~/.claude/skills:
#
#   1. `sed -i.bak` writes FILE.bak - a path this installer does not own - and then the
#      `rm -f` deletes it. A user's own SKILL.md.bak was destroyed silently. sed writes
#      that backup whether or not anything matched, so even a no-op substitution took it.
#   2. `sed ... && rm` SWALLOWS the failure. If sed cannot write the file the `&&` short
#      circuits, the `rm` is skipped, and the whole statement exits 0 - so `set -e` never
#      fires and the installer reports success having left `__JUSTIFY_SRC__` literal in
#      the installed skill. The skill then points at a path that does not exist.
#
# This writes a temp file BESIDE the destination and renames it over, so the destination
# is never truncated by a failed run, and it verifies the placeholder is actually gone
# before the rename. Every failure path returns non-zero and prints why; under `set -e`
# that stops the installer instead of shipping a half-baked skill.
#
# Self-contained on purpose: this is a standalone script with its own `set -euo pipefail`
# and no access to the top-level installer's helpers.
replace_placeholder_atomically() {
  local file="$1" placeholder="$2" replacement="$3"
  local dir base tmp
  if [ ! -f "$file" ]; then
    echo "ERROR: skill file is missing: $file" >&2
    return 1
  fi
  if ! grep -Fq "$placeholder" "$file"; then
    echo "ERROR: $file does not contain $placeholder - refusing to install a skill whose source path was never baked in." >&2
    return 1
  fi
  dir="$(dirname "$file")"
  base="$(basename "$file")"
  tmp="$(mktemp "$dir/.${base}.XXXXXX")" || {
    echo "ERROR: could not create a temp file beside $file" >&2
    return 1
  }
  # perl, not sed -i: no in-place edit, no .bak, and the pattern and replacement are
  # passed through the environment so a path containing regex or delimiter characters
  # cannot be interpreted as syntax.
  if ! PLACEHOLDER="$placeholder" REPLACEMENT="$replacement" \
      perl -pe 'BEGIN { $p = $ENV{PLACEHOLDER}; $r = $ENV{REPLACEMENT}; } s/\Q$p\E/$r/g' \
      "$file" > "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: substitution failed for $file" >&2
    return 1
  fi
  if grep -Fq "$placeholder" "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: $placeholder survived the substitution in $file" >&2
    return 1
  fi
  if ! mv -f "$tmp" "$file"; then
    rm -f "$tmp"
    echo "ERROR: could not move the rewritten skill into place at $file" >&2
    return 1
  fi
  return 0
}

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
cp "$SCRIPT_DIR/cli/justify-serve.sh" "$JUSTIFY_DIR/justify-serve.sh"
# Daemon-owned watch (2026-07-08): the headless apply worker the daemon spawns,
# plus the CLI arm/disarm path (chat "watch justify" / "stop watching" is the
# other). justify-watch.sh now ARMS the daemon instead of running a session loop.
cp "$SCRIPT_DIR/cli/justify-worker.sh" "$JUSTIFY_DIR/justify-worker.sh"
cp "$SCRIPT_DIR/cli/justify-watch-arm.sh" "$JUSTIFY_DIR/justify-watch-arm.sh"
cp "$SCRIPT_DIR/cli/justify-watch-disarm.sh" "$JUSTIFY_DIR/justify-watch-disarm.sh"
chmod +x "$JUSTIFY_DIR/init.sh" "$JUSTIFY_DIR/remove.sh" "$JUSTIFY_DIR/justify-watch.sh" "$JUSTIFY_DIR/justify-done.sh" \
  "$JUSTIFY_DIR/justify-serve.sh" "$JUSTIFY_DIR/justify-worker.sh" "$JUSTIFY_DIR/justify-watch-arm.sh" "$JUSTIFY_DIR/justify-watch-disarm.sh"

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

# Guard: a run with $HOME redirected into a temp tree (sandboxed installers,
# dry-runs, CI) would plant symlinks into a SHARED bin pointing at a directory
# macOS reaps hours later. The links survive, their targets do not, and every
# justify-done call becomes "command not found" - which surfaces to the user as
# a Justify panel hung on "Working..." forever while the source edits land
# silently. Observed 2026-07-16: eight of ten shims dead this way.
case "$JUSTIFY_DIR" in
  /var/folders/*|/tmp/*|"${TMPDIR:-/nonexistent}"*)
    case "$BIN_DIR" in
      "$JUSTIFY_DIR"*) ;;
      *)
        echo "ERROR: HOME is a temp tree ($HOME) but $BIN_DIR is a shared bin." >&2
        echo "       Refusing to plant shims whose targets will be reaped." >&2
        echo "       Re-run with a real HOME, or set BIN_DIR inside the temp tree." >&2
        exit 1
        ;;
    esac
    ;;
esac

ln -sfn "$JUSTIFY_DIR/init.sh" "$BIN_DIR/justify-init"
ln -sfn "$JUSTIFY_DIR/remove.sh" "$BIN_DIR/justify-remove"
ln -sfn "$JUSTIFY_DIR/justify-watch.sh" "$BIN_DIR/justify-watch"
ln -sfn "$JUSTIFY_DIR/justify-done.sh" "$BIN_DIR/justify-done"
ln -sfn "$JUSTIFY_DIR/justify-serve.sh" "$BIN_DIR/justify-serve"
ln -sfn "$JUSTIFY_DIR/justify-watch-arm.sh" "$BIN_DIR/justify-watch-arm"
ln -sfn "$JUSTIFY_DIR/justify-watch-disarm.sh" "$BIN_DIR/justify-watch-disarm"
ln -sfn "$JUSTIFY_DIR/justify-worker.sh" "$BIN_DIR/justify-worker"

# Falsify the install rather than trusting it: `-e` follows the link, so a
# dangling shim fails here instead of at the moment a queued prompt needs it.
shim_failures=0
for shim in justify-init justify-remove justify-watch justify-done \
            justify-serve justify-watch-arm justify-watch-disarm justify-worker; do
  if [ ! -e "$BIN_DIR/$shim" ]; then
    echo "ERROR: $BIN_DIR/$shim does not resolve to an existing file" >&2
    shim_failures=$((shim_failures + 1))
  fi
done
if [ "$shim_failures" -gt 0 ]; then
  echo "ERROR: $shim_failures justify shim(s) are dangling. Install aborted." >&2
  exit 1
fi
echo "Installed justify-init, justify-remove, justify-watch, justify-done, justify-serve, justify-watch-arm, justify-watch-disarm, justify-worker to $BIN_DIR (all verified resolvable)"

# launchd KeepAlive agent (macOS): make the daemon itself durable. Placement only
# - activation is the user's choice (see claude/docs/justify-daemon-launchd.md).
# The committed plist keeps THIS machine's absolute paths; template $HOME to the
# installing machine before placing it in ~/Library/LaunchAgents.
JUSTIFY_PLIST_SRC="$SCRIPT_DIR/../claude/launchd/com.yesand.justify-serve.plist"
if [ "$(uname)" = "Darwin" ] && [ -f "$JUSTIFY_PLIST_SRC" ] && command -v python3 >/dev/null 2>&1; then
  mkdir -p "$CLAUDE_DIR/logs"
  LA_DIR="$HOME/Library/LaunchAgents"
  JUSTIFY_PLIST_DST="$LA_DIR/com.yesand.justify-serve.plist"
  mkdir -p "$LA_DIR"
  if python3 - "$JUSTIFY_PLIST_SRC" "$JUSTIFY_PLIST_DST" "$HOME" <<'PYPLIST'
import re, sys
from xml.sax.saxutils import escape
src, dst, home = sys.argv[1:4]
with open(src, encoding="utf-8") as f:
    text = f.read()
# The author's HOME is embedded verbatim in the committed plist; extract it so
# the rewrite works even if re-authored on another machine. The plist runs node
# directly on the daemon entrypoint (see the plist header for why not justify-serve).
m = re.search(r'<string>([^<]+)/\.claude/justify/dist/server/index\.js</string>', text)
if not m:
    sys.stderr.write("justify plist template: could not locate author home\n")
    sys.exit(1)
text = text.replace(m.group(1), escape(home))
with open(dst, "w", encoding="utf-8") as f:
    f.write(text)
PYPLIST
  then
    echo "launchd agent placed at $JUSTIFY_PLIST_DST (templated for $HOME)"
    echo "  To activate: launchctl bootstrap gui/\$(id -u) $JUSTIFY_PLIST_DST"
  else
    echo "WARNING: could not template the justify launchd plist - place it manually from $JUSTIFY_PLIST_SRC"
  fi
fi

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

# DROP A PRE-EXISTING SYMLINK BEFORE WRITING, or the heredoc below FOLLOWS it and
# overwrites whatever it points at - a file outside the directory this installer owns.
# The atomic rewrite further down cannot help with that: by the time it runs, the write
# through the link has already happened. Flagged by independent review. This path is an
# installer-owned artifact, so replacing a link here is correct; only the link is removed,
# never its target.
#
# Written as an `if`, not `[ -L x ] && rm -f x`: this is top-level code under
# `set -euo pipefail`, where an && list whose test is FALSE is itself a failed command and
# aborts the installer. The common case - no symlink there - is exactly that false test.
if [ -L "$SKILL_DIR/SKILL.md" ]; then
  rm -f "$SKILL_DIR/SKILL.md"
fi

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

### Step 6 - The watch is DAEMON-OWNED (arm it; do not run a session poll loop)
The watch lives in the persistent :9223 daemon, not this session. "watch justify" ARMS the daemon (`justify-watch-arm`); the daemon then spawns a headless worker for every Send-All batch and keeps doing so across session teardowns. You do NOT run a session-owned poll loop.

If you want to handle a queued batch IN this session instead of waiting for the daemon, CLAIM it first so the daemon does not also dispatch a worker for it (never raw-poll `/prompts` - that returns daemon-claimed prompts too and would double-apply):

1. CLAIM (returns only unclaimed/stale prompts, marks them yours):
   ```bash
   curl -s -X POST http://localhost:9223/prompts/claim -H 'Content-Type: application/json' -d '{"by":"interactive"}'
   ```
   Each claimed prompt is `{id, context, prompt, elementCount, timestamp, selectors, claimedBy, claimedAt}`.
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
replace_placeholder_atomically "$SKILL_DIR/SKILL.md" "__JUSTIFY_SRC__" "$SCRIPT_DIR"

echo "Justify installed successfully."
echo "  Core script: $JUSTIFY_DIR/dist/justify-core.js"
echo "  MCP server: $JUSTIFY_DIR/dist/server/index.js"
echo "  Skill: $SKILL_DIR/SKILL.md"
echo "  CLI: justify-init / justify-remove (symlinked to $CLAUDE_DIR)"
