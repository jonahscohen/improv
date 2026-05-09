#!/bin/bash
# PostToolUse hook for browser verification tools.
# Clears the verification flag when ANY browser verification happens:
# - Chrome MCP (mcp__claude-in-chrome__*)
# - cmux browser (cmux browser screenshot/snapshot)
# - Playwright
# Also cleared by user interrupt (they may be verifying manually).

VERIFY_FLAG="$HOME/.claude/.needs-verification"

if [ -f "$VERIFY_FLAG" ]; then
  rm -f "$VERIFY_FLAG"
fi
echo '{}'
