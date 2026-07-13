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
MODE=""
for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=1 ;;
    --headless) MODE=true ;;
    --owner) MODE=false ;;
    --help|-h)
      echo "Usage: justify-serve [--restart] [--headless|--owner]"
      echo
      echo "  --restart    safely restart the daemon (refuses mid-apply; preserves the armed watch)"
      echo "  --headless   the DAEMON applies queued batches itself (spawns justify-worker.sh)."
      echo "               For an unattended machine: no live session needed."
      echo "  --owner      DEFAULT. The daemon owns the queue but a batch waits, unclaimed,"
      echo "               for an attached owner (a session/agent) to claim and apply it."
      echo
      echo "The mode PERSISTS in watch-state.json and survives daemon restarts."
      echo "Check it any time with:  curl -s localhost:9223/status   ->  .headless / .autoApply"
      exit 0 ;;
  esac
done

state_json() { curl -s -m 3 "http://localhost:9223/watch/state" 2>/dev/null; }

# Apply a requested dispatch mode against a daemon that is already answering.
# Durable (persisted server-side) and takes effect on the LIVE dispatcher, so a
# batch already sitting in the queue dispatches immediately in --headless.
#
# ENABLING headless is gated on a live human at a TTY, exactly like
# justify-watch-disarm. Headless means the daemon will run `claude -p
# --permission-mode bypassPermissions` in the project root ON ITS OWN, with no
# session attached. An agent's shell has no TTY, so an agent cannot turn this on;
# it has to ask you. Turning it OFF needs no confirmation - the brake is always
# available.
apply_mode() {
  [ -n "$MODE" ] || return 0

  if [ "$MODE" = "false" ]; then
    curl -sf -m 5 -X POST "http://localhost:9223/watch/mode" \
      -H 'Content-Type: application/json' -d '{"headless":false}' >/dev/null 2>&1 || {
      echo "ERROR: could not set dispatch mode on the Justify daemon." >&2
      return 1
    }
    echo "dispatch mode: OWNER - queued batches WAIT for an attached owner to claim them."
    return 0
  fi

  # --headless from here down.
  if [ ! -t 0 ]; then
    echo "REFUSED: --headless must be run by a human at a TTY." >&2
    echo "It lets the daemon apply your queued batches autonomously (claude -p, bypassPermissions)," >&2
    echo "with no session attached. Run it yourself in your own terminal." >&2
    return 1
  fi

  PENDING="$(curl -s -m 3 "http://localhost:9223/status" 2>/dev/null | jget pendingCount)"
  echo
  echo "Enabling HEADLESS dispatch for the Justify daemon."
  echo "  The daemon will apply Send-All batches BY ITSELF - spawning 'claude -p' with"
  echo "  bypassPermissions in the armed project root, with no live session attached."
  if [ -n "$PENDING" ] && [ "$PENDING" != "0" ]; then
    echo
    echo "  WARNING: $PENDING prompt(s) are queued RIGHT NOW and will dispatch immediately."
    echo "  If a session is already applying one WITHOUT having claimed it"
    echo "  (POST /prompts/claim), it could be applied twice. Make sure nothing is mid-apply."
  fi
  echo
  printf 'Type ENABLE to confirm: '
  # `|| true`: under `set -e` a bare `read` that hits EOF (Ctrl-D) returns non-zero
  # and would kill the script before it could print the abort message.
  REPLY_TEXT=""
  read -r REPLY_TEXT || true
  if [ "$REPLY_TEXT" != "ENABLE" ]; then
    echo "Aborted. Dispatch mode unchanged." >&2
    return 1
  fi

  # WRITE the consent token to the state dir (0600) rather than asking the daemon
  # to mint one over HTTP. An HTTP mint endpoint would hand the key to whoever
  # knocks - including a hostile web page using a CORS simple request - which makes
  # the gate meaningless. Writing the file requires local filesystem access as this
  # user, which a browser can never have.
  BY="${USER:-unknown}"
  STATE_DIR="${JUSTIFY_STATE_DIR:-$HOME/.claude/justify}"
  CONSENT_FILE="$STATE_DIR/mode-consent.json"
  TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  if [ -z "$TOKEN" ]; then
    echo "ERROR: could not generate a consent token." >&2
    return 1
  fi
  mkdir -p "$STATE_DIR"
  ( umask 077
    TOKEN="$TOKEN" BY="$BY" CONSENT_FILE="$CONSENT_FILE" python3 -c '
import json, os, time
now = int(time.time() * 1000)
rec = {"token": os.environ["TOKEN"], "issuedAt": now,
       "issuedBy": os.environ["BY"], "expiresAt": now + 120000}
with open(os.environ["CONSENT_FILE"], "w") as f:
    json.dump(rec, f)
' ) || { echo "ERROR: could not write the consent token to $CONSENT_FILE." >&2; return 1; }
  chmod 600 "$CONSENT_FILE" 2>/dev/null || true

  curl -sf -m 5 -X POST "http://localhost:9223/watch/mode" \
    -H 'Content-Type: application/json' \
    -d "{\"headless\":true,\"consentToken\":\"$TOKEN\"}" >/dev/null 2>&1 || {
    echo "ERROR: the daemon refused to enable headless dispatch." >&2
    rm -f "$CONSENT_FILE" 2>/dev/null || true
    return 1
  }
  rm -f "$CONSENT_FILE" 2>/dev/null || true
  echo "dispatch mode: HEADLESS - the daemon will APPLY queued batches itself (no live session needed)."
  echo "Turn it back off any time with: justify-serve --owner"
  return 0
}
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
      apply_mode || exit 1
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
  apply_mode || exit 1
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
    apply_mode || exit 1
    exit 0
  fi
  sleep 0.3
done

echo "ERROR: justify daemon did not come up within ~6s; see $LOG" >&2
tail -5 "$LOG" 2>/dev/null || true
exit 1
