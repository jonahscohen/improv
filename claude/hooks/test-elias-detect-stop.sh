#!/usr/bin/env bash
# Falsification suite for elias-detect-stop.sh (Stop-event ELIAS gate).
#
# Both directions are covered: the gate must FIRE on engineering artifacts in a stakeholder
# reply (a fence, a path, a command, code-shaped backtick idents) and stay SILENT on prose
# that is merely technical in flavour. It must also SKIP entirely when ELIAS is off or the
# user asked for the technical layer, defer to concise on a shared burst, and fail open.
# Every case runs under a FAKE $HOME with a stubbed transcript.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/elias-detect-stop.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

SID="elias-test-session"

# mkhome enables ELIAS; barehome leaves it off (for the ELIAS-off skip case).
mkhome()   { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; : > "$FH/.claude/.elias-enabled"; echo "$FH"; }
barehome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }

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
# Fixtures (all apostrophe-free so backticked ones can be single-quoted)
# ---------------------------------------------------------------------------
FIX_CLEAN='Client logins work again, and the change is on track to land before the Thursday review. The one open risk is that the payment provider has not confirmed the new settings, which could add about a day. Next: please confirm with finance whether we can schedule the switch for Wednesday morning.'

FIX_FENCE='Client logins work again and the change ships tonight.

```js
function getToken(){ return 1 }
```

Next: confirm you can sign in.'

FIX_PATH='The fix is in claude/hooks/elias-mandate.sh and it ships tonight.'

FIX_CMD='The build is ready for release.
npm run build --workspace web
That produces the package the client will install.'

FIX_IDENTS='The change touches two internal pieces, `getUserToken()` and the `--dry-run` switch, but the effect for the reader is the same.'

FIX_ONE_IDENT='The change touches one internal piece, `getUserToken()`, but the effect for the reader is the same.'

FIX_URL='The staging site is live at https://staging.example.com/invoices/latest and it looks right for the client demo.'

FIX_BRAND='We are upgrading Node.js next sprint, which should make everything load noticeably faster for the client.'

FIX_HESHE='The new permissions cover read/write/execute for every account, and the same rule applies to he/she/it without exception.'

FIX_ONLY_PATH='claude/hooks/elias-mandate.sh'

FIX_BIGCODE='Here is the whole module.

```
const a = compute(1)
const b = compute(2)
const c = compute(3)
const d = combine(a, b, c)
export default d
```'

FIX_GOLIVE='Go live next week. The client sign-off is the only thing left, and nothing on our side is blocking it.'

FIX_QUOTED_PATH='You asked about the earlier note:
> The fix is in claude/hooks/elias-mandate.sh and it ships tonight.
That work is now done and live for everyone.'

FIX_PLAINNOUN='The fix is in the login screen and it ships tonight.'

# ---------------------------------------------------------------------------
echo "=== FIRES: engineering artifacts in a stakeholder reply ==="

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_FENCE"
OUT=$(run "$FH" "$T")
{ fired "$OUT" && [[ "$OUT" == *"Rule 3"* ]] && [[ "$OUT" == *"code block"* ]]; } \
  && ok "1. FIX_FENCE -> block, reason cites Rule 3 and code block" \
  || bad "1. FIX_FENCE -> block, reason cites Rule 3 and code block"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH"
OUT=$(run "$FH" "$T")
{ fired "$OUT" && [[ "$OUT" == *"claude/hooks/elias-mandate.sh"* ]]; } \
  && ok "2. FIX_PATH -> block, reason quotes the path" \
  || bad "2. FIX_PATH -> block, reason quotes the path"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_CMD"
OUT=$(run "$FH" "$T")
{ fired "$OUT" && [[ "$OUT" == *"npm run build --workspace web"* ]]; } \
  && ok "3. FIX_CMD -> block, reason quotes the command" \
  || bad "3. FIX_CMD -> block, reason quotes the command"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_IDENTS"
OUT=$(run "$FH" "$T")
{ fired "$OUT" && [[ "$OUT" == *"Rules 3 and 4"* ]] && [[ "$OUT" == *"2 code-shaped"* ]]; } \
  && ok "4. FIX_IDENTS -> block, reason names count and cites rules 3 and 4" \
  || bad "4. FIX_IDENTS -> block, reason names count and cites rules 3 and 4"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_ONLY_PATH"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "5. one-line answer that is ONLY a path -> block (no too-little-prose skip)" \
             || bad "5. one-line answer that is ONLY a path -> block (no too-little-prose skip)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_BIGCODE"
OUT=$(run "$FH" "$T")
fired "$OUT" && ok "6. 90-percent code, unrequested -> block (predominantly-code INVERSION)" \
             || bad "6. 90-percent code, unrequested -> block (predominantly-code INVERSION)"

# ---------------------------------------------------------------------------
echo
echo "=== SILENT: plain prose that is merely technical in flavour ==="

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_CLEAN"
fired "$(run "$FH" "$T")" && bad "7. FIX_CLEAN -> silent" || ok "7. FIX_CLEAN -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_ONE_IDENT"
fired "$(run "$FH" "$T")" && bad "8. one backticked token (under threshold) -> silent" \
                          || ok "8. one backticked token (under threshold) -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_URL"
fired "$(run "$FH" "$T")" && bad "9. FIX_URL (scrubbed before path match) -> silent" \
                          || ok "9. FIX_URL (scrubbed before path match) -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_BRAND"
fired "$(run "$FH" "$T")" && bad "10. FIX_BRAND (Node.js is a product name) -> silent" \
                          || ok "10. FIX_BRAND (Node.js is a product name) -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_HESHE"
fired "$(run "$FH" "$T")" && bad "11. slash-separated English words are not paths -> silent" \
                          || ok "11. slash-separated English words are not paths -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_GOLIVE"
fired "$(run "$FH" "$T")" && bad "12. sentence starting 'Go live next week.' -> silent" \
                          || ok "12. sentence starting 'Go live next week.' -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_QUOTED_PATH"
fired "$(run "$FH" "$T")" && bad "13. FIX_PATH inside a blockquote -> silent (quoted material)" \
                          || ok "13. FIX_PATH inside a blockquote -> silent (quoted material)"

# ---------------------------------------------------------------------------
echo
echo "=== SKIPS: mode off, or user asked for the technical layer ==="

FH=$(barehome); T="$FH/t.jsonl"; transcript "$T" "$FIX_FENCE"
fired "$(run "$FH" "$T")" && bad "14. FIX_FENCE with marker ABSENT -> silent (ELIAS off)" \
                          || ok "14. FIX_FENCE with marker ABSENT -> silent (ELIAS off)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH" "show me the code"
fired "$(run "$FH" "$T")" && bad "15. user prompt 'show me the code' -> silent" \
                          || ok "15. user prompt 'show me the code' -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH" "which file broke?"
fired "$(run "$FH" "$T")" && bad "16. user prompt 'which file broke?' -> silent" \
                          || ok "16. user prompt 'which file broke?' -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_FENCE" 'here is what I tried: ```x```'
fired "$(run "$FH" "$T")" && bad "17. user prompt containing a fenced block -> silent" \
                          || ok "17. user prompt containing a fenced block -> silent"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH" "please check /etc/hosts for me"
fired "$(run "$FH" "$T")" && bad "18. user prompt containing /etc/hosts -> silent" \
                          || ok "18. user prompt containing /etc/hosts -> silent"

FH=$(mkhome); T="$FH/t.jsonl"
python3 - "$T" <<'PY'
import json, sys
with open(sys.argv[1], "w") as f:
    f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "status?"}}) + "\n")
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "tool_use", "name": "Bash", "input": {}}]}}) + "\n")
PY
fired "$(run "$FH" "$T")" && bad "19. tool-only assistant turn (no text) -> silent" \
                          || ok "19. tool-only assistant turn (no text) -> silent"

FH=$(mkhome); T="$FH/t.jsonl"
python3 - "$T" "$FIX_CLEAN" "$FIX_PATH" <<'PY'
import json, sys
path, lead, sidechain = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "w") as f:
    f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "status?"}}) + "\n")
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "text", "text": lead}]}}) + "\n")
    f.write(json.dumps({"type": "assistant", "isSidechain": True, "message": {"role": "assistant",
            "content": [{"type": "text", "text": sidechain}]}}) + "\n")
PY
fired "$(run "$FH" "$T")" && bad "20. isSidechain turn carrying a path, lead clean -> silent" \
                          || ok "20. isSidechain turn carrying a path, lead clean -> silent"

# ---------------------------------------------------------------------------
echo
echo "=== ANTI-LOOP ==="

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH"
OUT1=$(run "$FH" "$T"); OUT2=$(run "$FH" "$T")
{ fired "$OUT1" && ! fired "$OUT2"; } && ok "21. two consecutive violating stops -> first blocks, second silent" \
                                      || bad "21. two consecutive violating stops -> first blocks, second silent"
[ -f "$FH/.claude/.elias-stop-blocked.$SID" ] && ok "22. burst flag written on the block" \
                                              || bad "22. burst flag written on the block"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH"
run "$FH" "$T" >/dev/null
transcript "$T" "$FIX_CLEAN"; run "$FH" "$T" >/dev/null
transcript "$T" "$FIX_PATH"
fired "$(run "$FH" "$T")" && ok "23. violation, clean, violation -> third blocks again (re-armed)" \
                          || bad "23. violation, clean, violation -> third blocks again (re-armed)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH"
fired "$(run "$FH" "$T" true)" && bad "24. stop_hook_active -> silent (hook continuation)" \
                               || ok "24. stop_hook_active -> silent (hook continuation)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH"
: > "$FH/.claude/.concise-stop-blocked.$SID"
fired "$(run "$FH" "$T")" && bad "25. concise flag pre-set, violation -> silent (cross-gate deferral)" \
                          || ok "25. concise flag pre-set, violation -> silent (cross-gate deferral)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_CLEAN"
: > "$FH/.claude/.concise-stop-blocked.$SID"
: > "$FH/.claude/.elias-stop-blocked.$SID"
run "$FH" "$T" >/dev/null
[ ! -f "$FH/.claude/.elias-stop-blocked.$SID" ] && ok "26. concise flag set + CLEAN -> elias flag still removed (re-arm beats deferral)" \
                                                || bad "26. concise flag set + CLEAN -> elias flag still removed (re-arm beats deferral)"

# ---------------------------------------------------------------------------
echo
echo "=== FAIL-OPEN ==="

FH=$(mkhome); T="$FH/t.jsonl"
printf 'not json at all\n{"type":"assistant"\n' > "$T"
OUT=$(run "$FH" "$T"); RC=$(run_rc "$FH" "$T")
{ ! fired "$OUT" && [ "$RC" = 0 ]; } && ok "27. malformed transcript -> silent, exit 0" \
                                     || bad "27. malformed transcript -> silent, exit 0 (rc=$RC)"

FH=$(mkhome)
RC=$(run_rc "$FH" "$FH/does-not-exist.jsonl")
[ "$RC" = 0 ] && ok "28. missing transcript file -> exit 0" || bad "28. missing transcript file -> exit 0 (rc=$RC)"

FH=$(mkhome)
RC=$(printf 'garbage-not-json' | HOME="$FH" bash "$HOOK" >/dev/null 2>&1; echo $?)
[ "$RC" = 0 ] && ok "29. malformed stdin -> exit 0" || bad "29. malformed stdin -> exit 0 (rc=$RC)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PATH"
printf '{"type":"assistant","message":{"role":"assis\n' >> "$T"
fired "$(run "$FH" "$T")" && bad "30. corrupt line AFTER the response -> silent (fail open)" \
                          || ok "30. corrupt line AFTER the response -> silent (fail open)"

FH=$(mkhome); T="$FH/t.jsonl"
printf 'not json at all\n' > "$T"
python3 - "$T" "$FIX_PATH" <<'PY'
import json, sys
with open(sys.argv[1], "a") as f:
    f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "status?"}}) + "\n")
    f.write(json.dumps({"type": "assistant", "message": {"role": "assistant",
            "content": [{"type": "text", "text": sys.argv[2]}]}}) + "\n")
PY
fired "$(run "$FH" "$T")" && ok "31. corrupt line BEFORE a complete response -> still fires" \
                          || bad "31. corrupt line BEFORE a complete response -> still fires"

# ---------------------------------------------------------------------------
echo
echo "=== MUTANTS (a gate that cannot go red is not a gate) ==="

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_PLAINNOUN"
fired "$(run "$FH" "$T")" && bad "32. path replaced by a plain noun -> silent (path detection load-bearing)" \
                          || ok "32. path replaced by a plain noun -> silent (path detection load-bearing)"

FH=$(mkhome); T="$FH/t.jsonl"; transcript "$T" "$FIX_ONE_IDENT"
fired "$(run "$FH" "$T")" && bad "33. idents reduced to one -> silent (threshold load-bearing)" \
                          || ok "33. idents reduced to one -> silent (threshold load-bearing)"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
