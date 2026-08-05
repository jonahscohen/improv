#!/bin/bash
# Regression test for model-router-guard.sh (frontier-model agent-routing scheme).
#
# Agent `model` policy:
#   - preferred target (opus/sonnet/haiku, 4.x id) + FRONTIER session -> allowed
#   - preferred target + non-frontier session                        -> blocked
#   - frontier target (fable / opus-5 / sonnet-5) + any session      -> blocked,
#       lifted by a one-shot user "confirm" token
#   - no model param                                                 -> allowed
# CLI routing hacks (fable-router, claude --model, ANTHROPIC_MODEL) stay blocked.
#
# Hermetic sandbox HOME with the guard + detect-session-model.sh + frontier-confirm.sh.
# Run: bash claude/hooks/test-model-router-guard.sh  (exit 0 = all pass)

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
cp "$SRC_DIR/model-router-guard.sh" "$HOOKS/"
cp "$SRC_DIR/detect-session-model.sh" "$HOOKS/"
cp "$SRC_DIR/frontier-confirm.sh" "$HOOKS/"
chmod +x "$HOOKS"/*.sh
GUARD="$HOOKS/model-router-guard.sh"
TOKEN="$HOME/.claude/.frontier-confirm"

mktx() { printf '{"type":"assistant","message":{"model":"%s","content":[{"type":"text","text":"ok"}]}}\n' "$1" > "$2"; }
OPUS5_TX="$SANDBOX/opus5.jsonl"; mktx "claude-opus-5"   "$OPUS5_TX"   # frontier session
OPUS_TX="$SANDBOX/opus.jsonl";   mktx "claude-opus-4-8" "$OPUS_TX"    # preferred session

# agent <model> <transcript> [prompt]
agent() {
  local model="$1" tx="$2" prompt="${3:-do work}"
  MODEL="$model" TX="$tx" PROMPT="$prompt" python3 -c '
import json,os
print(json.dumps({"tool_name":"Agent","transcript_path":os.environ["TX"],"session_id":"S",
"tool_input":{"model":os.environ["MODEL"],"prompt":os.environ["PROMPT"]}}))
' | bash "$GUARD"
}
# bash_cmd <command> <transcript>
bash_cmd() {
  CMD="$1" TX="$2" python3 -c '
import json,os
print(json.dumps({"tool_name":"Bash","transcript_path":os.environ["TX"],"session_id":"S",
"tool_input":{"command":os.environ["CMD"]}}))
' | bash "$GUARD"
}
is_deny() { printf '%s' "$1" | grep -q '"deny"'; }
arm() { printf '%s %s\n' "$1" "$(date +%s)" > "$TOKEN"; }

echo "--- frontier session delegates to a preferred producer (allowed) ---"
for m in opus sonnet haiku; do
  out=$(agent "$m" "$OPUS5_TX")
  is_deny "$out" && bad "opus-5 session -> $m agent blocked (should delegate)" || ok "opus-5 session -> $m agent allowed"
done

echo "--- non-frontier session routing an agent is blocked (unchanged) ---"
for m in opus sonnet haiku; do
  out=$(agent "$m" "$OPUS_TX")
  is_deny "$out" && ok "opus-4-8 session -> $m agent blocked" || bad "non-frontier routing to $m should be blocked"
done

echo "--- routing an agent TO a frontier model is gated ---"
rm -f "$TOKEN"
for m in fable opus-5 sonnet-5 claude-sonnet-5; do
  out=$(agent "$m" "$OPUS5_TX")
  is_deny "$out" && ok "-> frontier target '$m' blocked without confirm" || bad "frontier target '$m' should be blocked"
done
# a bare preferred alias must NOT be misread as frontier
out=$(agent "opus" "$OPUS5_TX")
is_deny "$out" && bad "'opus' wrongly treated as frontier" || ok "'opus' is preferred, not frontier"

echo "--- confirm lifts a frontier route, one-shot ---"
arm '*'
out=$(agent "sonnet-5" "$OPUS5_TX")
is_deny "$out" && bad "confirm should lift the sonnet-5 route" || ok "confirm lifts the sonnet-5 route"
out=$(agent "sonnet-5" "$OPUS5_TX")
is_deny "$out" && ok "token consumed -> next frontier route blocked" || bad "token should be one-shot"
arm 'sonnet-5'
out=$(agent "sonnet-5" "$OPUS5_TX")
is_deny "$out" && bad "scoped confirm sonnet-5 should lift" || ok "scoped confirm (sonnet-5) lifts the route"
rm -f "$TOKEN"

echo "--- no model param inherits the session (allowed) ---"
out=$(agent "" "$OPUS_TX")
is_deny "$out" && bad "empty model should be allowed" || ok "no model param allowed (inherits session)"

echo "--- CLI routing hacks always blocked (no override) ---"
out=$(bash_cmd "fable-router --model opus" "$OPUS5_TX")
is_deny "$out" && ok "fable-router blocked" || bad "fable-router should be blocked"
out=$(bash_cmd "claude --model claude-opus-5 -p hi" "$OPUS_TX")
is_deny "$out" && ok "claude --model blocked" || bad "claude --model should be blocked"
out=$(bash_cmd "ANTHROPIC_MODEL=claude-sonnet-5 claude -p hi" "$OPUS_TX")
is_deny "$out" && ok "ANTHROPIC_MODEL blocked" || bad "ANTHROPIC_MODEL should be blocked"
# confirm must NOT lift a CLI hack (only agent routing is overridable)
arm '*'
out=$(bash_cmd "fable-router --model opus" "$OPUS5_TX")
is_deny "$out" && ok "confirm does NOT lift a CLI routing hack" || bad "CLI hack must stay blocked even with a token"
rm -f "$TOKEN"

echo "--- ordinary Bash is untouched ---"
out=$(bash_cmd "ls -la && git status" "$OPUS5_TX")
is_deny "$out" && bad "ordinary Bash wrongly blocked" || ok "ordinary Bash allowed"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
