#!/bin/bash
# Regression coverage for codex-rescue-guard.sh
# Confirms: named codex-rescue -> deny; unnamed review-intent -> deny+wrapper;
# unnamed investigation -> allow; non-codex agent -> allow.
set -u
HOOK="$(cd "$(dirname "$0")/.." && pwd)/codex-rescue-guard.sh"
PASS=0; FAIL=0

run() { # $1=subagent_type $2=name $3=prompt
  python3 -c '
import json,sys
print(json.dumps({"tool_name":"Agent","tool_input":{
  "subagent_type":sys.argv[1],"name":sys.argv[2],"prompt":sys.argv[3]}}))
' "$1" "$2" "$3" | bash "$HOOK"
}

expect_deny() { local n="$1"; shift; local o; o="$(run "$@")"
  if printf '%s' "$o" | grep -q '"permissionDecision": "deny"'; then echo "PASS deny: $n"; PASS=$((PASS+1));
  else echo "FAIL deny expected: $n"; echo "  $o"; FAIL=$((FAIL+1)); fi; }

expect_allow() { local n="$1"; shift; local o; o="$(run "$@")"
  if [ "$o" = '{}' ]; then echo "PASS allow: $n"; PASS=$((PASS+1));
  else echo "FAIL allow expected: $n"; echo "  $o"; FAIL=$((FAIL+1)); fi; }

# wrapper must be named in deny messages
expect_wrapper() { local n="$1"; shift; local o; o="$(run "$@")"
  if printf '%s' "$o" | grep -q 'codex-review.py'; then echo "PASS wrapper-pointer: $n"; PASS=$((PASS+1));
  else echo "FAIL wrapper-pointer missing: $n"; echo "  $o"; FAIL=$((FAIL+1)); fi; }

# named teammate (any intent) -> deny + wrapper pointer
expect_deny    "named codex-rescue"        "codex:codex-rescue" "reviewer" "review this diff for bugs"
expect_wrapper "named -> wrapper pointer"   "codex:codex-rescue" "reviewer" "review this diff for bugs"
# unnamed review intent -> deny + wrapper
expect_deny    "unnamed review+diff"        "codex:codex-rescue" "" "please review this diff and give findings"
expect_deny    "unnamed critique+code"      "codex:rescue"       "" "critique the implementation of this code"
expect_wrapper "unnamed review -> wrapper"  "codex:codex-rescue" "" "review the changes for correctness"
# unnamed investigation/fix (no review intent) -> allow
expect_allow   "unnamed investigate"        "codex:codex-rescue" "" "debug why the test suite hangs and find the root cause"
expect_allow   "unnamed fix request"        "codex:rescue"       "" "the build is broken, investigate and fix it"
expect_allow   "review-the-logs (no artifact)" "codex:codex-rescue" "" "review the logs to see why it crashed"
# non-codex agent -> allow
expect_allow   "general-purpose agent"      "general-purpose"    "" "review this diff and report findings"
expect_allow   "explore agent"              "Explore"            "worker" "review the codebase"
# edge cases folded from the Codex review of this guard (2026-06-30)
expect_deny    "review this change"         "codex:codex-rescue" "" "review this change before I merge"
expect_deny    "audit this PR."             "codex:codex-rescue" "" "audit this PR. thanks"
expect_deny    "review the edits"           "codex:codex-rescue" "" "review the edits I just made"
expect_allow   "different != diff"          "codex:codex-rescue" "" "review why different output occurs across runs"
expect_allow   "dispatch != patch"          "codex:codex-rescue" "" "audit dispatch logic for races"
expect_allow   "codebase != code"           "codex:codex-rescue" "" "review the codebase architecture and explain it"

# fail-open on malformed JSON
echo "=== fail-open: malformed JSON -> {} ==="
MALFORMED_OUT="$(printf 'not json at all' | bash "$HOOK")"
if [ "$MALFORMED_OUT" = '{}' ]; then echo "PASS fail-open: malformed JSON"; PASS=$((PASS+1));
else echo "FAIL fail-open: malformed JSON -> $MALFORMED_OUT"; FAIL=$((FAIL+1)); fi

echo ""
echo "codex-rescue-guard: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
