#!/bin/bash
# Regression tests for the EXIT STATUS of install.sh's deactivate paths.
#
# Run: bash claude/hooks/test-install-deactivate-status.sh
#
# THE DEFECT, measured 2026-07-28 against pristine HEAD. Several deactivate functions
# ended in the idiom:
#
#     [ -d "$CLAUDE_DIR/skills/$dir" ] && rm -rf "$CLAUDE_DIR/skills/$dir"
#
# As the LAST command of a function that is worth nothing on its own, that returns 1
# whenever the thing being removed is ALREADY ABSENT. deactivate_component captures the
# arm's status directly (`_dc_rc=$?`) and apply_pending treats a non-zero deactivate as a
# failed component and STOPS, preserving the rest of the plan as pending.
#
# The misreported exit code is the small half. The real damage: a user uninstalling four
# components got ONE removed and three silently abandoned. Measured on HEAD with a
# 4-component plan - tactical-polish came out, motion / icon-source / task-list did not,
# and the run exited 1 with no indication that three requests had been dropped.
#
# tactical-polish was worse than its siblings: its dispatch arm ends with a legacy-dir
# sweep over a `*interfaces*` glob that matches nothing on any machine that never had the
# pre-rename directory, so the arm returned 1 even on a completely successful removal.
#
# WHAT THIS SUITE WILL NOT ACCEPT: a fix that returns 0 unconditionally. Swallowing a
# GENUINE removal failure would be a worse bug than the one being fixed, so there is an
# anti-masking row that makes rm actually fail and requires a non-zero result.
#
# SAFETY: every run uses a mktemp HOME. REPO_DIR is the real checkout (that is the point -
# these drive the real installer), so a fingerprint of claude/skills is taken before and
# after and must match.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
# Overridable so the suite can be pointed at a MUTATED or PRISTINE-HEAD installer.
INSTALL_SH="${INSTALL_SH:-$REPO_ROOT/install.sh}"
[ -f "$INSTALL_SH" ] || { echo "cannot find install.sh at $INSTALL_SH"; exit 1; }

PASS=0
FAIL=0
FAIL_LABELS=()
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1  ($2)"; FAIL_LABELS+=("$1"); FAIL=$((FAIL + 1)); }

repo_skills_fp() {
  find "$REPO_ROOT/claude/skills" -type f 2>/dev/null | LC_ALL=C sort \
    | xargs shasum -a 256 2>/dev/null | shasum -a 256 | cut -d' ' -f1
}
REPO_FP_BEFORE="$(repo_skills_fp)"

# ------------------------------------------------------------
# Helpers. Each runs the REAL installer against a throwaway HOME.
# ------------------------------------------------------------
SANDBOXES=()
new_home() { local h; h="$(mktemp -d)" || exit 1; mkdir -p "$h/.claude"; SANDBOXES+=("$h"); printf '%s' "$h"; }
cleanup_homes() { local h; for h in "${SANDBOXES[@]}"; do chmod -R u+w "$h" 2>/dev/null; rm -rf "$h"; done; }

install_only() { # <home> <keys>
  HOME="$1" bash "$INSTALL_SH" --only "$2" --yes >/dev/null 2>&1
}
uninstall_plan() { # <home> <leaf>... -> echoes rc
  local h="$1"; shift
  local json='{"install":[],"uninstall":['
  local first=1 leaf
  for leaf in "$@"; do
    [ "$first" -eq 1 ] || json="$json,"
    json="$json\"$leaf\""
    first=0
  done
  json="$json]}"
  printf '%s' "$json" | HOME="$h" bash "$INSTALL_SH" --apply-plan >/dev/null 2>&1
  echo $?
}
skills_in() { ls "$1/.claude/skills" 2>/dev/null | tr '\n' ' '; }

echo "===== a deactivate of something ALREADY ABSENT is success, not failure ====="

H="$(new_home)"
RC="$(uninstall_plan "$H" "Design Tools/Skills/motion")"
if [ "$RC" -eq 0 ]; then
  pass "uninstalling a design skill that is not installed exits 0"
else
  fail "uninstalling a design skill that is not installed exits 0" \
       "rc=$RC - 'nothing to remove' was reported as a failed component"
fi

H="$(new_home)"
RC="$(uninstall_plan "$H" "Dev surface/task-list")"
if [ "$RC" -eq 0 ]; then
  pass "uninstalling task-list when it is not installed exits 0"
else
  fail "uninstalling task-list when it is not installed exits 0" "rc=$RC"
fi

H="$(new_home)"
RC="$(uninstall_plan "$H" "Foundation/statusline")"
if [ "$RC" -eq 0 ]; then
  pass "uninstalling statusline when it is not installed exits 0"
else
  fail "uninstalling statusline when it is not installed exits 0" "rc=$RC"
fi

echo "===== tactical-polish: the arm that failed even on a SUCCESSFUL removal ====="

# Its dispatch arm ends in a sweep over a `*interfaces*` glob that matches nothing on a
# machine that never had the legacy directory - so the arm reported failure every time.
H="$(new_home)"
install_only "$H" tactical-polish
BEFORE="$(skills_in "$H")"
RC="$(uninstall_plan "$H" "Design Tools/Skills/tactical-polish")"
AFTER="$(skills_in "$H")"
case "$BEFORE" in
  *tactical-polish*) INSTALLED=1 ;;
  *) INSTALLED=0 ;;
esac
if [ "$INSTALLED" -eq 1 ] && [ "$RC" -eq 0 ] && [ -z "$AFTER" ]; then
  pass "uninstalling an INSTALLED tactical-polish exits 0 and removes it"
else
  fail "uninstalling an INSTALLED tactical-polish exits 0 and removes it" \
       "was_installed=$INSTALLED rc=$RC remaining='$AFTER'"
fi

echo "===== THE CONSEQUENCE: one bad status must not abandon the rest of the plan ====="

# This is the row that matters. On HEAD this plan removed tactical-polish, returned 1,
# and silently left motion, icon-source and task-list installed - three requests dropped
# with no indication to the user.
H="$(new_home)"
install_only "$H" tactical-polish,motion,icon-source,task-list
BEFORE="$(skills_in "$H")"
RC="$(uninstall_plan "$H" \
  "Design Tools/Skills/tactical-polish" \
  "Design Tools/Skills/motion" \
  "Design Tools/Skills/icon-source" \
  "Dev surface/task-list")"
AFTER="$(skills_in "$H")"
# The fixture is only meaningful if all four were installed to begin with.
FOUR=1
for want in tactical-polish motion-reference icon-source task-list; do
  case "$BEFORE" in *"$want"*) : ;; *) FOUR=0 ;; esac
done
if [ "$FOUR" -eq 1 ] && [ "$RC" -eq 0 ] && [ -z "$AFTER" ]; then
  pass "a 4-component uninstall plan removes ALL FOUR and exits 0"
else
  fail "a 4-component uninstall plan removes ALL FOUR and exits 0" \
       "all_four_installed=$FOUR rc=$RC still_installed='$AFTER'"
fi

echo "===== the whole family, swept: every uninstallable leaf, nothing installed ====="

# The static shape appeared in several functions at once, so the row is the SWEEP rather
# than a list of individual cases - a one-line fix that leaves three siblings is not a fix.
# Personal/* leaves are excluded from apply-plan's allowlist by design and exit 2.
LEAVES="$(python3 - "$REPO_ROOT" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]+"/claude/hooks/browser-tree.json"))
out=[]
for b in d['buckets']:
    if b['key']=='Personal': continue
    for m in b.get('members',[]):
        if m.get('kind')=='leaf': out.append(b['key']+'/'+m['key'])
        elif m.get('kind')=='group':
            for c in m.get('members',[]):
                if c.get('kind')=='leaf': out.append(b['key']+'/'+m['key']+'/'+c['key'])
print("\n".join(out))
PY
)"
SWEEP_BAD=""
SWEEP_N=0
while IFS= read -r leaf; do
  [ -n "$leaf" ] || continue
  SWEEP_N=$((SWEEP_N + 1))
  H="$(new_home)"
  RC="$(uninstall_plan "$H" "$leaf")"
  [ "$RC" -ne 0 ] && SWEEP_BAD="$SWEEP_BAD $leaf(rc=$RC)"
  chmod -R u+w "$H" 2>/dev/null; rm -rf "$H"
done <<EOF
$LEAVES
EOF
if [ -z "$SWEEP_BAD" ] && [ "$SWEEP_N" -ge 20 ]; then
  pass "all $SWEEP_N uninstallable leaves exit 0 when the component is absent"
else
  fail "all uninstallable leaves exit 0 when the component is absent" \
       "swept=$SWEEP_N failures:$SWEEP_BAD"
fi

echo "===== ANTI-MASKING: a GENUINE removal failure must still be reported ====="

# The cheap fix for everything above is `return 0`. That would be a worse bug than the
# one being fixed: a deactivate that could not remove what it was asked to remove would
# report success and apply_pending would mark the component inactive while its files sat
# on disk. Make rm actually fail and require non-zero.
H="$(new_home)"
install_only "$H" motion
if [ -d "$H/.claude/skills/motion-reference" ]; then
  chmod 500 "$H/.claude/skills"          # cannot unlink children of a non-writable dir
  RC="$(uninstall_plan "$H" "Design Tools/Skills/motion")"
  STILL=0; [ -d "$H/.claude/skills/motion-reference" ] && STILL=1
  chmod 700 "$H/.claude/skills" 2>/dev/null
  if [ "$RC" -ne 0 ] && [ "$STILL" -eq 1 ]; then
    pass "a removal that genuinely FAILS still reports non-zero (no blanket return 0)"
  else
    fail "a removal that genuinely FAILS still reports non-zero (no blanket return 0)" \
         "rc=$RC still_present=$STILL - a real failure was reported as success"
  fi
else
  fail "a removal that genuinely FAILS still reports non-zero (no blanket return 0)" \
       "fixture did not install motion-reference, so the row could not run"
fi

echo "===== mutation control: each fix must be provably load-bearing ====="

MUT_PASS=0
MUT_FAIL=0

# A MUTANT MUST LIVE INSIDE A REAL REPO TREE. install.sh computes
# REPO_DIR="$(cd "$(dirname "$0")" && pwd)", so a mutant written to $TMPDIR resolves
# REPO_DIR to the temp directory, cannot find browser-lib.sh, and exits 1 from
# "apply-plan: could not load tree" - which looks exactly like a caught mutation and is
# nothing of the kind. The first cut of this suite made that mistake and scored four
# false catches. Mutants are therefore written into a git-archive checkout.
MUT_REPO="$(mktemp -d)/improv"
mkdir -p "$MUT_REPO"
( cd "$REPO_ROOT" && git archive HEAD ) | tar -x -C "$MUT_REPO" 2>/dev/null
SANDBOXES+=("$(dirname "$MUT_REPO")")
if [ -f "$MUT_REPO/claude/hooks/browser-lib.sh" ] && [ -f "$MUT_REPO/claude/hooks/browser-tree.json" ]; then
  pass "mutation environment: the mutant repo tree has the files install.sh needs"
else
  fail "mutation environment: the mutant repo tree has the files install.sh needs" \
       "git archive did not produce a usable tree - every mutation below would be a false catch"
fi
# Mutants are built with python (the fixes are multi-line, which sed handles badly) and
# each asserts its ANCHOR EXISTS first - a mutation that silently changed nothing would
# make "not caught" a lie about the suite rather than a finding about the code.
mutate_and_probe() { # <label> <anchor-python-literal> <replacement-python-literal> <probe-fn>
  local label="$1" anchor="$2" repl="$3" probe="$4"
  local mutant="$MUT_REPO/install.sh"
  local scratch; scratch="$(mktemp)" || return 1
  SANDBOXES+=("$scratch")
  if ! ANCHOR="$anchor" REPL="$repl" SRC="$INSTALL_SH" OUT="$scratch" python3 - <<'PY'
import os,sys
src=open(os.environ["SRC"]).read()
a=os.environ["ANCHOR"]; r=os.environ["REPL"]
if src.count(a) != 1:
    sys.stderr.write("anchor count %d\n" % src.count(a)); sys.exit(3)
open(os.environ["OUT"],"w").write(src.replace(a,r,1))
PY
  then
    fail "mutation anchor exists: $label" "anchor not found exactly once - mutation would be a no-op"
    MUT_FAIL=$((MUT_FAIL + 1)); return 0
  fi
  if ! bash -n "$scratch" 2>/dev/null; then
    fail "mutation is syntactically valid: $label" "the mutant does not parse, so a red probe proves nothing"
    MUT_FAIL=$((MUT_FAIL + 1)); return 0
  fi
  # BASELINE CONTROL, run per mutation: the UNMUTATED installer, from the very same
  # tree, must report CORRECT. If it does not, the environment is broken and a red probe
  # says nothing about the mutation. This is the check whose absence produced four false
  # catches in the first cut of this suite.
  cp "$INSTALL_SH" "$mutant"
  if ! ( INSTALL_SH="$mutant" "$probe" ); then
    fail "mutation baseline: $label" \
         "the UNMUTATED installer already fails this probe inside the mutant tree - broken environment, not a caught mutation"
    MUT_FAIL=$((MUT_FAIL + 1))
    return 0
  fi
  cp "$scratch" "$mutant"
  if ( INSTALL_SH="$mutant" "$probe" ); then
    fail "mutation caught: $label" "the mutant still passed its probe - the row is asleep"
    MUT_FAIL=$((MUT_FAIL + 1))
  else
    pass "mutation caught: $label"
    MUT_PASS=$((MUT_PASS + 1))
  fi
  cp "$INSTALL_SH" "$mutant"   # restore for the next mutation
}

# Probes return 0 when the mutant STILL behaves correctly (i.e. NOT caught).
probe_absent_skill() {
  local h; h="$(mktemp -d)"; mkdir -p "$h/.claude"
  local rc; rc="$(printf '{"install":[],"uninstall":["Design Tools/Skills/motion"]}' \
    | HOME="$h" bash "$INSTALL_SH" --apply-plan >/dev/null 2>&1; echo $?)"
  rm -rf "$h"
  [ "$rc" -eq 0 ]
}
probe_absent_tasklist() {
  local h; h="$(mktemp -d)"; mkdir -p "$h/.claude"
  local rc; rc="$(printf '{"install":[],"uninstall":["Dev surface/task-list"]}' \
    | HOME="$h" bash "$INSTALL_SH" --apply-plan >/dev/null 2>&1; echo $?)"
  rm -rf "$h"
  [ "$rc" -eq 0 ]
}
probe_absent_statusline() {
  local h; h="$(mktemp -d)"; mkdir -p "$h/.claude"
  local rc; rc="$(printf '{"install":[],"uninstall":["Foundation/statusline"]}' \
    | HOME="$h" bash "$INSTALL_SH" --apply-plan >/dev/null 2>&1; echo $?)"
  rm -rf "$h"
  [ "$rc" -eq 0 ]
}
probe_installed_tp() {
  local h; h="$(mktemp -d)"; mkdir -p "$h/.claude"
  HOME="$h" bash "$INSTALL_SH" --only tactical-polish --yes >/dev/null 2>&1
  local rc; rc="$(printf '{"install":[],"uninstall":["Design Tools/Skills/tactical-polish"]}' \
    | HOME="$h" bash "$INSTALL_SH" --apply-plan >/dev/null 2>&1; echo $?)"
  rm -rf "$h"
  [ "$rc" -eq 0 ]
}
probe_genuine_failure() {
  local h; h="$(mktemp -d)"; mkdir -p "$h/.claude"
  HOME="$h" bash "$INSTALL_SH" --only motion --yes >/dev/null 2>&1
  chmod 500 "$h/.claude/skills" 2>/dev/null
  local rc; rc="$(printf '{"install":[],"uninstall":["Design Tools/Skills/motion"]}' \
    | HOME="$h" bash "$INSTALL_SH" --apply-plan >/dev/null 2>&1; echo $?)"
  chmod 700 "$h/.claude/skills" 2>/dev/null; rm -rf "$h"
  [ "$rc" -ne 0 ]   # correct = still reports the real failure
}

# MD1: revert deactivate_design_skill to the trailing-conditional form
mutate_and_probe "deactivate_design_skill reverted to a trailing conditional" \
'  if [ -d "$CLAUDE_DIR/skills/$dir" ]; then
    rm -rf "$CLAUDE_DIR/skills/$dir"
  fi' \
'  [ -d "$CLAUDE_DIR/skills/$dir" ] && rm -rf "$CLAUDE_DIR/skills/$dir"' \
  probe_absent_skill

# MD2: revert the tactical-polish legacy sweep
mutate_and_probe "tactical-polish legacy sweep reverted to a trailing conditional" \
'                       for _legacy in "$CLAUDE_DIR"/skills/*interfaces*; do
                         if [ -e "$_legacy" ]; then rm -rf "$_legacy"; fi
                       done ;;' \
'                       for _legacy in "$CLAUDE_DIR"/skills/*interfaces*; do [ -e "$_legacy" ] && rm -rf "$_legacy"; done ;;' \
  probe_installed_tp

# MD3: revert deactivate_task_list
mutate_and_probe "deactivate_task_list reverted to a trailing conditional" \
'  if [ -d "$CLAUDE_DIR/skills/task-list" ]; then
    rm -rf "$CLAUDE_DIR/skills/task-list"
  fi' \
'  [ -d "$CLAUDE_DIR/skills/task-list" ] && rm -rf "$CLAUDE_DIR/skills/task-list"' \
  probe_absent_tasklist

# MD4: revert deactivate_statusline
mutate_and_probe "deactivate_statusline reverted to a trailing conditional" \
'  if [ -L "$CLAUDE_DIR/statusline-command.sh" ]; then
    rm -f "$CLAUDE_DIR/statusline-command.sh"
  fi' \
'  [ -L "$CLAUDE_DIR/statusline-command.sh" ] && rm -f "$CLAUDE_DIR/statusline-command.sh"' \
  probe_absent_statusline

# MD5: the LAZY fix - blanket success. The anti-masking row must catch it.
mutate_and_probe "deactivate_design_skill given a blanket return 0" \
'  if [ -d "$CLAUDE_DIR/skills/$dir" ]; then
    rm -rf "$CLAUDE_DIR/skills/$dir"
  fi' \
'  if [ -d "$CLAUDE_DIR/skills/$dir" ]; then
    rm -rf "$CLAUDE_DIR/skills/$dir" 2>/dev/null
  fi
  return 0' \
  probe_genuine_failure

if [ "$MUT_FAIL" -eq 0 ] && [ "$MUT_PASS" -ge 5 ]; then
  pass "mutation control: all $MUT_PASS mutations were caught by a live row"
else
  fail "mutation control: all mutations were caught by a live row" \
       "caught=$MUT_PASS uncaught_or_noop=$MUT_FAIL"
fi

echo "===== safety: the repo's own skill sources were never touched ====="
REPO_FP_AFTER="$(repo_skills_fp)"
if [ "$REPO_FP_BEFORE" = "$REPO_FP_AFTER" ] && [ -n "$REPO_FP_BEFORE" ]; then
  pass "claude/skills is byte-identical after every install and deactivate in this suite"
else
  fail "claude/skills is byte-identical after every install and deactivate in this suite" \
       "before=$REPO_FP_BEFORE after=$REPO_FP_AFTER"
fi

cleanup_homes

echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed cases:"
  for label in "${FAIL_LABELS[@]}"; do
    echo "  - $label"
  done
  exit 1
fi
echo "All tests pass."
exit 0
