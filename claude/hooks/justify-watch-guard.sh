#!/usr/bin/env bash
# justify-watch-guard: keeps the Justify watch alive mechanically.
# State flag ~/.claude/.justify-watch-on means "the user wants the watch
# running". If the flag exists but no justify-watch.sh process is alive:
#   - Stop event: BLOCK the turn from ending until the session relaunches it.
#   - SessionStart: inject a reminder so a fresh session relaunches it.
# The flag is only ever removed with explicit user consent to end the watch.
ON_FLAG="$HOME/.claude/.justify-watch-on"
[ ! -f "$ON_FLAG" ] && exit 0
INPUT=$(cat 2>/dev/null)
# Per-session opt-out (multi-session support): a session id listed in
# ~/.claude/.justify-watch-optout is NOT the designated watcher - e.g. a worker
# session focused on Justify itself while ANOTHER session owns the watch loop.
# Such a session must never be forced to relaunch the poller (that would make it
# a second watcher racing the one queue). The designated watcher is NOT in the
# file, so its guard still works. No file => unchanged single-session behavior.
SID=$(printf '%s' "$INPUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
OPTOUT="$HOME/.claude/.justify-watch-optout"
if [ -n "$SID" ] && [ -f "$OPTOUT" ] && grep -qF "$SID" "$OPTOUT" 2>/dev/null; then
  exit 0
fi
if pgrep -f "justify-watch.sh" > /dev/null 2>&1; then
  exit 0
fi
EVENT=$(printf '%s' "$INPUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('hook_event_name',''))" 2>/dev/null)
if [ "$EVENT" = "Stop" ]; then
  printf '%s\n' '{"decision":"block","reason":"JUSTIFY WATCH IS DOWN but flagged ON. Relaunch it NOW: Bash run_in_background -> ~/.claude/justify-watch.sh. Only remove ~/.claude/.justify-watch-on if the USER explicitly consents to ending the watch."}'
  exit 0
fi
echo "JUSTIFY WATCH: flagged ON (~/.claude/.justify-watch-on) but no poller is running. Relaunch ~/.claude/justify-watch.sh via Bash run_in_background:true before doing anything else."
exit 0
