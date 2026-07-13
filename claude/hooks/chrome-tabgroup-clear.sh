#!/usr/bin/env bash
#
# chrome-tabgroup-clear.sh - PostToolUse on mcp__claude-in-chrome__tabs_close_mcp.
#
# When I close a tab, decide from the tool RESULT whether the group is now empty.
# tabs_close_mcp reports either "Group is now empty (auto-removed)" or
# "N tab(s) remain". If empty, the group is gone: drop the marker and the reminded
# flag, so the Stop hook stays quiet. If tabs remain, the group is still open, so
# refresh the marker mtime (reset the idle timer) rather than clearing - the
# remaining tabs still deserve a later reminder once I go idle.
#
# On an unparseable result, default to KEEPING the marker (refreshed). The whole
# point of this trio is to not leave tab groups open, so erring toward one extra
# reminder is the right direction; erring toward silence would leak the group.
#
# Session key derivation is duplicated verbatim in chrome-tabgroup-track.sh and
# chrome-tabgroup-stop.sh. Change all three together.

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

MARKER="$HOME/.claude/.chrome-tabgroup.$SESSION_KEY"
REMINDED="$HOME/.claude/.chrome-tabgroup-reminded.$SESSION_KEY"

# Classify the close from the tool_response. The result carries the close status
# PLUS a "Tab Context" listing the remaining tabs' titles and URLs, so a loose
# substring search over the whole blob is unsafe: a remaining tab titled
# "Cart is now empty" would match an empty-phrase and make us wipe a marker while
# the group is still open (a LEAK, the exact failure this hook exists to prevent).
#
# Anchor to the tool's literal status phrasing, and check "remain" FIRST: if the
# result says "N tab(s) remain" the group is open, full stop, whatever any tab is
# titled. Only the specific "auto-removed" phrase (which the tool prints when the
# last tab closes) means empty; it is far too specific to appear in a page title.
EMPTY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("unknown"); sys.exit(0)
blob = json.dumps(d.get("tool_response", d.get("tool_result", ""))).lower()
if re.search(r"tab\(s\)\s*remain|tabs\s*remain", blob):
    print("remain")
elif "auto-removed" in blob:
    print("empty")
else:
    print("unknown")
' 2>/dev/null)

if [ "$EMPTY" = "empty" ]; then
  # Drop everything so a later open-group burst in this same session can be
  # reminded again: the marker, the reminded flag, and the atomic-block lock dir.
  rm -f "$MARKER" "$REMINDED"
  rmdir "$REMINDED.lock" 2>/dev/null || true
else
  # tabs remain, or result unparseable: group may still be open. Keep the marker,
  # reset its idle timer so a fresh reminder can fire later.
  mkdir -p "$HOME/.claude"
  [ -f "$MARKER" ] && : > "$MARKER"
fi

echo '{}'
