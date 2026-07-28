#!/bin/bash
# test-installer-tempfile-hygiene.sh - the apply layer must not leave temp files behind.
#
# THE DEFECT THIS EXISTS FOR. apply_pending and update_apply each capture their child
# install pass to a `mktemp` log. Both removed that log on the SUCCESS path and neither
# removed it on the FAILURE path, so every failed apply and every failed update left one
# file in the temp dir forever. It read as deliberate because the failure message named
# the file - but the message printed the tail inline, so the named file was never the
# thing the caller was actually reading.
#
# WHY THIS FILE AND NOT AN EXISTING SUITE. claude/hooks/test-apply-pending.sh and
# test-component-browser.sh already drive these two functions, but they assert on exit
# codes and on what landed in a sandbox HOME - they never look at the temp dir. This suite
# asks one question those cannot: after the call returns, is the temp dir as empty as it
# was before?
#
# HOW THE ASSERTION IS MADE OBSERVABLE. Both functions build their log path from
# ${TMPDIR:-/tmp}, so pointing TMPDIR at a fresh empty directory makes "did it leak"
# a plain file count rather than a guess about where a bare mktemp landed. (A bare
# `mktemp` ignores TMPDIR on macOS and uses the per-user Darwin temp dir, which is why
# the templated form is load-bearing for this suite and not cosmetic.)
#
# EVERY LEAK ROW IS ANCHORED. A row that only counts files in a temp dir passes when the
# function never ran at all - a syntax error, a missing stub, a plan that produced no
# install owners all leave the directory empty and file a clean bill of health for code
# that was never executed. So each leak row is paired with an anchor row that proves the
# branch under test ran, by matching the message that branch and only that branch prints.
#
# MUTATION CONTROL. Section 3 re-runs the same probes against a MUTANT copy of
# browser-lib.sh with the failure-path cleanup deleted, and fails if the probe reports
# clean. A leak probe that cannot see a leak it was handed is not evidence.
#
# Exit codes:
#   0  every row passed
#   1  one or more rows failed
#   2  harness/setup error - the subject could not be located, staged, or mutated
#
# Sandboxing: every run happens under a private TMPROOT and a private TMPDIR. Nothing
# here reads or writes $HOME, ~/.claude, ~/.zshrc, or the checkout.

set -u

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB="$REPO_DIR/claude/hooks/browser-lib.sh"

PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL %s\n      -> %s\n' "$1" "${2:-}"; }

[ -f "$LIB" ] || { echo "HARNESS: browser-lib.sh not found at $LIB" >&2; exit 2; }

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/improv-tmphyg-XXXXXX")" \
  || { echo "HARNESS: could not create a temp root" >&2; exit 2; }
cleanup() { rm -rf "$TMPROOT"; }
trap cleanup EXIT

# A stand-in for install.sh. apply_pending and update_apply both re-invoke the installer as
# `bash "$0"` / `bash "$self"`, so $0 is the seam: `bash -c '<script>' <name>` sets $0 to
# <name>, which is how these probes drive the child-install branch without running a real
# install. The child prints on both streams so `tail -20` has something to show.
CHILD="$TMPROOT/fake-installer"
# THE CHILD LEAVES A MARKER ON DISK, and that is not decoration. On the SUCCESS path the
# child's output goes into the log, which is then deleted, so nothing it printed survives
# into the probe output - and "no temp file left" is equally true of a run where the child
# never executed at all. Every success row would then be green against an apply layer that
# had stopped invoking the installer entirely. The marker is a side effect that outlives
# the log, so "did the child run" is answerable independently of what was captured.
CHILD_RAN="$CHILD.ran"
make_child() { # $1 = exit code the fake installer should return
  rm -f "$CHILD_RAN"
  printf '%s\n' '#!/bin/bash' \
    ': > "$0.ran"' \
    'echo "fake installer stdout: $*"' \
    'echo "fake installer stderr" >&2' \
    "exit $1" > "$CHILD"
  chmod +x "$CHILD" || return 1
}
child_ran() { [ -f "$CHILD_RAN" ]; }

# probe_apply_pending <lib> <child-exit> <sandbox-tmpdir>
# Drives apply_pending's install branch with a stubbed plan, under a private TMPDIR.
# Prints the function's own stderr; the caller counts the sandbox afterwards.
#
# `tail` IS WRAPPED, NOT REPLACED. The wrapper prints the log path the function chose and
# then delegates to the real tail via `command`, so one probe yields both facts a leak row
# needs: WHERE the log was created (without which a file count is measuring a directory
# the log never entered - the exact way this suite would false-pass against a bare
# `mktemp` that ignores TMPDIR) and what the real tail actually showed the caller.
probe_apply_pending() {
  local lib="$1" childrc="$2" td="$3"
  make_child "$childrc" || return 2
  mkdir -p "$td" || return 2
  env TMPDIR="$td" bash -c '
    source "$1" || exit 90
    apply_pending_plan(){ printf "INSTALL foo|\nDEACTIVATE \n"; }
    stage_reset(){ :; }
    tail(){ printf "LOGPATH=%s\n" "$2"; command tail "$@"; }
    apply_pending
    printf "PROBE_RC=%s\n" "$?"
  ' "$CHILD" "$lib" 2>&1
}

# probe_update_apply <lib> <child-exit> <sandbox-tmpdir>
# apply_update is stubbed to succeed (the pull is not the subject) and one component is
# reported active, which is what makes update_apply reach its re-install pass.
probe_update_apply() {
  local lib="$1" childrc="$2" td="$3"
  make_child "$childrc" || return 2
  mkdir -p "$td" || return 2
  env TMPDIR="$td" bash -c '
    source "$1" || exit 90
    apply_update(){ return 0; }
    KEYS=(foo)
    detect_component(){ echo active; }
    tail(){ printf "LOGPATH=%s\n" "$2"; command tail "$@"; }
    update_apply
    printf "PROBE_RC=%s\n" "$?"
  ' "$CHILD" "$lib" 2>&1
}

# count_files <dir> - regular files AND symlinks AND anything else, one per line.
count_files() { find "$1" -mindepth 1 2>/dev/null | wc -l | tr -d ' '; }

# logpath_of <probe-output> - the path the function actually used, or empty.
logpath_of() { printf '%s\n' "$1" | sed -n 's/^LOGPATH=//p' | head -1; }

# assert_log_landed_in_sandbox <row> <probe-output> <sandbox> <expected-name-prefix>
# THE GATE EVERY LEAK ROW SITS BEHIND. If the log was not created inside the directory the
# leak row counts, that row is measuring an empty directory the code never touched and its
# green is an artifact of looking in the wrong place.
assert_log_landed_in_sandbox() {
  local row="$1" out="$2" td="$3" prefix="$4" p
  p="$(logpath_of "$out")"
  case "$p" in
    "$td/$prefix"*) ok "$row" ;;
    "") bad "$row" "no log path was reported - the function never reached its tail, so the leak row below is vacuous" ;;
    *)  bad "$row" "the log was created at $p, OUTSIDE the sandbox $td - the leak row below counts a directory the log never entered" ;;
  esac
}

# assert_no_leak <row> <probe-output> <sandbox>
# Two independent checks, because either alone can be satisfied by the wrong thing: the
# named file must be gone (a count cannot see a file outside the sandbox) and the sandbox
# must be empty (a stale path string cannot fake an empty directory).
assert_no_leak() {
  local row="$1" out="$2" td="$3" p n
  p="$(logpath_of "$out")"
  n="$(count_files "$td")"
  if [ -n "$p" ] && [ -e "$p" ]; then
    bad "$row" "the log named by the failure message still exists at $p"
  elif [ "$n" != "0" ]; then
    bad "$row" "$n file(s) left in the sandbox TMPDIR: $(find "$td" -mindepth 1 2>/dev/null | tr '\n' ' ')"
  else
    ok "$row"
  fi
}

# ============================================================
# 1. The subject: the real browser-lib.sh
# ============================================================
echo "-- apply_pending --"

TD1="$TMPROOT/td_ap_fail"
OUT1="$(probe_apply_pending "$LIB" 7 "$TD1")" || true
# ANCHOR FIRST. Three things must be true before the file count means anything: the child
# actually ran (its own stdout is in the captured log tail), the failure branch was the
# branch taken (its message, with the child's code), and the function returned that code.
if printf '%s\n' "$OUT1" | grep -Fq 'apply_pending: install pass FAILED (exit 7) for --only foo' \
   && printf '%s\n' "$OUT1" | grep -Fq 'fake installer stdout: --only foo --yes' \
   && printf '%s\n' "$OUT1" | grep -Fq 'PROBE_RC=7'; then
  ok "apply_pending: the install-failure branch actually ran"
else
  bad "apply_pending: the install-failure branch actually ran" \
      "the leak row below would be vacuous. Output: $(printf '%s' "$OUT1" | head -4 | tr '\n' '|')"
fi
assert_log_landed_in_sandbox \
  "apply_pending: the log is created inside TMPDIR under an attributable name" \
  "$OUT1" "$TD1" "improv-apply-pending-"
assert_no_leak "apply_pending: a failed install pass leaves no temp file behind" "$OUT1" "$TD1"

# The success control. The cleanup must not have become "delete on failure only" in the
# other direction, and a run that never reached the branch would also leave zero files -
# so this row anchors on the return code AND on the child having run.
TD2="$TMPROOT/td_ap_ok"
OUT2="$(probe_apply_pending "$LIB" 0 "$TD2")" || true
AP_OK_RAN=0; child_ran && AP_OK_RAN=1
# THE MARKER IS THE ANCHOR HERE. `PROBE_RC=0` alone is printed just as happily by an
# apply_pending that skipped the install branch, and an empty temp dir is exactly what that
# would leave, so both rows below would certify a layer that no longer runs the installer.
if [ "$AP_OK_RAN" = 1 ] && printf '%s\n' "$OUT2" | grep -Fq 'PROBE_RC=0'; then
  ok "apply_pending: a successful install pass runs the child and returns 0"
else
  bad "apply_pending: a successful install pass runs the child and returns 0" \
      "child_ran=$AP_OK_RAN; output: $(printf '%s' "$OUT2" | head -4 | tr '\n' '|')"
fi
n="$(count_files "$TD2")"
if [ "$AP_OK_RAN" = 1 ] && [ "$n" = "0" ]; then
  ok "apply_pending: a successful install pass leaves no temp file behind"
else
  bad "apply_pending: a successful install pass leaves no temp file behind" \
      "child_ran=$AP_OK_RAN, $n file(s) left"
fi

# An unwritable TMPDIR must be reported as an ENVIRONMENT failure with nothing attempted,
# not misdiagnosed as a failing component. The child is set to exit 0 on purpose: if the
# guard were missing and the pass ran anyway, the redirection error would surface as some
# other code, so a return of 4 cannot be produced by the child.
TD4="$TMPROOT/td_ap_ro"
mkdir -p "$TD4" && chmod 500 "$TD4" || { echo "HARNESS: could not make an unwritable TMPDIR" >&2; exit 2; }
OUT4="$(probe_apply_pending "$LIB" 0 "$TD4")" || true
chmod 700 "$TD4" 2>/dev/null || true
# "nothing attempted" is asserted with the MARKER, not with the absence of the child's
# stdout: on this path there is no log to capture stdout into, so its absence proves
# nothing about whether the child ran.
if printf '%s\n' "$OUT4" | grep -Fq 'PROBE_RC=4' \
   && printf '%s\n' "$OUT4" | grep -Fq 'could not create the install log' \
   && ! child_ran; then
  ok "apply_pending: an unwritable TMPDIR returns 4 with nothing attempted"
else
  bad "apply_pending: an unwritable TMPDIR returns 4 with nothing attempted" \
      "Output: $(printf '%s' "$OUT4" | head -4 | tr '\n' '|')"
fi

# ============================================================
# 2. update_apply - the same contract on the other function
# ============================================================
echo "-- update_apply --"

TD5="$TMPROOT/td_ua_fail"
OUT5="$(probe_update_apply "$LIB" 7 "$TD5")" || true
if printf '%s\n' "$OUT5" | grep -Fq 'update_apply: pull SUCCEEDED but the re-install FAILED (exit 7) for --only foo' \
   && printf '%s\n' "$OUT5" | grep -Fq 'fake installer stdout: --only foo --yes' \
   && printf '%s\n' "$OUT5" | grep -Fq 'PROBE_RC=3'; then
  ok "update_apply: the re-install-failure branch actually ran"
else
  bad "update_apply: the re-install-failure branch actually ran" \
      "the leak row below would be vacuous. Output: $(printf '%s' "$OUT5" | head -4 | tr '\n' '|')"
fi
assert_log_landed_in_sandbox \
  "update_apply: the log is created inside TMPDIR under an attributable name" \
  "$OUT5" "$TD5" "improv-update-apply-"
assert_no_leak "update_apply: a failed re-install leaves no temp file behind" "$OUT5" "$TD5"

TD6="$TMPROOT/td_ua_ok"
OUT6="$(probe_update_apply "$LIB" 0 "$TD6")" || true
UA_OK_RAN=0; child_ran && UA_OK_RAN=1
# Same reasoning as apply_pending's success control: update_apply returns 0 both when the
# re-install succeeded and when there was nothing active to re-install, and only the marker
# tells those two apart.
if [ "$UA_OK_RAN" = 1 ] && printf '%s\n' "$OUT6" | grep -Fq 'PROBE_RC=0'; then
  ok "update_apply: a successful re-install runs the child and returns 0"
else
  bad "update_apply: a successful re-install runs the child and returns 0" \
      "child_ran=$UA_OK_RAN; output: $(printf '%s' "$OUT6" | head -4 | tr '\n' '|')"
fi
n="$(count_files "$TD6")"
if [ "$UA_OK_RAN" = 1 ] && [ "$n" = "0" ]; then
  ok "update_apply: a successful re-install leaves no temp file behind"
else
  bad "update_apply: a successful re-install leaves no temp file behind" \
      "child_ran=$UA_OK_RAN, $n file(s) left"
fi

TD7="$TMPROOT/td_ua_ro"
mkdir -p "$TD7" && chmod 500 "$TD7" || { echo "HARNESS: could not make an unwritable TMPDIR" >&2; exit 2; }
OUT7="$(probe_update_apply "$LIB" 0 "$TD7")" || true
chmod 700 "$TD7" 2>/dev/null || true
# 3, not a new code: the pull already happened, so the machine is in exactly the state 3
# describes. The message is what distinguishes the two ways of getting there.
if printf '%s\n' "$OUT7" | grep -Fq 'PROBE_RC=3' \
   && printf '%s\n' "$OUT7" | grep -Fq 'the install log could not be created' \
   && ! child_ran; then
  ok "update_apply: an unwritable TMPDIR returns 3 with the re-install not attempted"
else
  bad "update_apply: an unwritable TMPDIR returns 3 with the re-install not attempted" \
      "Output: $(printf '%s' "$OUT7" | head -4 | tr '\n' '|')"
fi

# ============================================================
# 3. MUTATION CONTROL - a probe that cannot see a leak proves nothing
# ============================================================
# Each mutant deletes exactly one failure-path `rm -f "$logfile"` from a COPY of the lib.
# The corresponding leak row must then report a leak. If it still reports clean, the row
# above is watching a path nothing travels and every green in section 1 or 2 is worthless.
echo "-- mutation control --"

MUT_DIR="$TMPROOT/mutants"; mkdir -p "$MUT_DIR" || { echo "HARNESS: mkdir mutants failed" >&2; exit 2; }

# mutate <out> <awk-program> - copy the lib through awk, and REFUSE to continue unless the
# copy actually differs. A mutation that silently applied nothing turns this whole section
# into four rows that pass against an unmutated file.
mutate() {
  local out="$1" prog="$2"
  awk "$prog" "$LIB" > "$out" || return 2
  if cmp -s "$LIB" "$out"; then
    echo "HARNESS: mutation produced an identical file - the anchor it edits is gone from browser-lib.sh" >&2
    return 2
  fi
  return 0
}

# The two failure-path deletes are the only `rm -f "$logfile"` lines that sit AFTER a
# `tail -20` line, so the mutants are keyed off that ordering rather than off a line
# number that drifts with every edit above them.
MUT_AP="$MUT_DIR/lib-noclean-apply-pending.sh"
mutate "$MUT_AP" '
  /^[[:space:]]*tail -20 "\$logfile" >&2$/ { seen_tail=1; print; next }
  seen_tail == 1 && /^[[:space:]]*rm -f "\$logfile"$/ && drop_ap == 0 { drop_ap=1; seen_tail=0; next }
  { print }
' || exit 2

MUT_UA="$MUT_DIR/lib-noclean-update-apply.sh"
mutate "$MUT_UA" '
  /^[[:space:]]*tail -20 "\$logfile" >&2$/ { n_tail++; print; next }
  n_tail == 2 && /^[[:space:]]*rm -f "\$logfile"$/ && drop == 0 { drop=1; next }
  { print }
' || exit 2

TD8="$TMPROOT/td_mut_ap"
OUT8="$(probe_apply_pending "$MUT_AP" 7 "$TD8")" || true
# THE MUTANT'S ANCHOR IS CHECKED BEFORE ITS RESULT IS BELIEVED. A mutant that never
# reached the failure branch also leaves nothing behind, and reading that as NOT CAUGHT
# would blame the assertion for a probe that did not run.
MP8="$(logpath_of "$OUT8")"
if printf '%s\n' "$OUT8" | grep -Fq 'PROBE_RC=7' && [ -n "$MP8" ]; then
  if [ -e "$MP8" ] || [ "$(count_files "$TD8")" != "0" ]; then
    ok "mutation: deleting apply_pending's failure-path cleanup is CAUGHT"
  else
    bad "mutation: deleting apply_pending's failure-path cleanup is CAUGHT" \
        "NOT CAUGHT - the leak row cannot detect a leak, so its green means nothing"
  fi
else
  bad "mutation: deleting apply_pending's failure-path cleanup is CAUGHT" \
      "the mutant did not reach the failure branch, so the mutation was never exercised"
fi

TD9="$TMPROOT/td_mut_ua"
OUT9="$(probe_update_apply "$MUT_UA" 7 "$TD9")" || true
MP9="$(logpath_of "$OUT9")"
if printf '%s\n' "$OUT9" | grep -Fq 'PROBE_RC=3' && [ -n "$MP9" ]; then
  if [ -e "$MP9" ] || [ "$(count_files "$TD9")" != "0" ]; then
    ok "mutation: deleting update_apply's failure-path cleanup is CAUGHT"
  else
    bad "mutation: deleting update_apply's failure-path cleanup is CAUGHT" \
        "NOT CAUGHT - the leak row cannot detect a leak, so its green means nothing"
  fi
else
  bad "mutation: deleting update_apply's failure-path cleanup is CAUGHT" \
      "the mutant did not reach the failure branch, so the mutation was never exercised"
fi

echo ""
printf 'installer-tempfile-hygiene: %s passed, %s failed\n' "$PASS" "$FAIL"
if [ "$FAIL" -ne 0 ]; then
  echo "FAIL: the apply layer leaves temp files behind"
  exit 1
fi
echo "PASS: the apply layer cleans up its temp logs on every path"
exit 0
