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
# CONTAINMENT. Every row that drives the real installer drives a STAGED COPY of it under
# $TMPROOT, never the working checkout, and a row at the end of the install section proves
# the checkout's executable set came through unchanged. This is not hygiene theatre: the
# installer chmods scripts under its own $REPO_DIR, so running it from the checkout made
# this suite mutate the repo whose behaviour it reports on.
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

# ------------------------------------------------------------
# Content hashing - and why a MISSING hash tool is a harness failure
# ------------------------------------------------------------
# The cycle row near the bottom is the only row in this file that proves `--only memory`
# never writes the assembled block back into the payload source, and it proves it by
# comparing a hash of claude/CLAUDE.md before against after. Spelled inline as
# `$(shasum "$f" | awk '{print $1}')` that comparison is VACUOUS on a machine with no
# shasum: both sides come back EMPTY, empty equals empty, and the row reports PASS on a
# box where it measured nothing at all. shasum exists here, which is precisely why the
# hole went unnoticed - the row was green for the right reason on one machine and would
# have been green for no reason on the next.
#
# A row that certifies a property this run did not measure is worse than no row, so the
# missing tool aborts the harness (exit 2) instead of passing quietly.
#
# The candidate list is overridable for ONE reason: so this fail-loud path is itself
# provable, which is the standard every other row here is held to.
#   IMPROV_TEST_HASH_TOOLS=definitely_not_a_tool bash test-userfile-safe-edit.sh  -> exit 2
HASH_TOOLS="${IMPROV_TEST_HASH_TOOLS:-shasum sha256sum md5sum openssl cksum}"
HASHER=""
for _c in $HASH_TOOLS; do
  command -v "$_c" >/dev/null 2>&1 && { HASHER="$_c"; break; }
done
[ -n "$HASHER" ] || {
  echo "HARNESS: no content-hashing tool on PATH (tried: $HASH_TOOLS)." >&2
  echo "HARNESS: the payload-source cycle row cannot be measured without one, and an" >&2
  echo "HARNESS: empty-equals-empty pass there would certify a property never checked." >&2
  exit 2
}

# hash_file <path> - sets HASH_OUT, or aborts the harness.
#
# It sets a global instead of printing because it is NEVER safe to call this in a `$( )`:
# `exit 2` inside a command substitution kills only the subshell, the caller carries on
# with an empty string, and the empty-equals-empty vacuity is straight back. The awkward
# calling convention is the guardrail.
HASH_OUT=""
hash_file(){
  local f="$1" h=""
  [ -f "$f" ] || { echo "HARNESS: cannot hash '$f' - not a regular file" >&2; exit 2; }
  case "$HASHER" in
    shasum|sha256sum|md5sum) h="$("$HASHER" "$f" 2>/dev/null | awk '{print $1}')" ;;
    openssl)                 h="$(openssl dgst -sha256 "$f" 2>/dev/null | awk '{print $NF}')" ;;
    cksum)                   h="$(cksum "$f" 2>/dev/null | awk '{print $1 "-" $2}')" ;;
    *)                       echo "HARNESS: no hash recipe for '$HASHER'" >&2; exit 2 ;;
  esac
  [ -n "$h" ] || { echo "HARNESS: $HASHER produced no hash for '$f'" >&2; exit 2; }
  HASH_OUT="$h"
}

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
#
# TWO LISTS, AND THE DIFFERENCE MATTERS. The SUBJECTS are the functions this file's rows
# exercise; every one of them must be present or the suite is not testing what it says.
# The SUPPORT list is file-scope helpers the subjects happen to delegate to right now -
# these come and go as install.sh is refactored, so they are extracted IF PRESENT and are
# deliberately NOT asserted by name. Hardcoding a helper name here bought two spurious
# failures within an hour when the installer stopped defining it.
#
# What actually enforces completeness is the generic dependency row below: whatever the
# subjects call, defined anywhere in install.sh, must end up in this extract. That survives
# the helper set changing in either direction, which a name list cannot.
LIB="$TMPROOT/extracted.sh"
{
  awk '/^zshrc_block_delete\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^safe_block_delete\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^safe_sed_apply\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^deactivate_brain\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^migrate_legacy_markers\(\) \{/,/^\}/' "$INSTALLER"
  # support helpers, extracted only if this revision of install.sh defines them
  for _h in repo_symlink_points_into_repo record_component_failure; do
    awk -v fn="$_h" '$0 ~ "^" fn "\\(\\) \\{", /^\}/' "$INSTALLER"
  done
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

# THE NAMED LIST ABOVE ONLY CATCHES DEPENDENCIES SOMEONE ALREADY THOUGHT OF, and that is
# how this suite spent a session reporting on a branch that never ran: install.sh grew a
# call to the file-scope helper repo_symlink_points_into_repo, the extraction list was not
# updated, and `if repo_symlink_points_into_repo ...` became a command-not-found that
# evaluates FALSE - indistinguishable from an honest "no, that is not a repo symlink".
# Rows kept passing because the fixture happened to satisfy them for the wrong reason.
#
# This row is the general form: ANY top-level function install.sh defines, called from
# executable code inside the extract but not defined there, is a harness gap. It goes red
# the first time the installer grows a dependency this file does not carry, instead of the
# next time somebody hand-audits the list.
undefined_deps=""
lib_defined="$(bash -c "source '$LIB' 2>/dev/null; declare -F" 2>/dev/null | awk '{print $3}' | LC_ALL=C sort -u)"
# Comments are stripped first: several of these names are MENTIONED in the primitives'
# write-ups (deactivate_component, deactivate_memory), and a mention is not a call.
lib_code="$(sed -e 's/[[:space:]]#.*$//' -e '/^[[:space:]]*#/d' "$LIB")"
# CANDIDATE NAMES come from both definition spellings. `^name()` at column 0 is the house
# style, but a `function name {` definition would otherwise never become a candidate and so
# could never be reported missing.
inst_fns="$( { grep -oE '^[a-z_][a-z0-9_]*[[:space:]]*\(\)' "$INSTALLER" | sed 's/[[:space:]]*()//'
               grep -oE '^function[[:space:]]+[a-z_][a-z0-9_]*' "$INSTALLER" | awk '{print $2}'
             } | LC_ALL=C sort -u )"
# COMMAND POSITION, and the trailing boundary matters as much as the leading one. The first
# version of this guard required whitespace-or-EOL after the name, so `if fn; then`,
# `while fn; do`, `{ fn; }` and a `case` arm `pat) fn ;;` all evaded it - the very shapes a
# shell script is written in. Leading: start of line, a list/pipeline/group/case-arm
# character, or a compound-command keyword. Trailing: whitespace, or any character that can
# legally end a simple command.
for fn in $inst_fns; do
  printf '%s\n' "$lib_defined" | grep -qx "$fn" && continue
  printf '%s\n' "$lib_code" \
    | grep -qE "(^|[;&|(){}!]|\b(if|then|else|elif|do|while|until)\b)[[:space:]]*$fn([[:space:]]|[;&|)}]|$)" \
    && undefined_deps="$undefined_deps $fn"
done
if [ -z "$undefined_deps" ]; then
  ok "extract has no undefined function dependencies"
else
  bad "extract has no undefined function dependencies" \
      "called but never defined:$undefined_deps - each one degrades to command-not-found, which is FALSE, which silently skips the branch under test"
fi

# ============================================================
# Structural: no `sed -i` may survive anywhere in install.sh
# ============================================================
# The zshrc suite's row is scoped to "$ZSHRC". This one is total, because the whole point
# of this unit is that scoping the check to one victim is what let the others survive.
# Continuations are joined so a wrapped statement cannot slip past a line-oriented grep.
#
# THE MATCHER USED TO BE `sed[[:space:]]+-i`, AND THE COMMENT HERE USED TO CLAIM IT FAILED
# ON ANY SURVIVING `sed -i`. IT DID NOT. That pattern requires `-i` to be the FIRST token
# after `sed`, so every in-place edit carrying an option ahead of it walked straight past:
#   sed -E -i.bak 's/a/b/' "$ZSHRC"     -> 0 matches
#   sed -n -i.bak 's/a/b/' "$ZSHRC"     -> 0 matches
#   sed --in-place 's/a/b/' "$ZSHRC"    -> 0 matches   (GNU spelling)
# All three are the exact defect this row exists to keep out, and all three were invisible
# to it. Verified by running the awk directly against each line before and after the fix.
#
# The matcher now skips a RUN of leading option tokens - each must itself start with `-`,
# so a sed SCRIPT argument (`'s/x/y/'`, `"$var"`, a bare filename) ends the run and cannot
# be mistaken for one. That keeps the decoys out:
#   sed 's/-i/x/' f                     -> 0 matches   (-i inside the SCRIPT, not an option)
#
# A PURE REGEX CANNOT DO THIS, and the first repair of this row proved it by missing three
# more spellings that cross-model review then named: `sed -Ei.bak` (combined short cluster),
# `sed -ni.bak`, and `sed -e 's/a/b/' -i FILE` (GNU accepts options AFTER the script). The
# matcher is now a TOKEN SCAN, which is what the question actually is: split the logical
# line on pipeline and list separators, find the segments whose command is sed, and ask
# whether any of that segment's argument tokens is an in-place option - `--in-place`, or a
# short cluster containing i (`-i`, `-i.bak`, `-Ei.bak`, `-ni`).
#
# Scoping to the sed segment is what keeps `grep -i` on the other side of a pipe out, and
# requiring the command token to be sed / gsed / a path ending in /sed is what keeps a word
# merely ENDING in "sed" out (`echo parsed -i` was a false positive of the regex form).
# LC_ALL=C IS LOAD-BEARING, not decoration. mask_quotes walks the line one character at a
# time, and install.sh contains multibyte characters (a bullet in a printf around line 3055).
# In a UTF-8 locale that walk aborts the whole awk with "towc: multibyte conversion failure",
# n_sedi comes back EMPTY, and the comparison below is then empty-vs-"0" - a row that fails
# for a reason that has nothing to do with sed. Byte semantics are also what this scan wants:
# it is looking for ASCII option tokens, not text.
sedi_awk_rc=0
n_sedi="$(LC_ALL=C awk '
  function mask_quotes(s,   out, i, c, q, sq) {
    # Separators INSIDE a quoted string are not command separators. Without this, a sed
    # SCRIPT containing one - a sed -e s/a;b/c/ script followed by -i - was split
    # mid-script and the
    # trailing -i landed in a segment whose command was no longer sed. Named by review.
    sq = sprintf("%c", 39); out = ""; q = ""
    for (i = 1; i <= length(s); i++) {
      c = substr(s, i, 1)
      if (q == "") { if (c == sq || c == "\"") q = c; out = out c }
      else { if (c == q) { q = ""; out = out c } else out = out (c ~ /[|;&#]/ ? "X" : c) }
    }
    # a trailing comment is not code. Masked first, so a # inside a quoted string is not
    # mistaken for one: `sed s/a/b/ FILE # the old sed -i bug` was counted as a live edit.
    sub(/[[:space:]]#.*$/, "", out)
    return out
  }
  function has_inplace_sed(line,   masked, n, parts, i, m, toks, j, k, tok, cmd) {
    masked = mask_quotes(line)
    n = split(masked, parts, /[|;&]/)
    for (i = 1; i <= n; i++) {
      m = split(parts[i], toks, /[[:space:]]+/)
      # sed must be the COMMAND of the segment, not merely a word in it: `echo sed -i` is
      # not an in-place edit. VAR=val assignment prefixes are skipped, so
      # `LC_ALL=C sed -i.bak ...` is still seen.
      k = 1
      while (k <= m && (toks[k] == "" \
                        || toks[k] ~ /^[A-Za-z_][A-Za-z0-9_]*=/ \
                        || toks[k] ~ /^(command|exec|env|time|nohup|nice|sudo|builtin)$/)) k++
      if (k > m) continue
      cmd = toks[k]
      if (cmd !~ /^([^[:space:]]*\/)?g?sed$/) continue
      for (j = k + 1; j <= m; j++) {
        tok = toks[j]
        if (tok == "") continue
        # `--` ends the options; everything after it is an operand, so a literal -i there
        # is a FILENAME, not in-place mode.
        if (tok == "--") break
        if (tok ~ /^--in-place/) return 1
        if (tok ~ /^-[A-Za-z]*i/) return 1
      }
    }
    return 0
  }
  { line = $0 }
  { while (line ~ /\\$/ && (getline nxt) > 0) { sub(/\\$/, "", line); line = line nxt } }
  line ~ /^[[:space:]]*#/ { next }
  has_inplace_sed(line) { n++ }
  END { print n+0 }
' "$INSTALLER")" || sedi_awk_rc=$?
# BOTH failure signals, because they are different failures. A non-numeric result catches
# the observed one (awk aborts mid-stream and prints nothing); the exit status catches an
# awk that fails AFTER printing digits, which the value check alone would wave through.
case "${n_sedi:-}" in
  ''|*[!0-9]*) echo "HARNESS: the sed -i scan produced '${n_sedi:-}' instead of a count - awk failed" >&2; exit 2 ;;
esac
[ "${sedi_awk_rc:-0}" = 0 ] || { echo "HARNESS: the sed -i scan's awk exited ${sedi_awk_rc}" >&2; exit 2; }
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
# `-e` FOLLOWS the link, so it is FALSE for a DANGLING one. This row used to be `[ -e ]`
# alone, which meant a run that deleted the link's TARGET and left the link itself in
# place scored a PASS - the file is gone, the dangling link is not, and the check could
# not tell those apart. That is the vacuous direction: the row read as evidence for
# "removed, not followed" while the shape it was built to reject sailed through.
# claude/hooks/test-install-prune-skills.sh already had the two-sided form; this now
# matches it. Gone means gone: neither a resolvable path nor a link at that path.
if [ -e "$h/.claude/CLAUDE.md" ] || [ -L "$h/.claude/CLAUDE.md" ]; then
  bad "brain: a link into the repo is removed, not followed" \
      "still present as $([ -L "$h/.claude/CLAUDE.md" ] && echo 'a symlink (dangling or not)' || echo 'a regular file')"
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
# ------------------------------------------------------------
# EVERY row that drives the real installer drives it from a STAGED COPY
# ------------------------------------------------------------
# These rows used to run `bash "$INSTALLER"` out of the working checkout. That is not a
# read-only operation: install.sh's memory section runs
#     chmod +x "$REPO_DIR/claude/startup-check.sh"                     (install.sh)
# and the brain/hooks/hud/statusline sections do the same to their own scripts, with
# $REPO_DIR resolved from the installer's own location. So a suite whose whole subject is
# "the installer must not write outside the paths it owns" was itself reaching out of its
# temp dir on every run and changing the mode of tracked files in the checkout.
#
# It is currently a no-op only because those files are already executable. That is luck,
# not containment, and luck is what this file exists to stop relying on.
#
# One staged copy, shared: install.sh plus claude/ is everything `--only brain` and
# `--only memory` read. The cycle row further down still builds its OWN copy, because it
# hashes that copy's claude/CLAUDE.md and must not inherit anything these rows did to it.
STAGE="$TMPROOT/stage"; mkdir -p "$STAGE" || { echo "HARNESS: mkdir stage failed" >&2; exit 2; }
cp "$INSTALLER" "$STAGE/install.sh"        || { echo "HARNESS: staging install.sh failed" >&2; exit 2; }
cp -R "$REPO_DIR_REAL/claude" "$STAGE/"    || { echo "HARNESS: staging claude/ failed" >&2; exit 2; }
STAGE="$(cd "$STAGE" && pwd)"
STAGED_INSTALLER="$STAGE/install.sh"

# The real checkout's executable set, snapshotted so the row at the end of this section
# can prove nothing below reached it.
#
# THE EXECUTABLE BIT SPECIFICALLY, not content and not mtime: `chmod +x` is the write
# install.sh performs into REPO_DIR, and the content and mtimes of these files change
# legitimately while other work is in flight, so a broader snapshot would flake instead of
# inform. One `find`, no per-file forks.
repo_exec_set(){
  find "$REPO_DIR_REAL/claude" "$REPO_DIR_REAL/bin" -type f -perm -u+x 2>/dev/null | LC_ALL=C sort
}
exec_set_before="$(repo_exec_set)"
[ -n "$exec_set_before" ] || { echo "HARNESS: repo_exec_set found nothing - the guard below would be vacuous" >&2; exit 2; }

# POSITIVE CONTROL for that guard. Strip the executable bit from the STAGED copy of the
# file install.sh chmods; if it is not back by the end of this section, the installer no
# longer performs that write, the guard above is watching a path nothing travels, and the
# "real checkout untouched" row below has quietly become a row that cannot fail.
STAGED_CHMOD_PROBE="$STAGE/claude/startup-check.sh"
[ -f "$STAGED_CHMOD_PROBE" ] || { echo "HARNESS: staged claude/startup-check.sh missing" >&2; exit 2; }
chmod -x "$STAGED_CHMOD_PROBE" || { echo "HARNESS: chmod -x on the staged probe failed" >&2; exit 2; }

echo "-- install path (REAL installer, --only brain --yes) --"
e2e="$TMPROOT/e2e_malformed"; mkdir -p "$e2e/.claude"; : > "$e2e/.zshrc"
printf '%s\n' '# my own global rules' '<!-- improv:brain:begin -->' 'OLD' "$TAIL" > "$e2e/.claude/CLAUDE.md"
size_before="$(wc -c < "$e2e/.claude/CLAUDE.md" | tr -d ' ')"
e2e_rc=0
for _ in 1 2 3; do
  HOME="$e2e" bash "$STAGED_INSTALLER" --only brain --yes >"$e2e/out.log" 2>&1 || e2e_rc=$?
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
  HOME="$e2eok" bash "$STAGED_INSTALLER" --only brain --yes >"$e2eok/out.log" 2>&1 || true
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
# The memory-discipline block - the SAME contract, on the other component
# ============================================================
# This section existed with none of the guarantees above and nothing covered it. It did
# not emit markers of its own: it `cat`-ed claude/memory-discipline-section.md verbatim
# and relied on that file wrapping ITSELF in `<!-- Improv:memory-discipline:begin -->`,
# capital I - the same drift that hit claude/RULES.md. The presence check it guarded
# with is a LOWERCASE fixed string, so it never matched the marker the installer had
# just written, and every re-run appended another whole copy.
#
# Measured against the real installer before the fix: 1 -> 2 -> 3 begin markers and
# 120 -> 240 -> 360 lines over three consecutive runs, each exiting 0 and printing
# "Installation complete". Byte-identical to the unbounded brain-block failure above,
# reached by one letter of case, and invisible on a machine whose older install had
# already written lowercase markers - it only fires on a fresh install.
#
# These rows drive the REAL installer for the same reason section 6 does: a mirror of
# the logic would carry its own copy of the bug's absence and pass regardless.
echo "-- install path (REAL installer, --only memory --yes) --"
e2emem="$TMPROOT/e2e_memory"; mkdir -p "$e2emem/.claude"; : > "$e2emem/.zshrc"
printf '%s\n' '# my own global rules' "$TAIL" > "$e2emem/.claude/CLAUDE.md"
mem_rc=0
for _ in 1 2 3; do
  HOME="$e2emem" bash "$STAGED_INSTALLER" --only memory --yes >"$e2emem/out.log" 2>&1 || mem_rc=$?
done
if [ "$mem_rc" = 0 ]; then
  ok "install(memory): three runs do not fail the install"
else
  bad "install(memory): three runs do not fail the install" "installer exited $mem_rc"
fi
# Case-insensitive on purpose: the defect wrote capital-I markers, so a lowercase-only
# count would report "1" while three capital-I copies sat in the file.
begins="$(grep -ciE '<!--[[:space:]]*improv:memory-discipline:begin[[:space:]]*-->' "$e2emem/.claude/CLAUDE.md" 2>/dev/null || echo 0)"
if [ "$begins" = "1" ]; then
  ok "install(memory): three runs leave exactly one begin marker"
else
  bad "install(memory): three runs leave exactly one begin marker" \
      "$begins markers - the block duplicates on every run and the file grows without bound"
fi
# The payload must not carry the block's own delimiters. A self-wrapping payload is what
# made the presence check unmatchable in the first place.
if grep -ciE '<!--[[:space:]]*improv:(brain|rules|local|memory-discipline):(begin|end)' \
     "$REPO_DIR_REAL/claude/memory-discipline-section.md" 2>/dev/null | grep -qx 0; then
  ok "install(memory): the payload source carries no markers of its own"
else
  bad "install(memory): the payload source carries no markers of its own" \
      "the payload wraps itself, so the installer cannot parse what it wrote"
fi
# A refresh check anchored on a string the payload genuinely owns. 'Beats Discipline' is
# the heading the memory-discipline source carries after the beats rename; asserting it
# here is what proves the block was rewritten from the current source rather than left.
if grep -Fq 'Beats Discipline' "$e2emem/.claude/CLAUDE.md" 2>/dev/null; then
  ok "install(memory): the block carries content from its payload source"
else
  bad "install(memory): the block carries content from its payload source" \
      "the append did not reach the file, or the source drifted from the installed block"
fi
if grep -Fqx "$TAIL" "$e2emem/.claude/CLAUDE.md"; then
  ok "install(memory): the user's trailing content survives three runs"
else
  bad "install(memory): the user's trailing content survives three runs" "the user's content was lost"
fi
# A malformed block must SUPPRESS the append here too, exactly as it does for brain.
e2emembad="$TMPROOT/e2e_memory_malformed"; mkdir -p "$e2emembad/.claude"; : > "$e2emembad/.zshrc"
printf '%s\n' '# my own global rules' '<!-- improv:memory-discipline:begin -->' 'OLD' "$TAIL" \
  > "$e2emembad/.claude/CLAUDE.md"
mem_size_before="$(wc -c < "$e2emembad/.claude/CLAUDE.md" | tr -d ' ')"
membad_rc=0
HOME="$e2emembad" bash "$STAGED_INSTALLER" --only memory --yes >"$e2emembad/out.log" 2>&1 || membad_rc=$?
# THE INSTALLER MUST BE SHOWN TO HAVE REACHED THE BRANCH UNDER TEST, and this row is what
# shows it. The `|| true` plus byte-count comparison that used to stand alone here is a
# row that PASSES WHEN THE INSTALLER DIES. Any early exit - a syntax error, a missing
# payload file, an unrelated abort three sections earlier - leaves the fixture untouched,
# the byte counts match, and the row files a clean bill of health for code that never ran.
# It credits the suppression for an absence of writing that was really an absence of
# executing, which is the same failure shape as the empty-hash comparison above.
#
# The anchors are the suppression branch's OWN output, both directions:
#   present - the refusal warning install.sh prints when safe_block_delete declines
#   absent  - the success line it prints instead when it does append
# so the row cannot be satisfied by a run that skipped the branch OR by one that took the
# other side of it.
# DELIBERATELY NOT AN EXIT-CODE ASSERTION. The installer's status for "a component did not
# fully apply" is a live contract - a malformed memory block currently exits 1 while a
# malformed BRAIN block exits 0 - and pinning a number here would make this row report on
# that contract instead of on the question it asks. Output anchors answer the question
# directly and cannot be produced by a run that died early:
#   1. the section header      - the memory component was actually selected and entered
#   2. the refusal warning     - safe_block_delete declined and the branch under test ran
#   3. NO success line         - the append really was suppressed, not merely absent
#   4. the end-of-run summary  - the installer reached its own conclusion, so an early
#                                abort cannot be what left the fixture untouched
# why_not <log> <canonical|legacy> - names the anchor that failed, rather than asserting a
# cause. A hint that always says "did not reach the branch" is wrong in the case that
# matters most: an installer that DID reach it and appended anyway fails on the success-line
# anchor, and a hint blaming an early exit sends the reader to the wrong end of the problem.
why_not(){
  local log="$1" kind="$2" msg=""
  grep -Fq -- '--- Memory subsystem ---' "$log" || msg="$msg; never entered the memory section"
  if [ "$kind" = legacy ]; then
    # BOTH legacy anchors, because the assertion requires both. Checking only the first
    # meant a run that printed "legacy memory-discipline block in ..." without the refusal
    # phrase failed the row and produced a hint naming no cause at all.
    grep -Fq -- 'legacy memory-discipline block in' "$log" || msg="$msg; the legacy block was never matched"
    grep -Fq -- 'is malformed - NOT refreshing it' "$log" || msg="$msg; the legacy refusal phrase was not printed"
  else
    grep -Fq -- 'is malformed (no closing marker, or two opens) - NOT refreshing it' "$log" \
      || msg="$msg; the refusal warning was not printed"
  fi
  grep -Fq -- 'Memory Discipline section written to' "$log" \
    && msg="$msg; IT APPENDED ANYWAY - the success line is present, so the suppression did not hold"
  grep -Fq -- '- Memory subsystem:' "$log" || msg="$msg; the run never reached its end-of-run summary"
  printf '%s' "${msg#; }"
}
if grep -Fq -- '--- Memory subsystem ---' "$e2emembad/out.log" \
   && grep -Fq -- 'is malformed (no closing marker, or two opens) - NOT refreshing it' "$e2emembad/out.log" \
   && ! grep -Fq -- 'Memory Discipline section written to' "$e2emembad/out.log" \
   && grep -Fq -- '- Memory subsystem:' "$e2emembad/out.log"; then
  ok "install(memory): the malformed-block suppression branch actually ran"
else
  bad "install(memory): the malformed-block suppression branch actually ran" \
      "rc=$membad_rc: $(why_not "$e2emembad/out.log" canonical)"
fi
if [ "$(wc -c < "$e2emembad/.claude/CLAUDE.md" | tr -d ' ')" = "$mem_size_before" ]; then
  ok "install(memory): a malformed block leaves the file byte-identical"
else
  bad "install(memory): a malformed block leaves the file byte-identical" "content was appended anyway"
fi
if grep -Fqx "$TAIL" "$e2emembad/.claude/CLAUDE.md"; then
  ok "install(memory): a malformed block leaves the user's trailing content"
else
  bad "install(memory): a malformed block leaves the user's trailing content" "the range ran to EOF"
fi
# A MALFORMED *LEGACY* (capital-I) BLOCK MUST SUPPRESS THE APPEND TOO. Found by
# cross-model review. Warning and appending anyway left the malformed legacy block in
# place AND added a fresh one - two begin markers, after which the canonical delete
# refuses on every future run and the user can uninstall NEITHER copy.
e2ememleg="$TMPROOT/e2e_memory_legacy_malformed"; mkdir -p "$e2ememleg/.claude"; : > "$e2ememleg/.zshrc"
printf '%s\n' '# my own global rules' '<!-- Improv:memory-discipline:begin -->' 'OLDLEGACY' "$TAIL" \
  > "$e2ememleg/.claude/CLAUDE.md"
leg_size="$(wc -c < "$e2ememleg/.claude/CLAUDE.md" | tr -d ' ')"
leg_rc=0
HOME="$e2ememleg" bash "$STAGED_INSTALLER" --only memory --yes >"$e2ememleg/out.log" 2>&1 || leg_rc=$?
# Same reasoning as the canonical malformed row above, and the anchor is deliberately the
# LEGACY warning specifically. The canonical refusal message is a substring-neighbour of
# this one, so a looser match would go green on the wrong branch and this row would stop
# distinguishing the capital-I path from the lowercase one it was written to cover.
if grep -Fq -- '--- Memory subsystem ---' "$e2ememleg/out.log" \
   && grep -Fq -- 'legacy memory-discipline block in' "$e2ememleg/out.log" \
   && grep -Fq -- 'is malformed - NOT refreshing it' "$e2ememleg/out.log" \
   && ! grep -Fq -- 'Memory Discipline section written to' "$e2ememleg/out.log" \
   && grep -Fq -- '- Memory subsystem:' "$e2ememleg/out.log"; then
  ok "install(memory): the LEGACY suppression branch actually ran"
else
  bad "install(memory): the LEGACY suppression branch actually ran" \
      "rc=$leg_rc: $(why_not "$e2ememleg/out.log" legacy)"
fi
if [ "$(wc -c < "$e2ememleg/.claude/CLAUDE.md" | tr -d ' ')" = "$leg_size" ]; then
  ok "install(memory): a malformed LEGACY block suppresses the append"
else
  bad "install(memory): a malformed LEGACY block suppresses the append" \
      "a fresh block was appended beside the malformed legacy one - two begins, uninstallable"
fi

# THE CYCLE: ~/.claude/CLAUDE.md symlinked INTO the repo. safe_block_delete and `>>` both
# follow symlinks by design, so without a migration `--only memory` writes the assembled
# block back into claude/CLAUDE.md - the payload source. Output overwrites input, which is
# the root cause this whole repair exists to eliminate. The migration lived only in the
# brain section and never ran when brain was not picked. Measured before the fix: the
# payload source went 184 -> 316 lines in ONE run.
#
# Runs against a COPY of the repo, never the real one: a regression here must not be able
# to rewrite a tracked source file.
echo "-- install path (REAL installer, legacy symlink cycle) --"
cyc="$TMPROOT/e2e_cycle"; mkdir -p "$cyc/repo" "$cyc/home/.claude"; : > "$cyc/home/.zshrc"
cp "$INSTALLER" "$cyc/repo/"
cp -R "$REPO_DIR_REAL/claude" "$cyc/repo/" 2>/dev/null
# Normalize the way install.sh does (`cd && pwd`). $TMPDIR can end in a slash, which
# leaves a `//` in the literal path and makes the installer's prefix comparison miss -
# a property of this harness's paths, not of the behaviour under test.
cyc_repo="$(cd "$cyc/repo" && pwd)"
ln -s "$cyc_repo/claude/CLAUDE.md" "$cyc/home/.claude/CLAUDE.md"
# hash_file, not `$(shasum ... | awk ...)`. See the helper's own header: inline, this
# comparison was empty-equals-empty on any machine without shasum, and this is the ONE row
# standing between the installer and the payload source it is assembled from.
hash_file "$cyc_repo/claude/CLAUDE.md"; cyc_before="$HASH_OUT"
HOME="$cyc/home" bash "$cyc/repo/install.sh" --only memory --yes >"$cyc/out.log" 2>&1 || true
hash_file "$cyc_repo/claude/CLAUDE.md"; cyc_after="$HASH_OUT"
if [ -n "$cyc_before" ] && [ "$cyc_before" = "$cyc_after" ]; then
  ok "install(memory): a repo-symlinked CLAUDE.md never writes back into the payload source"
else
  bad "install(memory): a repo-symlinked CLAUDE.md never writes back into the payload source" \
      "the assembled block was written INTO claude/CLAUDE.md - output overwrote input"
fi
# `! -L` ALONE IS NOT "migrated to a real file" - it is satisfied by the path being GONE.
# Same vacuity class as the dangling-link row above: the assertion names one outcome and
# accepts two. A migration that deleted the user's CLAUDE.md instead of converting it would
# have passed here. Both halves are checked, and the content is checked too, because a
# migration that produced an EMPTY regular file also satisfies `-f && ! -L`.
if [ -f "$cyc/home/.claude/CLAUDE.md" ] && [ ! -L "$cyc/home/.claude/CLAUDE.md" ] \
   && [ -s "$cyc/home/.claude/CLAUDE.md" ]; then
  ok "install(memory): a repo symlink is migrated to a real file"
else
  bad "install(memory): a repo symlink is migrated to a real file" \
      "wanted a non-empty regular file; got $([ -L "$cyc/home/.claude/CLAUDE.md" ] && echo 'a symlink' \
        || { [ -e "$cyc/home/.claude/CLAUDE.md" ] && echo 'an empty file' || echo 'nothing - the path was removed'; })"
fi

# ============================================================
# CONTAINMENT: nothing above reached outside $TMPROOT
# ============================================================
# Every row that drives the real installer ran it from a staged copy, and this is the row
# that says so rather than assuming it. Before the staging change these rows chmod'ed
# tracked files in the working checkout on every single run.
#
# The POSITIVE CONTROL comes first on purpose. `chmod +x "$REPO_DIR/..."` is a no-op when
# the file is already executable, so a guard watching for it would sit green forever
# whether or not the installer still performs that write. The staged probe had its
# executable bit stripped before the section began; if it is back, the write path is live,
# the containment guard below is guarding something real, and a future regression that
# points these rows back at the working checkout will be caught rather than shrugged at.
if [ -x "$STAGED_CHMOD_PROBE" ]; then
  ok "containment: the installer really does chmod inside its REPO_DIR (guard is live)"
else
  bad "containment: the installer really does chmod inside its REPO_DIR (guard is live)" \
      "the staged probe is still non-executable - install.sh no longer writes into REPO_DIR here, so the row below can no longer fail and must be re-anchored"
fi
exec_set_after="$(repo_exec_set)"
if [ "$exec_set_before" = "$exec_set_after" ]; then
  ok "containment: the real checkout's executable set is unchanged"
else
  bad "containment: the real checkout's executable set is unchanged" \
      "a row below reached out of \$TMPROOT: $(printf '%s\n' "$exec_set_before" "$exec_set_after" | LC_ALL=C sort | uniq -u | tr '\n' ' ')"
fi

# THE ROW ABOVE CANNOT CATCH THE REGRESSION IT IS NAMED FOR, and saying so is the point.
# Every file install.sh chmods in the checkout is ALREADY executable, so a row that
# mistakenly drove the working checkout would chmod a no-op and the executable set would
# come back identical. Cross-model review named this; it is correct. That row is a pin for
# the day one of those files is not already +x, and no more than that.
#
# THIS row is the one that can fail today, because it asserts the property directly instead
# of inferring it from a side effect: no executable line in this file may hand the WORKING
# checkout's installer to a `--only` run. Add `bash "$INSTALLER" --only ...` back anywhere
# below and it goes red immediately, whatever the file modes happen to be.
#
# Matching the literal `bash "$INSTALLER"` was not enough - review named four spellings that
# walked past it: `bash "${INSTALLER}"`, `bash -- "$INSTALLER"`, `"$BASH" "$INSTALLER"`, and
# spelling the path out as `"$REPO_DIR_REAL/install.sh"`, plus anything wrapped across a
# continuation. The test is now on the OPERANDS rather than the command word: a logical line
# that names the real installer AND passes `--only` is driving the working checkout, however
# the interpreter in front of it is written. Continuations are joined first, comments dropped.
n_realrun="$(LC_ALL=C awk '
  { line = $0 }
  { while (line ~ /\\$/ && (getline nxt) > 0) { sub(/\\$/, "", line); line = line nxt } }
  line ~ /^[[:space:]]*#/ { next }
  line ~ /(\$\{?INSTALLER\}?|\$\{?REPO_DIR_REAL\}?[^[:space:]]*\/install\.sh)/ && line ~ /--only/ { n++ }
  END { print n+0 }
' "${BASH_SOURCE[0]}")"
case "$n_realrun" in
  ''|*[!0-9]*) echo "HARNESS: the working-checkout scan produced '$n_realrun' instead of a count" >&2; exit 2 ;;
esac
if [ "$n_realrun" = "0" ]; then
  ok "containment: no row drives the working checkout's install.sh"
else
  bad "containment: no row drives the working checkout's install.sh" \
      "$n_realrun executable line(s) hand the real installer a --only run - stage a copy under \$TMPROOT instead"
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
