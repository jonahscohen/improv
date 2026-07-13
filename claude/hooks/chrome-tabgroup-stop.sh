#!/usr/bin/env bash
#
# chrome-tabgroup-stop.sh - Stop hook.
#
# If this session opened a Claude-in-Chrome MCP tab group and has not closed it,
# and the browser has been idle long enough that the work is plainly done, block
# the stop ONCE and tell me to close the group. The block forces one more turn, on
# which I close the tabs; chrome-tabgroup-clear.sh then drops the marker and the
# next stop proceeds.
#
# A shell hook cannot close a Chrome tab itself, so this reminds rather than acts.
# It only reaches the CURRENT session's group, which is the only group any session
# can close via MCP anyway.
#
# Loop safety, three independent layers:
#   1. stop_hook_active: if this stop is already the result of a hook block, allow.
#   2. reminded flag: block at most once per open-group burst.
#   3. the marker is removed by clear.sh the moment I actually close the group.
#
# Idle threshold: CHROME_TABGROUP_IDLE_SECONDS (default 90). Below it, the browser
# was used recently, so I am probably still verifying - stay silent. Known limit:
# a session that ends within the threshold of its last browser action is not
# caught this pass; the CLAUDE.md "close your tab group" rule is the backstop.
#
# Session key derivation is duplicated verbatim in chrome-tabgroup-track.sh and
# chrome-tabgroup-clear.sh. Change all three together.

INPUT=$(cat)

# Layer 1: never block a stop that is itself a hook continuation.
ACTIVE=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    print("1" if json.load(sys.stdin).get("stop_hook_active") else "0")
except Exception:
    print("0")
' 2>/dev/null)
[ "$ACTIVE" = "1" ] && exit 0

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

MARKER="$HOME/.claude/.chrome-tabgroup.$SESSION_KEY"
REMINDED="$HOME/.claude/.chrome-tabgroup-reminded.$SESSION_KEY"

# No open group recorded -> nothing to clean up.
[ -f "$MARKER" ] || exit 0

# Layer 2: already reminded for this group burst.
[ -f "$REMINDED" ] && exit 0

# Idle gate: only nag once the browser has been quiet, i.e. verification is done.
# Validate the threshold: a non-integer env value must fall back to the default,
# never turn `[ "$AGE" -lt "$IDLE_LIMIT" ]` into an "integer expression expected"
# error that then falls through to a block on a fresh marker.
IDLE_LIMIT="${CHROME_TABGROUP_IDLE_SECONDS:-90}"
case "$IDLE_LIMIT" in
  ''|*[!0-9]*) IDLE_LIMIT=90 ;;
esac
NOW=$(date +%s)
MTIME=$(stat -f %m "$MARKER" 2>/dev/null || stat -c %Y "$MARKER" 2>/dev/null || echo "$NOW")
AGE=$(( NOW - MTIME ))
[ "$AGE" -lt "$IDLE_LIMIT" ] && exit 0

# Block once. Create the reminded flag ATOMICALLY (mkdir succeeds for exactly one
# racer): if two Stop processes evaluate the same stale marker at once, only the
# one that wins the mkdir blocks; the loser exits 0. Without this, both could pass
# the "-f $REMINDED" check above and both block.
if ! mkdir "$REMINDED.lock" 2>/dev/null; then
  exit 0
fi
: > "$REMINDED"
printf 'BLOCKED (chrome-tabgroup): this session opened a Claude-in-Chrome MCP tab group and has not closed it (browser idle %ss). Be a good neighbor: call mcp__claude-in-chrome__tabs_context_mcp, then mcp__claude-in-chrome__tabs_close_mcp on each tab id, to close the group before ending. Closing the last tab auto-removes the group. This reminder fires once.\n' "$AGE" >&2
exit 2
