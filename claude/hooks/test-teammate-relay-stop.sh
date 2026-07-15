#!/bin/bash
# Regression test for teammate-relay-stop.sh.
#
# The Stop hook blocks a TEAMMATE (isSidechain / teamName transcript) from going
# idle when the dispatch demanded a SendMessage relay but the teammate never sent
# one (it printed its report to the terminal instead). It must NOT fire for a
# lead session, when a SendMessage was actually sent, when the dispatch did not
# demand SendMessage, when the only mention of SendMessage is a tool_result echo,
# when no report exists yet, when stop_hook_active is set, or with no transcript.
# Run: bash claude/hooks/test-teammate-relay-stop.sh  (exit 0 = all pass)

set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/teammate-relay-stop.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

w() { printf '%s\n' "$2" > "$SANDBOX/$1"; }   # w <file> <single-json-line>
a() { printf '%s\n' "$2" >> "$SANDBOX/$1"; }  # append a line

# --- Fixtures -------------------------------------------------------------
# teammate, demanded SendMessage, report produced, NEVER sent  -> BLOCK
w teammate_unsent.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"Do the unit. When done, SendMessage your report to the lead."}}'
a teammate_unsent.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"Done. Report: I fixed the thing and ran the tests."}]}}'

# teammate, demanded SendMessage, a SendMessage WAS sent  -> allow
w teammate_sent.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"Do the unit and report via SendMessage."}}'
a teammate_sent.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"Working on it."}]}}'
a teammate_sent.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"SendMessage","input":{"type":"report","content":"done"}}]}}'

# teammate, dispatch did NOT demand SendMessage  -> allow
w teammate_norelay.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"Do the unit and report back in your final message."}}'
a teammate_norelay.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"Done, here is my report."}]}}'

# NOT a teammate (no isSidechain / teamName), dispatch mentions SendMessage -> allow
w lead_unsent.jsonl '{"type":"user","message":{"role":"user","content":"Dispatch teammates and have them SendMessage their reports."}}'
a lead_unsent.jsonl '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Done."}]}}'

# teammate via teamName (not isSidechain), demanded + unsent -> BLOCK
w teammate_teamname.jsonl '{"type":"user","teamName":"session-abc","message":{"role":"user","content":"Do the unit. SendMessage the result to the lead."}}'
a teammate_teamname.jsonl '{"type":"assistant","teamName":"session-abc","message":{"role":"assistant","content":[{"type":"text","text":"Done, report."}]}}'

# teammate, demanded SendMessage, but NO assistant output yet -> allow (nothing to relay)
w teammate_notext.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"Do the unit. SendMessage the result."}}'

# teammate, DISPATCH (first user msg) does NOT demand SendMessage; only a LATER
# user note names the tool -> allow (the demand must come from the dispatch, not
# a later note - Codex MEDIUM finding).
w teammate_latenote.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"Do the unit and report in your final message."}}'
a teammate_latenote.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"Starting."}]}}'
a teammate_latenote.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"By the way, you could SendMessage me updates."}}'
a teammate_latenote.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"Done, here is my report."}]}}'

# teammate, genuine dispatch has NO SendMessage; the only "SendMessage" token is
# inside a tool_result echo -> allow (must not false-fire on tool output, per the
# api-drift tool_response-echo lesson).
w teammate_toolecho.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":"Do the unit and report in your final message."}}'
a teammate_toolecho.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"tool_use","id":"b1","name":"Bash","input":{"command":"grep -r SendMessage ."}}]}}'
a teammate_toolecho.jsonl '{"type":"user","isSidechain":true,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"b1","content":"hook.sh: block via SendMessage"}]}}'
a teammate_toolecho.jsonl '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"Done, here is my report."}]}}'

run() { printf '{"session_id":"S","transcript_path":"%s","stop_hook_active":%s}' "$1" "${2:-false}" | bash "$HOOK"; }
is_block() { printf '%s' "$1" | grep -q '"block"'; }

echo "--- blocks a teammate with an unsent, demanded report ---"
out=$(run "$SANDBOX/teammate_unsent.jsonl"); is_block "$out" && ok "teammate + demanded + unsent -> block" || bad "should block unsent teammate report"
out=$(run "$SANDBOX/teammate_teamname.jsonl"); is_block "$out" && ok "teamName teammate + demanded + unsent -> block" || bad "should block via teamName signal"

echo "--- allows every non-violation shape ---"
out=$(run "$SANDBOX/teammate_sent.jsonl");    is_block "$out" && bad "sent report should NOT block"        || ok "teammate that sent SendMessage -> allow"
out=$(run "$SANDBOX/teammate_norelay.jsonl"); is_block "$out" && bad "no-demand should NOT block"           || ok "dispatch did not demand SendMessage -> allow"
out=$(run "$SANDBOX/lead_unsent.jsonl");      is_block "$out" && bad "lead session should NOT block"        || ok "non-teammate (lead) session -> allow"
out=$(run "$SANDBOX/teammate_notext.jsonl");  is_block "$out" && bad "no report yet should NOT block"       || ok "teammate with no report yet -> allow"
out=$(run "$SANDBOX/teammate_toolecho.jsonl");is_block "$out" && bad "tool_result echo should NOT block"    || ok "SendMessage only in tool_result echo -> allow"
out=$(run "$SANDBOX/teammate_latenote.jsonl");is_block "$out" && bad "later-note demand should NOT block"    || ok "demand only in a later note (not the dispatch) -> allow"

echo "--- safety valves ---"
out=$(run "$SANDBOX/teammate_unsent.jsonl" true); is_block "$out" && bad "stop_hook_active must not block (loop guard)" || ok "stop_hook_active=true -> allow (no loop)"
out=$(run "$SANDBOX/does-not-exist.jsonl");       is_block "$out" && bad "missing transcript must not block"           || ok "missing transcript -> allow (fail-open)"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
