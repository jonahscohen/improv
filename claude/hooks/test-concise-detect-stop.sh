#!/usr/bin/env bash
# Falsification suite for concise-detect-stop.sh (Stop-event concise gate).
#
# Every case runs under a FAKE $HOME with a stubbed transcript, so no test can read
# or mutate real session state. Both directions are covered: the gate must FIRE on
# the two measured drift modes and must stay SILENT on everything else, especially
# the paths where a false fire would be expensive (deep-dive requests, code dumps,
# a second consecutive stop). Fixtures marked REAL are verbatim shapes taken from
# this harness's own transcripts on 2026-07-26.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/concise-detect-stop.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

SID="concise-test-session"

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }

# transcript <file> <assistant-text> [user-text]
transcript() {
  python3 - "$1" "$2" "${3:-give me the status}" <<'PY'
import json, sys
path, assistant, user = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "w") as f:
    f.write(json.dumps({"type": "user", "message": {"role": "user", "content": user}}) + "\n")
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "text", "text": assistant}]}}) + "\n")
PY
}

# run <fake-home> <transcript-path> [stop_hook_active] -> stdout of the hook
run() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":%s}' \
    "$SID" "$2" "${3:-false}" | HOME="$1" bash "$HOOK" 2>/dev/null
}

run_rc() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":%s}' \
    "$SID" "$2" "${3:-false}" | HOME="$1" bash "$HOOK" >/dev/null 2>&1; echo $?
}

fired()  { [[ "$1" == *'"decision": "block"'* ]]; }

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# REAL (2026-07-26): answer, conclusion, then two appended tangent blocks.
FIX_TANGENT_REAL='The concise-mode feature is wired on three hooks:

1. `concise-mandate.sh SessionStart` on SessionStart - injects the brevity ruleset
2. `concise-mandate.sh PostCompact` on PostCompact - re-injects so it survives compaction
3. `concise-toggle.sh` on UserPromptSubmit - the runtime switch

It was built as a hook deliberately: the upstream project installs as a per-invocation slash command, which cannot be default-on. It was committed earlier today, so a fresh clone wires it too.

Two side notes from the same check:

- The plugin and its marketplace are registered on this machine, currently disabled. So my earlier claim was true of the repo but not the machine.
- Bash is still blocked despite the model switch - the guard reads the session as a different model, so it likely only applies to new sessions.'

# REAL (2026-07-26): closing action reached, then a "Still unconfirmed" addendum.
FIX_TANGENT_REAL2='Teardown is done for the two teammates that acknowledged: both processes are gone and both panes closed.

I traced the near-miss to measuring the two env sides with different instruments, and recorded it in the failure-analysis beat.

Next: run `cmux list-panels` and paste the output.

Still unconfirmed: flow-auditor and artifact-builder never sent termination messages after the re-issued shutdowns. If you run that command, I will name the exact close command for whatever is still standing.'

FIX_CLEAN='Concise mode is live on three hooks.

1. `concise-mandate.sh` injects the ruleset at SessionStart
2. `concise-toggle.sh` flips it at runtime
3. State is the absence of `~/.claude/.concise-disabled`

Next: say "concise status" in a fresh session to confirm the injection landed.'

FIX_LIST_6='Here is what changed in the hook layer.

1. Added the Stop gate
2. Rewrote rule 3 for the terminal stop
3. Rewrote rule 7 for the item ceiling
4. Wired the grounding cluster
5. Registered the hook in live settings
6. Backed up settings before the edit

Next: run the suite.'

FIX_LIST_5='Here is what changed in the hook layer.

1. Added the Stop gate
2. Rewrote rule 3 for the terminal stop
3. Rewrote rule 7 for the item ceiling
4. Wired the grounding cluster
5. Registered the hook in live settings

Next: run the suite.'

# ---------------------------------------------------------------------------
echo "=== FIRES: the two measured drift modes ==="

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_TANGENT_REAL"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "REAL post-conclusion tangent (Two side notes) -> block" \
             || bad "REAL post-conclusion tangent (Two side notes) -> block"
[[ "$OUT" == *"Two side notes"* ]] && ok "block reason names the offending opener" \
                                   || bad "block reason names the offending opener"
[[ "$OUT" == *"Rule 3"* && "$OUT" == *"rule 4"* ]] && ok "block reason cites rules 3 and 4" \
                                                   || bad "block reason cites rules 3 and 4"

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_TANGENT_REAL2"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "REAL trailing addendum (Still unconfirmed) -> block" \
             || bad "REAL trailing addendum (Still unconfirmed) -> block"

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_LIST_6"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "6 items at one level -> block" || bad "6 items at one level -> block"
[[ "$OUT" == *"6 items"* && "$OUT" == *"Rule 7"* ]] && ok "block reason names the count and rule 7" \
                                                    || bad "block reason names the count and rule 7"

# ---------------------------------------------------------------------------
echo
echo "=== SILENT: clean output ==="

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_CLEAN"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "clean response ending at the next action -> silent" \
             || ok "clean response ending at the next action -> silent"

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_LIST_5"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "5 items (at the ceiling) -> silent" || ok "5 items (at the ceiling) -> silent"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'Fixed the flaky test by pinning the clock.

Next: re-run the suite to confirm it stays green.

Also worth checking later.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "single trailing sentence (not a tangent block) -> silent" \
             || ok "single trailing sentence (not a tangent block) -> silent"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'Also worth noting up front: the cache key rolled over last night, which is why the build looked broken. I reverted the key and the build is green again. Nothing else changed.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "opener at the TOP of a response (position gate) -> silent" \
             || ok "opener at the TOP of a response (position gate) -> silent"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'Two separate lists, four items each, cannot sum into an overrun.

1. one
2. two
3. three
4. four

That was the first group. Here is the second.

1. five
2. six
3. seven
4. eight

Next: read the summary.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "two 4-item lists split by prose -> silent (runs do not sum)" \
             || ok "two 4-item lists split by prose -> silent (runs do not sum)"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'Nested detail should not inflate the parent count.

1. first
   - a
   - b
   - c
   - d
2. second
   - e
   - f
   - g
   - h

Next: read the summary.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "nested sub-items do not inflate the parent run -> silent" \
             || ok "nested sub-items do not inflate the parent run -> silent"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'Here is the config as requested.

```json
{
  "hooks": {
    "Stop": [
      {"command": "a"},
      {"command": "b"},
      {"command": "c"},
      {"command": "d"},
      {"command": "e"},
      {"command": "f"},
      {"command": "g"}
    ]
  }
}
```

Next: paste that into settings.json.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "list-like lines inside a fenced block -> silent" \
             || ok "list-like lines inside a fenced block -> silent"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'You wrote:

> Also, one more thing: the gate should never fire on quoted material.
> Separately, this second quoted line must not count either.

That is handled - quoted lines are stripped before detection.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "tangent openers inside a blockquote -> silent" \
             || ok "tangent openers inside a blockquote -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== SILENT: documented skip conditions ==="

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" "$FIX_TANGENT_REAL" "explain in detail how the concise hooks fit together"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "user asked for depth (explain in detail) -> silent" \
             || ok "user asked for depth (explain in detail) -> silent"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" "$FIX_LIST_6" "walk me through every step"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "user asked to be walked through -> silent" \
             || ok "user asked to be walked through -> silent"

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_TANGENT_REAL"
: > "$FH/.claude/.concise-disabled"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "concise mode disabled -> silent" || ok "concise mode disabled -> silent"

FH=$(newhome); T="$FH/t.jsonl"
CODE_BODY='```python
def a():
    return 1


def b():
    return 2


def c():
    return 3


def d():
    return 4
```'
transcript "$T" "Here is the module.

$CODE_BODY

Also worth noting: the helpers are pure. They take no arguments and touch no globals."
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "response is predominantly code -> silent" \
             || ok "response is predominantly code -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== ANTI-LOOP ==="

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_TANGENT_REAL"
OUT1=$(run "$FH" "$T")
OUT2=$(run "$FH" "$T")
{ fired "$OUT1" && ! fired "$OUT2"; } && ok "second consecutive stop -> silent (never blocks twice)" \
                                      || bad "second consecutive stop -> silent (never blocks twice)"
[ -f "$FH/.claude/.concise-stop-blocked.$SID" ] && ok "burst flag is written on the block" \
                                                || bad "burst flag is written on the block"

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_TANGENT_REAL"
run "$FH" "$T" >/dev/null
transcript "$T" "$FIX_CLEAN"
run "$FH" "$T" >/dev/null
[ -f "$FH/.claude/.concise-stop-blocked.$SID" ] && bad "a clean stop re-arms the gate" \
                                                || ok "a clean stop re-arms the gate"
transcript "$T" "$FIX_TANGENT_REAL"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "after re-arming, a later violation blocks again" \
             || bad "after re-arming, a later violation blocks again"

FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_TANGENT_REAL"
OUT=$(run "$FH" "$T" true)
fired "$OUT" && bad "stop_hook_active -> silent (hook continuation)" \
             || ok "stop_hook_active -> silent (hook continuation)"

# ---------------------------------------------------------------------------
echo
echo "=== FAIL-OPEN ==="

FH=$(newhome); T="$FH/t.jsonl"
printf 'not json at all\n{"type":"assistant"\n' > "$T"
OUT=$(run "$FH" "$T"); RC=$(run_rc "$FH" "$T")
{ ! fired "$OUT" && [ "$RC" = 0 ]; } && ok "malformed transcript -> silent, exit 0" \
                                     || bad "malformed transcript -> silent, exit 0 (rc=$RC)"

# Codex 2026-07-26 (High): a parse failure AFTER the judged response means the
# real final response may be truncated or missing - grade nothing, allow.
FH=$(newhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_LIST_6"
printf '{"type":"assistant","message":{"role":"assis\n' >> "$T"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "corrupt line AFTER the response -> silent (fail open)" \
             || ok "corrupt line AFTER the response -> silent (fail open)"

# The complement: a corrupt line BEFORE a complete response must not disable the
# gate, or one bad record would mute it for the rest of the session.
FH=$(newhome); T="$FH/t.jsonl"
printf 'not json at all\n' > "$T"
python3 - "$T" "$FIX_LIST_6" <<'PY'
import json, sys
with open(sys.argv[1], "a") as f:
    f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "status?"}}) + "\n")
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "text", "text": sys.argv[2]}]}}) + "\n")
PY
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "corrupt line BEFORE a complete response -> still fires" \
             || bad "corrupt line BEFORE a complete response -> still fires"

# Codex 2026-07-26 (Medium): indented command output whose lines start with "-"
# is a markdown code block, not a list level.
FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" 'The audit output is below.

    - safety: 5 hooks ok
    - verification: 8 hooks ok
    - question-discipline: 4 hooks ok
    - grounding: 7 hooks ok
    - api-drift: 3 hooks ok
    - planning-git: 2 hooks ok

Next: re-run the audit after the install.'
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "indented output block with 6 dash lines -> silent" \
             || ok "indented output block with 6 dash lines -> silent"

FH=$(newhome)
RC=$(run_rc "$FH" "$FH/does-not-exist.jsonl")
[ "$RC" = 0 ] && ok "missing transcript file -> exit 0" || bad "missing transcript file -> exit 0 (rc=$RC)"

FH=$(newhome)
RC=$(printf 'garbage-not-json' | HOME="$FH" bash "$HOOK" >/dev/null 2>&1; echo $?)
[ "$RC" = 0 ] && ok "malformed stdin -> exit 0" || bad "malformed stdin -> exit 0 (rc=$RC)"

FH=$(newhome); T="$FH/t.jsonl"
python3 - "$T" <<'PY'
import json, sys
with open(sys.argv[1], "w") as f:
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "tool_use", "name": "Bash", "input": {}}]}}) + "\n")
PY
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "tool-only turn (no assistant text) -> silent" \
             || ok "tool-only turn (no assistant text) -> silent"

FH=$(newhome); T="$FH/t.jsonl"
python3 - "$T" "$FIX_CLEAN" "$FIX_TANGENT_REAL" <<'PY'
import json, sys
path, lead, sidechain = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "w") as f:
    f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "status?"}}) + "\n")
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "text", "text": lead}]}}) + "\n")
    # a teammate's verbose turn recorded in the same transcript
    f.write(json.dumps({"type": "assistant", "isSidechain": True, "message": {"role": "assistant",
            "content": [{"type": "text", "text": sidechain}]}}) + "\n")
PY
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "a subagent (isSidechain) turn does not judge the lead -> silent" \
             || ok "a subagent (isSidechain) turn does not judge the lead -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== MUTANTS (a gate that cannot go red is not a gate) ==="

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" "${FIX_TANGENT_REAL/Two side notes from the same check:/One loose end from the same check:}"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "swapping in a different lexicon opener still fires" \
             || bad "swapping in a different lexicon opener still fires"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" "${FIX_TANGENT_REAL/Two side notes from the same check:/The remaining work for this task:}"
OUT=$(run "$FH" "$T")
fired "$OUT" && bad "same shape with a NON-tangent heading -> silent (lexicon is load-bearing)" \
             || ok "same shape with a NON-tangent heading -> silent (lexicon is load-bearing)"

FH=$(newhome); T="$FH/t.jsonl"
transcript "$T" "${FIX_LIST_6/6. Backed up settings before the edit/6. Backed up settings before the edit
7. Re-ran the packaging suites}"
OUT=$(run "$FH" "$T")
[[ "$OUT" == *"7 items"* ]] && ok "reported count tracks the real overrun (7)" \
                            || bad "reported count tracks the real overrun (7)"

echo


# ===========================================================================
# Detection 3: VOLUME (added 2026-07-31, Jonah: "make it actually work")
#
# Measured on 232 real responses from a live transcript: the tangent+list gates
# fired on 13 (5.6%) while 94 (40.5%) were long multi-section answers. The lexicon
# can only catch an opener it already knows. These cases lock in the volume gate
# AND the exemptions that keep it off legitimate output.
# ===========================================================================

LONG_PROSE="The fix is in. $(python3 -c "print('This sentence adds narration the reader did not ask for. '*45)")"
THREE_SECTIONS='**First.** Detail about it here.

**Second.** More detail here.

**Third.** Yet more detail.

Closing line.'
BIG_TABLE="Here are the numbers.

| a | b |
|---|---|
$(python3 -c "print('\n'.join('| row%d | value%d |' % (i, i) for i in range(60)))")

Next: push it."
BIG_CODE="Done.

\`\`\`
$(python3 -c "print('\n'.join('line %d of output' % i for i in range(120)))")
\`\`\`"

H="$(newhome)"; transcript "$H/t.jsonl" "$LONG_PROSE"
fired "$(run "$H" "$H/t.jsonl")" && ok "a wall of prose fires the volume gate" || bad "a wall of prose fires the volume gate"

# The shape the ORIGINAL gate exempted outright: one unbroken paragraph was a
# single non-empty line, so too-little-prose waved it through at any length.
H="$(newhome)"; transcript "$H/t.jsonl" "$(printf '%s' "$LONG_PROSE" | tr -d '\n')"
fired "$(run "$H" "$H/t.jsonl")" && ok "a SINGLE-paragraph wall still fires (was exempt as too-little-prose)" || bad "a SINGLE-paragraph wall still fires"

H="$(newhome)"; transcript "$H/t.jsonl" "$THREE_SECTIONS"
fired "$(run "$H" "$H/t.jsonl")" && ok "three bold-led sections fire the briefing gate" || bad "three bold-led sections fire the briefing gate"

H="$(newhome)"; transcript "$H/t.jsonl" '**Only.** One section and a short answer.'
fired "$(run "$H" "$H/t.jsonl")" && bad "one bold section stays silent" || ok "one bold section stays silent"

# Exemptions. A false fire here is the expensive failure the header warns about.
H="$(newhome)"; transcript "$H/t.jsonl" "$BIG_TABLE"
fired "$(run "$H" "$H/t.jsonl")" && bad "a wide table is data, not prose -> silent" || ok "a wide table is data, not prose -> silent"

H="$(newhome)"; transcript "$H/t.jsonl" "$BIG_CODE"
fired "$(run "$H" "$H/t.jsonl")" && bad "a large code dump -> silent" || ok "a large code dump -> silent"

H="$(newhome)"; transcript "$H/t.jsonl" "$LONG_PROSE" "explain in detail how this works"
fired "$(run "$H" "$H/t.jsonl")" && bad "depth requested -> volume gate stands down" || ok "depth requested -> volume gate stands down"

H="$(newhome)"; transcript "$H/t.jsonl" "$LONG_PROSE" "walk me through the whole thing"
fired "$(run "$H" "$H/t.jsonl")" && bad "'walk me through' -> volume gate stands down" || ok "'walk me through' -> volume gate stands down"

# Tunable, same pattern as CHROME_TABGROUP_IDLE_SECONDS.
H="$(newhome)"; transcript "$H/t.jsonl" "$LONG_PROSE"
out=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$H/t.jsonl" \
      | HOME="$H" CONCISE_WORD_CAP=100000 CONCISE_SECTION_CAP=99 bash "$HOOK" 2>/dev/null)
fired "$out" && bad "CONCISE_WORD_CAP raises the ceiling" || ok "CONCISE_WORD_CAP raises the ceiling"

# MUTANT: the gate must be able to go red for the right reason.
H="$(newhome)"; transcript "$H/t.jsonl" "$LONG_PROSE"
[[ "$(run "$H" "$H/t.jsonl")" == *"words of prose"* ]] && ok "volume block names the word count" || bad "volume block names the word count"
H="$(newhome)"; transcript "$H/t.jsonl" "$THREE_SECTIONS"
[[ "$(run "$H" "$H/t.jsonl")" == *"bold-led sections"* ]] && ok "section block names the section count" || bad "section block names the section count"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
