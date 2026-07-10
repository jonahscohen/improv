#!/usr/bin/env bash
# justify-watch-disarm - stop the daemon-owned Justify watch.
#
# THE WATCH IS THE PRODUCT. While it is armed the daemon applies every browser
# Send-All batch, across session teardowns, with zero live Claude sessions. While
# it is disarmed, Justify silently receives nothing. So disarming requires a
# HUMAN, here, now:
#
#   1. stdin must be a TTY. An agent's shell (Claude's Bash tool, a headless
#      worker, CI) is not a TTY, so an agent cannot get past that check.
#   2. the human types the confirmation phrase.
#   3. only then do we mint a single-use, ~2-minute consent token from the daemon
#      and immediately spend it on POST /watch/disarm.
#
# The daemon independently refuses any disarm without that token (see
# server/consent.ts + server/watch-state.ts), so this script is the ergonomics,
# not the security boundary. There is no --force and there will not be one.
#
# Usage:  justify-watch-disarm
# Env:    JUSTIFY_PORT (default 9223), JUSTIFY_ARMED_BY (default git user / $USER)
set -uo pipefail

PORT="${JUSTIFY_PORT:-9223}"
BY="${JUSTIFY_ARMED_BY:-$(git config user.name 2>/dev/null || printf '%s' "${USER:-unknown}")}"
PHRASE="DISARM"

if ! curl -s -o /dev/null -m 3 "http://localhost:$PORT/status" 2>/dev/null; then
  echo "ERROR: the Justify daemon is not answering on :$PORT. Nothing to disarm." >&2
  exit 1
fi

STATE="$(curl -s -m 5 "http://localhost:$PORT/watch/state" 2>/dev/null)"
ARMED="$(printf '%s' "$STATE" | python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
print("1" if d.get("armed") else "0")' 2>/dev/null)"
ROOT="$(printf '%s' "$STATE" | python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
print(d.get("projectRoot") or "")' 2>/dev/null)"

if [ "$ARMED" != "1" ]; then
  echo "The Justify watch is already disarmed. Nothing to do."
  exit 0
fi

# ---- the human gate ---------------------------------------------------------
# No TTY => not a human. Refuse, loudly, and explain. This is the line an agent
# hits.
if [ ! -t 0 ]; then
  cat >&2 <<EOF
REFUSED: justify-watch-disarm needs a human.

stdin is not a terminal, so this is an agent, a script, or a headless worker.
Disarming the watch stops Justify from receiving the user's changes, silently.
Only the user may do that.

The watch is STILL ARMED for: ${ROOT:-<unknown>}

If you are an agent: tell the user to run 'justify-watch-disarm' themselves.
Do not try to work around this. The daemon will refuse you anyway.
EOF
  exit 3
fi

echo "This will STOP Justify from watching ${ROOT:-<unknown>}."
echo "Send-All batches from the browser will queue and will NOT be applied until you re-arm."
echo
printf "Type %s to confirm (anything else cancels): " "$PHRASE"
read -r answer

if [ "$answer" != "$PHRASE" ]; then
  echo "Cancelled. The watch is still armed."
  exit 4
fi

# ---- mint + immediately spend a single-use consent token ---------------------
CONSENT_BODY="$(BY="$BY" python3 -c 'import os,json; print(json.dumps({"by":os.environ["BY"]}))')"
CONSENT="$(curl -s -m 5 -X POST "http://localhost:$PORT/watch/consent" -H 'Content-Type: application/json' -d "$CONSENT_BODY" 2>/dev/null)"
TOKEN="$(printf '%s' "$CONSENT" | python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
print(d.get("token") or "")' 2>/dev/null)"

if [ -z "$TOKEN" ]; then
  echo "ERROR: the daemon did not issue a consent token. The watch is still armed." >&2
  echo "Daemon response: $CONSENT" >&2
  exit 1
fi

BODY="$(BY="$BY" TOKEN="$TOKEN" python3 -c 'import os,json; print(json.dumps({"by":os.environ["BY"],"consentToken":os.environ["TOKEN"]}))')"
RESP="$(curl -s -m 5 -X POST "http://localhost:$PORT/watch/disarm" -H 'Content-Type: application/json' -d "$BODY" 2>/dev/null)"

if [ -z "$RESP" ]; then
  echo "ERROR: could not reach the Justify daemon on :$PORT to disarm." >&2
  exit 1
fi

# Require ok:true (durably persisted) AND armed:false. A persist failure returns
# 500 with ok:false (and armed left true by the fail-closed store), so this does
# not falsely report a disarm that did not take.
DISARMED="$(printf '%s' "$RESP" | python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
print("1" if d.get("ok") and d.get("armed") is False else "0")' 2>/dev/null)"

if [ "$DISARMED" = "1" ]; then
  echo "Justify watch DISARMED. Send-All batches will queue until you re-arm (justify-watch-arm / \"watch justify\")."
  exit 0
fi

echo "ERROR: disarm did not take. The watch is still armed. Daemon response: $RESP" >&2
exit 1
