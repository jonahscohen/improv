#!/usr/bin/env bash
# Sidecoach SessionStart hook - starts daemon and writes state file

SIDECOACH_ROOT="/Users/spare3/Documents/Github/improv/sidecoach"
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
