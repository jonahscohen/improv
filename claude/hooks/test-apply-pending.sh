#!/bin/bash
# test-apply-pending.sh - end-to-end verification of apply_pending (browser-lib.sh):
# the staged pending sets become ONE real install pass (carrying the merged, .sh-suffixed
# off-list) plus a deactivate pass, run against the REAL install.sh in a throwaway HOME.
#
# apply_pending only runs at install.sh runtime ("$0" must be the installer,
# deactivate_component must be in scope), so it is driven through install.sh's TEST-ONLY
# seam: _AMPERSAND_APPLY_TEST=1 seeds PENDING_INSTALL/PENDING_UNINSTALL from
# _AMPERSAND_TEST_PI/_AMPERSAND_TEST_PU, calls apply_pending, and exits.
#
# Subjects (chosen for sandbox safety - pure hooks + a pure skill copy, no daemon build):
#   codex     - the "uninstall ONE hook" subject (2 hooks + codex-review.py)
#   chrome    - the "install a component" subject (3 pure hooks)
#   task-list - the untouched-bystander / whole-component-deactivate subject (skill copy)
#
# Leaf paths are DERIVED from browser-tree.json via browser-lib's own accessors rather
# than hardcoded, so a tree reorganization fails this test loudly instead of silently
# staging nothing.
#
# Exit codes:
#   0  all scenarios passed
#   1  one or more assertions failed
#   2  harness/setup error (repo layout wrong, python3 missing, seed install failed,
#      or a leaf path could not be resolved from the tree)

set -u

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"
TREE="$REPO_DIR/claude/hooks/browser-tree.json"
LIB="$REPO_DIR/claude/hooks/browser-lib.sh"

PASS=0
FAIL=0

[ -f "$INSTALL" ] || { echo "SETUP-FAIL: install.sh not found at $INSTALL"; exit 2; }
[ -f "$TREE" ]    || { echo "SETUP-FAIL: browser-tree.json not found at $TREE"; exit 2; }
[ -f "$LIB" ]     || { echo "SETUP-FAIL: browser-lib.sh not found at $LIB"; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "SETUP-FAIL: python3 required"; exit 2; }

pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# --- resolve the real leaf paths from the tree ------------------------------
# shellcheck source=/dev/null
source "$LIB"
browser_load "$TREE" || { echo "SETUP-FAIL: browser_load failed"; exit 2; }

P_TRACK="$(_br_hook_path chrome-tabgroup-track)"
P_CLEAR="$(_br_hook_path chrome-tabgroup-clear)"
P_STOP="$(_br_hook_path chrome-tabgroup-stop)"
P_RESCUE="$(_br_hook_path codex-rescue-guard)"
P_TASKLIST="$(_owner_leaf_path task-list)"
for _p in "$P_TRACK" "$P_CLEAR" "$P_STOP" "$P_RESCUE" "$P_TASKLIST"; do
  [ -n "$_p" ] || { echo "SETUP-FAIL: could not resolve a leaf path from $TREE"; exit 2; }
done

# Bookended-"|" pending sets, exactly the staging layer's format.
PI_CHROME="|$P_TRACK|$P_CLEAR|$P_STOP|"
PU_RESCUE="|$P_RESCUE|"
PU_TASKLIST="|$P_TASKLIST|"

CMD_TRACK='~/.claude/hooks/chrome-tabgroup-track.sh'
CMD_CLEAR='~/.claude/hooks/chrome-tabgroup-clear.sh'
CMD_STOP='~/.claude/hooks/chrome-tabgroup-stop.sh'
CMD_WATCHER='~/.claude/hooks/codex-failure-watcher.sh'
CMD_RESCUE='~/.claude/hooks/codex-rescue-guard.sh'

# hook_present <SB> <name> -> 0 if the deployed hook file resolves
hook_present() { [ -f "$1/.claude/hooks/$2" ]; }

# cmd_in_settings <SB> <command-string> -> 0 if any wired hook command equals it
cmd_in_settings() {
  local sb="$1" cmd="$2"
  CMD="$cmd" python3 -c "
import json, os, sys
p = os.path.join('$sb', '.claude', 'settings.json')
try:
    d = json.load(open(p))
except Exception:
    sys.exit(1)
want = os.environ['CMD']
for ev, groups in d.get('hooks', {}).items():
    for g in groups:
        for h in g.get('hooks', []):
            if h.get('command') == want:
                sys.exit(0)
sys.exit(1)
"
}

# state_of <SB> <owner> -> the owner's recorded status from the installer's state file
# (~/.claude/.dotfiles-state), or "" when the file or the entry is absent. This is the
# bookkeeping returning_flow maintains via `state_set "$pick" "inactive"` (install.sh:2033);
# apply_pending must keep parity with it.
state_of() {
  python3 -c "
import json, os, sys
p = os.path.join('$1', '.claude', '.dotfiles-state')
try:
    d = json.load(open(p))
except Exception:
    sys.exit(0)
sys.stdout.write(d.get('components', {}).get('$2', ''))
"
}

# run_apply <SB> <pending_install> <pending_uninstall> -> echoes install.sh's exit code.
# Drives apply_pending through the test seam with an isolated HOME.
run_apply() {
  local sb="$1" pi="$2" pu="$3"
  _AMPERSAND_APPLY_TEST=1 _AMPERSAND_TEST_PI="$pi" _AMPERSAND_TEST_PU="$pu" \
    HOME="$sb" bash "$INSTALL" >/dev/null 2>&1
  echo $?
}

echo "== Seeding sandbox: install.sh --only codex,task-list --yes =="
SB="$(mktemp -d)"
_AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --only codex,task-list --yes >/dev/null 2>&1 \
  || { echo "SETUP-FAIL: seed install (--only codex,task-list) failed"; rm -rf "$SB"; exit 2; }
# Seed state must be exactly what the scenarios assume, else the assertions below are lies.
hook_present "$SB" codex-failure-watcher.sh && pass "seed: codex-failure-watcher present" || fail "seed: codex-failure-watcher missing"
hook_present "$SB" codex-rescue-guard.sh    && pass "seed: codex-rescue-guard present"    || fail "seed: codex-rescue-guard missing"
hook_present "$SB" codex-review.py          && pass "seed: codex-review.py present"       || fail "seed: codex-review.py missing"
cmd_in_settings "$SB" "$CMD_RESCUE"         && pass "seed: codex-rescue-guard wired"      || fail "seed: codex-rescue-guard wiring absent"
cmd_in_settings "$SB" "$CMD_WATCHER"        && pass "seed: codex-failure-watcher wired"   || fail "seed: codex-failure-watcher wiring absent"
[ -f "$SB/.claude/skills/task-list/SKILL.md" ] && pass "seed: task-list skill present" || fail "seed: task-list skill missing"
hook_present "$SB" chrome-tabgroup-track.sh && fail "seed: chrome already installed (should be absent)" || pass "seed: chrome NOT installed"
# The seed's end-of-run sync (install.sh ~3903) records every KEY from disk. task-list must
# read "active" here, else the Scenario B state assertion below would pass vacuously.
[ "$(state_of "$SB" task-list)" = "active" ] && pass "seed: task-list state is active" || fail "seed: task-list state is '$(state_of "$SB" task-list)' (want active)"

echo
echo "== Scenario A: stage 'install chrome' + 'uninstall ONE codex hook' -> one install pass =="
# apply_pending_plan for this staged set is:
#   INSTALL chrome,codex|codex-rescue-guard.sh
#   DEACTIVATE
# i.e. turning off a single codex hook is an OFF-LIST install, never a component uninstall.
rc="$(run_apply "$SB" "$PI_CHROME" "$PU_RESCUE")"
[ "$rc" = "0" ] && pass "apply exit 0" || fail "apply exit was $rc (want 0)"
# chrome installed: deployed + wired
hook_present "$SB" chrome-tabgroup-track.sh && pass "chrome track deployed" || fail "chrome track missing"
hook_present "$SB" chrome-tabgroup-clear.sh && pass "chrome clear deployed" || fail "chrome clear missing"
hook_present "$SB" chrome-tabgroup-stop.sh  && pass "chrome stop deployed"  || fail "chrome stop missing"
cmd_in_settings "$SB" "$CMD_TRACK" && pass "chrome track wired" || fail "chrome track wiring absent"
cmd_in_settings "$SB" "$CMD_CLEAR" && pass "chrome clear wired" || fail "chrome clear wiring absent"
cmd_in_settings "$SB" "$CMD_STOP"  && pass "chrome stop wired"  || fail "chrome stop wiring absent"
# the one off-listed codex hook is GONE, file + wiring
hook_present "$SB" codex-rescue-guard.sh && fail "codex-rescue-guard STILL deployed (off-list ignored)" || pass "codex-rescue-guard removed"
cmd_in_settings "$SB" "$CMD_RESCUE" && fail "codex-rescue-guard wiring STILL present" || pass "codex-rescue-guard wiring stripped"
# codex's OTHER hook + its non-hook payload survive: this was an off-list install, not an uninstall
hook_present "$SB" codex-failure-watcher.sh && pass "codex-failure-watcher survives" || fail "codex-failure-watcher wrongly removed"
cmd_in_settings "$SB" "$CMD_WATCHER" && pass "codex-failure-watcher still wired" || fail "codex-failure-watcher wiring wrongly removed"
hook_present "$SB" codex-review.py && pass "codex-review.py survives" || fail "codex-review.py wrongly removed"
# untouched bystander
[ -f "$SB/.claude/skills/task-list/SKILL.md" ] && pass "task-list untouched" || fail "task-list wrongly removed"
# install owners are reconciled from disk by the install pass's own end-of-run sync -
# apply_pending must NOT be recording state for them itself.
[ "$(state_of "$SB" chrome)" = "active" ] && pass "installed owner state is active" || fail "installed owner state is '$(state_of "$SB" chrome)' (want active)"

echo
echo "== Scenario B: DEACTIVATE-ONLY apply -> removal runs AND state is recorded inactive =="
# apply_pending_plan for this staged set is:
#   INSTALL |
#   DEACTIVATE task-list
# No install owners, so apply_pending spawns NO child install pass - which means there is no
# end-of-run sync (install.sh ~3903) to reconcile the state file afterward. This path is the
# whole reason apply_pending must state_set itself (returning_flow parity, install.sh:2033):
# nothing else will ever record the removal.
rc="$(run_apply "$SB" "" "$PU_TASKLIST")"
[ "$rc" = "0" ] && pass "deactivate-only apply exit 0" || fail "deactivate-only apply exit was $rc (want 0)"
[ -f "$SB/.claude/skills/task-list/SKILL.md" ] && fail "task-list STILL present (deactivate pass did not run)" || pass "task-list deactivated"
[ "$(state_of "$SB" task-list)" = "inactive" ] && pass "deactivated owner recorded inactive (no-install-pass path)" || fail "deactivated owner state is '$(state_of "$SB" task-list)' (want inactive)"
# the deactivate pass must not disturb anything else
hook_present "$SB" chrome-tabgroup-track.sh && pass "chrome survives deactivate pass" || fail "chrome wrongly removed"
cmd_in_settings "$SB" "$CMD_TRACK" && pass "chrome wiring survives deactivate pass" || fail "chrome wiring wrongly removed"
hook_present "$SB" codex-failure-watcher.sh && pass "codex survives deactivate pass" || fail "codex wrongly removed"
hook_present "$SB" codex-rescue-guard.sh && fail "codex-rescue-guard came BACK (unwanted reinstall)" || pass "codex-rescue-guard stays off"

echo
echo "== Scenario C: nothing staged -> no-op, exit 0, nothing disturbed =="
rc="$(run_apply "$SB" "" "")"
[ "$rc" = "0" ] && pass "empty apply exit 0" || fail "empty apply exit was $rc (want 0)"
hook_present "$SB" chrome-tabgroup-track.sh && pass "chrome intact after no-op" || fail "chrome disturbed by no-op"
hook_present "$SB" codex-failure-watcher.sh && pass "codex intact after no-op" || fail "codex disturbed by no-op"
hook_present "$SB" codex-rescue-guard.sh && fail "codex-rescue-guard reappeared after no-op" || pass "codex-rescue-guard still off after no-op"

rm -rf "$SB"

echo
echo "TALLY: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
echo "ALL APPLY-PENDING CHECKS PASSED"
exit 0
