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
  # install.sh's real logger, which the failure paths call.
  printf 'warn() { printf "warn: %%s\\n" "$1" >&2; }\n'
} > "$LIB"

bash -n "$LIB" 2>/dev/null && ok "extract parses" || bad "extract parses" "awk ranges are mismatched"

for fn in zshrc_block_delete safe_block_delete safe_sed_apply deactivate_discord deactivate_nvm; do
  if bash -c "source '$LIB'; declare -f $fn >/dev/null" 2>/dev/null; then
    ok "extract carries $fn"
  else
    bad "extract carries $fn" "add it to the awk extraction above"
  fi
done

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
n_sedi="$(awk '
  { line = $0 }
  # join continuations into one logical statement before deciding anything
  { while (line ~ /\\$/ && (getline nxt) > 0) { sub(/\\$/, "", line); line = line nxt } }
  line ~ /^[[:space:]]*#/ { next }
  line ~ /sed[[:space:]]+-i/ && line ~ /\$\{?ZSHRC\}?/ { n++ }
  END { print n+0 }
' "$INSTALLER")"
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
    if HOME="$h" ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$TMPROOT/repo" \
       TMPDIR="$TMPROOT/does-not-exist/" \
       bash -c "set -euo pipefail; source '$LIB'; deactivate_discord" >/dev/null 2>&1; then
      ok "$site: failed edit still returns 0 (a case arm under set -e must not abort)"
    else
      bad "$site: failed edit still returns 0 (a case arm under set -e must not abort)" \
          "the installer would die mid-uninstall"
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
