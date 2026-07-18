#!/bin/bash
# End-to-end SESSION-KEY agreement + isolation for the verify flag (2026-07-18).
# Run: bash claude/hooks/test-verify-session-isolation.sh
#
# The verify flag ~/.claude/.needs-verification.<session_id> is written by verify-before-done.sh
# and read/cleared by FIVE other hooks. bash-guard warns: if a writer and a reader disagree on
# the path, the gate FAILS OPEN. Codex (2026-07-18) noted the earlier cross-session test
# hand-CREATED the flag file instead of arming through the real writer, so it could not catch a
# key-derivation mismatch between the writer and a reader. This suite closes that gap:
#
#   1. ARM through the real writer (verify-before-done.sh) with session_id=alpha.
#   2. Prove EVERY consumer (bash-guard, stop, verify-clear, verify-manual, second-fix-gate)
#      acts on the SAME file the writer created - by BEHAVIOR, feeding each the same session_id.
#   3. Prove a DIFFERENT session (beta) sees NONE of alpha's debt (the cross-project isolation).
#
# Exits non-zero on any failure.
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
VBD="$HOOK_DIR/verify-before-done.sh"
VSTOP="$HOOK_DIR/verify-before-done-stop.sh"
VC="$HOOK_DIR/verify-clear.sh"
VMAN="$HOOK_DIR/verify-manual.sh"
SFG="$HOOK_DIR/second-fix-gate.sh"
BG="$HOOK_DIR/bash-guard.sh"

TMP=$(mktemp -d) || exit 1
export HOME="$TMP"
mkdir -p "$HOME/.claude"

# A temp git repo with a STAGED front-end file - bash-guard gate 2 only fires on a real
# renderable staged file.
REPO=$(mktemp -d) || exit 1
(
  cd "$REPO" || exit 1
  git init -q . && printf '.a{color:red}\n' > style.scss && git add style.scss
) >/dev/null 2>&1 || { echo "repo setup failed"; exit 1; }

cleanup() { rm -rf "$TMP" "$REPO"; }
trap cleanup EXIT

PASS=0; FAIL=0; FAILED=()
ok()   { echo "PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL: $1"; FAILED+=("$1"); FAIL=$((FAIL+1)); }
chk()  { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (want=[$2] got=[$3])"; fi; }

ALPHA=alpha-session
BETA=beta-session
FLAG_A="$HOME/.claude/.needs-verification.$ALPHA"
FLAG_B="$HOME/.claude/.needs-verification.$BETA"

# Build the Stop payloads as VARIABLES. Inlining the JSON as "$(stop "{...}")" lets bash
# brace-expand the literal {a,b,c} (the outer quotes are consumed by the nested command
# substitution), splitting the payload and feeding the hook garbage. A variable is immune -
# brace expansion never applies to the result of a variable expansion.
STOP_ALPHA='{"stop_hook_active":false,"session_id":"'"$ALPHA"'","transcript_path":""}'
STOP_BETA='{"stop_hook_active":false,"session_id":"'"$BETA"'","transcript_path":""}'

# Feed a hook a JSON payload built from key/value fields; returns stdout.
vbd()   { printf '%s' "$1" | bash "$VBD"   2>/dev/null; }
stop()  { local o; o=$(printf '%s' "$1" | bash "$VSTOP" 2>/dev/null); case "$o" in *'"decision": "block"'*) echo block;; *) echo allow;; esac; }
clear() { printf '%s' "$1" | bash "$VC"    2>/dev/null; }
man()   { printf '%s' "$1" | bash "$VMAN"  2>/dev/null; }
flag()  { [ -f "$1" ] && cat "$1" || printf '(absent)'; }
# bash-guard against a git commit, with HOME + a session_id + cwd=repo.
bg_commit() {
  local sid="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"session_id":sys.argv[1],"tool_input":{"command":"git commit -m x"}}))' "$sid")
  (cd "$REPO" && printf '%s' "$input" | HOME="$HOME" bash "$BG" 2>/dev/null) \
    | grep -qE '"permissionDecision":[[:space:]]*"deny"' && echo deny || echo allow
}

echo "=== 1. WRITER arms the keyed file (session=alpha, .css edit) ==="
vbd "{\"tool_name\":\"Edit\",\"session_id\":\"$ALPHA\",\"tool_input\":{\"file_path\":\"/x/a.css\"}}" >/dev/null
chk "writer created .needs-verification.alpha=visual" "visual" "$(flag "$FLAG_A")"
chk "writer did NOT touch beta"                        "(absent)" "$(flag "$FLAG_B")"

echo ""
echo "=== 2. every READER agrees on the writer's file (same session_id) ==="
chk "stop hook BLOCKS alpha (reads the same file)"  "block" "$(stop "$STOP_ALPHA")"
chk "bash-guard DENIES alpha commit (same file)"    "deny"  "$(bg_commit "$ALPHA")"

echo ""
echo "=== 3. a DIFFERENT session (beta) sees NONE of alpha's debt ==="
chk "stop hook ALLOWS beta (isolation)"     "allow" "$(stop "$STOP_BETA")"
chk "bash-guard ALLOWS beta commit (isolation)" "allow" "$(bg_commit "$BETA")"

echo ""
echo "=== 4. CLEARERS clear the writer's file (same session_id) ==="
# verify-clear on a real chrome screenshot
clear "{\"tool_name\":\"mcp__claude-in-chrome__computer\",\"session_id\":\"$ALPHA\",\"tool_input\":{\"action\":\"screenshot\"}}" >/dev/null
chk "verify-clear (screenshot) cleared alpha" "(absent)" "$(flag "$FLAG_A")"

# re-arm, then verify-manual "verified" clears it
vbd "{\"tool_name\":\"Edit\",\"session_id\":\"$ALPHA\",\"tool_input\":{\"file_path\":\"/x/b.css\"}}" >/dev/null
chk "re-armed alpha=visual" "visual" "$(flag "$FLAG_A")"
man "{\"session_id\":\"$ALPHA\",\"prompt\":\"verified\"}" >/dev/null
chk "verify-manual (verified) cleared alpha" "(absent)" "$(flag "$FLAG_A")"

echo ""
echo "=== 5. second-fix-gate reads the writer's keyed file (precondition) ==="
# second-fix-gate warns on a 2nd MODIFY edit to the same file ONLY when the verify flag is set
# FOR THAT SESSION. Arm alpha, do two modify edits with session=alpha -> must WARN (proves it
# read .needs-verification.alpha, not a global file).
: > "$FLAG_A"
SFILE="$TMP/src/app.ts"
sfg_modify() {
  printf '%s' "$1" | python3 -c 'import json,sys; p=sys.stdin.read().strip(); print(json.dumps({"session_id":sys.argv[1],"tool_name":"Edit","tool_input":{"file_path":p,"old_string":"function foo() { return 1; }","new_string":"function foo() { return 2; }"}}))' "$ALPHA"
}
sfg_modify "$SFILE" | bash "$SFG" >/dev/null 2>&1
OUT_SFG=$(sfg_modify "$SFILE" | bash "$SFG" 2>/dev/null)
if echo "$OUT_SFG" | grep -q "SECOND FIX DETECTED"; then ok "second-fix-gate warns (read alpha keyed flag)"; else bad "second-fix-gate did NOT warn - it read the wrong flag path ($OUT_SFG)"; fi
# And with a DIFFERENT session (beta) whose flag is NOT set -> silent (isolation).
rm -f "$FLAG_B"
sfg_modify_beta() {
  printf '%s' "$1" | python3 -c 'import json,sys; p=sys.stdin.read().strip(); print(json.dumps({"session_id":sys.argv[1],"tool_name":"Edit","tool_input":{"file_path":p,"old_string":"function foo() { return 1; }","new_string":"function foo() { return 2; }"}}))' "$BETA"
}
sfg_modify_beta "$SFILE" | bash "$SFG" >/dev/null 2>&1
OUT_SFG_B=$(sfg_modify_beta "$SFILE" | bash "$SFG" 2>/dev/null)
if echo "$OUT_SFG_B" | grep -q "SECOND FIX DETECTED"; then bad "second-fix-gate warned for beta whose flag is unset - isolation broken ($OUT_SFG_B)"; else ok "second-fix-gate SILENT for beta (isolation)"; fi

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then printf '  - %s\n' "${FAILED[@]}"; exit 1; fi
echo "All tests pass."
exit 0
