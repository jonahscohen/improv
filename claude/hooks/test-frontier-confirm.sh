#!/bin/bash
# Regression test for the frontier confirm-token contract:
#   frontier-confirm-arm.sh  (UserPromptSubmit: user "confirm" -> arm token)
#   frontier-confirm.sh       (frontier_check_confirm: consume one-shot token)
#
# Run: bash claude/hooks/test-frontier-confirm.sh  (exit 0 = all pass)

set -u
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX"
mkdir -p "$HOME/.claude/hooks"
cp "$SRC_DIR/frontier-confirm.sh" "$HOME/.claude/hooks/"
cp "$SRC_DIR/frontier-confirm-arm.sh" "$HOME/.claude/hooks/"
ARM="$HOME/.claude/hooks/frontier-confirm-arm.sh"
TOKEN="$HOME/.claude/.frontier-confirm"

# arm_with <prompt> : run the UserPromptSubmit arm hook with a prompt.
arm_with() {
  rm -f "$TOKEN"
  P="$1" python3 -c 'import json,os; print(json.dumps({"prompt":os.environ["P"]}))' | bash "$ARM"
}
token_model() { head -n1 "$TOKEN" 2>/dev/null | awk '{print $1}'; }

echo "--- arm hook writes the token only for a real confirm ---"
arm_with "confirm"
[ -f "$TOKEN" ] && [ "$(token_model)" = "*" ] && ok "bare 'confirm' arms a blanket token" || bad "bare confirm should arm '*'"
arm_with "confirm sonnet-5"
[ -f "$TOKEN" ] && [ "$(token_model)" = "sonnet-5" ] && ok "'confirm sonnet-5' arms a scoped token" || bad "scoped confirm should arm sonnet-5"
arm_with "Confirm"
[ -f "$TOKEN" ] && ok "'Confirm' (any case) arms" || bad "case-insensitive confirm should arm"
arm_with "confirm op"
[ "$(token_model)" = "*" ] && ok "'confirm op' (partial) arms blanket, not a loose 'op' scope" || bad "partial scoped model should fall back to blanket"
arm_with "confirm claude-opus-5"
[ "$(token_model)" = "claude-opus-5" ] && ok "'confirm claude-opus-5' (full id) arms scoped" || bad "full frontier id should arm scoped"
arm_with "confirm the deletion of everything"
[ -f "$TOKEN" ] && bad "a long sentence containing 'confirm' must NOT arm" || ok "'confirm the deletion...' does not arm"
arm_with "please confirm"
[ -f "$TOKEN" ] && bad "'please confirm' (confirm not first) must NOT arm" || ok "'please confirm' does not arm"
arm_with "build the thing"
[ -f "$TOKEN" ] && bad "an unrelated prompt must NOT arm" || ok "unrelated prompt does not arm"

echo "--- consume helper: match, one-shot, ttl, malformed ---"
# shellcheck source=/dev/null
export FRONTIER_CONFIRM_FILE="$TOKEN"
. "$HOME/.claude/hooks/frontier-confirm.sh"

printf '* %s\n' "$(date +%s)" > "$TOKEN"
frontier_check_confirm "claude-opus-5" && ok "blanket '*' matches any model" || bad "'*' should match"
[ -f "$TOKEN" ] && bad "match must CONSUME the token" || ok "match consumes the token (one-shot)"

printf 'sonnet-5 %s\n' "$(date +%s)" > "$TOKEN"
frontier_check_confirm "claude-sonnet-5" && ok "scoped token matches by substring" || bad "sonnet-5 should match claude-sonnet-5"

printf 'sonnet-5 %s\n' "$(date +%s)" > "$TOKEN"
frontier_check_confirm "claude-opus-5" && bad "sonnet-5 token must NOT match opus-5" || ok "scoped token does not match a different model"
[ -f "$TOKEN" ] && ok "a non-matching live token is left in place" || bad "non-match should not delete the token"

printf '* %s\n' "$(( $(date +%s) - 10000 ))" > "$TOKEN"
frontier_check_confirm "claude-opus-5" && bad "expired token must not match" || ok "expired token rejected"
[ -f "$TOKEN" ] && bad "expired token should be cleaned up" || ok "expired token deleted"

printf 'garbage-no-timestamp\n' > "$TOKEN"
frontier_check_confirm "claude-opus-5" && bad "malformed token must not match" || ok "malformed token rejected"

rm -f "$TOKEN"
frontier_check_confirm "claude-opus-5" && bad "absent token must not match" || ok "absent token -> no match"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
