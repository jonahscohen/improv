#!/usr/bin/env bash
# Falsification suite for artifact-open-clear.sh (PostToolUse Read|Artifact).
#
# The core assertions: a Read of a pending path clears exactly that entry, an Artifact
# publish of a pending path clears it, a non-matching surface leaves the list intact,
# and one session's surface never discharges another session's obligation. The MUTANT
# case proves the clear can go both ways: the same Read that clears session A's entry
# does NOT clear session B's.
#
# Every case runs under a FAKE $HOME. The recorded paths are canonicalized exactly as
# artifact-open-mandate.sh records them (normpath of expanduser), which is what the
# clear hook matches against.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/artifact-open-clear.sh"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$REPO/.artifact-test-clear.$$"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }
disable() { : > "$1/.claude/.artifact-surface-disabled"; }
canon()   { python3 -c 'import os,sys; print(os.path.normpath(os.path.expanduser(sys.argv[1])))' "$1"; }

# seed <home> <session> <abs_path...> : write a pending list (canonicalized)
seed() { local h="$1" s="$2"; shift 2; : > "$h/.claude/.artifact-pending.$s"
         for p in "$@"; do canon "$p" >> "$h/.claude/.artifact-pending.$s"; done; }
# run_tool <home> <session> <tool> <file_path> -> stdout
run_tool() {
  printf '{"session_id":"%s","tool_name":"%s","tool_input":{"file_path":"%s"}}' "$2" "$3" "$4" \
    | HOME="$1" bash "$HOOK"
}
# run_read_err <home> <session> <file_path> -> stdout (a Read that ERRORED)
run_read_err() {
  python3 -c 'import json,sys; print(json.dumps({"session_id":sys.argv[1],"tool_name":"Read","tool_input":{"file_path":sys.argv[2]},"tool_response":{"error":"binary file cannot be read as text"}}))' "$2" "$3" \
    | HOME="$1" bash "$HOOK"
}
# run_bash <home> <session> <command> -> stdout (Bash PostToolUse)
run_bash() {
  python3 -c 'import json,sys; print(json.dumps({"session_id":sys.argv[1],"tool_name":"Bash","tool_input":{"command":sys.argv[2]}}))' "$2" "$3" \
    | HOME="$1" bash "$HOOK"
}
pfile() { echo "$1/.claude/.artifact-pending.$2"; }
has()   { grep -qxF -- "$(canon "$3")" "$(pfile "$1" "$2")" 2>/dev/null; }
exists(){ [ -f "$(pfile "$1" "$2")" ]; }

A="$WORK/a.png"; B="$WORK/b.md"; C="$WORK/c.html"
printf 'x' > "$A"; printf 'x' > "$B"; printf 'x' > "$C"

echo "=== clear on Read / Artifact ==="

FH=$(newhome); seed "$FH" S1 "$A"; run_tool "$FH" S1 Read "$A" >/dev/null
exists "$FH" S1 && bad "1. Read of the only pending path -> file should be removed" \
               || ok "1. Read of the only pending path -> entry cleared, file removed"

FH=$(newhome); seed "$FH" S2 "$A"; run_tool "$FH" S2 Artifact "$A" >/dev/null
exists "$FH" S2 && bad "2. Artifact publish of the only pending path -> should be removed" \
               || ok "2. Artifact publish of the only pending path -> entry cleared"

FH=$(newhome); seed "$FH" S3 "$A" "$B"; run_tool "$FH" S3 Read "$A" >/dev/null
{ ! has "$FH" S3 "$A" && has "$FH" S3 "$B"; } \
  && ok "3. Read of one of two -> that one cleared, the other intact" \
  || bad "3. Read of one of two -> that one cleared, the other intact"

echo
echo "=== non-matching surfaces leave the list intact ==="

FH=$(newhome); seed "$FH" S4 "$A"; run_tool "$FH" S4 Read "$C" >/dev/null
has "$FH" S4 "$A" && ok "4. Read of an unrelated path -> pending entry untouched" \
                  || bad "4. Read of an unrelated path -> pending entry untouched"

FH=$(newhome); run_tool "$FH" S5 Read "$A" >/dev/null; RC=$?
{ ! exists "$FH" S5 && [ "$RC" = 0 ]; } \
  && ok "5. Read with no pending file at all -> no-op, exit 0" \
  || bad "5. Read with no pending file at all -> no-op, exit 0"

echo
echo "=== per-session isolation ==="

FH=$(newhome); seed "$FH" SA "$A"; seed "$FH" SB "$A"; run_tool "$FH" SA Read "$A" >/dev/null
{ ! exists "$FH" SA && has "$FH" SB "$A"; } \
  && ok "6. session A's Read clears A only; B's identical entry survives" \
  || bad "6. session A's Read clears A only; B's identical entry survives"

echo
echo "=== successful-surface requirement + native open (High 2 fix) ==="

# A Read that ERRORED (a .docx that cannot be read as text) surfaced no content, so it
# MUST NOT discharge the obligation.
D="$WORK/report.docx"; printf 'x' > "$D"
FH=$(newhome); seed "$FH" E1 "$D"; run_read_err "$FH" E1 "$D" >/dev/null
has "$FH" E1 "$D" && ok "10. a FAILED Read does NOT discharge (no content surfaced)" \
                  || bad "10. a FAILED Read wrongly discharged the entry"

# Opening the document in its native app IS how a human is shown a .docx -> discharge.
FH=$(newhome); seed "$FH" E2 "$D"; run_bash "$FH" E2 "open $D" >/dev/null
exists "$FH" E2 && bad "11. 'open <docx>' did not discharge (native-app show)" \
               || ok "11. 'open <docx>' discharges the entry (native-app show)"

# A non-open Bash command naming the path does NOT discharge (only open/xdg-open/start).
FH=$(newhome); seed "$FH" E3 "$D"; run_bash "$FH" E3 "cat $D" >/dev/null
has "$FH" E3 "$D" && ok "12. 'cat <docx>' does NOT discharge (only open/xdg-open/start do)" \
                  || bad "12. 'cat <docx>' wrongly discharged the entry"

# The opener must START a command segment: `echo open <path>` merely prints the word
# "open" and must NOT discharge (anchored-open fix, Codex v2 High).
FH=$(newhome); seed "$FH" E4 "$D"; run_bash "$FH" E4 "echo open $D" >/dev/null
has "$FH" E4 "$D" && ok "13. 'echo open <docx>' does NOT discharge (open must start a segment)" \
                  || bad "13. 'echo open <docx>' wrongly discharged"

# A CHAINED open (`foo && open <path>`) does NOT discharge: the command must be, in
# its entirety, a bare open invocation. This is the safe direction - erring toward
# leaving the artifact flagged, never a false discharge. (Run `open <path>` on its own.)
FH=$(newhome); seed "$FH" E5 "$D"; run_bash "$FH" E5 "cd /tmp && open $D" >/dev/null
has "$FH" E5 "$D" && ok "14. 'cd /tmp && open <docx>' does NOT discharge (must be a bare open)" \
                  || bad "14. chained '&& open' wrongly discharged (should require a bare open)"

# A SUCCESSFUL Read whose CONTENT merely mentions an error phrase still discharges
# (resp_errored keys on error FRAMING, not content - Codex v2 Low).
NOTE="$WORK/notes.txt"; printf 'x' > "$NOTE"
FH=$(newhome); seed "$FH" E6 "$NOTE"
printf '{"session_id":"E6","tool_name":"Read","tool_input":{"file_path":"%s"},"tool_response":"The note says the remote file does not exist."}' "$NOTE" | HOME="$FH" bash "$HOOK" >/dev/null
exists "$FH" E6 && bad "15. successful Read with 'does not exist' in CONTENT did not discharge" \
               || ok "15. successful Read discharges despite an error phrase in content"

# A genuinely errored Read (error framing) still does NOT discharge.
FH=$(newhome); seed "$FH" E7 "$NOTE"
printf '{"session_id":"E7","tool_name":"Read","tool_input":{"file_path":"%s"},"tool_response":"Error: cannot be read as text"}' "$NOTE" | HOME="$FH" bash "$HOOK" >/dev/null
has "$FH" E7 "$NOTE" && ok "16. errored Read ('Error: ...') does NOT discharge" \
                     || bad "16. errored Read wrongly discharged"

# shlex quote-awareness (Codex v3 High): the opener inside a QUOTED string is not a
# real command word, so `echo '; open <path>'` must NOT discharge.
FH=$(newhome); seed "$FH" E8 "$D"; run_bash "$FH" E8 "echo '; open $D'" >/dev/null
has "$FH" E8 "$D" && ok "17. quoted '; open <path>' in echo does NOT discharge (shlex)" \
                  || bad "17. quoted '; open <path>' wrongly discharged"

# A token that merely CONTAINS 'open' (openssl) is not the opener.
FH=$(newhome); seed "$FH" E9 "$D"; run_bash "$FH" E9 "openssl req -out $D" >/dev/null
has "$FH" E9 "$D" && ok "18. 'openssl' is not an opener -> does NOT discharge" \
                  || bad "18. 'openssl' wrongly treated as opener"

# A successful Read whose CONTENT contains the exact phrase 'cannot be read as text'
# still discharges (resp_errored no longer content-matches).
FH=$(newhome); seed "$FH" EA "$NOTE"
printf '{"session_id":"EA","tool_name":"Read","tool_input":{"file_path":"%s"},"tool_response":"This note says: cannot be read as text."}' "$NOTE" | HOME="$FH" bash "$HOOK" >/dev/null
exists "$FH" EA && bad "19. content phrase 'cannot be read as text' blocked discharge" \
               || ok "19. successful Read discharges despite the exact phrase in content"

# A quoted SEPARATOR as its own argument (echo ";" open X) must NOT discharge: bash runs
# only echo, printing the words - it never opens the file. The whole-command match
# rejects it because the command does not START with a bare opener (Codex v4 High).
FH=$(newhome); seed "$FH" EB "$D"; run_bash "$FH" EB "echo \";\" open $D" >/dev/null
has "$FH" EB "$D" && ok "20. 'echo \";\" open <path>' does NOT discharge (whole-command match)" \
                  || bad "20. quoted-separator 'echo \";\" open' wrongly discharged"

# Trailing commands after a real open still do not discharge (must be a lone open).
FH=$(newhome); seed "$FH" EC "$D"; run_bash "$FH" EC "open $D; rm $D" >/dev/null
has "$FH" EC "$D" && ok "21. 'open <path>; rm ...' does NOT discharge (must be a lone open)" \
                  || bad "21. 'open <path>; rm' wrongly discharged"

# Metacharacter smuggled into a flag token (`open -R;true X`) must NOT discharge: bash
# runs `open -R` then `true X`, never opening X. SAFE forbids ";" inside a flag/path
# token, so the whole-command match fails (Codex v5 High).
FH=$(newhome); seed "$FH" ED "$D"; run_bash "$FH" ED "open -R;true $D" >/dev/null
has "$FH" ED "$D" && ok "22. 'open -R;true <path>' does NOT discharge (no metachars in tokens)" \
                  || bad "22. metachar-in-flag 'open -R;true' wrongly discharged"

# Command substitution in the path is not a concrete pending path, so it cannot match.
FH=$(newhome); seed "$FH" EE "$D"; run_bash "$FH" EE "open \$(echo $D)" >/dev/null
has "$FH" EE "$D" && ok "23. 'open \$(...)' does NOT discharge (substitution is not a real pending path)" \
                  || bad "23. command-substitution path wrongly discharged"

echo
echo "=== disable + fail-open ==="

FH=$(newhome); seed "$FH" S7 "$A"; disable "$FH"; OUT=$(run_tool "$FH" S7 Read "$A")
{ [ "$OUT" = "{}" ] && has "$FH" S7 "$A"; } \
  && ok "7. disable marker present -> clear is inert (stop is inert too, so no wedge)" \
  || bad "7. disable marker present -> clear is inert"

FH=$(newhome); seed "$FH" S8 "$A"; OUT=$(printf 'not json' | HOME="$FH" bash "$HOOK"); RC=$?
{ [ "$OUT" = "{}" ] && [ "$RC" = 0 ] && has "$FH" S8 "$A"; } \
  && ok "8. malformed stdin -> {}, exit 0, list untouched (fail-open)" \
  || bad "8. malformed stdin -> {}, exit 0, list untouched (rc=$RC)"

echo
echo "=== MUTANT (a clear that cannot go both ways is not a clear) ==="

# Same Read, two sessions: it MUST clear the matching session and MUST NOT clear the
# other. Proves case 1 (clears) and case 6 (isolation) are both real behaviors.
FH=$(newhome); seed "$FH" M1 "$A"; seed "$FH" M2 "$B"
run_tool "$FH" M1 Read "$A" >/dev/null
{ ! exists "$FH" M1 && has "$FH" M2 "$B"; } \
  && ok "9. Read clears its own session's entry, never the other session's" \
  || bad "9. Read clears its own session's entry, never the other session's"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
