#!/usr/bin/env bash
# ============================================================
# test-ampersand-shim.sh - the `ampersand` self-heal contract
# ============================================================
# Covers two halves of one promise: whatever .zshrc block a machine is carrying,
# (1) install.sh rebuilds it into the current shim, and (2) the shim can actually
# reach the installer afterwards - including when the baked path is wrong, the
# executable bit is gone, or `git pull` fails.
#
# EVERY behavioural case runs against a SANDBOX HOME and a throwaway repo built in
# a temp dir. Nothing here reads or writes the real ~/.zshrc. install.sh is happy
# to run `--only ampersand --yes` from a directory containing nothing but itself,
# which is what keeps this suite fast and keeps its backups out of the real repo.
#
# NEGATIVE CONTROL (the point of the suite): run it as
#     bash test-ampersand-shim.sh --negative-control
# and it re-runs the self-heal cases against install.sh AS OF HEAD with no
# bin/ampersand present, asserting that they FAIL there. A test that cannot fail
# proves nothing; this is the proof that these assertions are load-bearing.
#
# Overrides (used by the negative control, useful for bisecting):
#   IMPROV_TEST_INSTALLER   path to the install.sh under test
#   IMPROV_TEST_BIN         path to bin/ampersand ("" = deliberately absent)
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER="${IMPROV_TEST_INSTALLER:-$REPO_ROOT/install.sh}"
BIN_AMPERSAND="${IMPROV_TEST_BIN-$REPO_ROOT/bin/ampersand}"

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/ampersand-shim.XXXXXX")"
# Normalise: macOS $TMPDIR ends in a slash, so the template yields a path with a
# doubled separator. install.sh derives REPO_DIR through `cd ... && pwd`, which
# collapses it - so an un-normalised expectation here fails on a cosmetic
# difference and looks like a real defect.
TMPROOT="$(cd "$TMPROOT" && pwd)"
trap 'rm -rf "$TMPROOT"' EXIT

PASS=0
FAIL=0
ok()   { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; return 0; }

assert_has()    { if grep -Fq -- "$2" "$1" 2>/dev/null; then ok "$3"; else bad "$3" "expected to find: $2"; fi; }
assert_lacks()  { if grep -Fq -- "$2" "$1" 2>/dev/null; then bad "$3" "should be gone but is present: $2"; else ok "$3"; fi; }
assert_count()  { local n; n="$(grep -Fc -- "$2" "$1" 2>/dev/null || true)"; [ "$n" = "$3" ] && ok "$4" || bad "$4" "expected $3 occurrences of '$2', got ${n:-0}"; }
assert_eq()     { [ "$1" = "$2" ] && ok "$3" || bad "$3" "expected '$2', got '$1'"; }
assert_in()     { case "$1" in *"$2"*) ok "$3" ;; *) bad "$3" "expected output to contain: $2" ;; esac; }

# ------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------

# A repo that install.sh is happy to run --only ampersand from. Optionally carries
# bin/ampersand and/or a real git checkout with a remote.
mkrepo() { # <dir> [--with-bin] [--git]
  local dir="$1"; shift
  mkdir -p "$dir"
  cp "$INSTALLER" "$dir/install.sh"
  chmod +x "$dir/install.sh"
  # The shim identifies a checkout by install.sh AND bootstrap.sh together, so a
  # fixture repo has to carry both or the search step will correctly reject it.
  printf '#!/usr/bin/env bash\n# fixture stand-in for bootstrap.sh\n' > "$dir/bootstrap.sh"
  while [ $# -gt 0 ]; do
    case "$1" in
      --with-bin)
        if [ -n "$BIN_AMPERSAND" ] && [ -f "$BIN_AMPERSAND" ]; then
          mkdir -p "$dir/bin"; cp "$BIN_AMPERSAND" "$dir/bin/ampersand"
        fi ;;
      --git)
        git -C "$dir" init -q 2>/dev/null
        git -C "$dir" add -A >/dev/null 2>&1
        git -C "$dir" -c user.email=t@t -c user.name=t commit -qm init >/dev/null 2>&1 ;;
    esac
    shift
  done
}

# Every historical .zshrc block shape, reproduced verbatim from git history.
# See .claude/memory/session_2026-07-27_ampersand-selfheal.md for the provenance
# of each one (commit, date, and what breaks about it).
seed() { # <zshrc> <form> <baked_path>
  local rc="$1" form="$2" p="$3"
  case "$form" in
    A_vanity)  # 971900e0 / 13748a45 - yesplease only, NO ampersand at all
      cat >> "$rc" <<EOF
# claude-dotfiles vanity command: pull latest and re-launch installer
function yesplease() {
  ( cd "$p" && git pull --ff-only && ./install.sh "\$@" )
}
EOF
      ;;
    A_unclosed)  # the same block after a hand-edit that lost its standalone `}`.
      # NOT a historical form - a damaged one. `sed '/marker/,/^}$/d'` has no range
      # end here, so it deletes THROUGH END OF FILE and the .bak is removed a line
      # later. This fixture exists to prove the installer refuses instead.
      cat >> "$rc" <<EOF
# claude-dotfiles vanity command: pull latest and re-launch installer
function yesplease() {
  ( cd "$p" && git pull --ff-only && ./install.sh "\$@" ) }
EOF
      ;;
    C_dual)    # 73cd339a - claude-dotfiles marker, yesplease + ampersand
      cat >> "$rc" <<EOF
# === claude-dotfiles:shortcuts:begin ===
function yesplease() {
  ( cd "$p" && git pull --ff-only && ./install.sh "\$@" )
}
function ampersand() {
  ( cd "$p" && ./install.sh "\$@" )
}
# === claude-dotfiles:shortcuts:end ===
EOF
      ;;
    D_alias)   # d4b3eda5 / 097fabd1 - ampersand --pull plus a yesplease alias
      cat >> "$rc" <<EOF
# === claude-dotfiles:shortcuts:begin ===
function ampersand() {
  local pull=0
  local args=()
  for arg in "\$@"; do
    case "\$arg" in
      --pull) pull=1 ;;
      *) args+=("\$arg") ;;
    esac
  done
  if [[ "\$pull" == "1" ]]; then
    ( cd "$p" && git pull --ff-only && ./install.sh "\${args[@]}" )
  else
    ( cd "$p" && ./install.sh "\${args[@]}" )
  fi
}
alias yesplease='ampersand --pull'
# === claude-dotfiles:shortcuts:end ===
EOF
      ;;
    E_improv)  # c2776619 - improv marker, still bare ./install.sh (no exec-bit safety)
      cat >> "$rc" <<EOF
# === improv:shortcuts:begin ===
# 'ampersand' re-launches the installer. 'ampersand --pull' pulls latest first.
function ampersand() {
  local pull=0
  local args=()
  for arg in "\$@"; do
    case "\$arg" in
      --pull) pull=1 ;;
      *) args+=("\$arg") ;;
    esac
  done
  if [[ "\$pull" == "1" ]]; then
    ( cd "$p" && git pull --ff-only && ./install.sh "\${args[@]}" )
  else
    ( cd "$p" && ./install.sh "\${args[@]}" )
  fi
}
# === improv:shortcuts:end ===
EOF
      ;;
    G_prebin)  # 774df3db - the newest PRE-SHIM block: /bin/bash, rc capture, baked path
      cat >> "$rc" <<EOF
# === improv:shortcuts:begin ===
# 'ampersand' re-launches the installer. 'ampersand --pull' pulls latest first.
function ampersand() {
  local pull=0
  local rc=0
  local args=()
  for arg in "\$@"; do
    case "\$arg" in
      --pull) pull=1 ;;
      *) args+=("\$arg") ;;
    esac
  done
  if [[ "\$pull" == "1" ]]; then
    ( cd "$p" && git pull --ff-only && /bin/bash ./install.sh "\${args[@]}" )
    rc=\$?
  else
    ( cd "$p" && /bin/bash ./install.sh "\${args[@]}" )
    rc=\$?
  fi
  return "\$rc"
}
# === improv:shortcuts:end ===
EOF
      ;;
    USER_OWN)  # not ours - must never be touched
      cat >> "$rc" <<'EOF'
function ampersand() {
  echo "my own thing"
}
EOF
      ;;
    USER_OWN_POSIX)  # not ours, POSIX form - the shape the guard used to miss entirely
      cat >> "$rc" <<'EOF'
ampersand() {
  echo "my own posix thing"
}
EOF
      ;;
    A_vanity_commented)  # vanity block whose closing brace carries a trailing comment
      cat >> "$rc" <<EOF
# claude-dotfiles vanity command: pull latest and re-launch installer
function yesplease() {
  ( cd "$p" && git pull --ff-only && ./install.sh "\$@" )
} # end yesplease
EOF
      ;;
  esac
}

run_install() { # <home> <repo> [extra args...]
  local home="$1" repo="$2"; shift 2
  HOME="$home" bash "$repo/install.sh" --only ampersand --yes "$@" >"$home/install.out" 2>&1
}

# Run `ampersand ...` through zsh against a seeded .zshrc, echo combined output.
# --dry-run is the probe: it is the installer's own documented no-op, so reaching
# it proves the launcher worked without letting the installer write anything.
run_ampersand() { # <home> [args...]
  local home="$1"; shift
  HOME="$home" zsh -c "source '$home/.zshrc' >/dev/null 2>&1; ampersand $* --dry-run --only ampersand" 2>&1
}
reached() { case "$1" in *"no files were touched"*) return 0 ;; *) return 1 ;; esac; }

newcase() { # <name> -> echoes a fresh sandbox HOME
  local h="$TMPROOT/$1"; mkdir -p "$h"; : > "$h/.zshrc"; printf '%s' "$h"
}

# ============================================================
# PART 1 - migration: every historical block converges on the shim
# ============================================================
part1() {
  echo "-- migration from every historical block form --"
  local form h repo
  for form in A_vanity C_dual D_alias E_improv G_prebin; do
    h="$(newcase "mig_$form")"
    repo="$TMPROOT/repo_$form"; mkrepo "$repo" --with-bin
    seed "$h/.zshrc" "$form" "/nonexistent/old/path/improv"
    run_install "$h" "$repo"
    assert_has   "$h/.zshrc" "# improv-shim v1"                    "$form -> rebuilt to the current shim"
    assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 1  "$form -> exactly one shortcut block"
    assert_lacks "$h/.zshrc" "claude-dotfiles:shortcuts"           "$form -> legacy claude-dotfiles marker gone"
    assert_lacks "$h/.zshrc" "function yesplease"                  "$form -> orphan yesplease function gone"
    assert_lacks "$h/.zshrc" "alias yesplease="                    "$form -> deprecated yesplease alias gone"
    assert_lacks "$h/.zshrc" "vanity command"                      "$form -> pre-marker vanity comment gone"
    assert_has   "$h/.zshrc" "IMPROV_SHIM_HINT=\"$repo\""          "$form -> hint points at this checkout"
  done

  # The mixed state the dead LEGACY_VANITY_MARKER branch produced in the wild: a
  # machine that fell through to the plain append still carrying its April yesplease.
  h="$(newcase mig_mixed)"; repo="$TMPROOT/repo_mixed"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" A_vanity "/nonexistent/old/path/improv"
  seed "$h/.zshrc" G_prebin "/nonexistent/old/path/improv"
  run_install "$h" "$repo"
  assert_has   "$h/.zshrc" "# improv-shim v1"                      "mixed vanity+block -> shim written"
  assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 1    "mixed vanity+block -> exactly one block"
  assert_lacks "$h/.zshrc" "function yesplease"                    "mixed vanity+block -> orphan yesplease swept"

  # DATA LOSS. `sed '/begin/,/end/d'` deletes THROUGH END OF FILE when the end never
  # matches (confirmed on BSD sed), and every one of these sites removes its .bak on
  # the next line. A hand-edited .zshrc missing a closing brace or a closing marker
  # must therefore be REFUSED, not guessed at. The canary line is what proves it: if
  # the range ran away, the user's own config below the block is gone.
  local canary='export CANARY_MUST_SURVIVE=1'
  h="$(newcase mig_unclosed_brace)"; repo="$TMPROOT/repo_unclosed_brace"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" A_unclosed "/nonexistent/old/path/improv"
  printf '%s\n' "$canary" >> "$h/.zshrc"
  run_install "$h" "$repo"
  assert_has "$h/.zshrc" "$canary"            "vanity block with no standalone '}' -> user config below survives"
  assert_has "$h/.zshrc" "function yesplease" "vanity block with no standalone '}' -> refused, not guessed at"
  assert_in  "$(cat "$h/install.out")" "no closing '}'" "vanity block with no standalone '}' -> the refusal is explained"

  h="$(newcase mig_unclosed_marker)"; repo="$TMPROOT/repo_unclosed_marker"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" G_prebin "/nonexistent/old/path/improv"
  # Strip the END marker, the way a hand-edit would.
  grep -v "^# === improv:shortcuts:end ===$" "$h/.zshrc" > "$h/.zshrc.tmp" && mv "$h/.zshrc.tmp" "$h/.zshrc"
  printf '%s\n' "$canary" >> "$h/.zshrc"
  run_install "$h" "$repo"
  assert_has "$h/.zshrc" "$canary"                      "block with no end marker -> user config below survives"
  assert_in  "$(cat "$h/install.out")" "no closing marker" "block with no end marker -> the refusal is explained"

  # A user's own ampersand, carrying none of our markers, is left strictly alone.
  h="$(newcase mig_userown)"; repo="$TMPROOT/repo_userown"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" USER_OWN ""
  run_install "$h" "$repo"
  assert_lacks "$h/.zshrc" "# improv-shim v1"                      "user-defined ampersand -> no shim appended"
  assert_has   "$h/.zshrc" "my own thing"                          "user-defined ampersand -> left intact"

  # Idempotency, and the repo-moved refresh.
  h="$(newcase mig_idem)"; repo="$TMPROOT/repo_idem"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"; run_install "$h" "$repo"
  assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 1    "re-run -> still exactly one block"
  assert_in    "$(cat "$h/install.out")" "already defined"         "re-run -> reported as already defined"

  local repo2="$TMPROOT/repo_moved"; mkrepo "$repo2" --with-bin
  run_install "$h" "$repo2"
  assert_has   "$h/.zshrc" "IMPROV_SHIM_HINT=\"$repo2\""           "repo moved -> hint refreshed to the new path"
  assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 1    "repo moved -> still exactly one block"
}

# ============================================================
# PART 2 - the shim can actually reach the installer
# ============================================================
part2() {
  echo "-- launcher behaviour under the conditions that used to kill it --"
  local h repo out

  # Baseline.
  h="$(newcase run_ok)"; repo="$TMPROOT/repo_run_ok"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  out="$(run_ampersand "$h")"
  reached "$out" && ok "healthy checkout -> installer reached" || bad "healthy checkout -> installer reached" "$out"

  # The baked hint is gone, but a clone exists at a standard location. The old
  # block died at `cd` here; the shim has to search.
  h="$(newcase run_moved)"; repo="$TMPROOT/repo_run_moved"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  mkdir -p "$h/Documents/Github"; cp -R "$repo" "$h/Documents/Github/improv"; rm -rf "$repo"
  out="$(run_ampersand "$h")"
  reached "$out" && ok "hint path deleted, clone at \$HOME/Documents/Github/improv -> found" \
                 || bad "hint path deleted, clone at \$HOME/Documents/Github/improv -> found" "$out"

  # IMPROV_DIR wins over everything, same override bootstrap.sh honours.
  h="$(newcase run_envdir)"; repo="$TMPROOT/repo_run_envdir"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  local elsewhere="$TMPROOT/elsewhere/improv"; mkrepo "$elsewhere" --with-bin
  out="$(HOME="$h" IMPROV_DIR="$elsewhere" zsh -c "source '$h/.zshrc' >/dev/null 2>&1; ampersand --dry-run --only ampersand" 2>&1)"
  reached "$out" && ok "IMPROV_DIR override -> installer reached" || bad "IMPROV_DIR override -> installer reached" "$out"

  # The executable bit did not survive the trip to this machine.
  h="$(newcase run_noexec)"; repo="$TMPROOT/repo_run_noexec"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  chmod -x "$repo/install.sh"
  out="$(run_ampersand "$h")"
  reached "$out" && ok "install.sh not executable -> installer still reached" \
                 || bad "install.sh not executable -> installer still reached" "$out"

  # --pull against a repo that cannot pull. The whole command used to evaporate.
  h="$(newcase run_badpull)"; repo="$TMPROOT/repo_run_badpull"; mkrepo "$repo" --with-bin --git
  run_install "$h" "$repo"
  git -C "$repo" remote add origin "https://example.invalid/nope.git" >/dev/null 2>&1
  out="$(run_ampersand "$h" --pull)"
  reached "$out" && ok "--pull with an unreachable remote -> installer still reached" \
                 || bad "--pull with an unreachable remote -> installer still reached" "$out"
  assert_in "$out" "continuing with the checkout you already have" "--pull failure is reported, not swallowed"

  # --pull in a directory that is not a git checkout at all.
  h="$(newcase run_nogit)"; repo="$TMPROOT/repo_run_nogit"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  out="$(run_ampersand "$h" --pull)"
  reached "$out" && ok "--pull in a non-git checkout -> installer still reached" \
                 || bad "--pull in a non-git checkout -> installer still reached" "$out"

  # Arbitrary flags survive the hop through the shim and bin/ampersand.
  h="$(newcase run_flags)"; repo="$TMPROOT/repo_run_flags"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  out="$(HOME="$h" zsh -c "source '$h/.zshrc' >/dev/null 2>&1; ampersand --preset minimal --dry-run" 2>&1)"
  reached "$out" && ok "forwarded flags (--preset minimal) -> installer reached" \
                 || bad "forwarded flags (--preset minimal) -> installer reached" "$out"

  # An older checkout that has no bin/ampersand yet must still launch, or `--pull`
  # could never fetch the revision that HAS it.
  h="$(newcase run_nobin)"; repo="$TMPROOT/repo_run_nobin"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  rm -rf "$repo/bin"
  out="$(run_ampersand "$h")"
  reached "$out" && ok "checkout without bin/ampersand -> shim falls back to install.sh" \
                 || bad "checkout without bin/ampersand -> shim falls back to install.sh" "$out"

  # The search scans well-known paths under $HOME, so it must not exec a STRANGER's
  # install.sh that happens to sit at one of them. The shim requires install.sh AND
  # bootstrap.sh together; this proves that identity check is load-bearing.
  h="$(newcase run_decoy)"; repo="$TMPROOT/repo_run_decoy"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  mkdir -p "$h/improv"
  printf '#!/bin/bash\necho STRANGER_INSTALLER_RAN\n' > "$h/improv/install.sh"
  chmod +x "$h/improv/install.sh"
  rm -rf "$repo"   # hint path gone, so the search runs and the decoy is the only candidate
  out="$(run_ampersand "$h")"
  case "$out" in
    *STRANGER_INSTALLER_RAN*) bad "decoy install.sh under \$HOME is NOT executed" "the shim ran a foreign installer" ;;
    *"cannot find the improv repo"*) ok "decoy install.sh under \$HOME is NOT executed" ;;
    *) bad "decoy install.sh under \$HOME is NOT executed" "unexpected: $out" ;;
  esac

  # No repo anywhere: fail LOUDLY and actionably, never silently.
  h="$(newcase run_norepo)"; repo="$TMPROOT/repo_run_norepo"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"; rm -rf "$repo"
  out="$(run_ampersand "$h")"; local rc=$?
  assert_in "$out" "cannot find the improv repo"  "no repo anywhere -> says so plainly"
  assert_in "$out" "IMPROV_DIR="                  "no repo anywhere -> names the env override"
  assert_in "$out" "bootstrap.sh"                 "no repo anywhere -> names the re-install command"
  [ "$rc" -ne 0 ] && ok "no repo anywhere -> non-zero exit" || bad "no repo anywhere -> non-zero exit" "rc=$rc"
}

# ============================================================
# PART 3 - detector and deactivation agree with the writer
# ============================================================
# install.sh's real function text is EXTRACTED, not paraphrased: the lib-only seam
# (IMPROV_INSTALL_LIB_ONLY=1) returns at line ~329, long before these are defined,
# so sourcing cannot reach them. Same technique as the 2026-07-23 hook-packaging
# verification. Paraphrasing here would test the test, not the installer.
part3() {
  echo "-- detect_component / deactivate_ampersand agree with the block writer --"
  local lib="$TMPROOT/extracted.sh"
  {
    awk '/^SHORTCUT_BEGIN=/,/^SHIM_MARKER=/' "$INSTALLER"
    # deactivate_ampersand delegates every delete to this shared helper, so the extract
    # is incomplete without it. Leaving it out does NOT fail loudly: the `zshrc_block_delete
    # || warn` idiom turns "command not found" into the refuse-to-delete branch, so the
    # suite goes red with "block still present" and points at the installer instead of at
    # its own harness. Cost an investigation once; hence the declare -f assertion below.
    awk '/^zshrc_block_delete\(\) \{/,/^\}/' "$INSTALLER"
    # detect_component's ampersand arm calls this, and it is GLOBAL now - it used to be
    # a local function inside section 11, which is exactly how the detector and the
    # rebuild chain ended up with two different definitions of "current". Omitting it
    # degrades the same silent way zshrc_block_delete does, so it gets the same
    # declare -f assertion below.
    awk '/^is_current_format\(\) \{/,/^\}/' "$INSTALLER"
    awk '/^detect_component\(\) \{/,/^\}/' "$INSTALLER"
    awk '/^deactivate_ampersand\(\) \{/,/^\}/' "$INSTALLER"
    # install.sh's real logger, which the helper's failure path calls.
    printf 'warn() { printf "warn: %%s\\n" "$1" >&2; }\n'
  } > "$lib"

  # The extract must be COMPLETE. Asserted directly, because an incomplete one degrades
  # into a plausible-looking installer failure rather than a harness error.
  if bash -c "source '$lib'; declare -f zshrc_block_delete >/dev/null"; then
    ok "extract carries zshrc_block_delete (deactivate_ampersand depends on it)"
  else
    bad "extract carries zshrc_block_delete (deactivate_ampersand depends on it)" \
        "add it to the awk extraction above"
  fi
  if bash -c "source '$lib'; declare -f is_current_format >/dev/null"; then
    ok "extract carries is_current_format (detect_component depends on it)"
  else
    bad "extract carries is_current_format (detect_component depends on it)" \
        "add it to the awk extraction above"
  fi

  local h repo state
  h="$(newcase det_shim)"; repo="$TMPROOT/repo_det"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"
  state="$(ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$repo" bash -c "source '$lib'; detect_component ampersand")"
  assert_eq "$state" "active" "detect_component: current shim -> active"

  h="$(newcase det_stale)"
  seed "$h/.zshrc" G_prebin "/nonexistent/old/path/improv"
  state="$(ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$repo" bash -c "source '$lib'; detect_component ampersand")"
  assert_eq "$state" "not-installed" "detect_component: stale pre-shim block -> not-installed (so the browser offers the repair)"

  # Deactivation has to remove every shape the writer has ever produced, or
  # "uninstall ampersand" leaves a live launcher behind.
  local form
  for form in A_vanity C_dual D_alias E_improv G_prebin; do
    h="$(newcase "deact_$form")"
    seed "$h/.zshrc" "$form" "/nonexistent/old/path/improv"
    printf 'export BYSTANDER=1\n' >> "$h/.zshrc"
    ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$repo" bash -c "source '$lib'; deactivate_ampersand"
    assert_lacks "$h/.zshrc" "function ampersand"  "deactivate: $form -> ampersand function gone"
    assert_lacks "$h/.zshrc" "function yesplease"  "deactivate: $form -> yesplease function gone"
    assert_has   "$h/.zshrc" "BYSTANDER"           "deactivate: $form -> unrelated lines survive"
  done
}

# ============================================================
# PART 5 - the four cross-model review findings, folded
# ============================================================
# Each case here reproduces a defect that shipped in 14145511 and was caught by Codex
# afterwards. All four end in the SAME user-visible failure the shim exists to prevent
# (a .zshrc that looks fine and launches nothing) or in destroyed user config, so each
# is asserted directly rather than through the migration matrix above.
part5() {
  echo "-- folded review findings (symlinked zshrc, commented brace, POSIX fn, drifted detector) --"
  local h repo lib state canary='export CANARY_MUST_SURVIVE=1'

  # --- 1. sed -i cannot edit a non-regular file -----------------------------------
  # A symlinked ~/.zshrc is an ordinary dotfiles setup, and BSD sed refuses it outright:
  # "in-place editing only works for regular files". zshrc_block_delete used to return 0
  # anyway, so the caller appended a second block and reported success - leaving TWO
  # definitions, with zsh running the stale one that comes last.
  h="$(newcase sym_dup)"; repo="$TMPROOT/repo_sym_dup"; mkrepo "$repo" --with-bin
  mkdir -p "$h/dotfiles"; : > "$h/dotfiles/zshrc"
  seed "$h/dotfiles/zshrc" G_prebin "/nonexistent/old/path/improv"
  printf '%s\n' "$canary" >> "$h/dotfiles/zshrc"
  rm -f "$h/.zshrc"; ln -s "$h/dotfiles/zshrc" "$h/.zshrc"
  run_install "$h" "$repo"
  assert_count "$h/dotfiles/zshrc" "# === improv:shortcuts:begin ===" 1 \
    "symlinked .zshrc -> never ends up with two blocks"
  assert_has "$h/dotfiles/zshrc" "$canary" "symlinked .zshrc -> user config survives"
  [ -L "$h/.zshrc" ] && ok "symlinked .zshrc -> still a symlink afterwards" \
                     || bad "symlinked .zshrc -> still a symlink afterwards" "the link was replaced by a regular file"
  # Failing SAFELY is not the bar. A symlinked ~/.zshrc is one of the most common
  # dotfiles setups, so refusing to ever repair those machines just relocates the bug.
  assert_has "$h/dotfiles/zshrc" "# improv-shim v1" \
    "symlinked .zshrc -> the stale block is actually REPAIRED, not just left alone"
  assert_lacks "$h/dotfiles/zshrc" "/nonexistent/old/path/improv" \
    "symlinked .zshrc -> stale baked path is gone"

  # The installer must not touch a .bak the USER owns. `sed -i.bak` wrote and then
  # deleted "$ZSHRC.bak" - a path this code does not own - so anyone keeping a hand-made
  # ~/.zshrc.bak had it silently destroyed by an install, and a failed edit could
  # "restore" from that unrelated file. The primitive now works from its own snapshot
  # in $TMPDIR and writes back through the path, creating no sibling backup at all.
  h="$(newcase user_bak)"; repo="$TMPROOT/repo_user_bak"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" G_prebin "/nonexistent/old/path/improv"
  printf 'PRECIOUS USER BACKUP\n' > "$h/.zshrc.bak"
  run_install "$h" "$repo"
  assert_has "$h/.zshrc.bak" "PRECIOUS USER BACKUP" \
    "a user's own ~/.zshrc.bak is never touched"
  assert_has "$h/.zshrc" "# improv-shim v1" \
    "...and the block was still rebuilt while leaving it alone"

  # --- 2. an AMBIGUOUS closing brace is refused, never guessed at ------------------
  # A regex end-mode was added on 2026-07-27 so `} # end yesplease` would close the
  # vanity block, on the reasoning that a looser end match "can only close earlier, so
  # it strictly shrinks what gets deleted". That reasoning was WRONG - it cannot close
  # later, but it turns a REFUSAL into a DELETE, and exact matching had deleted nothing.
  # It was reverted the same day. These cases lock the safe behaviour in.
  #
  # 2a. The shape that made it data loss: a vanity block whose own `}` was lost to a
  # hand edit, the user's config below it, and a LATER commented brace that belongs to
  # the user. The loose matcher deleted everything from the marker through `} # end
  # myfunc`, destroying an export and an unrelated function. Exact matching refuses.
  h="$(newcase vanity_ambiguous)"; repo="$TMPROOT/repo_vanity_ambiguous"; mkrepo "$repo" --with-bin
  cat >> "$h/.zshrc" <<'EOF'
# claude-dotfiles vanity command: pull latest and re-launch installer
function yesplease() {
  ( cd /x && ./install.sh "$@" )
export IRREPLACEABLE=1
myfunc() {
  echo hi
} # end myfunc
export ALSO_MINE=2
EOF
  run_install "$h" "$repo"
  assert_has "$h/.zshrc" "IRREPLACEABLE"  "unclosed vanity + later commented brace -> user export survives"
  assert_has "$h/.zshrc" "myfunc"         "unclosed vanity + later commented brace -> user function survives"
  assert_has "$h/.zshrc" "ALSO_MINE"      "unclosed vanity + later commented brace -> trailing config survives"
  assert_in  "$(cat "$h/install.out")" "no closing '}'" \
    "unclosed vanity + later commented brace -> refused and explained"

  # 2b. A vanity block CLOSED by a commented brace is also refused, not guessed at.
  # Leaving it in place is the correct answer: the installer cannot tell that brace from
  # the user's, and a warning the user can act on beats a delete they cannot undo.
  h="$(newcase vanity_commented)"; repo="$TMPROOT/repo_vanity_commented"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" A_vanity_commented "/nonexistent/old/path/improv"
  printf '%s\n' "$canary" >> "$h/.zshrc"
  cat >> "$h/.zshrc" <<'EOF'
my_own_function() {
  echo mine
}
EOF
  run_install "$h" "$repo"
  assert_has "$h/.zshrc" "$canary"         "commented '}' -> user config survives"
  assert_has "$h/.zshrc" "my_own_function" "commented '}' -> unrelated function survives"
  assert_has "$h/.zshrc" "function yesplease" \
    "commented '}' -> ambiguous block left in place rather than guessed at"

  # --- 3. the POSIX function form is a user-owned ampersand too --------------------
  # The guard matched only `function ampersand` and `alias ampersand=`, so a user's own
  # `ampersand() { ... }` read as absent and our block was appended after it.
  h="$(newcase userown_posix)"; repo="$TMPROOT/repo_userown_posix"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" USER_OWN_POSIX ""
  run_install "$h" "$repo"
  assert_lacks "$h/.zshrc" "# improv-shim v1"     "POSIX-form user ampersand -> no shim appended"
  assert_has   "$h/.zshrc" "my own posix thing"   "POSIX-form user ampersand -> left intact"
  assert_in    "$(cat "$h/install.out")" "already defines 'ampersand'" \
    "POSIX-form user ampersand -> the refusal is explained"

  # --- 4. detector and rebuild chain must share one definition of "current" --------
  # zsh runs the whole file, so a current block FOLLOWED BY a stale one runs the stale
  # one. detect_component's bare marker grep called that active, so the browser never
  # offered the repair and the stale block survived forever.
  lib="$TMPROOT/extracted_p5.sh"
  {
    awk '/^SHORTCUT_BEGIN=/,/^SHIM_MARKER=/' "$INSTALLER"
    awk '/^zshrc_block_delete\(\) \{/,/^\}/' "$INSTALLER"
    awk '/^is_current_format\(\) \{/,/^\}/' "$INSTALLER"
    awk '/^detect_component\(\) \{/,/^\}/' "$INSTALLER"
    printf 'warn() { printf "warn: %%s\\n" "$1" >&2; }\n'
  } > "$lib"
  h="$(newcase det_current_then_stale)"; repo="$TMPROOT/repo_det_p5"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"                                    # writes the current shim
  seed "$h/.zshrc" G_prebin "/nonexistent/old/path/improv"    # stale block appended AFTER it
  state="$(ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$repo" bash -c "source '$lib'; detect_component ampersand")"
  assert_eq "$state" "not-installed" \
    "current block followed by a stale one -> not-installed (the stale one is what zsh runs)"

  # And the repair the detector now makes possible actually converges.
  run_install "$h" "$repo"
  assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 1 \
    "current+stale -> a re-run collapses it to exactly one block"
  assert_has "$h/.zshrc" "# improv-shim v1" "current+stale -> the survivor is the current shim"
}

# ============================================================
# PART 4 - the launcher contract and the destructive-sed guard
# ============================================================
# Added 2026-07-27 with the ownership handover. Both behaviours below are ABSENT at
# HEAD, so every assertion here was watched RED first: the unclosed-block rows fail
# against HEAD's unguarded `sed '/m/,/^}$/d'` (it truncates the file, so SENTINEL_TAIL
# vanishes), and the launcher rows fail because HEAD never mentions bin/ampersand.
part4() {
  echo "-- launcher presence + the destructive-range-delete guard --"
  local h repo out

  # --- a mangled vanity block must not take the rest of the .zshrc with it ---------
  h="$(newcase vanity_unclosed)"; repo="$TMPROOT/repo_unclosed"; mkrepo "$repo" --with-bin
  seed "$h/.zshrc" A_unclosed "/nonexistent/old/path/improv"
  printf 'export SENTINEL_TAIL=1\n' >> "$h/.zshrc"
  run_install "$h" "$repo"
  assert_has "$h/.zshrc" "SENTINEL_TAIL"        "unclosed vanity -> the rest of the .zshrc survives"
  assert_in  "$(cat "$h/install.out")" "no closing '}'" \
                                                "unclosed vanity -> installer says why it refused"
  assert_has "$h/.zshrc" "# improv-shim v1"     "unclosed vanity -> the shim is still installed"
  # The damaged block is deliberately LEFT for the user rather than guessed at.
  assert_has "$h/.zshrc" "vanity command"       "unclosed vanity -> damaged block left in place, not guessed at"

  # ...and the uninstall path carries the identical guard. This is the copy that the
  # extraction harness forces to be duplicated, so it is the one most likely to drift.
  local lib="$TMPROOT/extracted4.sh"
  {
    awk '/^SHORTCUT_BEGIN=/,/^SHIM_MARKER=/' "$INSTALLER"
    # deactivate_ampersand delegates every delete to this shared helper, so the extract
    # is incomplete without it. Leaving it out does NOT fail loudly: the `zshrc_block_delete
    # || warn` idiom turns "command not found" into the refuse-to-delete branch, so the
    # suite goes red with "block still present" and points at the installer instead of at
    # its own harness. Cost an investigation once; hence the declare -f assertion below.
    awk '/^zshrc_block_delete\(\) \{/,/^\}/' "$INSTALLER"
    # detect_component's ampersand arm calls this, and it is GLOBAL now - it used to be
    # a local function inside section 11, which is exactly how the detector and the
    # rebuild chain ended up with two different definitions of "current". Omitting it
    # degrades the same silent way zshrc_block_delete does, so it gets the same
    # declare -f assertion below.
    awk '/^is_current_format\(\) \{/,/^\}/' "$INSTALLER"
    awk '/^detect_component\(\) \{/,/^\}/' "$INSTALLER"
    awk '/^deactivate_ampersand\(\) \{/,/^\}/' "$INSTALLER"
    # install.sh's real logger, which the helper's failure path calls.
    printf 'warn() { printf "warn: %%s\\n" "$1" >&2; }\n'
  } > "$lib"
  h="$(newcase deact_unclosed)"
  seed "$h/.zshrc" A_unclosed "/nonexistent/old/path/improv"
  printf 'export SENTINEL_TAIL=1\n' >> "$h/.zshrc"
  ZSHRC="$h/.zshrc" CLAUDE_DIR="$h/.claude" REPO_DIR="$repo" bash -c "source '$lib'; deactivate_ampersand" >/dev/null 2>&1
  assert_has "$h/.zshrc" "SENTINEL_TAIL" "deactivate: unclosed vanity -> file not truncated"

  # --- duplicate blocks: the one zsh actually runs is the LAST one -----------------
  # zsh sources the whole file, so a .zshrc holding a CURRENT block followed by a STALE
  # one runs the stale launcher. A freshness check that asks only "does any block carry
  # the marker" reports everything fine while the broken one is live - the original
  # "nothing happened" bug, reintroduced by its own fix. Install must converge to one.
  h="$(newcase dup_current_then_stale)"; repo="$TMPROOT/repo_dup"; mkrepo "$repo" --with-bin
  run_install "$h" "$repo"                                  # writes a current block
  seed "$h/.zshrc" G_prebin "/nonexistent/old/path/improv"  # ...then a stale one AFTER it
  printf 'export SENTINEL_TAIL=1\n' >> "$h/.zshrc"
  assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 2 "duplicate setup: two blocks present before the repair"
  run_install "$h" "$repo"
  assert_count "$h/.zshrc" "# === improv:shortcuts:begin ===" 1 "duplicate blocks -> collapsed to exactly one"
  assert_has   "$h/.zshrc" "# improv-shim v1"                   "duplicate blocks -> the survivor is the current shim"
  assert_lacks "$h/.zshrc" "/nonexistent/old/path/improv"       "duplicate blocks -> the stale baked path is gone"
  assert_has   "$h/.zshrc" "SENTINEL_TAIL"                      "duplicate blocks -> user config between/after survives"
  out="$(run_ampersand "$h")"
  reached "$out" && ok "duplicate blocks -> the surviving launcher works" \
                 || bad "duplicate blocks -> the surviving launcher works" "$out"

  # --- bin/ampersand present: no warning, and the installer normalises its mode ----
  h="$(newcase launcher_present)"; repo="$TMPROOT/repo_present"; mkrepo "$repo" --with-bin
  chmod 644 "$repo/bin/ampersand"
  run_install "$h" "$repo"
  out="$(cat "$h/install.out")"
  case "$out" in
    *"bin/ampersand is MISSING"*) bad "launcher present -> no spurious MISSING warning" ;;
    *) ok "launcher present -> no spurious MISSING warning" ;;
  esac
  [ -x "$repo/bin/ampersand" ] && ok "launcher present -> installer restores the exec bit" \
                              || bad "launcher present -> installer restores the exec bit"

  # --- bin/ampersand absent: warn LOUDLY, but still leave a working command --------
  # The silent-degrade case. The shim falls back to running install.sh inline, so the
  # command keeps working and nothing looks wrong - which is precisely why it must say so.
  h="$(newcase launcher_absent)"; repo="$TMPROOT/repo_absent"; mkrepo "$repo"
  rm -f "$repo/bin/ampersand"
  run_install "$h" "$repo"
  assert_in "$(cat "$h/install.out")" "bin/ampersand is MISSING" \
                                       "launcher absent -> installer warns"
  assert_in "$(cat "$h/install.out")" "git pull" \
                                       "launcher absent -> warning names the fix"
  assert_has "$h/.zshrc" "# improv-shim v1" "launcher absent -> shim still written"
  out="$(run_ampersand "$h")"
  reached "$out" && ok "launcher absent -> shim falls back and still reaches the installer" \
                 || bad "launcher absent -> shim falls back and still reaches the installer" "$out"
}

# ============================================================
# PART 6 - is_current_format, unit-tested against hand-built .zshrc shapes
# ============================================================
# The whole migration chain and detect_component both branch on this one predicate, so
# a wrong answer here is either a machine that never gets repaired or a machine that
# gets rewritten every run. The end-marker row is the reason this part exists: a block
# with a begin, the shim marker and NO end used to report "current", so section 11
# skipped the repair - while every delete and the entire deactivate path would refuse
# that same block as malformed. Healthy-looking, unrepairable, un-uninstallable.
part6() {
  echo "-- is_current_format agrees with what zsh actually runs --"
  local lib="$TMPROOT/extracted6.sh" f res
  {
    awk '/^SHORTCUT_BEGIN=/,/^SHIM_MARKER=/' "$INSTALLER"
    awk '/^is_current_format\(\) \{/,/^\}/' "$INSTALLER"
  } > "$lib"
  bash -c "source '$lib'; declare -f is_current_format >/dev/null" \
    && ok "extraction: is_current_format is defined" \
    || bad "extraction: is_current_format is defined"

  local B='# === improv:shortcuts:begin ===' E='# === improv:shortcuts:end ===' M='# improv-shim v1'
  shape() { # <label> <file body> <want: active|not-installed>
    f="$TMPROOT/shape.zshrc"; printf '%b' "$2" > "$f"
    if ZSHRC="$f" bash -c "source '$lib'; is_current_format"; then res=active; else res=not-installed; fi
    assert_eq "$res" "$3" "is_current_format: $1"
  }
  shape "empty .zshrc"                     ""                               not-installed
  shape "one well-formed current block"    "$B\n$M\nf(){ :; }\n$E\n"         active
  shape "current block with NO end marker" "$B\n$M\nf(){ :; }\n"             not-installed
  shape "block carrying no shim marker"    "$B\nold\n$E\n"                   not-installed
  shape "current THEN stale (zsh runs the stale one)" "$B\n$M\n$E\n$B\nold\n$E\n" not-installed
  shape "stale THEN current"               "$B\nold\n$E\n$B\n$M\n$E\n"       not-installed
  shape "shim marker OUTSIDE the block"    "$B\n$E\n$M\n"                    not-installed
  shape "markers with trailing whitespace" "$B   \n$M\n$E  \n"               active
}

# ============================================================
# Negative control
# ============================================================
# Re-runs PART 1 and PART 2 against install.sh AS OF HEAD, with no bin/ampersand.
# Those cases MUST fail there. If they all pass, the assertions are decorative and
# this suite is worthless - so a clean pre-fix run is itself a FAILURE.
if [ "${1:-}" = "--negative-control" ]; then
  echo "=== NEGATIVE CONTROL: same assertions against install.sh @ HEAD, no bin/ampersand ==="
  prefix_installer="$TMPROOT/prefix-install.sh"
  git -C "$REPO_ROOT" show HEAD:install.sh > "$prefix_installer" 2>/dev/null || {
    echo "cannot read HEAD:install.sh - run this inside the git repo"; exit 2; }
  export IMPROV_TEST_INSTALLER="$prefix_installer"
  export IMPROV_TEST_BIN=""
  INSTALLER="$prefix_installer"
  BIN_AMPERSAND=""
  part1
  part2
  part5
  echo ""
  echo "pre-fix results: $PASS passed, $FAIL failed"
  if [ "$FAIL" -eq 0 ]; then
    echo "NEGATIVE CONTROL FAILED: the pre-fix code passed every assertion, so the suite proves nothing."
    exit 1
  fi
  echo "NEGATIVE CONTROL OK: $FAIL assertions fail against pre-fix code and pass against the fix."
  exit 0
fi

part1
part2
part3
part4
part5
part6

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
