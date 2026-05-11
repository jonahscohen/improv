#!/bin/bash
# SessionStart hook: nudge reflection when enough new memories have accumulated.
#
# Checks how many .md files in the current project's .claude/memory/ are newer
# than ~/.claude/last-reflect-timestamp. If the count exceeds REFLECT_THRESHOLD
# (default 15), outputs additionalContext nudging the user.
#
# If no timestamp file exists, creates one and exits (first run, no nudge).

TIMESTAMP_FILE="$HOME/.claude/last-reflect-timestamp"
THRESHOLD="${REFLECT_THRESHOLD:-15}"
CWD="${SESSION_CWD:-$(pwd)}"
MEMORY_DIR="$CWD/.claude/memory"

# No memory directory = nothing to reflect on
if [ ! -d "$MEMORY_DIR" ]; then
  echo '{}'
  exit 0
fi

# First run: create timestamp, no nudge
if [ ! -f "$TIMESTAMP_FILE" ]; then
  touch "$TIMESTAMP_FILE"
  echo '{}'
  exit 0
fi

# Count memory files newer than last reflection
NEW_COUNT=$(find "$MEMORY_DIR" -name '*.md' -newer "$TIMESTAMP_FILE" ! -name 'MEMORY.md' | wc -l | tr -d ' ')

if [ "$NEW_COUNT" -ge "$THRESHOLD" ]; then
  python3 -c '
import json, sys
count = sys.argv[1]
msg = f"{count} new memories since your last reflection. Worth taking a look?"
print(json.dumps({
    "additionalContext": msg
}))
' "$NEW_COUNT"
else
  echo '{}'
fi
