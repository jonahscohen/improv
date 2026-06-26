#!/bin/bash
# SessionStart hook: install/heal the cmux agent-teams tmux shim FIX.
#
# cmux's `cmux claude-teams` regenerates a STOCK tmux shim at
# ~/.cmuxterm/claude-teams-bin/tmux on every launch (stock = just
# `exec cmux __tmux-compat "$@"`). That stock shim cannot launch a teammate:
# cmux's __tmux-compat runs respawn-pane/split-window commands via execvp on the
# whitespace-split string (no shell), and the harness respawns the teammate pane
# with a COMPOUND command (cd ... && env ... claude.exe ...) whose first token
# `cd` is a shell builtin, so exec fails, the pane dies, and the teammate never
# appears or runs. Verified 2026-06-23; see
# .claude/memory/session_2026-06-23_cmux-teammate-pane-FIX.md.
#
# This hook re-plants the FIXED shim (canonical copy in the dotfiles repo) over
# the stock one at session start, so teammate-pane spawning works on every
# cmux-teams session instead of only one that was hand-patched. The fixed shim
# wraps a compound `-- command` in a one-token launch script that cmux can exec.
# Idempotent and non-blocking. Mirrors node-shim-heal.sh (heal-from-canonical).

set -eu

# Only relevant inside a cmux agent-teams session.
[ -n "${CMUX_SOCKET_PATH:-}" ] || exit 0

SHIM="$HOME/.cmuxterm/claude-teams-bin/tmux"
[ -e "$SHIM" ] || exit 0   # not the cmux-teams shim layout; nothing to do

# Canonical fixed shim from the dotfiles repo (durable copy).
CANONICAL="$HOME/.claude/cmux/teammate-tmux-shim"
[ -f "$CANONICAL" ] || CANONICAL="/Users/spare3/Documents/Github/improv/claude/cmux/teammate-tmux-shim"
[ -f "$CANONICAL" ] || exit 0   # nothing to install from; stay silent

# Already fixed? The marker (the launch-script dir) never appears in the stock shim.
if grep -q 'cmux-teammate-launch' "$SHIM" 2>/dev/null; then
  exit 0
fi

# Back up the stock shim once, then install the fix.
[ -f "$SHIM.orig" ] || cp -p "$SHIM" "$SHIM.orig" 2>/dev/null || true
if cp "$CANONICAL" "$SHIM" 2>/dev/null && chmod +x "$SHIM" 2>/dev/null; then
  echo "cmux-teammate-shim-heal: installed the agent-teams tmux-shim fix over cmux's stock shim, so spawned teammates render as real cmux panes (stock backup at ~/.cmuxterm/claude-teams-bin/tmux.orig). See session_2026-06-23_cmux-teammate-pane-FIX.md."
fi
exit 0
