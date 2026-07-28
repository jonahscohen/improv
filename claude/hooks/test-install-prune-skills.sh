#!/bin/bash
# Regression tests for install.sh's prune_broken_skill_symlinks.
#
# Run: bash claude/hooks/test-install-prune-skills.sh
#
# What the prune does: remove DEAD skill symlinks under ~/.claude/skills - but ONLY
# the ones THIS repo deployed (the resolved target is inside $REPO_DIR) and ONLY once
# the target is gone. It is DRY-RUN by default; a real removal needs "apply" mode,
# which the installer CLI reaches only via the explicit --prune-skills-apply flag
# (i.e. explicit human approval). An unattended --yes/--only run never applies.
#
# SAFETY: exactly like test-install-hook-deploy.sh, install.sh is sourced with
# IMPROV_INSTALL_LIB_ONLY=1 so the installer body never runs. Every path the prune
# touches is a mktemp -d fixture: $HOME is redirected to a temp dir and $REPO_DIR to
# a temp repo, so the real ~/.claude is never in scope. A snapshot guard at the end
# proves the real skills dir was untouched.
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

# Snapshot the real skills dir up front. Nothing here may change it.
#
# THE OLD SNAPSHOT WAS `ls -1a | sort` AND IT COULD NOT SEE THE DAMAGE IT WAS WATCHING FOR.
# Its comment claimed a changed entry set was the only way the prune could touch the real
# dir. Three ways it could, all of them invisible to a list of top-level NAMES:
#
#   1. absent -> present-and-empty. REAL_BEFORE is the empty string when the directory
#      does not exist, and `ls` of a newly created empty directory also yields the empty
#      string. A bad run that CREATES a real ~/.claude/skills compared equal to never
#      having had one.
#   2. a swapped symlink target. The prune's whole subject is symlinks and where they
#      point; replacing every entry's target while keeping the names is the most likely
#      shape of a real bug here, and names alone are blind to it.
#   3. an entry changing type - a link replaced by a regular file or a directory of the
#      same name.
#
# The snapshot records existence, then per entry: type, path, symlink target, and for
# regular files size and mtime.
#
# IT IS RECURSIVE, not direct-children-only. Scoping it to what the prune is SUPPOSED to
# walk begs the question - a prune that rewrote ~/.claude/skills/foo/SKILL.md would leave a
# direct-children listing reading `dir foo` and pass. The tree is small (under a hundred
# entries), so there is no reason to measure less.
#
# WHAT IT MEASURES, stated exactly, because the row is named after what it can prove:
# existence, every path in the subtree, each entry's type, each symlink's unresolved target,
# and each regular file's size and mtime (anything that is not a dir, symlink or regular
# file is recorded as `other`). It does NOT measure modes, ownership, xattrs, or
# content at a fixed size and mtime. That covers the prune's entire failure class - entries
# removed, entries repointed, entries retyped - and it is deliberately not called proof that
# nothing whatsoever about the tree changed, which it is not.
#
# REAL_SKILLS IS NOT OVERRIDABLE. An earlier version took the path from
# IMPROV_TEST_REAL_SKILLS so the row could be proven against a fixture, which handed anyone
# with that variable set a way to point the safety check at a harmless directory while the
# user's actual skills tree went unguarded - the check would still print PASS. The override
# now adds a SECOND, additional watch path; it can never replace the real one.
REAL_SKILLS="$HOME/.claude/skills"
PROBE_SKILLS="${IMPROV_TEST_REAL_SKILLS:-}"

snapshot_dir() { # <dir> -> a stable, diffable description of the whole subtree
  local d="$1" e rel
  if [ ! -d "$d" ]; then printf 'ABSENT\n'; return 0; fi
  printf 'PRESENT\n'
  find "$d" -mindepth 1 2>/dev/null | LC_ALL=C sort | while IFS= read -r e; do
    rel="${e#"$d"/}"
    if [ -L "$e" ]; then printf 'link %s -> %s\n' "$rel" "$(readlink "$e" 2>/dev/null)"
    elif [ -d "$e" ]; then printf 'dir  %s\n' "$rel"
    elif [ -f "$e" ]; then printf 'file %s %s\n' "$rel" "$(stat -f '%z %m' "$e" 2>/dev/null || stat -c '%s %Y' "$e" 2>/dev/null)"
    else printf 'other %s\n' "$rel"   # socket, fifo, device: not a regular file, and not labelled as one
    fi
  done
}

REAL_BEFORE=$(snapshot_dir "$REAL_SKILLS")
PROBE_BEFORE=""
[ -n "$PROBE_SKILLS" ] && PROBE_BEFORE=$(snapshot_dir "$PROBE_SKILLS")

# Pull in prune_broken_skill_symlinks WITHOUT running the installer.
IMPROV_INSTALL_LIB_ONLY=1
export IMPROV_INSTALL_LIB_ONLY
# shellcheck disable=SC1090
. "$INSTALL_SH"
unset IMPROV_INSTALL_LIB_ONLY
# install.sh runs under `set -euo pipefail`, and sourcing it leaves those flags ON in
# this shell. A test suite must be able to observe a failing case without dying on it.
set +euo pipefail

if ! declare -f prune_broken_skill_symlinks >/dev/null 2>&1; then
  echo "FATAL: sourcing install.sh did not define prune_broken_skill_symlinks"
  exit 1
fi

# --- fixtures -------------------------------------------------------------
# A temp HOME (so the prune targets $TMPHOME/.claude/skills) and a temp repo standing
# in for $REPO_DIR (the footprint boundary). Both are mktemp -d; the real home is never
# touched. OUTSIDE holds a live NON-repo target.
TMPHOME=$(mktemp -d) || exit 1
FIXREPO=$(mktemp -d) || exit 1
OUTSIDE=$(mktemp -d) || exit 1
cleanup() { rm -rf "$TMPHOME" "$FIXREPO" "$OUTSIDE"; }
trap cleanup EXIT

SKILLS="$TMPHOME/.claude/skills"
mkdir -p "$SKILLS"
mkdir -p "$FIXREPO/claude/skills"

# A LIVE repo-sourced skill (target exists) - must be LEFT ALONE.
mkdir -p "$FIXREPO/claude/skills/live-skill"
printf 'x\n' > "$FIXREPO/claude/skills/live-skill/SKILL.md"
ln -s "$FIXREPO/claude/skills/live-skill" "$SKILLS/live-skill"

# A BROKEN repo-sourced skill (target missing, its parent dir still exists) - must be
# REMOVED in apply mode. This is the common case: the skill dir was dropped from the repo.
ln -s "$FIXREPO/claude/skills/gone-skill" "$SKILLS/gone-skill"

# The skills/improv orphan: a repo-sourced broken link - must be REMOVED.
ln -s "$FIXREPO/claude/skills/improv" "$SKILLS/improv"

# A BROKEN repo link whose target's PARENT subtree is ALSO gone. The parent cannot
# be canonicalized, so the prune CANNOT prove the target resolves inside the repo and
# must fail SAFE and LEAVE it (it never prunes on an unprovable target).
ln -s "$FIXREPO/claude/gone-subtree/deep-skill" "$SKILLS/deep-skill"

# A MULTI-HOP broken chain: the skills link points at an in-repo PROXY that is itself
# a symlink pointing OUTSIDE the repo (to a missing path). The immediate target's
# parent is in-repo, but the link's ULTIMATE residence is outside - must be LEFT
# UNTOUCHED (the immediate target is a symlink, so the chain is unprovable).
ln -s /nonexistent/outside/ultimate "$FIXREPO/claude/skills/proxy"   # in-repo proxy -> outside/missing
ln -s "$FIXREPO/claude/skills/proxy" "$SKILLS/multihop"              # skills link -> in-repo proxy

# A NON-repo BROKEN link (target outside the repo) - must be LEFT ALONE.
ln -s /nonexistent/outside/thing "$SKILLS/external-broken"

# A NON-repo LIVE link (target exists, outside the repo) - must be LEFT ALONE.
printf 'y\n' > "$OUTSIDE/real.md"
ln -s "$OUTSIDE/real.md" "$SKILLS/external-live"

# A real directory (a copied skill, not a symlink) - must be LEFT ALONE.
mkdir -p "$SKILLS/real-dir-skill"
printf 'z\n' > "$SKILLS/real-dir-skill/SKILL.md"

run_prune() {  # $1 = mode
  HOME="$TMPHOME" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks "$1"
}

echo "===== dry run (the default) removes NOTHING ====="
# The default mode (no arg) must be dryrun.
HOME="$TMPHOME" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks >/dev/null 2>&1
DRY_RC=$?
run_prune dryrun >/dev/null 2>&1
if [ "$DRY_RC" -eq 0 ]; then
  pass "dry run (default arg) exits 0"
else
  fail "dry run (default arg) exits 0" "rc=$DRY_RC"
fi
DRY_OK=true
for n in live-skill gone-skill improv deep-skill multihop external-broken external-live real-dir-skill; do
  if [ ! -e "$SKILLS/$n" ] && [ ! -L "$SKILLS/$n" ]; then
    DRY_OK=false
    echo "  (dry run wrongly removed $n)"
  fi
done
if [ "$DRY_OK" = true ]; then
  pass "dry run mutated nothing (all 8 planted entries intact)"
else
  fail "dry run mutated nothing" "see above"
fi

echo ""
echo "===== apply removes ONLY dead repo-owned links ====="
run_prune apply
APPLY_RC=$?
if [ "$APPLY_RC" -eq 0 ]; then
  pass "apply exits 0"
else
  fail "apply exits 0" "rc=$APPLY_RC"
fi
# Removed:
if [ ! -L "$SKILLS/gone-skill" ] && [ ! -e "$SKILLS/gone-skill" ]; then
  pass "apply removed the broken repo link (gone-skill)"
else
  fail "apply removed the broken repo link (gone-skill)" "still present"
fi
if [ ! -L "$SKILLS/improv" ] && [ ! -e "$SKILLS/improv" ]; then
  pass "apply removed the skills/improv orphan"
else
  fail "apply removed the skills/improv orphan" "still present"
fi
# Left alone:
if [ -L "$SKILLS/deep-skill" ]; then
  pass "apply LEFT the unprovable link (parent subtree gone) - fail safe, never pruned"
else
  fail "apply LEFT the unprovable link (parent subtree gone)" "it was pruned on an unprovable target"
fi
if [ -L "$SKILLS/multihop" ]; then
  pass "apply LEFT the multi-hop chain (in-repo proxy -> outside) - fail safe, never pruned"
else
  fail "apply LEFT the multi-hop chain (in-repo proxy -> outside)" "pruned though its ultimate target was outside the repo"
fi
if [ -L "$SKILLS/live-skill" ] && [ -e "$SKILLS/live-skill" ]; then
  pass "apply left the LIVE repo link untouched (live-skill)"
else
  fail "apply left the LIVE repo link untouched (live-skill)" "$(ls -l "$SKILLS/live-skill" 2>&1)"
fi
if [ -L "$SKILLS/external-broken" ]; then
  pass "apply left the NON-repo broken link untouched (external-broken)"
else
  fail "apply left the NON-repo broken link untouched (external-broken)" "removed a link outside the repo footprint"
fi
if [ -L "$SKILLS/external-live" ] && [ -e "$SKILLS/external-live" ]; then
  pass "apply left the NON-repo live link untouched (external-live)"
else
  fail "apply left the NON-repo live link untouched (external-live)" "$(ls -l "$SKILLS/external-live" 2>&1)"
fi
if [ -d "$SKILLS/real-dir-skill" ] && [ ! -L "$SKILLS/real-dir-skill" ]; then
  pass "apply left the real copied-skill directory untouched (real-dir-skill)"
else
  fail "apply left the real copied-skill directory untouched" "$(ls -ld "$SKILLS/real-dir-skill" 2>&1)"
fi

echo ""
echo "===== apply is idempotent (a second run is a clean no-op) ====="
run_prune apply
RC2=$?
if [ "$RC2" -eq 0 ] && [ -L "$SKILLS/live-skill" ] && [ ! -e "$SKILLS/gone-skill" ]; then
  pass "second apply still exits 0 and leaves the live link in place"
else
  fail "second apply is a clean no-op" "rc=$RC2"
fi

echo ""
echo "===== an unresolvable REPO_DIR refuses to prune (distinct exit code 5) ====="
# Re-plant a dead repo link, then point REPO_DIR at a path that does not exist: the
# footprint boundary is unknowable, so the prune must remove nothing and fail loudly.
ln -s "$FIXREPO/claude/skills/gone-again" "$SKILLS/gone-again"
HOME="$TMPHOME" REPO_DIR="/nonexistent/repo/$$" prune_broken_skill_symlinks apply >/dev/null 2>&1
RC_REFUSE=$?
if [ "$RC_REFUSE" -eq 5 ] && [ -L "$SKILLS/gone-again" ]; then
  pass "unresolvable REPO_DIR returns 5 and prunes nothing"
else
  fail "unresolvable REPO_DIR returns 5 and prunes nothing" "rc=$RC_REFUSE link=$([ -L "$SKILLS/gone-again" ] && echo present || echo gone)"
fi

echo ""
echo "===== apply returns 6 (fail-loud) when a removal cannot complete ====="
# A broken, in-repo link (a real candidate) sitting in a READ-ONLY skills dir: the
# link is enumerated and classified for removal, but the unlink fails because the
# parent dir is not writable. The prune must surface that as exit 6, not swallow it.
RO_HOME=$(mktemp -d) || exit 1
RO_SKILLS="$RO_HOME/.claude/skills"
mkdir -p "$RO_SKILLS"
ln -s "$FIXREPO/claude/skills/ro-gone" "$RO_SKILLS/ro-gone"   # broken, resolves in-repo
chmod -w "$RO_SKILLS"                                          # read-only parent: unlink must fail
HOME="$RO_HOME" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
RC6=$?
chmod +w "$RO_SKILLS"                                          # restore so cleanup can remove it
if [ "$RC6" -eq 6 ] && [ -L "$RO_SKILLS/ro-gone" ]; then
  pass "apply returns 6 when a removal fails, and leaves the link in place"
else
  fail "apply returns 6 when a removal fails" "rc=$RC6 link=$([ -L "$RO_SKILLS/ro-gone" ] && echo present || echo gone)"
fi
rm -rf "$RO_HOME"

echo ""
echo "===== a global --dry-run forces the prune to dry-run (dry-run beats apply) ====="
# Drives the real installer CLI: --dry-run together with --prune-skills-apply must
# NOT destroy - the global dry-run wins. REPO_DIR inside install.sh resolves to the
# real repo root, so the planted candidate points at a missing path under it.
DR_HOME=$(mktemp -d) || exit 1
mkdir -p "$DR_HOME/.claude/skills"
ln -s "$REPO_ROOT/claude/skills/__prune_dryrun_probe_missing__" "$DR_HOME/.claude/skills/__prune_dryrun_probe__"
HOME="$DR_HOME" bash "$INSTALL_SH" --dry-run --prune-skills-apply >/dev/null 2>&1
DR_RC=$?
if [ "$DR_RC" -eq 0 ] && [ -L "$DR_HOME/.claude/skills/__prune_dryrun_probe__" ]; then
  pass "--dry-run --prune-skills-apply exits 0 and removes NOTHING (dry-run wins over apply)"
else
  fail "--dry-run --prune-skills-apply must not mutate" "rc=$DR_RC link=$([ -L "$DR_HOME/.claude/skills/__prune_dryrun_probe__" ] && echo present || echo gone)"
fi
rm -rf "$DR_HOME"

echo ""
echo "===== SAFETY: the real ~/.claude/skills was never touched ====="
# No `if [ -d ... ]` wrapper any more. The old form skipped the check entirely when the
# directory did not exist, which is precisely the absent -> created case it most needed to
# catch: a run that conjured a real ~/.claude/skills reported "nothing to protect" and
# passed. snapshot_dir encodes absence as a value, so both states are compared the same way.
snap_delta() { # <before> <after> -> the changed lines, truncated for a one-line hint
  diff <(printf '%s\n' "$1") <(printf '%s\n' "$2") 2>/dev/null \
    | grep -E '^[<>]' | tr '\n' ' ' | cut -c1-400
}

REAL_AFTER=$(snapshot_dir "$REAL_SKILLS")
if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then
  pass "real skills dir: no entry added, removed, retyped or repointed ($(printf '%s' "$REAL_BEFORE" | head -1))"
else
  # The delta is printed, not just asserted. "entry set changed" sent the reader back to
  # re-derive what moved; a symlink whose TARGET was rewritten is invisible without it.
  fail "real skills dir: no entry added, removed, retyped or repointed" "delta: $(snap_delta "$REAL_BEFORE" "$REAL_AFTER")"
fi

# The additional fixture watch, present only when IMPROV_TEST_REAL_SKILLS is set. This is
# what makes the row above provable - a mutation harness points this at a directory it can
# safely mutate mid-run - without ever letting the env var take the real tree out of scope.
if [ -n "$PROBE_SKILLS" ]; then
  PROBE_AFTER=$(snapshot_dir "$PROBE_SKILLS")
  if [ "$PROBE_BEFORE" = "$PROBE_AFTER" ]; then
    pass "probe skills dir unchanged ($(printf '%s' "$PROBE_BEFORE" | head -1))"
  else
    fail "probe skills dir unchanged" "delta: $(snap_delta "$PROBE_BEFORE" "$PROBE_AFTER")"
  fi
fi

echo ""
echo "============================================================"

# --- the HOOKS directory is the same class, and was never covered -----------------
# A hook file RETIRED from the repo leaves its symlink behind in ~/.claude/hooks exactly
# the way a retired skill does, and nothing removed it. Found live 2026-07-28:
# ~/.claude/hooks/sidecoach-modes.json still pointed at claude/hooks/sidecoach-modes.json,
# deleted during the modes/vocab collapse - one dangling link out of 125 repo-owned ones.
#
# The instance is a one-off. The GAP IS NOT: the prune existed for ~/.claude/skills only,
# so every future retirement under hooks/ leaves the same residue.
#
# EVERY SAFETY RULE IS RE-PROVEN HERE RATHER THAN ASSUMED TO CARRY OVER. An earlier
# version of this block asserted only that a dead link was removed and that live entries
# survived an APPLY, which left dry-run, rc=6 and direct-children-only unproven for this
# directory - cross-model review showed a hooks-specific mutation that ignored dry-run
# kept the suite green. A rule that holds in one directory is not evidence about another.
HOOKS="$TMPHOME/.claude/hooks"
mkdir -p "$HOOKS" "$FIXREPO/claude/hooks"
printf 'live\n' > "$FIXREPO/claude/hooks/live-hook.sh"
ln -s "$FIXREPO/claude/hooks/live-hook.sh" "$HOOKS/live-hook.sh"          # live  -> KEEP
ln -s "$FIXREPO/claude/hooks/retired.json" "$HOOKS/retired.json"          # dead  -> PRUNE
ln -s "$OUTSIDE/real.md" "$HOOKS/external-live.sh"                        # live  -> KEEP
ln -s "$OUTSIDE/gone-forever.sh" "$HOOKS/external-broken.sh"              # dead, NOT ours -> KEEP
printf 'real\n' > "$HOOKS/real-file.sh"                                   # real  -> KEEP
# A dead repo-owned link NESTED one level down. Direct-children-only means this must
# survive: a recursive prune would reach into a subdirectory this installer never
# deploys into. Asserted here because the parent-dir check alone cannot see it.
mkdir -p "$HOOKS/__pycache__"
ln -s "$FIXREPO/claude/hooks/nested-gone.sh" "$HOOKS/__pycache__/nested.sh"

echo "===== hooks: DRY RUN removes nothing ====="
# Proven BEFORE the apply below. Without this row a hooks-specific bug that ignored mode
# entirely would pass, because the apply that follows would hide it.
HOME="$TMPHOME" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks dryrun >/dev/null 2>&1
HDRY_RC=$?
if [ "$HDRY_RC" -eq 0 ] && [ -L "$HOOKS/retired.json" ]; then
  pass "hooks prune: dry run exits 0 and removes nothing"
else
  fail "hooks prune: dry run exits 0 and removes nothing" "rc=$HDRY_RC link=$([ -L "$HOOKS/retired.json" ] && echo present || echo GONE)"
fi

echo "===== dead links under ~/.claude/hooks are pruned too ====="
HOME="$TMPHOME" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
HOOK_RC=$?
if [ "$HOOK_RC" -eq 0 ]; then
  pass "hooks prune: apply exits 0"
else
  fail "hooks prune: apply exits 0" "rc=$HOOK_RC"
fi
# "not a symlink" is not "gone" - a prune that replaced the link with a regular file
# would satisfy the weaker check. Assert the path is absent by both tests.
if [ ! -e "$HOOKS/retired.json" ] && [ ! -L "$HOOKS/retired.json" ]; then
  pass "hooks prune: a retired repo-owned link is removed"
else
  fail "hooks prune: a retired repo-owned link is removed" "sidecoach-modes.json class still survives an apply"
fi
HOOK_KEEP=true
for n in live-hook.sh external-live.sh external-broken.sh real-file.sh __pycache__; do
  if [ ! -e "$HOOKS/$n" ] && [ ! -L "$HOOKS/$n" ]; then
    fail "hooks prune: leaves $n alone" "it was removed"; HOOK_KEEP=false
  fi
done
if [ ! -L "$HOOKS/__pycache__/nested.sh" ]; then
  fail "hooks prune: direct children only" "it reached into a subdirectory"; HOOK_KEEP=false
fi
$HOOK_KEEP && pass "hooks prune: live, foreign, real, nested and directory entries all left alone"

echo "===== hooks: an rm failure returns 6, with NO skills dir present ====="
# The existing rc=6 fixture only exercises skills. This one proves the failure path is
# reached for the hooks directory specifically, and that a missing FIRST directory does
# not swallow it.
H6=$(mktemp -d) || exit 1
mkdir -p "$H6/.claude/hooks"
ln -s "$FIXREPO/claude/hooks/ro-gone.sh" "$H6/.claude/hooks/ro-gone.sh"
chmod -w "$H6/.claude/hooks"
HOME="$H6" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
H6_RC=$?
if [ "$H6_RC" -eq 6 ] && [ -L "$H6/.claude/hooks/ro-gone.sh" ]; then
  pass "hooks prune: rm failure returns 6 and leaves the link"
else
  fail "hooks prune: rm failure returns 6 and leaves the link" "rc=$H6_RC"
fi
chmod +w "$H6/.claude/hooks" 2>/dev/null; rm -rf "$H6"

echo "===== an UNREADABLE prune dir is an error, not a clean report ====="
# `-d` is true for a directory we cannot list; the glob then yields nothing and the run
# would report "no dead links" having examined none. A silent false negative in a tool
# whose only job is finding things.
H7=$(mktemp -d) || exit 1
mkdir -p "$H7/.claude/hooks"
ln -s "$FIXREPO/claude/hooks/hidden-gone.sh" "$H7/.claude/hooks/hidden-gone.sh"
chmod 000 "$H7/.claude/hooks"
HOME="$H7" REPO_DIR="$FIXREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
H7_RC=$?
chmod 755 "$H7/.claude/hooks" 2>/dev/null
if [ "$H7_RC" -eq 7 ] && [ -L "$H7/.claude/hooks/hidden-gone.sh" ]; then
  pass "prune: an unreadable directory returns 7 instead of reporting clean"
else
  fail "prune: an unreadable directory returns 7 instead of reporting clean" "rc=$H7_RC"
fi
rm -rf "$H7"
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
