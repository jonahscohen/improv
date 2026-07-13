#!/usr/bin/env bash
#
# chrome-tabgroup-track.sh - PostToolUse.
#
# Records that THIS session has an open Claude-in-Chrome MCP tab group, so the
# Stop hook (chrome-tabgroup-stop.sh) can remind me to close it before the session
# ends. A shell hook cannot close a Chrome tab - only an mcp__claude-in-chrome__
# tabs_close_mcp call can, and that call only reaches the CURRENT session's group.
# So cleanup has to happen inside the owning session, and this trio makes that a
# habit instead of a thing I forget.
#
# The marker's MTIME is "browser active as of now": refreshed on every browsing
# tool. The Stop hook treats a stale mtime (no browser use for a while) as "the
# browser work is done" and reminds then, so it never nags mid-verification.
#
# Matched on the whole mcp__claude-in-chrome__ family. tabs_close_mcp is handled
# by chrome-tabgroup-clear.sh instead, so this hook SKIPS it - otherwise a close
# call would re-arm the marker that clear.sh is trying to remove.
#
# Session key derivation is duplicated verbatim in chrome-tabgroup-clear.sh and
# chrome-tabgroup-stop.sh. Change all three together.

INPUT=$(cat)

TOOL=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    print(str(json.load(sys.stdin).get("tool_name", "")))
except Exception:
    print("")
' 2>/dev/null)

# Two tool classes:
#   - tabs_close_mcp: the clear hook's job. Skip entirely, or we would re-arm the
#     marker clear.sh is trying to remove.
#   - tabs_context_mcp: INVENTORY, not browsing. It creates the group and is also
#     how I check what is open right before closing. If it refreshed the idle
#     timer, polling context in a loop would keep the marker permanently fresh and
#     the Stop reminder would never fire (a LEAK). So context ensures the marker
#     EXISTS but does not bump its mtime.
# Everything else (navigate, computer, screenshot, javascript_tool, ...) is
# substantive browsing and refreshes the idle timer.
INVENTORY_ONLY=0
case "$TOOL" in
  *tabs_close_mcp) echo '{}'; exit 0 ;;
  *tabs_context_mcp) INVENTORY_ONLY=1 ;;
esac

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

# Reap only markers a WEEK old. A leftover marker from a dead session is harmless
# clutter - nothing but that session's own Stop hook ever reads it, and that hook
# is gone - so the only job here is to stop clutter accumulating. The window is 7
# days, not 1, because a shorter window can delete a LIVE session's marker: a
# session that opened a group and then did not touch the browser for a day is
# still alive and still owes a cleanup. Its own browsing refreshes its mtime, so
# 7 days without any browser activity is a safe "definitely done" threshold.
find "$HOME/.claude" -maxdepth 1 -name '.chrome-tabgroup.*' -mtime +7 -delete 2>/dev/null
find "$HOME/.claude" -maxdepth 1 -name '.chrome-tabgroup-reminded.*' ! -name '*.lock' -mtime +7 -delete 2>/dev/null
find "$HOME/.claude" -maxdepth 1 -type d -name '.chrome-tabgroup-reminded.*.lock' -mtime +7 -exec rmdir {} + 2>/dev/null

mkdir -p "$HOME/.claude"
if [ "$INVENTORY_ONLY" = "1" ]; then
  # Ensure the marker exists (a group was created) WITHOUT resetting the idle
  # timer - a bare inventory check is not browsing activity.
  [ -f "$MARKER" ] || : > "$MARKER"
else
  # Substantive browsing: create or refresh. Existence = "a group may be open",
  # mtime = "active now".
  : > "$MARKER"
fi

echo '{}'
