#!/usr/bin/env bash
# test-zshrc-safe-edit.sh - every edit install.sh makes to the user's ~/.zshrc goes
# through the ONE safe shape: snapshot to $TMPDIR, filter, write back through the path
# with `cat >`. No sibling ".bak" beside a file the installer does not own, and no
# `sed -i`, which refuses a non-regular file and so cannot repair a symlinked ~/.zshrc.
#
# WHY THIS SUITE EXISTS. The hazard was found by cross-model review on 2026-07-27, the
# fix landed on the shared primitive (zshrc_block_delete), and the hazard was written up
# in a 40-line comment above it - while two call sites 500 lines below kept running the
# exact `sed -i.bak "$ZSHRC"` the comment condemns. A documented hazard is not a fixed
# hazard. This suite asserts the property at the CALL SITES, not at the primitive, so a
# future site that inlines the pattern again goes red here instead of shipping.
#
# Every assertion below was NEGATIVE-CONTROLLED: run against the pre-fix installer, the
# .bak-preservation and symlink rows fail. An assertion nobody has watched fail is not
# evidence.
#
# Run: bash test-zshrc-safe-edit.sh
# Exit: 0 all green / 1 an assertion failed / 2 the harness itself could not set up
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="$REPO_DIR/install.sh"
[ -f "$INSTALLER" ] || { echo "HARNESS: install.sh not found at $INSTALLER" >&2; exit 2; }

pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); [ $# -gt 1 ] && echo "     hint: $2"; return 0; }

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/improv-zshrc-safe.XXXXXX")" \
  || { echo "HARNESS: mktemp -d failed" >&2; exit 2; }
cleanup(){ rm -rf "$TMPROOT"; }
trap cleanup EXIT

# inode of a path, portable across BSD (macOS) and GNU stat.
inode_of(){ stat -f %i "$1" 2>/dev/null || stat -c %i "$1" 2>/dev/null; }
# octal permission bits, same portability problem.
perms_of(){ stat -f %Lp "$1" 2>/dev/null || stat -c %a "$1" 2>/dev/null; }

# ============================================================
# The library under test - EXTRACTED from install.sh, never paraphrased.
# ============================================================
# install.sh's lib-only seam returns long before these are defined, so sourcing the
# installer cannot reach them. Same awk technique test-ampersand-shim.sh uses.
#
# EXTRACTION CONSTRAINT, READ BEFORE MOVING CODE. Each awk range runs from a function
# header at column 0 to the first following line that is exactly "}" at column 0. A
# helper hoisted to file scope therefore falls OUTSIDE every extract and must be added
# here explicitly, or the call site degrades into "command not found" - which the
# `|| warn` idiom at these sites converts into a silent no-delete rather than an error.
# That failure mode reads as an installer bug and points at the wrong file. It has
# already cost one investigation in the ampersand suite; hence the declare -f rows below.
LIB="$TMPROOT/extracted.sh"
{
  awk '/^zshrc_block_delete\(\) \{/,/^\}/' "$INSTALLER"
  # The path-taking wrappers. deactivate_discord and deactivate_nvm delegate to
  # safe_sed_apply; it and safe_block_delete are one-line delegations into the primitive
  # above, so they carry no mechanics of their own - but they are file-scope symbols and
  # therefore have to be listed here or the call sites become "command not found".
  awk '/^safe_block_delete\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^safe_sed_apply\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^deactivate_discord\(\) \{/,/^\}/' "$INSTALLER"
  awk '/^deactivate_nvm\(\) \{/,/^\}/' "$INSTALLER"
  # SUPPORT HELPERS, extracted only if this revision defines them. deactivate_discord has
  # delegated to file-scope helpers (repo_symlink_points_into_repo for "does this launcher
  # symlink belong to our checkout", record_component_failure on the failed-edit path) and
  # has also had them refactored back out again, both within one session. They are NOT
  # asserted by name below: pinning a support helper by name turns an installer refactor
  # into a spurious red, and the generic dependency row further down is what actually
  # enforces that whatever the subjects call ends up in this extract.
  #
  # The degradation being guarded against is real and silent in both directions: in an `if`
  # condition a command-not-found reads as FALSE, so the branch is skipped and rows report
  # on code that never ran; in BARE COMMAND POSITION under `set -euo pipefail` it aborts
  # the function with 127 before its own `return`, so a row about a return value reports on
  # the harness rather than on the installer.
  for _h in repo_symlink_points_into_repo record_component_failure; do
    awk -v fn="$_h" '$0 ~ "^" fn "\\(\\) \\{", /^\}/' "$INSTALLER"
  done
  # PARTIAL_FAILURES is the ledger's storage. It lives at install.sh FILE SCOPE, so it
  # falls outside every function extract, and the failed-edit rows read it to prove the
  # failure was recorded. Taken verbatim from the installer rather than declared here: if
  # its initial value ever changes, this follows instead of silently diverging from it.
  grep -m1 -E '^(declare -g |typeset -g )?PARTIAL_FAILURES=' "$INSTALLER"
  # install.sh's real logger, which the failure paths call.
  printf 'warn() { printf "warn: %%s\\n" "$1" >&2; }\n'
} > "$LIB"

bash -n "$LIB" 2>/dev/null && ok "extract parses" || bad "extract parses" "awk ranges are mismatched"

# The ledger rows read $PARTIAL_FAILURES under `set -u`, so its absence would kill the driver
# on an unbound variable and the failure would read as an installer defect instead of as this
# file needing an update. That is a HARNESS failure and it says so plainly.
# `declare -g` and `typeset -g` are accepted alongside the bare assignment, so an equivalent
# refactor of the ledger's storage is not a false alarm; only the variable disappearing is.
grep -qE '^(declare -g |typeset -g )?PARTIAL_FAILURES=' "$LIB" \
  || { echo "HARNESS: install.sh no longer defines PARTIAL_FAILURES at file scope - the failed-edit ledger rows below cannot run" >&2; exit 2; }

for fn in zshrc_block_delete safe_block_delete safe_sed_apply deactivate_discord deactivate_nvm; do
  if bash -c "source '$LIB'; declare -f $fn >/dev/null" 2>/dev/null; then
    ok "extract carries $fn"
  else
    bad "extract carries $fn" "add it to the awk extraction above"
  fi
done

# THE NAMED LIST ABOVE ONLY CATCHES DEPENDENCIES SOMEONE ALREADY THOUGHT OF. Both helpers
# added just above arrived in install.sh without this list being updated, and the suite did
# not say so - it reported an installer failure instead, which is the wrong file to go
# looking in. This row is the general form: any top-level function install.sh defines,
# called from executable code inside the extract but not defined there, is a harness gap
# and goes red the first time it appears.
undefined_deps=""
lib_defined="$(bash -c "source '$LIB' 2>/dev/null; declare -F" 2>/dev/null | awk '{print $3}' | LC_ALL=C sort -u)"
# Comments stripped first: these primitives carry long write-ups that NAME other functions,
# and a mention is not a call.
lib_code="$(sed -e 's/[[:space:]]#.*$//' -e '/^[[:space:]]*#/d' "$LIB")"
# Both definition spellings become candidates, or a `function name {` definition could
# never be reported missing.
inst_fns="$( { grep -oE '^[a-z_][a-z0-9_]*[[:space:]]*\(\)' "$INSTALLER" | sed 's/[[:space:]]*()//'
               grep -oE '^function[[:space:]]+[a-z_][a-z0-9_]*' "$INSTALLER" | awk '{print $2}'
             } | LC_ALL=C sort -u )"
# COMMAND POSITION. The trailing boundary matters as much as the leading one: requiring
# whitespace-or-EOL after the name let `if fn; then`, `while fn; do`, `{ fn; }` and a case
# arm `pat) fn ;;` all evade the guard - the ordinary shapes shell is written in.
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
      "called but never defined:$undefined_deps - in an \`if\` that is a silent FALSE, in command position it is a 127 abort"
fi

# ============================================================
# Structural: no `sed -i` may target "$ZSHRC" directly anywhere in install.sh.
# ============================================================
# This is the property in one grep. It catches a NEW site inlining the pattern, which
# the behavioral rows below cannot - they only know about the sites that exist today.
# Comment lines are excluded on purpose: the primitive carries a long write-up that has
# to be able to NAME the pattern it replaced. Only executable lines count.
#
# Backslash continuations are JOINED before matching, and ${ZSHRC} is accepted alongside
# $ZSHRC, because a single-line grep for one spelling is exactly the kind of check that
# reports clean while the defect walks past it. Both evasions were named by cross-model
# review of this suite.
#
# A THIRD EVASION, found later and live in this row until now: the matcher was
# `sed[[:space:]]+-i`, which requires `-i` to be the FIRST token after `sed`. Anything with
# an option in between - `sed -E -i.bak ... "$ZSHRC"`, `sed -n -i.bak ...`, GNU's
# `sed --in-place ...`, the combined cluster `sed -Ei.bak ...`, or `sed -e SCRIPT -i FILE`
# where the option follows the script - scored ZERO and the row stayed green. Confirmed by
# running the awk against each spelling directly.
#
# A pure regex kept losing this race, so the matcher is now a TOKEN SCAN shared with
# test-userfile-safe-edit.sh: split the logical line on pipeline and list separators, keep
# the segments whose command really is sed (or gsed, or a path ending in /sed - a word
# merely ENDING in "sed" does not count), and ask whether any argument token of that
# segment is an in-place option. Segment scoping is what keeps a `grep -i` on the far side
# of a pipe from being counted as an in-place edit.
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
  # join continuations into one logical statement before deciding anything
  { while (line ~ /\\$/ && (getline nxt) > 0) { sub(/\\$/, "", line); line = line nxt } }
  line ~ /^[[:space:]]*#/ { next }
  has_inplace_sed(line) && line ~ /\$\{?ZSHRC\}?/ { n++ }
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
  ok "install.sh has zero \`sed -i\` against \"\$ZSHRC\""
else
  bad "install.sh has zero \`sed -i\` against \"\$ZSHRC\"" \
      "$n_sedi site(s) still edit the user's shell config in place"
fi

# ============================================================
# Fixtures
# ============================================================
USER_BAK_CONTENT='# MY OWN HAND-MADE BACKUP - the installer does not own this file
export IRREPLACEABLE=1'

# Realistic ~/.zshrc content per site, in the exact forms install.sh has ever written.
#
# THE DECOY LINES ARE THE POINT. Each fixture carries user-owned lines that a careless
# substring pattern would take: they mention the same basename, the same tag word, even
# the same full sentence, but they are not what the installer wrote. The first repair of
# the discord delete used `discord-chat-launcher\.sh.*[Ii]mprov` and would have eaten the
# alias below; cross-model review caught it, and these decoys are what keeps it caught.
#
# $1 selects the tag spelling: "improv" (current) or "legacy" (the pre-rename
# claude-dotfiles form, still live on machines that never re-ran the installer).
zshrc_discord(){
  local home="$1" tag="Improv"
  [ "${2:-improv}" = legacy ] && tag="claude-dotfiles"
  cat <<EOF
export PATH="/usr/local/bin:\$PATH"
# a line the user cares about
alias gs='git status'
alias explain='echo discord-chat-launcher.sh came from Improv'
alias legacy='echo discord-chat-launcher.sh came from claude-dotfiles'

# Discord Chat Agent launcher (from $tag)
source $home/.claude/discord-chat-launcher.sh  # $tag: discord-chat-launcher
# trailing user line
export KEEP_ME=yes
EOF
}
zshrc_nvm(){
  cat <<'EOF'
export PATH="/usr/local/bin:$PATH"
source /opt/homebrew/opt/nvm/nvm.sh
# a line the user cares about
alias gs='git status'
echo "# Auto-activate nvm default so claude/node/npm are on PATH in new shells"
  nvm use default --silent 2>/dev/null

# Auto-activate nvm default so claude/node/npm are on PATH in new shells
nvm use default --silent 2>/dev/null
# trailing user line
export KEEP_ME=yes
EOF
}

# newcase <name> <site> [--symlink]
# Builds a sandbox HOME and echoes its path. With --symlink, ~/.zshrc is a symlink into
# a sibling directory - one of the most common dotfiles setups, and the one `sed -i`
# refuses outright with "in-place editing only works for regular files".
newcase(){
  local name="$1" site="$2" mode="${3:-}" tag="${4:-improv}" h="$TMPROOT/$1"
  mkdir -p "$h/.claude" "$h/dotfiles" || return 1
  local body
  if [ "$site" = discord ]; then body="$(zshrc_discord "$h" "$tag")"; else body="$(zshrc_nvm)"; fi
  if [ "$mode" = "--symlink" ]; then
    printf '%s\n' "$body" > "$h/dotfiles/zshrc"
    ln -s "$h/dotfiles/zshrc" "$h/.zshrc"
  else
    printf '%s\n' "$body" > "$h/.zshrc"
    chmod 600 "$h/.zshrc"
  fi
  printf '%s\n' "$USER_BAK_CONTENT" > "$h/.zshrc.bak"
  printf '%s\n' "$h"
}

# run_site <home> <discord|nvm> -> exit status of the deactivate under installer options
# install.sh runs under `set -euo pipefail`, so the deactivate is exercised with the same
# options. A `sed -i` that refuses a symlink aborts the installer there, not just the
# function, and that is the behavior worth asserting.
run_site(){
  local h="$1" site="$2"
  HOME="$h" ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$TMPROOT/repo" \
    bash -c "set -euo pipefail; source '$LIB'; deactivate_$site" >/dev/null 2>&1
}

# ============================================================
# Behavioral rows, per call site
# ============================================================
# gone_re <site> -> ERE matching ONLY the lines install.sh wrote. Deliberately anchored:
# a loose token like "discord-chat-launcher.sh" also appears in the decoy aliases, so a
# loose check would report the delete "worked" on a run that deleted the decoys instead.
gone_re(){
  if [ "$1" = discord ]; then
    printf '%s\n' '^(# Discord Chat Agent launcher \(from |source .*/discord-chat-launcher\.sh  # )'
  else
    printf '%s\n' '^(# Auto-activate nvm default|nvm use default --silent)'
  fi
}

# survivors <site> -> one fixed string per line; every one must still be in ~/.zshrc.
survivors(){
  printf '%s\n' "alias gs='git status'" 'export KEEP_ME=yes'
  if [ "$1" = discord ]; then
    printf '%s\n' \
      "alias explain='echo discord-chat-launcher.sh came from Improv'" \
      "alias legacy='echo discord-chat-launcher.sh came from claude-dotfiles'"
  else
    printf '%s\n' \
      'echo "# Auto-activate nvm default so claude/node/npm are on PATH in new shells"' \
      '  nvm use default --silent 2>/dev/null'
  fi
}

# assert_edit <home> <site> <label> - the installer's own lines are gone and every
# user-owned line, decoys included, is still there.
assert_edit(){
  local h="$1" site="$2" label="$3" line missing=""
  if grep -Eq "$(gone_re "$site")" "$h/.zshrc" 2>/dev/null; then
    bad "$label: installer's own lines removed" "the delete pattern matched nothing"
  else
    ok "$label: installer's own lines removed"
  fi
  while IFS= read -r line; do
    grep -Fqx "$line" "$h/.zshrc" 2>/dev/null || missing="$line"
  done <<EOF
$(survivors "$site")
EOF
  if [ -z "$missing" ]; then
    ok "$label: every user line survives (decoys included)"
  else
    bad "$label: every user line survives (decoys included)" "lost: $missing"
  fi
}

for site in discord nvm; do
  echo "-- deactivate_$site --"

  # ---- 1. the user's own ~/.zshrc.bak is not collateral ----
  # `sed -i.bak` writes its backup to "$ZSHRC.bak" - a path the installer does not own -
  # and the very next line rm's it. Anyone keeping a hand-made ~/.zshrc.bak loses it.
  h="$(newcase "${site}_bak" "$site")" || { echo "HARNESS: newcase failed" >&2; exit 2; }
  run_site "$h" "$site" || true
  if [ -f "$h/.zshrc.bak" ] && [ "$(cat "$h/.zshrc.bak")" = "$USER_BAK_CONTENT" ]; then
    ok "$site: user's ~/.zshrc.bak survives untouched"
  else
    bad "$site: user's ~/.zshrc.bak survives untouched" \
        "sed -i.bak clobbered a path the installer does not own"
  fi

  # ---- 2. the delete actually happened, and only it ----
  assert_edit "$h" "$site" "$site"

  # ---- 3. mode is preserved (a rewritten file must not widen permissions) ----
  if [ "$(perms_of "$h/.zshrc")" = "600" ]; then
    ok "$site: ~/.zshrc keeps mode 600"
  else
    bad "$site: ~/.zshrc keeps mode 600" "got $(perms_of "$h/.zshrc")"
  fi

  # ---- 4. symlinked ~/.zshrc ----
  h="$(newcase "${site}_link" "$site" --symlink)" || { echo "HARNESS: newcase failed" >&2; exit 2; }
  before_ino="$(inode_of "$h/dotfiles/zshrc")"
  if run_site "$h" "$site"; then
    ok "$site: symlinked ~/.zshrc - deactivate exits 0 under set -e"
  else
    bad "$site: symlinked ~/.zshrc - deactivate exits 0 under set -e" \
        "sed -i refuses a non-regular file and aborts the installer"
  fi
  assert_edit "$h" "$site" "$site: symlinked ~/.zshrc"
  if [ -L "$h/.zshrc" ]; then
    ok "$site: symlinked ~/.zshrc - still a symlink afterwards"
  else
    bad "$site: symlinked ~/.zshrc - still a symlink afterwards" "the link was replaced by a regular file"
  fi
  if [ "$(inode_of "$h/dotfiles/zshrc")" = "$before_ino" ]; then
    ok "$site: symlinked ~/.zshrc - target inode unchanged"
  else
    bad "$site: symlinked ~/.zshrc - target inode unchanged" "the target was replaced, not rewritten"
  fi
  if [ -e "$h/.zshrc.bak" ] && [ "$(cat "$h/.zshrc.bak")" = "$USER_BAK_CONTENT" ]; then
    ok "$site: symlinked ~/.zshrc - user's .bak survives"
  else
    bad "$site: symlinked ~/.zshrc - user's .bak survives" "collateral .bak write"
  fi
  if [ -e "$h/dotfiles/zshrc.bak" ]; then
    bad "$site: no .bak dropped beside the symlink target" "a sibling backup was created in the user's dotfiles dir"
  else
    ok "$site: no .bak dropped beside the symlink target"
  fi

  # ---- 5. the pre-rename tag spelling ----
  # Machines installed before the 2026-06 rename carry "claude-dotfiles:" in this line,
  # and migrate_legacy_markers does NOT rewrite it - that migration only fires on
  # "=== claude-dotfiles:" and "<!-- claude-dotfiles:", never on a bare "# " prefix. If
  # the delete only knows the current spelling, uninstall is a no-op on those machines
  # and detect_component reports the component active forever. nvm never had a second
  # spelling, so this row is discord-only.
  if [ "$site" = discord ]; then
    h="$(newcase "${site}_legacy" "$site" "" legacy)" || { echo "HARNESS: newcase failed" >&2; exit 2; }
    run_site "$h" "$site" || true
    assert_edit "$h" "$site" "$site: pre-rename claude-dotfiles form"
  fi

  # ---- 6. a FAILED edit must not half-deactivate ----
  # deactivate_discord removes the launcher scripts after editing ~/.zshrc. If the edit
  # fails, the `source` line survives - and removing the file it points at leaves every
  # new shell opening with "no such file or directory", which is strictly worse than
  # never having run the uninstall. Named by cross-model review. The failure is induced
  # honestly, by pointing TMPDIR at a directory that does not exist so the primitive's
  # mktemp fails, rather than by stubbing anything out.
  if [ "$site" = discord ]; then
    h="$(newcase "${site}_failedit" "$site")" || { echo "HARNESS: newcase failed" >&2; exit 2; }
    mkdir -p "$TMPROOT/repo/claude"
    printf '#!/usr/bin/env bash\n' > "$TMPROOT/repo/claude/discord-chat-launcher.sh"
    ln -sf "$TMPROOT/repo/claude/discord-chat-launcher.sh" "$h/.claude/discord-chat-launcher.sh"
    # THIS ROW USED TO ASSERT `return 0`, AND THAT WAS THE OLD MECHANISM, NOT THE PROPERTY.
    #
    # The property is "a component's undo must not abort the installer under set -e", and
    # returning 0 was only one way to get it. It cost more than it bought: rc=0 made
    # "I changed nothing" indistinguishable from "I removed the component", so the user was
    # told discord came out while the launcher still sourced in every new shell.
    #
    # install.sh now uses a LEDGER instead, and the property survives by a different route:
    # the site RECORDS the failure and the function returns non-zero, apply_pending calls it
    # as `if deactivate_component ...; then` - and bash disables errexit for the entire body
    # of a function whose status is being tested - so nothing aborts, the component is NOT
    # marked inactive, and the end of the run turns the recorded failure into a non-zero
    # exit. Two independent consumers, both needed: apply_pending only sees the return
    # value, and a plain `--only <x> --yes` never reaches apply_pending and only has the
    # end-of-run ledger check.
    #
    # So the row is now FOUR assertions, one per link in that chain, deliberately separate.
    # A single row that only checked the return value would go green again the day the
    # ledger stopped recording, which is the failure this file exists to refuse.
    #
    # WHAT THE DRIVER MIRRORS, stated precisely: the ERREXIT CONTEXT, not the full call stack.
    # Production is `if deactivate_component "$owner"; then` in browser-lib.sh, which
    # dispatches to deactivate_discord through a case arm. The test calls deactivate_discord
    # inside the same `if` shape, because bash disables errexit through the whole body of a
    # function whose status is being tested AND through the calls it makes - which is the
    # entire mechanism under test. It deliberately does NOT go through deactivate_component:
    # that wrapper also runs migrate_legacy_markers, which has nothing to do with this
    # contract and would drag an unrelated subject into the row.
    #
    # THE LEDGER QUESTION IS ANSWERED INSIDE THE DRIVER, not by parsing it out afterwards.
    # PARTIAL_FAILURES is newline-JOINED (one `  - <component>: <msg>` line per failure), so
    # a `LEDGER=%s` key/value line only ever tags the FIRST entry: an earlier unrelated
    # failure would push the discord record onto an untagged line and fail this row for the
    # wrong reason, and a first line that merely mentioned discord would pass it for the
    # wrong reason. The driver matches the RECORD SHAPE anchored to line start, so the
    # message text - which itself contains "discord-chat-launcher" - cannot satisfy it.
    fe_driver_rc=0
    fe_out="$(HOME="$h" ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$TMPROOT/repo" \
       TMPDIR="$TMPROOT/does-not-exist/" \
       bash -c "
         set -euo pipefail
         source '$LIB'
         printf 'DRIVER_STARTED=yes\n'
         if deactivate_discord; then
           printf 'RC=0\n'
           printf 'MARKED=inactive\n'   # apply_pending's success arm: state_set <owner> inactive
         else
           printf 'RC=%s\n' \"\$?\"
           printf 'MARKED=failed\n'     # apply_pending's failure arm: pending preserved, no state_set
         fi
         printf 'CALLER_CONTINUED=yes\n'
         if printf '%s\n' \"\$PARTIAL_FAILURES\" | grep -q '^  - discord: '; then
           printf 'LEDGER_HAS_DISCORD_RECORD=yes\n'
         else
           printf 'LEDGER_HAS_DISCORD_RECORD=no\n'
         fi
       " 2>/dev/null)" || fe_driver_rc=$?
    # NO `|| true` - that would let CALLER_CONTINUED and MARKED print, a later line die, and
    # three rows report a pass on a run that fell over. But a non-zero driver is TWO
    # different events and they belong in different places:
    #
    #   the driver never started            -> HARNESS failure. The extract would not source;
    #                                          nothing below is measuring the installer.
    #   started, then died before finishing -> a PRODUCT defect, and specifically the one the
    #                                          "does not abort the caller" row exists to
    #                                          catch. It must be reported as that row going
    #                                          RED, not as a harness abort - an installer
    #                                          that exits mid-undo is exactly the regression
    #                                          under test, and swallowing it into exit 2
    #                                          would make that row impossible to fail.
    #   finished, but exited non-zero       -> HARNESS failure: something broke AFTER the
    #                                          assertions were emitted.
    if ! printf '%s\n' "$fe_out" | grep -qx 'DRIVER_STARTED=yes'; then
      echo "HARNESS: the failed-edit driver never started (exit $fe_driver_rc) - the extract did not source" >&2
      exit 2
    fi
    if [ "$fe_driver_rc" != 0 ] && printf '%s\n' "$fe_out" | grep -qx 'CALLER_CONTINUED=yes'; then
      echo "HARNESS: the failed-edit driver exited $fe_driver_rc AFTER completing its assertions" >&2
      exit 2
    fi

    fe_rc="$(printf '%s\n' "$fe_out" | sed -n 's/^RC=//p')"
    if [ -n "$fe_rc" ] && [ "$fe_rc" != 0 ]; then
      ok "$site: a failed edit returns NON-ZERO (rc=$fe_rc)"
    else
      bad "$site: a failed edit returns NON-ZERO (rc=${fe_rc:-<none>})" \
          "rc=0 reports a component as removed while its lines are still in the user's shell config"
    fi

    if printf '%s\n' "$fe_out" | grep -qx 'CALLER_CONTINUED=yes'; then
      ok "$site: a failed edit does not abort the caller (set -e safety preserved)"
    else
      bad "$site: a failed edit does not abort the caller (set -e safety preserved)" \
          "the installer died mid-undo - this is the property the old \`return 0\` was protecting"
    fi

    if printf '%s\n' "$fe_out" | grep -qx 'LEDGER_HAS_DISCORD_RECORD=yes'; then
      ok "$site: a failed edit is RECORDED in the partial-failure ledger"
    else
      bad "$site: a failed edit is RECORDED in the partial-failure ledger" \
          "no '  - discord: ' record, so a plain --only run (which never reaches apply_pending) would still exit 0"
    fi

    if printf '%s\n' "$fe_out" | grep -qx 'MARKED=failed'; then
      ok "$site: a failed edit leaves the component FAILED, not marked inactive"
    else
      bad "$site: a failed edit leaves the component FAILED, not marked inactive" \
          "apply_pending would take its success arm and record a component inactive that never came out"
    fi
    if grep -Eq "$(gone_re "$site")" "$h/.zshrc"; then
      ok "$site: failed edit leaves the source line in place"
    else
      bad "$site: failed edit leaves the source line in place" "the edit reported failure but happened"
    fi
    if [ -L "$h/.claude/discord-chat-launcher.sh" ]; then
      ok "$site: failed edit leaves the script the surviving line sources"
    else
      bad "$site: failed edit leaves the script the surviving line sources" \
          "new shells would error on a missing file"
    fi
  fi

  # ---- 7. absent ~/.zshrc is a clean no-op ----
  h="$TMPROOT/${site}_none"; mkdir -p "$h/.claude"
  if run_site "$h" "$site"; then
    ok "$site: missing ~/.zshrc is a no-op"
  else
    bad "$site: missing ~/.zshrc is a no-op" "the function errored with nothing to do"
  fi
  if [ -e "$h/.zshrc" ]; then
    bad "$site: missing ~/.zshrc is not created" "an empty shell config was conjured"
  else
    ok "$site: missing ~/.zshrc is not created"
  fi
done

# ============================================================
# The primitive's own argument guard
# ============================================================
# A RANGE-mode caller that passes anything option-shaped is a caller bug, and the
# dangerous reading is that the argument after it gets executed as a sed script against
# the user's config. The guard refuses instead, and it must refuse BEFORE the file is
# read. Flagged by cross-model review as a latent footgun, closed here.
#
# NOTE ON WHAT THIS ROW PROVES. install.sh has TWO guards that catch this input - the
# option loop's `-*` arm and the positional marker check - and they are redundant for a
# leading-dash marker, so this row cannot tell you which one fired. The row in
# test-userfile-safe-edit.sh that isolates the option-loop arm is the one that
# distinguishes them; this one is the end-to-end statement of the property.
echo "-- zshrc_block_delete argument guard --"
h="$TMPROOT/guard"; mkdir -p "$h"
printf 'export KEEP_ME=yes\n# === improv:x:begin ===\njunk\n# === improv:x:end ===\n' > "$h/.zshrc"
if ZSHRC="$h/.zshrc" bash -c "set -euo pipefail; source '$LIB'; zshrc_block_delete '--wat' '/^export KEEP_ME=/d'" 2>/dev/null; then
  bad "option-shaped begin marker is refused" "it was accepted and the end marker may have run as sed"
else
  ok "option-shaped begin marker is refused"
fi
if grep -Fqx 'export KEEP_ME=yes' "$h/.zshrc"; then
  ok "option-shaped begin marker leaves ~/.zshrc untouched"
else
  bad "option-shaped begin marker leaves ~/.zshrc untouched" "the end marker executed as a sed script"
fi
# The real markers still work, so the guard did not become a blanket refusal.
if ZSHRC="$h/.zshrc" bash -c "set -euo pipefail; source '$LIB'; zshrc_block_delete '# === improv:x:begin ===' '# === improv:x:end ==='" 2>/dev/null \
   && ! grep -Fq 'junk' "$h/.zshrc"; then
  ok "a real marker pair still deletes"
else
  bad "a real marker pair still deletes" "the argument guard is over-broad"
fi

# ============================================================
# The write-back failure path
# ============================================================
# `cat "$out" > "$ZSHRC"` truncates before it writes, so a failure mid-write would leave
# the user with a truncated shell config and nothing to recover from. Atomicity via a
# sibling temp + mv is not available here - it would replace a symlinked ~/.zshrc with a
# regular file, the exact property the snapshot shape exists to preserve. The primitive
# instead restores from the snapshot, and if THAT fails, keeps the snapshot and prints
# its path. Named by cross-model review; this row is what makes the fold real.
#
# The failure is induced honestly with a read-only target, which fails at open() - so
# nothing is truncated, the restore fails for the same reason, and the last-resort branch
# is the one under test. Skipped when running as root, which ignores the mode bits.
echo "-- write-back failure keeps the user's config recoverable --"
if [ "$(id -u)" = "0" ]; then
  echo "SKIP write-back failure rows (running as root - mode bits do not apply)"
else
  h="$TMPROOT/wfail"; mkdir -p "$h"
  printf '# === improv:x:begin ===\njunk\n# === improv:x:end ===\nexport IRREPLACEABLE=1\n' > "$h/.zshrc"
  orig="$(cat "$h/.zshrc")"
  chmod 444 "$h/.zshrc"
  msg="$(ZSHRC="$h/.zshrc" bash -c "source '$LIB'; zshrc_block_delete '# === improv:x:begin ===' '# === improv:x:end ==='" 2>&1)" \
    && bad "unwritable ~/.zshrc returns non-zero" "it reported success" \
    || ok "unwritable ~/.zshrc returns non-zero"
  chmod 644 "$h/.zshrc"
  if [ "$(cat "$h/.zshrc")" = "$orig" ]; then
    ok "unwritable ~/.zshrc is left exactly as it was"
  else
    bad "unwritable ~/.zshrc is left exactly as it was" "the file was damaged"
  fi
  # The message must name a REAL path holding the user's original bytes, not just say
  # that something went wrong. A recovery hint that does not resolve is not a recovery.
  kept="$(printf '%s\n' "$msg" | sed -n 's/.*are at \([^ ]*\) -.*/\1/p' | head -1)"
  if [ -n "$kept" ] && [ -f "$kept" ] && [ "$(cat "$kept")" = "$orig" ]; then
    ok "failure names a snapshot that really holds the original"
  else
    bad "failure names a snapshot that really holds the original" \
        "no usable path in: $msg"
  fi
  [ -n "$kept" ] && rm -f "$kept"
fi

echo ""
echo "zshrc-safe-edit: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
echo "PASS: every ~/.zshrc edit goes through the safe shape"
