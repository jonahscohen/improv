#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit|Bash.
# Two jobs:
#   1. If a PROJECT file changed: touch ~/.claude/.memory-dirty (enables commit gate)
#   2. If a MEMORY file changed: remove ~/.claude/.memory-dirty (clears the gate)
# Also nudges the assistant to write memory before responding.
# For Bash calls: always sets dirty (we can't reliably detect what files changed).

DIRTY_FLAG="$HOME/.claude/.memory-dirty"

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os, time

# Debounce window: skip nudge text if a memory write happened within this many seconds.
# Flag-setting is unaffected; only the additionalContext string is suppressed.
DEBOUNCE_SECONDS = 30

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
dirty_flag = os.path.expanduser("~/.claude/.memory-dirty")
last_memory_write = os.path.expanduser("~/.claude/.last-memory-write")

def recently_satisfied():
    """True if a memory write happened within DEBOUNCE_SECONDS."""
    try:
        mtime = os.path.getmtime(last_memory_write)
    except (FileNotFoundError, OSError):
        return False
    return (time.time() - mtime) < DEBOUNCE_SECONDS

def touch_last_memory_write():
    try:
        with open(last_memory_write, "a"):
            pass
        os.utime(last_memory_write, None)
    except Exception:
        pass

# For Bash: check if command looks like it modifies files (not read-only)
if tool == "Bash":
    cmd = data.get("tool_input", {}).get("command", "")
    # Skip read-only commands
    read_only = ["ls", "cat", "head", "tail", "grep", "find", "echo", "pwd",
                 "git status", "git log", "git diff", "git show", "git branch",
                 "wc ", "diff ", "readlink", "which", "type ", "file ",
                 "curl -s", "node -e", "python3 -c"]
    is_read = any(cmd.strip().startswith(r) for r in read_only)
    # Also skip if it is a git command that does not modify files
    is_git_read = cmd.strip().startswith("git") and not any(w in cmd for w in ["commit", "add", "push", "reset", "checkout", "merge", "rebase", "cherry"])
    # Skip memory-related commands
    is_memory = ".claude/memory" in cmd or "MEMORY.md" in cmd
    # Commands that write files
    writes = ["cp ", "mv ", "python3 <<", "cat <<", "> ", ">>", "tee ", "install",
              "sed -i", "chmod", "ln -s", "mkdir", "touch ", "rm "]
    is_write = any(w in cmd for w in writes)

    if is_memory:
        try:
            os.remove(dirty_flag)
        except FileNotFoundError:
            pass
        touch_last_memory_write()
        print("{}"); sys.exit(0)

    if is_write and not is_read:
        try:
            open(dirty_flag, "w").close()
        except Exception:
            pass
        if recently_satisfied():
            print("{}"); sys.exit(0)
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "BASH WROTE FILES. You are in dirty state. Write to .claude/memory/ session file BEFORE composing any text response to the user."
            }
        }))
    else:
        print("{}")
    sys.exit(0)

# For Write/Edit/MultiEdit: check file_path
file_path = data.get("tool_input", {}).get("file_path", "")

if not file_path:
    print("{}"); sys.exit(0)

is_memory = (".claude/" in file_path and "/memory/" in file_path) or file_path.endswith("MEMORY.md")

if is_memory:
    try:
        os.remove(dirty_flag)
    except FileNotFoundError:
        pass
    touch_last_memory_write()
    print("{}"); sys.exit(0)

# Project file changed - set dirty flag and nudge
try:
    open(dirty_flag, "w").close()
except Exception:
    pass

if recently_satisfied():
    print("{}"); sys.exit(0)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": "PROJECT FILE CHANGED. You are in dirty state. Write to .claude/memory/ session file BEFORE composing any text response to the user."
    }
}))
'
