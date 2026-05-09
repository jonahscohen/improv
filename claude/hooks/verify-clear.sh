#!/bin/bash
# PostToolUse hook for mcp__claude-in-chrome__* tools.
# Clears the verification flag when browser verification happens.

VERIFY_FLAG="$HOME/.claude/.needs-verification"

if [ -f "$VERIFY_FLAG" ]; then
  rm -f "$VERIFY_FLAG"
fi
echo '{}'
