#!/bin/bash
# Regression tests for install.sh's SKILL DEPLOYMENT path:
#   install_bundled_skill   - deploys a repo skill dir into ~/.claude/skills
#   verify_installed_skills - proves an installed skill still matches its repo source
#
# Run: bash claude/hooks/test-install-skill-deploy.sh
#
# WHY THIS SUITE EXISTS, measured 2026-07-28: every ~/.claude/skills/* entry except
# sidecoach was a real COPY, and every one of them had drifted from its repo source.
# Editing a SKILL.md therefore changed nothing the model reads, and NOTHING anywhere
# could tell a correctly-installed copy from a silently stale one. The installer
# printed "installed" either way. This suite is the detector for that failure class.
#
# WHAT IS DELIBERATELY NOT TESTED AS "SYMLINK EVERYTHING": copy deployment is a
# LEGITIMATE mode. hook_deploy_mode returns `copy` for a repo in a temp location -
# the documented `git clone /tmp/improv && ./install.sh && rm -rf /tmp/improv` case,
# where a symlink would dangle into a deleted clone. The row named
# "temp repo keeps COPY mode" pins that: install_bundled_skill must RESPECT the mode,
# never override it. The answer to a legitimate copy install is the VERIFY step, not
# a link.
#
# SAFETY: install.sh is sourced with IMPROV_INSTALL_LIB_ONLY=1 so the installer body
# never runs. Every path touched is a mktemp -d fixture - $HOME is redirected to a
# temp dir and $REPO_DIR to a temp repo, so the real ~/.claude is never in scope.
# A snapshot guard at the end proves the real skills dir was untouched.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
# Overridable so the suite can be pointed at a MUTATED or PRISTINE-HEAD installer to
# prove it goes red. A suite that passes against the broken tree proves nothing.
INSTALL_SH="${INSTALL_SH:-$REPO_ROOT/install.sh}"

[ -f "$INSTALL_SH" ] || { echo "cannot find install.sh at $INSTALL_SH"; exit 1; }

PASS=0
FAIL=0
FAIL_LABELS=()
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1  ($2)"; FAIL_LABELS+=("$1"); FAIL=$((FAIL + 1)); }

# ------------------------------------------------------------
# Safety snapshot of the REAL skills tree. Nothing in this suite may change it.
# Records existence, every path in the subtree, each entry's type, each symlink's
# unresolved target, and each regular file's size and mtime.
# ------------------------------------------------------------
REAL_SKILLS="$HOME/.claude/skills"
snapshot_dir() {
  local d="$1" e rel
  if [ ! -d "$d" ]; then printf 'ABSENT\n'; return 0; fi
  printf 'PRESENT\n'
  find "$d" -mindepth 1 2>/dev/null | LC_ALL=C sort | while IFS= read -r e; do
    rel="${e#"$d"/}"
    if [ -L "$e" ]; then printf 'link %s -> %s\n' "$rel" "$(readlink "$e" 2>/dev/null)"
    elif [ -d "$e" ]; then printf 'dir  %s\n' "$rel"
    elif [ -f "$e" ]; then printf 'file %s %s\n' "$rel" "$(stat -f '%z %m' "$e" 2>/dev/null || stat -c '%s %Y' "$e" 2>/dev/null)"
    else printf 'other %s\n' "$rel"
    fi
  done
}
REAL_BEFORE="$(snapshot_dir "$REAL_SKILLS")"

# ------------------------------------------------------------
# Source the installer's function library only.
# ------------------------------------------------------------
# shellcheck disable=SC1090
IMPROV_INSTALL_LIB_ONLY=1 . "$INSTALL_SH"
# install.sh runs `set -euo pipefail` at the top, and sourcing it turns those on in
# THIS shell. Every row below deliberately runs a function that returns non-zero and
# then reads $? - under `set -e` the first such row would kill the suite silently,
# reporting far fewer rows than it ran. Turn them back off after sourcing.
set +e
set +u
set +o pipefail

if declare -f verify_installed_skills >/dev/null 2>&1; then
  pass "verify_installed_skills is defined in the sourceable library region"
else
  fail "verify_installed_skills is defined in the sourceable library region" \
       "function not found - a verify step that cannot be sourced cannot be tested"
fi
if declare -f install_bundled_skill >/dev/null 2>&1; then
  pass "install_bundled_skill is defined in the sourceable library region"
else
  fail "install_bundled_skill is defined in the sourceable library region" \
       "function not found (it is defined after the IMPROV_INSTALL_LIB_ONLY guard)"
fi

# Every row below calls one of the two functions. If they are missing, bash reports
# "command not found" and rc=127, which is neither 0, 1 nor 2 - so the rows fail
# rather than passing vacuously. That is the intended behaviour against a pristine
# HEAD checkout.

# ------------------------------------------------------------
# Fixture builder: a temp repo with three skill shapes and a temp HOME.
#   alpha - single file (the common case)
#   beta  - two files  (the motion-reference shape: SKILL.md + VOCABULARY.md)
#   gamma - nested     (the visual-effects shape: subdirectories of source)
# ------------------------------------------------------------
FIXTURES=()
new_fixture() {
  FIX_REPO="$(mktemp -d)" || exit 1
  FIX_HOME="$(mktemp -d)" || exit 1
  FIXTURES+=("$FIX_REPO" "$FIX_HOME")
  mkdir -p "$FIX_REPO/claude/skills/alpha"
  printf 'alpha skill body\n' > "$FIX_REPO/claude/skills/alpha/SKILL.md"
  mkdir -p "$FIX_REPO/claude/skills/beta"
  printf 'beta skill body\n' > "$FIX_REPO/claude/skills/beta/SKILL.md"
  printf 'beta vocabulary\n' > "$FIX_REPO/claude/skills/beta/VOCABULARY.md"
  mkdir -p "$FIX_REPO/claude/skills/gamma/shaders/spiral" "$FIX_REPO/claude/skills/gamma/fx"
  printf 'gamma skill body\n' > "$FIX_REPO/claude/skills/gamma/SKILL.md"
  printf 'spiral fragment\n' > "$FIX_REPO/claude/skills/gamma/shaders/spiral/fragment.glsl"
  printf 'gamma fx note\n' > "$FIX_REPO/claude/skills/gamma/fx/art.md"
  # A .git marker is REQUIRED for the copy-mode row to mean what it says. Without it
  # hook_deploy_mode returns `copy` merely because the fixture is not a checkout, so
  # the row would pass even if the temp-location branch were deleted outright. The
  # hard case is exactly a GIT CHECKOUT that happens to live under $TMPDIR - the
  # throwaway clone - and only a fixture with a .git exercises it.
  mkdir -p "$FIX_REPO/.git"
  mkdir -p "$FIX_HOME/.claude/skills"
}
cleanup_fixtures() { for d in "${FIXTURES[@]}"; do rm -rf "$d"; done; }

# Run a library function against the fixture. HOME and REPO_DIR are set per-call so
# no state leaks between rows.
run_v() { # verify_installed_skills with fixture env; echoes nothing, returns rc
  HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
    verify_installed_skills "$@" >/dev/null 2>&1
}
run_i() { # install_bundled_skill with fixture env
  HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
    install_bundled_skill "$@" >/dev/null 2>&1
}
# Deploy a skill the way a COPY-mode installer would, without going through the
# function under test - so the verify rows are independent of the install rows.
plant_copy() { # <skill>
  local n="$1" f rel
  mkdir -p "$FIX_HOME/.claude/skills/$n"
  while IFS= read -r f; do
    rel="${f#"$FIX_REPO/claude/skills/$n"/}"
    mkdir -p "$FIX_HOME/.claude/skills/$n/$(dirname "$rel")"
    cp "$f" "$FIX_HOME/.claude/skills/$n/$rel"
  done < <(find "$FIX_REPO/claude/skills/$n" -type f)
}

echo "===== verify: exit-code contract ====="

# --- rc 0: a clean copy install
new_fixture
plant_copy alpha
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: a clean installed copy exits 0"
else fail "verify: a clean installed copy exits 0" "rc=$RC"; fi

# --- rc 1: a STALE installed copy (the live defect)
printf 'alpha skill body EDITED IN REPO\n' > "$FIX_REPO/claude/skills/alpha/SKILL.md"
run_v; RC=$?
if [ "$RC" -eq 1 ]; then pass "verify: a STALE installed copy exits 1"
else fail "verify: a STALE installed copy exits 1" "rc=$RC - a drifted copy reported clean"; fi

# --- the stale row must not be an artifact of which side changed
new_fixture
plant_copy alpha
printf 'installed copy hand-edited in place\n' > "$FIX_HOME/.claude/skills/alpha/SKILL.md"
run_v; RC=$?
if [ "$RC" -eq 1 ]; then pass "verify: an installed copy hand-edited in place exits 1"
else fail "verify: an installed copy hand-edited in place exits 1" "rc=$RC"; fi

# --- rc 1: a MISSING file inside an installed skill
new_fixture
plant_copy beta
rm -f "$FIX_HOME/.claude/skills/beta/VOCABULARY.md"
run_v; RC=$?
if [ "$RC" -eq 1 ]; then pass "verify: a missing file inside an installed skill exits 1"
else fail "verify: a missing file inside an installed skill exits 1" "rc=$RC - only SKILL.md was checked"; fi

# --- rc 1: a nested file drifting (the visual-effects shape)
new_fixture
plant_copy gamma
printf 'spiral fragment TAMPERED\n' > "$FIX_HOME/.claude/skills/gamma/shaders/spiral/fragment.glsl"
run_v; RC=$?
if [ "$RC" -eq 1 ]; then pass "verify: a drifted NESTED file exits 1"
else fail "verify: a drifted NESTED file exits 1" "rc=$RC - the walk is not recursive"; fi

# --- rc 1: a DANGLING symlink (the risk a link-mode install carries)
new_fixture
mkdir -p "$FIX_HOME/.claude/skills/alpha"
ln -s "$FIX_REPO/claude/skills/alpha/GONE.md" "$FIX_HOME/.claude/skills/alpha/SKILL.md"
run_v; RC=$?
if [ "$RC" -eq 1 ]; then pass "verify: a dangling symlink exits 1"
else fail "verify: a dangling symlink exits 1" "rc=$RC"; fi

# --- rc 0: a CORRECT symlink is clean (link mode must not be reported as drift)
new_fixture
mkdir -p "$FIX_HOME/.claude/skills/alpha"
ln -s "$FIX_REPO/claude/skills/alpha/SKILL.md" "$FIX_HOME/.claude/skills/alpha/SKILL.md"
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: a correct symlink exits 0"
else fail "verify: a correct symlink exits 0" "rc=$RC - link-mode installs falsely reported stale"; fi

# --- rc 2: usage - a skill name with no repo source
new_fixture
run_v no-such-skill; RC=$?
if [ "$RC" -eq 2 ]; then pass "verify: an unknown skill name exits 2 (usage)"
else fail "verify: an unknown skill name exits 2 (usage)" "rc=$RC"; fi

# --- rc 2: usage - the repo has no skills directory at all
new_fixture
rm -rf "$FIX_REPO/claude/skills"
run_v; RC=$?
if [ "$RC" -eq 2 ]; then pass "verify: a repo with no skills dir exits 2 (usage)"
else fail "verify: a repo with no skills dir exits 2 (usage)" "rc=$RC"; fi

# --- usage and drift must be DISTINGUISHABLE, not collapsed into one non-zero
new_fixture
plant_copy alpha
printf 'drifted\n' > "$FIX_HOME/.claude/skills/alpha/SKILL.md"
run_v; DRIFT_RC=$?
run_v no-such-skill; USAGE_RC=$?
if [ "$DRIFT_RC" -ne "$USAGE_RC" ] && [ "$DRIFT_RC" -eq 1 ] && [ "$USAGE_RC" -eq 2 ]; then
  pass "verify: drift (1) and usage (2) are distinct exit codes"
else
  fail "verify: drift (1) and usage (2) are distinct exit codes" "drift=$DRIFT_RC usage=$USAGE_RC"
fi

# --- an UNREADABLE source dir must not read as clean. Flagged by Codex: `find` inside
#     process substitution throws its exit status away, so a walk that listed nothing
#     (or a subset) produced zero problems and a CLEAN verdict for files never checked.
new_fixture
plant_copy alpha
chmod 000 "$FIX_REPO/claude/skills/alpha"
run_v; RC=$?
chmod 755 "$FIX_REPO/claude/skills/alpha" 2>/dev/null
if [ "$RC" -eq 1 ]; then pass "verify: an unreadable source dir exits 1, not clean"
else fail "verify: an unreadable source dir exits 1, not clean" "rc=$RC - reported clean having checked nothing"; fi

# --- a NEWLINE in a filename must not be read as a record separator (Codex round 2).
#     A newline-delimited walk splits one real path into two paths that do not exist.
new_fixture
printf 'nl body\n' > "$FIX_REPO/claude/skills/alpha/we$(printf '\n')ird.md"
plant_copy alpha
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: a file name containing a NEWLINE is one path, not two"
else fail "verify: a file name containing a NEWLINE is one path, not two" "rc=$RC - the walk split the name"; fi

# --- an EXEMPT skill (installed form is templated on purpose) must not be reported
#     stale. lotus/install.sh rewrites __LOTUS_SRC__ at install time, so a HEALTHY
#     lotus install differs from source by design.
new_fixture
mkdir -p "$FIX_REPO/claude/skills/lotus" "$FIX_HOME/.claude/skills/lotus"
printf 'path is __LOTUS_SRC__\n' > "$FIX_REPO/claude/skills/lotus/SKILL.md"
printf 'path is /real/vendored/path\n' > "$FIX_HOME/.claude/skills/lotus/SKILL.md"
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: a templated (exempt) skill is not reported stale"
else fail "verify: a templated (exempt) skill is not reported stale" "rc=$RC - false positive on a healthy install"; fi

# --- an UNTRAVERSABLE installed root must be an error, never "0 skills, clean"
new_fixture
plant_copy alpha
chmod 000 "$FIX_HOME/.claude/skills"
run_v; RC=$?
chmod 755 "$FIX_HOME/.claude/skills" 2>/dev/null
# Positive control in the SAME fixture: with the root readable again this must be
# clean. Without it, "non-zero" would also be satisfied by the function not existing
# at all, which is how this row passed against pristine HEAD.
run_v; CTRL=$?
if [ "$RC" -ne 0 ] && [ "$CTRL" -eq 0 ]; then
  pass "verify: an untraversable installed root errors instead of reporting clean"
else
  fail "verify: an untraversable installed root errors instead of reporting clean" \
       "unreadable_rc=$RC readable_control_rc=$CTRL"
fi

echo "===== verify: scope - what it must NOT fail on ====="

# A skill installed from somewhere else entirely (justify has no claude/skills source)
# is not this installer's business and must not be reported as drift.
new_fixture
plant_copy alpha
mkdir -p "$FIX_HOME/.claude/skills/foreign"
printf 'not ours\n' > "$FIX_HOME/.claude/skills/foreign/SKILL.md"
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: a foreign installed skill with no repo source is ignored"
else fail "verify: a foreign installed skill with no repo source is ignored" "rc=$RC"; fi

# A repo skill that was never installed (component not picked) is skipped in a
# no-argument sweep - a la carte components would otherwise fail every run.
new_fixture
plant_copy alpha
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: an un-installed repo skill is skipped in a no-arg sweep"
else fail "verify: an un-installed repo skill is skipped in a no-arg sweep" "rc=$RC - beta/gamma were not installed"; fi

# But naming it explicitly means it was expected, so absent is a failure.
run_v beta; RC=$?
if [ "$RC" -eq 1 ]; then pass "verify: an explicitly named but un-installed skill exits 1"
else fail "verify: an explicitly named but un-installed skill exits 1" "rc=$RC"; fi

# A skill directory whose NAME contains a space must not word-split into two names
# that are each "unknown". Found by probing rather than by review: the first cut
# collected names into a space-joined string, and this fixture turned a real drift
# report into a usage error about a skill nobody named.
new_fixture
mkdir -p "$FIX_REPO/claude/skills/two words" "$FIX_HOME/.claude/skills/two words"
printf 'source\n' > "$FIX_REPO/claude/skills/two words/SKILL.md"
printf 'DRIFTED\n' > "$FIX_HOME/.claude/skills/two words/SKILL.md"
# The exit code alone is NOT evidence here, and the mutation control is what proved it:
# a word-splitting version also returns 1, because each fragment ("two", "words") is
# reported as a skill that is NOT INSTALLED. Both versions exit 1 for opposite reasons.
# So this asserts on the MESSAGE - the real name, named as STALE.
SPACE_OUT="$(HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  verify_installed_skills 2>&1)"
run_v; RC=$?
case "$SPACE_OUT" in
  *"two words/SKILL.md is STALE"*) SPACE_NAMED=1 ;;
  *) SPACE_NAMED=0 ;;
esac
case "$SPACE_OUT" in
  *"NOT INSTALLED"*) SPACE_SPLIT=1 ;;
  *) SPACE_SPLIT=0 ;;
esac
if [ "$RC" -eq 1 ] && [ "$SPACE_NAMED" -eq 1 ] && [ "$SPACE_SPLIT" -eq 0 ]; then
  pass "verify: a skill name containing a space is reported STALE under its real name"
else
  fail "verify: a skill name containing a space is reported STALE under its real name" \
       "rc=$RC named=$SPACE_NAMED split_into_fragments=$SPACE_SPLIT"
fi

# A file name containing a space is compared as one path, not two.
new_fixture
mkdir -p "$FIX_REPO/claude/skills/alpha" "$FIX_HOME/.claude/skills/alpha"
printf 'a\n' > "$FIX_REPO/claude/skills/alpha/SKILL.md"
printf 'b\n' > "$FIX_REPO/claude/skills/alpha/my notes.md"
cp "$FIX_REPO/claude/skills/alpha/SKILL.md" "$FIX_HOME/.claude/skills/alpha/SKILL.md"
# rc=1 alone is NOT evidence: an implementation that split the name into "my" and
# "notes.md" would report two bogus missing files and also exit 1. Assert the whole
# name appears in one message, and that no fragment does.
SP_OUT="$(HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  verify_installed_skills 2>&1)"
run_v; RC=$?
case "$SP_OUT" in *"alpha/my notes.md is MISSING"*) SP_WHOLE=1 ;; *) SP_WHOLE=0 ;; esac
case "$SP_OUT" in *"alpha/notes.md"*|*"alpha/my is"*) SP_FRAG=1 ;; *) SP_FRAG=0 ;; esac
if [ "$RC" -eq 1 ] && [ "$SP_WHOLE" -eq 1 ] && [ "$SP_FRAG" -eq 0 ]; then
  pass "verify: a file name containing a space is checked as one path"
else
  fail "verify: a file name containing a space is checked as one path" \
       "rc=$RC whole_name_reported=$SP_WHOLE fragment_reported=$SP_FRAG"
fi

# A user's own extra file inside a skill dir is not drift.
new_fixture
plant_copy alpha
printf 'user note\n' > "$FIX_HOME/.claude/skills/alpha/MY-NOTES.md"
run_v; RC=$?
if [ "$RC" -eq 0 ]; then pass "verify: an extra installed file that the repo does not own is not drift"
else fail "verify: an extra installed file that the repo does not own is not drift" "rc=$RC"; fi

echo "===== install_bundled_skill: deploy mode ====="

# --- COPY mode must stay COPY. This is the constraint: a temp-located repo is the
#     throwaway-clone case and a symlink there would dangle the moment it is deleted.
new_fixture
# Prove the fixture is the HARD case first: a real git checkout (it has a .git) that
# happens to sit under $TMPDIR. Without this guard the row could pass for the trivial
# reason that the fixture is not a checkout at all.
if [ -d "$FIX_REPO/.git" ]; then
  pass "install: the copy-mode fixture is a git checkout in a temp location (the hard case)"
else
  fail "install: the copy-mode fixture is a git checkout in a temp location (the hard case)" \
       "no .git marker - the next row would prove nothing"
fi
IMPROV_HOOK_DEPLOY=auto run_i alpha
MODE="$(HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" IMPROV_HOOK_DEPLOY=auto hook_deploy_mode 2>/dev/null)"
if [ "$MODE" = "copy" ] && [ -f "$FIX_HOME/.claude/skills/alpha/SKILL.md" ] \
   && [ ! -L "$FIX_HOME/.claude/skills/alpha/SKILL.md" ]; then
  pass "install: a temp-located CHECKOUT keeps COPY mode (no wholesale symlinking)"
else
  fail "install: a temp-located CHECKOUT keeps COPY mode (no wholesale symlinking)" \
       "mode=$MODE link=$([ -L "$FIX_HOME/.claude/skills/alpha/SKILL.md" ] && echo yes || echo no)"
fi

# --- and a copy install must verify clean
run_v alpha; RC=$?
if [ "$RC" -eq 0 ]; then pass "install: a fresh copy install verifies clean (0)"
else fail "install: a fresh copy install verifies clean (0)" "rc=$RC"; fi

# --- SYMLINK mode deploys links, so a repo edit is live with no re-install
new_fixture
IMPROV_HOOK_DEPLOY=symlink run_i alpha
if [ -L "$FIX_HOME/.claude/skills/alpha/SKILL.md" ] \
   && [ "$(readlink "$FIX_HOME/.claude/skills/alpha/SKILL.md")" = "$FIX_REPO/claude/skills/alpha/SKILL.md" ]; then
  pass "install: symlink mode deploys a link at the repo source"
else
  fail "install: symlink mode deploys a link at the repo source" \
       "target=$(readlink "$FIX_HOME/.claude/skills/alpha/SKILL.md" 2>/dev/null)"
fi

# The whole point of the unit: an edit reaches the machine with no installer re-run.
printf 'edited after install\n' > "$FIX_REPO/claude/skills/alpha/SKILL.md"
if [ "$(cat "$FIX_HOME/.claude/skills/alpha/SKILL.md" 2>/dev/null)" = "edited after install" ]; then
  pass "install: in symlink mode a repo edit is live through the installed path"
else
  fail "install: in symlink mode a repo edit is live through the installed path" \
       "installed content did not follow the source"
fi

# --- every file the source owns is deployed, not just SKILL.md
new_fixture
IMPROV_HOOK_DEPLOY=copy run_i beta
if [ -f "$FIX_HOME/.claude/skills/beta/SKILL.md" ] && [ -f "$FIX_HOME/.claude/skills/beta/VOCABULARY.md" ]; then
  pass "install: a multi-file skill deploys every file the source owns"
else
  fail "install: a multi-file skill deploys every file the source owns" \
       "VOCABULARY.md missing - the a la carte path only ever copied SKILL.md"
fi

new_fixture
IMPROV_HOOK_DEPLOY=copy run_i gamma
if [ -f "$FIX_HOME/.claude/skills/gamma/shaders/spiral/fragment.glsl" ] \
   && [ -f "$FIX_HOME/.claude/skills/gamma/fx/art.md" ]; then
  pass "install: a nested skill deploys its subdirectories"
else
  fail "install: a nested skill deploys its subdirectories" "nested source not deployed"
fi

# --- an EMPTY source dir must not print "installed" having written nothing, and must
#     not record itself as deployed (which would satisfy the end-of-install verify by
#     checking zero files). Silent success with nothing written.
# A POSITIVE CONTROL runs in the same fixture. Without it this row passes vacuously
# against any tree where install_bundled_skill does not exist at all (rc=127 is also
# "non-zero"), which is exactly what it did against pristine HEAD until this control
# was added. The row now means "hollow fails WHILE alpha succeeds", not "something
# returned non-zero".
new_fixture
mkdir -p "$FIX_REPO/claude/skills/hollow"
SKILLS_DEPLOYED=()
HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  IMPROV_HOOK_DEPLOY=copy install_bundled_skill hollow >/dev/null 2>&1
RC=$?
HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  IMPROV_HOOK_DEPLOY=copy install_bundled_skill alpha >/dev/null 2>&1
CTRL=$?
if [ "$RC" -ne 0 ] && [ "$CTRL" -eq 0 ] && [ "${#SKILLS_DEPLOYED[@]}" -eq 1 ]; then
  pass "install: an EMPTY source dir fails loudly instead of reporting installed"
else
  fail "install: an EMPTY source dir fails loudly instead of reporting installed" \
       "hollow_rc=$RC control_alpha_rc=$CTRL deployed='${SKILLS_DEPLOYED[*]}'"
fi

# --- an UNREADABLE source dir must fail rather than deploy a subset and claim success
new_fixture
chmod 000 "$FIX_REPO/claude/skills/beta"
SKILLS_DEPLOYED=()
HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  IMPROV_HOOK_DEPLOY=copy install_bundled_skill beta >/dev/null 2>&1
RC=$?
chmod 755 "$FIX_REPO/claude/skills/beta" 2>/dev/null
HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  IMPROV_HOOK_DEPLOY=copy install_bundled_skill alpha >/dev/null 2>&1
CTRL=$?
if [ "$RC" -ne 0 ] && [ "$CTRL" -eq 0 ] && [ "${#SKILLS_DEPLOYED[@]}" -eq 1 ]; then
  pass "install: an UNREADABLE source dir fails loudly instead of reporting installed"
else
  fail "install: an UNREADABLE source dir fails loudly instead of reporting installed" \
       "beta_rc=$RC control_alpha_rc=$CTRL deployed='${SKILLS_DEPLOYED[*]}'"
fi

# --- a missing source dir warns and returns 0 (existing contract, not a hard error)
new_fixture
run_i not-in-repo; RC=$?
if [ "$RC" -eq 0 ] && [ ! -d "$FIX_HOME/.claude/skills/not-in-repo" ]; then
  pass "install: a missing repo source warns and returns 0 without creating a dir"
else
  fail "install: a missing repo source warns and returns 0 without creating a dir" \
       "rc=$RC dir=$([ -d "$FIX_HOME/.claude/skills/not-in-repo" ] && echo created || echo absent)"
fi

# --- idempotence: a correct symlink is left alone, never churned into a copy
new_fixture
IMPROV_HOOK_DEPLOY=symlink run_i alpha
BEFORE_T="$(readlink "$FIX_HOME/.claude/skills/alpha/SKILL.md")"
IMPROV_HOOK_DEPLOY=symlink run_i alpha
AFTER_T="$(readlink "$FIX_HOME/.claude/skills/alpha/SKILL.md" 2>/dev/null)"
if [ -L "$FIX_HOME/.claude/skills/alpha/SKILL.md" ] && [ "$BEFORE_T" = "$AFTER_T" ]; then
  pass "install: re-running leaves a correct symlink intact"
else
  fail "install: re-running leaves a correct symlink intact" "before=$BEFORE_T after=$AFTER_T"
fi

# --- the repair path: a drifted copy is fixed by a re-install, and verify says so
new_fixture
plant_copy alpha
printf 'drifted installed copy\n' > "$FIX_HOME/.claude/skills/alpha/SKILL.md"
run_v alpha; BEFORE_RC=$?
IMPROV_HOOK_DEPLOY=copy run_i alpha
run_v alpha; AFTER_RC=$?
if [ "$BEFORE_RC" -eq 1 ] && [ "$AFTER_RC" -eq 0 ]; then
  pass "install: re-installing repairs a drifted copy (verify 1 -> 0)"
else
  fail "install: re-installing repairs a drifted copy (verify 1 -> 0)" "before=$BEFORE_RC after=$AFTER_RC"
fi

# --- deployed skills are recorded so the end-of-install check knows what to verify
new_fixture
SKILLS_DEPLOYED=()
HOME="$FIX_HOME" REPO_DIR="$FIX_REPO" CLAUDE_DIR="$FIX_HOME/.claude" \
  IMPROV_HOOK_DEPLOY=copy install_bundled_skill alpha >/dev/null 2>&1
if [ "${#SKILLS_DEPLOYED[@]}" -eq 1 ] && [ "${SKILLS_DEPLOYED[0]}" = "alpha" ]; then
  pass "install: a deployed skill is recorded in SKILLS_DEPLOYED"
else
  fail "install: a deployed skill is recorded in SKILLS_DEPLOYED" \
       "got '${SKILLS_DEPLOYED[*]}' - the end-of-install verify cannot know what this run deployed"
fi

echo "===== write-through containment: the installer must never write INTO the repo ====="
# WHY THIS SECTION EXISTS. Symlink deployment makes the installed path and the repo
# source THE SAME INODE. That is the topology that rotted CLAUDE.md for months: an
# installer whose output path resolved onto its own input wrote its result back over the
# source. It is also live - during this unit's own verification a `printf >` into an
# installed path truncated a tracked repo file, and the test reported CLEAN because both
# sides had become the same file.
#
# So these rows do not ask "did the deploy work". They ask: after install, RE-install,
# a mode flip, and deactivate, is the REPO SOURCE still byte-for-byte what it was?
#
# The specific hazard being pinned is `cp src dst` where dst is a symlink to src: cp
# opens dst through the link for writing, truncating src to zero, then reads the now
# empty src. link_or_copy_data's `rm -f "$dst"` before the copy is the only thing
# standing between that and a destroyed source file.

src_fingerprint() { # <repo> -> stable description of every skill source file
  local r="$1" f
  find "$r/claude/skills" -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s %s\n' "${f#"$r"/}" "$(shasum -a 256 "$f" | cut -d' ' -f1)"
  done
}

# --- W0: THE CONTROL THE WHOLE SECTION RESTS ON. Every row below compares a
#     fingerprint before against one after. If src_fingerprint were blind - an empty
#     string, a missing path, a hash that never changes - all six rows would pass while
#     the repo burned. So first prove the instrument detects a single changed byte.
new_fixture
FP_A="$(src_fingerprint "$FIX_REPO")"
printf 'one byte different\n' >> "$FIX_REPO/claude/skills/alpha/SKILL.md"
FP_B="$(src_fingerprint "$FIX_REPO")"
if [ -n "$FP_A" ] && [ "$FP_A" != "$FP_B" ]; then
  pass "write-through: the fingerprint detects a single-byte change to a repo source"
else
  fail "write-through: the fingerprint detects a single-byte change to a repo source" \
       "the instrument is blind - every containment row below would pass vacuously"
fi

# --- W1: install, then RE-install, in SYMLINK mode. The second run is the dangerous
#     one: the destination is now a link pointing straight at the source.
new_fixture
BEFORE_FP="$(src_fingerprint "$FIX_REPO")"
IMPROV_HOOK_DEPLOY=symlink run_i beta
IMPROV_HOOK_DEPLOY=symlink run_i beta
AFTER_FP="$(src_fingerprint "$FIX_REPO")"
# "repo unchanged" is only meaningful if the deploy ACTUALLY RAN. Without this the row
# also passes on a tree where install_bundled_skill does not exist and nothing happened.
DEPLOYED=0; [ -L "$FIX_HOME/.claude/skills/beta/SKILL.md" ] && DEPLOYED=1
if [ "$BEFORE_FP" = "$AFTER_FP" ] && [ -n "$BEFORE_FP" ] && [ "$DEPLOYED" -eq 1 ]; then
  pass "write-through: a symlink-mode install and RE-install leave the repo source intact"
else
  fail "write-through: a symlink-mode install and RE-install leave the repo source intact" \
       "repo_changed=$([ "$BEFORE_FP" = "$AFTER_FP" ] && echo no || echo YES) deploy_ran=$DEPLOYED"
fi

# --- W2: MODE FLIP. Destination is a link into the repo, then a COPY-mode install runs
#     over it. This is the exact cp-through-a-link truncation.
new_fixture
BEFORE_FP="$(src_fingerprint "$FIX_REPO")"
IMPROV_HOOK_DEPLOY=symlink run_i beta
IMPROV_HOOK_DEPLOY=copy run_i beta
AFTER_FP="$(src_fingerprint "$FIX_REPO")"
DEPLOYED=0; [ -f "$FIX_HOME/.claude/skills/beta/SKILL.md" ] \
  && [ ! -L "$FIX_HOME/.claude/skills/beta/SKILL.md" ] && DEPLOYED=1
if [ "$BEFORE_FP" = "$AFTER_FP" ] && [ -s "$FIX_REPO/claude/skills/beta/SKILL.md" ] \
   && [ "$DEPLOYED" -eq 1 ]; then
  pass "write-through: a COPY install over an existing link does not truncate the source"
else
  fail "write-through: a COPY install over an existing link does not truncate the source" \
       "source size=$(wc -c < "$FIX_REPO/claude/skills/beta/SKILL.md" 2>/dev/null) copy_replaced_link=$DEPLOYED"
fi

# --- W3: a hand-planted link at the destination (not one we created), then copy mode.
new_fixture
BEFORE_FP="$(src_fingerprint "$FIX_REPO")"
mkdir -p "$FIX_HOME/.claude/skills/alpha"
ln -s "$FIX_REPO/claude/skills/alpha/SKILL.md" "$FIX_HOME/.claude/skills/alpha/SKILL.md"
IMPROV_HOOK_DEPLOY=copy run_i alpha
AFTER_FP="$(src_fingerprint "$FIX_REPO")"
DEPLOYED=0; [ -f "$FIX_HOME/.claude/skills/alpha/SKILL.md" ] \
  && [ ! -L "$FIX_HOME/.claude/skills/alpha/SKILL.md" ] && DEPLOYED=1
if [ "$BEFORE_FP" = "$AFTER_FP" ] && [ -s "$FIX_REPO/claude/skills/alpha/SKILL.md" ] \
   && [ "$DEPLOYED" -eq 1 ]; then
  pass "write-through: a pre-existing link at the destination is replaced, not written through"
else
  fail "write-through: a pre-existing link at the destination is replaced, not written through" \
       "source size=$(wc -c < "$FIX_REPO/claude/skills/alpha/SKILL.md" 2>/dev/null) link_replaced=$DEPLOYED"
fi

# --- W4: DEACTIVATE. This is where the CLAUDE.md equivalent bit hardest: removing the
#     installed copy must not reach through the link and delete the repo source.
new_fixture
BEFORE_FP="$(src_fingerprint "$FIX_REPO")"
IMPROV_HOOK_DEPLOY=symlink run_i gamma
# Prove there were real links to reach through BEFORE the removal, otherwise the row
# is just deleting an empty directory.
LINKS=$(find "$FIX_HOME/.claude/skills/gamma" -type l 2>/dev/null | wc -l | tr -d ' ')
rm -rf "$FIX_HOME/.claude/skills/gamma"          # the deactivate_design_skill shape
AFTER_FP="$(src_fingerprint "$FIX_REPO")"
if [ "$BEFORE_FP" = "$AFTER_FP" ] && [ "${LINKS:-0}" -ge 3 ] \
   && [ -f "$FIX_REPO/claude/skills/gamma/shaders/spiral/fragment.glsl" ]; then
  pass "write-through: deactivating a symlinked skill leaves every repo source file"
else
  fail "write-through: deactivating a symlinked skill leaves every repo source file" \
       "links_before_removal=${LINKS:-0} (needs >=3) or the repo was damaged"
fi

# --- W5: the nastier deactivate shape - the installed skill DIRECTORY is itself a link
#     to the repo directory. `rm -rf` on that must remove the link, not the tree.
new_fixture
BEFORE_FP="$(src_fingerprint "$FIX_REPO")"
ln -s "$FIX_REPO/claude/skills/gamma" "$FIX_HOME/.claude/skills/gamma"
rm -rf "$FIX_HOME/.claude/skills/gamma"
AFTER_FP="$(src_fingerprint "$FIX_REPO")"
if [ "$BEFORE_FP" = "$AFTER_FP" ] && [ -d "$FIX_REPO/claude/skills/gamma" ]; then
  pass "write-through: removing a dir-symlink installed skill does not delete the repo tree"
else
  fail "write-through: removing a dir-symlink installed skill does not delete the repo tree" \
       "the repo skill directory was damaged"
fi

# --- W6: verify is READ-ONLY. It is the thing people will run on a hunch, repeatedly.
new_fixture
IMPROV_HOOK_DEPLOY=symlink run_i beta
BEFORE_FP="$(src_fingerprint "$FIX_REPO")"
run_v; VERIFY_RAN=$?; run_v beta; run_v
AFTER_FP="$(src_fingerprint "$FIX_REPO")"
# VERIFY_RAN must be 0 (a clean symlinked install), which also proves verify executed
# rather than being absent and doing nothing.
if [ "$BEFORE_FP" = "$AFTER_FP" ] && [ "$VERIFY_RAN" -eq 0 ]; then
  pass "write-through: verify_installed_skills never writes to the repo source"
else
  fail "write-through: verify_installed_skills never writes to the repo source" \
       "verify_rc=$VERIFY_RAN (0 expected) or the repo changed"
fi

echo "===== mutation control: every assertion above must be able to go RED ====="
# A green suite is only evidence if it can go red. Each mutation below breaks ONE
# behaviour in a COPY of install.sh, and the probe that covers that behaviour must
# then fail. THE ANCHOR IS ASSERTED FIRST: if the text being replaced is not present,
# the mutation was a no-op and "not caught" would be a lie about the suite, not a
# finding about the code.
MUT_PASS=0
MUT_FAIL=0
mutate_and_probe() { # <label> <sed-expr> <anchor-regex> <probe-fn>
  local label="$1" expr="$2" anchor="$3" probe="$4"
  local mutant; mutant="$(mktemp)" || return 1
  FIXTURES+=("$mutant")
  if ! grep -qE "$anchor" "$INSTALL_SH"; then
    fail "mutation anchor exists: $label" "anchor /$anchor/ not found in $INSTALL_SH - mutation would be a no-op"
    MUT_FAIL=$((MUT_FAIL + 1))
    return 0
  fi
  sed "$expr" "$INSTALL_SH" > "$mutant"
  if cmp -s "$mutant" "$INSTALL_SH"; then
    fail "mutation changes the file: $label" "sed produced an identical file"
    MUT_FAIL=$((MUT_FAIL + 1))
    return 0
  fi
  # Run the probe in a SUBSHELL against the mutant so the mutated definitions never
  # leak into the rest of the suite.
  #
  # THREE OUTCOMES, not two. A probe that returns 2 could not even SOURCE the mutant
  # (or the mutated function vanished), which means the sed produced broken bash rather
  # than broken behaviour. Scoring that as "caught" would credit the suite for noticing
  # something no row ever looked at - the mutation would be proving the bash parser
  # works, not that the assertion is alive.
  ( MUTANT="$mutant" "$probe" ); local prc=$?
  if [ "$prc" -eq 0 ]; then
    fail "mutation caught: $label" "the mutant still passed its probe - the row is asleep"
    MUT_FAIL=$((MUT_FAIL + 1))
  elif [ "$prc" -eq 2 ]; then
    fail "mutation is behavioural: $label" \
         "the mutant could not be sourced - a syntax break, not a caught behaviour change"
    MUT_FAIL=$((MUT_FAIL + 1))
  else
    pass "mutation caught: $label"
    MUT_PASS=$((MUT_PASS + 1))
  fi
}

# Probe helpers run in a subshell with MUTANT sourced. Each returns 0 when the
# mutant STILL behaves correctly (i.e. the suite failed to catch it).
probe_stale() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f verify_installed_skills >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/alpha" "$h/.claude/skills/alpha"
  printf 'source\n' > "$r/claude/skills/alpha/SKILL.md"
  printf 'DRIFTED\n' > "$h/.claude/skills/alpha/SKILL.md"
  HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" verify_installed_skills >/dev/null 2>&1
  local rc=$?; rm -rf "$r" "$h"
  [ "$rc" -eq 1 ]  # 0 here means the mutant still detected drift => not caught
}
probe_missing() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f verify_installed_skills >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/beta" "$h/.claude/skills/beta"
  printf 's\n' > "$r/claude/skills/beta/SKILL.md"
  printf 'v\n' > "$r/claude/skills/beta/VOCABULARY.md"
  printf 's\n' > "$h/.claude/skills/beta/SKILL.md"
  HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" verify_installed_skills >/dev/null 2>&1
  local rc=$?; rm -rf "$r" "$h"
  [ "$rc" -eq 1 ]
}
probe_spacename() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f verify_installed_skills >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/two words" "$h/.claude/skills/two words"
  printf 'source\n' > "$r/claude/skills/two words/SKILL.md"
  printf 'DRIFTED\n' > "$h/.claude/skills/two words/SKILL.md"
  local out; out="$(HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" \
    verify_installed_skills 2>&1)"
  rm -rf "$r" "$h"
  # correct behaviour: the real name is named STALE and nothing is reported as a
  # fragment that is NOT INSTALLED
  case "$out" in
    *"NOT INSTALLED"*) return 1 ;;
  esac
  case "$out" in
    *"two words/SKILL.md is STALE"*) return 0 ;;
    *) return 1 ;;
  esac
}
probe_writethrough() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f install_bundled_skill >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/alpha" "$h/.claude/skills/alpha"
  printf 'the source content\n' > "$r/claude/skills/alpha/SKILL.md"
  ln -s "$r/claude/skills/alpha/SKILL.md" "$h/.claude/skills/alpha/SKILL.md"
  HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" IMPROV_HOOK_DEPLOY=copy \
    install_bundled_skill alpha >/dev/null 2>&1
  local intact=1
  [ -s "$r/claude/skills/alpha/SKILL.md" ] \
    && [ "$(cat "$r/claude/skills/alpha/SKILL.md")" = "the source content" ] && intact=0
  rm -rf "$r" "$h"
  return $intact   # 0 = source survived (mutant still safe = NOT caught)
}
probe_usage() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f verify_installed_skills >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/alpha" "$h/.claude/skills"
  printf 's\n' > "$r/claude/skills/alpha/SKILL.md"
  HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" verify_installed_skills nope >/dev/null 2>&1
  local rc=$?; rm -rf "$r" "$h"
  [ "$rc" -eq 2 ]
}
probe_multifile() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f install_bundled_skill >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/beta" "$h/.claude/skills"
  printf 's\n' > "$r/claude/skills/beta/SKILL.md"
  printf 'v\n' > "$r/claude/skills/beta/VOCABULARY.md"
  HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" IMPROV_HOOK_DEPLOY=copy \
    install_bundled_skill beta >/dev/null 2>&1
  local ok=1
  [ -f "$h/.claude/skills/beta/VOCABULARY.md" ] && ok=0
  rm -rf "$r" "$h"
  return $ok
}
probe_copy_mode() {
  IMPROV_INSTALL_LIB_ONLY=1 . "$MUTANT" 2>/dev/null || return 2
  declare -f install_bundled_skill >/dev/null 2>&1 || return 2
  local r h; r="$(mktemp -d)"; h="$(mktemp -d)"
  mkdir -p "$r/claude/skills/alpha" "$h/.claude/skills" "$r/.git"
  printf 's\n' > "$r/claude/skills/alpha/SKILL.md"
  HOME="$h" REPO_DIR="$r" CLAUDE_DIR="$h/.claude" IMPROV_HOOK_DEPLOY=auto \
    install_bundled_skill alpha >/dev/null 2>&1
  local ok=1
  # correct behaviour in a temp repo: a real file, NOT a symlink
  [ -f "$h/.claude/skills/alpha/SKILL.md" ] && [ ! -L "$h/.claude/skills/alpha/SKILL.md" ] && ok=0
  rm -rf "$r" "$h"
  return $ok
}

# M1: verify always returns 0 - the exact shape of today's defect (nothing detects drift)
mutate_and_probe "verify forced to always return 0" \
  's/^verify_installed_skills() {$/verify_installed_skills() { return 0;/' \
  '^verify_installed_skills\(\) \{$' probe_stale
# M2: the content comparison is removed, so stale copies read as clean.
# The replacement must stay SYNTACTICALLY VALID - a mutant that fails to source
# would be scored "caught" because sourcing failed, not because a row noticed.
mutate_and_probe "verify content comparison neutered" \
  's|! cmp -s "\$_vs_inst" "\$_vs_srcf"|false|' \
  '! cmp -s "\$_vs_inst" "\$_vs_srcf"' probe_stale
# M3: the missing-file branch is neutered
mutate_and_probe "verify missing-file branch neutered" \
  's/_vs_bad=\$((_vs_bad + 1))/:/g' \
  '_vs_bad=\$\(\(_vs_bad \+ 1\)\)' probe_missing
# M4: the usage exit code collapses into the drift code
mutate_and_probe "verify usage code 2 collapsed to 1" \
  's/return 2/return 1/g' 'return 2' probe_usage
# M5: the walk only ever considers SKILL.md again
mutate_and_probe "install reduced to SKILL.md only" \
  's|-type f -print|-name SKILL.md -type f -print|' \
  '\-type f \-print' probe_multifile
# M6: deployment bypasses the mode decision and always links - the wholesale
# symlinking that would dangle for a throwaway clone. The copy-mode row must catch it.
mutate_and_probe "install forced to always symlink" \
  's|link_or_copy_data "\$_ibs_src/\$_ibs_rel" "\$_ibs_dst/\$_ibs_rel"|ln -sf "$_ibs_src/$_ibs_rel" "$_ibs_dst/$_ibs_rel"|' \
  'link_or_copy_data "\$_ibs_src/\$_ibs_rel" "\$_ibs_dst/\$_ibs_rel"' probe_copy_mode

# M7: the skill-name array collapses back to a word-splitting string
mutate_and_probe "verify name array collapsed to a split string" \
  's|for _vs_name in \${_vs_names\[@\]+"\${_vs_names\[@\]}"}; do|for _vs_name in ${_vs_names[*]}; do|' \
  'for _vs_name in \$\{_vs_names\[@\]\+"\$\{_vs_names\[@\]\}"\}; do' probe_spacename

# M8: the pre-copy `rm -f "$dst"` is removed, so cp follows the destination symlink and
# truncates the repo source it was about to read. The containment rows must catch it.
mutate_and_probe "install: pre-copy rm -f removed (cp writes through the link)" \
  's|rm -f "\$dst"                     # clears a stale symlink, so nothing dangles|:|g' \
  'rm -f "\$dst"                     # clears a stale symlink, so nothing dangles' probe_writethrough

if [ "$MUT_FAIL" -eq 0 ] && [ "$MUT_PASS" -ge 8 ]; then
  pass "mutation control: all $MUT_PASS mutations were caught by a live row"
else
  fail "mutation control: all mutations were caught by a live row" "caught=$MUT_PASS uncaught_or_noop=$MUT_FAIL"
fi

echo "===== safety: the real ~/.claude/skills was never touched ====="
REAL_AFTER="$(snapshot_dir "$REAL_SKILLS")"
if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then
  pass "the real skills tree is byte-for-byte unchanged"
else
  fail "the real skills tree is byte-for-byte unchanged" "the suite wrote outside its fixtures"
  diff <(printf '%s\n' "$REAL_BEFORE") <(printf '%s\n' "$REAL_AFTER") | head -20
fi

cleanup_fixtures

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
