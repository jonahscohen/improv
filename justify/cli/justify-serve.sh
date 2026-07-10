#!/usr/bin/env bash
# justify-serve - ensure the Justify server runs as a PERSISTENT background
# daemon, decoupled from any Claude session's MCP lifecycle. This is the fix for
# "Justify vanished when the session ended": the server no longer dies with a
# session. It serves 9223 (ws + http: justify-core.js, /prompts, /respond,
# /activate, /status) and 9224 (https, for https-only sites).
#
# Idempotent: if Justify already answers on :9223, does nothing. Otherwise starts
# it with nohup and waits until it responds. Run it from /justify (and anytime
# you want Justify up).
#
# `justify-serve --restart` restarts the daemon SAFELY, which is the only
# sanctioned way to pick up new server code:
#   - it REFUSES while a worker is applying a batch (killing it would abandon the
#     user's queued changes),
#   - it preserves the armed watch (state is on disk) and VERIFIES it came back
#     armed on the same project before reporting success.
# Do not pkill the daemon; bash-guard.sh blocks that, and a blind kill can drop a
# batch mid-apply.
set -euo pipefail

SERVER="${JUSTIFY_SERVER:-$HOME/.claude/justify/dist/server/index.js}"
LOG="${JUSTIFY_LOG:-$HOME/.claude/justify/daemon.log}"
RESTART=0
for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=1 ;;
    --help|-h) echo "Usage: justify-serve [--restart]"; exit 0 ;;
  esac
done

state_json() { curl -s -m 3 "http://localhost:9223/watch/state" 2>/dev/null; }
jget() { python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
cur=d
for k in sys.argv[1].split("."):
    cur=(cur or {}).get(k) if isinstance(cur,dict) else None
print("" if cur is None else cur)' "$1" 2>/dev/null; }

if [ "$RESTART" = "1" ] && curl -s -o /dev/null -m 2 "http://localhost:9223/status" 2>/dev/null; then
  BEFORE="$(state_json)"
  WAS_ARMED="$(printf '%s' "$BEFORE" | jget armed)"
  WAS_ROOT="$(printf '%s' "$BEFORE" | jget projectRoot)"
  WORKER="$(printf '%s' "$BEFORE" | jget dispatch.workerRunning)"

  if [ "$WORKER" = "True" ] || [ "$WORKER" = "true" ]; then
    echo "REFUSED: a Justify worker is applying a batch right now." >&2
    echo "Restarting would abandon the user's queued changes. Wait for it to finish." >&2
    exit 2
  fi

  PID="$(lsof -ti tcp:9223 -sTCP:LISTEN 2>/dev/null | head -1)"
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    for _ in $(seq 1 30); do
      curl -s -o /dev/null -m 1 "http://localhost:9223/status" 2>/dev/null || break
      sleep 0.2
    done
  fi

  mkdir -p "$(dirname "$LOG")"
  nohup node "$SERVER" > "$LOG" 2>&1 &
  NEWPID=$!
  for _ in $(seq 1 30); do
    if curl -s -o /dev/null -m 1 "http://localhost:9223/status" 2>/dev/null; then
      AFTER="$(state_json)"
      NOW_ARMED="$(printf '%s' "$AFTER" | jget armed)"
      NOW_ROOT="$(printf '%s' "$AFTER" | jget projectRoot)"
      echo "justify daemon restarted (pid $NEWPID)."
      if [ "$WAS_ARMED" = "True" ] || [ "$WAS_ARMED" = "true" ]; then
        if { [ "$NOW_ARMED" = "True" ] || [ "$NOW_ARMED" = "true" ]; } && [ "$NOW_ROOT" = "$WAS_ROOT" ]; then
          echo "watch resumed ARMED for $NOW_ROOT"
          exit 0
        fi
        echo "ERROR: the watch did NOT resume armed (was $WAS_ROOT). Re-arm immediately: justify-watch-arm $WAS_ROOT" >&2
        exit 1
      fi
      exit 0
    fi
    sleep 0.3
  done
  echo "ERROR: justify daemon did not come back up; see $LOG" >&2
  exit 1
fi

if curl -s -o /dev/null -m 2 "http://localhost:9223/status" 2>/dev/null; then
  echo "justify daemon already running on :9223"
  exit 0
fi

if [ ! -f "$SERVER" ]; then
  echo "ERROR: justify server not built at $SERVER - run justify/install.sh first." >&2
  exit 1
fi

mkdir -p "$(dirname "$LOG")"
nohup node "$SERVER" > "$LOG" 2>&1 &
PID=$!

for _ in $(seq 1 20); do
  if curl -s -o /dev/null -m 1 "http://localhost:9223/status" 2>/dev/null; then
    echo "justify daemon started (pid $PID) on :9223 (http) / :9224 (https)"
    exit 0
  fi
  sleep 0.3
done

echo "ERROR: justify daemon did not come up within ~6s; see $LOG" >&2
tail -5 "$LOG" 2>/dev/null || true
exit 1
