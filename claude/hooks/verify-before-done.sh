#!/bin/bash
# PreToolUse hook for Bash.
# Blocks git commit if the last Bash command was a cp/deploy to a project
# WITHOUT a subsequent browser verification (Chrome MCP tool call) in between.
#
# Uses a flag file: ~/.claude/.needs-verification
# Set by: cp commands to project dirs (dishplayscapes, blueprint-tracker, etc)
# Cleared by: any mcp__claude-in-chrome tool call (via separate PostToolUse hook)
# Checked by: git commit in bash-guard

# This hook runs as PostToolUse on Bash. If the command deploys improv,
# set the verification flag.

VERIFY_FLAG="$HOME/.claude/.needs-verification"

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
cmd = data.get("tool_input", {}).get("command", "") if tool == "Bash" else ""

verify_flag = os.path.expanduser("~/.claude/.needs-verification")

# Set flag when deploying improv to a project
deploy_markers = ["dishplayscapes/improv", "blueprint-tracker/public/improv", "claude-dotfiles/public/improv"]
if any(m in cmd for m in deploy_markers):
    try:
        open(verify_flag, "w").close()
    except Exception:
        pass
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "IMPROV DEPLOYED. You MUST verify in the browser (Chrome MCP or cmux screenshot) BEFORE committing or reporting success. The verification flag is set."
        }
    }))
    sys.exit(0)

print("{}")
'
