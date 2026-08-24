#!/bin/bash
# Test the GLOBAL taste-blocking master toggle (mirrors the voice-toggle pattern):
#   claude/hooks/taste-blocking-toggle.sh   - UserPromptSubmit flip on the phrases
#   claude/hooks/taste-blocking-status.sh   - SessionStart mode announcement
#   sidecoach/src/validators/taste-blocking-toggle.ts - the per-invocation flag reader
#
# Run: bash claude/hooks/test-taste-blocking-toggle.sh

set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
SC="$REPO_ROOT/sidecoach"
TOGGLE="$HOOK_DIR/taste-blocking-toggle.sh"
STATUS="$HOOK_DIR/taste-blocking-status.sh"
PASS=0; FAIL=0; FAILS=()
pass(){ echo "PASS: $1"; PASS=$((PASS+1)); }
fail(){ echo "FAIL: $1"; FAILS+=("$1"); FAIL=$((FAIL+1)); }
ckt(){ if [ "$2" = "0" ]; then pass "$1"; else fail "$1"; fi; }

bash -n "$TOGGLE" && pass "toggle hook parses" || fail "toggle hook syntax error"
bash -n "$STATUS" && pass "status hook parses" || fail "status hook syntax error"

SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT
FLAG="$SB/.taste-blocking-enabled"
# The flag-path env override is a TEST SEAM honored ONLY under a test root (Codex HIGH #1). Set BOTH so
# the hooks + reader use the sandbox flag; the production-ignore case below UNSETS the test root.
export SIDECOACH_ENFORCE_TEST_ROOT="$SB"
export TASTE_BLOCKING_FLAG_FILE="$FLAG"
fire(){ printf '{"prompt":"%s"}' "$1" | bash "$TOGGLE" 2>/dev/null; }
statusline(){ bash "$STATUS" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('additionalContext',''))"; }

echo "===== default = OFF (no flag) ====="
[ ! -f "$FLAG" ]; ckt "fresh install defaults OFF (no flag file)" "$?"
statusline | grep -q "OFF" ; ckt "SessionStart status announces OFF by default" "$?"
statusline | grep -qi "advisory" ; ckt "OFF status names advisory" "$?"

echo "===== 'taste blocking on' creates the flag ====="
fire "taste blocking on" >/dev/null
[ -f "$FLAG" ]; ckt "flag created on 'taste blocking on'" "$?"
statusline | grep -q "ON"; ckt "SessionStart status announces ON when the flag is present" "$?"
fire "taste blocking status" | grep -qi "currently ON"; ckt "'taste blocking status' reports ON" "$?"

echo "===== 'taste blocking off' removes the flag ====="
fire "taste blocking off" >/dev/null
[ ! -f "$FLAG" ]; ckt "flag removed on 'taste blocking off'" "$?"
fire "taste blocking status" | grep -qi "currently OFF"; ckt "'taste blocking status' reports OFF" "$?"

echo "===== 'taste blocking toggle' flips both ways ====="
fire "taste blocking toggle" >/dev/null; [ -f "$FLAG" ]; ckt "toggle from OFF -> ON" "$?"
fire "taste blocking toggle" >/dev/null; [ ! -f "$FLAG" ]; ckt "toggle from ON -> OFF" "$?"

echo "===== a non-matching prompt does NOTHING ====="
fire "please turn taste blocking on for me" >/dev/null
[ ! -f "$FLAG" ]; ckt "a sentence merely CONTAINING the phrase does not flip (whole-message only)" "$?"
fire "voice on" >/dev/null
[ ! -f "$FLAG" ]; ckt "an unrelated toggle phrase does not flip taste blocking" "$?"

echo "===== the TS reader agrees with the flag ====="
READER='const {tasteBlockingEnabled}=require("./src/validators/taste-blocking-toggle");process.stdout.write(tasteBlockingEnabled()?"ON":"OFF");'
rm -f "$FLAG"
R_OFF=$(cd "$SC" && TASTE_BLOCKING_FLAG_FILE="$FLAG" npx ts-node --transpile-only -e "$READER" 2>/dev/null)
[ "$R_OFF" = "OFF" ]; ckt "tasteBlockingEnabled() is false with no flag (default OFF)" "$?"
touch "$FLAG"
R_ON=$(cd "$SC" && TASTE_BLOCKING_FLAG_FILE="$FLAG" npx ts-node --transpile-only -e "$READER" 2>/dev/null)
[ "$R_ON" = "ON" ]; ckt "tasteBlockingEnabled() is true with the flag present" "$?"

echo "===== HIGH #1 (Codex): the flag-path env override is honored ONLY under a test root ====="
PATHQ='const {tasteBlockingFlagPath}=require("./src/validators/taste-blocking-toggle");process.stdout.write(tasteBlockingFlagPath());'
# WITHOUT a test root: TASTE_BLOCKING_FLAG_FILE is IGNORED -> resolves to the fixed ~/.claude flag, so
# an agent cannot point the toggle at a file it created to enable blocking without the user's typed on.
P_PROD=$(cd "$SC" && env -u SIDECOACH_ENFORCE_TEST_ROOT TASTE_BLOCKING_FLAG_FILE="$FLAG" npx ts-node --transpile-only -e "$PATHQ" 2>/dev/null)
[ "$P_PROD" != "$FLAG" ]; ckt "production: env override does NOT relocate the flag (agent cannot forge the toggle via env)" "$?"
echo "$P_PROD" | grep -q "\.claude/\.taste-blocking-enabled"; ckt "production: resolves to the fixed ~/.claude/.taste-blocking-enabled" "$?"
# WITH a test root: the override IS honored (the test seam).
P_TEST=$(cd "$SC" && SIDECOACH_ENFORCE_TEST_ROOT="$SB" TASTE_BLOCKING_FLAG_FILE="$FLAG" npx ts-node --transpile-only -e "$PATHQ" 2>/dev/null)
[ "$P_TEST" = "$FLAG" ]; ckt "test root: the env override IS honored (the test seam)" "$?"

echo; echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
exit 0
