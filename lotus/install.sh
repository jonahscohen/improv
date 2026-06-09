#!/bin/bash
set -euo pipefail

# Lotus installer - official Improv component.
# Lotus is a Figma plugin + MCP bridge (stdio MCP for Claude Code, WebSocket on
# 9527 for the plugin running inside Figma). Unlike justify, the app is large and
# is built IN PLACE in the repo (like tilt-lab) rather than copied to ~/.claude.
# "Installing" means: npm-install + build both halves, register the MCP server in
# ~/.claude.json (NOT settings.json - this Claude Code build does not read MCP
# defs from settings.json), and install the /lotus skill with the repo path baked
# in. Invoked by the top-level install.sh when `lotus` is picked.

CLAUDE_DIR="${HOME}/.claude"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # = <repo>/lotus

echo "Installing Lotus..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required. Install it first."
  exit 1
fi
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is required. Install it first."
  exit 1
fi

# Absolute node path baked into the MCP registration so Claude Code's spawn does
# not depend on its PATH (a documented failure mode for this server).
NODE_BIN="$(command -v node)"

# --- Build the Figma plugin (webpack -> dist/code.js) -----------------------
echo "Building Lotus plugin (webpack)..."
(cd "$SCRIPT_DIR" && npm install --silent && npm run build) || {
  echo "WARNING: plugin build failed. Run manually: cd $SCRIPT_DIR && npm install && npm run build"
}

# --- Build the MCP server (tsc -> mcp-server/dist/server.js) -----------------
echo "Building Lotus MCP server (tsc)..."
(cd "$SCRIPT_DIR/mcp-server" && npm install --silent && npm run build) || {
  echo "WARNING: mcp-server build failed. Run manually: cd $SCRIPT_DIR/mcp-server && npm install && npm run build"
}

# --- Register MCP server in ~/.claude.json ----------------------------------
SERVER_JS="$SCRIPT_DIR/mcp-server/dist/server.js"
python3 -c "
import json, os
p = os.path.expanduser('~/.claude.json')
d = json.load(open(p)) if os.path.exists(p) else {}
d.setdefault('mcpServers', {})
d['mcpServers']['lotus'] = {
    'type': 'stdio',
    'command': '$NODE_BIN',
    'args': ['$SERVER_JS'],
}
json.dump(d, open(p, 'w'), indent=2)
print('MCP server registered in ~/.claude.json -> $SERVER_JS')
"

# --- Install the /lotus skill (repo path baked in) --------------------------
SKILL_SRC="$SCRIPT_DIR/../claude/skills/lotus/SKILL.md"
SKILL_DIR="${CLAUDE_DIR}/skills/lotus"
mkdir -p "$SKILL_DIR"
cp "$SKILL_SRC" "$SKILL_DIR/SKILL.md"
sed -i.bak "s|__LOTUS_SRC__|$SCRIPT_DIR|g" "$SKILL_DIR/SKILL.md" && rm -f "$SKILL_DIR/SKILL.md.bak"

echo "Lotus installed successfully."
echo "  Plugin build: $SCRIPT_DIR/dist/code.js"
echo "  MCP server:   $SERVER_JS"
echo "  Skill:        $SKILL_DIR/SKILL.md"
echo "  Manifest (import into Figma): $SCRIPT_DIR/manifest.json"
echo "  NOTE: restart Claude Code once for the lotus MCP tools to load, then run /lotus."
