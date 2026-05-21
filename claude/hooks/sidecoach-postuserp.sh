#!/bin/bash

# Sidecoach PostUserPrompt Hook
#
# Intercepts user messages and sends them to Sidecoach daemon
# for background intent detection and flow execution
# Results are cached for injection by PostResponse hook

# Only run if Sidecoach is active
if [[ -z "$SIDECOACH_ACTIVE" || -z "$SIDECOACH_PID" ]]; then
  exit 0
fi

# Verify daemon is still running
if ! kill -0 "$SIDECOACH_PID" 2>/dev/null; then
  exit 0
fi

# The user's utterance is passed via stdin by the Claude Code harness
# Read it from stdin
UTTERANCE=$(cat)

# Skip empty utterances
if [[ -z "$UTTERANCE" ]]; then
  exit 0
fi

# Format as JSON for daemon
DAEMON_INPUT=$(cat <<EOF
{
  "utterance": $(printf '%s\n' "$UTTERANCE" | jq -Rs .),
  "userId": "${CLAUDE_USER:-unknown}",
  "projectPath": "$(pwd)"
}
EOF
)

# Send to daemon via named pipe (non-blocking, background)
# If pipe doesn't exist or write fails, silently continue
{
  echo "$DAEMON_INPUT" > "$SIDECOACH_PIPE" 2>/dev/null
} &

# Don't block user message processing
exit 0
