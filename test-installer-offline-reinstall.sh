#!/usr/bin/env bash
# Does re-installing an already-complete machine still need the network?
#
# THE DEFECT. justify/install.sh and lotus/install.sh ran `npm install` unconditionally, and
# their failure path is `exit 4`, which the top-level installer routes into PARTIAL_FAILURES.
# So `./install.sh --only justify,lotus` on a machine where nothing had changed printed "This
# run did NOT fully apply every component" and exited 1 whenever the network was unavailable -
# having changed nothing at all. justify additionally invoked `npx -y tsc`, which FETCHES a
# compiler that was already sitting in node_modules. Reported 2026-07-28 from an installer
# rehearsal; both runs there had network, which is why the rehearsal itself did not surface it.
#
# HOW "OFFLINE" IS SIMULATED. Not by cutting the network - that is neither available to a test
# nor precise. A fake `npm` earlier on PATH FAILS on the `install` subcommand and delegates
# everything else to the real npm. That is exactly the observable behaviour of an offline
# `npm install` and it makes the assertion sharp: if the run succeeds, `npm install` was
# never reached. Row 0 is the control proving the fake really does break `install`, because
# every other row's green depends on that being true.
#
# Exit codes: 0 all rows passed, 1 a row failed, 2 harness could not set up.

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

ok()  { printf '  PASS  %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf '  FAIL  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; FAIL=$((FAIL+1)); }

command -v npm >/dev/null 2>&1 || { echo "harness: npm not on PATH - cannot run" >&2; exit 2; }
REAL_NPM="$(command -v npm)"

# Non-temp, because justify/install.sh now refuses a shared bin under a redirected HOME and a
# temp HOME would additionally interact with unrelated temp-path logic. Keep the variables the
# same shape as the other installer suites.
WORK="$(dirname "$REPO_DIR")/.offline-reinstall-test.$$"
rm -rf "$WORK"
mkdir -p "$WORK" || exit 2
trap 'rm -rf "$WORK"' EXIT

FAKEBIN="$WORK/fakebin"
mkdir -p "$FAKEBIN"
cat > "$FAKEBIN/npm" <<FAKE
#!/usr/bin/env bash
# Fake npm: fails on 'install', delegates everything else to the real one.
if [ "\${1:-}" = "install" ] || [ "\${1:-}" = "ci" ]; then
  echo "npm: simulated offline - cannot reach the registry" >&2
  exit 1
fi
exec "$REAL_NPM" "\$@"
FAKE
chmod +x "$FAKEBIN/npm"
cat > "$FAKEBIN/npx" <<FAKE
#!/usr/bin/env bash
echo "npx: simulated offline - refusing to fetch" >&2
exit 1
FAKE
chmod +x "$FAKEBIN/npx"

printf 'Suite: offline re-install of an already-complete machine\nRepo: %s\n' "$REPO_DIR"

printf '\n%s\n' 'Row 0 - control: the fake npm really does break `npm install`'
if PATH="$FAKEBIN:$PATH" npm install --silent >/dev/null 2>&1; then
  bad "row 0: the fake npm did NOT fail on install - every row below would be meaningless"
else
  if PATH="$FAKEBIN:$PATH" npm --version >/dev/null 2>&1; then
    ok "row 0: fake npm fails on 'install' and still delegates other subcommands"
  else
    bad "row 0: the fake npm breaks every subcommand, not just install" "delegation to $REAL_NPM is broken"
  fi
fi

# ------------------------------------------------------------
# A clone, so the builds write into a throwaway tree rather than the real checkout. APFS
# clonefile brings node_modules along for free, which is what makes the "already complete"
# precondition real rather than mocked.
# ------------------------------------------------------------
CLONE="$WORK/clone"
if ! cp -Rc "$REPO_DIR" "$CLONE" 2>/dev/null; then
  cp -R "$REPO_DIR" "$CLONE" 2>/dev/null || { bad "harness: could not clone the repo"; CLONE=""; }
fi

run_justify() {
  # $1 = HOME to use. Echoes the exit code.
  local h="$1"
  env -i HOME="$h" PATH="$FAKEBIN:$PATH" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-u}" \
      TERM=dumb LANG=en_US.UTF-8 \
      bash "$CLONE/justify/install.sh" > "$WORK/justify.log" 2>&1
  printf '%s' "$?"
}

# stamp_for <dir> <manifest-source-dir> - write the dependency stamp a previous successful
# install would have left. The fingerprint function is taken from the installer itself rather
# than reimplemented, so the harness cannot disagree with the code about what "current" means.
stamp_for() {
  local nm_dir="$1" man_dir="$2" s="$WORK/stamp.sh"
  {
    printf 'set -uo pipefail\n'
    sed -n '/^_deps_sha() {/,/^}/p'        "$CLONE/justify/install.sh"
    sed -n '/^deps_fingerprint() {/,/^}/p' "$CLONE/justify/install.sh"
    printf 'deps_fingerprint %q\n' "$man_dir"
  } > "$s"
  bash "$s" > "$nm_dir/node_modules/.improv-deps-stamp" 2>/dev/null
}

if [ -n "$CLONE" ]; then
  printf '\n%s\n' 'Rows 1-2 - justify: dependencies stamped, unstamped, and absent'

  H1="$WORK/home-complete"; mkdir -p "$H1/.claude/justify" "$H1/.local/bin"
  # "Already complete" means the dependencies are there AND a previous install recorded what
  # they were installed from. Both halves are seeded, because the stamp is the whole test.
  if [ -d "$REPO_DIR/justify/node_modules" ]; then
    cp -Rc "$REPO_DIR/justify/node_modules" "$H1/.claude/justify/node_modules" 2>/dev/null \
      || cp -R "$REPO_DIR/justify/node_modules" "$H1/.claude/justify/node_modules"
  fi
  if [ ! -d "$H1/.claude/justify/node_modules" ]; then
    bad "rows 1-2: could not seed justify node_modules - precondition unavailable"
  else
    # The stamp must describe the manifest the installer will have PLACED, which is the repo's
    # copy - the installer copies justify/package.json into $JUSTIFY_DIR before checking.
    cp "$CLONE/justify/package.json" "$H1/.claude/justify/package.json" 2>/dev/null || true
    for lk in package-lock.json npm-shrinkwrap.json; do
      [ -f "$CLONE/justify/$lk" ] && cp "$CLONE/justify/$lk" "$H1/.claude/justify/$lk"
    done
    stamp_for "$H1/.claude/justify" "$H1/.claude/justify"
    rc="$(run_justify "$H1")"
    ROW1_RC="$rc"          # row 3 reports on THIS run; keep its status explicitly
    cp "$WORK/justify.log" "$WORK/justify-row1.log"
    if [ "$rc" = "0" ]; then
      ok "row 1: justify install SUCCEEDS offline when the dependencies are STAMPED current (rc=0)"
    else
      bad "row 1: justify install failed offline despite stamped-current dependencies (rc=$rc)" \
          "$(grep -iE 'error|offline' "$WORK/justify.log" | head -3)"
    fi
    if grep -q 'skipping npm install' "$WORK/justify.log"; then
      ok "row 1b: the log states the npm install was skipped"
    else
      bad "row 1b: no skip announced - the skip must not be silent" "$(tail -3 "$WORK/justify.log")"
    fi

    # ROW 1c - AN UNSTAMPED node_modules IS NOT TRUSTED. This is the case every existing
    # machine is in before its first run on the new installer, and the case a presence-only
    # check got wrong: nobody recorded what that tree was installed from, so it cannot be
    # assumed current.
    H1b="$WORK/home-unstamped"; mkdir -p "$H1b/.claude/justify" "$H1b/.local/bin"
    cp -Rc "$H1/.claude/justify/node_modules" "$H1b/.claude/justify/node_modules" 2>/dev/null \
      || cp -R "$H1/.claude/justify/node_modules" "$H1b/.claude/justify/node_modules"
    rm -f "$H1b/.claude/justify/node_modules/.improv-deps-stamp"
    rc="$(run_justify "$H1b")"
    if [ "$rc" != "0" ]; then
      ok "row 1c: an UNSTAMPED node_modules is not trusted - the install runs npm and fails offline (rc=$rc)"
    else
      bad "row 1c: an unstamped node_modules was treated as current" \
          "nothing recorded what that tree was installed from, so the skip is a guess"
    fi

    H2="$WORK/home-fresh"; mkdir -p "$H2/.claude" "$H2/.local/bin"
    rc="$(run_justify "$H2")"
    if [ "$rc" != "0" ]; then
      ok "row 2: control - a FRESH justify install still fails offline (rc=$rc), so row 1 is not vacuous"
    else
      bad "row 2: a fresh install succeeded offline - then row 1 proves nothing about the skip"
    fi
  fi

  # ROW 3 IS NOW BEHAVIOURAL, and it was a grep before. A grep for "node_modules/.bin/tsc"
  # is satisfied by a COMMENT mentioning that path, which is not a defence at all. The
  # observable fact is better and already available: the fake `npx` in this harness always
  # fails, so if row 1's install succeeded, the server build cannot have gone through npx.
  # Flagged by independent review.
  printf '\n%s\n' 'Row 3 - justify built the server WITHOUT npx (proven, not grepped)'
  if [ "${ROW1_RC:-1}" = "0" ] && ! grep -q 'npx: simulated offline' "$WORK/justify-row1.log"; then
    ok "row 3: the offline install completed and never invoked npx - the local tsc was used"
  elif [ -f "$WORK/justify-row1.log" ] && grep -q 'npx: simulated offline' "$WORK/justify-row1.log"; then
    bad "row 3: the build reached for npx, which fetches" "$(grep -m2 'npx' "$WORK/justify-row1.log")"
  else
    bad "row 3: cannot assert - row 1's install did not succeed, so nothing built"
  fi

  # ROWS 4-5 ARE NOW BEHAVIOURAL TOO. The greps they replace could be satisfied by an
  # unreachable branch. These run lotus/install.sh itself under the offline npm.
  printf '\n%s\n' 'Rows 4-5 - lotus builds offline when its dependencies are current'
  LH="$WORK/lotus-home"; mkdir -p "$LH/.claude" "$LH/.local/bin"
  printf '{}\n' > "$LH/.claude.json"
  if [ ! -d "$CLONE/lotus/node_modules" ] || [ ! -d "$CLONE/lotus/mcp-server/node_modules" ]; then
    bad "rows 4-5: lotus dependencies are not present in the clone - precondition unavailable"
  else
    # Same precondition as row 1: a machine a previous install has already stamped.
    stamp_for "$CLONE/lotus" "$CLONE/lotus"
    stamp_for "$CLONE/lotus/mcp-server" "$CLONE/lotus/mcp-server"
    env -i HOME="$LH" PATH="$FAKEBIN:$PATH" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-u}" \
        TERM=dumb LANG=en_US.UTF-8 \
        bash "$CLONE/lotus/install.sh" > "$WORK/lotus.log" 2>&1
    lrc=$?
    if [ "$lrc" = "0" ]; then
      ok "row 4: lotus install SUCCEEDS offline with current dependencies (rc=0)"
    else
      bad "row 4: lotus install failed offline despite current dependencies (rc=$lrc)" \
          "$(grep -iE 'error|offline' "$WORK/lotus.log" | head -3)"
    fi
    n_skips="$(grep -c 'skipping npm install' "$WORK/lotus.log")"
    if [ "$n_skips" -ge 2 ]; then
      ok "row 5: both lotus builds announced their skip ($n_skips skip lines)"
    else
      bad "row 5: expected both lotus builds to skip npm install, saw $n_skips" \
          "$(grep -iE 'npm|skipping' "$WORK/lotus.log" | head -4)"
    fi
  fi

  # ROW 6 IS NOW BEHAVIOURAL. `grep record_component_failure sidecoach` passes on a comment.
  # This drives install.sh with a build that FAILS and asserts the run reports the failure and
  # exits non-zero, which is the actual claim.
  printf '\n%s\n' 'Row 6 - a failing sidecoach build fails the run (proven, not grepped)'
  BREAKBIN="$WORK/breakbin"; mkdir -p "$BREAKBIN"
  cat > "$BREAKBIN/npm" <<'BRK'
#!/usr/bin/env bash
echo "npm: simulated build failure" >&2
exit 1
BRK
  chmod +x "$BREAKBIN/npm"
  SH="$WORK/sidecoach-home"; mkdir -p "$SH/.claude" "$SH/.local/bin"
  cp "$HOME/.zshrc" "$SH/.zshrc" 2>/dev/null || printf '\n' > "$SH/.zshrc"
  env -i HOME="$SH" PATH="$BREAKBIN:$PATH" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-u}" \
      TERM=dumb LANG=en_US.UTF-8 \
      bash "$CLONE/install.sh" --only sidecoach --yes > "$WORK/sidecoach.log" 2>&1
  src_rc=$?
  clean_log="$(sed -e 's/\x1b\[[0-9;]*m//g' "$WORK/sidecoach.log")"
  if [ "$src_rc" -ne 0 ]; then
    ok "row 6: a failing sidecoach build makes the run exit non-zero (rc=$src_rc)"
  else
    bad "row 6: the run exited 0 over a failed sidecoach build" \
        "$(printf '%s' "$clean_log" | tail -3)"
  fi
  if printf '%s' "$clean_log" | grep -q 'did NOT fully apply'; then
    ok "row 6b: the run named the failure in the partial-failure ledger"
  else
    bad "row 6b: no ledger line - the failure was not attributed to a component" \
        "$(printf '%s' "$clean_log" | grep -iE 'sidecoach|complete' | tail -3)"
  fi
  if printf '%s' "$clean_log" | grep -q 'Installation complete'; then
    bad "row 6c: the run still printed 'Installation complete.' over a failed build"
  else
    ok "row 6c: the run did not claim completion"
  fi
fi

printf '\n%s\n' 'Rows 7-10 - deps_current: a recorded stamp, not presence and not mtime'
DC="$WORK/depsfix"; mkdir -p "$DC/node_modules"
printf '{"name":"x","dependencies":{"a":"1.0.0"}}\n' > "$DC/package.json"
drive_deps() {
  local dir="$1" script="$WORK/deps.sh"
  {
    printf 'set -uo pipefail\n'
    sed -n '/^_deps_sha() {/,/^}/p'         "$CLONE/justify/install.sh"
    sed -n '/^deps_fingerprint() {/,/^}/p'  "$CLONE/justify/install.sh"
    sed -n '/^deps_current() {/,/^}/p'      "$CLONE/justify/install.sh"
    sed -n '/^deps_record() {/,/^}/p'       "$CLONE/justify/install.sh"
    printf 'if deps_current %q; then printf current; else printf stale; fi\n' "$dir"
  } > "$script"
  bash "$script" 2>/dev/null
}
record_deps() {
  local dir="$1" script="$WORK/rec.sh"
  {
    printf 'set -uo pipefail\n'
    sed -n '/^_deps_sha() {/,/^}/p'        "$CLONE/justify/install.sh"
    sed -n '/^deps_fingerprint() {/,/^}/p' "$CLONE/justify/install.sh"
    sed -n '/^deps_record() {/,/^}/p'      "$CLONE/justify/install.sh"
    printf 'deps_record %q\n' "$dir"
  } > "$script"
  bash "$script" 2>/dev/null
}

got="$(drive_deps "$DC")"
if [ "$got" = "stale" ]; then
  ok "row 7: node_modules with NO stamp reads as stale (presence alone proves nothing)"
else
  bad "row 7: an unstamped tree was called current" "got '$got'"
fi

record_deps "$DC"
got="$(drive_deps "$DC")"
if [ "$got" = "current" ]; then
  ok "row 8: after recording, the same manifest reads as current"
else
  bad "row 8: a freshly stamped tree was called stale" "got '$got'"
fi

# The mtime trap this replaced: touch the manifest WITHOUT changing it. An mtime rule reports
# stale here and the offline skip dies; the content rule correctly still says current, which is
# why justify - whose installer rewrites package.json every run - works at all.
touch "$DC/package.json"
got="$(drive_deps "$DC")"
if [ "$got" = "current" ]; then
  ok "row 9: touching the manifest without changing it stays current (the mtime trap)"
else
  bad "row 9: an unchanged manifest with a new mtime was called stale" \
      "got '$got' - this is the mtime rule that made the justify skip dead code"
fi

printf '{"name":"x","dependencies":{"a":"2.0.0"}}\n' > "$DC/package.json"
got="$(drive_deps "$DC")"
if [ "$got" = "stale" ]; then
  ok "row 10: BUMPING a dependency reads as stale - the skip will not fire against old deps"
else
  bad "row 10: a bumped manifest was treated as current" "got '$got'"
fi

printf '\n%s\n' "----------------------------------------"
printf 'passed %d   failed %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
