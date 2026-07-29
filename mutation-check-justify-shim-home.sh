#!/usr/bin/env bash
# Mutation control for test-justify-shim-home-escape.sh.
#
# A green suite proves nothing until each of its load-bearing assertions has been watched to
# fail. Each mutant below breaks exactly one part of the fix in justify/install.sh; the suite
# must go non-zero for every one.
#
# TWO HARNESS RULES, both learned the hard way in this repo:
#   1. ASSERT THE ANCHOR EXISTS before believing a "not caught" result. A substitution that
#      matched nothing produces an unmutated file, the suite passes, and the probe would
#      score that as "the suite missed it" when in fact nothing was mutated.
#   2. DISTINGUISH "could not source the mutant" from "the suite caught it". A mutant with a
#      syntax error, or one whose marked region no longer extracts, makes the suite fail for
#      a reason that has nothing to do with the assertion under test. That is a HARNESS
#      failure, not a catch.
#
# Exit codes:
#   0  every mutant caught
#   1  at least one mutant survived
#   2  harness failure (anchor missing, mutant unsourceable, setup failed)

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SUITE="$REPO_DIR/test-justify-shim-home-escape.sh"
TARGET="$REPO_DIR/justify/install.sh"
[ -f "$SUITE" ]  || { echo "harness: missing $SUITE" >&2; exit 2; }
[ -f "$TARGET" ] || { echo "harness: missing $TARGET" >&2; exit 2; }

WORK="$(mktemp -d)" || exit 2
trap 'rm -rf "$WORK"' EXIT

CAUGHT=0
SURVIVED=0
HARNESS=0

# mutate <name> <python-expr-file> <description> <expected-victim-row>
#
# THE FOURTH ARGUMENT IS WHAT MAKES A "CATCH" MEAN ANYTHING. The first version scored any
# non-zero exit from the suite as a catch, which is wrong in a specific and likely way: the
# suite contains rows that fail for ENVIRONMENTAL reasons (row 6b goes red when the machine has
# no justify shims at all). On such a machine every mutant would have been credited as caught
# while the assertion under test survived untouched. So each mutant now names the row that must
# be among the failures, and a non-zero exit whose failures do not include it is reported as
# SURVIVED-WRONG-ROW rather than as a catch. Flagged by independent review.
mutate() {
  local name="$1" prog="$2" desc="$3" expect="${4:-}"
  local mutant="$WORK/$name.sh"
  if ! python3 "$prog" < "$TARGET" > "$mutant" 2>"$WORK/$name.err"; then
    printf 'HARNESS  %-6s anchor missing - %s\n' "$name" "$(head -1 "$WORK/$name.err")"
    HARNESS=$((HARNESS+1))
    return
  fi
  if cmp -s "$TARGET" "$mutant"; then
    printf 'HARNESS  %-6s substitution changed nothing\n' "$name"
    HARNESS=$((HARNESS+1))
    return
  fi
  if ! bash -n "$mutant" 2>"$WORK/$name.syn"; then
    printf 'HARNESS  %-6s mutant does not parse - %s\n' "$name" "$(head -1 "$WORK/$name.syn")"
    HARNESS=$((HARNESS+1))
    return
  fi
  # The suite's own row 0 tells us whether the marked region still extracts. If it does not,
  # every function-level row SKIPS and a non-zero exit would be for the wrong reason.
  local out rc
  out="$(JUSTIFY_INSTALL_SH="$mutant" bash "$SUITE" 2>&1)"
  rc=$?
  if printf '%s' "$out" | grep -q 'SKIP  no marked bin-selection region'; then
    printf 'HARNESS  %-6s marked region stopped extracting - rows could not run\n' "$name"
    HARNESS=$((HARNESS+1))
    return
  fi
  if [ "$rc" -eq 0 ]; then
    printf 'SURVIVED %-6s %s\n' "$name" "$desc"
    printf '%s\n' "$out" | grep -E '^  (PASS|FAIL|SKIP)' | sed 's/^/         /'
    SURVIVED=$((SURVIVED+1))
    return
  fi
  local rows fails
  rows="$(printf '%s' "$out" | grep -c '^  FAIL')"
  fails="$(printf '%s' "$out" | grep '^  FAIL' | sed 's/^  FAIL  //')"
  if [ -n "$expect" ] && ! printf '%s' "$fails" | grep -q "$expect"; then
    printf 'SURVIVED %-6s %s\n' "$name" "$desc"
    printf '         expected %s among the failures; the suite went red for other reasons:\n' "$expect"
    printf '%s\n' "$fails" | sed 's/^/           /'
    SURVIVED=$((SURVIVED+1))
    return
  fi
  printf 'caught   %-6s %s (%s row(s) red, incl. %s)\n' "$name" "$desc" "$rows" "${expect:-any}"
  CAUGHT=$((CAUGHT+1))
}

mk() { cat > "$WORK/$1.py"; }

# M1 - the HOME-identity check always says yes. This is the defect itself, restored.
mk m1 <<'PY'
import sys
src = sys.stdin.read()
anchor = "justify_home_is_real() {"
if anchor not in src:
    sys.stderr.write("no justify_home_is_real definition\n"); sys.exit(1)
src = src.replace(anchor, anchor + "\n  return 0  # MUTANT", 1)
sys.stdout.write(src)
PY
mutate m1 "$WORK/m1.py" "justify_home_is_real always true (the original defect)" "row 2:"

# M2 - the account lookup returns $HOME itself, so any HOME looks like the real one.
mk m2 <<'PY'
import sys
src = sys.stdin.read()
anchor = "justify_real_home() {"
if anchor not in src:
    sys.stderr.write("no justify_real_home definition\n"); sys.exit(1)
src = src.replace(anchor, anchor + '\n  printf "%s" "$HOME"; return 0  # MUTANT', 1)
sys.stdout.write(src)
PY
# Expected victim is row 4g, NOT row 2. Rows 1-4 stub justify_real_home out so they can drive
# the DECISION with a known answer; a mutation to the PROBE is invisible to them by design.
# The first version of this file expected row 2 here and was credited with a catch it had not
# made - which is precisely the miscount the expected-victim argument was added to expose, and
# it exposed one of mine on its first run.
mutate m2 "$WORK/m2.py" "justify_real_home echoes \$HOME (lookup neutered)" "row 4g:"

# M3 - drop the physical normalisation, so a symlinked home stops matching.
mk m3 <<'PY'
import sys
src = sys.stdin.read()
anchor = '  [ "${home_phys%/}" = "${rh_phys%/}" ]'
if anchor not in src:
    sys.stderr.write("no physical comparison line\n"); sys.exit(1)
src = src.replace(anchor, '  [ "$HOME" = "$rh" ]  # MUTANT', 1)
sys.stdout.write(src)
PY
mutate m3 "$WORK/m3.py" "compare raw \$HOME vs raw passwd home (no phys_of)" "row 4b:"

# M4 - the ownership invariant always permits.
mk m4 <<'PY'
import sys
src = sys.stdin.read()
anchor = "justify_bin_dir_is_permitted() {"
if anchor not in src:
    sys.stderr.write("no justify_bin_dir_is_permitted definition\n"); sys.exit(1)
src = src.replace(anchor, anchor + "\n  return 0  # MUTANT", 1)
sys.stdout.write(src)
PY
mutate m4 "$WORK/m4.py" "justify_bin_dir_is_permitted always permits" "row 4c:"

# M5 - selection never returns early, so it always falls through to $HOME/.local/bin. This
# one must be caught by the row that protects REAL installs, not by a safety row.
mk m5 <<'PY'
import sys
src = sys.stdin.read()
anchor = """      if [ -d "$d" ] && [ -w "$d" ]; then
        BIN_DIR="$d"
        return 0
      fi"""
if anchor not in src:
    sys.stderr.write("no shared-bin acceptance branch\n"); sys.exit(1)
src = src.replace(anchor, """      if [ -d "$d" ] && [ -w "$d" ]; then
        BIN_DIR="$d"
        :  # MUTANT: no early return
      fi""", 1)
sys.stdout.write(src)
PY
mutate m5 "$WORK/m5.py" "selection never accepts a shared bin (real installs regress)" "row 1:"

# M6 - the invariant's in-HOME carve-out matches everything.
mk m6 <<'PY'
import sys
src = sys.stdin.read()
anchor = '''  if justify_path_is_within "$bd" "$HOME"; then
    return 0
  fi'''
if anchor not in src:
    sys.stderr.write("no in-HOME carve-out in justify_bin_dir_is_permitted\n"); sys.exit(1)
src = src.replace(anchor, '''  if true; then  # MUTANT
    return 0
  fi''', 1)
sys.stdout.write(src)
PY
mutate m6 "$WORK/m6.py" "invariant carve-out matches any path" "row 4c:"

# M7 - containment tested LEXICALLY instead of physically. This is the symlinked-fallback
# escape found by independent review: $HOME/.local/bin -> /opt/homebrew/bin passes a prefix
# test while the writes land in the shared bin.
mk m7 <<'PY'
import sys
src = sys.stdin.read()
anchor = '''  ip="${ip%/}"; op="${op%/}"'''
if anchor not in src:
    sys.stderr.write("no normalisation line in justify_path_is_within\n"); sys.exit(1)
src = src.replace(anchor, '''  ip="${inner%/}"; op="${outer%/}"  # MUTANT: lexical, unresolved''', 1)
sys.stdout.write(src)
PY
mutate m7 "$WORK/m7.py" "containment compared lexically, not physically" "row 4f:"

# M8 - the probe accepts output from a FAILED lookup. The fake dscl in row 4g prints a
# plausible line and exits 1; without the status check the run treats a redirected HOME as real.
mk m8 <<'PY'
import sys
src = sys.stdin.read()
anchor = '''    if [ "$rc" -eq 0 ]; then case "$h" in /?*) printf '%s' "$h"; return 0 ;; esac; fi'''
if anchor not in src:
    sys.stderr.write("no status-checked dscl branch\n"); sys.exit(1)
src = src.replace(anchor, '''    case "$h" in /?*) printf '%s' "$h"; return 0 ;; esac  # MUTANT: status ignored''', 1)
sys.stdout.write(src)
PY
mutate m8 "$WORK/m8.py" "probe output accepted even when the probe failed" "row 4g:"

printf '\n%s\n' "----------------------------------------"
printf 'caught %d   survived %d   harness failures %d\n' "$CAUGHT" "$SURVIVED" "$HARNESS"
[ "$HARNESS" -eq 0 ] || exit 2
[ "$SURVIVED" -eq 0 ] || exit 1
exit 0
