#!/bin/bash
# test-installer-gui-server.sh - verification of the localhost GUI installer server
# (claude/installer-gui/server.py).
#
# The server serves the page, proxies `install.sh --manifest`, and runs applies via
# `install.sh --apply-plan`, streaming the log. It holds NO install logic of its own.
# It is bound to 127.0.0.1 only; every state route requires the one-time startup nonce.
# This test covers the server's own contract: it boots, /health is open, and every state
# route is gated by the nonce.
#
# Port-collision safe: the server is started with an EPHEMERAL port (--port 0) and the
# real URL (host:port + token) is read back from a --print-url file, so nothing is
# hardcoded and two runs never fight over a port.
#
# Assertions:
#   1. Server boots and GET /health (no token) returns JSON reporting bind host 127.0.0.1.
#   2. GET /manifest WITHOUT the token returns HTTP 403.
#   3. GET /manifest?token=<nonce> returns valid JSON.
#
# Exit codes:
#   0  all assertions passed
#   1  one or more assertions failed
#   2  harness/setup error (repo layout wrong, python3/curl missing, server never bound)

set -u

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER="$REPO_DIR/claude/installer-gui/server.py"

PASS=0
FAIL=0
pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

command -v python3 >/dev/null 2>&1 || { echo "SETUP-FAIL: python3 required"; exit 2; }
command -v curl    >/dev/null 2>&1 || { echo "SETUP-FAIL: curl required"; exit 2; }
[ -f "$SERVER" ] || { echo "FAIL: server.py not found at $SERVER (unimplemented)"; exit 1; }

TMPD="$(mktemp -d)"
URLFILE="$TMPD/url"
NONCEFILE="$TMPD/nonce"
LOGFILE="$TMPD/server.log"
SRV_PID=""

cleanup() {
  [ -n "$SRV_PID" ] && kill "$SRV_PID" >/dev/null 2>&1
  [ -n "$SRV_PID" ] && wait "$SRV_PID" 2>/dev/null
  rm -rf "$TMPD"
}
trap cleanup EXIT INT TERM

# --- boot the server on an ephemeral port ------------------------------------------------
python3 "$SERVER" --repo "$REPO_DIR" --port 0 \
  --print-url "$URLFILE" --print-nonce "$NONCEFILE" >"$LOGFILE" 2>&1 &
SRV_PID=$!

# Wait until the URL file is populated (server writes it just before serving). Bounded so a
# server that never binds fails the harness rather than hanging.
for _ in $(seq 1 50); do
  [ -s "$URLFILE" ] && break
  kill -0 "$SRV_PID" >/dev/null 2>&1 || { echo "SETUP-FAIL: server exited early; log:"; cat "$LOGFILE"; exit 2; }
  sleep 0.1
done
[ -s "$URLFILE" ] || { echo "SETUP-FAIL: server never wrote --print-url; log:"; cat "$LOGFILE"; exit 2; }

URL="$(cat "$URLFILE")"
NONCE="$(cat "$NONCEFILE")"

# Parse host, port, and token out of the URL so nothing is hardcoded.
read -r HOST PORT TOKEN < <(URL="$URL" python3 -c '
import os
from urllib.parse import urlparse, parse_qs
u = urlparse(os.environ["URL"])
q = parse_qs(u.query)
print(u.hostname, u.port, q.get("token", [""])[0])
')
[ -n "$PORT" ] || { echo "SETUP-FAIL: could not parse port from URL: $URL"; exit 2; }
[ "$TOKEN" = "$NONCE" ] || { echo "SETUP-FAIL: URL token != --print-nonce file"; exit 2; }
BASE="http://$HOST:$PORT"

# Poll /health until the socket is actually accepting connections (bounded).
for _ in $(seq 1 50); do
  curl -s -o /dev/null "$BASE/health" && break
  sleep 0.1
done

echo "== Assertion 1: GET /health (no token) returns JSON with bind host 127.0.0.1 =="
HEALTH="$(curl -s "$BASE/health")"
HCODE="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")"
[ "$HCODE" = "200" ] && pass "/health returns 200 without a token" || fail "/health code was $HCODE (want 200)"
BIND="$(printf '%s' "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("bind",""))' 2>/dev/null)"
[ "$BIND" = "127.0.0.1" ] && pass "/health reports bind host 127.0.0.1" || fail "/health bind was '$BIND' (want 127.0.0.1); body: $HEALTH"

echo
echo "== Assertion 2: GET /manifest WITHOUT token returns 403 =="
MCODE_NOTOK="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/manifest")"
[ "$MCODE_NOTOK" = "403" ] && pass "/manifest without token is 403" || fail "/manifest without token code was $MCODE_NOTOK (want 403)"

echo
echo "== Assertion 3: GET /manifest?token=<nonce> returns valid JSON =="
MCODE_TOK="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/manifest?token=$TOKEN")"
[ "$MCODE_TOK" = "200" ] && pass "/manifest with token is 200" || fail "/manifest with token code was $MCODE_TOK (want 200)"
MBODY="$(curl -s "$BASE/manifest?token=$TOKEN")"
if printf '%s' "$MBODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert isinstance(d,dict) and "buckets" in d and "state" in d' 2>/dev/null; then
  pass "/manifest with token is valid manifest JSON (has buckets+state)"
else
  fail "/manifest with token was not valid manifest JSON; body head: $(printf '%s' "$MBODY" | head -c 200)"
fi

# Bonus: a wrong token must also be 403 (proves the gate checks the value, not mere presence).
echo
echo "== Assertion 4: GET /manifest?token=<wrong> returns 403 =="
MCODE_BAD="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/manifest?token=not-the-real-nonce")"
[ "$MCODE_BAD" = "403" ] && pass "/manifest with wrong token is 403" || fail "/manifest with wrong token code was $MCODE_BAD (want 403)"

echo
echo "TALLY: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
echo "ALL INSTALLER-GUI-SERVER CHECKS PASSED"
exit 0
