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

# Write state file (persists across hook invocations)
cat > "$STATE_FILE" <<EOF
ACTIVE=1
SESSION_ID=$SESSION_ID
PIPE_PATH=$PIPE_PATH
SIDECOACH_ROOT=$SIDECOACH_ROOT
DAEMON_PID=$DAEMON_PID
EOF

# Don't trap - let daemon run independently in background
# State file cleanup happens in sidecoach-postresponse.sh
exit 0
