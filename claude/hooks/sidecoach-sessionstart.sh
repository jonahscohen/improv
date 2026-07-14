#!/usr/bin/env bash
# Sidecoach SessionStart hook - starts daemon and writes state file

# Derive the repo root from this script's own real path (following the deploy
# symlink into ~/.claude/hooks/), mirroring the beats hooks - no machine-specific
# path is hard-coded, so the hook works on any checkout.
_realpath() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }
SELF="$(_realpath "$0")"
HOOK_DIR="$(cd "$(dirname "$SELF")" 2>/dev/null && pwd || printf '%s' "$(dirname "$SELF")")"
REPO_ROOT="$(cd "$HOOK_DIR/../.." 2>/dev/null && pwd || printf '%s' "$HOOK_DIR/../..")"
SIDECOACH_ROOT="$REPO_ROOT/sidecoach"
STATE_FILE="$HOME/.claude/.sidecoach-state"

# Check that dist is built
if [[ ! -f "$SIDECOACH_ROOT/dist/sidecoach-orchestrator.js" ]]; then
  exit 0
fi

# Generate session ID and pipe path
SESSION_ID="$(date +%s)-$$"
PIPE_PATH="/tmp/sidecoach-$USER-$SESSION_ID.pipe"

# Create named pipe for daemon
[[ -p "$PIPE_PATH" ]] && rm "$PIPE_PATH"
mkfifo "$PIPE_PATH" || exit 0

# Start daemon in background (detached, survives hook exit)
nohup "$SIDECOACH_ROOT/bin/sidecoach-daemon.sh" \
  --pipe "$PIPE_PATH" \
  --log "/tmp/sidecoach-$SESSION_ID.log" \
  --session-id "$SESSION_ID" \
  >/dev/null 2>&1 &
DAEMON_PID=$!

# Write state file (persists across hook invocations). Values are %q-escaped so
# a checkout or pipe path containing spaces or shell metacharacters stays valid
# when the consumer hooks (sidecoach-postuserp.sh, sidecoach-postresponse.sh)
# `source` this file. Now that SIDECOACH_ROOT is derived from the real checkout
# path, an unescaped write would break `source` on any path with a space.
{
  printf 'ACTIVE=%q\n' "1"
  printf 'SESSION_ID=%q\n' "$SESSION_ID"
  printf 'PIPE_PATH=%q\n' "$PIPE_PATH"
  printf 'SIDECOACH_ROOT=%q\n' "$SIDECOACH_ROOT"
  printf 'DAEMON_PID=%q\n' "$DAEMON_PID"
} > "$STATE_FILE"

# Don't trap - let daemon run independently in background
# State file cleanup happens in sidecoach-postresponse.sh
exit 0
