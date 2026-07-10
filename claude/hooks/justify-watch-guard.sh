#!/usr/bin/env bash
# justify-watch-guard - NON-BLOCKING advisory keyed off the DAEMON watch state.
#
# HISTORY / WHY THIS CHANGED (2026-07-08): this hook used to BLOCK a session's
# Stop event and nag it to relaunch a session-owned bash poller whenever
# ~/.claude/.justify-watch-on existed but no poller was alive. That was the
# disease, not the cure: the watch was session-owned, so a session-owned relaunch
# just recreated the failure (and it demonstrably left the watch dead-while-
# flagged-on). The watch now lives IN the persistent :9223 daemon (armed state on
# disk, daemon-spawned workers). So:
#   - Stop: NEVER block. A headless `claude -p` worker MUST be able to exit
#     cleanly; blocking Stop here would wedge the very worker the daemon spawns.
#   - SessionStart: a one-line, purely informational advisory IF the daemon watch
#     is armed. No relaunch, no flag file, no block. The daemon is the source of
#     truth; ~/.claude/.justify-watch-on is retired.
set -uo pipefail

INPUT="$(cat 2>/dev/null)"
EVENT="$(printf '%s' "$INPUT" | python3 -c 'import sys,json;
try: print(json.load(sys.stdin).get("hook_event_name",""))
except Exception: print("")' 2>/dev/null)"

# Stop / SubagentStop: never block. Exit silently.
if [ "$EVENT" = "Stop" ] || [ "$EVENT" = "SubagentStop" ]; then
  exit 0
fi

# SessionStart (or anything else): advisory only, keyed off the daemon.
PORT="${JUSTIFY_PORT:-9223}"
STATE="$(curl -s -m 2 "http://localhost:$PORT/watch/state" 2>/dev/null)"
[ -z "$STATE" ] && exit 0

ARMED="$(printf '%s' "$STATE" | python3 -c 'import sys,json;
try: d=json.load(sys.stdin)
except Exception: d={}
print("1" if d.get("armed") else "0")' 2>/dev/null)"

if [ "$ARMED" = "1" ]; then
  ROOT="$(printf '%s' "$STATE" | python3 -c 'import sys,json;
try: d=json.load(sys.stdin)
except Exception: d={}
print(d.get("projectRoot") or "")' 2>/dev/null)"
  echo "Justify watch is ARMED on the daemon${ROOT:+ for $ROOT} - it survives this session and applies Send-All batches headlessly. To stop it: say \"stop watching\" or run justify-watch-disarm."
fi
exit 0
