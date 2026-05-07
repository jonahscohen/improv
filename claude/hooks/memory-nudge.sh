#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit.
# Two jobs:
#   1. If a PROJECT file changed: touch ~/.claude/.memory-dirty (enables commit gate)
#   2. If a MEMORY file changed: remove ~/.claude/.memory-dirty (clears the gate)
# Also nudges the assistant to write memory before responding.

DIRTY_FLAG="$HOME/.claude/.memory-dirty"

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

file_path = data.get("tool_input", {}).get("file_path", "")

if not file_path:
    print("{}"); sys.exit(0)

dirty_flag = os.path.expanduser("~/.claude/.memory-dirty")
is_memory = (".claude/" in file_path and "/memory/" in file_path) or file_path.endswith("MEMORY.md")

if is_memory:
    try:
        os.remove(dirty_flag)
    except FileNotFoundError:
        pass
    print("{}"); sys.exit(0)

# Project file changed - set dirty flag and nudge
try:
    open(dirty_flag, "w").close()
except Exception:
    pass

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": "PROJECT FILE CHANGED. You are in dirty state. Write to .claude/memory/ session file BEFORE composing any text response to the user."
    }
}))
'
