#!/usr/bin/env bash
# Falsification suite for artifact-open-stop.sh (Stop gate).
#
# The core assertions: block once while a real pending entry remains, stay silent when
# none, fire only once per burst (stop_hook_active), re-arm after a clean stop, self-heal
# past a deleted artifact, and fail open on malformed input. The MUTANT case proves the
# gate can go both ways: identical stdin blocks with a live entry and passes without one.
#
# Every case runs under a FAKE $HOME. Pending entries point at real files under a
# repo-local WORK dir so the self-heal "does the file still exist" check is exercised
# against real disk state.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/artifact-open-stop.sh"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$REPO/.artifact-test-stop.$$"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }
disable() { : > "$1/.claude/.artifact-surface-disabled"; }

# seed <home> <session> <abs_path...> : write a pending list verbatim
seed() { local h="$1" s="$2"; shift 2; : > "$h/.claude/.artifact-pending.$s"
         for p in "$@"; do printf '%s\n' "$p" >> "$h/.claude/.artifact-pending.$s"; done; }
# stop <home> <session> <stop_hook_active true|false> -> stdout
stop() {
  printf '{"session_id":"%s","tool_name":"Stop","stop_hook_active":%s}' "$2" "$3" \
    | HOME="$1" bash "$HOOK"
}
is_block() { python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("decision")=="block" else 1)' 2>/dev/null; }
is_empty() { [ "$1" = "{}" ]; }
pfile()    { echo "$1/.claude/.artifact-pending.$2"; }

A="$WORK/a.png"; B="$WORK/b.md"; printf 'x' > "$A"; printf 'x' > "$B"

echo "=== block vs silent ==="

FH=$(newhome); seed "$FH" S1 "$A"; OUT=$(stop "$FH" S1 false)
printf '%s' "$OUT" | is_block && ok "1. one live pending entry -> blocks" \
                              || bad "1. one live pending entry -> blocks (out=$OUT)"

FH=$(newhome); seed "$FH" S2 "$A"; OUT=$(stop "$FH" S2 false)
{ [[ "$OUT" == *"$A"* ]] && [[ "$OUT" == *"BLOCKED"* ]]; } \
  && ok "2. block reason names the unshown path and says BLOCKED" \
  || bad "2. block reason names the unshown path and says BLOCKED"

FH=$(newhome); OUT=$(stop "$FH" S3 false)
is_empty "$OUT" && ok "3. no pending file at all -> silent {}" \
                || bad "3. no pending file at all -> silent {} (out=$OUT)"

FH=$(newhome); seed "$FH" S4; OUT=$(stop "$FH" S4 false)
is_empty "$OUT" && ok "4. empty pending file -> silent {}" \
                || bad "4. empty pending file -> silent {} (out=$OUT)"

echo
echo "=== fire once per burst ==="

FH=$(newhome); seed "$FH" S5 "$A"; OUT=$(stop "$FH" S5 true)
is_empty "$OUT" && ok "5. stop_hook_active true -> allowed even with a pending entry (no loop)" \
                || bad "5. stop_hook_active true -> allowed even with a pending entry"

echo
echo "=== re-arm after a clean stop ==="

# Clear the list (as artifact-open-clear would), confirm silent, then a NEW entry blocks
# again - the gate re-arms.
FH=$(newhome); seed "$FH" S6 "$A"; stop "$FH" S6 false >/dev/null
: > "$(pfile "$FH" S6)"; OUT1=$(stop "$FH" S6 false)
seed "$FH" S6 "$B"; OUT2=$(stop "$FH" S6 false)
{ is_empty "$OUT1" && printf '%s' "$OUT2" | is_block; } \
  && ok "6. cleared list -> silent; a fresh entry -> blocks again (re-arms)" \
  || bad "6. cleared list -> silent; a fresh entry -> blocks again"

echo
echo "=== self-heal past a deleted artifact ==="

FH=$(newhome); seed "$FH" S7 "$WORK/gone.png"; OUT=$(stop "$FH" S7 false)
{ is_empty "$OUT" && [ ! -f "$(pfile "$FH" S7)" ]; } \
  && ok "7. only pending path no longer exists -> silent and pending file removed" \
  || bad "7. only pending path no longer exists -> silent and pending file removed"

FH=$(newhome); seed "$FH" S8 "$WORK/gone.png" "$A"; OUT=$(stop "$FH" S8 false)
{ printf '%s' "$OUT" | is_block \
    && ! grep -qxF -- "$WORK/gone.png" "$(pfile "$FH" S8)" \
    && grep -qxF -- "$A" "$(pfile "$FH" S8)"; } \
  && ok "8. mix of dead + live -> blocks on the live one, dead one pruned" \
  || bad "8. mix of dead + live -> blocks on the live one, dead one pruned"

echo
echo "=== disable + fail-open ==="

FH=$(newhome); seed "$FH" S9 "$A"; disable "$FH"; OUT=$(stop "$FH" S9 false)
is_empty "$OUT" && ok "9. disable marker present -> never blocks" \
                || bad "9. disable marker present -> never blocks (out=$OUT)"

FH=$(newhome); OUT=$(printf 'not json' | HOME="$FH" bash "$HOOK"); RC=$?
{ is_empty "$OUT" && [ "$RC" = 0 ]; } \
  && ok "10. malformed stdin -> {}, exit 0 (fail-open)" \
  || bad "10. malformed stdin -> {}, exit 0 (rc=$RC out=$OUT)"

FH=$(newhome); seed "$FH" S11 "$A"
OUT=$(printf '{"session_id":"S11","tool_name":"Stop","transcript_path":"/no/such/file"}' | HOME="$FH" bash "$HOOK"); RC=$?
{ printf '%s' "$OUT" | is_block && [ "$RC" = 0 ]; } \
  && ok "11. missing transcript_path is irrelevant -> still blocks on live pending, exit 0" \
  || bad "11. missing transcript_path is irrelevant -> still blocks on live pending (rc=$RC)"

echo
echo "=== MUTANT (a gate that cannot go red is not a gate) ==="

# Byte-identical stdin: blocks with a live entry, passes without one.
FH=$(newhome); seed "$FH" M "$A"; B1=$(stop "$FH" M false)
: > "$(pfile "$FH" M)"; B2=$(stop "$FH" M false)
{ printf '%s' "$B1" | is_block && is_empty "$B2"; } \
  && ok "12. same stdin blocks with a live entry, passes with none" \
  || bad "12. same stdin blocks with a live entry, passes with none"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
