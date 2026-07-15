#!/bin/bash
# Four-part memory-dirty INVARIANT test (U7b).
#
# The Wave-1 harness false-positives (memory-nudge `install`-substring, cp-into-memory
# not clearing, verify-before-done repo-source) were closed by REMOVING false positives
# only. This test pins that the gate's real PURPOSE stayed intact: it must NOT become
# possible to commit real project changes without a beat. It drives the two hooks that
# together own the .memory-dirty lifecycle:
#   - memory-nudge.sh (PostToolUse) SETS the flag on a real write, CLEARS it on a beat write
#   - bash-guard.sh   (PreToolUse)  BLOCKS `git commit` while the flag is set
#
# Asserts all FOUR invariant behaviors plus the end-to-end cp-a-beat-then-commit path:
#   1. a REAL project write still dirties memory
#   2. a recognized Bash write INTO .claude/memory/ clears the flag
#   3. a read-only / diagnostic command NEVER re-dirties after a beat write
#   4. a real `git commit` while genuinely dirty STILL blocks
#
# Run: bash claude/hooks/test-memory-dirty-invariant.sh   (exit 0 = all pass)

set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
NUDGE="$HOOK_DIR/memory-nudge.sh"
GUARD="$HOOK_DIR/bash-guard.sh"
PASS=0; FAIL=0; FAIL_LABELS=()

# Fully isolated HOME so the real ~/.claude/.memory-dirty is never touched.
IHOME="$(mktemp -d)"
mkdir -p "$IHOME/.claude"
trap 'rm -rf "$IHOME"' EXIT
DIRTY="$IHOME/.claude/.memory-dirty"

# Assemble "git commit" so this test file does not itself read as a commit invocation
# when it is staged/committed.
CMT="git ""commit"

set_dirty()   { : > "$DIRTY"; }
clear_dirty() { rm -f "$DIRTY"; }
flag_state()  { [ -f "$DIRTY" ] && echo DIRTY || echo clean; }

# Feed memory-nudge a Bash command (PostToolUse), isolated HOME.
nudge_bash() {
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$1" \
    | HOME="$IHOME" bash "$NUDGE" >/dev/null 2>&1
}
# Feed memory-nudge a Write file_path (PostToolUse), isolated HOME.
nudge_write() {
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1]}}))' "$1" \
    | HOME="$IHOME" bash "$NUDGE" >/dev/null 2>&1
}
# Feed bash-guard a Bash command (PreToolUse), isolated HOME; echo its decision JSON.
guard() {
  python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]},"session_id":"u7b-invariant"}))' "$1" \
    | HOME="$IHOME" bash "$GUARD" 2>/dev/null
}

ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); FAIL_LABELS+=("$1"); echo "FAIL: $1  ($2)"; }

# $1=label  $2=expected(DIRTY|clean)
expect_flag() {
  local got; got="$(flag_state)"
  if [ "$got" = "$2" ]; then ok "$1"; else bad "$1" "got $got, want $2"; fi
}
# A real commit while dirty must be denied for the beats-dirty reason.
expect_commit_blocked() {
  if guard "$2" | grep -q 'beats are dirty'; then ok "$1"; else bad "$1" "commit was NOT blocked"; fi
}
expect_commit_allowed() {
  if guard "$2" | grep -q 'beats are dirty'; then bad "$1" "commit was blocked"; else ok "$1"; fi
}

echo "===== Invariant 1: a REAL project write dirties memory ====="
clear_dirty; nudge_bash "sed -i 's/a/b/' src/app.ts";              expect_flag "sed -i on a source file dirties" DIRTY
clear_dirty; nudge_bash "cp new.ts src/app.ts";                    expect_flag "cp onto a source file dirties" DIRTY
clear_dirty; nudge_bash "printf x > src/app.ts";                   expect_flag "redirect into a source file dirties" DIRTY
clear_dirty; nudge_write "/proj/src/app.ts";                       expect_flag "Write-tool edit of a source file dirties" DIRTY
clear_dirty; nudge_bash "install -m 0755 bin/x /usr/local/bin/x";  expect_flag "install VERB (real file write) dirties" DIRTY

echo ""
echo "===== Invariant 2: a recognized Bash write INTO .claude/memory/ clears the flag ====="
set_dirty; nudge_bash "cp /tmp/harvested.md .claude/memory/session_x.md"; expect_flag "cp a beat into .claude/memory/ clears" clean
set_dirty; nudge_bash "cat /tmp/beat.md >> .claude/memory/MEMORY.md";     expect_flag "redirect-append into MEMORY.md clears" clean
set_dirty; nudge_write "/proj/.claude/memory/session_x.md";               expect_flag "Write-tool beat into .claude/memory/ clears" clean
# The clear is scoped to a real WRITE into memory - a READ-ONLY command that merely NAMES
# a memory path must NOT clear a legitimately-dirty flag, or a source edit followed by
# `ls .claude/memory` would let a beat-less commit through (Codex U7b review, High).
set_dirty; nudge_bash "ls .claude/memory/";                expect_flag "ls of a memory dir does NOT clear a dirty flag" DIRTY
set_dirty; nudge_bash "grep -rn foo .claude/memory/";      expect_flag "grep inside a memory dir does NOT clear a dirty flag" DIRTY
set_dirty; nudge_bash "cat .claude/memory/MEMORY.md";      expect_flag "cat of a memory file does NOT clear a dirty flag" DIRTY

echo ""
echo "===== Invariant 3: a read-only/diagnostic command NEVER re-dirties after a beat write ====="
# Sequence a real session: a source edit dirties, the beat write via cp clears, and then
# every diagnostic the executor runs to verify must leave the flag CLEAN. The install-named
# test-suite run and the /dev/null-redirected verify are the exact commands that re-dirtied
# during Wave 1 (issue 1 and the pull-time /dev/null bug).
set_dirty
nudge_bash "cp /tmp/harvested.md .claude/memory/session_x.md"   # writes the beat -> clears
DIAGS=(
  "git status --porcelain"
  "git diff --stat"
  "grep -rn TODO src/"
  "bash claude/hooks/test-install-hook-deploy.sh"
  "./install.sh --dry-run"
  "ls -la claude/hooks/"
  "python3 beats/beats.py verify > /dev/null 2>&1"
)
for diag in "${DIAGS[@]}"; do
  nudge_bash "$diag"
  expect_flag "diagnostic does not re-dirty: $diag" clean
done

echo ""
echo "===== Invariant 4: a real git commit while genuinely dirty STILL blocks ====="
set_dirty;   expect_commit_blocked "commit BLOCKED while .memory-dirty present" "$CMT -m wip"
clear_dirty; expect_commit_allowed "commit ALLOWED once the beat cleared the flag" "$CMT -m wip"
set_dirty;   expect_commit_allowed "prose that merely names the commit passes even while dirty" "echo 'todo: $CMT later'"
clear_dirty

echo ""
echo "===== End-to-end: cp-a-beat-then-commit is NOT falsely blocked ====="
# 1) edit an owned source file -> dirty. (Editing hook SOURCE dirties MEMORY too: a code
#    change needs a beat. That is separate from verify-before-done's screenshot exemption.)
clear_dirty; nudge_bash "sed -i 's/x/y/' claude/hooks/memory-nudge.sh"
s1="$(flag_state)"; [ "$s1" = DIRTY ] && ok "step1: editing an owned file dirties" || bad "step1: editing an owned file dirties" "got $s1"
# 2) write the harvested beat via cp into memory -> clears
nudge_bash "cp /tmp/beat.md .claude/memory/session_u7b.md"
s2="$(flag_state)"; [ "$s2" = clean ] && ok "step2: cp the beat into memory clears" || bad "step2: cp the beat into memory clears" "got $s2"
# 3) an install-named diagnostic in between does not re-dirty
nudge_bash "bash claude/hooks/test-install-hook-deploy.sh"
s3="$(flag_state)"; [ "$s3" = clean ] && ok "step3: install-named test run does not re-dirty" || bad "step3: install-named test run does not re-dirty" "got $s3"
# 4) the commit proceeds (flag is clean)
expect_commit_allowed "step4: commit proceeds after the beat" "$CMT -m done"

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo ""; echo "Failed cases:"; for l in "${FAIL_LABELS[@]}"; do echo "  - $l"; done
  exit 1
fi
echo "All invariant checks pass."
exit 0
