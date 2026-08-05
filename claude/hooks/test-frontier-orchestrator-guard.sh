#!/bin/bash
# Regression test for frontier-orchestrator-guard.sh.
#
# The guard blocks a FRONTIER session's production/execution tools (Write/Edit/
# MultiEdit/NotebookEdit/Bash) so a frontier model stays orchestrator-only, EXCEPT
# it carves out MANDATED beat/memory writes (a Write/Edit/MultiEdit/NotebookEdit
# whose target path is under a .claude/memory/ tree or ~/.claude/projects/*/memory/
# is allowed even on a frontier model). Bash gets no carve-out. Preferred models
# (opus-4-8 / sonnet-4-6 / haiku-4-5) are a no-op. A user-armed "confirm" token
# lifts the block for exactly one action.
#
# Hermetic: builds a sandbox HOME with the guard + detect-session-model.sh +
# frontier-confirm.sh and fake transcripts, then exercises the real detector path.
# Run: bash claude/hooks/test-frontier-orchestrator-guard.sh  (exit 0 = all pass)

set -u
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX"
HOOKS="$HOME/.claude/hooks"
mkdir -p "$HOOKS"
cp "$SRC_DIR/frontier-orchestrator-guard.sh" "$HOOKS/"
cp "$SRC_DIR/detect-session-model.sh" "$HOOKS/"
cp "$SRC_DIR/frontier-confirm.sh" "$HOOKS/"
chmod +x "$HOOKS/frontier-orchestrator-guard.sh" "$HOOKS/detect-session-model.sh" "$HOOKS/frontier-confirm.sh"
GUARD="$HOOKS/frontier-orchestrator-guard.sh"
TOKEN="$HOME/.claude/.frontier-confirm"

mktx() { printf '{"type":"assistant","message":{"model":"%s","content":[{"type":"text","text":"ok"}]}}\n' "$1" > "$2"; }
FABLE_TX="$SANDBOX/fable.jsonl";      mktx "claude-fable-5"    "$FABLE_TX"
OPUS5_TX="$SANDBOX/opus5.jsonl";      mktx "claude-opus-5"     "$OPUS5_TX"
SONNET5_TX="$SANDBOX/sonnet5.jsonl";  mktx "claude-sonnet-5"   "$SONNET5_TX"
OPUS_TX="$SANDBOX/opus.jsonl";        mktx "claude-opus-4-8"   "$OPUS_TX"
SONNET_TX="$SANDBOX/sonnet.jsonl";    mktx "claude-sonnet-4-6" "$SONNET_TX"

# run <tool> <file_path> <transcript> [bash_command]
run() {
  local tool="$1" fp="$2" tx="$3" cmd="${4:-}"
  TOOL="$tool" FP="$fp" TX="$tx" CMD="$cmd" python3 -c '
import json,os
tool=os.environ["TOOL"]; fp=os.environ["FP"]; tx=os.environ["TX"]; cmd=os.environ["CMD"]
ti={}
if tool=="Bash": ti={"command":cmd}
elif tool=="NotebookEdit": ti={"notebook_path":fp}
else: ti={"file_path":fp}
print(json.dumps({"tool_name":tool,"transcript_path":tx,"session_id":"S","tool_input":ti}))
' | bash "$GUARD"
}
is_deny() { printf '%s' "$1" | grep -q '"deny"'; }
arm() { printf '%s %s\n' "$1" "$(date +%s)" > "$TOKEN"; }   # arm a confirm token

echo "--- every frontier model blocks a plain src write ---"
for pair in "fable:$FABLE_TX" "opus-5:$OPUS5_TX" "sonnet-5:$SONNET5_TX"; do
  name=${pair%%:*}; tx=${pair##*:}
  out=$(run Write "/repo/src/app.ts" "$tx")
  is_deny "$out" && ok "$name src Write blocked" || bad "$name src Write should be blocked"
done

echo "--- frontier: memory-path writes are carved out (allowed), no token needed ---"
for t in Write Edit MultiEdit; do
  out=$(run "$t" "/repo/.claude/memory/session_x.md" "$OPUS5_TX")
  is_deny "$out" && bad "opus-5 .claude/memory $t blocked (should be allowed)" || ok "opus-5 .claude/memory $t allowed"
done
out=$(run NotebookEdit "/repo/.claude/memory/nb.ipynb" "$SONNET5_TX")
is_deny "$out" && bad "sonnet-5 memory NotebookEdit blocked" || ok "sonnet-5 memory NotebookEdit allowed"
out=$(run Write "$HOME/.claude/projects/-Users-x-proj/memory/note.md" "$OPUS5_TX")
is_deny "$out" && bad "opus-5 projects/*/memory Write blocked" || ok "opus-5 ~/.claude/projects/*/memory Write allowed"

echo "--- frontier: non-memory writes + Bash still blocked ---"
out=$(run Edit "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && ok "opus-5 src Edit blocked" || bad "opus-5 src Edit should be blocked"
out=$(run Write "/repo/src/memory/cache.ts" "$OPUS5_TX")
is_deny "$out" && ok "opus-5 non-.claude memory-named path blocked" || bad "src/memory should be blocked"
out=$(run Write "/repo/.claude/memory/../../src/app.ts" "$OPUS5_TX")
is_deny "$out" && ok "opus-5 memory traversal escape blocked" || bad "traversal out of memory should be blocked"
out=$(run Bash "" "$OPUS5_TX" "echo hi > /repo/.claude/memory/x.md")
is_deny "$out" && ok "opus-5 Bash blocked even naming a memory path" || bad "opus-5 Bash should be blocked (no carve-out)"
out=$(run Bash "" "$OPUS5_TX" "ls")
is_deny "$out" && ok "opus-5 Bash blocked" || bad "opus-5 Bash should be blocked"

echo "--- frontier: non-gated tools pass ---"
out=$(run Read "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && bad "Read should never be gated" || ok "opus-5 Read passes"

echo "--- preferred sessions: guard is a no-op ---"
for pair in "opus-4-8:$OPUS_TX" "sonnet-4-6:$SONNET_TX"; do
  name=${pair%%:*}; tx=${pair##*:}
  out=$(run Write "/repo/src/app.ts" "$tx")
  is_deny "$out" && bad "$name src Write blocked (guard must be frontier-only)" || ok "$name src Write allowed (no-op)"
  out=$(run Bash "" "$tx" "rm -rf /nope")
  is_deny "$out" && bad "$name Bash blocked (guard must be frontier-only)" || ok "$name Bash allowed (no-op)"
done

echo "--- CONFIRM override (user-armed one-shot token) ---"
rm -f "$TOKEN"
out=$(run Write "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && ok "no token -> frontier src Write blocked" || bad "should block without a token"
arm '*'
out=$(run Write "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && bad "blanket confirm should lift the block" || ok "blanket confirm lifts the block once"
out=$(run Write "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && ok "token consumed -> next write blocked again (one-shot)" || bad "token should be one-shot"
arm 'opus-5'
out=$(run Write "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && bad "confirm opus-5 should lift an opus-5 session block" || ok "scoped confirm (opus-5) lifts opus-5 block"
# expired token is ignored
printf 'opus-5 %s\n' "$(( $(date +%s) - 10000 ))" > "$TOKEN"
out=$(run Write "/repo/src/app.ts" "$OPUS5_TX")
is_deny "$out" && ok "expired token does not lift the block" || bad "expired token must not lift"
# a mandated beat write does NOT spend the token (carve-out runs first)
arm '*'
out=$(run Write "/repo/.claude/memory/beat.md" "$OPUS5_TX")
is_deny "$out" && bad "beat write should be allowed" || ok "beat write allowed on frontier"
[ -f "$TOKEN" ] && ok "beat write did NOT consume the confirm token" || bad "beat write wrongly consumed the token"
rm -f "$TOKEN"

echo "--- FAIL-OPEN: carve-out crash allows a beat; intentional denies still deny ---"
out=$(printf '{"tool_name":"Write","transcript_path":"%s","session_id":"S","tool_input":"NOT_A_DICT"}' "$OPUS5_TX" | bash "$GUARD")
is_deny "$out" && bad "helper exception must FAIL OPEN" || ok "crash in carve-out fails open (beat allowed)"
out=$(run Write "/repo/src/service.ts" "$OPUS5_TX")
is_deny "$out" && ok "real src-path write still denied" || bad "src path must still deny after fail-open wrap"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
