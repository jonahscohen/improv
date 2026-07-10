#!/bin/bash
# PostToolUse hook for Read.
# When the agent Reads a file that is outstanding in THIS session's pending list,
# strike that one path off. This is the only way the screenshot-open-mandate gate
# gets satisfied.
#
# The pending state is per-session and holds a LIST. Previously it was one global
# file holding one path, which meant a Read in session B discharged session A's
# obligation - B had never taken A's screenshot - and a second screenshot in one
# session erased the first's. Both reproduced 2026-07-10. Key derivation is
# duplicated verbatim in screenshot-open-mandate.sh and bash-guard.sh; if you
# change it, change all three.

INPUT=$(cat)

SESSION_KEY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", ""))
except Exception:
    s = ""
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s or "global")
' 2>/dev/null)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global
PENDING_FILE="$HOME/.claude/.screenshot-pending.$SESSION_KEY"

[ ! -f "$PENDING_FILE" ] && echo '{}' && exit 0

READ_PATH=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("file_path", ""))
except:
    print("")
' 2>/dev/null)

# Strike off exactly the path that was read. Any other outstanding capture stays
# outstanding: discharging one obligation must never discharge another.
if [ -n "$READ_PATH" ] && grep -qxF -- "$READ_PATH" "$PENDING_FILE" 2>/dev/null; then
  TMP=$(mktemp)
  grep -vxF -- "$READ_PATH" "$PENDING_FILE" > "$TMP" 2>/dev/null
  if [ -s "$TMP" ]; then
    mv "$TMP" "$PENDING_FILE"
  else
    rm -f "$PENDING_FILE" "$TMP"
  fi
fi

echo '{}'
