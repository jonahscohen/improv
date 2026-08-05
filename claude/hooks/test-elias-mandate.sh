#!/usr/bin/env bash
# Falsification suite for elias-mandate.sh (SessionStart/PostCompact ELIAS injector).
#
# Case 1 is the single most important assertion in the entire feature: a mandate that
# injects while the ENABLE marker is ABSENT would put stakeholder framing into every
# engineering session on every machine that installs the grounding cluster. Case 1 and the
# MUTANT case 13 together prove the gate can go both ways.
#
# Every case runs under a FAKE $HOME, so no test can read or mutate real session state.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/elias-mandate.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }
enable()  { : > "$1/.claude/.elias-enabled"; }

# run <home> <args...> -> stdout of the hook
run() { HOME="$1" bash "$HOOK" "${@:2}"; }

ctx() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])' 2>/dev/null; }
ev()  { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["hookEventName"])' 2>/dev/null; }
is_json() { python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1; }

echo "=== R1: OFF means silent (the worst-defect guard) ==="

FH=$(newhome); OUT=$(run "$FH" SessionStart); RC=$?
{ [ -z "$OUT" ] && [ "$RC" = 0 ]; } && ok "1. marker absent, SessionStart -> zero bytes, exit 0" \
                                    || bad "1. marker absent, SessionStart -> zero bytes, exit 0 (rc=$RC len=${#OUT})"

FH=$(newhome); OUT=$(run "$FH" PostCompact); RC=$?
{ [ -z "$OUT" ] && [ "$RC" = 0 ]; } && ok "2. marker absent, PostCompact -> zero bytes, exit 0" \
                                    || bad "2. marker absent, PostCompact -> zero bytes, exit 0 (rc=$RC)"

FH=$(newhome); OUT=$(run "$FH"); RC=$?
{ [ -z "$OUT" ] && [ "$RC" = 0 ]; } && ok "3. marker absent, no argument -> zero bytes, exit 0" \
                                    || bad "3. marker absent, no argument -> zero bytes, exit 0 (rc=$RC)"

echo
echo "=== ON: injects with the correct event name and body ==="

FH=$(newhome); enable "$FH"; OUT=$(run "$FH" SessionStart)
{ printf '%s' "$OUT" | is_json && [ "$(printf '%s' "$OUT" | ev)" = "SessionStart" ]; } \
  && ok "4. marker present, SessionStart -> valid JSON, event=SessionStart" \
  || bad "4. marker present, SessionStart -> valid JSON, event=SessionStart"

FH=$(newhome); enable "$FH"; OUT=$(run "$FH" PostCompact)
{ printf '%s' "$OUT" | is_json && [ "$(printf '%s' "$OUT" | ev)" = "PostCompact" ]; } \
  && ok "5. marker present, PostCompact -> valid JSON, event=PostCompact" \
  || bad "5. marker present, PostCompact -> valid JSON, event=PostCompact"

FH=$(newhome); enable "$FH"; OUT=$(run "$FH")
[ "$(printf '%s' "$OUT" | ev)" = "SessionStart" ] \
  && ok "6. marker present, no argument -> event defaults to SessionStart" \
  || bad "6. marker present, no argument -> event defaults to SessionStart"

FH=$(newhome); enable "$FH"; CTX=$(run "$FH" SessionStart | ctx)
[[ "$CTX" == *"ELIAS MODE IS ON"* ]] && ok "7. additionalContext contains ELIAS MODE IS ON" \
                                     || bad "7. additionalContext contains ELIAS MODE IS ON"

FH=$(newhome); enable "$FH"; CTX=$(run "$FH" SessionStart | ctx)
[ "$(printf '%s\n' "$CTX" | grep -c '^10\.')" = "1" ] \
  && ok "8. additionalContext carries all ten numbered rules (^10. found once)" \
  || bad "8. additionalContext carries all ten numbered rules (^10. found once)"

FH=$(newhome); enable "$FH"; CTX=$(run "$FH" SessionStart | ctx)
[[ "$CTX" == *"WITH CONCISE MODE"* ]] && ok "9. additionalContext names the concise composition" \
                                     || bad "9. additionalContext names the concise composition"

echo
echo "=== --emit-body: raw body, single-sourced, marker-independent ==="

OUT=$(bash "$HOOK" --emit-body); RC=$?
{ [[ "$OUT" == "ELIAS MODE IS ON"* ]] && ! printf '%s' "$OUT" | is_json && [ "$RC" = 0 ]; } \
  && ok "10. --emit-body prints the raw ruleset, is NOT JSON, exit 0" \
  || bad "10. --emit-body prints the raw ruleset, is NOT JSON, exit 0 (rc=$RC)"

OUT=$(HOME="$(mktemp -d)" bash "$HOOK" --emit-body)
[[ "$OUT" == "ELIAS MODE IS ON"* ]] && ok "11. --emit-body still prints with marker absent" \
                                    || bad "11. --emit-body still prints with marker absent"

# Hygiene: no emdash (U+2014) and no emoji. Expressed via codepoint so this test file itself
# carries no forbidden character; b.isascii() is the strict proxy (any emdash or emoji is
# non-ASCII), and the explicit emdash check documents intent.
bash "$HOOK" --emit-body | python3 -c 'import sys; b=sys.stdin.read(); assert chr(0x2014) not in b; assert b.isascii()' 2>/dev/null \
  && ok "12. ruleset hygiene: no emdash, no emoji (body is ASCII)" \
  || bad "12. ruleset hygiene: no emdash, no emoji (body is ASCII)"

echo
echo "=== MUTANT (a gate that cannot go red is not a gate) ==="

FH=$(newhome); enable "$FH"; OUT=$(run "$FH" SessionStart)
[ -n "$OUT" ] && ok "13. marker present -> output is non-empty (proves case 1 is a real gate)" \
              || bad "13. marker present -> output is non-empty"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
