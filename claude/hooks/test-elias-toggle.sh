#!/usr/bin/env bash
# Falsification suite for elias-toggle.sh (UserPromptSubmit ELIAS toggle).
#
# Every case runs under a FAKE $HOME. Most cases deploy a real elias-mandate.sh into the
# fake HOME so the ON path can single-source its ruleset; case 25 deliberately does NOT, to
# prove the honest-failure path. Case 27 proves the ruleset is never duplicated into the
# toggle. Case 21/22/23 prove the whole-message matching never fires mid-prose.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/elias-toggle.sh"
MANDATE_SRC="$HERE/elias-mandate.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

# newhome deploys the mandate so the ON path can load the ruleset; newhome_bare does not.
newhome()      { FH="$(mktemp -d)"; mkdir -p "$FH/.claude/hooks"; cp "$MANDATE_SRC" "$FH/.claude/hooks/elias-mandate.sh"; chmod +x "$FH/.claude/hooks/elias-mandate.sh"; echo "$FH"; }
newhome_bare() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }
marker()  { [ -f "$1/.claude/.elias-enabled" ]; }
enable()  { : > "$1/.claude/.elias-enabled"; }

# run <home> <prompt-json> -> stdout of the hook
run() { printf '%s' "$2" | HOME="$1" bash "$HOOK"; }
sysmsg() { python3 -c 'import json,sys; print(json.load(sys.stdin).get("systemMessage",""))' 2>/dev/null; }
addctx() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])' 2>/dev/null; }
jprompt() { python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$1"; }

i=0
echo "=== ON aliases ==="
for cmd in "elias on" "elias mode on" "stakeholder mode" "stakeholder mode on" "explain like i'm a stakeholder" "explain like im a stakeholder"; do
  i=$((i+1))
  FH=$(newhome); OUT=$(run "$FH" "$(jprompt "$cmd")")
  SYS=$(printf '%s' "$OUT" | sysmsg); CTX=$(printf '%s' "$OUT" | addctx)
  { marker "$FH" && [[ "$SYS" == *"now ON"* ]] && [[ "$CTX" == *"ELIAS MODE IS ON"* ]]; } \
    && ok "$i. ON alias '$cmd' -> marker created, says ON, ruleset injected" \
    || bad "$i. ON alias '$cmd' -> marker created, says ON, ruleset injected"
done

echo
echo "=== OFF aliases ==="
for cmd in "elias off" "elias mode off" "stakeholder mode off" "technical mode" "back to technical"; do
  i=$((i+1))
  FH=$(newhome); enable "$FH"; OUT=$(run "$FH" "$(jprompt "$cmd")")
  SYS=$(printf '%s' "$OUT" | sysmsg); CTX=$(printf '%s' "$OUT" | addctx)
  { ! marker "$FH" && [[ "$SYS" == *"OFF"* ]] && [[ "$CTX" == *"ELIAS MODE IS OFF"* ]]; } \
    && ok "$i. OFF alias '$cmd' -> marker removed, says OFF, off note" \
    || bad "$i. OFF alias '$cmd' -> marker removed, says OFF, off note"
done

echo
echo "=== toggle / status / normalization ==="

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"elias toggle"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
{ marker "$FH" && [[ "$SYS" == *"toggled ON"* ]]; } && ok "12. elias toggle, marker absent -> created, ON" \
                                                     || bad "12. elias toggle, marker absent -> created, ON"

FH=$(newhome); enable "$FH"; OUT=$(run "$FH" '{"prompt":"elias toggle"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
{ ! marker "$FH" && [[ "$SYS" == *"toggled OFF"* ]]; } && ok "13. elias toggle, marker present -> removed, OFF" \
                                                        || bad "13. elias toggle, marker present -> removed, OFF"

FH=$(newhome); enable "$FH"; OUT=$(run "$FH" '{"prompt":"elias status"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
{ [[ "$SYS" == *"currently ON"* ]] && marker "$FH"; } && ok "14. elias status, marker present -> ON, unchanged" \
                                                       || bad "14. elias status, marker present -> ON, unchanged"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"elias?"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
{ [[ "$SYS" == *"currently OFF"* ]] && ! marker "$FH"; } && ok "15. elias? marker absent -> OFF, unchanged" \
                                                          || bad "15. elias? marker absent -> OFF, unchanged"

FH=$(newhome); enable "$FH"; OUT=$(run "$FH" '{"prompt":"stakeholder status"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
[[ "$SYS" == *"currently ON"* ]] && ok "16. stakeholder status -> same as elias status" \
                                 || bad "16. stakeholder status -> same as elias status"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"ELIAS ON"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
{ marker "$FH" && [[ "$SYS" == *"now ON"* ]]; } && ok "17. ELIAS ON (uppercase) -> works (lowercased)" \
                                                 || bad "17. ELIAS ON (uppercase) -> works (lowercased)"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"  elias   on  "}'); SYS=$(printf '%s' "$OUT" | sysmsg)
{ marker "$FH" && [[ "$SYS" == *"now ON"* ]]; } && ok "18. padded/internal-double-space -> works (collapse)" \
                                                 || bad "18. padded/internal-double-space -> works (collapse)"

ok19=1
for p in "elias on." "elias on!"; do
  FH=$(newhome); OUT=$(run "$FH" "$(jprompt "$p")"); SYS=$(printf '%s' "$OUT" | sysmsg)
  { marker "$FH" && [[ "$SYS" == *"now ON"* ]]; } || ok19=0
done
[ "$ok19" = 1 ] && ok "19. trailing . and ! both stripped -> ON" || bad "19. trailing . and ! both stripped -> ON"

FH=$(newhome)
J=$(python3 -c 'import json; print(json.dumps({"prompt":"Explain like I"+chr(0x2019)+"m a stakeholder"}))')
OUT=$(run "$FH" "$J"); SYS=$(printf '%s' "$OUT" | sysmsg)
{ marker "$FH" && [[ "$SYS" == *"now ON"* ]]; } && ok "20. curly apostrophe U+2019 mapped -> works" \
                                                 || bad "20. curly apostrophe U+2019 mapped -> works"

echo
echo "=== non-commands: never fire mid-prose ==="

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"we should tell elias on friday"}')
{ [ -z "$OUT" ] && ! marker "$FH"; } && ok "21. 'we should tell elias on friday' -> no output, unchanged" \
                                      || bad "21. 'we should tell elias on friday' -> no output, unchanged"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"elias"}')
[ -z "$OUT" ] && ok "22. 'elias' alone -> no output (deliberately not a command)" \
              || bad "22. 'elias' alone -> no output (deliberately not a command)"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"can you turn elias on?"}')
[ -z "$OUT" ] && ok "23. 'can you turn elias on?' -> no output (not a whole-message match)" \
              || bad "23. 'can you turn elias on?' -> no output (not a whole-message match)"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":""}'); RC=$?
FH2=$(newhome); OUT2=$(printf 'garbage-not-json' | HOME="$FH2" bash "$HOOK"); RC2=$?
{ [ -z "$OUT" ] && [ "$RC" = 0 ] && [ -z "$OUT2" ] && [ "$RC2" = 0 ]; } \
  && ok "24. empty prompt / malformed stdin -> no output, exit 0" \
  || bad "24. empty prompt / malformed stdin -> no output, exit 0 (rc=$RC rc2=$RC2)"

echo
echo "=== honest-failure and single-sourcing ==="

FH=$(newhome_bare); OUT=$(run "$FH" '{"prompt":"elias on"}')
SYS=$(printf '%s' "$OUT" | sysmsg); CTX=$(printf '%s' "$OUT" | addctx)
{ marker "$FH" && [[ "$SYS" == *"warning"* ]] && [[ "$CTX" == *"could not be loaded"* ]] && [[ "$CTX" != *"ELIAS MODE IS ON"* ]]; } \
  && ok "25. ON with mandate MISSING -> honest warning both channels, no false ruleset claim" \
  || bad "25. ON with mandate MISSING -> honest warning both channels, no false ruleset claim"

FH=$(newhome); chmod 500 "$FH/.claude"; OUT=$(run "$FH" '{"prompt":"elias on"}'); SYS=$(printf '%s' "$OUT" | sysmsg)
readonly_result=0
{ [[ "$SYS" == *"Could not enable"* ]] && [ ! -f "$FH/.claude/.elias-enabled" ]; } && readonly_result=1
chmod 700 "$FH/.claude" 2>/dev/null
[ "$readonly_result" = 1 ] && ok "26. read-only .claude -> honest failure, marker not created" \
                           || bad "26. read-only .claude -> honest failure, marker not created (root?)"

FH=$(newhome); OUT=$(run "$FH" '{"prompt":"elias on"}'); CTX=$(printf '%s' "$OUT" | addctx)
EXPECT=$(bash "$MANDATE_SRC" --emit-body)
[ "$CTX" = "$EXPECT" ] && ok "27. additionalContext byte-identical to --emit-body (single-sourced)" \
                       || bad "27. additionalContext byte-identical to --emit-body (single-sourced)"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
