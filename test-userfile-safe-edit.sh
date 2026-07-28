#!/usr/bin/env bash
# test-userfile-safe-edit.sh - every edit install.sh makes to a USER-OWNED file that is
# not ~/.zshrc goes through the same safe primitive: snapshot to $TMPDIR, filter, write
# back through the path. Covers ~/.claude/CLAUDE.md (deactivate and install paths) and
# migrate_legacy_markers, which rewrites three of the user's files at once.
#
# WHY THIS IS A SECOND FILE. test-zshrc-safe-edit.sh proved the property for ~/.zshrc and
# its structural row watches for regressions there. The same three defects were still live
# against ~/.claude/CLAUDE.md - a file that holds the user's global instructions - because
# the earlier fix and its 40-line write-up were attached to a primitive named for the
# OTHER file. Naming a hazard after one of its victims is how the rest stay uncovered.
#
# THE THREE DEFECTS, each reproduced against committed code before being fixed:
#   1. `.bak` collateral. `sed -i.bak` writes "$path.bak" - a path the installer does not
#      own - and every site rm's it on the next line, so a user's hand-made
#      ~/.claude/CLAUDE.md.bak is destroyed. sed writes it whether or not anything matched.
#   2. RANGE TO END OF FILE. `sed '/begin/,/end/d'` with no end marker deletes from the
#      begin marker to EOF. Reproduced: a 4-line CLAUDE.md came back as 1 line, with the
#      user's own trailing content gone.
#   3. `sed -i` refuses a non-regular file. At the INSTALL path this aborts the whole
#      installer under `set -euo pipefail` when ~/.claude/CLAUDE.md is a symlink into the
#      user's own dotfiles - the repo-symlink migration above it does not fire for a link
#      that points anywhere else.
#
# WHAT IS DELIBERATELY *NOT* CHANGED: the `[ ! -L ]` guards on deactivate_brain and
# deactivate_memory. On a machine where ~/.claude/CLAUDE.md is symlinked INTO this repo -
# the shape this machine has - following the link would rewrite the repo's own tracked
# claude/CLAUDE.md. Those guards are the reason that is currently safe, and rows below
# pin them so a future "make it consistent with the zshrc primitive" cannot remove them.
#
# Run: bash test-userfile-safe-edit.sh
# Exit: 0 all green / 1 an assertion failed / 2 the harness itself could not set up
set -u

REPO_DIR_REAL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="$REPO_DIR_REAL/install.sh"
[ -f "$INSTALLER" ] || { echo "HARNESS: install.sh not found at $INSTALLER" >&2; exit 2; }

pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); [ $# -gt 1 ] && echo "     hint: $2"; return 0; }

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/improv-userfile.XXXXXX")" \
  || { echo "HARNESS: mktemp -d failed" >&2; exit 2; }
trap 'rm -rf "$TMPROOT"' EXIT

inode_of(){ stat -f %i "$1" 2>/dev/null || stat -c %i "$1" 2>/dev/null; }

# ============================================================
# Library under test - EXTRACTED from install.sh, never paraphrased
# ============================================================
# Same awk technique and the same extraction constraint as test-zshrc-safe-edit.sh: each
# range runs from a column-0 function header to the first column-0 "}". A file-scope
# helper falls outside every extract and must be listed here explicitly.
#
# NOTE FOR WHOEVER TOUCHES THE EXTRACTION LIST. claude/hooks/test-ampersand-shim.sh has
# its OWN extraction of zshrc_block_delete and asserts `declare -f` on it. That file is
# owned by another workstream. Anything deactivate_ampersand depends on must live INSIDE
# zshrc_block_delete's own body, which is why the safe-edit mechanics stayed there and
# only thin wrappers were added around it.
LIB="$TMPROOT/extracted.sh"
{
  awk '/^zshrc_block_delete\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^safe_block_delete\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^safe_sed_apply\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^deactivate_brain\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^migrate_legacy_markers\(\) \{/,/^\}/' "$INSTALLER"
  printf 'warn() { printf "warn: %%s\\n" "$1" >&2; }\n'
} > "$LIB"

bash -n "$LIB" 2>/dev/null && ok "extract parses" || bad "extract parses" "awk ranges are mismatched"
for fn in zshrc_block_delete safe_block_delete safe_sed_apply deactivate_brain migrate_legacy_markers; do
  if bash -c "source '$LIB'; declare -f $fn >/dev/null" 2>/dev/null; then
    ok "extract carries $fn"
  else
    bad "extract carries $fn" "add it to the awk extraction above"
  fi
done

# ============================================================
# Structural: no `sed -i` may survive anywhere in install.sh
# ============================================================
# The zshrc suite's row is scoped to "$ZSHRC". This one is total, because the whole point
# of this unit is that scoping the check to one victim is what let the others survive.
# Continuations are joined so a wrapped statement cannot slip past a line-oriented grep.
n_sedi="$(awk '
  { line = $0 }
  { while (line ~ /\\$/ && (getline nxt) > 0) { sub(/\\$/, "", line); line = line nxt } }
  line ~ /^[[:space:]]*#/ { next }
  line ~ /sed[[:space:]]+-i/ { n++ }
  END { print n+0 }
' "$INSTALLER")"
if [ "$n_sedi" = "0" ]; then
  ok "install.sh has zero \`sed -i\` anywhere"
else
  bad "install.sh has zero \`sed -i\` anywhere" "$n_sedi in-place edit(s) against a user-owned path remain"
fi

# ============================================================
# Fixtures
# ============================================================
USER_BAK='# MY OWN HAND-MADE BACKUP
keep me'
TAIL='# MY IRREPLACEABLE TAIL'

md_wellformed(){
  printf '%s\n' '# my own global rules' \
    '<!-- improv:brain:begin -->' 'INSTALLER CONTENT' '<!-- improv:brain:end -->' "$TAIL"
}
# The hazard-2 shape: a begin marker whose end marker a hand edit removed.
md_no_end(){
  printf '%s\n' '# my own global rules' \
    '<!-- improv:brain:begin -->' 'INSTALLER CONTENT' "$TAIL"
}

# newcase <name> <wellformed|no_end> [--link-repo|--link-foreign]
newcase(){
  # Split deliberately: `local a=$1 b=$TMPROOT/$a` declares every name before assigning
  # any of them, so the second reference expands an unset variable and dies under set -u.
  local shape="$2" mode="${3:-}"
  local h="$TMPROOT/$1"
  mkdir -p "$h/.claude" "$h/repo" "$h/mydots" || return 1
  local body; body="$(md_$shape)"
  case "$mode" in
    --link-repo)    printf '%s\n' "$body" > "$h/repo/CLAUDE.md";   ln -s "$h/repo/CLAUDE.md" "$h/.claude/CLAUDE.md" ;;
    --link-foreign) printf '%s\n' "$body" > "$h/mydots/CLAUDE.md"; ln -s "$h/mydots/CLAUDE.md" "$h/.claude/CLAUDE.md" ;;
    *)              printf '%s\n' "$body" > "$h/.claude/CLAUDE.md" ;;
  esac
  printf '%s\n' "$USER_BAK" > "$h/.claude/CLAUDE.md.bak"
  printf '%s\n' "$h"
}

run_brain(){
  local h="$1"
  CLAUDE_DIR="$h/.claude" REPO_DIR="$h/repo" \
    bash -c "set -euo pipefail; source '$LIB'; deactivate_brain" >/dev/null 2>&1
}

# assert_bak_safe <home> <label>
assert_bak_safe(){
  if [ -f "$1/.claude/CLAUDE.md.bak" ] && [ "$(cat "$1/.claude/CLAUDE.md.bak")" = "$USER_BAK" ]; then
    ok "$2: user's CLAUDE.md.bak survives untouched"
  else
    bad "$2: user's CLAUDE.md.bak survives untouched" "sed -i.bak clobbered a path the installer does not own"
  fi
}

# ============================================================
# deactivate_brain
# ============================================================
echo "-- deactivate_brain --"

# ---- 1. well-formed block: the block goes, the user's file does not ----
h="$(newcase brain_ok wellformed)" || exit 2
run_brain "$h" || true
assert_bak_safe "$h" "brain"
if grep -Fq 'INSTALLER CONTENT' "$h/.claude/CLAUDE.md" 2>/dev/null; then
  bad "brain: the installer block is removed" "the delete did not happen"
else
  ok "brain: the installer block is removed"
fi
if grep -Fqx "$TAIL" "$h/.claude/CLAUDE.md" 2>/dev/null \
   && grep -Fqx '# my own global rules' "$h/.claude/CLAUDE.md" 2>/dev/null; then
  ok "brain: the user's own content survives"
else
  bad "brain: the user's own content survives" "the delete took the user's global instructions"
fi

# ---- 2. HAZARD 2: begin marker with no end marker ----
# `sed '/begin/,/end/d'` deletes to END OF FILE here. Refusing is the only safe answer:
# a delete that cannot find its boundary does not get to guess where it is.
h="$(newcase brain_noend no_end)" || exit 2
run_brain "$h" || true
if grep -Fqx "$TAIL" "$h/.claude/CLAUDE.md" 2>/dev/null; then
  ok "brain: malformed block - the user's trailing content survives"
else
  bad "brain: malformed block - the user's trailing content survives" \
      "the range ran to EOF and destroyed the rest of the file"
fi
assert_bak_safe "$h" "brain malformed"

# ---- 3. the [ ! -L ] guards are LOAD-BEARING and must stay ----
# ~/.claude/CLAUDE.md symlinked INTO this repo is the shape this machine has. Following
# that link would rewrite the repo's own tracked claude/CLAUDE.md, so the correct
# behaviour is the existing one: drop the link, never edit through it.
h="$(newcase brain_linkrepo wellformed --link-repo)" || exit 2
repo_ino="$(inode_of "$h/repo/CLAUDE.md")"
run_brain "$h" || true
if grep -Fq 'INSTALLER CONTENT' "$h/repo/CLAUDE.md" 2>/dev/null \
   && [ "$(inode_of "$h/repo/CLAUDE.md")" = "$repo_ino" ]; then
  ok "brain: a link into the repo is never edited through"
else
  bad "brain: a link into the repo is never edited through" \
      "the repo's own tracked source was rewritten by a deactivate"
fi
if [ -e "$h/.claude/CLAUDE.md" ]; then
  bad "brain: a link into the repo is removed, not followed" "the link is still there"
else
  ok "brain: a link into the repo is removed, not followed"
fi

# ============================================================
# The install path (section 11) - reproduced, because it is inline code
# ============================================================
# Section 11 is not a function, so it cannot be awk-extracted. The block below mirrors it
# statement for statement; the structural row above is what guarantees the real thing has
# no `sed -i` left in it, and these rows are what say the replacement behaves.
echo "-- install path (section 11 shape) --"
sec11(){
  local TARGET_MD="$1" REPO_DIR="$2"
  local BRAIN_BEGIN='<!-- improv:brain:begin -->' BRAIN_END='<!-- improv:brain:end -->'
  if [ -L "$TARGET_MD" ] && [[ "$(readlink "$TARGET_MD")" == "$REPO_DIR/"* ]]; then
    cp -L "$TARGET_MD" "$TARGET_MD.migrated"; rm -f "$TARGET_MD"; mv "$TARGET_MD.migrated" "$TARGET_MD"
  fi
  [ -f "$TARGET_MD" ] || touch "$TARGET_MD"
  # The APPEND is mirrored too, not just the delete. Without it the duplicate-block
  # rows below would be testing half the sequence and would pass no matter what.
  local brain_block_ok=1
  if grep -Fq "$BRAIN_BEGIN" "$TARGET_MD" 2>/dev/null; then
    safe_block_delete "$TARGET_MD" "$BRAIN_BEGIN" "$BRAIN_END" \
      || { warn "brain block malformed - NOT refreshing"; brain_block_ok=0; }
  fi
  if [ "$brain_block_ok" = 1 ]; then
    { printf '\n%s\n' "$BRAIN_BEGIN"; printf 'FRESH RULES\n'; printf '%s\n' "$BRAIN_END"; } >> "$TARGET_MD"
  fi
}

# ---- 4. HAZARD 3: a symlink to the user's OWN dotfiles ----
# The repo-symlink migration above does not fire for a link pointing anywhere else, so
# `sed -i` met it and aborted the whole installer with "in-place editing only works for
# regular files". Writing through the link is right here: the user chose it, and the
# append that follows in the real section 11 already goes through it.
h="$(newcase sec11_foreign wellformed --link-foreign)" || exit 2
before_ino="$(inode_of "$h/mydots/CLAUDE.md")"
if bash -c "set -euo pipefail; source '$LIB'; $(declare -f sec11); sec11 '$h/.claude/CLAUDE.md' '$h/repo'" >/dev/null 2>&1; then
  ok "install: a foreign symlink does not abort the installer"
else
  bad "install: a foreign symlink does not abort the installer" \
      "sed -i refused a non-regular file and set -e killed the run"
fi
if grep -Fq 'INSTALLER CONTENT' "$h/mydots/CLAUDE.md" 2>/dev/null; then
  bad "install: a foreign symlink is actually edited" "the edit never reached the target"
else
  ok "install: a foreign symlink is actually edited"
fi
if [ -L "$h/.claude/CLAUDE.md" ] && [ "$(inode_of "$h/mydots/CLAUDE.md")" = "$before_ino" ]; then
  ok "install: a foreign symlink survives as a link, same inode"
else
  bad "install: a foreign symlink survives as a link, same inode" "the link was replaced by a regular file"
fi
if [ -e "$h/mydots/CLAUDE.md.bak" ]; then
  bad "install: no .bak dropped beside the user's real file" "collateral backup in the user's dotfiles dir"
else
  ok "install: no .bak dropped beside the user's real file"
fi

# ---- 5. install path, malformed block + user .bak ----
h="$(newcase sec11_noend no_end)" || exit 2
bash -c "set -euo pipefail; source '$LIB'; $(declare -f sec11); sec11 '$h/.claude/CLAUDE.md' '$h/repo'" >/dev/null 2>&1 || true
if grep -Fqx "$TAIL" "$h/.claude/CLAUDE.md" 2>/dev/null; then
  ok "install: malformed block - the user's trailing content survives"
else
  bad "install: malformed block - the user's trailing content survives" "the range ran to EOF"
fi
assert_bak_safe "$h" "install malformed"

# ---- 6. FINDING: a refused delete must SUPPRESS the append ----
# THESE ROWS DRIVE THE REAL INSTALLER, not the mirror above. That is the whole point:
# when they were written against the sec11() mirror they stayed GREEN under a mutation
# that removed the suppression from install.sh, because the mirror carried its own copy
# of the logic and was testing itself. Section 11 is inline code and cannot be
# awk-extracted, so the only honest way to assert its behaviour is to run it.
# `--only brain --yes` is the installer's own non-interactive path and HOME is sandboxed.
#
# The defect: warning and appending anyway is unbounded and unrecoverable. Each run adds
# another full copy of RULES.md + CLAUDE.md (~66 KB), and at two begin markers
# deactivate_brain refuses as well, so the user can no longer uninstall ANY copy.
# Measured by independent review at 1 -> 4 begin markers over three runs. The old
# delete-to-EOF was destructive but self-healed next run; this never heals.
echo "-- install path (REAL installer, --only brain --yes) --"
e2e="$TMPROOT/e2e_malformed"; mkdir -p "$e2e/.claude"; : > "$e2e/.zshrc"
printf '%s\n' '# my own global rules' '<!-- improv:brain:begin -->' 'OLD' "$TAIL" > "$e2e/.claude/CLAUDE.md"
size_before="$(wc -c < "$e2e/.claude/CLAUDE.md" | tr -d ' ')"
e2e_rc=0
for _ in 1 2 3; do
  HOME="$e2e" bash "$INSTALLER" --only brain --yes >"$e2e/out.log" 2>&1 || e2e_rc=$?
done
if [ "$e2e_rc" = 0 ]; then
  ok "install: a malformed block does not fail the install"
else
  bad "install: a malformed block does not fail the install" "installer exited $e2e_rc"
fi
begins="$(grep -c 'improv:brain:begin' "$e2e/.claude/CLAUDE.md" 2>/dev/null || echo 0)"
if [ "$begins" = "1" ]; then
  ok "install: three runs on a malformed block leave exactly one begin marker"
else
  bad "install: three runs on a malformed block leave exactly one begin marker" \
      "$begins markers - the file grows without bound and can no longer be uninstalled"
fi
if [ "$(wc -c < "$e2e/.claude/CLAUDE.md" | tr -d ' ')" = "$size_before" ]; then
  ok "install: a malformed block leaves the file byte-identical"
else
  bad "install: a malformed block leaves the file byte-identical" "content was appended anyway"
fi
if grep -Fqx "$TAIL" "$e2e/.claude/CLAUDE.md"; then
  ok "install: a malformed block leaves the user's trailing content"
else
  bad "install: a malformed block leaves the user's trailing content" "the range ran to EOF"
fi
if grep -qi 'malformed' "$e2e/out.log"; then
  ok "install: the user is told the block is malformed"
else
  bad "install: the user is told the block is malformed" "it failed silently"
fi

# The well-formed control: the suppression must not have become a blanket refusal, and
# repeated installs must still converge on exactly one block rather than accumulating.
e2eok="$TMPROOT/e2e_wellformed"; mkdir -p "$e2eok/.claude"; : > "$e2eok/.zshrc"
printf '%s\n' '# my own global rules' \
  '<!-- improv:brain:begin -->' 'OLD' '<!-- improv:brain:end -->' "$TAIL" > "$e2eok/.claude/CLAUDE.md"
for _ in 1 2; do
  HOME="$e2eok" bash "$INSTALLER" --only brain --yes >"$e2eok/out.log" 2>&1 || true
done
begins="$(grep -c 'improv:brain:begin' "$e2eok/.claude/CLAUDE.md" 2>/dev/null || echo 0)"
if [ "$begins" = "1" ]; then
  ok "install: two runs on a well-formed block still converge on one"
else
  bad "install: two runs on a well-formed block still converge on one" "$begins markers"
fi
# The refreshed block must carry content from BOTH payload sources, because the brain
# block is `cat RULES.md; cat CLAUDE.md`. Asserting on one string from each is what makes
# this a refresh check rather than a "something got written" check.
#
# This row previously asserted on 'Beats Discipline', which passed only because
# claude/CLAUDE.md had been overwritten with the ASSEMBLED install output - that string
# belongs to the memory-discipline component and was never in a brain payload source. The
# assertion was validating the contamination it should have caught. Anchor a refresh check
# on strings the payload sources genuinely own, or it certifies the bug.
if grep -Fq 'Team Rules' "$e2eok/.claude/CLAUDE.md" 2>/dev/null \
   && grep -Fq 'Question-Asking Protocol' "$e2eok/.claude/CLAUDE.md" 2>/dev/null \
   && ! grep -Fqx 'OLD' "$e2eok/.claude/CLAUDE.md"; then
  ok "install: a well-formed block is actually refreshed"
else
  bad "install: a well-formed block is actually refreshed" "the suppression is over-broad"
fi
if grep -Fqx "$TAIL" "$e2eok/.claude/CLAUDE.md"; then
  ok "install: refreshing preserves the user's trailing content"
else
  bad "install: refreshing preserves the user's trailing content" "the user's content was lost"
fi

# ============================================================
# migrate_legacy_markers - three of the user's files, one substitution
# ============================================================
# Runs unconditionally in the main install path AND at the top of every
# deactivate_component, so on a pre-rename machine every install and every deactivate hit
# this. It is a SUBSTITUTION, not a delete, which is why it needs the primitive's script
# mode rather than its marker mode.
echo "-- migrate_legacy_markers --"
h="$TMPROOT/migrate"; mkdir -p "$h/.claude" "$h/dots"
printf '%s\n' '=== claude-dotfiles:shortcuts:begin ===' 'body' > "$h/zshrc_real"
ln -s "$h/zshrc_real" "$h/.zshrc"                      # the common dotfiles setup
printf '%s\n' "$USER_BAK" > "$h/.zshrc.bak"            # and a backup they made themselves
printf '%s\n' '<!-- claude-dotfiles:brain:begin -->' 'body' "$TAIL" > "$h/.claude/CLAUDE.md"
printf '%s\n' "$USER_BAK" > "$h/.claude/CLAUDE.md.bak"

if ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" \
   bash -c "set -euo pipefail; source '$LIB'; migrate_legacy_markers" >/dev/null 2>&1; then
  ok "migrate: a symlinked ~/.zshrc does not abort the installer"
else
  bad "migrate: a symlinked ~/.zshrc does not abort the installer" "sed -i refused the link"
fi
if grep -Fq 'improv:shortcuts:begin' "$h/zshrc_real" 2>/dev/null; then
  ok "migrate: the rename actually reached the symlink target"
else
  bad "migrate: the rename actually reached the symlink target" "the marker was never rewritten"
fi
if [ -L "$h/.zshrc" ]; then ok "migrate: ~/.zshrc is still a symlink"
else bad "migrate: ~/.zshrc is still a symlink" "the link was replaced"; fi
if [ -f "$h/.zshrc.bak" ] && [ "$(cat "$h/.zshrc.bak")" = "$USER_BAK" ]; then
  ok "migrate: user's ~/.zshrc.bak survives"
else
  bad "migrate: user's ~/.zshrc.bak survives" "the substitution destroyed a backup it does not own"
fi
# Every line is checked, not just the tail: a substitution that overreached would still
# leave the last line in place, so a single-line check passes for the wrong reason.
mig_expected="$(printf '%s\n' '<!-- improv:brain:begin -->' 'body' "$TAIL")"
if [ "$(cat "$h/.claude/CLAUDE.md")" = "$mig_expected" ]; then
  ok "migrate: CLAUDE.md rewritten byte-for-byte as expected"
else
  bad "migrate: CLAUDE.md rewritten byte-for-byte as expected" \
      "got: $(tr '\n' '|' < "$h/.claude/CLAUDE.md")"
fi
if [ -f "$h/.claude/CLAUDE.md.bak" ] && [ "$(cat "$h/.claude/CLAUDE.md.bak")" = "$USER_BAK" ]; then
  ok "migrate: user's CLAUDE.md.bak survives"
else
  bad "migrate: user's CLAUDE.md.bak survives" "collateral .bak destruction"
fi
# FINDING (High, independent review): migrate_legacy_markers runs at the TOP of
# deactivate_component and again in the main install path, so it runs BEFORE
# deactivate_brain's `[ ! -L ]` guard and BEFORE section 11 converts a repo symlink to a
# real file. It is the one place neither protection covers. `sed -i` refused a symlink, so
# the repo's own tracked claude/CLAUDE.md was protected here BY ACCIDENT; `cat >` follows
# the link, so the switch to the safe primitive would have rewritten our own source in
# place, same inode, rc=0, silently - on exactly the shape this machine has.
h3="$TMPROOT/migrate_repolink"; mkdir -p "$h3/.claude" "$h3/repo"
printf '%s\n' '<!-- claude-dotfiles:brain:begin -->' 'REPO SOURCE' > "$h3/repo/CLAUDE.md"
ln -s "$h3/repo/CLAUDE.md" "$h3/.claude/CLAUDE.md"
repo_before="$(cat "$h3/repo/CLAUDE.md")"
printf '%s\n' 'no markers here' > "$h3/.zshrc"
ZSHRC="$h3/.zshrc" CLAUDE_DIR="$h3/.claude" REPO_DIR="$h3/repo" \
  bash -c "set -euo pipefail; source '$LIB'; migrate_legacy_markers" >/dev/null 2>&1 || true
if [ "$(cat "$h3/repo/CLAUDE.md")" = "$repo_before" ]; then
  ok "migrate: a link into the repo is never written through"
else
  bad "migrate: a link into the repo is never written through" \
      "the repo's own tracked source was rewritten by the installer"
fi
# A link to the user's OWN dotfiles is still followed - the skip must be repo-scoped, not
# a blanket "skip every symlink", or the migration silently stops working for real users.
h4="$TMPROOT/migrate_foreignlink"; mkdir -p "$h4/.claude" "$h4/repo" "$h4/mydots"
printf '%s\n' '<!-- claude-dotfiles:brain:begin -->' 'USER CONTENT' > "$h4/mydots/CLAUDE.md"
ln -s "$h4/mydots/CLAUDE.md" "$h4/.claude/CLAUDE.md"
printf '%s\n' 'no markers here' > "$h4/.zshrc"
ZSHRC="$h4/.zshrc" CLAUDE_DIR="$h4/.claude" REPO_DIR="$h4/repo" \
  bash -c "set -euo pipefail; source '$LIB'; migrate_legacy_markers" >/dev/null 2>&1 || true
if grep -Fq 'improv:brain:begin' "$h4/mydots/CLAUDE.md" 2>/dev/null; then
  ok "migrate: a link to the user's own dotfiles is still migrated"
else
  bad "migrate: a link to the user's own dotfiles is still migrated" \
      "the repo-symlink skip became a blanket skip"
fi

# The REGULAR-FILE case is a separate row, and it is the one that loses data. On the
# symlinked fixture above ~/.zshrc.bak survived only because sed failed BEFORE writing its
# backup - a pass for the wrong reason. When the target is an ordinary file the sed
# succeeds, writes "$f.bak" over the user's own backup, and the next line rm's it.
# Reproduced against committed code: MY BACKUP -> GONE.
h2="$TMPROOT/migrate_regular"; mkdir -p "$h2/.claude"
printf '%s\n' '=== claude-dotfiles:shortcuts:begin ===' 'body' > "$h2/.zshrc"
printf '%s\n' "$USER_BAK" > "$h2/.zshrc.bak"
ZSHRC="$h2/.zshrc" CLAUDE_DIR="$h2/.claude" \
  bash -c "set -euo pipefail; source '$LIB'; migrate_legacy_markers" >/dev/null 2>&1 || true
if [ -f "$h2/.zshrc.bak" ] && [ "$(cat "$h2/.zshrc.bak")" = "$USER_BAK" ]; then
  ok "migrate: regular-file target - user's ~/.zshrc.bak survives"
else
  bad "migrate: regular-file target - user's ~/.zshrc.bak survives" \
      "sed -i.bak overwrote a backup the installer does not own"
fi
if grep -Fq 'improv:shortcuts:begin' "$h2/.zshrc" 2>/dev/null; then
  ok "migrate: regular-file target - the rename still happens"
else
  bad "migrate: regular-file target - the rename still happens" "the substitution did not run"
fi

# A file with no legacy markers must not be rewritten at all.
if [ ! -e "$h/.claude/CLAUDE.local.md" ]; then
  ok "migrate: an absent file is not conjured into existence"
else
  bad "migrate: an absent file is not conjured into existence" "the loop created a file"
fi

# ============================================================
# The primitive's option parser
# ============================================================
# It is now a general primitive reached through two wrappers, so its argument handling is
# a real surface rather than an internal detail. Each row here is a way the parser could
# silently do the wrong thing to a user's file instead of refusing.
echo "-- option parser --"
g="$TMPROOT/opt"; mkdir -p "$g"
printf '%s\n' 'export KEEP_ME=yes' '<!-- b -->' 'junk' '<!-- e -->' > "$g/f"
untouched(){ grep -Fqx 'export KEEP_ME=yes' "$g/f"; }

# No --file and no ZSHRC in the environment must REFUSE, not operate on the empty path.
# Before this guard the bare `$ZSHRC` default killed the caller under `set -u` before the
# option parser ran, which made every --file caller fail for a reason none of them named.
if bash -c "unset ZSHRC; source '$LIB'; zshrc_block_delete '<!-- b -->' '<!-- e -->'" 2>/dev/null; then
  bad "no --file and no ZSHRC is refused" "it reported success with no target"
else
  ok "no --file and no ZSHRC is refused"
fi
# A flag missing its value must not swallow the next argument as a path - and must not
# SPIN. Without the arity check the `shift 2` fails, $# never decreases, and the option
# loop runs forever; the mutation that removed the check hung this suite instead of
# failing it. A hang is the worst regression signal there is, so this row is deadlined
# and reports a timeout as its own distinct failure rather than counting it as a refusal.
deadline(){
  local secs="$1"; shift
  "$@" & local p=$!
  ( sleep "$secs"; kill -9 "$p" 2>/dev/null ) & local w=$!
  wait "$p" 2>/dev/null; local rc=$?
  kill "$w" 2>/dev/null; wait "$w" 2>/dev/null
  # 137 = SIGKILL from the watchdog. Anything else is the command's own status.
  return "$rc"
}
deadline 10 bash -c "unset ZSHRC; source '$LIB'; zshrc_block_delete --file" 2>/dev/null
rc=$?
if [ "$rc" = 137 ]; then
  bad "--file with no value is refused" "the option loop SPUN - shift 2 fails and \$# never decreases"
elif [ "$rc" = 0 ]; then
  bad "--file with no value is refused" "it accepted a dangling flag"
else
  ok "--file with no value is refused"
fi
if bash -c "unset ZSHRC; source '$LIB'; safe_block_delete '$g/f' --wat '<!-- e -->'" 2>/dev/null; then
  bad "option-shaped begin marker is refused" "the end marker may have run as a sed script"
else
  ok "option-shaped begin marker is refused"
fi
# An OMITTED end marker is the dangerous one. The awk planner pairs with `line == e`, so
# an empty end matches the first BLANK LINE and the delete silently runs from the begin
# marker to there and returns 0. safe_block_delete forwards "$@", so this is one dropped
# argument away at any call site. Reproduced before the guard: a fixture with a blank line
# after the block came back with the user's following content gone and rc=0.
b="$TMPROOT/emptyend"; mkdir -p "$b"
printf '%s\n' 'keep A' '<!-- b -->' 'junk1' '' 'keep B' > "$b/f"
if bash -c "unset ZSHRC; source '$LIB'; safe_block_delete '$b/f' '<!-- b -->'" 2>/dev/null; then
  bad "omitted end marker is refused" "it reported success"
else
  ok "omitted end marker is refused"
fi
if grep -Fqx 'keep B' "$b/f" && grep -Fqx 'junk1' "$b/f"; then
  ok "omitted end marker leaves the file untouched"
else
  bad "omitted end marker leaves the file untouched" \
      "the empty end matched a blank line and deleted through it"
fi
# ISOLATES THE OPTION-LOOP ARM. The row above cannot: for a leading-dash begin marker the
# positional guard and the loop's `-*` arm are redundant, so it passes either way (a
# mutant that turns `-*) return 1` into `-*) break` keeps it green - found by independent
# review). This input reaches the loop in SCRIPT mode, where there is no positional guard
# behind it: with `break` the parser stops, the script still runs and the file is
# rewritten; only the `-*` arm refuses.
if bash -c "unset ZSHRC; source '$LIB'; zshrc_block_delete --file '$g/f' --script 's/KEEP_ME/CLOBBERED/' --wat" 2>/dev/null; then
  bad "unknown flag after --script is refused" "the parser fell through and ran the script"
else
  ok "unknown flag after --script is refused"
fi
grep -Fq CLOBBERED "$g/f" \
  && bad "unknown flag after --script leaves the file untouched" "the script ran anyway" \
  || ok "unknown flag after --script leaves the file untouched"

untouched && ok "refusals leave the target untouched" \
          || bad "refusals leave the target untouched" "a refused call still wrote the file"
# And the wrappers still work, so none of the above became a blanket refusal.
if bash -c "unset ZSHRC; source '$LIB'; safe_block_delete '$g/f' '<!-- b -->' '<!-- e -->'" 2>/dev/null \
   && ! grep -Fq junk "$g/f" && untouched; then
  ok "safe_block_delete still deletes a real block"
else
  bad "safe_block_delete still deletes a real block" "the argument guards are over-broad"
fi
if bash -c "unset ZSHRC; source '$LIB'; safe_sed_apply '$g/f' 's/KEEP_ME/KEPT/'" 2>/dev/null \
   && grep -Fq 'export KEPT=yes' "$g/f"; then
  ok "safe_sed_apply applies a substitution"
else
  bad "safe_sed_apply applies a substitution" "script mode did not run"
fi

echo ""
echo "userfile-safe-edit: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
echo "PASS: every user-owned file edit goes through the safe shape"
