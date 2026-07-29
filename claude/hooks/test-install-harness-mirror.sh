#!/bin/bash
# Regression tests for install.sh's HARNESS SKILL MIRROR:
#   harness_home_is_inside_home  - the HOME-escape assertion
#   harness_skill_targets        - which harnesses on this machine qualify
#   install_skill_to_harnesses   - mirrors one repo skill into every qualifying harness
#   verify_harness_skills        - proves the mirrored payload matches the repo source
#
# Run: bash claude/hooks/test-install-harness-mirror.sh
#
# WHY THIS SUITE EXISTS. install.sh has already shipped a HOME escape: a prior version
# planted shims into the real /opt/homebrew/bin while running under a redirected HOME, and
# the verification loop PASSED because every path it checked resolved inside the sandbox.
# The mirror adds five new write destinations, so the escape case is tested first and
# tested from outside: a canary directory OUTSIDE the sandbox HOME is snapshotted before
# and after every write row, and any change to it fails the suite.
#
# THE SECOND FAILURE CLASS IT PINS is a count that is not reach. A harness row whose home
# directory does not exist must be SKIPPED, never created - otherwise the installer reports
# five targets on a machine that has one harness, and four of those directories are files
# nobody loads. The "absent harness home is skipped" and "never creates a harness home"
# rows are that guarantee.
#
# INSTRUMENT INTEGRITY: every negative row here is paired with a positive one planted in
# the same fixture. A row asserting "gemini is not a target" is worthless unless the same
# call returns cursor, because a function that returns nothing at all would satisfy the
# negative and fail the user.
#
# SAFETY: install.sh is sourced with IMPROV_INSTALL_LIB_ONLY=1 so the installer body never
# runs. $HOME and $REPO_DIR are both redirected into mktemp fixtures.
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

REAL_HOME="$HOME"

# ------------------------------------------------------------
# Safety snapshot of every REAL harness root. Nothing in this suite may change them.
# ------------------------------------------------------------
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

REAL_ROOTS=".cursor/skills .gemini/skills .codex/skills .kiro/skills .agents/skills"
REAL_BEFORE=""
for _r in $REAL_ROOTS; do
  REAL_BEFORE="$REAL_BEFORE
=== $_r
$(snapshot_dir "$REAL_HOME/$_r")"
done

# ------------------------------------------------------------
# Source the installer's function library only.
# ------------------------------------------------------------
# shellcheck disable=SC1090
IMPROV_INSTALL_LIB_ONLY=1 . "$INSTALL_SH"
# install.sh runs `set -euo pipefail`; sourcing it turns those on in THIS shell. Rows below
# deliberately call functions that return non-zero and then read $?.
set +e
set +u
set +o pipefail

for fn in harness_home_is_inside_home harness_skill_targets install_skill_to_harnesses verify_harness_skills; do
  if declare -f "$fn" >/dev/null 2>&1; then
    pass "$fn is defined in the sourceable library region"
  else
    fail "$fn is defined in the sourceable library region" \
         "function not found - a mirror that cannot be sourced cannot be tested"
  fi
done

# ------------------------------------------------------------
# Fixture: a sandbox HOME, a sandbox repo with a multi-file nested skill, and a CANARY
# directory OUTSIDE the sandbox HOME that must never be written to.
# ------------------------------------------------------------
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/harness-mirror-XXXXXX")" || { echo "mktemp failed"; exit 1; }
SANDBOX_HOME="$FIXTURE/home"
SANDBOX_REPO="$FIXTURE/repo"
CANARY="$FIXTURE/canary"
mkdir -p "$SANDBOX_HOME" "$CANARY" "$SANDBOX_REPO/claude/skills/probeskill/reference"
printf 'canary\n' > "$CANARY/untouched.txt"

cat > "$SANDBOX_REPO/claude/skills/probeskill/SKILL.md" <<'SKILLEOF'
---
name: probeskill
description: A fixture skill used only by the harness-mirror suite.
---
body
SKILLEOF
printf 'cheatsheet\n' > "$SANDBOX_REPO/claude/skills/probeskill/CHEATSHEET.md"
printf 'nested reference\n' > "$SANDBOX_REPO/claude/skills/probeskill/reference/new-work.md"

CANARY_BEFORE="$(snapshot_dir "$CANARY")"

# Redirect the installer's own globals at the sandbox. REPO_DIR must be a NON-temp-looking
# path for symlink mode, so the suite forces copy mode instead - the mode is not what is
# under test here and copy makes the byte compares unambiguous.
HOME="$SANDBOX_HOME"
REPO_DIR="$SANDBOX_REPO"
export IMPROV_HOOK_DEPLOY=copy
unset IMPROV_REPO_PHYS_KEY IMPROV_REPO_PHYS

cleanup() { HOME="$REAL_HOME"; rm -rf "$FIXTURE"; }

# ------------------------------------------------------------
# harness_home_is_inside_home
# ------------------------------------------------------------
mkdir -p "$SANDBOX_HOME/.cursor"
if harness_home_is_inside_home "$SANDBOX_HOME/.cursor/skills"; then
  pass "containment: a path under the sandbox HOME is accepted"
else
  fail "containment: a path under the sandbox HOME is accepted" "rejected a legitimate target"
fi

if harness_home_is_inside_home "$CANARY/skills"; then
  fail "containment: a path outside HOME is rejected" "accepted a target outside \$HOME"
else
  pass "containment: a path outside HOME is rejected"
fi

if harness_home_is_inside_home "$SANDBOX_HOME"; then
  fail "containment: \$HOME itself is rejected as a skills root" "accepted \$HOME as a skills root"
else
  pass "containment: \$HOME itself is rejected as a skills root"
fi

# THE ESCAPE THIS INSTALLER ALREADY SHIPPED, in miniature: a harness directory that is a
# SYMLINK pointing outside HOME. A string prefix test waves this through; resolution must not.
ln -s "$CANARY" "$SANDBOX_HOME/.escapee"
if harness_home_is_inside_home "$SANDBOX_HOME/.escapee/skills"; then
  fail "containment: a symlinked harness dir pointing outside HOME is rejected" \
       "accepted \$HOME/.escapee -> $CANARY, which is the documented HOME-escape shape"
else
  pass "containment: a symlinked harness dir pointing outside HOME is rejected"
fi

# ------------------------------------------------------------
# harness_skill_targets: presence gating
# ------------------------------------------------------------
# .cursor exists (created above); .gemini deliberately does not.
TARGETS="$(harness_skill_targets)"
if printf '%s\n' "$TARGETS" | grep -q "^cursor	$SANDBOX_HOME/.cursor/skills$"; then
  pass "targets: an EXISTING harness home is returned (known positive)"
else
  fail "targets: an EXISTING harness home is returned (known positive)" \
       "cursor missing from: $TARGETS"
fi
if printf '%s\n' "$TARGETS" | grep -q "^gemini	"; then
  fail "targets: an ABSENT harness home is skipped" "gemini returned though \$HOME/.gemini does not exist"
else
  pass "targets: an ABSENT harness home is skipped"
fi

# A row whose paths are ABSOLUTE must be refused: that is how a redirected HOME gets escaped.
ABS_TARGETS="$(IMPROV_HARNESS_ROOTS="evil:$CANARY:$CANARY/skills
cursor:.cursor:.cursor/skills" harness_skill_targets 2>/dev/null)"
if printf '%s\n' "$ABS_TARGETS" | grep -q "^evil	"; then
  fail "targets: an absolute-path row is refused" "an absolute row escaped \$HOME"
else
  if printf '%s\n' "$ABS_TARGETS" | grep -q "^cursor	"; then
    pass "targets: an absolute-path row is refused while the relative row still resolves"
  else
    fail "targets: an absolute-path row is refused while the relative row still resolves" \
         "the whole table was discarded, so the negative proves nothing: $ABS_TARGETS"
  fi
fi

# A row containing .. must be refused for the same reason.
DOTDOT="$(IMPROV_HARNESS_ROOTS="up:../outside:../outside/skills
cursor:.cursor:.cursor/skills" harness_skill_targets 2>/dev/null)"
if printf '%s\n' "$DOTDOT" | grep -q "^up	"; then
  fail "targets: a row containing .. is refused" "a .. row escaped \$HOME"
else
  if printf '%s\n' "$DOTDOT" | grep -q "^cursor	"; then
    pass "targets: a row containing .. is refused while the relative row still resolves"
  else
    fail "targets: a row containing .. is refused while the relative row still resolves" \
         "the whole table was discarded: $DOTDOT"
  fi
fi

# A malformed row must warn and be skipped, never abort the pass.
MAL="$(IMPROV_HARNESS_ROOTS="brokenrow
cursor:.cursor:.cursor/skills" harness_skill_targets 2>/dev/null)"
if printf '%s\n' "$MAL" | grep -q "^cursor	"; then
  pass "targets: a malformed row is skipped and the pass continues"
else
  fail "targets: a malformed row is skipped and the pass continues" \
       "a malformed row took the whole table down: $MAL"
fi

# ------------------------------------------------------------
# install_skill_to_harnesses: the mirror itself
# ------------------------------------------------------------
mkdir -p "$SANDBOX_HOME/.gemini"
HARNESS_SKILLS_DEPLOYED=""
PARTIAL_FAILURES=""
install_skill_to_harnesses probeskill >/dev/null 2>&1
MIRROR_RC=$?

if [ "$MIRROR_RC" -eq 0 ]; then
  pass "mirror: returns 0 on a clean run"
else
  fail "mirror: returns 0 on a clean run" "rc=$MIRROR_RC, PARTIAL_FAILURES=$PARTIAL_FAILURES"
fi

for h in cursor gemini; do
  d="$SANDBOX_HOME/.$h/skills/probeskill"
  missing=""
  for rel in SKILL.md CHEATSHEET.md reference/new-work.md; do
    [ -f "$d/$rel" ] || missing="$missing $rel"
  done
  if [ -z "$missing" ]; then
    pass "mirror: every payload file including the nested one landed in $h"
  else
    fail "mirror: every payload file including the nested one landed in $h" "missing:$missing"
  fi
done

if [ -f "$SANDBOX_HOME/.cursor/skills/probeskill/SKILL.md" ] && \
   cmp -s "$SANDBOX_HOME/.cursor/skills/probeskill/SKILL.md" \
          "$SANDBOX_REPO/claude/skills/probeskill/SKILL.md"; then
  pass "mirror: the mirrored SKILL.md is byte-identical to the repo source"
else
  fail "mirror: the mirrored SKILL.md is byte-identical to the repo source" "cmp failed"
fi

# THE CODEX REGRESSION, pinned. Measured 2026-07-29 on the first live run: the mirror
# deployed symlinks (dev checkout) and reported five harnesses clean, and Codex CLI 0.142.5
# showed the skill NOWHERE - it does not follow a symlinked SKILL.md. A copy loaded
# instantly with nothing else changed. So the mirror must produce REAL FILES even when
# hook_deploy_mode would otherwise choose symlink, and this row asserts it under a forced
# symlink mode so it cannot pass by accident on a copy-mode fixture.
rm -rf "$SANDBOX_HOME/.cursor/skills"
HARNESS_SKILLS_DEPLOYED=""
IMPROV_HOOK_DEPLOY=symlink install_skill_to_harnesses probeskill >/dev/null 2>&1
if [ -L "$SANDBOX_HOME/.cursor/skills/probeskill/SKILL.md" ]; then
  fail "mirror: deploys a REAL FILE even under forced symlink mode (codex cannot read a link)" \
       "the mirrored SKILL.md is a symlink - Codex CLI will not load it"
elif [ -f "$SANDBOX_HOME/.cursor/skills/probeskill/SKILL.md" ]; then
  pass "mirror: deploys a REAL FILE even under forced symlink mode (codex cannot read a link)"
else
  fail "mirror: deploys a REAL FILE even under forced symlink mode (codex cannot read a link)" \
       "nothing was deployed at all"
fi

# The pin must be SCOPED to the mirror. A full install deploys ~/.claude/skills right after
# this and that side MUST keep its own auto decision - a mirror that leaked copy mode into
# the caller would freeze the Claude install too, which is the 2026-07-28 staleness bug.
# The assignment is made on its own line rather than as a `VAR=x func` prefix: bash restores
# a prefix assignment itself when the function returns, so a prefix form would report the
# caller's ORIGINAL value either way and could never detect a leak. (Learned by writing this
# row the wrong way first and watching it fail against correct code.)
export IMPROV_HOOK_DEPLOY=symlink
HARNESS_SKILLS_DEPLOYED=""
install_skill_to_harnesses probeskill >/dev/null 2>&1
if [ "${IMPROV_HOOK_DEPLOY:-unset}" = "symlink" ]; then
  pass "mirror: the copy-mode pin is restored to the caller's value on return"
else
  fail "mirror: the copy-mode pin is restored to the caller's value on return" \
       "IMPROV_HOOK_DEPLOY is '${IMPROV_HOOK_DEPLOY:-unset}' after the mirror returned, not 'symlink'"
fi

# The unset case is the other half: a caller that never set the variable must get it back
# UNSET, not set to copy, or hook_deploy_mode's auto decision is silently overridden for the
# rest of the run.
unset IMPROV_HOOK_DEPLOY
HARNESS_SKILLS_DEPLOYED=""
install_skill_to_harnesses probeskill >/dev/null 2>&1
if [ -n "${IMPROV_HOOK_DEPLOY+x}" ]; then
  fail "mirror: an unset deploy mode is left unset on return" \
       "IMPROV_HOOK_DEPLOY was created with value '${IMPROV_HOOK_DEPLOY}'"
else
  pass "mirror: an unset deploy mode is left unset on return"
fi
export IMPROV_HOOK_DEPLOY=copy

# The frontmatter a harness parses must survive the mirror verbatim - a name or description
# lost in transit is a skill the harness lists as nameless or does not list at all.
if head -4 "$SANDBOX_HOME/.gemini/skills/probeskill/SKILL.md" 2>/dev/null | grep -q '^name: probeskill$'; then
  pass "mirror: the frontmatter name survives into the harness copy"
else
  fail "mirror: the frontmatter name survives into the harness copy" "name: line not found in the mirrored file"
fi

# NEVER CREATES A HARNESS HOME. .kiro was never made in this fixture.
if [ -e "$SANDBOX_HOME/.kiro" ]; then
  fail "mirror: never creates a harness home that does not exist" \
       "\$HOME/.kiro was created for a harness that is not installed"
else
  pass "mirror: never creates a harness home that does not exist"
fi


if printf '%s' "$HARNESS_SKILLS_DEPLOYED" | grep -q '^cursor:probeskill$' && \
   printf '%s' "$HARNESS_SKILLS_DEPLOYED" | grep -q '^gemini:probeskill$'; then
  pass "mirror: the ledger records one line per harness actually written"
else
  fail "mirror: the ledger records one line per harness actually written" \
       "ledger=[$HARNESS_SKILLS_DEPLOYED]"
fi

# CANARY CHECK #1 - after the first real write pass.
if [ "$(snapshot_dir "$CANARY")" = "$CANARY_BEFORE" ]; then
  pass "escape: nothing outside the sandbox HOME was written during the mirror"
else
  fail "escape: nothing outside the sandbox HOME was written during the mirror" \
       "the canary directory changed"
fi

# THE PRESENCE GATE, isolated from the containment check so a mutation to it cannot hide.
# A row like `cursor:.cursor:.cursor/skills` whose home is a DIRECT child of $HOME is
# rejected by containment anyway when the home is missing (the walk lands on $HOME itself,
# which is not strictly beneath $HOME), so removing the presence gate looks harmless there.
# This row defeats that masking: the home is NESTED one level deeper and its parent DOES
# exist, so containment accepts the path and only the presence gate can refuse it. Without
# the gate, the installer would materialize a harness that is not installed.
mkdir -p "$SANDBOX_HOME/.deepvendor"
HARNESS_SKILLS_DEPLOYED=""
IMPROV_HARNESS_ROOTS="deep:.deepvendor/agent:.deepvendor/agent/skills" \
  install_skill_to_harnesses probeskill >/dev/null 2>&1
if [ -e "$SANDBOX_HOME/.deepvendor/agent" ]; then
  fail "mirror: presence gate refuses a nested harness home whose parent exists" \
       "\$HOME/.deepvendor/agent was created - the presence gate is not doing the refusing"
else
  pass "mirror: presence gate refuses a nested harness home whose parent exists"
fi
# The same table, once the nested home DOES exist, must mirror - otherwise the row above is
# satisfied by a function that refuses everything.
mkdir -p "$SANDBOX_HOME/.deepvendor/agent"
HARNESS_SKILLS_DEPLOYED=""
IMPROV_HARNESS_ROOTS="deep:.deepvendor/agent:.deepvendor/agent/skills" \
  install_skill_to_harnesses probeskill >/dev/null 2>&1
if [ -f "$SANDBOX_HOME/.deepvendor/agent/skills/probeskill/SKILL.md" ]; then
  pass "mirror: the same nested row mirrors once its home exists (known positive)"
else
  fail "mirror: the same nested row mirrors once its home exists (known positive)" \
       "nothing landed, so the refusal row above proves nothing"
fi
rm -rf "$SANDBOX_HOME/.deepvendor"

# THE DIAGNOSTIC-AS-A-ROW DEFECT, pinned. install.sh's warn/info/err print to STDOUT, and
# harness_skill_targets' stdout IS the machine-readable target list. Before this row existed,
# a rejected row warned onto stdout, the caller read the warning text as a `label<TAB>path`
# row, and mkdir -p turned the warning TEXT into a directory relative to the CURRENT
# DIRECTORY - a write outside $HOME produced by the guard meant to prevent writes outside
# $HOME. The check is deliberately made from outside: run the mirror with a table full of
# rejected rows in a clean CWD and assert the CWD gained nothing.
CWDPROBE="$FIXTURE/cwdprobe"
mkdir -p "$CWDPROBE"
HARNESS_SKILLS_DEPLOYED=""
(
  cd "$CWDPROBE" || exit 1
  IMPROV_HARNESS_ROOTS="brokenrow
evil:/etc:/etc/skills
up:../outside:../outside/skills
cursor:.cursor:.cursor/skills" install_skill_to_harnesses probeskill >/dev/null 2>&1
)
CWD_LEFTOVERS="$(find "$CWDPROBE" -mindepth 1 2>/dev/null | head -5)"
if [ -z "$CWD_LEFTOVERS" ]; then
  pass "escape: rejected rows never become directories in the current working directory"
else
  fail "escape: rejected rows never become directories in the current working directory" \
       "the CWD gained: $CWD_LEFTOVERS"
fi
rm -rf "$CWDPROBE"

# The same table must still have mirrored the ONE legitimate row. A guard that drops
# everything satisfies the negative above while delivering no reach at all.
if [ -f "$SANDBOX_HOME/.cursor/skills/probeskill/SKILL.md" ]; then
  pass "escape: the one legitimate row in a table of rejects still mirrored"
else
  fail "escape: the one legitimate row in a table of rejects still mirrored" \
       "cursor got nothing, so the negative row above proves nothing"
fi

# IMPROV_HARNESS_MIRROR=0 disables the pass entirely.
rm -rf "$SANDBOX_HOME/.cursor/skills" "$SANDBOX_HOME/.gemini/skills"
HARNESS_SKILLS_DEPLOYED=""
IMPROV_HARNESS_MIRROR=0 install_skill_to_harnesses probeskill >/dev/null 2>&1
if [ -e "$SANDBOX_HOME/.cursor/skills/probeskill" ]; then
  fail "mirror: IMPROV_HARNESS_MIRROR=0 writes nothing" "the payload landed anyway"
else
  pass "mirror: IMPROV_HARNESS_MIRROR=0 writes nothing"
fi

# A skill with no repo source is a warning and a 0, not a crash.
install_skill_to_harnesses no-such-skill >/dev/null 2>&1
if [ $? -eq 0 ]; then
  pass "mirror: a missing repo source warns and returns 0"
else
  fail "mirror: a missing repo source warns and returns 0" "returned non-zero"
fi

# A usage error (no name / extra args) is rejected with 2.
install_skill_to_harnesses >/dev/null 2>&1
[ $? -eq 2 ] && pass "mirror: no skill name is a usage error (rc 2)" \
             || fail "mirror: no skill name is a usage error (rc 2)" "wrong rc"
install_skill_to_harnesses a b >/dev/null 2>&1
[ $? -eq 2 ] && pass "mirror: two arguments is a usage error (rc 2)" \
             || fail "mirror: two arguments is a usage error (rc 2)" "wrong rc"

# ------------------------------------------------------------
# verify_harness_skills
# ------------------------------------------------------------
HARNESS_SKILLS_DEPLOYED=""
install_skill_to_harnesses probeskill >/dev/null 2>&1

verify_harness_skills probeskill >/dev/null 2>&1
[ $? -eq 0 ] && pass "verify: a clean mirror verifies 0" \
             || fail "verify: a clean mirror verifies 0" "reported a problem on a clean tree"

# STALE
printf 'tampered\n' >> "$SANDBOX_HOME/.cursor/skills/probeskill/SKILL.md"
OUT="$(verify_harness_skills probeskill 2>&1)"
RC=$?
if [ "$RC" -ne 0 ] && printf '%s' "$OUT" | grep -q "STALE"; then
  pass "verify: a modified mirrored file is reported STALE and fails"
else
  fail "verify: a modified mirrored file is reported STALE and fails" "rc=$RC out=$OUT"
fi

# MISSING
HARNESS_SKILLS_DEPLOYED=""
install_skill_to_harnesses probeskill >/dev/null 2>&1
rm -f "$SANDBOX_HOME/.gemini/skills/probeskill/reference/new-work.md"
OUT="$(verify_harness_skills probeskill 2>&1)"
RC=$?
if [ "$RC" -ne 0 ] && printf '%s' "$OUT" | grep -q "MISSING"; then
  pass "verify: a deleted mirrored file is reported MISSING and fails"
else
  fail "verify: a deleted mirrored file is reported MISSING and fails" "rc=$RC out=$OUT"
fi

# DANGLING - the failure mode a bare presence test cannot see.
HARNESS_SKILLS_DEPLOYED=""
install_skill_to_harnesses probeskill >/dev/null 2>&1
rm -f "$SANDBOX_HOME/.cursor/skills/probeskill/CHEATSHEET.md"
ln -s "$FIXTURE/gone-forever" "$SANDBOX_HOME/.cursor/skills/probeskill/CHEATSHEET.md"
OUT="$(verify_harness_skills probeskill 2>&1)"
RC=$?
if [ "$RC" -ne 0 ] && printf '%s' "$OUT" | grep -q "DANGLING"; then
  pass "verify: a dangling mirrored symlink is reported DANGLING and fails"
else
  fail "verify: a dangling mirrored symlink is reported DANGLING and fails" "rc=$RC out=$OUT"
fi

# An unknown skill name is a usage error, not a clean pass over nothing.
verify_harness_skills no-such-skill >/dev/null 2>&1
[ $? -eq 2 ] && pass "verify: an unknown skill name is a usage error (rc 2)" \
             || fail "verify: an unknown skill name is a usage error (rc 2)" "wrong rc"

# With NO harness installed at all, verify must say so and exit 0 rather than claim a clean
# check it never performed.
NOHARNESS="$(mktemp -d "${TMPDIR:-/tmp}/harness-none-XXXXXX")"
HOME="$NOHARNESS"
unset IMPROV_REPO_PHYS_KEY IMPROV_REPO_PHYS
HARNESS_SKILLS_DEPLOYED=""
OUT="$(verify_harness_skills probeskill 2>&1)"
RC=$?
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -qi "nothing mirrored"; then
  pass "verify: no harness on the machine reports 'nothing mirrored', not a false clean"
else
  fail "verify: no harness on the machine reports 'nothing mirrored', not a false clean" "rc=$RC out=$OUT"
fi
HOME="$SANDBOX_HOME"
rm -rf "$NOHARNESS"

# CANARY CHECK #2 - after every write and verify row.
if [ "$(snapshot_dir "$CANARY")" = "$CANARY_BEFORE" ]; then
  pass "escape: nothing outside the sandbox HOME was written across the whole suite"
else
  fail "escape: nothing outside the sandbox HOME was written across the whole suite" \
       "the canary directory changed"
fi

# ------------------------------------------------------------
# The real machine's harness roots must be exactly as they were.
# ------------------------------------------------------------
HOME="$REAL_HOME"
REAL_AFTER=""
for _r in $REAL_ROOTS; do
  REAL_AFTER="$REAL_AFTER
=== $_r
$(snapshot_dir "$REAL_HOME/$_r")"
done
if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then
  pass "safety: the real harness roots under \$HOME were not touched"
else
  fail "safety: the real harness roots under \$HOME were not touched" "a real harness root changed"
fi

rm -rf "$FIXTURE"

echo ""
echo "harness-mirror: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf 'failed rows:\n'
  for l in "${FAIL_LABELS[@]}"; do printf '  - %s\n' "$l"; done
  exit 1
fi
exit 0
