#!/usr/bin/env bash
# Falsification suite for the named-tool substitution guard: the UserPromptSubmit
# arm hook (named-tool-swap-arm.sh) and its Stop partner (named-tool-swap-guard.sh),
# exercised TOGETHER through a shared FAKE $HOME so the arm-then-check handoff is
# the real one. Every property is shown to HOLD when it should AND to FAIL when it
# should - a guard that cannot go red is not a guard.
#
# This is the guard the source beat WARNED would over-fire, so the suite is heavy
# on the PASS side: the accepted false-negatives and every carve-out are pinned so
# a future edit that makes the gate louder trips a test.

# shellcheck disable=SC2015  # `cond && ok ... || bad ...` is the intended idiom
# here: ok/bad only ever succeed (printf/arithmetic), so bad never runs when the
# condition held. Same shape as the sibling test-concise-detect-stop.sh.

HERE="$(cd "$(dirname "$0")" && pwd)"
ARM="$HERE/named-tool-swap-arm.sh"
GUARD="$HERE/named-tool-swap-guard.sh"

SID="named-tool-swap-test"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }

# arm <fake-home> <prompt>   -> runs the UserPromptSubmit arm hook
arm() {
  printf '{"session_id":"%s","prompt":%s}' "$SID" "$(json_str "$2")" \
    | HOME="$1" bash "$ARM" 2>/dev/null
}

# guard <fake-home> <transcript> [stop_hook_active] -> stdout of the Stop hook
guard() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":%s}' \
    "$SID" "$2" "${3:-false}" | HOME="$1" bash "$GUARD" 2>/dev/null
}

json_str() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }

fired() { [[ "$1" == *'"decision": "block"'* ]]; }

armed_flag() { echo "$1/.claude/.named-tool-swap-armed.$SID"; }
is_armed()   { [ -s "$(armed_flag "$1")" ]; }

# build_tx <path> <user> <assistant> [tool_name] [is_error:true|false|none] [input_json]
# One user prompt, one assistant turn (optional tool_use + trailing text), and an
# optional tool_result (in a following user message) carrying is_error.
build_tx() {
  python3 - "$@" <<'PY'
import json, sys
path, user, assistant = sys.argv[1], sys.argv[2], sys.argv[3]
tool = sys.argv[4] if len(sys.argv) > 4 else ""
err  = sys.argv[5] if len(sys.argv) > 5 else "none"
inp  = sys.argv[6] if len(sys.argv) > 6 else "{}"
rows = [{"type": "user", "message": {"role": "user", "content": user}}]
acontent = []
tid = "toolu_test_1"
if tool:
    try:
        parsed = json.loads(inp)
    except Exception:
        parsed = {}
    acontent.append({"type": "tool_use", "id": tid, "name": tool, "input": parsed})
acontent.append({"type": "text", "text": assistant})
rows.append({"type": "assistant", "message": {"role": "assistant", "content": acontent}})
if tool and err != "none":
    rows.append({"type": "user", "message": {"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": tid,
         "is_error": (err == "true"), "content": "result body"}]}})
with open(path, "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
PY
}

DONE_TEXT='Done. The task is complete and the change is in.'

# ---------------------------------------------------------------------------
echo "=== ARM HOOK: the tight lexicon arms on real demands ==="
FH=$(newhome); arm "$FH" "spawn an agent to address the ClickUp task"
[ "$(cat "$(armed_flag "$FH")" 2>/dev/null)" = "agent" ] && ok "'spawn an agent' arms -> agent" || bad "'spawn an agent' arms -> agent"

FH=$(newhome); arm "$FH" "please spawn a teammate for the tests"
grep -qx agent "$(armed_flag "$FH")" 2>/dev/null && ok "'spawn a teammate' arms -> agent" || bad "'spawn a teammate' arms -> agent"

FH=$(newhome); arm "$FH" "run /reflect on the beats"
grep -qx 'slash:reflect' "$(armed_flag "$FH")" 2>/dev/null && ok "'run /reflect' arms -> slash:reflect" || bad "'run /reflect' arms -> slash:reflect"

FH=$(newhome); arm "$FH" "use the Read tool to open the file"
grep -qx 'tool:read' "$(armed_flag "$FH")" 2>/dev/null && ok "'use the Read tool' arms -> tool:read" || bad "'use the Read tool' arms -> tool:read"

echo
echo "=== ARM HOOK: tight boundaries - deliberate NON-arming (accepted misses) ==="
FH=$(newhome); arm "$FH" "kick off a subagent to do the audit"
is_armed "$FH" && bad "paraphrase 'kick off a subagent' -> NOT armed (accepted false negative)" \
               || ok "paraphrase 'kick off a subagent' -> NOT armed (accepted false negative)"

FH=$(newhome); arm "$FH" "use the browser tool please"
is_armed "$FH" && bad "'use the browser tool' (unconfirmable) -> NOT armed" \
               || ok "'use the browser tool' (unconfirmable) -> NOT armed"

FH=$(newhome); arm "$FH" "look at src/foo and /tmp/output.log then summarize"
is_armed "$FH" && bad "path segments src/foo, /tmp/output.log -> NOT armed as slash cmds" \
               || ok "path segments src/foo, /tmp/output.log -> NOT armed as slash cmds"

FH=$(newhome); arm "$FH" "we should spawn a new worker process, the agentic loop runs after"
# "spawn ... process, the agent..." - guarded by the 16-char window + no-period.
if is_armed "$FH"; then bad "'spawn a new worker process' does not falsely arm"; else ok "'spawn a new worker process' does not falsely arm"; fi

# NEGATED demands must NOT arm (Codex High-1): the assistant obeys by NOT using
# the named tool, so arming would falsely block the honest completion.
FH=$(newhome); arm "$FH" "do not run /reflect on this one"
is_armed "$FH" && bad "'do not run /reflect' -> NOT armed (negation)" || ok "'do not run /reflect' -> NOT armed (negation)"

FH=$(newhome); arm "$FH" "don't use the Read tool here, just describe it"
is_armed "$FH" && bad "\"don't use the Read tool\" -> NOT armed (negation)" || ok "\"don't use the Read tool\" -> NOT armed (negation)"

# FS-root path token must NOT arm as a slash command (Codex Medium-2).
FH=$(newhome); arm "$FH" "use /tmp for scratch output and clean it after"
is_armed "$FH" && bad "'use /tmp for scratch' -> NOT armed (fs root, not a command)" \
               || ok "'use /tmp for scratch' -> NOT armed (fs root, not a command)"

# A negated demand alongside a REAL one arms only the real one.
FH=$(newhome); arm "$FH" "don't use the Read tool, but spawn an agent for the audit"
grep -qx agent "$(armed_flag "$FH")" 2>/dev/null \
  && ! grep -qx 'tool:read' "$(armed_flag "$FH")" 2>/dev/null \
  && ok "negated tool + real spawn -> arms agent only" \
  || bad "negated tool + real spawn -> arms agent only"

# NEGATED spawn must NOT arm (Codex round-2 M1): the spawn match gets the same
# negation lookbehind as slash/tool.
FH=$(newhome); arm "$FH" "never spawn an agent for this; fix it directly"
is_armed "$FH" && bad "'never spawn an agent' -> NOT armed (negation on spawn)" \
               || ok "'never spawn an agent' -> NOT armed (negation on spawn)"

# One-segment path not on FS_ROOTS but followed by a locational preposition is a
# path, not a command (Codex round-2 M2).
FH=$(newhome); arm "$FH" "use /workspace for scratch and /data as input"
is_armed "$FH" && bad "'use /workspace for ... /data as ...' -> NOT armed (pathy tail)" \
               || ok "'use /workspace for ... /data as ...' -> NOT armed (pathy tail)"

echo
echo "=== FIRES: armed demand, capability never ran, completion claimed ==="
FH=$(newhome); arm "$FH" "spawn an agent to address the ClickUp task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the ClickUp task" "$DONE_TEXT"
OUT=$(guard "$FH" "$T")
fired "$OUT" && ok "agent demanded, no spawn, done -> BLOCK (the field failure)" \
             || bad "agent demanded, no spawn, done -> BLOCK (the field failure)"
[[ "$OUT" == *"You were told to use the Agent tool"* ]] && ok "block names the Agent tool" || bad "block names the Agent tool"
[[ "$OUT" == *"completing the task another way is not compliance"* ]] && ok "block uses the source-beat wording" || bad "block uses the source-beat wording"

FH=$(newhome); arm "$FH" "spawn an agent to address the ClickUp task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the ClickUp task" "$DONE_TEXT" "Agent" "true" '{"prompt":"x"}'
fired "$(guard "$FH" "$T")" && ok "agent demanded, spawn ERRORED, done -> BLOCK (error != ran)" \
                            || bad "agent demanded, spawn ERRORED, done -> BLOCK (error != ran)"

FH=$(newhome); arm "$FH" "run /reflect on the beats"
T="$FH/t.jsonl"; build_tx "$T" "run /reflect on the beats" "$DONE_TEXT"
fired "$(guard "$FH" "$T")" && ok "slash cmd demanded, never run, done -> BLOCK" \
                            || bad "slash cmd demanded, never run, done -> BLOCK"

FH=$(newhome); arm "$FH" "use the Read tool to open the file"
T="$FH/t.jsonl"; build_tx "$T" "use the Read tool to open the file" "$DONE_TEXT"
fired "$(guard "$FH" "$T")" && ok "Read tool demanded, never used, done -> BLOCK" \
                            || bad "Read tool demanded, never used, done -> BLOCK"

echo
echo "=== SILENT: the capability actually ran (non-error result) ==="
FH=$(newhome); arm "$FH" "spawn an agent to address the ClickUp task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the ClickUp task" "Done. The agent handled it." "Agent" "false" '{"prompt":"x"}'
fired "$(guard "$FH" "$T")" && bad "successful Agent spawn -> PASS" || ok "successful Agent spawn -> PASS"
is_armed "$FH" && bad "successful spawn clears the arm flag" || ok "successful spawn clears the arm flag"

FH=$(newhome); arm "$FH" "spawn an agent for the tests"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent for the tests" "Done." "Agent" "none" '{"prompt":"x"}'
fired "$(guard "$FH" "$T")" && bad "Agent spawn with no result yet (launched) -> PASS" || ok "Agent spawn with no result yet (launched) -> PASS"

FH=$(newhome); arm "$FH" "run /reflect on the beats"
T="$FH/t.jsonl"; build_tx "$T" "run /reflect on the beats" "Done." "Skill" "false" '{"skill":"reflect"}'
fired "$(guard "$FH" "$T")" && bad "slash cmd run via Skill -> PASS" || ok "slash cmd run via Skill -> PASS"

FH=$(newhome); arm "$FH" "use the Read tool to open the file"
T="$FH/t.jsonl"; build_tx "$T" "use the Read tool to open the file" "Done." "Read" "false" '{"file_path":"/x"}'
fired "$(guard "$FH" "$T")" && bad "Read tool used -> PASS" || ok "Read tool used -> PASS"

echo
echo "=== SILENT: user released the demand (sign-off) ==="
# (a) sign-off arrives as a later prompt -> arm hook clears the flag.
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
arm "$FH" "actually, do it yourself, solo is fine"
is_armed "$FH" && bad "a later sign-off prompt disarms" || ok "a later sign-off prompt disarms"
T="$FH/t.jsonl"; build_tx "$T" "actually, do it yourself, solo is fine" "$DONE_TEXT"
fired "$(guard "$FH" "$T")" && bad "disarmed by sign-off -> PASS" || ok "disarmed by sign-off -> PASS"

# (b) flag still armed but the guard sees a sign-off as the last prompt.
FH=$(newhome); printf 'agent\n' > "$(armed_flag "$FH")"
T="$FH/t.jsonl"; build_tx "$T" "just do it yourself, no need for an agent" "$DONE_TEXT"
fired "$(guard "$FH" "$T")" && bad "guard's own sign-off read -> PASS" || ok "guard's own sign-off read -> PASS"

# (c) a REAL apostrophe in "don't spawn" must disarm (regression: the old
# python3 -c quoting silently dropped apostrophes, so this never matched).
FH=$(newhome); arm "$FH" "spawn an agent for the audit"
arm "$FH" "on second thought, don't spawn it"
is_armed "$FH" && bad "apostrophe sign-off \"don't spawn\" disarms (quoting regression)" \
               || ok "apostrophe sign-off \"don't spawn\" disarms (quoting regression)"

# (d) method-flexibility approval disarms (Codex Medium-1 mitigation).
FH=$(newhome); arm "$FH" "spawn an agent for the audit"
arm "$FH" "another way is fine if that is easier"
is_armed "$FH" && bad "'another way is fine' disarms" || ok "'another way is fine' disarms"

echo
echo "=== SILENT: not claiming done / asking the user ==="
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" \
  "The spawn returned an internal error twice. How would you like me to proceed - should I keep debugging it?"
fired "$(guard "$FH" "$T")" && bad "asking how to proceed (no done claim) -> PASS" \
                            || ok "asking how to proceed (no done claim) -> PASS"

FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" \
  "Still working on the spawn - investigating why the team file is missing."
fired "$(guard "$FH" "$T")" && bad "still-working turn (no done claim) -> PASS" \
                            || ok "still-working turn (no done claim) -> PASS"

# Negated completion words must NOT read as a claim (Codex High-2).
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" \
  "I'm not done yet. Should I keep debugging the spawn?"
fired "$(guard "$FH" "$T")" && bad "\"I'm not done. Should I...?\" -> PASS (negated done)" \
                            || ok "\"I'm not done. Should I...?\" -> PASS (negated done)"

FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" \
  "Here's the error the spawn returned - the team file is missing."
fired "$(guard "$FH" "$T")" && bad "\"Here's the error...\" -> PASS (status, not completion)" \
                            || ok "\"Here's the error...\" -> PASS (status, not completion)"

# The field-failure shape still BLOCKS: claims done AND says the tool is broken.
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" \
  "Agent spawning is broken this session, so I did the whole task myself. Done."
fired "$(guard "$FH" "$T")" && ok "'broken, so I did it solo. Done.' still BLOCKS (the field failure)" \
                            || bad "'broken, so I did it solo. Done.' still BLOCKS (the field failure)"

# Blocked/cannot-continue status must PASS even though it contains "fixed" (Codex round-2 Low).
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" \
  "The spawn is still failing; this needs to be fixed before I can continue."
fired "$(guard "$FH" "$T")" && bad "'still failing ... needs to be fixed before I can continue' -> PASS" \
                            || ok "'still failing ... needs to be fixed before I can continue' -> PASS"

echo
echo "=== SILENT: not armed / no demand in the prompt ==="
FH=$(newhome); arm "$FH" "please update the README and fix the typo"
T="$FH/t.jsonl"; build_tx "$T" "please update the README and fix the typo" "$DONE_TEXT"
fired "$(guard "$FH" "$T")" && bad "no demand imperative -> PASS" || ok "no demand imperative -> PASS"

FH=$(newhome); arm "$FH" "kick off a subagent to do the audit"
T="$FH/t.jsonl"; build_tx "$T" "kick off a subagent to do the audit" "$DONE_TEXT"
fired "$(guard "$FH" "$T")" && bad "accepted-miss paraphrase never reaches a block -> PASS" \
                            || ok "accepted-miss paraphrase never reaches a block -> PASS"

echo
echo "=== ANTI-LOOP: blocks at most ONCE per session ==="
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" "$DONE_TEXT"
OUT1=$(guard "$FH" "$T")
arm "$FH" "spawn an agent to address the task"   # re-arm after the block cleared it
OUT2=$(guard "$FH" "$T")
{ fired "$OUT1" && ! fired "$OUT2"; } && ok "first stop blocks, second (re-armed) stop is silent" \
                                      || bad "first stop blocks, second (re-armed) stop is silent"
[ -f "$FH/.claude/.named-tool-swap-blocked.$SID" ] && ok "once-per-session blocked flag is written" \
                                                    || bad "once-per-session blocked flag is written"

FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent to address the task" "$DONE_TEXT"
fired "$(guard "$FH" "$T" true)" && bad "stop_hook_active -> silent (hook continuation)" \
                                 || ok "stop_hook_active -> silent (hook continuation)"

echo
echo "=== SILENT: subagent / teammate transcript is exempt ==="
FH=$(newhome); arm "$FH" "spawn an agent to address the task"
T="$FH/t.jsonl"
python3 - "$T" "$DONE_TEXT" <<'PY'
import json, sys
path, assistant = sys.argv[1], sys.argv[2]
with open(path, "w") as f:
    f.write(json.dumps({"type": "user", "isSidechain": True,
                        "message": {"role": "user", "content": "spawn an agent"}}) + "\n")
    f.write(json.dumps({"type": "assistant", "isSidechain": True,
                        "message": {"role": "assistant", "content": [{"type": "text", "text": assistant}]}}) + "\n")
PY
fired "$(guard "$FH" "$T")" && bad "subagent transcript -> PASS (lead-facing gate only)" \
                            || ok "subagent transcript -> PASS (lead-facing gate only)"

echo
echo "=== FAIL-OPEN ==="
FH=$(newhome)
RC=$(printf 'garbage-not-json' | HOME="$FH" bash "$GUARD" >/dev/null 2>&1; echo $?)
[ "$RC" = 0 ] && ok "guard malformed stdin -> exit 0" || bad "guard malformed stdin -> exit 0 (rc=$RC)"

FH=$(newhome)
RC=$(printf 'garbage-not-json' | HOME="$FH" bash "$ARM" >/dev/null 2>&1; echo $?)
[ "$RC" = 0 ] && ok "arm malformed stdin -> exit 0" || bad "arm malformed stdin -> exit 0 (rc=$RC)"

FH=$(newhome); arm "$FH" "spawn an agent to address the task"
OUT=$(guard "$FH" "$FH/does-not-exist.jsonl")
fired "$OUT" && bad "armed but transcript missing -> PASS (fail open)" \
             || ok "armed but transcript missing -> PASS (fail open)"

FH=$(newhome)
T="$FH/t.jsonl"; build_tx "$T" "spawn an agent" "$DONE_TEXT"
OUT=$(guard "$FH" "$T")   # no arm flag at all
fired "$OUT" && bad "no arm flag -> PASS (nothing demanded)" || ok "no arm flag -> PASS (nothing demanded)"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
