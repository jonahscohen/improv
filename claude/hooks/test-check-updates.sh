#!/bin/bash
# test-check-updates.sh - REAL-REPO contract tests for install.sh's check_updates().
#
# WHY THIS FILE EXISTS
# The bucket browser's update row is a three-way classification, and update_status can
# only drive it from check_updates' EXIT CODE plus its output:
#
#   exit 1             -> cd, fetch, or git log failed  -> row shows "unknown"
#   exit 0 + output    -> commits available (newest first, max 10) -> row shows "available"
#   exit 0 + no output -> up to date -> row shows "up-to-date"
#
# The unit tests (test-component-browser.sh) STUB check_updates, so they cover the browser's
# logic on top of the contract but CANNOT reach the contract itself - every bug this file
# guards lives in the real git interaction, invisible to a stub. Both bugs it covers were
# real and both shipped:
#   1. check_updates ended on `[ -n "$commits" ] &&`, so up-to-date returned 1 - identical
#      to a failed cd/fetch. Fixed with an explicit `return 0`.
#   2. A `git log ... | head -10` pipe can return 141 under `pipefail` (head exits at 10
#      lines; git log takes SIGPIPE on its next write). Harmless while nothing read the
#      status - and a REGRESSION the instant `|| return 1` was added to fix a git-log
#      failure being misread as up-to-date. `--max-count=10` removes the pipe, which is
#      what lets `|| return 1` mean "git log genuinely failed".
# Those two are a PRECONDITION PAIR, which is why this file tests them together.
#
# THE SIGPIPE TRIGGER IS OUTPUT SIZE, NOT COMMIT COUNT. This was assumed to be "more than
# 10 commits" and that is WRONG - measured here: 15 commits (215B) -> rc 0, 65 commits
# (10KB) -> rc 0, 165 commits (91KB) -> rc 141. git log must still be WRITING when head
# exits, so any backlog whose subjects fit the pipe buffer (~64KB) completes and exits 0.
# The tests below encode BOTH facts, because a "control" run against 15 commits passes
# against the broken code and proves nothing - which is exactly what it did on first run.
#
# HOW IT WORKS
# The function is EXTRACTED VERBATIM from install.sh rather than copied here, so these
# tests track the real source: a rewrite that breaks the contract fails loudly instead of
# passing against a stale duplicate. It is driven under `set -euo pipefail` - install.sh's
# real strict mode - against throwaway git repos.
#
# The NEGATIVE CONTROLS ARE PERMANENT, not authoring-time scaffolding: this file derives
# the two broken variants from the real source and asserts they MISBEHAVE. A control that
# ran once while the code was written is a control nobody has; these re-run every time and
# will catch a future "cleanup" that reintroduces either bug. If a mutant ever passes, the
# corresponding real assertion has stopped proving anything.
#
# Exit codes:
#   0  all scenarios passed
#   1  one or more assertions failed
#   2  harness/setup error (install.sh missing, extraction failed, git unusable)

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_ROOT/install.sh"
LIB="$REPO_ROOT/claude/hooks/browser-lib.sh"

PASS=0
FAIL=0
pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
setup_fail() { echo "SETUP-FAIL: $1"; exit 2; }

[ -f "$INSTALL" ] || setup_fail "install.sh not found at $INSTALL"
[ -f "$LIB" ]     || setup_fail "browser-lib.sh not found at $LIB"
command -v git >/dev/null 2>&1 || setup_fail "git required"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Fully isolated git: no system/global config, no user identity, no hooks, no templates.
# A developer's ~/.gitconfig must not be able to change what these tests observe.
export GIT_CONFIG_NOSYSTEM=1
export HOME="$WORK/home"
mkdir -p "$HOME"
unset GIT_DIR GIT_WORK_TREE 2>/dev/null || true

# ---------------------------------------------------------------------------
# Extract the REAL check_updates from install.sh, plus the two broken variants.
# ---------------------------------------------------------------------------
REAL="$WORK/cu_real.sh"
sed -n '/^check_updates()/,/^}/p' "$INSTALL" > "$REAL"
[ -s "$REAL" ] || setup_fail "could not extract check_updates() from install.sh"
grep -q '^check_updates()' "$REAL" || setup_fail "extraction did not capture the function header"
grep -q '^}' "$REAL" || setup_fail "extraction did not capture the function terminator"

# MUTANT 1 - the SIGPIPE-fragile pipe restored, with the `|| return 1` guard still on.
# This is the exact half-fix the coupling argument warns about: correct-looking, and it
# reports "unknown" for any repo whose incoming subjects overflow the pipe buffer.
MUT_PIPE="$WORK/cu_mut_pipe.sh"
sed "/^  commits=/s#--max-count=10 --pretty=format:'%s' 2>/dev/null#--pretty=format:'%s' 2>/dev/null | head -10#" "$REAL" > "$MUT_PIPE"
grep -q 'head -10' "$MUT_PIPE" || setup_fail "MUT_PIPE mutation did not apply (real source changed shape?)"

# MUTANT 2 - the `|| return 1` guard dropped. A failing git log then yields empty output
# and exit 0, which the row reads as "up to date".
MUT_NOGUARD="$WORK/cu_mut_noguard.sh"
sed "/^  commits=/s/ || return 1//" "$REAL" > "$MUT_NOGUARD"
grep -q 'commits=.*|| return 1' "$MUT_NOGUARD" && setup_fail "MUT_NOGUARD mutation did not apply"

# ---------------------------------------------------------------------------
# Drivers. Both run under `set -euo pipefail` - install.sh's real strict mode.
# ---------------------------------------------------------------------------
cat > "$WORK/drive_cu.sh" <<'DRIVER'
#!/bin/bash
# $1 = file defining check_updates, $2 = REPO_DIR. Prints "RC=<n>" then the raw output.
set -euo pipefail
# shellcheck source=/dev/null
source "$1"
REPO_DIR="$2"
if out="$(check_updates)"; then rc=0; else rc=$?; fi
printf 'RC=%s\n' "$rc"
printf '%s' "$out"
DRIVER

cat > "$WORK/drive_status.sh" <<'DRIVER'
#!/bin/bash
# $1 = file defining check_updates, $2 = browser-lib.sh, $3 = REPO_DIR.
# Prints update_status' real output, driven by the REAL check_updates (no stubs anywhere).
set -euo pipefail
# shellcheck source=/dev/null
source "$1"
# shellcheck source=/dev/null
source "$2"
REPO_DIR="$3"
update_status
DRIVER

cu_rc()  { /bin/bash "$WORK/drive_cu.sh" "$1" "$2" 2>/dev/null | sed -n '1s/^RC=//p'; }
cu_out() { /bin/bash "$WORK/drive_cu.sh" "$1" "$2" 2>/dev/null | sed '1d'; }
status_of() { /bin/bash "$WORK/drive_status.sh" "$REAL" "$LIB" "$1" 2>/dev/null; }

# ---------------------------------------------------------------------------
# Repo builders.
# ---------------------------------------------------------------------------
# `-c init.defaultBranch=main` on BOTH the bare and the work tree is load-bearing: a bare
# repo whose HEAD points at refs/heads/master while `main` is what gets pushed produces a
# clone with an UNBORN HEAD, and then `git log HEAD..origin/main` fails with 128 for a
# reason that has nothing to do with the code under test - a false green (or false red)
# caused entirely by harness setup.
new_bare() { git -c init.defaultBranch=main init -q --bare "$1"; }
new_clone() {
  git clone -q "$1" "$2" 2>/dev/null || return 1
  git -C "$2" config user.email t@t.local
  git -C "$2" config user.name tester
}
commit_n() { # $1=repo $2=count $3=prefix - N commits pushed to origin/main
  local repo="$1" n="$2" prefix="$3" i
  for i in $(seq 1 "$n"); do
    echo "$prefix$i" >> "$repo/f"
    git -C "$repo" add f
    git -C "$repo" commit -qm "$prefix$i" >/dev/null 2>&1 || return 1
  done
  git -C "$repo" push -q origin main 2>/dev/null || return 1
}

# origin with one base commit, plus a "work" clone used to push new commits upstream.
new_bare "$WORK/bare"
git -c init.defaultBranch=main init -q "$WORK/work"
git -C "$WORK/work" config user.email t@t.local
git -C "$WORK/work" config user.name tester
echo base > "$WORK/work/f"
git -C "$WORK/work" add f
git -C "$WORK/work" commit -qm "base" >/dev/null 2>&1 || setup_fail "base commit failed"
git -C "$WORK/work" remote add origin "$WORK/bare"
git -C "$WORK/work" push -q -u origin main 2>/dev/null || setup_fail "base push failed"

# UP = the repo under test, cloned at base (so it goes behind as work pushes).
new_clone "$WORK/bare" "$WORK/up" || setup_fail "clone failed"
git -C "$WORK/up" rev-parse --verify -q refs/remotes/origin/main >/dev/null \
  || setup_fail "clone has no origin/main - harness default-branch setup is broken"

echo "== check_updates real-repo contract =="

# --- Scenario 3a: up to date -----------------------------------------------
echo "-- up to date (exit 0 + empty -> up-to-date)"
rc="$(cu_rc "$REAL" "$WORK/up")"; out="$(cu_out "$REAL" "$WORK/up")"
[ "$rc" = "0" ] && pass "up-to-date exits 0" || fail "up-to-date exits 0 (got $rc)"
[ -z "$out" ] && pass "up-to-date prints nothing" || fail "up-to-date prints nothing (got '$out')"
[ "$(status_of "$WORK/up")" = "up-to-date" ] && pass "update_status reports up-to-date" \
  || fail "update_status reports up-to-date (got '$(status_of "$WORK/up")')"

# --- Scenario 3b: N <= 10 incoming commits ---------------------------------
echo "-- 3 incoming commits (exit 0 + N subjects -> available)"
commit_n "$WORK/work" 3 "small change " || setup_fail "could not push 3 commits"
rc="$(cu_rc "$REAL" "$WORK/up")"; out="$(cu_out "$REAL" "$WORK/up")"
[ "$rc" = "0" ] && pass "N<=10 exits 0" || fail "N<=10 exits 0 (got $rc)"
[ "$(printf '%s\n' "$out" | grep -c .)" = "3" ] && pass "N<=10 prints exactly 3 subjects" \
  || fail "N<=10 prints exactly 3 subjects (got $(printf '%s\n' "$out" | grep -c .))"
[ "$(printf '%s\n' "$out" | sed -n 1p)" = "small change 3" ] \
  && pass "N<=10 newest subject first" || fail "N<=10 newest subject first (got '$(printf '%s\n' "$out" | sed -n 1p)')"
[ "$(status_of "$WORK/up" | sed -n 1p)" = "available" ] && pass "update_status reports available" \
  || fail "update_status reports available (got '$(status_of "$WORK/up" | sed -n 1p)')"

# --- Scenario 1a: MORE than 10 incoming commits (the CAP) ------------------
# 3 already pushed + 12 more = 15 incoming, comfortably over the cap. This proves the
# 10-subject cap and ordering. It is NOT the SIGPIPE case - see 1b for that.
echo "-- 15 incoming commits (the cap: exit 0 + exactly 10 subjects)"
commit_n "$WORK/work" 12 "bulk change " || setup_fail "could not push 12 more commits"
rc="$(cu_rc "$REAL" "$WORK/up")"; out="$(cu_out "$REAL" "$WORK/up")"
[ "$rc" = "0" ] && pass ">10 commits exits 0" || fail ">10 commits exits 0 (got $rc)"
[ "$(printf '%s\n' "$out" | grep -c .)" = "10" ] && pass ">10 commits capped at exactly 10 subjects" \
  || fail ">10 commits capped at exactly 10 subjects (got $(printf '%s\n' "$out" | grep -c .))"
[ "$(printf '%s\n' "$out" | sed -n 1p)" = "bulk change 12" ] \
  && pass ">10 commits newest subject first" || fail ">10 commits newest subject first (got '$(printf '%s\n' "$out" | sed -n 1p)')"
[ "$(status_of "$WORK/up" | sed -n 1p)" = "available" ] && pass ">10 commits -> update_status available" \
  || fail ">10 commits -> update_status available (got '$(status_of "$WORK/up" | sed -n 1p)')"

# The old pipe does NOT fail here, and that is worth stating explicitly rather than
# leaving as a silent gap: SIGPIPE needs git log to still be WRITING when head exits.
# 15 short subjects (~215 bytes) fit entirely in the pipe buffer, so git log finishes and
# exits 0 before head ever closes the pipe. Measured: 15 commits -> rc=0, 65 commits
# (10KB) -> rc=0, 165 commits (91KB) -> rc=141. The trigger is OUTPUT SIZE crossing the
# pipe buffer (~64KB), NOT the commit count.
rc_mut="$(cu_rc "$MUT_PIPE" "$WORK/up")"
[ "$rc_mut" = "0" ] && pass "old pipe still returns 0 at 15 commits (output fits the pipe buffer - documents the REAL trigger)" \
  || fail "old pipe still returns 0 at 15 commits (got $rc_mut) - the pipe-buffer premise has changed; re-derive the SIGPIPE threshold"

# --- Scenario 1b: a LARGE backlog - where the pipe genuinely breaks --------
# This is the scenario that makes `--max-count=10` load-bearing instead of cosmetic, and
# the negative control that actually fires. Output must exceed the pipe buffer, so this
# uses few commits with LONG subjects (60 x ~4000 chars = ~240KB) rather than the ~165
# ordinary commits it would otherwise take - same physics, a fraction of the runtime.
#
# Note the failure this guards is NONDETERMINISTIC in the field: whether a given user's
# repo trips it depends on total subject bytes vs their pipe buffer. A bug that appears
# only for sufficiently-behind repos is strictly worse than one that always fires, because
# the most out-of-date installs - the ones that most need the update row to work - are
# exactly the ones that would have been told "unknown".
echo "-- large backlog: output exceeds the pipe buffer (the real SIGPIPE trigger)"
LONG="$(printf 'x%.0s' $(seq 1 4000))"
for i in $(seq 1 60); do
  echo "big$i" >> "$WORK/work/f"
  git -C "$WORK/work" add f
  git -C "$WORK/work" commit -qm "big change $i $LONG" >/dev/null 2>&1 || setup_fail "long-subject commit failed"
done
git -C "$WORK/work" push -q origin main 2>/dev/null || setup_fail "long-subject push failed"

# Confirm the premise before trusting the control. Precise conditions for SIGPIPE here,
# BOTH required: (1) more than 10 lines, so head exits early at all, and (2) enough bytes
# still unwritten AFTER head exits (and after any over-read) to overflow the pipe and make
# git log's next write fault. 240KB against a macOS pipe buffer (16KB, growable to 64KB) is
# a wide margin, not a guarantee for every platform - so this is a documented margin rather
# than a claim of universal determinism. The control below ASSERTS the mutant returns 1, so
# if the margin ever stops being enough this file goes RED and says so, instead of passing
# vacuously the way the 15-commit control did.
git -C "$WORK/up" fetch -q origin main 2>/dev/null || setup_fail "fetch for large-backlog case failed"
_bytes="$(git -C "$WORK/up" log HEAD..origin/main --pretty=format:'%s' 2>/dev/null | wc -c | tr -d ' ')"
_lines="$(git -C "$WORK/up" log HEAD..origin/main --pretty=format:'%s' 2>/dev/null | grep -c .)"
if [ "$_bytes" -gt 131072 ] && [ "$_lines" -gt 10 ]; then
  pass "large-backlog premise holds: ${_lines} lines / ${_bytes} bytes (>10 lines AND >128KB unwritten - both SIGPIPE conditions)"
else
  fail "large-backlog premise broken: ${_lines} lines / ${_bytes} bytes - needs >10 lines AND enough bytes to overflow the pipe, this scenario proves nothing"
fi

rc="$(cu_rc "$REAL" "$WORK/up")"; out="$(cu_out "$REAL" "$WORK/up")"
[ "$rc" = "0" ] && pass "large backlog: real code exits 0 (--max-count=10 never touches a pipe)" \
  || fail "large backlog: real code exits 0 (got $rc)"
[ "$(printf '%s\n' "$out" | grep -c .)" = "10" ] && pass "large backlog: still capped at exactly 10 subjects" \
  || fail "large backlog: still capped at exactly 10 subjects (got $(printf '%s\n' "$out" | grep -c .))"
[ "$(status_of "$WORK/up" | sed -n 1p)" = "available" ] && pass "large backlog -> update_status available" \
  || fail "large backlog -> update_status available (got '$(status_of "$WORK/up" | sed -n 1p)')"

# THE control: with the pipe restored, this same repo returns 141 -> `|| return 1` turns
# it into exit 1 -> the row would say "unknown" while updates ARE available.
rc_mut="$(cu_rc "$MUT_PIPE" "$WORK/up")"
[ "$rc_mut" = "1" ] && pass "NEG-CONTROL: '| head -10' + '|| return 1' returns 1 on a large backlog (SIGPIPE 141 -> false 'unknown')" \
  || fail "NEG-CONTROL: '| head -10' + '|| return 1' should return 1 on a large backlog, got $rc_mut - the SIGPIPE control is not controlling"

# And end-to-end: the half-fixed variant misreports the row as unknown.
_mut_status="$(/bin/bash "$WORK/drive_status.sh" "$MUT_PIPE" "$LIB" "$WORK/up" 2>/dev/null)"
[ "$_mut_status" = "unknown" ] && pass "NEG-CONTROL: half-fixed variant makes update_status say 'unknown' despite available updates" \
  || fail "NEG-CONTROL: half-fixed variant should say 'unknown', got '$_mut_status'"

# --- Parity: the REAL function's output matches what the old pipe produced --
# The cap and ordering must not have changed - only the exit status should differ.
#
# This compares check_updates' ACTUAL output to the old pipe's, not two standalone git
# commands: a version of this that ran `git log --max-count=10` against `git log | head -10`
# directly would prove only that git agrees with itself, and would stay green against a
# check_updates that mangled, reordered, or dropped subjects on its way out. Every line is
# compared, not just the count and the first subject.
pipe_out="$(git -C "$WORK/up" log HEAD..origin/main --pretty=format:'%s' 2>/dev/null | head -10)"
real_out="$(cu_out "$REAL" "$WORK/up")"
[ "$real_out" = "$pipe_out" ] && pass "check_updates output byte-identical to the old '| head -10' output (cap + ordering preserved)" \
  || fail "check_updates output byte-identical to the old '| head -10' output (cap + ordering preserved)"

# --- Scenario 2: fetch succeeds but git log FAILS --------------------------
# An unborn HEAD (a repo with a remote but no commits of its own): `git fetch origin main`
# succeeds, then `git log HEAD..origin/main` cannot resolve HEAD and exits non-zero. That
# is precisely "fetch worked, log failed" - the state the row must call unknown, never
# up-to-date.
echo "-- fetch OK but git log fails (exit 1 -> unknown)"
git -c init.defaultBranch=main init -q "$WORK/unborn"
git -C "$WORK/unborn" config user.email t@t.local
git -C "$WORK/unborn" config user.name tester
git -C "$WORK/unborn" remote add origin "$WORK/bare"
git -C "$WORK/unborn" fetch origin main >/dev/null 2>&1 || setup_fail "fetch into unborn repo failed - scenario 2 needs fetch to SUCCEED"
git -C "$WORK/unborn" log HEAD..origin/main --max-count=10 >/dev/null 2>&1 \
  && setup_fail "git log unexpectedly SUCCEEDED in the unborn repo - scenario 2 no longer reproduces a log failure"
rc="$(cu_rc "$REAL" "$WORK/unborn")"
[ "$rc" = "1" ] && pass "git-log failure exits 1" || fail "git-log failure exits 1 (got $rc)"
[ "$(status_of "$WORK/unborn")" = "unknown" ] && pass "git-log failure -> update_status unknown" \
  || fail "git-log failure -> update_status unknown (got '$(status_of "$WORK/unborn")')"

# NEGATIVE CONTROL for scenario 2: without `|| return 1`, the same repo is misreported as
# up-to-date - the exact bug, demonstrated rather than asserted.
rc_mut="$(cu_rc "$MUT_NOGUARD" "$WORK/unborn")"
out_mut="$(cu_out "$MUT_NOGUARD" "$WORK/unborn")"
if [ "$rc_mut" = "0" ] && [ -z "$out_mut" ]; then
  pass "NEG-CONTROL: without '|| return 1' a git-log failure is misread as up-to-date (exit 0, empty)"
else
  fail "NEG-CONTROL: without '|| return 1' expected the up-to-date misread (exit 0 + empty), got rc=$rc_mut out='$out_mut' - the guard control is not controlling"
fi

# --- Scenario 3c: bad REPO_DIR / fetch failure -----------------------------
echo "-- bad REPO_DIR and fetch failure (exit 1 -> unknown)"
rc="$(cu_rc "$REAL" "$WORK/nonexistent-dir-xyz")"
[ "$rc" = "1" ] && pass "bad REPO_DIR exits 1" || fail "bad REPO_DIR exits 1 (got $rc)"
[ "$(status_of "$WORK/nonexistent-dir-xyz")" = "unknown" ] && pass "bad REPO_DIR -> update_status unknown" \
  || fail "bad REPO_DIR -> update_status unknown (got '$(status_of "$WORK/nonexistent-dir-xyz")')"

# A real repo whose remote is gone: cd succeeds, fetch fails.
new_clone "$WORK/bare" "$WORK/noremote" || setup_fail "clone for fetch-failure case failed"
git -C "$WORK/noremote" remote set-url origin "$WORK/vanished-remote"
rc="$(cu_rc "$REAL" "$WORK/noremote")"
[ "$rc" = "1" ] && pass "fetch failure exits 1" || fail "fetch failure exits 1 (got $rc)"
[ "$(status_of "$WORK/noremote")" = "unknown" ] && pass "fetch failure -> update_status unknown" \
  || fail "fetch failure -> update_status unknown (got '$(status_of "$WORK/noremote")')"

echo
echo "TALLY: $PASS passed, $FAIL failed"
if [ "$FAIL" = 0 ]; then
  echo "ALL CHECK-UPDATES CONTRACT CHECKS PASSED"
  exit 0
fi
exit 1
