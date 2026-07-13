#!/usr/bin/env bash
# justify-watch - "watch justify" entrypoint. ARMS the daemon-owned watch.
#
# HISTORY: this used to be a forever poll loop OWNED BY A CLAUDE SESSION - it
# died with the session and a Stop hook nagged sessions to relaunch it, which
# just recreated the disease. The watch now lives IN the persistent :9223 daemon.
# "watch justify" arms that daemon, and the QUEUE then survives every session
# teardown: prompts are durable and are never dropped. This command is a thin
# wrapper over justify-watch-arm so the phrase users know ("watch justify" arms,
# "stop watching" disarms) still works end to end.
#
# WHO APPLIES A BATCH depends on the dispatch mode, and arming alone does NOT
# mean the daemon will apply anything:
#   OWNER mode (default) - the batch waits UNCLAIMED for an attached owner (the
#     session or agent that armed the watch) to claim and apply it. With no owner
#     attached, a queued batch sits there, and /status reports stalled:true. That
#     is honest, not broken.
#   HEADLESS mode - the daemon spawns justify-worker.sh per batch and applies it
#     with no live session. Turn it on with `justify-serve --headless`.
# Check which one you are in: curl -s localhost:9223/status -> .headless/.autoApply
set -uo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
for cand in \
  "$SELF_DIR/justify-watch-arm.sh" \
  "$SELF_DIR/cli/justify-watch-arm.sh" \
  "$HOME/.claude/justify/justify-watch-arm.sh"; do
  if [ -x "$cand" ] || [ -f "$cand" ]; then
    exec bash "$cand" "$@"
  fi
done

# Fallback: arm inline if the arm script is somehow missing.
PORT="${JUSTIFY_PORT:-9223}"
ROOT="$(cd "${1:-$PWD}" 2>/dev/null && pwd || printf '%s' "${1:-$PWD}")"
BY="${JUSTIFY_ARMED_BY:-$(git -C "$ROOT" config user.name 2>/dev/null || printf '%s' "${USER:-unknown}")}"
BODY="$(ROOT="$ROOT" BY="$BY" python3 -c 'import os,json; print(json.dumps({"projectRoot":os.environ["ROOT"],"by":os.environ["BY"]}))')"
# --fail so an HTTP 500 (persist failure) is treated as an error, not a false OK.
curl -sf -m 5 -X POST "http://localhost:$PORT/watch/arm" -H 'Content-Type: application/json' -d "$BODY" >/dev/null 2>&1 \
  && echo "Justify watch ARMED for $ROOT (daemon-owned; survives session end)." \
  || { echo "ERROR: arm failed or could not reach the Justify daemon on :$PORT." >&2; exit 1; }
