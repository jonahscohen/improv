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

# Snapshot the real skills dir up front. Nothing here may change it. A sorted listing
# of the top-level entry names is enough: the prune only ever removes top-level links,
# so a changed entry set is the only way it could have touched the real dir.
REAL_SKILLS="$HOME/.claude/skills"
REAL_BEFORE=""
[ -d "$REAL_SKILLS" ] && REAL_BEFORE=$(ls -1a "$REAL_SKILLS" 2>/dev/null | sort)

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
if [ -d "$REAL_SKILLS" ]; then
  REAL_AFTER=$(ls -1a "$REAL_SKILLS" 2>/dev/null | sort)
  if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then
    pass "real skills dir unchanged"
  else
    fail "real skills dir unchanged" "entry set changed"
  fi
else
  pass "real skills dir absent - nothing to protect"
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
