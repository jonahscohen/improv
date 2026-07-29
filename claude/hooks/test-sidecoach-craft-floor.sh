#!/bin/bash
# test-sidecoach-craft-floor.sh
#
# Regression coverage for the CRAFT FLOOR PreToolUse hook.
#
# The properties under test are the ones the floor exists for, so each failure here is a real loss:
#   1. It FIRES on a UI write with NO sidecoach verb anywhere in the payload. This is the whole point:
#      the per-verb brief depends on correct routing and the floor must not.
#   2. It says it is a FLOOR and not findings, and states that nothing was measured. A reader who
#      mistakes it for a defect report goes looking for defects that were never detected.
#   3. It cites sources, so the instruction is traceable rather than asserted.
#   4. It stays silent on a non-UI file, and inside the cooldown.
#   5. It NEVER blocks - no permissionDecision in the output. A floor that blocked an edit would
#      become something to route around.
#   6. It emits NOTHING on stderr. A hook that works while printing an error every invocation is how
#      the bash-3.2 ${VAR,,} bug hid: correct behaviour, dead optimisation, permanent hook error.
#   7. Its JSON is valid and carries the documented shape.
#
# Run: bash claude/hooks/test-sidecoach-craft-floor.sh

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HOOK_DIR/sidecoach-craft-floor.sh"
FAILS=0
TMP="$(mktemp -d)"
export SIDECOACH_FLOOR_STATE_DIR="$TMP/state"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; FAILS=$((FAILS + 1)); }
check() { if [[ -n "$2" ]]; then pass "$1"; else fail "$1"; fi }

if [[ ! -x "$HOOK" ]]; then
  fail "hook is executable at $HOOK"
  printf 'craft-floor hook: %d failure(s)\n' 1
  exit 1
fi

mkdir -p "$TMP/proj"
: > "$TMP/proj/package.json"

# ---- 1/2/3: fires on a UI write with no verb, self-identifies, cites -------------------------------
PAYLOAD="{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/proj/styles.css\",\"content\":\".a{color:red}\"}}"
OUT="$(printf '%s' "$PAYLOAD" | "$HOOK" 2>"$TMP/err1")"
ERR1="$(cat "$TMP/err1")"

if [[ -z "$OUT" ]]; then
  fail "fires on a UI write with no verb (got empty output)"
  printf 'stderr was: %s\n' "$ERR1"
else
  pass "fires on a UI write with no verb"
  CTX="$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])' 2>/dev/null || true)"
  check "output is valid JSON with additionalContext" "$CTX"
  case "$CTX" in *"CRAFT FLOOR"*) pass "labels itself a craft floor";; *) fail "labels itself a craft floor";; esac
  case "$CTX" in *"This is a FLOOR, not findings"*) pass "distinguishes floor from findings";; *) fail "distinguishes floor from findings";; esac
  case "$CTX" in *"not because any sidecoach verb ran"*) pass "states no verb was required";; *) fail "states no verb was required";; esac
  # The needle is the phrase the floor ACTUALLY emits. An earlier draft of this test looked for
  # "nothing was measured" while the floor says "not because anything was measured", and reported a
  # failure that was entirely the instrument's - the same shape of error as a prose detector built to
  # skip the lines carrying the prose. Read the raw output before believing a probe.
  case "$CTX" in *"not because anything was measured"*) pass "disclaims measurement";; *) fail "disclaims measurement";; esac
  case "$CTX" in *"Nothing here is a defect report"*) pass "says it is not a defect report";; *) fail "says it is not a defect report";; esac
  case "$CTX" in *"Source:"*) pass "cites at least one in-repo source";; *) fail "cites at least one in-repo source";; esac
  case "$CTX" in *"REFUSE THESE"*) pass "carries the refusal list";; *) fail "carries the refusal list";; esac
  case "$CTX" in *"INSTEAD:"*) pass "each refusal names a replacement";; *) fail "each refusal names a replacement";; esac
  # Real values, not instructions to add a value.
  case "$CTX" in *"4.5:1"*) pass "carries a real contrast value";; *) fail "carries a real contrast value";; esac
  case "$CTX" in *"44x44"*|*"44px"*) pass "carries a real hit-area value";; *) fail "carries a real hit-area value";; esac
  case "$CTX" in *"65ch"*) pass "carries a real measure value";; *) fail "carries a real measure value";; esac
  # 5: never blocks.
  case "$OUT" in *permissionDecision*) fail "does not block the edit";; *) pass "does not block the edit";; esac
fi

# ---- 6: silence on stderr -------------------------------------------------------------------------
if [[ -z "$ERR1" ]]; then
  pass "emits nothing on stderr"
else
  fail "emits nothing on stderr (got: $ERR1)"
fi

# ---- 4: cooldown suppresses the second write to the same project ----------------------------------
OUT2="$(printf '%s' "$PAYLOAD" | "$HOOK" 2>/dev/null)"
if [[ -z "$OUT2" ]]; then pass "cooldown suppresses a repeat write"; else fail "cooldown suppresses a repeat write"; fi

# A NEW SESSION always gets the floor on its first UI write, even inside the project cooldown.
# Cross-model review 2026-07-29 (Medium): keyed on the project alone, a fresh session starting within
# 900s of a previous session's write silently skipped the single most important injection there is.
OUT_S1="$(printf '%s' "{\"session_id\":\"sess-AAA\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/proj/styles.css\",\"content\":\"x\"}}" | "$HOOK" 2>/dev/null)"
if [[ -n "$OUT_S1" ]]; then pass "a new session gets the floor despite the project cooldown"; else fail "a new session gets the floor despite the project cooldown"; fi
OUT_S1B="$(printf '%s' "{\"session_id\":\"sess-AAA\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/proj/styles.css\",\"content\":\"x\"}}" | "$HOOK" 2>/dev/null)"
if [[ -z "$OUT_S1B" ]]; then pass "the same session is then suppressed by the cooldown"; else fail "the same session is then suppressed by the cooldown"; fi
OUT_S2="$(printf '%s' "{\"session_id\":\"sess-BBB\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/proj/styles.css\",\"content\":\"x\"}}" | "$HOOK" 2>/dev/null)"
if [[ -n "$OUT_S2" ]]; then pass "a second new session also gets its own floor"; else fail "a second new session also gets its own floor"; fi
# A session id containing path separators must not escape the state dir.
OUT_S3="$(printf '%s' "{\"session_id\":\"../../etc/evil\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/proj/styles.css\",\"content\":\"x\"}}" | "$HOOK" 2>/dev/null)"
if [[ -n "$OUT_S3" ]]; then pass "a traversal-shaped session id is handled"; else fail "a traversal-shaped session id is handled"; fi
if [[ ! -e /etc/evil ]]; then pass "a traversal-shaped session id wrote nothing outside the state dir"; else fail "a traversal-shaped session id wrote nothing outside the state dir"; fi

# An UNWRITABLE state dir must stay silent on stderr and still emit the floor (Low finding).
UNWRITABLE="$TMP/nowrite"
mkdir -p "$UNWRITABLE" && chmod 500 "$UNWRITABLE"
OUT_UW="$(SIDECOACH_FLOOR_STATE_DIR="$UNWRITABLE/sub" printf '%s' "{\"session_id\":\"sess-UW\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/proj/styles.css\",\"content\":\"x\"}}" | SIDECOACH_FLOOR_STATE_DIR="$UNWRITABLE/sub" "$HOOK" 2>"$TMP/err_uw")"
ERR_UW="$(cat "$TMP/err_uw")"
if [[ -n "$OUT_UW" ]]; then pass "an unwritable state dir still emits the floor"; else fail "an unwritable state dir still emits the floor"; fi
if [[ -z "$ERR_UW" ]]; then pass "an unwritable state dir leaks nothing to stderr"; else fail "an unwritable state dir leaks nothing to stderr (got: $ERR_UW)"; fi
chmod 700 "$UNWRITABLE"

# A path with SPACES must be handled.
mkdir -p "$TMP/my project"
: > "$TMP/my project/package.json"
OUT_SP="$(printf '%s' "{\"session_id\":\"sess-SP\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMP/my project/hero styles.css\",\"content\":\"x\"}}" | "$HOOK" 2>/dev/null)"
if [[ -n "$OUT_SP" ]]; then pass "a path containing spaces is handled"; else fail "a path containing spaces is handled"; fi

# A DIFFERENT project is not suppressed by the first project's cooldown.
mkdir -p "$TMP/other"
: > "$TMP/other/package.json"
OUT3="$(printf '%s' "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$TMP/other/Button.tsx\",\"old_string\":\"a\",\"new_string\":\"b\"}}" | "$HOOK" 2>/dev/null)"
if [[ -n "$OUT3" ]]; then pass "a separate project gets its own floor"; else fail "a separate project gets its own floor"; fi

# Cooldown of 0 always fires.
OUT4="$(SIDECOACH_FLOOR_COOLDOWN=0 printf '%s' "$PAYLOAD" | SIDECOACH_FLOOR_COOLDOWN=0 "$HOOK" 2>/dev/null)"
if [[ -n "$OUT4" ]]; then pass "a zero cooldown always fires"; else fail "a zero cooldown always fires"; fi

# ---- 4: non-UI paths stay silent -----------------------------------------------------------------
for path in "$TMP/proj/logic.ts" "$TMP/proj/README.md" "$TMP/proj/data.json" "$TMP/proj/script.py"; do
  OUT5="$(printf '%s' "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$path\",\"content\":\"x\"}}" | "$HOOK" 2>/dev/null)"
  if [[ -z "$OUT5" ]]; then pass "silent on $(basename "$path")"; else fail "silent on $(basename "$path")"; fi
done

# Generated output and test files are not authored UI.
for path in "$TMP/proj/node_modules/pkg/a.css" "$TMP/proj/dist/out.css" "$TMP/proj/Button.test.tsx"; do
  mkdir -p "$(dirname "$path")"
  OUT6="$(SIDECOACH_FLOOR_COOLDOWN=0 printf '%s' "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$path\",\"content\":\"x\"}}" | SIDECOACH_FLOOR_COOLDOWN=0 "$HOOK" 2>/dev/null)"
  if [[ -z "$OUT6" ]]; then pass "silent on $(basename "$path") (not authored UI)"; else fail "silent on $(basename "$path") (not authored UI)"; fi
done

# ---- malformed / empty input must not crash ------------------------------------------------------
for bad in '' 'not json at all' '{}' '{"tool_input":{}}' '{"tool_input":{"file_path":""}}'; do
  OUT7="$(printf '%s' "$bad" | "$HOOK" 2>/dev/null; echo "rc=$?")"
  case "$OUT7" in *"rc=0"*) pass "exits 0 on malformed input: ${bad:0:24}";; *) fail "exits 0 on malformed input: ${bad:0:24}";; esac
done

rm -rf "$TMP"
if (( FAILS > 0 )); then printf 'craft-floor hook: %d failure(s)\n' "$FAILS"; exit 1; fi
printf 'craft-floor hook: all checks passed\n'
