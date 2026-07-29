#!/usr/bin/env bash
# Regression suite for the $HOME escape in justify/install.sh's shim planting.
#
# THE DEFECT, reproduced live on 2026-07-28 during an installer rehearsal. The shim bin was
# chosen as the first WRITABLE of /usr/local/bin, /opt/homebrew/bin, $HOME/.local/bin - and
# the first two of those belong to the real user no matter what $HOME says. A run with $HOME
# redirected to a sandbox therefore planted eight symlinks into the real /opt/homebrew/bin
# pointing at scripts inside the sandbox, and then REPORTED SUCCESS: the verification loop
# compares readlink against "$JUSTIFY_DIR/$target", and $JUSTIFY_DIR is itself derived from
# the redirected $HOME, so the links it just mis-planted are exactly the links it expects.
# The old guard only refused when $HOME sat under a TEMP root, so any durable sandbox path
# walked straight through it.
#
# WHY THE PROPERTY IS "THE SHARED BIN IS UNTOUCHED" and not "the shims are correct": a run
# under a redirected HOME can produce perfectly self-consistent shims and still have
# destroyed the real user's CLI. Self-consistency is the false green. So the rows below
# assert on a bin directory the run had no business writing to.
#
# HOW THE PRISTINE-HEAD CONTROL IS RUN SAFELY. Reproducing the escape end to end means
# letting the installer pick a shared bin, and against pristine HEAD that bin is the REAL
# /opt/homebrew/bin - running it would break the live justify CLI, which is the damage this
# suite exists to prevent. So the end-to-end rows run a COPY of the installer inside a clone
# of the repo, with the two shared-bin literals rewritten to a fixture directory.
# SCRIPT_DIR resolution is preserved by putting the copy at <clone>/justify/install.sh; a
# copy anywhere else silently resolves its payload sources to the wrong tree.
#
# Row 6 is the exception and the one that tests the real thing: it runs the file under test
# with the real literals intact and a redirected HOME, then asserts the live shared bin is
# byte-identical. It is only safe once the fix is in, so it is SKIPPED (loudly) when the
# file under test has no HOME-identity guard.
#
# Exit codes:
#   0  every row passed
#   1  a row failed
#   2  usage / the harness could not set up
#   3  the harness damaged the live shims and could not restore them

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
SKIP=0

ok()    { printf '  PASS  %s\n' "$1"; PASS=$((PASS+1)); }
bad()   { printf '  FAIL  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; FAIL=$((FAIL+1)); }
skipr() { printf '  SKIP  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; SKIP=$((SKIP+1)); }
sect()  { printf '\n%s\n' "$1"; }

# ------------------------------------------------------------
# Live-shim safety net. This suite must never leave the real machine's justify shims
# pointing anywhere but where they pointed when it started. Snapshot, verify, exit 3 if a
# row broke them and the restore did not take.
# ------------------------------------------------------------
LIVE_BIN=""
for d in /usr/local/bin /opt/homebrew/bin "$HOME/.local/bin"; do
  if [ -d "$d" ] && [ -w "$d" ]; then LIVE_BIN="$d"; break; fi
done
LIVE_SNAP="$(mktemp)" || exit 2
if [ -n "$LIVE_BIN" ]; then
  for f in "$LIVE_BIN"/justify-*; do
    [ -L "$f" ] || continue
    printf '%s\t%s\n' "$f" "$(readlink "$f")" >> "$LIVE_SNAP"
  done
fi

# RESTORING WHAT WAS THERE IS ONLY HALF THE NET. The first version replayed the snapshot and
# stopped, so a shim name that did NOT exist at snapshot time and was created by a row - say
# the live bin has nine shims and a mutated installer plants a tenth - was left behind as real
# damage the suite had caused and then declared itself clean. So the sweep also DELETES any
# justify-* the suite introduced. It deletes only symlinks, and only names absent from the
# snapshot, so it can never remove a user's own file or a shim that predates the run.
# Flagged by independent review.
restore_live_shims() {
  local path target restored=0 removed=0 broken=0 f
  if [ -n "$LIVE_BIN" ]; then
    for f in "$LIVE_BIN"/justify-*; do
      [ -L "$f" ] || continue
      if ! cut -f1 "$LIVE_SNAP" 2>/dev/null | grep -qxF "$f"; then
        rm -f "$f" && removed=$((removed+1))
      fi
    done
  fi
  if [ -s "$LIVE_SNAP" ]; then
    while IFS=$'\t' read -r path target; do
      [ -n "$path" ] || continue
      if [ "$(readlink "$path" 2>/dev/null)" != "$target" ]; then
        ln -sfn "$target" "$path" && restored=$((restored+1))
      fi
    done < "$LIVE_SNAP"
  fi
  [ "$restored" -gt 0 ] && printf '  NOTE  restored %d live shim(s) a row had repointed\n' "$restored"
  [ "$removed" -gt 0 ]  && printf '  NOTE  removed %d live shim(s) a row had introduced\n' "$removed"
  if [ -s "$LIVE_SNAP" ]; then
    while IFS=$'\t' read -r path target; do
      [ -n "$path" ] || continue
      if [ "$(readlink "$path" 2>/dev/null)" != "$target" ]; then
        printf '  HARNESS FAILURE: could not restore %s to %s\n' "$path" "$target" >&2
        broken=1
      fi
    done < "$LIVE_SNAP"
  fi
  if [ -n "$LIVE_BIN" ]; then
    for f in "$LIVE_BIN"/justify-*; do
      [ -L "$f" ] || continue
      if ! cut -f1 "$LIVE_SNAP" 2>/dev/null | grep -qxF "$f"; then
        printf '  HARNESS FAILURE: could not remove the introduced shim %s\n' "$f" >&2
        broken=1
      fi
    done
  fi
  return "$broken"
}

cleanup() {
  local rc=$?
  restore_live_shims || rc=3
  rm -f "$LIVE_SNAP"
  [ -n "${WORKROOT:-}" ] && [ -d "${WORKROOT:-}" ] && rm -rf "$WORKROOT"
  [ -n "${NONTEMP:-}" ] && [ -d "${NONTEMP:-}" ] && rm -rf "$NONTEMP"
  exit "$rc"
}
trap cleanup EXIT

WORKROOT="$(mktemp -d)" || exit 2

# The end-to-end sandbox HOMEs must NOT sit under a temp root, and this is the single most
# important line in the harness. My first version put them under `mktemp -d`, the old
# temp-root guard fired exactly as designed, the installer exited 1 before it ever reached
# the shim block, and row 5 reported PASS against pristine HEAD - a green that proved only
# that I had tested the one input the code already handled. The defect lives precisely in
# the gap the temp guard does not cover, so reproducing it REQUIRES a durable path.
NONTEMP="$(dirname "$REPO_DIR")/.justify-shim-escape-test.$$"
rm -rf "$NONTEMP"
mkdir -p "$NONTEMP" || { printf 'harness: could not create a non-temp work dir at %s\n' "$NONTEMP" >&2; exit 2; }
case "$NONTEMP" in
  /tmp/*|/private/tmp/*|/var/tmp/*|/private/var/tmp/*|/var/folders/*|/private/var/folders/*)
    printf 'harness: %s IS under a temp root - the end-to-end rows could not reproduce the defect\n' "$NONTEMP" >&2
    exit 2
    ;;
esac
case "$NONTEMP" in
  "$REPO_DIR"/*)
    printf 'harness: %s is inside the repo - refusing to write fixtures into tracked source\n' "$NONTEMP" >&2
    exit 2
    ;;
esac

SUT="${JUSTIFY_INSTALL_SH:-$REPO_DIR/justify/install.sh}"
[ -f "$SUT" ] || { printf 'usage: file under test not found: %s\n' "$SUT" >&2; exit 2; }
printf 'Suite: justify shim $HOME escape\nFile under test: %s\nLive shared bin: %s\n' \
  "$SUT" "${LIVE_BIN:-none writable}"

# ------------------------------------------------------------
# The decision under test, extracted by marker so it can be driven with many
# HOME/real-home combinations. Row 0 proves the extraction is not empty - a silently empty
# extraction would make every function-level row below pass for the wrong reason.
# ------------------------------------------------------------
FNFILE="$WORKROOT/fn.sh"
awk '/^# >>> justify-shim-bin-selection >>>/{f=1; next} /^# <<< justify-shim-bin-selection <<</{f=0} f{print}' \
  "$SUT" > "$FNFILE" 2>/dev/null || true

sect 'Row 0 - harness control: is the extraction non-empty?'
if [ -s "$FNFILE" ] && grep -q 'justify_choose_bin_dir' "$FNFILE"; then
  ok "extracted $(wc -l < "$FNFILE" | tr -d ' ') lines carrying the bin-selection logic"
  HAVE_FN=1
else
  skipr "no marked bin-selection region in this file - function-level rows cannot run" \
        "pristine HEAD has no such region, which is itself the finding"
  HAVE_FN=0
fi

run_choose() {
  # $1 = HOME to pretend  $2 = real home to report ("" = undeterminable)  $3.. = shared bins
  local fake_home="$1" real_home="$2"; shift 2
  local script="$WORKROOT/drive.sh"
  {
    printf 'set -uo pipefail\n'
    printf 'HOME=%q\n' "$fake_home"
    printf 'CLAUDE_DIR="$HOME/.claude"\nJUSTIFY_DIR="$CLAUDE_DIR/justify"\n'
    printf 'phys_of() { (cd "$1" 2>/dev/null && pwd -P) || printf "%%s" "$1"; }\n'
    printf 'refuse_repo_mkdir() { return 0; }\n'
    cat "$FNFILE"
    # Overridden AFTER the region is sourced, so it replaces the real probe rather than
    # being replaced by it. Ordering matters here and got this wrong once.
    printf 'justify_real_home() { [ -n %q ] || return 1; printf "%%s" %q; }\n' "$real_home" "$real_home"
    printf 'justify_choose_bin_dir %s || exit $?\n' "$*"
    printf 'printf "%%s" "$BIN_DIR"\n'
  } > "$script"
  bash "$script" 2>"$WORKROOT/drive.err"
}

if [ "$HAVE_FN" = 1 ]; then
  sect 'Rows 1-4 - the bin-directory decision, driven directly'

  REALH="$WORKROOT/realhome"; mkdir -p "$REALH/.local/bin"
  SANDH="$WORKROOT/sandbox";  mkdir -p "$SANDH/.local/bin"
  SHARED="$WORKROOT/shared-bin"; mkdir -p "$SHARED"

  got="$(run_choose "$REALH" "$REALH" "$SHARED")"
  if [ "$got" = "$SHARED" ]; then
    ok "row 1: HOME IS the real home -> shared bin used (unchanged behaviour for real installs)"
  else
    bad "row 1: HOME is the real home, shared bin should still be used" "got '$got', wanted '$SHARED'"
  fi

  got="$(run_choose "$SANDH" "$REALH" "$SHARED")"
  if [ "$got" = "$SANDH/.local/bin" ]; then
    ok "row 2: HOME redirected -> shared bin REFUSED, \$HOME/.local/bin used instead"
  else
    bad "row 2: a redirected HOME must not select the shared bin" "got '$got', wanted '$SANDH/.local/bin'"
  fi

  got="$(run_choose "$SANDH" "" "$SHARED")"
  if [ "$got" = "$SANDH/.local/bin" ]; then
    ok "row 3: real home UNDETERMINABLE -> fails safe to \$HOME/.local/bin"
  else
    bad "row 3: an undeterminable real home must fail safe, not reach a shared bin" "got '$got', wanted '$SANDH/.local/bin'"
  fi

  # A temp HOME is one case of "not the real home" - the old guard's entire subject, now
  # subsumed. Kept as its own row because it is what was observed in the wild, twice.
  TMPH="$(mktemp -d)"; mkdir -p "$TMPH/.local/bin"
  got="$(run_choose "$TMPH" "$REALH" "$SHARED")"
  if [ "$got" = "$TMPH/.local/bin" ]; then
    ok "row 4: HOME under a temp root -> shared bin refused (old guard's case, subsumed)"
  else
    bad "row 4: a temp HOME must not select the shared bin" "got '$got', wanted '$TMPH/.local/bin'"
  fi
  rm -rf "$TMPH"

  # A home reached through a symlink is still the real home. Without the phys_of
  # normalisation on both sides of the comparison this row selects $HOME/.local/bin and a
  # legitimate install silently stops using the shared bin.
  LINKH="$WORKROOT/linked-home"
  ln -sfn "$REALH" "$LINKH"
  got="$(run_choose "$LINKH" "$REALH" "$SHARED")"
  if [ "$got" = "$SHARED" ]; then
    ok "row 4b: HOME reached through a SYMLINK to the real home -> still counts as real"
  else
    bad "row 4b: a symlinked spelling of the real home must still permit the shared bin" "got '$got', wanted '$SHARED'"
  fi

  sect 'Rows 4c-4e - the ownership invariant, driven directly'
  run_permitted() {
    local fake_home="$1" real_home="$2" bindir="$3"
    local script="$WORKROOT/perm.sh"
    {
      printf 'set -uo pipefail\n'
      printf 'HOME=%q\n' "$fake_home"
      printf 'CLAUDE_DIR="$HOME/.claude"\nJUSTIFY_DIR="$CLAUDE_DIR/justify"\n'
      printf 'phys_of() { (cd "$1" 2>/dev/null && pwd -P) || printf "%%s" "$1"; }\n'
      printf 'refuse_repo_mkdir() { return 0; }\n'
      cat "$FNFILE"
      printf 'justify_real_home() { [ -n %q ] || return 1; printf "%%s" %q; }\n' "$real_home" "$real_home"
      printf 'if justify_bin_dir_is_permitted %q; then printf permitted; else printf refused; fi\n' "$bindir"
    } > "$script"
    bash "$script" 2>/dev/null
  }

  got="$(run_permitted "$SANDH" "$REALH" "$SHARED")"
  if [ "$got" = "refused" ]; then
    ok "row 4c: invariant REFUSES a shared bin when HOME is redirected"
  else
    bad "row 4c: the invariant must refuse a shared bin under a redirected HOME" "got '$got'"
  fi

  got="$(run_permitted "$REALH" "$REALH" "$SHARED")"
  if [ "$got" = "permitted" ]; then
    ok "row 4d: invariant PERMITS a shared bin when HOME is the real home"
  else
    bad "row 4d: the invariant must permit a shared bin for a genuine install" "got '$got'"
  fi

  got="$(run_permitted "$SANDH" "$REALH" "$SANDH/.local/bin")"
  if [ "$got" = "permitted" ]; then
    ok "row 4e: invariant PERMITS a bin inside \$HOME even when HOME is redirected"
  else
    bad "row 4e: a bin inside \$HOME is always the run's own to write" "got '$got'"
  fi

  # row 4f - THE SYMLINKED FALLBACK. A redirected HOME whose own .local/bin is a link out to
  # the shared bin defeats every LEXICAL containment test: the path still begins with "$HOME/".
  # Found by independent review of the first version of this fix, which had exactly that hole.
  ESCH="$WORKROOT/escape-home"; mkdir -p "$ESCH/.local"
  ln -sfn "$SHARED" "$ESCH/.local/bin"
  got="$(run_permitted "$ESCH" "$REALH" "$ESCH/.local/bin")"
  if [ "$got" = "refused" ]; then
    ok "row 4f: a \$HOME/.local/bin that SYMLINKS to a shared bin is refused, not permitted"
  else
    bad "row 4f: a symlinked fallback out of \$HOME must be refused" \
        "got '$got' - the shims would land in $SHARED while every lexical check passed"
  fi
  # and the selection must refuse to use it at all, not merely fail the invariant afterwards
  got="$(run_choose "$ESCH" "$REALH" "$SHARED" 2>/dev/null || printf 'refused')"
  if [ "$got" = "refused" ] || [ -z "$got" ]; then
    ok "row 4f2: selection refuses to fall back through the symlinked .local/bin"
  else
    bad "row 4f2: selection accepted a fallback that resolves outside \$HOME" "got '$got'"
  fi

  # row 4g - THE PROBE'S EXIT STATUS. A lookup that prints a plausible home and then FAILS must
  # not be believed. Driven with a fake `dscl` on PATH, because this is the one part of the
  # identity check the other rows deliberately stub out.
  sect 'Row 4g - a failed account lookup is not evidence'
  FAKEDSCL="$WORKROOT/fakedscl"; mkdir -p "$FAKEDSCL"
  cat > "$FAKEDSCL/dscl" <<'FD'
#!/bin/sh
# prints a plausible record for whatever HOME is, then fails
echo "NFSHomeDirectory: $HOME"
exit 1
FD
  chmod +x "$FAKEDSCL/dscl"
  probe_script="$WORKROOT/probe.sh"
  {
    printf 'set -uo pipefail\n'
    printf 'HOME=%q\n' "$SANDH"
    printf 'phys_of() { (cd "$1" 2>/dev/null && pwd -P) || printf "%%s" "$1"; }\n'
    printf 'refuse_repo_mkdir() { return 0; }\n'
    cat "$FNFILE"
    printf 'if justify_home_is_real; then printf real; else printf "not-real"; fi\n'
  } > "$probe_script"
  # PATH deliberately excludes getent and python3 so the fake dscl is the only probe that can
  # answer; otherwise a later probe would supply the right answer and hide the defect.
  got="$(PATH="$FAKEDSCL:/bin:/usr/bin" bash "$probe_script" 2>/dev/null)"
  if [ "$got" = "not-real" ]; then
    ok "row 4g: a lookup that prints a home and exits non-zero is NOT accepted as evidence"
  else
    bad "row 4g: output from a failed account lookup was believed" \
        "got '$got' - a redirected HOME would be treated as the real one"
  fi
fi

# ------------------------------------------------------------
sect 'Row 5 - end to end: a redirected HOME must not write a shared bin'

CLONE="$NONTEMP/clone"
if ! cp -Rc "$REPO_DIR" "$CLONE" 2>/dev/null; then
  cp -R "$REPO_DIR" "$CLONE" 2>/dev/null || CLONE=""
fi

if [ -z "$CLONE" ]; then
  bad "row 5: could not clone the repo for an end-to-end run" "cp failed"
else
  FIXBIN="$NONTEMP/fixture-shared-bin"; mkdir -p "$FIXBIN"
  SBHOME="$NONTEMP/e2e-home"; mkdir -p "$SBHOME/.claude" "$SBHOME/.local/bin"
  cp "$SUT" "$CLONE/justify/install.sh"

  # Rewrite ONLY the shared-bin literals so the run cannot reach the real ones. python3
  # rather than `sed -i` because the substitution is COUNTED: the candidate list appears in
  # two shapes across versions, and an expression matching neither would leave the real
  # paths in place and point an end-to-end install at /opt/homebrew/bin. Zero substitutions
  # fails the row instead.
  subs="$(python3 - "$CLONE/justify/install.sh" "$FIXBIN" <<'PY'
import re, sys
path, fix = sys.argv[1], sys.argv[2]
src = open(path, encoding="utf-8").read()
n = 0
for lit in ("/usr/local/bin", "/opt/homebrew/bin"):
    src, k = re.subn(re.escape(lit), fix, src)
    n += k
open(path, "w", encoding="utf-8").write(src)
print(n)
PY
)" || subs=0

  if [ "${subs:-0}" -lt 2 ]; then
    bad "row 5: could not redirect the shared-bin literals (${subs:-0} substitutions)" \
        "refusing to run an end-to-end install that could reach the real shared bin"
  else
    env -i HOME="$SBHOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-u}" \
        TERM=dumb LANG=en_US.UTF-8 \
        bash "$CLONE/justify/install.sh" > "$WORKROOT/e2e.log" 2>&1
    e2e_rc=$?
    planted="$(find "$FIXBIN" -maxdepth 1 -name 'justify-*' 2>/dev/null | wc -l | tr -d ' ')"
    own="$(find "$SBHOME/.local/bin" -maxdepth 1 -name 'justify-*' 2>/dev/null | wc -l | tr -d ' ')"
    # DID THE RUN EVEN GET HERE? "the shared bin was not written" is trivially true of a run
    # that died at the node check, a failed build, or any earlier error - and every one of
    # those is reachable in this fixture. Without this precondition row 5 is a green that
    # reports on shim selection while proving only that shim selection never executed.
    # Flagged by independent review.
    if [ "$own" -eq 0 ] && ! grep -q 'Installed justify-' "$WORKROOT/e2e.log"; then
      bad "row 5: the run never reached the shim stage - nothing was proven about selection" \
          "rc=$e2e_rc; $(grep -iE '^ERROR|is required' "$WORKROOT/e2e.log" | head -2)"
    elif [ "$planted" -eq 0 ]; then
      ok "row 5: reached the shim stage, fixture shared bin untouched (0 justify-*), sandbox bin got $own"
    else
      bad "row 5: THE ESCAPE - $planted justify-* shim(s) planted into the shared bin" \
          "first: $(find "$FIXBIN" -maxdepth 1 -name 'justify-*' | head -1) -> $(readlink "$(find "$FIXBIN" -maxdepth 1 -name 'justify-*' | head -1)" 2>/dev/null)"
    fi
    if [ "$planted" -gt 0 ] && [ "$e2e_rc" -eq 0 ]; then
      bad "row 5b: the escaping run reported SUCCESS (exit 0)" \
          "self-consistent shims in the wrong bin are exactly what makes this defect silent"
    elif [ "$planted" -eq 0 ] && [ "$own" -gt 0 ]; then
      ok "row 5b: no escape, so there is no false green to report (install rc=$e2e_rc)"
    fi
  fi
fi

# ------------------------------------------------------------
sect 'Row 6 - the real property: the LIVE shared bin is untouched by a redirected HOME'

if grep -q '^# >>> justify-shim-bin-selection >>>' "$SUT"; then
  LIVEH="$NONTEMP/live-home"; mkdir -p "$LIVEH/.claude" "$LIVEH/.local/bin"
  lb="$WORKROOT/livebin.before"; la="$WORKROOT/livebin.after"
  snap_live() {
    : > "$1"
    [ -n "$LIVE_BIN" ] || return 0
    for f in "$LIVE_BIN"/justify-*; do
      [ -e "$f" ] || [ -L "$f" ] || continue
      printf '%s\t%s\n' "$f" "$(readlink "$f" 2>/dev/null || printf '(regular file)')" >> "$1"
    done
  }
  snap_live "$lb"
  env -i HOME="$LIVEH" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-u}" \
      TERM=dumb LANG=en_US.UTF-8 \
      bash "$SUT" > "$WORKROOT/live.log" 2>&1
  snap_live "$la"
  live_own="$(find "$LIVEH/.local/bin" -maxdepth 1 -name 'justify-*' 2>/dev/null | wc -l | tr -d ' ')"
  # Same precondition as row 5, same reason: an install that aborted early leaves the live bin
  # untouched for reasons that have nothing to do with the guard under test.
  if [ "$live_own" -eq 0 ] && ! grep -q 'Installed justify-' "$WORKROOT/live.log"; then
    bad "row 6: the run never reached the shim stage - the live bin being unchanged proves nothing" \
        "$(grep -iE '^ERROR|is required' "$WORKROOT/live.log" | head -2)"
  elif cmp -s "$lb" "$la"; then
    ok "row 6: live ${LIVE_BIN:-shared bin} justify-* shims identical after a redirected-HOME install that DID plant $live_own shim(s) into its own HOME ($(wc -l < "$lb" | tr -d ' ') live shims checked)"
  else
    bad "row 6: a redirected-HOME install CHANGED the live shared bin" "$(diff "$lb" "$la" | head -6)"
  fi
  # Control: the comparison is only meaningful if there was something to compare.
  if [ ! -s "$lb" ]; then
    bad "row 6b: control - the live snapshot was EMPTY, so row 6 could not have failed" \
        "no justify-* entries found in ${LIVE_BIN:-none}"
  else
    ok "row 6b: control - live snapshot is non-empty, so row 6 could have failed"
  fi
else
  skipr "row 6: file under test has no HOME-identity guard - deliberately not run" \
        "running it against pristine HEAD would repoint the live shared-bin shims, which is the damage under test"
fi

printf '\n%s\n' "----------------------------------------"
printf 'passed %d   failed %d   skipped %d\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
