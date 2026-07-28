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
#      fires and the installer reports success having left `__LOTUS_SRC__` literal in the
#      installed skill. The skill then points at a path that does not exist.
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

# --- Install the /lotus skill (repo path baked in) --------------------------
SKILL_SRC="$SCRIPT_DIR/../claude/skills/lotus/SKILL.md"
SKILL_DIR="${CLAUDE_DIR}/skills/lotus"
mkdir -p "$SKILL_DIR"
# DROP A PRE-EXISTING SYMLINK BEFORE WRITING, or the `cp` below FOLLOWS it and overwrites
# whatever it points at - a file outside the directory this installer owns. The atomic
# rewrite on the next line cannot help with that: by then the write through the link has
# already happened. Flagged by independent review. This path is an installer-owned
# artifact, so replacing a link here is correct; only the link is removed, never its target.
#
# Written as an `if`, not `[ -L x ] && rm -f x`: this is top-level code under
# `set -euo pipefail`, where an && list whose test is FALSE is itself a failed command and
# aborts the installer. The common case - no symlink there - is exactly that false test.
if [ -L "$SKILL_DIR/SKILL.md" ]; then
  rm -f "$SKILL_DIR/SKILL.md"
fi
cp "$SKILL_SRC" "$SKILL_DIR/SKILL.md"
replace_placeholder_atomically "$SKILL_DIR/SKILL.md" "__LOTUS_SRC__" "$SCRIPT_DIR"

echo "Lotus installed successfully."
echo "  Plugin build: $SCRIPT_DIR/dist/code.js"
echo "  MCP server:   $SERVER_JS"
echo "  Skill:        $SKILL_DIR/SKILL.md"
echo "  Manifest (import into Figma): $SCRIPT_DIR/manifest.json"
echo "  NOTE: restart Claude Code once for the lotus MCP tools to load, then run /lotus."
