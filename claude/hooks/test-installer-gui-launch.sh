#!/bin/bash
# test-installer-gui-launch.sh - verification of install.sh --gui, the launcher that
# starts the localhost GUI server (claude/installer-gui/server.py), waits for its URL,
# opens the browser, and blocks in the foreground until Ctrl-C.
#
# This test proves the launcher actually wires and starts server.py: it runs the launcher
# in the background with AMPERSAND_GUI_NO_OPEN=1 (so no real browser window spawns), reads
# the "GUI installer running at http://127.0.0.1:<port>/?token=..." line the LAUNCHER prints
# (that line only appears after the launcher has waited for and read the server's URL file),
# then curls the server's open /health route at that host:port and asserts HTTP 200 with
# bind host 127.0.0.1. Health passing at the launcher-reported URL is end-to-end proof that
# --gui started server.py and reported the right address.
#
# Port-collision safe: the launcher starts server.py on an EPHEMERAL port (--port defaults
# to 0), so two runs never fight over a port and nothing is hardcoded.
#
# Process hygiene: the launcher (bash install.sh --gui) and its child (python server.py)
# are tracked by PID and killed explicitly on exit, so no stray server is left listening.
# The EXIT trap re-kills idempotently as a backstop. PIDs are tracked rather than a blanket
# `pkill -f installer-gui/server.py` so a concurrent GUI-server test is never disturbed.
#
# Assertions:
#   1. The launcher prints "GUI installer running at http://127.0.0.1:<port>/?token=..."
#      (proves it started server.py and read back its URL).
#   2. GET /health at the launcher-reported host:port returns HTTP 200.
#   3. /health JSON reports bind host 127.0.0.1.
#
# Exit codes:
#   0  all assertions passed
#   1  one or more assertions failed
#   2  harness/setup error (repo layout wrong, python3/curl missing, launcher never started)

set -u

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"

PASS=0
FAIL=0
pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

command -v python3 >/dev/null 2>&1 || { echo "SETUP-FAIL: python3 required"; exit 2; }
command -v curl    >/dev/null 2>&1 || { echo "SETUP-FAIL: curl required"; exit 2; }
[ -f "$INSTALL" ] || { echo "SETUP-FAIL: install.sh not found at $INSTALL"; exit 2; }

TMPD="$(mktemp -d)"
STDOUT="$TMPD/launcher.out"
LAUNCHER_PID=""
SERVER_PID=""

cleanup() {
  # Kill the child server first so the launcher's `wait` returns, then the launcher itself.
  # Both are re-killed idempotently here so a failure anywhere above never leaks a process.
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" >/dev/null 2>&1
  [ -n "$LAUNCHER_PID" ] && kill "$LAUNCHER_PID" >/dev/null 2>&1
  # Backstop: any server child still parented to the launcher (covers a missed SERVER_PID).
  if [ -n "$LAUNCHER_PID" ]; then
    for _p in $(pgrep -P "$LAUNCHER_PID" 2>/dev/null); do kill "$_p" >/dev/null 2>&1; done
  fi
  [ -n "$SERVER_PID" ] && wait "$SERVER_PID" 2>/dev/null
  [ -n "$LAUNCHER_PID" ] && wait "$LAUNCHER_PID" 2>/dev/null
  rm -rf "$TMPD"
}
trap cleanup EXIT INT TERM

# --- start the launcher in the background ------------------------------------------------
# AMPERSAND_GUI_NO_OPEN=1 suppresses the `open` browser launch so this stays headless.
AMPERSAND_GUI_NO_OPEN=1 bash "$INSTALL" --gui >"$STDOUT" 2>&1 &
LAUNCHER_PID=$!

# Poll the launcher's stdout (up to ~8s) for the URL line it prints once server.py is up.
URL=""
for _ in $(seq 1 80); do
  if grep -aq 'GUI installer running at http://127\.0\.0\.1:' "$STDOUT"; then
    URL="$(grep -a 'GUI installer running at' "$STDOUT" | head -1 \
           | grep -o 'http://127\.0\.0\.1:[0-9][0-9]*/[^[:space:]]*')"
    [ -n "$URL" ] && break
  fi
  kill -0 "$LAUNCHER_PID" >/dev/null 2>&1 || { echo "SETUP-FAIL: launcher exited early; output:"; cat "$STDOUT"; exit 2; }
  sleep 0.1
done

echo "== Assertion 1: launcher reports the GUI server URL on 127.0.0.1 =="
if [ -n "$URL" ]; then
  pass "launcher printed URL: $URL"
else
  fail "launcher never printed a 127.0.0.1 GUI URL; output: $(cat "$STDOUT")"
  echo
  echo "TALLY: $PASS passed, $FAIL failed"
  exit 1
fi

# Capture the child server PID (parented to the launcher) for explicit teardown.
SERVER_PID="$(pgrep -P "$LAUNCHER_PID" -f 'installer-gui/server.py' 2>/dev/null | head -1)"

# Parse host and port out of the launcher-reported URL so nothing is hardcoded.
read -r HOST PORT < <(URL="$URL" python3 -c '
import os
from urllib.parse import urlparse
u = urlparse(os.environ["URL"])
print(u.hostname, u.port)
')
[ -n "${PORT:-}" ] || { echo "SETUP-FAIL: could not parse port from URL: $URL"; exit 2; }
BASE="http://$HOST:$PORT"

# Poll /health until the socket is actually accepting connections (bounded).
for _ in $(seq 1 50); do
  curl -s -o /dev/null "$BASE/health" && break
  sleep 0.1
done

echo
echo "== Assertion 2: GET /health at the launcher-reported host:port returns 200 =="
HCODE="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")"
[ "$HCODE" = "200" ] && pass "/health returns 200 (launcher wired server.py)" || fail "/health code was $HCODE (want 200)"

echo
echo "== Assertion 3: /health JSON reports bind host 127.0.0.1 =="
HEALTH="$(curl -s "$BASE/health")"
BIND="$(printf '%s' "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("bind",""))' 2>/dev/null)"
[ "$BIND" = "127.0.0.1" ] && pass "/health reports bind host 127.0.0.1" || fail "/health bind was '$BIND' (want 127.0.0.1); body: $HEALTH"

echo
echo "TALLY: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
echo "ALL INSTALLER-GUI-LAUNCH CHECKS PASSED"
exit 0
