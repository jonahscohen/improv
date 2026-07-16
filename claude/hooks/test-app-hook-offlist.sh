#!/bin/bash
# test-app-hook-offlist.sh - verify install_app_hooks honors the per-hook off-list
# (HOOK_OFF, seeded from _AMPERSAND_HOOK_OFF) for APP components, mirroring the
# QA-hook CLUSTER pass. Subject: the `chrome` component (3 pure hooks, no daemon
# build). Runs under /bin/bash (3.2) in a throwaway HOME sandbox per scenario.
#
# Exit codes:
#   0  all scenarios passed
#   1  one or more assertions failed
#   2  harness/setup error (repo layout wrong, python3 missing, install failed)

set -u

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"

CMD_TRACK='~/.claude/hooks/chrome-tabgroup-track.sh'
CMD_CLEAR='~/.claude/hooks/chrome-tabgroup-clear.sh'
CMD_STOP='~/.claude/hooks/chrome-tabgroup-stop.sh'

PASS=0
FAIL=0

[ -f "$INSTALL" ] || { echo "SETUP-FAIL: install.sh not found at $INSTALL"; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "SETUP-FAIL: python3 required"; exit 2; }

pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# hook_present <SB> <name>  -> 0 if the deployed hook file resolves, 1 otherwise
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

# run_install <SB> <hook_off_or_empty>  -> runs `install.sh --only chrome --yes`
# with an isolated HOME; echoes the installer exit code.
run_install() {
  local sb="$1" hook_off="$2"
  _AMPERSAND_HOOK_OFF="$hook_off" _AMPERSAND_NO_SUMMARY=1 HOME="$sb" \
    bash "$INSTALL" --only chrome --yes >/dev/null 2>&1
  echo $?
}

echo "== Test A: off-listed hook is SKIPPED on install =="
SB="$(mktemp -d)"
rc="$(run_install "$SB" "chrome-tabgroup-clear.sh")"
[ "$rc" = "0" ] && pass "installer exit 0" || fail "installer exit was $rc (want 0)"
hook_present "$SB" chrome-tabgroup-track.sh && pass "track.sh deployed" || fail "track.sh missing"
hook_present "$SB" chrome-tabgroup-stop.sh  && pass "stop.sh deployed"  || fail "stop.sh missing"
hook_present "$SB" chrome-tabgroup-clear.sh && fail "clear.sh deployed (should be skipped)" || pass "clear.sh NOT deployed"
cmd_in_settings "$SB" "$CMD_TRACK" && pass "track wired"  || fail "track wiring absent"
cmd_in_settings "$SB" "$CMD_STOP"  && pass "stop wired"   || fail "stop wiring absent"
cmd_in_settings "$SB" "$CMD_CLEAR" && fail "clear wired (should be skipped)" || pass "clear wiring NOT present"
rm -rf "$SB"

echo "== Test B: re-run with a hook now off-listed RECONCILE-removes it =="
SB="$(mktemp -d)"
rc="$(run_install "$SB" "")"
[ "$rc" = "0" ] && pass "first install (no off-list) exit 0" || fail "first install exit $rc"
hook_present "$SB" chrome-tabgroup-track.sh && pass "track present after full install" || fail "track missing after full install"
hook_present "$SB" chrome-tabgroup-clear.sh && pass "clear present after full install" || fail "clear missing after full install"
hook_present "$SB" chrome-tabgroup-stop.sh  && pass "stop present after full install"  || fail "stop missing after full install"
cmd_in_settings "$SB" "$CMD_CLEAR" && pass "clear wired after full install" || fail "clear wiring absent after full install"
# re-run with clear off-listed
rc="$(run_install "$SB" "chrome-tabgroup-clear.sh")"
[ "$rc" = "0" ] && pass "re-run exit 0" || fail "re-run exit $rc"
hook_present "$SB" chrome-tabgroup-clear.sh && fail "clear STILL present after re-run (not removed)" || pass "clear removed on re-run"
cmd_in_settings "$SB" "$CMD_CLEAR" && fail "clear wiring STILL present after re-run" || pass "clear wiring removed on re-run"
hook_present "$SB" chrome-tabgroup-track.sh && pass "track still present after re-run" || fail "track wrongly removed"
hook_present "$SB" chrome-tabgroup-stop.sh  && pass "stop still present after re-run"  || fail "stop wrongly removed"
cmd_in_settings "$SB" "$CMD_TRACK" && pass "track still wired after re-run" || fail "track wiring wrongly removed"
cmd_in_settings "$SB" "$CMD_STOP"  && pass "stop still wired after re-run"  || fail "stop wiring wrongly removed"
rm -rf "$SB"

echo "== Test C: off-list generalizes to a DIFFERENT single hook (stop) =="
SB="$(mktemp -d)"
rc="$(run_install "$SB" "")"
[ "$rc" = "0" ] && pass "first install exit 0" || fail "first install exit $rc"
hook_present "$SB" chrome-tabgroup-stop.sh && pass "stop present after full install" || fail "stop missing after full install"
cmd_in_settings "$SB" "$CMD_STOP" && pass "stop wired after full install" || fail "stop wiring absent after full install"
# re-run with stop off-listed
rc="$(run_install "$SB" "chrome-tabgroup-stop.sh")"
[ "$rc" = "0" ] && pass "re-run exit 0" || fail "re-run exit $rc"
hook_present "$SB" chrome-tabgroup-stop.sh && fail "stop STILL present after re-run" || pass "stop removed on re-run"
cmd_in_settings "$SB" "$CMD_STOP" && fail "stop wiring STILL present after re-run" || pass "stop wiring removed on re-run"
hook_present "$SB" chrome-tabgroup-track.sh && pass "track still present" || fail "track wrongly removed"
hook_present "$SB" chrome-tabgroup-clear.sh && pass "clear still present" || fail "clear wrongly removed"
cmd_in_settings "$SB" "$CMD_TRACK" && pass "track still wired" || fail "track wiring wrongly removed"
cmd_in_settings "$SB" "$CMD_CLEAR" && pass "clear still wired" || fail "clear wiring wrongly removed"
rm -rf "$SB"

echo "== Test D: normal install (empty off-list) wires ALL three (no drop regression) =="
SB2="$(mktemp -d)"
rc="$(run_install "$SB2" "")"
[ "$rc" = "0" ] && pass "install exit 0" || fail "install exit $rc"
hook_present "$SB2" chrome-tabgroup-track.sh && pass "track deployed" || fail "track missing"
hook_present "$SB2" chrome-tabgroup-clear.sh && pass "clear deployed" || fail "clear missing"
hook_present "$SB2" chrome-tabgroup-stop.sh  && pass "stop deployed"  || fail "stop missing"
cmd_in_settings "$SB2" "$CMD_TRACK" && pass "track wired" || fail "track wiring absent"
cmd_in_settings "$SB2" "$CMD_CLEAR" && pass "clear wired" || fail "clear wiring absent"
cmd_in_settings "$SB2" "$CMD_STOP"  && pass "stop wired"  || fail "stop wiring absent"
rm -rf "$SB2"

echo
echo "TALLY: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
echo "ALL APP-HOOK OFF-LIST CHECKS PASSED"
exit 0
