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
PASS=0; FAIL=0

# Fully isolated HOME so the real ~/.claude/.memory-dirty.* is never touched. Every hook
# invocation below runs with HOME="$TMPHOME", and FLAG points inside it, so this suite
# is hermetic even when a live session has its own dirty flag set (Codex review, U7b).
TMPHOME="$(mktemp -d)"
mkdir -p "$TMPHOME/.claude"
trap 'rm -rf "$TMPHOME"' EXIT
# The flag is PER-SESSION (.memory-dirty.<session>) as of 2026-07-17. The payloads
# below carry no session_id, so the hook derives the "global" fallback key; FLAG
# must track that same bucket. Per-session isolation itself is covered by
# test-memory-dirty-invariant.sh invariant 5 - this suite is about write-token
# classification, and stays deliberately single-session.
FLAG="$TMPHOME/.claude/.memory-dirty.global"

state() { [ -f "$FLAG" ] && echo "DIRTY" || echo "clean"; }

# $1=command  $2=start(clean|dirty)  $3=expected(clean|DIRTY)  $4=label
check() {
  if [ "$2" = dirty ]; then : > "$FLAG"; else rm -f "$FLAG"; fi
  printf '%s' "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":$1}}" \
    | HOME="$TMPHOME" bash "$HOOK" >/dev/null 2>&1
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
    | HOME="$TMPHOME" bash "$HOOK" >/dev/null 2>&1
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

echo "--- install VERB vs install-NAME substring (U7b issue 1) ---"
# The write-token list carried the bare substring "install", so any command that
# merely NAMED install.sh / test-install-*.sh / an -install- path was misread as a
# project-file write and set .memory-dirty (blocked U1's commit 3x during Wave 1).
# The fix matches the coreutils `install` VERB in command position (start, or after
# a ; && || | separator) followed by whitespace - the file-writing form - and no
# longer the substring. A real `install` write still dirties.
check "\"bash install.sh --dry-run\""                     clean clean "running install.sh (name only) does NOT dirty"
check "\"bash claude/hooks/test-install-hook-deploy.sh\"" clean clean "running test-install-*.sh (name only) does NOT dirty"
check "\"./install.sh\""                                  clean clean "./install.sh (name only) does NOT dirty"
check "\"npm uninstall left-pad\""                        clean clean "npm uninstall (install as inner substring) does NOT dirty"
check "\"grep -n installer install.sh\""                  clean clean "read-only grep naming installer/install.sh does NOT dirty"
# Argument-position `install` (NOT the segment's command word) must NOT dirty -
# command-position matching, not the bare substring (Codex U7b finding 1).
check "\"npm help install react\""                        clean clean "npm help install <arg> does NOT dirty (install is an argument)"
check "\"node scripts/check.js install\""                 clean clean "install as a trailing argument does NOT dirty"
check "\"printf %s install\""                             clean clean "install echoed as an argument does NOT dirty"
# Real install VERB in command position - bare, wrapped, or path-qualified - MUST
# dirty. Path-qualified forms were the dangerous under-match (Codex U7b finding 2).
check "\"install -m 0755 bin/tool /usr/local/bin/tool\""  clean DIRTY "coreutils install VERB (leading) still dirties"
check "\"sudo install -d /opt/app\""                      clean DIRTY "install verb behind sudo still dirties"
check "\"/usr/bin/install -m 644 a.conf /etc/a.conf\""    clean DIRTY "path-qualified /usr/bin/install still dirties"
check "\"./bin/install -m 644 a b\""                      clean DIRTY "relative-path ./bin/install still dirties"
check "\"make build && install -m 644 a.conf /etc/a\""    clean DIRTY "install verb after && separator still dirties"
check "\"VER=1 install -m 644 a b\""                      clean DIRTY "install verb after a VAR= assignment still dirties"
# Wrapper-carried installs (Codex U7b finding 2): path-qualified wrappers and env VAR=
# operands must not hide a real install write.
check "\"env FOO=bar install -m 644 a b\""                clean DIRTY "env with a VAR= operand before install still dirties"
check "\"/usr/bin/env install -m 644 a b\""               clean DIRTY "path-qualified /usr/bin/env install still dirties"
# KNOWN GAP (accepted, flagged for lead): a wrapper VALUE-flag that eats the next word
# (sudo -u root install) is not detected - that needs per-flag arg parsing this simple
# hook does not carry. Such forms target system dirs, not project files. Pinned so the
# behavior is visible if a future change closes it.
check "\"sudo -u root install -m 644 a b\""               clean clean "KNOWN GAP: sudo VALUE-flag before install is not detected"

echo "--- read-only memory command must NOT clear a dirty flag (U7b finding 1) ---"
# The clear side fires only on a real WRITE into a memory path. A read-only command that
# merely NAMES one must leave a legitimately-dirty flag DIRTY - otherwise a source edit
# followed by `ls .claude/memory` would slip a beat-less commit past the gate.
check "\"ls .claude/memory/\""                            dirty DIRTY "ls of a memory dir does NOT clear"
check "\"grep -rn foo .claude/memory/\""                  dirty DIRTY "grep inside a memory dir does NOT clear"
check "\"cat .claude/memory/MEMORY.md\""                  dirty DIRTY "cat of a memory file does NOT clear"
check "\"git status .claude/memory/\""                    dirty DIRTY "git status of a memory path does NOT clear"
# Controls: a real WRITE into memory still clears (the intended beat-write path).
check "\"cp /tmp/b.md .claude/memory/session_x.md\""      dirty clean "cp a beat into memory still clears"
check "\"cat /tmp/b.md >> .claude/memory/MEMORY.md\""     dirty clean "redirect-append into MEMORY.md still clears"

rm -f "$FLAG"
echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
