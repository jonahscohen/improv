#!/bin/bash
# Regression tests for codex-failure-watcher.sh (PostToolUse, Bash).
#   bash ~/.claude/hooks/test-codex-failure-watcher.sh
#
# The hook must nudge ONLY when codex was genuinely INVOKED and its output shows
# a capacity/error failure. It has over-fired twice on commands that merely READ
# codex-related text:
#   2026-06-25 - a monitoring grep of codex logs (fixed by requiring codex at a
#                command position).
#   2026-07-28 - `grep -n "codex-rescue-guard\|codex-failure-watcher" ...`, where
#                the BRE alternation inside a QUOTED argument was read as a shell
#                pipe. The old "3 fires, 1 false over 4000 Bash calls" figure is
#                struck - the corpus and the false/true labels were never
#                committed, and "false" is a judgment no comment can settle.
#                Re-derivable instead:
#                  python3 claude/hooks/_tests/measure-hook-corpus.py --watcher
#                which pairs every real Bash command with a synthetic capacity
#                failure, so only the INVOCATION detector is under test, and
#                prints the detections for a human to judge.
# A hook that cries wolf on ordinary greps gets filtered out by the reader, which
# is functionally identical to being dead - hence these tests.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

# python3 is this suite's only measuring instrument: every payload, every fixture and
# every assertion below is built with it. Without it the suite would not fail loudly -
# it would skip silently and still print a green summary, which is worse than no suite.
command -v python3 >/dev/null 2>&1 || {
  echo "FATAL: python3 not found - this suite cannot verify anything without it." >&2
  exit 2
}
WATCHER="$HOOK_DIR/codex-failure-watcher.sh"
PASS=0; FAIL=0; FAILS=()
ok() { echo "PASS: $1"; PASS=$((PASS+1)); }
no() { echo "FAIL: $1"; FAILS+=("$1"); FAIL=$((FAIL+1)); }

# fire <command> <output>  -> echoes "fires" or "silent"
fire() {
  python3 -c '
import json,sys
print(json.dumps({"session_id":"t","hook_event_name":"PostToolUse","tool_name":"Bash",
                  "tool_input":{"command":sys.argv[1]},"tool_response":{"stdout":sys.argv[2]}}))' "$1" "$2" \
    | bash "$WATCHER" 2>/dev/null | grep -q "CODEX FAILURE DETECTED" && echo fires || echo silent
}

expect() { # expect <want> <desc> <command> <output>
  local want="$1" desc="$2" got
  got=$(fire "$3" "$4")
  [ "$got" = "$want" ] && ok "$desc" || no "$desc (wanted $want, got $got)"
}

# ---- MUST FIRE: codex really invoked AND really failed ----
expect fires "bare codex invocation + capacity failure" \
  'codex exec < /tmp/p.txt' 'Selected model is at capacity'
expect fires "codex after && + stream error" \
  'cd /tmp && codex exec review.txt' 'stream error: request failed'
expect fires "codex after a REAL pipe + capacity" \
  'cat p.txt | codex exec' 'ERROR: model is at capacity'
expect fires "codex behind env vars and timeout" \
  'FOO=1 timeout 300 codex exec p.txt' 'Selected model is at capacity'
expect fires "codex invocation + uppercase ERROR line" \
  'codex exec p.txt' 'ERROR: stream disconnected'
# Codex review 2026-07-28 caught this as a FALSE NEGATIVE in the first attempted
# fix (a naive quoted-span blanker ate the quoted env value, so the env prefix no
# longer matched). A missed capacity failure silently skips the cross-model gate,
# which is the dangerous direction - this row exists to keep that fix out.
expect fires "codex behind a QUOTED env assignment" \
  'OPENAI_API_KEY="$OPENAI_API_KEY" codex exec p.txt' 'Selected model is at capacity'
expect fires "codex as the final token of the command" \
  'cat p.txt | codex' 'model is at capacity'

# ---- MUST STAY SILENT: codex never invoked (the over-fire classes) ----
# 2026-07-28, verbatim from real traffic: a BRE alternation inside a quoted arg.
expect silent "quoted BRE alternation is not a pipe into codex" \
  'grep -n "codex-rescue-guard\|codex-failure-watcher" claude/settings.json' 'ERROR: something'
expect silent "quoted ERE alternation is not a pipe into codex" \
  'grep -E "beats|codex" MEMORY.md' 'codex was at capacity that day'
# 2026-06-25 class: monitoring/log inspection that merely mentions codex.
expect silent "grepping codex logs does not fire" \
  'grep -r "at capacity" ~/.claude/logs/codex.log' 'session: model is at capacity'
expect silent "codex named only inside a quoted string" \
  'echo "run codex exec later"' 'at capacity'
expect silent "codex as a bare argument to another command" \
  'ls -la claude/hooks/codex-failure-watcher.sh' 'ERROR: no such file'
# A hyphenated sibling is a DIFFERENT command; `codex\b` used to accept it.
expect silent "a hyphenated codex-* name is not the codex CLI" \
  'ls claude/hooks/codex-review.py; echo done' 'ERROR: nope'

# ---- MUST STAY SILENT: codex invoked but succeeded ----
expect silent "real codex invocation with benign output" \
  'codex exec < /tmp/p.txt' 'Findings: looks good, no defects.'
expect silent "prose mentioning error in a successful review" \
  'codex exec < /tmp/p.txt' 'The code handles the error path correctly.'

# ---- Fail-open contract: never break Bash ----
got=$(printf 'not json at all' | bash "$WATCHER" 2>/dev/null; echo "rc=$?")
echo "$got" | grep -q 'rc=0' && ok "malformed stdin fails open (rc=0)" || no "malformed stdin fails open"
got=$(fire 'codex exec p.txt' '')
[ "$got" = "silent" ] && ok "empty output does not fire" || no "empty output does not fire"

# ---- INVOCATION-SHAPE PROBE (both directions) ----
# 2026-07-28: the raw-text separator regex was silent on 9 of 18 genuine
# invocation forms and fired on a heredoc BODY. The probe owns that table so the
# forms live in one place; it takes the watcher path so it can be pointed at a
# mutant to prove the assertions bite.
if [ -x "$HOOK_DIR/_tests/probe-codex-invoke.sh" ] || [ -f "$HOOK_DIR/_tests/probe-codex-invoke.sh" ]; then
  probe_out=$(/bin/bash "$HOOK_DIR/_tests/probe-codex-invoke.sh" "$WATCHER" 2>&1); probe_rc=$?
  if [ "$probe_rc" -eq 0 ]; then
    ok "invocation-shape probe: every form classified correctly ($(printf '%s' "$probe_out" | grep -c '^ok') cases)"
  else
    no "invocation-shape probe failed:"
    printf '%s\n' "$probe_out" | grep -E '^(FAIL|HARNESS)' | sed 's/^/    /'
  fi
else
  no "invocation-shape probe is MISSING at _tests/probe-codex-invoke.sh"
fi

# ---- Interpreter/temp-file failures must be LOUD, never a silent clean bill ----
# An inert watcher is indistinguishable from "codex succeeded", which is exactly
# the silent gate-skip this hook exists to prevent.
NOPY="$(mktemp -d "${TMPDIR:-/tmp}/nopy.XXXXXX")" || { echo "FATAL: mktemp -d failed"; exit 2; }
trap 'rm -rf "$NOPY"' EXIT
for b in cat mktemp rm; do
  src="$(command -v "$b")" && ln -sf "$src" "$NOPY/$b"
done
payload_codex=$(python3 -c '
import json
print(json.dumps({"tool_name":"Bash","tool_input":{"command":"codex exec p.txt"},
                  "tool_response":{"stdout":"ERROR: at capacity"}}))')
payload_other=$(python3 -c '
import json
print(json.dumps({"tool_name":"Bash","tool_input":{"command":"ls -la"},
                  "tool_response":{"stdout":"fine"}}))')

got=$(printf '%s' "$payload_codex" | env PATH="$NOPY" /bin/bash "$WATCHER" 2>/dev/null)
echo "$got" | grep -q "CODEX WATCHER INERT" \
  && ok "no python3 on a codex call warns instead of passing silently" \
  || no "no python3 on a codex call warns (got: ${got:0:60})"

got=$(printf '%s' "$payload_other" | env PATH="$NOPY" /bin/bash "$WATCHER" 2>/dev/null)
[ "$(echo "$got" | tr -d '[:space:]')" = "{}" ] \
  && ok "no python3 on an unrelated Bash call stays quiet" \
  || no "no python3 on an unrelated Bash call stays quiet (got: ${got:0:60})"

got=$(printf '%s' "$payload_codex" | env TMPDIR=/nonexistent-codex-watcher-dir /bin/bash "$WATCHER" 2>/dev/null)
echo "$got" | grep -q "CODEX WATCHER INERT" \
  && ok "unusable temp dir warns instead of inspecting an empty payload" \
  || no "unusable temp dir warns (got: ${got:0:60})"

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then printf '  - %s\n' "${FAILS[@]}"; exit 1; fi
echo "All codex-failure-watcher tests pass."
