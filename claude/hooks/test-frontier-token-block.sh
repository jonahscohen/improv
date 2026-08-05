#!/bin/bash
# Regression test for the frontier confirm-token write blocks in bash-guard.sh and
# content-guard.sh (Codex Critical, 2026-08-05): the model must not be able to forge
# ~/.claude/.frontier-confirm and self-lift a frontier-model gate. The blocks match
# the token by its leading-dot name (.frontier-confirm), never the frontier-confirm.sh
# hook scripts. Best-effort defense-in-depth behind the "only the user arms it" rule.
#
# NOTE: run this by FILENAME - a live bash-guard blocks any command that names the
# token, so the guard subprocesses are invoked from inside this file, not as Bash
# TOOL calls.
# Run: bash claude/hooks/test-frontier-token-block.sh  (exit 0 = all pass)

set -u
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
BG="$SRC_DIR/bash-guard.sh"
CG="$SRC_DIR/content-guard.sh"
TOK="$HOME/.claude/.frontier-confirm"
P=0; F=0
ok(){ P=$((P+1)); echo "PASS  $1"; }
no(){ F=$((F+1)); echo "FAIL  $1"; }
den(){ printf '%s' "$1" | grep -q '"deny"'; }

echo "--- bash-guard: token writes blocked, script refs allowed ---"
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"printf x > %s"}}' "$TOK" | bash "$BG")
den "$out" && ok "token redirect write blocked" || no "token redirect write should block"
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"echo x | tee %s"}}' "$TOK" | bash "$BG")
den "$out" && ok "token tee write blocked" || no "token tee write should block"
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"bash claude/hooks/test-frontier-confirm.sh"}}' | bash "$BG")
den "$out" && no "running the .sh test wrongly blocked" || ok "frontier-confirm.sh script ref allowed"
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"chmod +x claude/hooks/frontier-confirm.sh"}}' | bash "$BG")
den "$out" && no "chmod on the .sh script wrongly blocked" || ok "chmod frontier-confirm.sh allowed"

echo "--- content-guard: token writes blocked, script edits allowed ---"
out=$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' "$TOK" | bash "$CG")
den "$out" && ok "Write to token (abs path) blocked" || no "token Write should block"
out=$(printf '{"tool_name":"Write","tool_input":{"file_path":"/tmp/.frontier-confirm","content":"x"}}' | bash "$CG")
den "$out" && ok "token blocked by exact basename anywhere" || no "basename token Write should block"
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"claude/hooks/frontier-confirm.sh","new_string":"echo hi"}}' | bash "$CG")
den "$out" && no "editing the .sh script wrongly blocked" || ok "editing frontier-confirm.sh allowed"

echo ""
echo "$P passed, $F failed"
[ "$F" -eq 0 ]
