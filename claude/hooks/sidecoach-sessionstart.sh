#!/bin/bash

# Sidecoach SessionStart Hook
# Initializes Sidecoach intent detection + flow execution at session start
# Launches background daemon that monitors conversation and triggers flows invisibly

set -e

SIDECOACH_ROOT="$(dirname "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")")/sidecoach"
SIDECOACH_BIN="${SIDECOACH_ROOT}/bin"
SIDECOACH_DIST="${SIDECOACH_ROOT}/dist"

# Check that Sidecoach is built
if [[ ! -f "${SIDECOACH_DIST}/sidecoach-orchestrator.js" ]]; then
  echo "Sidecoach not yet built. Skipping initialization." >&2
  exit 0
fi

# Set up environment for Sidecoach daemon
export SIDECOACH_ACTIVE=1
export SIDECOACH_BIN
export SIDECOACH_DIST
export SIDECOACH_LOG="/tmp/sidecoach-${USER}-$$.log"

# Determine session ID (use CLAUDE_SESSION_ID if available, otherwise PPID)
# CLAUDE_SESSION_ID is set by Claude Code session infrastructure
SESSION_ID="${CLAUDE_SESSION_ID:-$PPID}"
export SIDECOACH_SESSION_ID="$SESSION_ID"

# Create session-scoped pipe for daemon communication
SIDECOACH_PIPE="/tmp/sidecoach-${USER}-$$.pipe"
mkfifo "$SIDECOACH_PIPE" 2>/dev/null || true

# Launch daemon in background
# The daemon reads from stdin (utterances from PostUserPrompt hook),
# processes them through Sidecoach orchestrator, and outputs JSON results
"${SIDECOACH_BIN}/sidecoach-daemon.sh" \
  --pipe "$SIDECOACH_PIPE" \
  --log "$SIDECOACH_LOG" \
  --session-id "$SESSION_ID" \
  >"${SIDECOACH_LOG}" 2>&1 &

SIDECOACH_PID=$!
export SIDECOACH_PID

# Clean up on session end (trap will fire at PostSessionEnd or when parent shell exits)
trap "kill $SIDECOACH_PID 2>/dev/null; rm -f '$SIDECOACH_PIPE'; true" EXIT

# Signal that Sidecoach is active and ready
echo "Sidecoach initialized (PID: $SIDECOACH_PID, session: $PPID)"
