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

# THE FIXTURE REPO IS A REAL GIT REPO, AND IT HAS TO BE.
# Ownership is proven from the repo's own history: a link is removable only when its
# target path is absent from HEAD, absent from the index, and present at some commit
# reachable from HEAD. A bare mktemp directory can prove none of that, so against a
# non-git fixture EVERY "this dead link IS removed" row below would pass vacuously -
# nothing would ever be removable and the suite would be green while measuring nothing.
git_fixture() {  # <dir> - a git repo with a deterministic identity, no user config
  git init -q -b main "$1" >/dev/null 2>&1 || return 1
  git -C "$1" config user.email prune-fixture@example.invalid
  git -C "$1" config user.name  prune-fixture
  git -C "$1" config commit.gpgsign false
}
git_commit() { git -C "$1" add -A >/dev/null 2>&1; git -C "$1" commit -q -m "$2" >/dev/null 2>&1; }

git_fixture "$FIXREPO" || { echo "FATAL: cannot create the git fixture repo"; exit 1; }
mkdir -p "$FIXREPO/claude/skills/live-skill" "$FIXREPO/claude/skills/gone-skill" \
         "$FIXREPO/claude/skills/improv"     "$FIXREPO/claude/skills/gone-again" \
         "$FIXREPO/claude/skills/ro-gone"    "$FIXREPO/claude/hooks"
printf 'x\n'    > "$FIXREPO/claude/skills/live-skill/SKILL.md"
printf 'gone\n' > "$FIXREPO/claude/skills/gone-skill/SKILL.md"
printf 'imp\n'  > "$FIXREPO/claude/skills/improv/SKILL.md"
printf 'ga\n'   > "$FIXREPO/claude/skills/gone-again/SKILL.md"
printf 'rg\n'   > "$FIXREPO/claude/skills/ro-gone/SKILL.md"
printf 'live\n' > "$FIXREPO/claude/hooks/live-hook.sh"
printf 'ret\n'  > "$FIXREPO/claude/hooks/retired.json"
printf 'rg\n'   > "$FIXREPO/claude/hooks/ro-gone.sh"
printf 'hg\n'   > "$FIXREPO/claude/hooks/hidden-gone.sh"
printf 'ng\n'   > "$FIXREPO/claude/hooks/nested-gone.sh"
git_commit "$FIXREPO" "ship every fixture path"
# THE RETIREMENT. Exactly the paths whose links must be removable, deleted by a later
# commit - the real shape of a retirement, and the only shape the prune accepts as proof.
# live-skill and live-hook.sh deliberately stay, so claude/skills and claude/hooks both
# survive as directories (a vanished source directory is a different, separately covered
# skip reason and would make these rows vacuous).
git -C "$FIXREPO" rm -q -r \
  claude/skills/gone-skill claude/skills/improv claude/skills/gone-again \
  claude/skills/ro-gone claude/hooks/retired.json claude/hooks/ro-gone.sh \
  claude/hooks/hidden-gone.sh claude/hooks/nested-gone.sh >/dev/null 2>&1
git_commit "$FIXREPO" "retire them"

# A LIVE repo-sourced skill (target exists) - must be LEFT ALONE.
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
#
# THE PROBE POINTS AT A GENUINELY RETIRED REAL PATH, and it has to. An invented path like
# __prune_dryrun_probe_missing__ was never tracked by this repo, so under a prune that
# proves ownership from git history it survives whether or not dry-run works - the row
# would be green with the dry-run guard ripped out. claude/hooks/sidecoach-modes.json is
# the real 2026-07-28 retirement: shipped, then deleted. It is a true removal candidate,
# so dry-run is the ONLY thing that can save it.
DR_HOME=$(mktemp -d) || exit 1
DR_LINK="$DR_HOME/.claude/hooks/sidecoach-modes.json"
mkdir -p "$DR_HOME/.claude/hooks"
ln -s "$REPO_ROOT/claude/hooks/sidecoach-modes.json" "$DR_LINK"
DR_OUT=$(HOME="$DR_HOME" bash "$INSTALL_SH" --dry-run --prune-skills-apply 2>&1)
DR_RC=$?
# ANCHOR FIRST. If the run did not IDENTIFY the probe as a removal candidate, the link
# surviving proves nothing about dry-run, and this row must say so rather than pass.
if printf '%s' "$DR_OUT" | grep -q "would remove dead link $DR_LINK"; then
  if [ "$DR_RC" -eq 0 ] && [ -L "$DR_LINK" ]; then
    pass "--dry-run --prune-skills-apply identifies a real candidate and removes NOTHING"
  else
    fail "--dry-run --prune-skills-apply must not mutate" \
         "rc=$DR_RC link=$([ -L "$DR_LINK" ] && echo present || echo GONE)"
  fi
else
  fail "--dry-run probe anchor: the run must identify the retired path as a candidate" \
       "it did not, so a surviving link would prove nothing about dry-run. rc=$DR_RC"
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
mkdir -p "$HOOKS"
ln -s "$FIXREPO/claude/hooks/live-hook.sh" "$HOOKS/live-hook.sh"          # live  -> KEEP
ln -s "$FIXREPO/claude/hooks/retired.json" "$HOOKS/retired.json"          # dead  -> PRUNE
ln -s "$OUTSIDE/real.md" "$HOOKS/external-live.sh"                        # live  -> KEEP
ln -s "$OUTSIDE/gone-forever.sh" "$HOOKS/external-broken.sh"              # dead, NOT ours -> KEEP
printf 'real\n' > "$HOOKS/real-file.sh"                                   # real  -> KEEP
# A dead repo-owned link NESTED one level down. Direct-children-only means this must
# survive: a recursive prune would reach into a subdirectory this installer never
# deploys into. Asserted here because the parent-dir check alone cannot see it.
#
# THE LINK NAME MATCHES ITS TARGET'S BASENAME ON PURPOSE. Named anything else it would
# also be skipped by the basename half of the shape check, and the row would pass without
# direct-children-only being what saved it. Named this way, depth is the ONLY thing
# standing between it and removal - which is exactly the rule under test.
mkdir -p "$HOOKS/__pycache__"
ln -s "$FIXREPO/claude/hooks/nested-gone.sh" "$HOOKS/__pycache__/nested-gone.sh"

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
if [ ! -L "$HOOKS/__pycache__/nested-gone.sh" ]; then
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

echo ""
echo "============================================================"
echo "OWNERSHIP MUST BE PROVEN, NOT INFERRED FROM LOCATION"
echo "============================================================"
# The prune used to accept "the target path is somewhere under $REPO_DIR" as proof that
# THIS INSTALLER deployed the link. That is location, not ownership, and it makes two
# wrong deletions possible. Both are exercised below against a REAL git fixture repo,
# because the proof this needs - what this repo actually shipped, and whether a missing
# path is retired or merely absent for a moment - only exists in git.
#
#   MODE 1  a link the USER made that happens to point into this checkout is deleted.
#   MODE 2  a target that is absent only TEMPORARILY (an unstaged deletion / stash, a
#           mid-rebase, a branch switch or partial checkout, a submodule working tree)
#           reads as retired and the link is deleted.
#
# Every row below plants a link that the OLD rule deletes and the correct rule keeps,
# plus CONTROL rows proving a genuinely retired link is still removed. A suite where the
# safe rows pass because nothing is ever pruned proves nothing, so the controls are not
# optional.
#
# MUTATION COVERAGE, stated so nobody has to assume it. 23 mutations were run against the
# prune, one per safety property, each confirming its anchor applied before any verdict was
# believed. 16 are caught by a row here. The 7 that are not, and why:
#
#   - ONE is the order of the two `stat` probes, which only matters on GNU stat (where -f
#     means filesystem, not format). This suite runs on macOS, where either order works, so
#     no row here can observe it. Called out rather than counted as covered.
#
#   - FOUR are equivalent mutants of the trailing-newline defence. That whole class is
#     decided by ONE load-bearing guard: the stored-target byte-length check, which is
#     caught (by "an ordinary link pointing at a NEWLINE-suffixed target survives").
#     With it in place, reverting the sentinel read, the parameter-expansion basenames, or
#     the explicit newline refusal changes no outcome, because the length check refuses
#     first. They are kept as depth, not claimed as separately tested.
#   - TWO are the halves of the pre-unlink re-check (link still a broken symlink, target
#     still the one that was proven). They guard a link being replaced BETWEEN
#     classification and removal, and a single-threaded suite cannot stage that race
#     deterministically. Kept as depth, deliberately not claimed as tested.
#
# The first mutation run of this suite reported 15 of 15 caught and was WRONG: the mutant
# installer was written to a temp dir, and install.sh derives REPO_DIR from its own
# location, so every CLI-driven row went red for that reason alone and manufactured a
# CAUGHT for mutations nothing actually detected. Mutants now run from the repo root. A
# mutation harness can lie in the flattering direction too.

# --- fixture A: a repo on main, one real retirement in its history ------------------
# git_fixture / git_commit are defined with the main fixture repo above.
GREPO=$(mktemp -d) || exit 1
GHOME=$(mktemp -d) || exit 1
git_fixture "$GREPO" || { echo "FATAL: cannot create a git fixture repo"; exit 1; }
mkdir -p "$GREPO/claude/hooks" "$GREPO/claude/skills/retired-skill" "$GREPO/notes" \
         "$GREPO/sub/claude/hooks" "$GREPO/claude/skills/kept-skill"
printf 'retired\n' > "$GREPO/claude/hooks/retired-hook.sh"
printf 'kept\n'    > "$GREPO/claude/hooks/kept-hook.sh"
printf 'stashed\n' > "$GREPO/claude/hooks/stashed-hook.sh"
printf 'res\n'     > "$GREPO/claude/hooks/resurrected.sh"
printf 'moved\n'   > "$GREPO/claude/hooks/moved-hook.sh"
printf 'nl\n'      > "$GREPO/claude/hooks/nl-hook.sh"
printf 'sd\n'      > "$GREPO/claude/hooks/staged-delete.sh"
printf 'x\n'       > "$GREPO/claude/skills/retired-skill/SKILL.md"
# kept-skill exists only so `git rm -r retired-skill` does not take the now-empty
# claude/skills DIRECTORY with it. A vanished source directory is a different (already
# covered) skip reason, and it would make the retired-skill control row vacuous.
printf 'k\n'       > "$GREPO/claude/skills/kept-skill/SKILL.md"
git_commit "$GREPO" base
git -C "$GREPO" rm -q -r claude/hooks/retired-hook.sh claude/hooks/resurrected.sh \
  claude/hooks/moved-hook.sh claude/hooks/nl-hook.sh claude/skills/retired-skill >/dev/null 2>&1
git_commit "$GREPO" retire
# A deletion that is STAGED BUT NOT COMMITTED: gone from the index and from disk, still
# present in HEAD. Nothing is retired until it is committed, and the HEAD check is the
# only one of the three that can say so - the index no longer has it and history does.
git -C "$GREPO" rm -q claude/hooks/staged-delete.sh >/dev/null 2>&1
# A path being RE-INTRODUCED: staged back into the index, not yet committed, and not on
# disk this instant. Absent from HEAD and present in history, so the index check is the
# ONLY one of the three that can save it - which is what makes it worth a row.
printf 'res\n' > "$GREPO/claude/hooks/resurrected.sh"
git -C "$GREPO" add claude/hooks/resurrected.sh >/dev/null 2>&1
rm -f "$GREPO/claude/hooks/resurrected.sh"
# A gitlink at sub/ makes it a real submodule to git; its working tree is checked out at a
# commit that does not contain the file the link points at.
GHEAD=$(git -C "$GREPO" rev-parse HEAD)
git -C "$GREPO" update-index --add --cacheinfo "160000,$GHEAD,sub" >/dev/null 2>&1
# An unstaged deletion: tracked in HEAD and in the index, gone from the working tree.
# This is what a stash of a deletion, and a checkout interrupted midway, both look like.
rm -f "$GREPO/claude/hooks/stashed-hook.sh"

mkdir -p "$GHOME/.claude/hooks" "$GHOME/.claude/skills"
GH="$GHOME/.claude/hooks"
GS="$GHOME/.claude/skills"
ln -s "$GREPO/claude/hooks/retired-hook.sh" "$GH/retired-hook.sh"   # CONTROL -> prune
ln -s "$GREPO/claude/skills/retired-skill"  "$GS/retired-skill"     # CONTROL -> prune
ln -s "$GREPO/claude/hooks/jonahs-own.sh"   "$GH/jonahs-own.sh"     # MODE 1 -> keep
ln -s "$GREPO/notes/scratch.sh"             "$GH/scratch.sh"        # MODE 1 -> keep
ln -s "$GREPO/claude/hooks/stashed-hook.sh" "$GH/stashed-hook.sh"   # MODE 2 -> keep
ln -s "$GREPO/sub/claude/hooks/sub-hook.sh" "$GH/sub-hook.sh"       # MODE 2 -> keep
ln -s "$GREPO/claude/hooks/resurrected.sh"  "$GH/resurrected.sh"    # MODE 2 -> keep
# A user's ALIAS: a link whose own name differs from the target's basename, pointing at a
# genuinely retired path. Provenance alone would clear it for deletion, so the basename
# half of the shape check is the only thing that saves it.
ln -s "$GREPO/claude/hooks/retired-hook.sh" "$GH/my-alias.sh"       # MODE 1 -> keep
ln -s "$GREPO/claude/hooks/staged-delete.sh" "$GH/staged-delete.sh" # MODE 2 -> keep
# A user's own copy kept OUTSIDE the deploy directory, under a name this repo really did
# retire under claude/hooks. Provenance alone clears it for deletion, because provenance
# is asked about the deploy path; only the parent-equality half of the shape check knows
# the target does not live where this installer deploys from.
ln -s "$GREPO/notes/moved-hook.sh"          "$GH/moved-hook.sh"     # MODE 1 -> keep
# A link whose NAME ends in a newline, pointing at a newline-suffixed target, while the
# newline-STRIPPED path (claude/hooks/retired-hook.sh) is genuinely retired. Command
# substitution eats trailing newlines, so a prune that reaches for $(basename ...) matches
# this against a DIFFERENT path's history and deletes a link the repo never shipped.
NL_LINK="$GH/retired-hook.sh$(printf '\nX')"; NL_LINK="${NL_LINK%X}"
NL_TGT="$GREPO/claude/hooks/retired-hook.sh$(printf '\nX')"; NL_TGT="${NL_TGT%X}"
ln -s "$NL_TGT" "$NL_LINK"                                          # MODE 1 -> keep
# THE ASYMMETRIC CASE, and the one that actually bites: an ORDINARY link name pointing at a
# target whose name ends in a newline, where the newline-STRIPPED path IS retired. The row
# above is caught by the link name alone, so it cannot see this; `readlink` in a command
# substitution eats the target's newline before any guard runs, and the link is then judged
# against a different path's history. Found by cross-model review of the first fix.
NL2_TGT="$GREPO/claude/hooks/nl-hook.sh$(printf '\nX')"; NL2_TGT="${NL2_TGT%X}"
ln -s "$NL2_TGT" "$GH/nl-hook.sh"                                   # MODE 1 -> keep

echo "===== a repo mid-rebase refuses to prune at all ====="
# During a rebase, merge, cherry-pick or bisect the working tree is a transient state and
# an absent file proves nothing. Run BEFORE the apply below, so a run that ignores the
# marker is caught here rather than hidden by the apply that follows.
GITDIR=$(git -C "$GREPO" rev-parse --absolute-git-dir)
mkdir -p "$GITDIR/rebase-merge"
HOME="$GHOME" REPO_DIR="$GREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
REBASE_RC=$?
rmdir "$GITDIR/rebase-merge"
if [ "$REBASE_RC" -eq 9 ] && [ -L "$GH/retired-hook.sh" ]; then
  pass "mid-rebase: prune refuses with 9 and removes nothing (not even a retired link)"
else
  fail "mid-rebase: prune refuses with 9 and removes nothing" \
       "rc=$REBASE_RC retired-hook=$([ -L "$GH/retired-hook.sh" ] && echo present || echo GONE)"
fi

echo "===== apply on a git checkout: retired links go, everything else stays ====="
HOME="$GHOME" REPO_DIR="$GREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
G_RC=$?
if [ "$G_RC" -eq 0 ]; then
  pass "git-backed apply exits 0"
else
  fail "git-backed apply exits 0" "rc=$G_RC"
fi
# CONTROLS - the prune must still do its job, or every row below is vacuous.
if [ ! -e "$GH/retired-hook.sh" ] && [ ! -L "$GH/retired-hook.sh" ]; then
  pass "CONTROL: a genuinely retired hook link is still removed"
else
  fail "CONTROL: a genuinely retired hook link is still removed" "it survived - the rows below prove nothing"
fi
if [ ! -e "$GS/retired-skill" ] && [ ! -L "$GS/retired-skill" ]; then
  pass "CONTROL: a genuinely retired skill link is still removed"
else
  fail "CONTROL: a genuinely retired skill link is still removed" "it survived - the rows below prove nothing"
fi
# MODE 1: the user's own links.
if [ -L "$GH/jonahs-own.sh" ]; then
  pass "MODE 1: a user's own link to an UNTRACKED path in the checkout survives"
else
  fail "MODE 1: a user's own link to an UNTRACKED path in the checkout survives" \
       "deleted a link this repo never shipped - location was read as ownership"
fi
if [ -L "$GH/scratch.sh" ]; then
  pass "MODE 1: a user's own link into a NON-deploy directory of the repo survives"
else
  fail "MODE 1: a user's own link into a NON-deploy directory of the repo survives" \
       "deleted a link outside the installer's deploy footprint"
fi
# MODE 2: absence that is not retirement.
if [ -L "$GH/stashed-hook.sh" ]; then
  pass "MODE 2: a target absent only from the WORKING TREE (stash / partial checkout) survives"
else
  fail "MODE 2: a target absent only from the WORKING TREE survives" \
       "a file still tracked in HEAD and the index was treated as retired"
fi
if [ -L "$GH/sub-hook.sh" ]; then
  # NAMED FOR WHAT IT PROVES. Cross-model review pointed out this row is saved by the
  # shape check (the target's parent is $GREPO/sub/claude/hooks, not the deploy source
  # dir), not by the submodule-history argument the old label claimed. The provenance
  # rule has its own rows: the untracked link and the branch-switch link.
  pass "MODE 2: a target inside a SUBMODULE working tree survives (outside the deploy source dir)"
else
  fail "MODE 2: a target inside a SUBMODULE working tree survives" \
       "a path under a submodule is not in the installer's deploy footprint"
fi
if [ -L "$NL_LINK" ]; then
  pass "MODE 1: a link whose name ends in a NEWLINE survives (no path is silently trimmed)"
else
  fail "MODE 1: a link whose name ends in a NEWLINE survives" \
       "a trailing newline was trimmed and the link was judged against another path's history"
fi
if [ -L "$GH/nl-hook.sh" ]; then
  pass "MODE 1: an ordinary link pointing at a NEWLINE-suffixed target survives"
else
  fail "MODE 1: an ordinary link pointing at a NEWLINE-suffixed target survives" \
       "readlink's trailing newline was eaten and the link was judged against another path's history"
fi
if [ -L "$GH/resurrected.sh" ]; then
  pass "MODE 2: a path staged back into the INDEX but not yet on disk survives"
else
  fail "MODE 2: a path staged back into the INDEX but not yet on disk survives" \
       "a re-introduction in progress was read as a retirement"
fi
if [ -L "$GH/my-alias.sh" ]; then
  pass "MODE 1: a user's ALIAS link (name differs from the target's) survives"
else
  fail "MODE 1: a user's ALIAS link (name differs from the target's) survives" \
       "a link that does not match the installer's deploy shape was deleted"
fi
if [ -L "$GH/staged-delete.sh" ]; then
  pass "MODE 2: a deletion STAGED but not committed survives (still present in HEAD)"
else
  fail "MODE 2: a deletion STAGED but not committed survives" \
       "an uncommitted staged deletion was treated as a retirement"
fi
if [ -L "$GH/moved-hook.sh" ]; then
  pass "MODE 1: a link into a non-deploy directory survives even when the deploy path IS retired"
else
  fail "MODE 1: a link into a non-deploy directory survives even when the deploy path IS retired" \
       "the target's parent was not checked against the deploy source directory"
fi

# --- fixture B: a checkout parked on an older branch --------------------------------
echo "===== a branch that predates a file must not read that file as retired ====="
BREPO=$(mktemp -d) || exit 1
BHOME=$(mktemp -d) || exit 1
git_fixture "$BREPO" || { echo "FATAL: cannot create the branch fixture repo"; exit 1; }
mkdir -p "$BREPO/claude/hooks"
printf 'kept\n'   > "$BREPO/claude/hooks/kept.sh"
printf 'doomed\n' > "$BREPO/claude/hooks/doomed.sh"
git_commit "$BREPO" base
git -C "$BREPO" rm -q claude/hooks/doomed.sh >/dev/null 2>&1
git_commit "$BREPO" "retire doomed.sh"
git -C "$BREPO" branch old >/dev/null 2>&1          # `old` sits at the retirement commit
printf 'later\n' > "$BREPO/claude/hooks/added-later.sh"
git_commit "$BREPO" "add added-later.sh"
git -C "$BREPO" checkout -q old >/dev/null 2>&1     # park the checkout BEFORE that commit
rm -f "$BREPO/claude/hooks/added-later.sh"          # the checkout removes it from disk
mkdir -p "$BHOME/.claude/hooks"
ln -s "$BREPO/claude/hooks/added-later.sh" "$BHOME/.claude/hooks/added-later.sh"  # keep
ln -s "$BREPO/claude/hooks/doomed.sh"      "$BHOME/.claude/hooks/doomed.sh"       # prune
HOME="$BHOME" REPO_DIR="$BREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
B_RC=$?
if [ "$B_RC" -eq 0 ] && [ ! -e "$BHOME/.claude/hooks/doomed.sh" ] && [ ! -L "$BHOME/.claude/hooks/doomed.sh" ]; then
  pass "CONTROL: on the old branch, a link retired in THAT history is still removed"
else
  fail "CONTROL: on the old branch, a link retired in THAT history is still removed" \
       "rc=$B_RC - the row below proves nothing"
fi
if [ -L "$BHOME/.claude/hooks/added-later.sh" ]; then
  pass "MODE 2: a path that never existed in this branch's history survives (partial checkout)"
else
  fail "MODE 2: a path that never existed in this branch's history survives" \
       "a branch switch was read as a retirement"
fi
rm -rf "$BREPO" "$BHOME"

echo "===== a git query that FAILS must not be read as 'the path is absent' ====="
# The three provenance queries are read for emptiness. If a failing git command is allowed
# to return empty, a BROKEN REPO reads as a retirement and the link is deleted - the same
# fail-open shape as the defect this whole section exists to close. A corrupted index makes
# `ls-files` exit non-zero while HEAD and history still answer fine, so the candidate is
# otherwise fully qualified for removal and only the rc check can save it.
CREPO=$(mktemp -d) || exit 1
CHOME=$(mktemp -d) || exit 1
git_fixture "$CREPO" || { echo "FATAL: cannot create the corrupt-index fixture"; exit 1; }
mkdir -p "$CREPO/claude/hooks"
printf 'kept\n' > "$CREPO/claude/hooks/kept.sh"
printf 'doomed\n' > "$CREPO/claude/hooks/doomed.sh"
git_commit "$CREPO" base
git -C "$CREPO" rm -q claude/hooks/doomed.sh >/dev/null 2>&1
git_commit "$CREPO" "retire doomed.sh"
mkdir -p "$CHOME/.claude/hooks"
ln -s "$CREPO/claude/hooks/doomed.sh" "$CHOME/.claude/hooks/doomed.sh"
# ANCHOR: with the index intact this link IS removed. Without that proof, its survival
# after the corruption would say nothing about the rc check.
CANCHOR_HOME=$(mktemp -d) || exit 1
mkdir -p "$CANCHOR_HOME/.claude/hooks"
ln -s "$CREPO/claude/hooks/doomed.sh" "$CANCHOR_HOME/.claude/hooks/doomed.sh"
HOME="$CANCHOR_HOME" REPO_DIR="$CREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
CANCHOR_GONE=$([ -e "$CANCHOR_HOME/.claude/hooks/doomed.sh" ] || [ -L "$CANCHOR_HOME/.claude/hooks/doomed.sh" ] && echo no || echo yes)
rm -rf "$CANCHOR_HOME"
printf 'GARBAGE-NOT-AN-INDEX' > "$(git -C "$CREPO" rev-parse --absolute-git-dir)/index"
C_OUT=$(HOME="$CHOME" REPO_DIR="$CREPO" prune_broken_skill_symlinks apply 2>&1)
C_RC=$?
if [ "$CANCHOR_GONE" != "yes" ]; then
  fail "corrupt-index anchor: the same link IS removed when the index is readable" \
       "it was not, so the row below proves nothing about the rc check"
elif [ -L "$CHOME/.claude/hooks/doomed.sh" ]; then
  pass "a failing git query leaves the link alone instead of reading it as absent (rc=$C_RC)"
else
  fail "a failing git query leaves the link alone" \
       "a broken repo was read as a retirement and the link was deleted (rc=$C_RC)"
fi
# NOT DELETING IS ONLY HALF OF IT. A run that decided nothing must not REPORT like a run
# that found nothing - "no dead repo-deployed links" after skipping every candidate is the
# same false all-clear this whole change exists to stop.
if printf '%s' "$C_OUT" | grep -q "LEFT UNDECIDED"; then
  pass "a run that could not decide says so instead of reporting the directory clean"
else
  fail "a run that could not decide says so instead of reporting the directory clean" \
       "output was: $(printf '%s' "$C_OUT" | tr '\n' ' ' | cut -c1-200)"
fi
rm -rf "$CREPO" "$CHOME"

echo "===== a checkout that is not a git work tree refuses to prune ====="
# No git, no provenance. The prune cannot tell a retirement from a file that was never
# here, so it must remove nothing and say why.
NGREPO=$(mktemp -d) || exit 1
NGHOME=$(mktemp -d) || exit 1
mkdir -p "$NGREPO/claude/hooks" "$NGHOME/.claude/hooks"
ln -s "$NGREPO/claude/hooks/whatever.sh" "$NGHOME/.claude/hooks/whatever.sh"
HOME="$NGHOME" REPO_DIR="$NGREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
NG_RC=$?
if [ "$NG_RC" -eq 8 ] && [ -L "$NGHOME/.claude/hooks/whatever.sh" ]; then
  pass "not a git work tree: returns 8 and prunes nothing"
else
  fail "not a git work tree: returns 8 and prunes nothing" \
       "rc=$NG_RC link=$([ -L "$NGHOME/.claude/hooks/whatever.sh" ] && echo present || echo GONE)"
fi
rm -rf "$NGREPO" "$NGHOME"

echo "===== an UNDECIDED candidate must poison the clean report, not just survive ====="
# The multi-hop and vanished-parent skips are correct - both are unprovable, both leave the
# link alone. But leaving a link alone and then printing "no dead repo-deployed links" is
# still a false all-clear: the run did not examine those candidates, it gave up on them.
# Every "cannot tell" has to reach the summary. Cross-model review found three skips that
# were silent about it.
UD_REPO=$(mktemp -d) || exit 1
UD_HOME=$(mktemp -d) || exit 1
git_fixture "$UD_REPO" || { echo "FATAL: cannot create the undecided fixture"; exit 1; }
mkdir -p "$UD_REPO/claude/hooks"
printf 'kept\n' > "$UD_REPO/claude/hooks/kept.sh"
git_commit "$UD_REPO" base
mkdir -p "$UD_HOME/.claude/hooks"
# multi-hop: an in-repo proxy that is itself a symlink pointing outside
ln -s /nonexistent/outside/ultimate "$UD_REPO/claude/hooks/proxy.sh"
ln -s "$UD_REPO/claude/hooks/proxy.sh" "$UD_HOME/.claude/hooks/proxy.sh"
# vanished parent: the target's whole subtree is gone, so nothing can be canonicalized
ln -s "$UD_REPO/claude/gone-subtree/deep.sh" "$UD_HOME/.claude/hooks/deep.sh"
UD_OUT=$(HOME="$UD_HOME" REPO_DIR="$UD_REPO" prune_broken_skill_symlinks dryrun 2>&1)
UD_RC=$?
UD_SURVIVED=yes
for n in proxy.sh deep.sh; do [ -L "$UD_HOME/.claude/hooks/$n" ] || UD_SURVIVED=no; done
if [ "$UD_SURVIVED" != yes ]; then
  fail "undecided candidates survive AND poison the clean report" "one of them was removed"
elif printf '%s' "$UD_OUT" | grep -q "no dead repo-deployed links"; then
  fail "undecided candidates survive AND poison the clean report" \
       "the summary claimed the directory was clean after giving up on 2 candidates"
elif printf '%s' "$UD_OUT" | grep -q "LEFT UNDECIDED"; then
  pass "undecided candidates survive AND the summary refuses to call the directory clean"
else
  fail "undecided candidates survive AND poison the clean report" \
       "rc=$UD_RC output: $(printf '%s' "$UD_OUT" | tr '\n' ' ' | cut -c1-200)"
fi
rm -rf "$UD_REPO" "$UD_HOME"

echo "===== a BARE repo has no work tree, so it refuses to prune ====="
# A bare repo resolves HEAD perfectly well - the HEAD check alone would wave it through.
# It has no work tree, so there is no deploy source directory to compare a target against
# and nothing about the installer's footprint can be proven. Only the work-tree check
# catches this shape, which is why it gets its own row.
BARESRC=$(mktemp -d) || exit 1
BAREHOME=$(mktemp -d) || exit 1
git_fixture "$BARESRC" || { echo "FATAL: cannot create the bare-repo fixture source"; exit 1; }
mkdir -p "$BARESRC/claude/hooks"
printf 'seed\n' > "$BARESRC/claude/hooks/seed.sh"
git_commit "$BARESRC" seed
BAREREPO=$(mktemp -d) || exit 1
rm -rf "$BAREREPO"
git clone -q --bare "$BARESRC" "$BAREREPO" >/dev/null 2>&1
mkdir -p "$BAREHOME/.claude/hooks"
ln -s "$BAREREPO/claude/hooks/seed.sh" "$BAREHOME/.claude/hooks/seed.sh"
HOME="$BAREHOME" REPO_DIR="$BAREREPO" prune_broken_skill_symlinks apply >/dev/null 2>&1
BARE_RC=$?
if [ "$BARE_RC" -eq 8 ] && [ -L "$BAREHOME/.claude/hooks/seed.sh" ]; then
  pass "a bare repo (HEAD resolves, no work tree) returns 8 and prunes nothing"
else
  fail "a bare repo (HEAD resolves, no work tree) returns 8 and prunes nothing" \
       "rc=$BARE_RC link=$([ -L "$BAREHOME/.claude/hooks/seed.sh" ] && echo present || echo GONE)"
fi
rm -rf "$BARESRC" "$BAREREPO" "$BAREHOME"

echo "===== a REPO_DIR nested inside someone else's checkout refuses to prune ====="
# `rev-parse` succeeds from any directory inside a work tree, so a REPO_DIR that is merely
# NESTED in some other checkout would answer every history query from the WRONG repo - and
# a path that repo never had reads as "never shipped" or, worse, as retired. REPO_DIR must
# be the work tree ROOT or nothing can be proven about it.
OUTER=$(mktemp -d) || exit 1
NSHOME=$(mktemp -d) || exit 1
git_fixture "$OUTER" || { echo "FATAL: cannot create the nested fixture"; exit 1; }
printf 'seed\n' > "$OUTER/seed.txt"
git_commit "$OUTER" seed
mkdir -p "$OUTER/inner/claude/hooks" "$NSHOME/.claude/hooks"
ln -s "$OUTER/inner/claude/hooks/whatever.sh" "$NSHOME/.claude/hooks/whatever.sh"
HOME="$NSHOME" REPO_DIR="$OUTER/inner" prune_broken_skill_symlinks apply >/dev/null 2>&1
NS_RC=$?
if [ "$NS_RC" -eq 8 ] && [ -L "$NSHOME/.claude/hooks/whatever.sh" ]; then
  pass "a REPO_DIR that is not its work tree ROOT returns 8 and prunes nothing"
else
  fail "a REPO_DIR that is not its work tree ROOT returns 8 and prunes nothing" \
       "rc=$NS_RC link=$([ -L "$NSHOME/.claude/hooks/whatever.sh" ] && echo present || echo GONE)"
fi
rm -rf "$OUTER" "$NSHOME"
rm -rf "$GREPO" "$GHOME"

echo ""
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
