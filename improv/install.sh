#!/bin/bash
set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"
IMPROV_DIR="${CLAUDE_DIR}/improv"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Improv..."

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
mkdir -p "$IMPROV_DIR"

# Copy all source files preserving structure
cp -r "$SCRIPT_DIR/server" "$IMPROV_DIR/"
cp -r "$SCRIPT_DIR/core" "$IMPROV_DIR/"
cp -r "$SCRIPT_DIR/adapters" "$IMPROV_DIR/"
cp "$SCRIPT_DIR/package.json" "$IMPROV_DIR/"
cp "$SCRIPT_DIR/tsconfig.json" "$IMPROV_DIR/"
cp "$SCRIPT_DIR/tsconfig.server.json" "$IMPROV_DIR/"
cp "$SCRIPT_DIR/tsconfig.core.json" "$IMPROV_DIR/"
cp "$SCRIPT_DIR/build.js" "$IMPROV_DIR/"

# Install dependencies (needs devDeps for typescript + esbuild build step)
echo "Installing dependencies..."
(cd "$IMPROV_DIR" && npm install 2>/dev/null) || {
  echo "WARNING: npm install failed. Run manually: cd $IMPROV_DIR && npm install"
}

# Build core script
echo "Building core script..."
(cd "$IMPROV_DIR" && node build.js 2>/dev/null) || {
  echo "WARNING: Build failed. Run manually: cd $IMPROV_DIR && node build.js"
}

# Build server
echo "Building server..."
(cd "$IMPROV_DIR" && npx -y tsc -p tsconfig.server.json 2>/dev/null) || {
  echo "WARNING: Server build failed. Run manually: cd $IMPROV_DIR && npx tsc -p tsconfig.server.json"
}

# Install CLI tools
echo "Installing CLI tools..."
cp "$SCRIPT_DIR/cli/init.sh" "$IMPROV_DIR/init.sh"
cp "$SCRIPT_DIR/cli/remove.sh" "$IMPROV_DIR/remove.sh"
chmod +x "$IMPROV_DIR/init.sh" "$IMPROV_DIR/remove.sh"
ln -sf "$IMPROV_DIR/init.sh" "${CLAUDE_DIR}/improv-init"
ln -sf "$IMPROV_DIR/remove.sh" "${CLAUDE_DIR}/improv-remove"
echo "Symlinked improv-init and improv-remove to $CLAUDE_DIR"

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
d['mcpServers']['improv'] = {
    'type': 'stdio',
    'command': 'node',
    'args': [os.path.expanduser('~/.claude/improv/dist/server/index.js')]
}
json.dump(d, open(p, 'w'), indent=2)
print('MCP server registered in ~/.claude.json')
"

# Install skill
SKILL_DIR="${CLAUDE_DIR}/skills/improv"
mkdir -p "$SKILL_DIR"

cat > "$SKILL_DIR/SKILL.md" << 'SKILLEOF'
---
name: improv
description: Visual micro-adjustment tool for in-browser design refinement
---

# Improv

Improv is a live in-browser design tool that lets you (or the user) visually tweak a running page and then hand those changes back to Claude as structured diffs. It injects a lightweight overlay into any open tab connected via WebSocket, exposing three interaction modes.

## Activation

Activate with `cmd+shift+i` in any connected browser tab, or call `improv_activate` from Claude.

## Modes

### Manipulate Mode

Click any element to select it. Hover over a CSS property in the panel to scrub its value with the mouse (left = decrease, right = increase). Changes are live-previewed in the browser and buffered server-side until you call `improv_apply_changes` to receive them as clean diffs.

### Prompt Mode

Press `p` to enter Prompt mode. Click an element to select it, then type an instruction inline ("make this button more rounded", "increase font size"). The prompt is sent to Claude along with the element's selector and computed styles, so Claude can propose targeted CSS changes.

### Annotate + Layout Mode

Press `a` to enter Annotate mode. Click elements to drop numbered markers with comments (intent: bug, suggestion, question, style). Press `l` to switch to Layout mode - drag elements onto a canvas grid to describe repositioning intent. Both annotation and layout data are buffered server-side and readable via `improv_get_annotations` and `improv_get_layout`.

## MCP Tools (11 total)

| Tool | Description |
|---|---|
| `improv_activate` | Broadcast activation signal to all connected browser tabs |
| `improv_status` | Return connection count, tab URLs, and buffer sizes |
| `improv_get_selection` | Get the currently selected element from the browser |
| `improv_get_pending_changes` | Return all style changes buffered from browser interactions |
| `improv_apply_changes` | Format buffered changes as human-readable diffs, clear buffer, notify browser |
| `improv_get_annotations` | Return design annotations (supports compact/standard/detailed/forensic verbosity) |
| `improv_watch` | Long-poll for new changes or annotations (configurable timeout) |
| `improv_acknowledge` | Mark a specific annotation as resolved by ID |
| `improv_get_layout` | Return layout placements from the browser canvas |
| `improv_get_components` | Return available components from the project component scanner |
| `improv_clear` | Clear all pending buffers and notify the browser |

## Typical Workflow

1. Open a dev server in a connected browser tab.
2. Call `improv_activate` (or press `cmd+shift+i`).
3. Use Manipulate mode to scrub values live.
4. Call `improv_get_pending_changes` to preview the buffer.
5. Call `improv_apply_changes` to receive formatted diffs.
6. Apply the diffs to source files.
SKILLEOF

echo "Improv installed successfully."
echo "  Core script: $IMPROV_DIR/dist/improv-core.js"
echo "  MCP server: $IMPROV_DIR/dist/server/index.js"
echo "  Skill: $SKILL_DIR/SKILL.md"
echo "  CLI: improv-init / improv-remove (symlinked to $CLAUDE_DIR)"
