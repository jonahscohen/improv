#!/bin/bash
# PreToolUse hook for Bash. Blocks commands matching forbidden patterns.
# Reads hook input JSON from stdin, emits permissionDecision JSON to stdout.

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

REASON=""

# Attribution forbidden by CLAUDE.md
if echo "$CMD" | grep -qE 'Co-Authored-By|Generated with Claude|Co-Authored by Claude'; then
  REASON="BLOCKED: command contains forbidden attribution. CLAUDE.md mandates no Co-Authored-By or Claude attribution in commits."
fi

# Force-push to main/master
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git[[:space:]]+push.*(--force|[[:space:]]-f[[:space:]]).*(main|master)'; then
  REASON="BLOCKED: force-push to main/master requires explicit user authorization."
fi

# Destructive ops on memory dirs
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+)?(-[a-zA-Z]*f[a-zA-Z]*[[:space:]]+)?.*\.claude/memory'; then
  REASON="BLOCKED: rm against .claude/memory destroys session memory. Move to trash or rename instead."
fi

# Legacy model IDs in any command
if [ -z "$REASON" ] && echo "$CMD" | grep -qP 'gpt-4o(?!-mini-tts)|gpt-4\.1|gpt-3\.5|gpt-4[^o.\-]|claude-3-(opus|sonnet|haiku)'; then
  REASON="BLOCKED: legacy model ID detected. CLAUDE.md mandates latest model versions only."
fi

# Memory-before-commit gate: block git commit if memory is dirty
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git\s+commit'; then
  if [ -f "$HOME/.claude/.memory-dirty" ]; then
    REASON="BLOCKED: memory is dirty. A project file was edited but session memory has not been updated. Write to .claude/memory/ FIRST, then commit."
  fi
fi

# Verification gate: block git commit if deployed code not browser-verified
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git\s+commit'; then
  if [ -f "$HOME/.claude/.needs-verification" ]; then
    REASON="BLOCKED: code was deployed but not verified in the browser. Use Chrome MCP or cmux screenshot to verify BEFORE committing."
  fi
fi

if [ -n "$REASON" ]; then
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
else
  echo '{}'
fi
