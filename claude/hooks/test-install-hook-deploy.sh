#!/bin/bash
# Regression tests for install.sh's HOOK DEPLOYMENT (link_or_copy).
#
# Run: bash ~/.claude/hooks/test-install-hook-deploy.sh
#
# The bug (2026-07-12): install.sh deployed hooks with safe_cp (`rm -f` then `cp`), so
# every hook landed as a real FILE pinned to whatever it was on the day it was copied.
# justify-source-guard.sh sat frozen at a pre-rename source path for a month, printing
# a directory that no longer existed, while its repo source was correct the whole time.
# Four siblings were frozen the same way. Worse, safe_cp deletes an existing SYMLINK
# and writes a copy over it, so re-running the installer on a dev machine would have
# clobbered all 81 live symlinks back into frozen copies in one shot.
#
# Fix: link_or_copy() SYMLINKS when running from a git checkout (a dev machine, where
# the link has something durable to point at and a git pull should reach the live hook)
# and COPIES when there is no checkout (a throwaway clone - a symlink would dangle).
#
# SAFETY: these tests NEVER touch the real ~/.claude. install.sh is sourced with
# IMPROV_INSTALL_LIB_ONLY=1, which defines the helpers and returns before the installer
# runs a single line. Sources and destinations are all mktemp -d directories. A test
# that actually ran the installer could destroy every live hook - which is the precise
# disaster this change exists to prevent.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
# Overridable so the suite can be pointed at a MUTATED installer to prove it goes red.
INSTALL_SH="${INSTALL_SH:-$REPO_ROOT/install.sh}"

[ -f "$INSTALL_SH" ] || { echo "cannot find install.sh at $INSTALL_SH"; exit 1; }

PASS=0
FAIL=0
FAIL_LABELS=()

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1  ($2)"; FAIL_LABELS+=("$1"); FAIL=$((FAIL + 1)); }

# Record the real hooks dir up front. Nothing here may change it.
REAL_HOOKS="$HOME/.claude/hooks"
REAL_BEFORE=""
[ -d "$REAL_HOOKS" ] && REAL_BEFORE=$(ls -l "$REAL_HOOKS" | awk '/^l/{l++} /^-/{f++} END{print "links="l" files="f}')

# Pull in link_or_copy / hook_deploy_mode WITHOUT running the installer.
IMPROV_INSTALL_LIB_ONLY=1
export IMPROV_INSTALL_LIB_ONLY
# shellcheck disable=SC1090
. "$INSTALL_SH"
unset IMPROV_INSTALL_LIB_ONLY
# install.sh runs under `set -euo pipefail`, and sourcing it leaves those flags ON in
# this shell. A test suite must be able to observe a failing case without dying on it.
set +euo pipefail

if ! declare -f link_or_copy >/dev/null 2>&1; then
  echo "FATAL: sourcing install.sh did not define link_or_copy"
  exit 1
fi

# --- fixtures -------------------------------------------------------------
# SRC_REPO simulates a DURABLE checked-out repo (has .git). SRC_BARE simulates an
# install with no checkout behind it (no .git). DEST is a throwaway ~/.claude/hooks.
#
# The source fixtures deliberately do NOT live in mktemp -d. hook_deploy_mode treats a
# repo sitting under /tmp or /var/folders as a throwaway clone and copies from it, so a
# mktemp fixture would exercise the TEMP rule and silently never test the .git rule -
# the tests would pass for the wrong reason. They live under the repo instead, which is
# what a real dev checkout looks like. (Caught when the temp rule landed and six
# symlink assertions went red: the fixtures were wrong, not the rule.)
FIXROOT="$REPO_ROOT/.test-fixtures-$$"
SRC_REPO="$FIXROOT/durable-repo"
SRC_BARE="$FIXROOT/no-checkout"
DEST=$(mktemp -d) || exit 1
cleanup() { chmod -R u+w "$FIXROOT" 2>/dev/null; rm -rf "$FIXROOT" "$DEST"; }
trap cleanup EXIT
mkdir -p "$FIXROOT" || exit 1

mkdir -p "$SRC_REPO/.git" "$SRC_REPO/claude/hooks" "$SRC_BARE/claude/hooks"
printf '#!/bin/bash\necho REPO_VERSION\n' > "$SRC_REPO/claude/hooks/demo.sh"
printf '#!/bin/bash\necho BARE_VERSION\n' > "$SRC_BARE/claude/hooks/demo.sh"
chmod +x "$SRC_REPO/claude/hooks/demo.sh" "$SRC_BARE/claude/hooks/demo.sh"

# link_or_copy reads REPO_DIR to decide symlink-vs-copy.
run_deploy() {  # $1 = src repo root, $2 = dest file
  REPO_DIR="$1" link_or_copy "$1/claude/hooks/demo.sh" "$2"
}

echo "===== path 1: repo PRESENT -> hooks are SYMLINKS into the repo ====="
D1="$DEST/d1.sh"
run_deploy "$SRC_REPO" "$D1"
if [ -L "$D1" ] && [ "$(readlink "$D1")" = "$SRC_REPO/claude/hooks/demo.sh" ]; then
  pass "repo present: deployed as a symlink into the repo"
else
  fail "repo present: deployed as a symlink into the repo" "not a symlink: $(ls -l "$D1" 2>&1)"
fi
# The link must actually WORK, not just exist.
if [ "$(bash "$D1" 2>/dev/null)" = "REPO_VERSION" ]; then
  pass "repo present: the symlinked hook executes"
else
  fail "repo present: the symlinked hook executes" "got: $(bash "$D1" 2>&1)"
fi
# The whole point: editing the SOURCE must reach the live hook with no re-install.
printf '#!/bin/bash\necho EDITED_IN_REPO\n' > "$SRC_REPO/claude/hooks/demo.sh"
if [ "$(bash "$D1" 2>/dev/null)" = "EDITED_IN_REPO" ]; then
  pass "repo present: a source edit reaches the live hook (no re-install)"
else
  fail "repo present: a source edit reaches the live hook (no re-install)" "got: $(bash "$D1" 2>&1)"
fi
printf '#!/bin/bash\necho REPO_VERSION\n' > "$SRC_REPO/claude/hooks/demo.sh"

echo ""
echo "===== path 1: re-running the installer is IDEMPOTENT ====="
# A correct symlink must be left ALONE - not deleted and recreated. This is the case
# that would have wiped all 81 live symlinks on a routine re-run.
BEFORE_INO=$(ls -li "$D1" | awk '{print $1}')
run_deploy "$SRC_REPO" "$D1"
run_deploy "$SRC_REPO" "$D1"
AFTER_INO=$(ls -li "$D1" | awk '{print $1}')
if [ -L "$D1" ] && [ "$(readlink "$D1")" = "$SRC_REPO/claude/hooks/demo.sh" ]; then
  pass "re-run: still a correct symlink"
else
  fail "re-run: still a correct symlink" "$(ls -l "$D1" 2>&1)"
fi
if [ "$BEFORE_INO" = "$AFTER_INO" ]; then
  pass "re-run: the existing symlink was not even recreated (untouched)"
else
  fail "re-run: the existing symlink was not even recreated (untouched)" "inode $BEFORE_INO -> $AFTER_INO"
fi

echo ""
echo "===== path 2: repo ABSENT -> hooks are real COPIES, nothing dangles ====="
D2="$DEST/d2.sh"
run_deploy "$SRC_BARE" "$D2"
if [ -f "$D2" ] && [ ! -L "$D2" ]; then
  pass "repo absent: deployed as a real file, not a symlink"
else
  fail "repo absent: deployed as a real file, not a symlink" "$(ls -l "$D2" 2>&1)"
fi
if [ "$(bash "$D2" 2>/dev/null)" = "BARE_VERSION" ]; then
  pass "repo absent: the copied hook executes"
else
  fail "repo absent: the copied hook executes" "got: $(bash "$D2" 2>&1)"
fi
if [ -x "$D2" ]; then
  pass "repo absent: the copy is executable"
else
  fail "repo absent: the copy is executable" "not +x"
fi
# The copy must survive the source disappearing - that is the entire reason to copy.
BARE_TMP=$(mktemp -d)
mv "$SRC_BARE/claude/hooks/demo.sh" "$BARE_TMP/demo.sh"
if [ "$(bash "$D2" 2>/dev/null)" = "BARE_VERSION" ]; then
  pass "repo absent: the hook still works after the source is deleted (no dangle)"
else
  fail "repo absent: the hook still works after the source is deleted (no dangle)" "got: $(bash "$D2" 2>&1)"
fi
mv "$BARE_TMP/demo.sh" "$SRC_BARE/claude/hooks/demo.sh"
rm -rf "$BARE_TMP"

echo ""
echo "===== conversions in both directions ====="
# A stale symlink, deployed in COPY mode, must become a real file (not stay dangling).
D3="$DEST/d3.sh"
ln -sfn /nonexistent/gone.sh "$D3"
run_deploy "$SRC_BARE" "$D3"
if [ -f "$D3" ] && [ ! -L "$D3" ] && [ "$(bash "$D3" 2>/dev/null)" = "BARE_VERSION" ]; then
  pass "copy mode replaces a DANGLING symlink with a working real file"
else
  fail "copy mode replaces a DANGLING symlink with a working real file" "$(ls -l "$D3" 2>&1)"
fi
# A frozen copy, deployed in SYMLINK mode, must be converted to a link. This is the
# migration that unfreezes the five hooks that were stuck at a stale path.
D4="$DEST/d4.sh"
printf '#!/bin/bash\necho FROZEN_STALE_COPY\n' > "$D4"
chmod +x "$D4"
run_deploy "$SRC_REPO" "$D4"
if [ -L "$D4" ] && [ "$(bash "$D4" 2>/dev/null)" = "REPO_VERSION" ]; then
  pass "symlink mode converts a FROZEN COPY into a link (unfreezes it)"
else
  fail "symlink mode converts a FROZEN COPY into a link (unfreezes it)" "$(ls -l "$D4" 2>&1)"
fi

echo ""
echo "===== the exec bit survives BOTH paths ====="
# settings.json runs every hook directly (~/.claude/hooks/x.sh), so a hook that is not
# executable is a hook that does not run. The old copy path chmod'd the destination,
# which silently rescued a source missing +x. A symlink inherits the SOURCE's mode, so
# that rescue has to happen on the source or the link deploys dead.
printf '#!/bin/bash\necho NOEXEC_SRC\n' > "$SRC_REPO/claude/hooks/noexec.sh"
chmod -x "$SRC_REPO/claude/hooks/noexec.sh"
D8="$DEST/d8.sh"
REPO_DIR="$SRC_REPO" link_or_copy "$SRC_REPO/claude/hooks/noexec.sh" "$D8"
if [ -L "$D8" ] && [ -x "$D8" ] && [ "$("$D8" 2>/dev/null)" = "NOEXEC_SRC" ]; then
  pass "symlink mode: a non-executable source is made runnable (link is not dead)"
else
  fail "symlink mode: a non-executable source is made runnable (link is not dead)" "$(ls -lL "$D8" 2>&1)"
fi
printf '#!/bin/bash\necho NOEXEC_SRC\n' > "$SRC_BARE/claude/hooks/noexec.sh"
chmod -x "$SRC_BARE/claude/hooks/noexec.sh"
D9="$DEST/d9.sh"
REPO_DIR="$SRC_BARE" link_or_copy "$SRC_BARE/claude/hooks/noexec.sh" "$D9"
if [ ! -L "$D9" ] && [ -x "$D9" ] && [ "$("$D9" 2>/dev/null)" = "NOEXEC_SRC" ]; then
  pass "copy mode: the copy is chmod +x even when the source was not"
else
  fail "copy mode: the copy is chmod +x even when the source was not" "$(ls -l "$D9" 2>&1)"
fi

echo ""
echo "===== the IMPROV_HOOK_DEPLOY override ====="
D5="$DEST/d5.sh"
IMPROV_HOOK_DEPLOY=copy REPO_DIR="$SRC_REPO" link_or_copy "$SRC_REPO/claude/hooks/demo.sh" "$D5"
if [ -f "$D5" ] && [ ! -L "$D5" ]; then
  pass "IMPROV_HOOK_DEPLOY=copy forces a copy even with a repo present"
else
  fail "IMPROV_HOOK_DEPLOY=copy forces a copy even with a repo present" "$(ls -l "$D5" 2>&1)"
fi
D6="$DEST/d6.sh"
IMPROV_HOOK_DEPLOY=symlink REPO_DIR="$SRC_BARE" link_or_copy "$SRC_BARE/claude/hooks/demo.sh" "$D6"
if [ -L "$D6" ]; then
  pass "IMPROV_HOOK_DEPLOY=symlink forces a link even with no repo"
else
  fail "IMPROV_HOOK_DEPLOY=symlink forces a link even with no repo" "$(ls -l "$D6" 2>&1)"
fi

echo ""
echo "===== the PRE-FIX installer really would have clobbered the links ====="
# Falsification of the change itself: prove safe_cp (what every hook call site used to
# do) destroys a correct symlink and freezes a copy over it. If this ever stops being
# true, the fix was solving a problem that did not exist.
D7="$DEST/d7.sh"
ln -sfn "$SRC_REPO/claude/hooks/demo.sh" "$D7"
[ -L "$D7" ] || { echo "fixture failed"; exit 1; }
safe_cp "$SRC_REPO/claude/hooks/demo.sh" "$D7"     # the OLD deployment call
if [ -f "$D7" ] && [ ! -L "$D7" ]; then
  pass "pre-fix safe_cp DOES clobber a symlink into a frozen copy (change is real)"
else
  fail "pre-fix safe_cp DOES clobber a symlink into a frozen copy (change is real)" "still a link"
fi

echo ""
echo "===== Codex review findings, 2026-07-12 ====="
# (1) A .git checkout is NOT proof of durability. `git clone /tmp/x && ./install.sh &&
#     rm -rf /tmp/x` has a .git, and linking into it leaves all 65 hooks DANGLING the
#     moment the clone is deleted - a dead harness, worse than a frozen one.
TMP_CLONE="/tmp/improv-throwaway-$$"
mkdir -p "$TMP_CLONE/.git" "$TMP_CLONE/claude/hooks"
printf '#!/bin/bash\necho TMP_CLONE\n' > "$TMP_CLONE/claude/hooks/demo.sh"
chmod +x "$TMP_CLONE/claude/hooks/demo.sh"
DT="$DEST/dtmp.sh"
REPO_DIR="$TMP_CLONE" link_or_copy "$TMP_CLONE/claude/hooks/demo.sh" "$DT"
if [ -f "$DT" ] && [ ! -L "$DT" ]; then
  pass "a .git checkout in a TEMP dir is treated as throwaway -> copy, not a dangling link"
else
  fail "a .git checkout in a TEMP dir is treated as throwaway -> copy, not a dangling link" "$(ls -l "$DT" 2>&1)"
fi
rm -rf "$TMP_CLONE"
if [ "$(bash "$DT" 2>/dev/null)" = "TMP_CLONE" ]; then
  pass "...and it still runs after the throwaway clone is deleted"
else
  fail "...and it still runs after the throwaway clone is deleted" "got: $(bash "$DT" 2>&1)"
fi

# (1b) macOS resolves /tmp and /var THROUGH /private, so a physical temp path reads as
#      /private/var/folders/... A pattern that only knew the logical name would let a
#      throwaway clone symlink itself into oblivion. (Second Codex pass.)
for physical in /private/var/folders/zz/fixture-$$ /private/tmp/fixture-$$; do
  mkdir -p "$physical/.git" "$physical/claude/hooks" 2>/dev/null || continue
  printf '#!/bin/bash\necho PHYSICAL_TMP\n' > "$physical/claude/hooks/demo.sh"
  chmod +x "$physical/claude/hooks/demo.sh"
  DP="$DEST/dphys.sh"
  REPO_DIR="$physical" link_or_copy "$physical/claude/hooks/demo.sh" "$DP"
  if [ -f "$DP" ] && [ ! -L "$DP" ]; then
    pass "physical temp path $physical is treated as throwaway -> copy"
  else
    fail "physical temp path $physical is treated as throwaway -> copy" "$(ls -l "$DP" 2>&1)"
  fi
  rm -rf "$physical"
done

# (2) A MISSING source must fail loudly. safe_cp died here under `set -e`; returning 0
#     would print "ok hooks/x.sh" while the destination stayed missing or stale.
if REPO_DIR="$SRC_REPO" link_or_copy "$SRC_REPO/claude/hooks/does-not-exist.sh" "$DEST/missing.sh" 2>/dev/null; then
  fail "a missing hook source FAILS (does not silently report success)" "returned 0"
else
  pass "a missing hook source FAILS (does not silently report success)"
fi

# (3) If the source cannot be made executable, deploy a COPY - a working copy beats a
#     dead link. Simulated with a read-only source dir so chmod cannot succeed.
RO_SRC="$FIXROOT/readonly-repo"      # durable location, so the COPY here is caused by
mkdir -p "$RO_SRC/.git" "$RO_SRC/claude/hooks"   # the chmod failure, not the temp rule
printf '#!/bin/bash\necho READONLY_SRC\n' > "$RO_SRC/claude/hooks/ro.sh"
chmod -x "$RO_SRC/claude/hooks/ro.sh"
chmod -w "$RO_SRC/claude/hooks" "$RO_SRC/claude/hooks/ro.sh" 2>/dev/null
DR="$DEST/dro.sh"
REPO_DIR="$RO_SRC" link_or_copy "$RO_SRC/claude/hooks/ro.sh" "$DR" 2>/dev/null
if [ -x "$DR" ] && [ "$("$DR" 2>/dev/null)" = "READONLY_SRC" ]; then
  pass "an unchmod-able source deploys as a RUNNABLE copy, never a dead link"
else
  fail "an unchmod-able source deploys as a RUNNABLE copy, never a dead link" "$(ls -lL "$DR" 2>&1)"
fi
chmod -R u+w "$RO_SRC" 2>/dev/null; rm -rf "$RO_SRC"

# (4) The lib-only guard must fire ONLY on exactly "1". An inherited =0 would otherwise
#     make a normal ./install.sh exit 0 having installed nothing, and report success.
if IMPROV_INSTALL_LIB_ONLY=0 bash -c 'set -euo pipefail; . "$1" >/dev/null 2>&1; echo SOURCED_AND_RAN' _ "$INSTALL_SH" >/dev/null 2>&1; then
  fail "IMPROV_INSTALL_LIB_ONLY=0 must NOT trigger the lib-only early return" "it returned early"
else
  pass "IMPROV_INSTALL_LIB_ONLY=0 does NOT trigger the lib-only early return"
fi

# (5) Deactivation must remove a DANGLING link. `[ -f ]` follows the link and is FALSE
#     for a broken one, so the old guard left broken hooks behind forever.
DANG="$DEST/dangling.sh"
ln -sfn /nonexistent/gone.sh "$DANG"
rm -f "$DANG"
if [ ! -L "$DANG" ] && [ ! -e "$DANG" ]; then
  pass "rm -f removes a DANGLING symlink (the uninstall path deactivate_reflect now uses)"
else
  fail "rm -f removes a DANGLING symlink" "still present"
fi

echo ""
echo "===== integration: the REAL hooks, deployed exactly as install.sh does ====="
# Same call shape as the CONFIG_HOOKS loop, but into a TEMP destination. This is the
# closest we can get to running the installer without ever pointing it at ~/.claude.
INTEG_OK=true
for f in bash-guard.sh justify-source-guard.sh reflect-nudge.sh block-clickup-writes.sh; do
  [ -f "$REPO_ROOT/claude/hooks/$f" ] || continue
  REPO_DIR="$REPO_ROOT" link_or_copy "$REPO_ROOT/claude/hooks/$f" "$DEST/$f"
  if [ ! -L "$DEST/$f" ] || [ "$(readlink "$DEST/$f")" != "$REPO_ROOT/claude/hooks/$f" ]; then
    INTEG_OK=false
    echo "  (bad: $f -> $(ls -l "$DEST/$f" 2>&1))"
  fi
done
if [ "$INTEG_OK" = true ]; then
  pass "real CONFIG_HOOKS files deploy as symlinks into improv (temp dest)"
else
  fail "real CONFIG_HOOKS files deploy as symlinks into improv (temp dest)" "see above"
fi
# The frozen hook that started all this must come out linked, not copied.
if [ -L "$DEST/justify-source-guard.sh" ] \
   && grep -q "Documents/Github/improv/justify" "$DEST/justify-source-guard.sh"; then
  pass "justify-source-guard deploys linked, and reads the CORRECT improv path"
else
  fail "justify-source-guard deploys linked, and reads the CORRECT improv path" "still frozen?"
fi

echo ""
echo "===== SAFETY: the real ~/.claude/hooks was never touched ====="
if [ -d "$REAL_HOOKS" ]; then
  REAL_AFTER=$(ls -l "$REAL_HOOKS" | awk '/^l/{l++} /^-/{f++} END{print "links="l" files="f}')
  if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then
    pass "real hooks dir unchanged ($REAL_AFTER)"
  else
    fail "real hooks dir unchanged" "BEFORE $REAL_BEFORE -> AFTER $REAL_AFTER"
  fi
else
  pass "real hooks dir absent - nothing to protect"
fi

echo ""
echo "============================================================"
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
