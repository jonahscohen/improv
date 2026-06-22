#!/bin/bash
# Regression tests for the VISUAL verification gate (2026-06-22 hardening).
# Run: bash claude/hooks/test-verify-visual-gate.sh
#
# Covers the three holes that let an unverified CSS change be reported done:
#   1. curl/tests/logs must NOT clear a "visual" flag (only a real screenshot does)
#   2. verify-clear.sh must clear only on a real screenshot, not navigate
#   3. verify-before-done-stop.sh must block ending the turn on a visual flag
# Uses a temp HOME so the real ~/.claude/.needs-verification is untouched.
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
VBD="$HOOK_DIR/verify-before-done.sh"
VC="$HOOK_DIR/verify-clear.sh"
VSTOP="$HOOK_DIR/verify-before-done-stop.sh"

TMP=$(mktemp -d)
export HOME="$TMP"
mkdir -p "$HOME/.claude"
FLAG="$HOME/.claude/.needs-verification"

PASS=0; FAIL=0; FAILED=()
chk() { if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 (want=[$2] got=[$3])"; FAIL=$((FAIL+1)); FAILED+=("$1"); fi; }
flag() { [ -f "$FLAG" ] && cat "$FLAG" || printf '(absent)'; }
feed() { printf '%s' "$1" | bash "$2" >/dev/null 2>&1; }
feed_out() { printf '%s' "$1" | bash "$2" 2>/dev/null; }
blocked() { echo "$1" | grep -q '"decision": "block"' && echo block || echo allow; }

echo "=== visual flag lifecycle ==="
rm -f "$FLAG"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/styles.css"}}' "$VBD"
chk "css edit sets flag=visual" "visual" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"curl -s http://localhost:4830/styles.css"}}' "$VBD"
chk "curl localhost does NOT clear visual" "visual" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' "$VBD"
chk "npm test does NOT clear visual" "visual" "$(flag)"
feed '{"tool_name":"Read","tool_input":{"file_path":"/tmp/probe.log"}}' "$VBD"
chk "Read /tmp log does NOT clear visual" "visual" "$(flag)"
feed '{"tool_name":"Read","tool_input":{"file_path":"/tmp/hero.png"}}' "$VBD"
chk "Read .png CLEARS visual" "(absent)" "$(flag)"

echo ""
echo "=== non-visual code keeps its off-ramps ==="
rm -f "$FLAG"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/server.ts"}}' "$VBD"
chk "ts edit sets flag=code" "code" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"curl -s http://localhost:9223/status"}}' "$VBD"
chk "curl localhost CLEARS code flag" "(absent)" "$(flag)"

echo ""
echo "=== cmux screenshot clears visual; code edit does not downgrade ==="
rm -f "$FLAG"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/index.html"}}' "$VBD"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/util.ts"}}' "$VBD"
chk "later code edit does not downgrade visual" "visual" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"cmux browser --surface surface:1 screenshot --out /tmp/x.png"}}' "$VBD"
chk "cmux screenshot CLEARS visual" "(absent)" "$(flag)"

echo ""
echo "=== verify-clear.sh: navigate vs screenshot ==="
rm -f "$FLAG"; printf 'visual' > "$FLAG"
feed '{"tool_name":"mcp__claude-in-chrome__navigate","tool_input":{"url":"http://x"}}' "$VC"
chk "navigate does NOT clear" "visual" "$(flag)"
feed '{"tool_name":"mcp__claude-in-chrome__computer","tool_input":{"action":"screenshot"}}' "$VC"
chk "computer screenshot CLEARS" "(absent)" "$(flag)"

echo ""
echo "=== stop hook teeth ==="
rm -f "$FLAG"; printf 'visual' > "$FLAG"
chk "blocks when flag=visual" "block" "$(blocked "$(feed_out '{"stop_hook_active":false,"transcript_path":""}' "$VSTOP")")"
rm -f "$FLAG"; printf 'code' > "$FLAG"
chk "allows when flag=code" "allow" "$(blocked "$(feed_out '{"stop_hook_active":false,"transcript_path":""}' "$VSTOP")")"
rm -f "$FLAG"; printf 'visual' > "$FLAG"
chk "no loop when stop_hook_active" "allow" "$(blocked "$(feed_out '{"stop_hook_active":true,"transcript_path":""}' "$VSTOP")")"
rm -f "$FLAG"
chk "allows when no flag" "allow" "$(blocked "$(feed_out '{"stop_hook_active":false,"transcript_path":""}' "$VSTOP")")"

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
rm -rf "$TMP"
if [ "$FAIL" -gt 0 ]; then printf '  - %s\n' "${FAILED[@]}"; exit 1; fi
echo "All tests pass."
exit 0
