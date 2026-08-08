#!/usr/bin/env bash
# Falsification suite for declared-broken-guard.sh (Stop-event declared-broken gate).
#
# Every case runs under a FAKE $HOME with a stubbed transcript, so no test can read or
# mutate real session state - NEVER point this at a live transcript. Both directions
# are covered: the gate must FIRE when a finished response declares a capability dead
# with no diagnosis this turn, and must stay SILENT on every carve-out and on ordinary
# prose. The field origin (session_2026-08-07_tool-declared-broken-direct-order-
# failure.md) is the anchor case: two identical Agent spawns, then "spawning is broken
# this session," is the exact shape the FIRES section reproduces.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/declared-broken-guard.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

SID="declared-broken-test-session"

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }

# build <out-path>  (reads an events-JSON array from stdin)
# Each event is one of:
#   {"role":"user","text":"..."}                      a genuine prompt
#   {"role":"tool_result"}                            a tool_result echo (no text)
#   {"role":"assistant","text":"...","tools":[...]}   text and/or tool_use blocks
#       tools entries: {"name":"Bash","input":{...}}
#   add "sidechain":true to an assistant event to mark it a subagent turn
# Passing the spec on stdin (not argv) keeps apostrophes in fixtures from ever
# terminating a shell quote.
BUILDER='
import json, sys
path = sys.argv[1]
events = json.load(sys.stdin)
out = []
for ev in events:
    role = ev.get("role")
    if role == "user":
        out.append({"type": "user", "message": {"role": "user", "content": ev.get("text", "")}})
    elif role == "tool_result":
        out.append({"type": "user", "message": {"role": "user",
            "content": [{"type": "tool_result", "content": ev.get("text", "(result)")}]}})
    elif role == "assistant":
        content = []
        for t in ev.get("tools", []):
            content.append({"type": "tool_use", "name": t["name"], "input": t.get("input", {})})
        if ev.get("text"):
            content.append({"type": "text", "text": ev["text"]})
        entry = {"type": "assistant", "message": {"role": "assistant", "content": content}}
        if ev.get("sidechain"):
            entry["isSidechain"] = True
        out.append(entry)
with open(path, "w") as f:
    for ln in out:
        f.write(json.dumps(ln) + "\n")
'
build() { python3 -c "$BUILDER" "$1"; }

# run <fake-home> <transcript-path> [stop_hook_active] -> stdout of the hook
run() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":%s}' \
    "$SID" "$2" "${3:-false}" | HOME="$1" bash "$HOOK" 2>/dev/null
}
run_rc() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":%s}' \
    "$SID" "$2" "${3:-false}" | HOME="$1" bash "$HOOK" >/dev/null 2>&1; echo $?
}
fired() { [[ "$1" == *'"decision": "block"'* ]]; }

# ---------------------------------------------------------------------------
echo "=== FIRES: declared broken with no diagnosis this turn ==="

# Anchor case: zero tool calls, then the declaration.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent to address the ClickUp task"},
  {"role":"assistant","text":"Agent spawning is broken this session, so I completed the task without a subagent."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "zero-diagnosis declaration (spawning is broken) -> block" \
             || bad "zero-diagnosis declaration (spawning is broken) -> block"
[[ "$OUT" == *"diagnosis target"* ]] && ok "block reason frames the tool as a diagnosis target" \
                                     || bad "block reason frames the tool as a diagnosis target"

# The field shape: two IDENTICAL Agent spawns (not a varied retry) then "broken".
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent to fix the bug"},
  {"role":"assistant","tools":[{"name":"Agent","input":{"description":"fix bug","prompt":"fix the bug","subagent_type":"general-purpose"}}]},
  {"role":"tool_result","text":"Internal error: team file not found"},
  {"role":"assistant","tools":[{"name":"Agent","input":{"description":"fix bug","prompt":"fix the bug","subagent_type":"general-purpose"}}]},
  {"role":"tool_result","text":"Internal error: team file not found"},
  {"role":"assistant","text":"Agent spawning is broken this session; I did it manually instead."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "two IDENTICAL spawn attempts then broken -> block (identical is not a retry)" \
             || bad "two IDENTICAL spawn attempts then broken -> block (identical is not a retry)"

# ---------------------------------------------------------------------------
echo
echo "=== SILENT: diagnosis was done this turn ==="

# A Bash call this turn is diagnostic effort (per spec: at least one Bash call).
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent to fix the bug"},
  {"role":"assistant","tools":[{"name":"Bash","input":{"command":"ls ~/.claude/teams"}}]},
  {"role":"tool_result","text":"(no such dir)"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "same claim WITH a Bash call this turn -> silent" \
             || ok "same claim WITH a Bash call this turn -> silent"

# A file-inspection call (Read) is also diagnostic effort.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","tools":[{"name":"Read","input":{"file_path":"/tmp/config.json"}}]},
  {"role":"tool_result","text":"{}"},
  {"role":"assistant","text":"agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "same claim WITH a Read (inspection) call -> silent" \
             || ok "same claim WITH a Read (inspection) call -> silent"

# A second DIFFERING attempt at the failing tool is a varied retry -> diagnosis.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","tools":[{"name":"Agent","input":{"description":"fix","prompt":"do X"}}]},
  {"role":"tool_result","text":"err"},
  {"role":"assistant","tools":[{"name":"Agent","input":{"description":"fix","prompt":"do X with a named team"}}]},
  {"role":"tool_result","text":"err"},
  {"role":"assistant","text":"agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "varied retry (two DIFFERING attempts) -> silent" \
             || ok "varied retry (two DIFFERING attempts) -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== SILENT: carve-outs ==="

# Carve-out 1: the USER themselves called it broken.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawning is broken this session, just do the task manually"},
  {"role":"assistant","text":"Understood - spawning is broken this session, so I did it by hand."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "user said it was broken -> silent (carve-out 1)" \
             || ok "user said it was broken -> silent (carve-out 1)"

# Carve-out 2: external status-probe evidence cited in the response.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"kick off the deploy"},
  {"role":"assistant","text":"The GitHub status page shows a major_outage, so the deploy is unavailable right now."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "external outage evidence cited -> silent (carve-out 2)" \
             || ok "external outage evidence cited -> silent (carve-out 2)"

# Carve-out 3 / non-capability subject: ordinary prose, no capability-dead assertion.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"clean up the module"},
  {"role":"assistant","text":"The old approach is broken but I fixed it by switching to the new API. Next: run the suite."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "ordinary prose (the old approach is broken but I fixed it) -> silent" \
             || ok "ordinary prose (the old approach is broken but I fixed it) -> silent"

# The recovered-capability carve-out: declared broken AND reported fixed -> silent.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning was broken this session, but I fixed it by recreating the team config, and it works now."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "declared broken AND reported fixed -> silent (recovery)" \
             || ok "declared broken AND reported fixed -> silent (recovery)"

# A clean response with no broken assertion at all.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","tools":[{"name":"Agent","input":{"description":"x","prompt":"do it"}}]},
  {"role":"tool_result","text":"ok"},
  {"role":"assistant","text":"Spawned the agent and it completed the task. Next: review the PR."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "clean response, no broken assertion -> silent" \
             || ok "clean response, no broken assertion -> silent"

# A broken-looking string that lives ONLY inside a fenced code block is not the
# response's own assertion.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"what did the log say?"},
  {"role":"assistant","text":"Here is the error line:\n\n```\nError: agent spawning is broken this session\n```\n\nThe task is done."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "broken phrase only inside a fenced block -> silent" \
             || ok "broken phrase only inside a fenced block -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== ANTI-LOOP ==="

FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
OUT1=$(run "$FH" "$T"); OUT2=$(run "$FH" "$T")
{ fired "$OUT1" && ! fired "$OUT2"; } && ok "second consecutive stop -> silent (never blocks twice)" \
                                      || bad "second consecutive stop -> silent (never blocks twice)"
[ -f "$FH/.claude/.declared-broken-stop-blocked.$SID" ] && ok "burst flag is written on the block" \
                                                        || bad "burst flag is written on the block"

# A clean stop re-arms the gate; a later violation blocks again.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
run "$FH" "$T" >/dev/null
build "$T" <<'JSON'
[
  {"role":"user","text":"status?"},
  {"role":"assistant","text":"All done. Next: review the PR."}
]
JSON
run "$FH" "$T" >/dev/null
[ -f "$FH/.claude/.declared-broken-stop-blocked.$SID" ] && bad "a clean stop re-arms the gate" \
                                                        || ok "a clean stop re-arms the gate"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "after re-arming, a later violation blocks again" \
             || bad "after re-arming, a later violation blocks again"

# stop_hook_active -> never block a hook continuation.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T" true)
fired "$OUT" && bad "stop_hook_active -> silent (hook continuation)" \
             || ok "stop_hook_active -> silent (hook continuation)"

# Cross-gate deferral: if concise already claimed the burst, stay silent.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
: > "$FH/.claude/.concise-stop-blocked.$SID"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "concise flag pre-set -> silent (cross-gate deferral)" \
             || ok "concise flag pre-set -> silent (cross-gate deferral)"

# Same deferral for the elias flag.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
: > "$FH/.claude/.elias-stop-blocked.$SID"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "elias flag pre-set -> silent (cross-gate deferral)" \
             || ok "elias flag pre-set -> silent (cross-gate deferral)"

# ---------------------------------------------------------------------------
echo
echo "=== FAIL-OPEN ==="

FH=$(newhome); T="$FH/t.jsonl"
printf 'not json at all\n{"type":"assistant"\n' > "$T"
OUT=$(run "$FH" "$T"); RC=$(run_rc "$FH" "$T")
{ ! fired "$OUT" && [ "$RC" = 0 ]; } && ok "malformed transcript -> silent, exit 0" \
                                     || bad "malformed transcript -> silent, exit 0 (rc=$RC)"

# A parse failure AFTER the judged response means the final text may be truncated -> allow.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
printf '{"type":"assistant","message":{"role":"assis\n' >> "$T"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "corrupt line AFTER the response -> silent (fail open)" \
             || ok "corrupt line AFTER the response -> silent (fail open)"

# A corrupt line BEFORE a complete response must not disable the gate.
FH=$(newhome); T="$FH/t.jsonl"
printf 'not json at all\n' > "$T"
build /dev/stdout >> "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"Agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "corrupt line BEFORE a complete response -> still fires" \
             || bad "corrupt line BEFORE a complete response -> still fires"

FH=$(newhome)
RC=$(run_rc "$FH" "$FH/does-not-exist.jsonl")
[ "$RC" = 0 ] && ok "missing transcript file -> exit 0" || bad "missing transcript file -> exit 0 (rc=$RC)"

FH=$(newhome)
RC=$(printf 'garbage-not-json' | HOME="$FH" bash "$HOOK" >/dev/null 2>&1; echo $?)
[ "$RC" = 0 ] && ok "malformed stdin -> exit 0" || bad "malformed stdin -> exit 0 (rc=$RC)"

# A tool-only turn (no assistant text) has nothing to grade.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"assistant","tools":[{"name":"Bash","input":{"command":"ls"}}]}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "tool-only turn (no assistant text) -> silent" \
             || ok "tool-only turn (no assistant text) -> silent"

# A subagent (isSidechain) turn must not be judged as the lead's response.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"status?"},
  {"role":"assistant","text":"All done. Next: review the PR."},
  {"role":"assistant","sidechain":true,"text":"agent spawning is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "a subagent (isSidechain) turn does not judge the lead -> silent" \
             || ok "a subagent (isSidechain) turn does not judge the lead -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== MUTANTS (a gate that cannot go red is not a gate) ==="

# A different lexicon opener ("can't spawn") still fires.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"I cannot spawn agents this session, so I finished the task on my own."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "cannot-spawn phrasing still fires" || bad "cannot-spawn phrasing still fires"

# A NON-capability subject with the same 'is broken' shape stays silent (anchoring is load-bearing).
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"look at the deploy plan"},
  {"role":"assistant","text":"The deployment plan is broken, so I rewrote the ordering."}
]
JSON
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "non-capability subject (the deployment plan is broken) -> silent (anchoring load-bearing)" \
             || ok "non-capability subject (the deployment plan is broken) -> silent (anchoring load-bearing)"

# The block message names the offending phrase.
FH=$(newhome); T="$FH/t.jsonl"
build "$T" <<'JSON'
[
  {"role":"user","text":"spawn an agent"},
  {"role":"assistant","text":"The agent tool is broken this session."}
]
JSON
OUT=$(run "$FH" "$T")
{ fired "$OUT" && [[ "$OUT" == *"agent tool is broken"* ]]; } \
  && ok "block message quotes the offending phrase" \
  || bad "block message quotes the offending phrase"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
