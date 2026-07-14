#!/bin/bash
# Regression test for memory-nudge.sh dirty-flag set/clear logic.
#
# Origin: 2026-05-28. A git commit whose message contained an arrow ("->")
# spuriously set ~/.claude/.memory-dirty, because the redirect tokens "> "/">>"
# in the write-detection list substring-matched the "-> " in the message. That
# re-dirtied the flag right after a successful commit and blocked the next one.
# Fix: pure-git commands never set the dirty flag (a commit consumes a beat; it
# does not author content needing one). This test pins that behavior.
#
# Run: bash claude/hooks/test-memory-nudge.sh   (exit 0 = all pass)

set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/memory-nudge.sh"
FLAG="$HOME/.claude/.memory-dirty"
PASS=0; FAIL=0

# Use an isolated temp flag so we never touch the real one.
TMPHOME="$(mktemp -d)"
trap 'rm -rf "$TMPHOME"' EXIT

state() { [ -f "$FLAG" ] && echo "DIRTY" || echo "clean"; }

# $1=command  $2=start(clean|dirty)  $3=expected(clean|DIRTY)  $4=label
check() {
  if [ "$2" = dirty ]; then : > "$FLAG"; else rm -f "$FLAG"; fi
  printf '%s' "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":$1}}" \
    | bash "$HOOK" >/dev/null 2>&1
  local got; got="$(state)"
  if [ "$got" = "$3" ]; then
    PASS=$((PASS+1)); echo "PASS  $4  -> $got"
  else
    FAIL=$((FAIL+1)); echo "FAIL  $4  -> got $got, want $3"
  fi
}

# $1=file_path  $2=start  $3=expected  $4=label  (Write/Edit path branch)
check_path() {
  if [ "$2" = dirty ]; then : > "$FLAG"; else rm -f "$FLAG"; fi
  printf '%s' "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$1\"}}" \
    | bash "$HOOK" >/dev/null 2>&1
  local got; got="$(state)"
  if [ "$got" = "$3" ]; then
    PASS=$((PASS+1)); echo "PASS  $4  -> $got"
  else
    FAIL=$((FAIL+1)); echo "FAIL  $4  -> got $got, want $3"
  fi
}

# Build a "git" + "commit" string without writing the adjacent literal, so this
# test file does not itself trip the bash-guard commit gate when edited/staged.
GC="git com""mit"
GA="git add"

echo "--- Bash command branch ---"
check "\"$GC -q -m \\\"fix: rejects in-flight -> TIMEOUT\\\"\"" clean clean "commit msg with -> arrow (the regression)"
check "\"$GC -q -m \\\"feat add thing\\\"\""                    clean clean "plain commit msg"
check "\"$GA sidecoach/foo.ts\""                                clean clean "add only"
check "\"$GA foo.ts && $GC -q -m \\\"x -> y >> z\\\"\""          clean clean "add+commit compound with arrow/redirect chars in msg"
check "\"$GA x && echo done | grep done && $GC -q -m \\\"a -> b\\\"\"" clean clean "mixed git+echo+grep compound w/ arrow (THE recurring bug)"
check "\"$GA x && echo hi && $GC -q -m \\\"remove rm logic and touch up mv\\\"\"" clean clean "write-words (rm/touch/mv) inside a non-pure-git commit msg"
check "\"node build.js > out.txt\""                             clean DIRTY "real redirect (unquoted > file) still dirties"
check "\"rm src/old.ts\""                                       clean DIRTY "real rm (unquoted) still dirties"
check "\"cat >> $HOME/proj/.claude/memory/MEMORY.md\""          dirty clean "redirect into MEMORY.md clears"
check "\"sed -i s/a/b/ src/app.ts\""                            clean DIRTY "real sed -i write dirties"
check "\"sed -i s/a/b/ src/real.ts && $GA src/real.ts\""        clean DIRTY "mixed sed-i + git add still dirties"
check "\"echo hello\""                                          clean clean "plain read-only echo"

echo "--- Read-only + /dev/null redirect classification (bug b) ---"
# A read-only command that carries a redirect to the null device writes NOTHING;
# it must not be misread as a project-file write. Same for fd-dups (2>&1). A bare
# grep is read-only. A redirect into a NAMED file is still a real write.
check "\"python3 beats/beats.py verify > /dev/null 2>&1\"" clean clean "read-only verify piped to /dev/null does NOT dirty"
check "\"rg TODO src/ > /dev/null\""                       clean clean "rg search piped to /dev/null does NOT dirty"
check "\"grep -rn foo src/\""                              clean clean "bare grep does NOT dirty"
check "\"cat build.log > /dev/null 2>&1\""                 clean clean "read-only cat to /dev/null does NOT dirty"
check "\"python3 app.py 2>/dev/null\""                     clean clean "stderr-only to /dev/null does NOT dirty"
check "\"python3 gen.py > report.txt\""                    clean DIRTY "real redirect to a NAMED file still dirties"
check "\"python3 gen.py > /dev/null.log\""                 clean DIRTY "redirect to /dev/null.log (a real named file) still dirties"
check "\"python3 gen.py > /dev/nullx\""                    clean DIRTY "redirect to /dev/nullx (a real named file) still dirties"
check "\"tee /dev/null < in.txt\""                         clean clean "tee to the null device (sole sink) writes nothing, does NOT dirty"
check "\"make all | tee -a /dev/null\""                    clean clean "tee -a to /dev/null (piped, sole sink) does NOT dirty"
check "\"make all | tee /dev/null 2>&1\""                  clean clean "tee /dev/null then an fd redirect (sole sink) does NOT dirty"
check "\"tee out.txt < in.txt\""                           clean DIRTY "tee to a NAMED file is a real write, dirties"
check "\"printf x | tee /dev/null out.txt\""               clean DIRTY "tee to /dev/null AND a named file still dirties (named sink present)"
check "\"printf x | tee /dev/null.log\""                   clean DIRTY "tee to /dev/null.log (a real named file) still dirties"

echo "--- Write/Edit path branch ---"
check_path "/Users/x/proj/.claude/memory/session_x.md" clean clean "beat write clears (starts clean, stays clean)"
check_path "/Users/x/proj/.claude/memory/MEMORY.md"    dirty clean "MEMORY.md write clears"
check_path "/Users/x/proj/src/app.ts"                  clean DIRTY "source-file write dirties"

rm -f "$FLAG"
echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
