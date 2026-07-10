#!/usr/bin/env bash
# justify-watch-arm - arm the DAEMON-OWNED Justify watch for a project.
#
# This is the CLI/HTTP arming path (chat "watch justify" is the other one). Once
# armed, the persistent :9223 daemon owns the watch: it dispatches a headless
# worker for every browser Send-All batch and KEEPS DOING SO across session
# teardowns and harness turn boundaries. The watch never stops until an explicit
# disarm (justify-watch-disarm, or chat "stop watching"). Armed state is
# persisted to disk, so a daemon restart resumes armed.
#
# Usage:  justify-watch-arm [project-root]   (default: $PWD)
# Env:    JUSTIFY_PORT (default 9223), JUSTIFY_ARMED_BY (default git user / $USER)
set -uo pipefail

PORT="${JUSTIFY_PORT:-9223}"
ROOT_IN="${1:-$PWD}"
ROOT="$(cd "$ROOT_IN" 2>/dev/null && pwd || printf '%s' "$ROOT_IN")"
BY="${JUSTIFY_ARMED_BY:-$(git -C "$ROOT" config user.name 2>/dev/null || printf '%s' "${USER:-unknown}")}"

# Ensure the daemon is up (idempotent).
if ! curl -s -o /dev/null -m 2 "http://localhost:$PORT/status" 2>/dev/null; then
  if command -v justify-serve >/dev/null 2>&1; then
    justify-serve >/dev/null 2>&1 || true
  fi
fi

BODY="$(ROOT="$ROOT" BY="$BY" python3 -c 'import os,json; print(json.dumps({"projectRoot":os.environ["ROOT"],"by":os.environ["BY"]}))')"
RESP="$(curl -s -m 5 -X POST "http://localhost:$PORT/watch/arm" -H 'Content-Type: application/json' -d "$BODY" 2>/dev/null)"

if [ -z "$RESP" ]; then
  echo "ERROR: could not reach the Justify daemon on :$PORT to arm the watch." >&2
  echo "Start it with 'justify-serve' and retry." >&2
  exit 1
fi

# Require BOTH ok:true (the endpoint durably persisted) AND armed:true. On a
# persist failure the endpoint returns 500 with ok:false, so this correctly
# reports the arm did NOT take rather than a false success.
OK="$(printf '%s' "$RESP" | python3 -c 'import sys,json;
try: d=json.load(sys.stdin)
except Exception: d={}
print("1" if d.get("ok") and d.get("armed") else "0")' 2>/dev/null)"

if [ "$OK" = "1" ]; then
  echo "Justify watch ARMED for $ROOT."
  echo "The daemon will apply every browser Send-All batch until you disarm"
  echo "(justify-watch-disarm, or tell Claude \"stop watching\"). Survives session end."
  exit 0
fi

echo "ERROR: arm did not take. Daemon response: $RESP" >&2
exit 1
