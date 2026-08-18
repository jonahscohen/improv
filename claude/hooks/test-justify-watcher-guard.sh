#!/usr/bin/env bash
# test-justify-watcher-guard.sh - proves the justify-WATCHER-shutdown protection.
#
# THE RULE (Jonah, 2026-08-17): a Justify-watching agent (a justify-* watcher teammate)
# must NOT be shut down by a managing/lead/peer agent. Only the human USER's direct command
# may stop it. This suite proves every agent path is blocked and the sanctioned USER path
# still works.
#
# Covers:
#   guard (SendMessage)  shutdown_request to justify-* -> DENY; to a non-watcher -> allow;
#                        a plain message to a watcher -> allow; a stringified shutdown -> DENY.
#   guard (Write)        forging the consent token file -> DENY; a SYMLINK alias to it -> DENY
#                        (Finding 6, realpath-aware); an unrelated write -> allow.
#   consent helper       no token -> 1; valid -> 0; expired -> 1; wrong target -> 1; consume
#                        deletes; consume is FAIL-CLOSED when it cannot delete (Finding 8).
#   guard consent path   a USER token authorises ONE shutdown then is spent (single-use).
#   bash-guard           kill <pid-of-a-fake-justify-agent> -> DENY; the `kill -- -PID` group
#                        form -> DENY (Finding 3); a token for ONE watcher does NOT authorise a
#                        multi-watcher kill and is not spent by the denied kill, a '*' token does
#                        (Finding 4); kill non-watcher -> allow; forging the token via
#                        redirect/tee/cp -> DENY; running the justify-watcher-shutdown CLI as an
#                        agent (direct / bash -c / env-prefix) -> DENY, prose about it -> allow
#                        (Finding 1); consent override single-use; REGRESSION: existing justify
#                        daemon/worker + disarm gates still DENY.
#   CLI                  non-TTY (agent) invocation -> REFUSED (exit 3); --list works; syntax OK.
#
# Exit 0 = all pass. Exit 1 = a failure. The suite writes ONLY to a throwaway token path via
# the real minting shape and always cleans it up.
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$REPO_DIR/claude/hooks/justify-watcher-guard.sh"
BASHG="$REPO_DIR/claude/hooks/bash-guard.sh"
CONSENT="$REPO_DIR/claude/hooks/justify-watcher-consent.py"
CLI="$REPO_DIR/justify/cli/justify-watcher-shutdown.sh"
TOKEN="$HOME/.claude/.justify-watcher-shutdown-consent"
DEPLOYED_CONSENT="$HOME/.claude/hooks/justify-watcher-consent.py"

command -v python3 >/dev/null 2>&1 || { echo "FATAL: python3 required"; exit 2; }

pass=0; fail=0
ok()  { echo "PASS $1"; pass=$((pass+1)); }
bad() { echo "FAIL $1"; fail=$((fail+1)); }

# decision <hook> <json-string> -> echoes "deny" or "allow"
decision() {
  printf '%s' "$2" | "$1" 2>/dev/null | python3 -c 'import sys,json
s=sys.stdin.read().strip()
try: d=json.loads(s)
except Exception: print("allow"); raise SystemExit
print(d.get("hookSpecificOutput",{}).get("permissionDecision","allow"))'
}

# chk <label> <expected deny|allow> <hook> <json-string>. The substitution lands in a plain
# assignment (quote-safe), never inside `[ ... ]`, so JSON with embedded quotes/vars is fine.
chk() {
  local got; got="$(decision "$3" "$4")"
  [ "$got" = "$2" ] && ok "$1" || bad "$1 (expected $2, got '$got')"
}

mint() {  # mint <target> <ttl_seconds>
  TARGET="$1" TTL="$2" python3 - <<'PY'
import json, os, time, secrets
p=os.path.expanduser("~/.claude/.justify-watcher-shutdown-consent")
json.dump({"target":os.environ["TARGET"],"expires":time.time()+float(os.environ["TTL"]),
           "nonce":secrets.token_hex(8),"by":"test","created":time.time()}, open(p,"w"))
os.chmod(p,0o600)
PY
}

rm -f "$TOKEN"

# ---------------------------------------------------------------------------
echo "## guard: SendMessage"
chk "shutdown_request to justify-warden is DENIED" deny "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-warden","message":{"type":"shutdown_request"}}}'
chk "shutdown_request to justify-owner is DENIED" deny "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-owner","message":{"type":"shutdown_request","reason":"x"}}}'
chk "shutdown to justify-warden@session (suffix) is DENIED" deny "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-warden@session-6b824b79","message":{"type":"shutdown_request"}}}'
chk "stringified shutdown_request is DENIED" deny "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-owner","message":"{\"type\":\"shutdown_request\"}"}}'
chk "shutdown_request to a non-watcher is ALLOWED" allow "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"researcher","message":{"type":"shutdown_request"}}}'
chk "plain message to a watcher is ALLOWED" allow "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-warden","message":"how is the queue?"}}'

echo "## guard: Write (consent-token forge)"
chk "Write to the consent token is DENIED" deny "$GUARD" \
  "$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' "$TOKEN")"
chk "Write to an unrelated file is ALLOWED" allow "$GUARD" \
  '{"tool_name":"Write","tool_input":{"file_path":"/tmp/x.txt","content":"x"}}'
# Finding 6 (Codex 2026-08-17): a symlink ALIAS to the token must not dodge the path compare.
_JWLINK="$(mktemp -u /tmp/jwlink.XXXXXX)"; ln -s "$TOKEN" "$_JWLINK"
chk "Write to a symlink aliasing the token is DENIED (realpath-aware)" deny "$GUARD" \
  "$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' "$_JWLINK")"
rm -f "$_JWLINK"

echo "## consent helper: check / consume / expire / target"
rm -f "$TOKEN"
python3 "$CONSENT" check justify-warden; [ $? -eq 1 ] && ok "no token -> check exits 1" || bad "no token -> check exits 1"
mint justify-warden 120
python3 "$CONSENT" check justify-warden; [ $? -eq 0 ] && ok "valid token -> check exits 0" || bad "valid token -> check exits 0"
python3 "$CONSENT" check justify-owner; [ $? -eq 1 ] && ok "wrong target -> check exits 1" || bad "wrong target -> check exits 1"
python3 "$CONSENT" consume justify-warden; [ $? -eq 0 ] && ok "valid token -> consume exits 0" || bad "valid token -> consume exits 0"
[ ! -e "$TOKEN" ] && ok "consume deletes the token (single-use)" || bad "consume deletes the token"
mint justify-warden -5   # already expired
python3 "$CONSENT" check justify-warden; [ $? -eq 1 ] && ok "expired token -> check exits 1" || bad "expired token -> check exits 1"
rm -f "$TOKEN"
# Finding 8 (Codex 2026-08-17): consume must be FAIL-CLOSED - if the token cannot be deleted it
# is NOT authorised (else a second caller reuses it within the TTL and single-use breaks). Use a
# throwaway HOME whose .claude dir is made non-writable so unlink fails while the read succeeds.
_JWH="$(mktemp -d)"; mkdir -p "$_JWH/.claude"
HOME_JW="$_JWH" python3 - "$_JWH" <<'PY'
import json, os, sys, time, secrets
p = os.path.join(sys.argv[1], ".claude", ".justify-watcher-shutdown-consent")
json.dump({"target":"justify-warden","expires":time.time()+120,
           "nonce":secrets.token_hex(8),"by":"test","created":time.time()}, open(p,"w"))
PY
chmod 500 "$_JWH/.claude"    # directory not writable -> unlink of the token will fail
HOME="$_JWH" python3 "$CONSENT" consume justify-warden; _jwrc=$?
[ "$_jwrc" -ne 0 ] && ok "consume that cannot delete the token is REFUSED (fail-closed)" \
                   || bad "consume fail-closed on unlink failure (got rc=$_jwrc)"
chmod 700 "$_JWH/.claude"; rm -rf "$_JWH"

echo "## guard: USER consent authorises ONE shutdown"
mint justify-warden 120
chk "shutdown WITH valid consent is ALLOWED" allow "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-warden","message":{"type":"shutdown_request"}}}'
[ ! -e "$TOKEN" ] && ok "the consent token was consumed" || bad "the consent token was consumed"
chk "the SECOND shutdown is DENIED (single-use)" deny "$GUARD" \
  '{"tool_name":"SendMessage","tool_input":{"to":"justify-warden","message":{"type":"shutdown_request"}}}'
rm -f "$TOKEN"

# ---------------------------------------------------------------------------
echo "## bash-guard: kill of a justify watcher agent (by resolved pid)"
bash -c 'exec -a "claude.exe --agent-id justify-hooktest@s1 --agent-name justify-hooktest" sleep 30' &
FAKE=$!
disown "$FAKE" 2>/dev/null || true   # suppress the shell's "Terminated" job notice on cleanup
bash -c 'exec -a "claude.exe --agent-id justify-hooktest2@s1 --agent-name justify-hooktest2" sleep 30' &
FAKE2=$!
disown "$FAKE2" 2>/dev/null || true
sleep 0.3
if ps -o command= -p "$FAKE" 2>/dev/null | grep -q 'justify-hooktest'; then
  chk "kill <fake-justify-agent-pid> is DENIED" deny "$BASHG" \
    "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill %s"}}' "$FAKE")"
  chk "kill -9 <fake-justify-agent-pid> is DENIED" deny "$BASHG" \
    "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill -9 %s"}}' "$FAKE")"
  # Finding 3 (Codex 2026-08-17): the process-GROUP form `kill -- -PID` must also resolve.
  chk "kill -- -<fake-watcher-pid> (group form) is DENIED" deny "$BASHG" \
    "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill -- -%s"}}' "$FAKE")"
  if [ -e "$DEPLOYED_CONSENT" ]; then
    mint justify-hooktest 120
    chk "kill <watcher-pid> WITH consent is ALLOWED" allow "$BASHG" \
      "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill %s"}}' "$FAKE")"
    [ ! -e "$TOKEN" ] && ok "bash-guard consumed the consent token" || bad "bash-guard consumed the consent token"
    chk "the second consented kill is DENIED (single-use)" deny "$BASHG" \
      "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill %s"}}' "$FAKE")"
    rm -f "$TOKEN"
    # Finding 4 (Codex 2026-08-17): a token for ONE watcher must NOT wave through a kill that
    # also hits ANOTHER watcher, and a denied multi-kill must NOT spend the token.
    if ps -o command= -p "$FAKE2" 2>/dev/null | grep -q 'justify-hooktest2'; then
      mint justify-hooktest 120
      chk "kill <warden> <owner> with a token for only ONE is DENIED" deny "$BASHG" \
        "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill %s %s"}}' "$FAKE" "$FAKE2")"
      [ -e "$TOKEN" ] && ok "the token is NOT consumed by a denied multi-watcher kill" \
                      || bad "the token must survive a denied multi-watcher kill"
      rm -f "$TOKEN"
      mint '*' 120
      chk "kill <warden> <owner> with a '*' token (covers all) is ALLOWED" allow "$BASHG" \
        "$(printf '{"tool_name":"Bash","tool_input":{"command":"kill %s %s"}}' "$FAKE" "$FAKE2")"
      [ ! -e "$TOKEN" ] && ok "the '*' token is consumed once for the whole kill" \
                        || bad "the '*' token should be consumed once"
      rm -f "$TOKEN"
    else
      echo "SKIP Finding-4 multi-watcher tests (could not fake a second justify agent)"
    fi
  else
    echo "SKIP bash-guard consent override (helper not deployed at $DEPLOYED_CONSENT - run install.sh --only justify)"
  fi
else
  echo "SKIP bash-guard kill tests (could not fake a justify agent process on this platform)"
fi
kill "$FAKE" 2>/dev/null
kill "$FAKE2" 2>/dev/null

echo "## bash-guard: non-watcher kills are allowed"
chk "kill of a nonexistent pid is ALLOWED" allow "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"kill 99999999"}}'

echo "## bash-guard: consent-token forge is blocked"
chk "forge token via redirect is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"echo {} > ~/.claude/.justify-watcher-shutdown-consent"}}'
chk "forge token via tee is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"echo x | tee $HOME/.claude/.justify-watcher-shutdown-consent"}}'
chk "forge token via cp is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"cp /tmp/f ~/.claude/.justify-watcher-shutdown-consent"}}'
chk "prose mentioning the token is ALLOWED (no false block)" allow "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"echo the token is .justify-watcher-shutdown-consent"}}'

echo "## bash-guard: REGRESSION (existing justify gates still fire)"
chk "pkill -f justify still DENIED (daemon/worker gate)" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"pkill -f justify"}}'
chk "justify-watch-disarm still DENIED (disarm gate)" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"justify-watch-disarm"}}'

echo "## bash-guard: an agent may not RUN the justify-watcher-shutdown CLI (Finding 1)"
chk "agent Bash 'justify-watcher-shutdown justify-owner' is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"justify-watcher-shutdown justify-owner"}}'
chk "agent Bash 'justify-watcher-shutdown --authorize justify-owner' is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"justify-watcher-shutdown --authorize justify-owner"}}'
chk "the CLI behind a bash -c payload is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"bash -c \"justify-watcher-shutdown justify-owner\""}}'
chk "the CLI behind an env-assignment prefix is DENIED" deny "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"FOO=1 justify-watcher-shutdown justify-owner"}}'
chk "prose mentioning the CLI in an echo is ALLOWED (no false block)" allow "$BASHG" \
  '{"tool_name":"Bash","tool_input":{"command":"echo run justify-watcher-shutdown to stop the watcher"}}'

echo "## CLI: the sanctioned user path"
bash -n "$CLI" && ok "CLI parses (bash -n)" || bad "CLI parses"
out="$(printf '' | "$CLI" justify-warden 2>&1)"; rc=$?
{ [ "$rc" -eq 3 ] && printf '%s' "$out" | grep -q "REFUSED"; } \
  && ok "non-TTY (agent) invocation is REFUSED (exit 3)" || bad "non-TTY invocation is REFUSED (exit 3, got $rc)"
"$CLI" --list >/dev/null 2>&1 && ok "CLI --list works without a TTY" || bad "CLI --list works"

rm -f "$TOKEN"
echo
echo "-------------------------------------------"
echo "PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ] || exit 1
