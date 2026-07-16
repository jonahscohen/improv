#!/usr/bin/env bash
# test-browser-render.sh - pty-driven RENDER harness for the install.sh bucket browser.
#
# WHY A PTY: the browser is a TTY app. `bash install.sh --browser </dev/null` is not a
# terminal, so gum refuses to draw, `read -r </dev/tty` has nothing to read, and the
# window size cannot be measured. Nothing about the real screens is observable that
# way. /usr/bin/script gives the installer a REAL pty, so this harness drives the
# actual program and captures the ACTUAL bytes it painted.
#
# WHAT IT PROVES (and does not): it asserts on REAL CAPTURED OUTPUT - the text is on
# disk in /tmp/browser-render-*.txt for a human to read. It does NOT judge whether the
# layout looks good; that is a human call against the prototype.
#
# BOTH PATHS ARE COVERED, and neither may be skipped silently:
#   text - run with gum's directory OFF the PATH so `gum` is genuinely unresolvable and
#          render_screen_text runs. Driven with numeric input. The premise is CHECKED at
#          startup, not assumed.
#   gum  - gum's real directory (discovered via `command -v`, not hardcoded) on the PATH
#          so render_screen runs. gum reads RAW KEYS from the tty, so it is driven with
#          escape sequences (\033[B = down, \r = enter, \033 = escape). This works but is
#          TIMING-based: keys are paced with sleeps because keys delivered before gum
#          enters raw mode are echoed and lost (measured, not theoretical - an unpaced
#          drive selects the wrong row). If gum is missing, that is a HARNESS ERROR, not
#          a skip: exiting green having exercised one of two renderers is a false success.
#
# EVERY driven run is wrapped in a hard watchdog. A drive whose keys do not lead to an
# exit leaves gum waiting on a key forever; the watchdog turns that into exit 3 instead
# of a hung suite.
#
# EXIT CODES (distinct per failure class - never a silent success):
#   0  every assertion passed
#   1  an assertion FAILED against real captured output
#   2  harness/setup error - a capture was empty/stale, the installer failed under the
#      pty, or gum was missing so a renderer went unexercised. Nothing was proven.
#   3  a driven run hit the watchdog (hung); its assertions are NOT trustworthy

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALLER="$REPO_DIR/install.sh"
OUT_PREFIX="/tmp/browser-render"
COLS=130
ROWS=60
WATCHDOG_SECS=90

# Resolve gum rather than assuming /opt/homebrew/bin: Intel Homebrew puts it in
# /usr/local/bin, and a hardcoded path would silently SKIP the gum path there while the
# suite still exited green - a false success for "both paths are covered".
GUM_BIN="$(command -v gum 2>/dev/null || true)"
GUM_DIR=""
[ -n "$GUM_BIN" ] && GUM_DIR="$(dirname "$GUM_BIN")"

# The text path must run with gum genuinely unreachable. Build its PATH from the system
# dirs and then PROVE gum is not resolvable on it, rather than assuming.
TEXT_PATH="/usr/bin:/bin:/usr/sbin:/sbin"

PASS=0
FAIL=0
HARNESS_ERR=0
TIMED_OUT=0

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; DIM=$'\033[2m'; NC=$'\033[0m'

pass() { PASS=$((PASS + 1)); printf '  %sPASS%s %s\n' "$GREEN" "$NC" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  %sFAIL%s %s\n' "$RED" "$NC" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$NC"; }

[ -f "$INSTALLER" ] || { printf '%sharness: install.sh not found at %s%s\n' "$RED" "$INSTALLER" "$NC"; exit 2; }
[ -x /usr/bin/script ] || { printf '%sharness: /usr/bin/script not found (no pty available)%s\n' "$RED" "$NC"; exit 2; }

# The text path's whole premise is that gum is unreachable. Verify it.
if PATH="$TEXT_PATH" command -v gum >/dev/null 2>&1; then
  printf '%sharness: gum is resolvable on the text-path PATH (%s) - the no-gum renderer cannot be isolated%s\n' \
    "$RED" "$TEXT_PATH" "$NC"
  exit 2
fi

# _clean <raw> <out> - strip ANSI/OSC escapes and CRs so assertions match on the TEXT
# the terminal actually showed. Kept as a separate readable file: the coordinator reads
# these, and raw pty bytes are unreadable.
_clean() {
  python3 - "$1" "$2" <<'PY'
import re, sys
raw = open(sys.argv[1], "rb").read().decode("utf-8", "replace")
raw = re.sub(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)", "", raw)   # OSC
raw = re.sub(r"\x1b\[[0-9;?]*[ -/]*[@-~]", "", raw)           # CSI
raw = re.sub(r"\x1b[=>]", "", raw)
raw = re.sub(r"\x1b[()][A-B0-9]", "", raw)
raw = raw.replace("\r\n", "\n").replace("\r", "\n")
raw = re.sub(r"\n{3,}", "\n\n", raw)
open(sys.argv[2], "w").write(raw)
PY
}

# _drive <name> <use_gum:0|1> <keyscript> - run install.sh --browser under a pty, feed
# it <keyscript> (a bash snippet emitting keystrokes), capture to
# /tmp/browser-render-<name>.raw and .txt.
#
# FRESHNESS IS PROVEN, NOT ASSUMED (this is load-bearing). The captures live at stable
# /tmp paths so a human can read them, which means a PREVIOUS run's file is sitting
# there before this one starts. An earlier cut of this harness did `rm -f` and then
# checked `[ -s "$raw" ]` - but if the rm fails (or the pty writes nothing), the STALE
# file satisfies that check, gets re-cleaned, and every assertion passes against output
# that THIS RUN NEVER PRODUCED. That is a green suite proving nothing, and it was
# demonstrated, not theorized.
#
# So each run mints a NONCE and has the pty echo it as the very first thing it writes.
# A capture that does not contain THIS run's nonce is rejected as stale/absent. The
# nonce survives the browser's `clear` because the capture file records every byte
# written, and a clear only rewrites the visible screen.
#
# Returns: 0 ok | 2 harness error (nothing proven) | 3 watchdog (hung).
_drive() {
  local name="$1" use_gum="$2" keyscript="$3"
  local raw="$OUT_PREFIX-$name.raw" txt="$OUT_PREFIX-$name.txt"
  local path_env spid wpid rc nonce

  nonce="RENDERNONCE-$$-$(date +%s)-$name-$RANDOM"

  rm -f "$raw" "$txt"
  # Do not trust rm's silence: if the old capture is still here, refuse to run rather
  # than risk asserting against it.
  if [ -e "$raw" ] || [ -e "$txt" ]; then
    printf '%sharness: could not clear a previous capture (%s) - refusing to run %s against a possibly stale file%s\n' \
      "$RED" "$raw" "$name" "$NC"
    HARNESS_ERR=1
    return 2
  fi

  if [ "$use_gum" = "1" ]; then
    path_env="$GUM_DIR:$TEXT_PATH"
  else
    # gum's dir is omitted => `command -v gum` fails inside install.sh =>
    # render_screen_text runs. Proven at startup, not assumed.
    path_env="$TEXT_PATH"
  fi

  # GIT_TERMINAL_PROMPT=0 + BatchMode: the browser's update row calls the REAL
  # check_updates (git fetch). Without these, a credential prompt would block on the
  # pty and the run would die by watchdog instead of rendering.
  eval "$keyscript" | /usr/bin/script -q "$raw" /bin/bash -c "
    printf '%s\n' '$nonce'
    stty cols $COLS rows $ROWS 2>/dev/null
    export TERM=xterm-256color
    export PATH='$path_env'
    export GIT_TERMINAL_PROMPT=0
    export GIT_SSH_COMMAND='ssh -o BatchMode=yes'
    cd '$REPO_DIR'
    /bin/bash '$INSTALLER' --browser
  " >/dev/null 2>&1 &
  spid=$!

  ( sleep "$WATCHDOG_SECS"; kill -9 "$spid" 2>/dev/null; pkill -9 -f 'install.sh --browser' 2>/dev/null ) >/dev/null 2>&1 &
  wpid=$!

  wait "$spid" 2>/dev/null; rc=$?
  kill "$wpid" 2>/dev/null; wait "$wpid" 2>/dev/null

  if [ "$rc" = "137" ]; then
    printf '%sharness: run %s hit the %ss watchdog (hung) - its output is not trustworthy%s\n' \
      "$RED" "$name" "$WATCHDOG_SECS" "$NC"
    TIMED_OUT=1
    return 3
  fi

  if [ ! -s "$raw" ]; then
    printf '%sharness: capture %s is EMPTY - the pty produced nothing%s\n' "$RED" "$raw" "$NC"
    HARNESS_ERR=1
    return 2
  fi

  if ! _clean "$raw" "$txt"; then
    printf '%sharness: could not clean capture %s%s\n' "$RED" "$raw" "$NC"
    HARNESS_ERR=1
    return 2
  fi
  if [ ! -s "$txt" ]; then
    printf '%sharness: cleaned capture %s is EMPTY%s\n' "$RED" "$txt" "$NC"
    HARNESS_ERR=1
    return 2
  fi

  # The freshness proof.
  if ! grep -qF -- "$nonce" "$txt"; then
    printf '%sharness: capture %s does NOT carry this run nonce (%s) - it is stale or was never written%s\n' \
      "$RED" "$txt" "$nonce" "$NC"
    HARNESS_ERR=1
    return 2
  fi

  # A clean browser exit is 0. Anything else is the installer failing under us, which
  # must not be quietly absorbed into "some assertion failed".
  if [ "$rc" != "0" ]; then
    printf '%sharness: run %s exited %s (expected 0) - the installer failed under the pty%s\n' \
      "$RED" "$name" "$rc" "$NC"
    HARNESS_ERR=1
    return 2
  fi
  return 0
}

# assert_in <file> <needle> <label>  - fixed-string presence in REAL captured output.
assert_in() {
  local f="$1" needle="$2" label="$3"
  if grep -qF -- "$needle" "$f" 2>/dev/null; then pass "$label"; else
    fail "$label  (missing: '$needle' in $f)"
  fi
}

# assert_re <file> <regex> <label>
assert_re() {
  local f="$1" re="$2" label="$3"
  if grep -qE -- "$re" "$f" 2>/dev/null; then pass "$label"; else
    fail "$label  (no match for /$re/ in $f)"
  fi
}

# assert_not_in <file> <needle> <label>
assert_not_in() {
  local f="$1" needle="$2" label="$3"
  if grep -qF -- "$needle" "$f" 2>/dev/null; then
    fail "$label  (unexpectedly present: '$needle' in $f)"
  else pass "$label"; fi
}

# assert_row_has <file> <rowkey> <needle> <label> - the LINE naming <rowkey> also
# carries <needle>. Per-row assertion, not just "somewhere on screen": that is what
# distinguishes "beats-rebuild says always on" from "the words appear on the screen".
assert_row_has() {
  local f="$1" rowkey="$2" needle="$3" label="$4"
  if grep -F -- "$rowkey" "$f" 2>/dev/null | grep -qF -- "$needle"; then pass "$label"; else
    fail "$label  (row '$rowkey' lacks '$needle' in $f)"
  fi
}

# --- key emitters ------------------------------------------------------------
# Text path: one line per menu choice. Paced so each read lands on its own screen.
_keys_text() {
  local k
  printf 'sleep 2.5; '
  for k in "$@"; do printf "printf '%%s\\\\n' '%s'; sleep 0.9; " "$k"; done
  printf 'sleep 1.2'
}

# gum path: raw keys. The leading sleep waits for gum to enter raw mode - keys sent
# before that are echoed by the line discipline and LOST (measured).
_keys_gum() {
  local k
  printf 'sleep 3.5; '
  for k in "$@"; do printf "printf '%%b' '%s'; sleep 0.55; " "$k"; done
  printf 'sleep 1.5'
}

printf '\n%sBucket browser render harness%s\n' "$YELLOW" "$NC"
printf '%sinstaller: %s%s\n' "$DIM" "$INSTALLER" "$NC"
printf '%spty: %sx%s via /usr/bin/script%s\n\n' "$DIM" "$COLS" "$ROWS" "$NC"

# ============================================================
# 1. TEXT PATH - root screen (gum masked off PATH)
# ============================================================
printf '%s[1] text path: root screen%s\n' "$YELLOW" "$NC"
# '0' at root with nothing staged quits cleanly.
if _drive text-root 0 "$(_keys_text 0)"; then
F="$OUT_PREFIX-text-root.txt"
  assert_not_in "$F" "gum" "gum is genuinely absent (text renderer ran)"
  assert_in "$F" "ampersand" "breadcrumb renders"
  assert_in "$F" "Choose what runs on this machine" "root lead line renders"
  assert_in "$F" "CORE COMPONENTS" "CORE COMPONENTS section label"
  assert_in "$F" "MORE COMPONENTS" "MORE COMPONENTS section label"
  for flagship in Foundation Beats Sidecoach Justify Tilt-lab Lotus; do
    assert_in "$F" "$flagship" "flagship row: $flagship"
  done
  assert_re "$F" '(Up to date|Update available|Update check unavailable)' "two-state update row renders"
  assert_re "$F" '[0-9]+/[0-9]+' "per-group installed/total count column"
  assert_re "$F" '(active|partial|not installed)' "status per row"
  assert_in "$F" "Apply 0 changes" "Apply row (nothing staged)"
  assert_in "$F" "Quit" "Quit row"
  assert_in "$F" "Open a group to drill in" "footer / detail bar"
  assert_in "$F" "Enter a number" "numbered-menu prompt"
  # Personal is gated behind --personal and must not leak into a normal run.
  assert_not_in "$F" "ghostty" "Personal bucket hidden without --personal"
else
  fail "text-root: the driven run did not produce a fresh capture (see harness error above)"
fi

# ============================================================
# 2. TEXT PATH - root -> Beats -> Hooks (the 7 hooks + descriptions + pinned)
# ============================================================
printf '\n%s[2] text path: root -> Beats -> Hooks%s\n' "$YELLOW" "$NC"
# 3=Beats, 6=Hooks, 0=back to Beats, 0=back to root, 0=quit
if _drive text-beats-hooks 0 "$(_keys_text 3 6 0 0 0)"; then
F="$OUT_PREFIX-text-beats-hooks.txt"
  assert_in "$F" "ampersand > Beats" "breadcrumb drills to Beats"
  assert_in "$F" "ampersand > Beats > Hooks" "breadcrumb drills to Beats > Hooks"
  assert_re "$F" '[0-9]+ of [0-9]+ installed' "lead-line 'N of M installed' count"
  assert_re "$F" '[0-9]+ of [0-9]+ hooks on' "hooks-folder lead-line count"
  assert_in "$F" "< Back to all groups" "contextual back row (bucket screen)"
  assert_in "$F" "< Back to Beats" "contextual back row (hooks screen)"
  assert_in "$F" "+ Install all of Beats..." "Install all contextual action"
  assert_in "$F" "- Remove all of Beats..." "Remove all contextual action"
  assert_in "$F" "+ Enable all hooks..." "Enable all hooks action (folder named Hooks)"
  assert_in "$F" "- Disable all hooks..." "Disable all hooks action"

  # All 7 Beats hooks, each WITH its description on the same row.
  assert_row_has "$F" "memory-approve"        "Guards writes to your beats files."             "hook+desc: memory-approve"
  assert_row_has "$F" "memory-nudge"          "Reminds you to write a beat after each change." "hook+desc: memory-nudge"
  assert_row_has "$F" "memory-compact"        "Keeps the beats index under its load budget."   "hook+desc: memory-compact"
  assert_row_has "$F" "consolidate-nudge"     "Flags beat clusters worth consolidating."       "hook+desc: consolidate-nudge"
  assert_row_has "$F" "beats-rebuild"         "Recompiles the beats search index"              "hook+desc: beats-rebuild"
  assert_row_has "$F" "beats-staleness-guard" "Verifies the beats index at session start."     "hook+desc: beats-staleness-guard"
  assert_row_has "$F" "reflect-nudge"         "Suggests a reflect pass when new beats pile up." "hook+desc: reflect-nudge"

  # The 2 PINNED hooks render as always-on and are NOT offered as a toggle.
  assert_row_has "$F" "beats-rebuild"         "always on" "pinned renders always-on: beats-rebuild"
  assert_row_has "$F" "beats-staleness-guard" "always on" "pinned renders always-on: beats-staleness-guard"
else
  fail "text-beats-hooks: the driven run did not produce a fresh capture (see harness error above)"
fi

# ============================================================
# 3. TEXT PATH - toggle staging, pinned no-op, quit-with-unapplied warn
# ============================================================
printf '\n%s[3] text path: toggle / pinned no-op / quit warn%s\n' "$YELLOW" "$NC"
# 3=Beats, 6=Hooks, 4=toggle memory-approve, 8=beats-rebuild (PINNED -> toast, no stage),
# 0=back, 0=root, 0=quit -> warn, 2=discard and quit.
if _drive text-toggle 0 "$(_keys_text 3 6 4 8 0 0 0 2)"; then
F="$OUT_PREFIX-text-toggle.txt"
  # Direction depends on whether memory-approve is currently installed on THIS machine,
  # so assert that a pending marker appeared - not which way it points.
  if grep -F -- "memory-approve" "$F" | grep -qE '(\+ install|- uninstall)'; then
    pass "toggling a hook stages a pending marker on its row"
  else
    fail "toggling a hook did not stage a pending marker on its row ($F)"
  fi
  assert_in "$F" "Apply 1 change" "Apply row appears with pending (singular)"
  assert_in "$F" "staged" "staged rollup in the detail bar"
  assert_re "$F" '[+-][0-9]' "group rollup shows the pending marker"
  # Pinned: the toast names the hook (a missing name here is a real regression - the
  # first cut printed ' is always on' because hook leaves have no stored label).
  assert_in "$F" "beats-rebuild is always on" "pinned toggle is a named no-op toast"
  assert_in "$F" "project-scoped and cannot be toggled here" "pinned toast explains why"
  assert_in "$F" "staged change(s) have not been applied" "quit with unapplied changes warns"
  assert_in "$F" "Discard them and quit" "quit warn offers discard"
  assert_in "$F" "Apply them now" "quit warn offers apply"
  assert_in "$F" "Keep browsing" "quit warn offers cancel"
else
  fail "text-toggle: the driven run did not produce a fresh capture (see harness error above)"
fi

# ============================================================
# 4. TEXT PATH - Install all / Remove all stage the whole subtree
# ============================================================
printf '\n%s[4] text path: stage_all via the contextual actions%s\n' "$YELLOW" "$NC"
# 3=Beats, 6=Hooks, 3=Disable all hooks..., then 0,0,0=quit -> warn, 2=discard.
if _drive text-stageall 0 "$(_keys_text 3 6 3 0 0 0 2)"; then
F="$OUT_PREFIX-text-stageall.txt"
  # STATE-INDEPENDENT BY DERIVATION, not by weakening. "Apply 5 changes" only holds
  # where all 5 non-pinned Beats hooks are installed, and even "Apply [1-9]+" is wrong
  # on a machine where they are all already OFF (there, staging NOTHING is correct).
  # So derive the expectation from what the screen itself reports: Disable-all must
  # stage exactly the non-pinned hooks currently showing `active`.
  #
  # Scoped to the LAST "Beats > Hooks" screen in the capture (the post-action render) -
  # the file also holds the earlier screens and the Beats screen, whose `active` rows
  # would otherwise be counted.
  hooks_screen="$(awk '/ampersand > Beats > Hooks/{buf=""} {buf = buf $0 ORS} END{printf "%s", buf}' "$F")"
  expect_n="$(printf '%s' "$hooks_screen" \
    | grep -E 'memory-approve|memory-nudge|memory-compact|consolidate-nudge|reflect-nudge' \
    | grep -c 'active')"
  expect_n="$(printf '%s' "$expect_n" | tr -d ' ')"
  if [ "$expect_n" = "1" ]; then expect_row="Apply 1 change"; else expect_row="Apply $expect_n changes"; fi
  assert_in "$F" "$expect_row" "Disable all stages exactly the $expect_n active non-pinned hooks (count derived from the screen)"
  if grep -F -- "beats-rebuild" "$F" | grep -qF -- "- uninstall"; then
    fail "pinned hook was staged by Disable all (beats-rebuild must be skipped)"
  else
    pass "pinned hook NOT staged by Disable all: beats-rebuild"
  fi
  if grep -F -- "beats-staleness-guard" "$F" | grep -qF -- "- uninstall"; then
    fail "pinned hook was staged by Disable all (beats-staleness-guard must be skipped)"
  else
    pass "pinned hook NOT staged by Disable all: beats-staleness-guard"
  fi
  assert_row_has "$F" "beats-rebuild" "always on" "pinned still always-on after Disable all"
else
  fail "text-stageall: the driven run did not produce a fresh capture (see harness error above)"
fi

# ============================================================
# 5. GUM PATH - root screen render
# ============================================================
printf '\n%s[5] gum path: root screen%s\n' "$YELLOW" "$NC"
if [ -n "$GUM_BIN" ] && [ -x "$GUM_BIN" ]; then
  # A single ESC at root with nothing staged aborts the chooser and quits.
  if _drive gum-root 1 "$(_keys_gum '\033')"; then
  F="$OUT_PREFIX-gum-root.txt"
    assert_in "$F" "navigate" "gum chooser actually rendered (its key hints are present)"
    assert_in "$F" "ampersand" "breadcrumb renders above the chooser"
    assert_in "$F" "Choose what runs on this machine" "root lead line renders"
    assert_in "$F" "CORE COMPONENTS" "CORE COMPONENTS label renders as a row"
    assert_in "$F" "MORE COMPONENTS" "MORE COMPONENTS label renders as a row"
    for flagship in Foundation Beats Sidecoach Justify Tilt-lab Lotus; do
      assert_in "$F" "$flagship" "flagship row: $flagship"
    done
    assert_re "$F" '(Up to date|Update available|Update check unavailable)' "two-state update row renders"
    assert_re "$F" '[0-9]+/[0-9]+' "per-group installed/total count column"
    assert_re "$F" '(active|partial|not installed)' "status per row"
    assert_in "$F" "Apply 0 changes" "Apply row"
    assert_in "$F" "Quit" "Quit row"
    assert_in "$F" "Open a group to drill in" "detail bar (rides in gum's --header)"
  else
    fail "gum-root: the driven run did not produce a fresh capture (see harness error above)"
  fi

  # ============================================================
  # 6. GUM PATH - driven navigation (arrow keys + enter)
  # ============================================================
  printf '\n%s[6] gum path: drive down to Beats and open it%s\n' "$YELLOW" "$NC"
  # Root rows: [0]=update [1]=CORE label [2]=Foundation [3]=Beats. Cursor starts at 0,
  # so 3 downs land on Beats; enter drills in; two escapes back out and quit.
  if _drive gum-nav 1 "$(_keys_gum '\033[B' '\033[B' '\033[B' '\r' '\033' '\033')"; then
  F="$OUT_PREFIX-gum-nav.txt"
    assert_in "$F" "ampersand > Beats" "gum drill-in reached the Beats screen"
    assert_in "$F" "< Back to all groups" "Beats screen back row renders"
    assert_re "$F" '[0-9]+ of [0-9]+ installed' "Beats lead-line count"
    assert_in "$F" "the beats memory engine" "Beats member row (memory) renders"
    assert_in "$F" "reflection over your beats" "Beats member row (reflect) renders"
  else
    fail "gum-nav: the driven run did not produce a fresh capture (see harness error above)"
  fi
else
  printf '%sharness: gum not found on PATH - the gum renderer was NOT exercised.%s\n' "$RED" "$NC"
  printf '%sHalf of this harness premise is the gum path; skipping it green would be a false success.%s\n' "$RED" "$NC"
  HARNESS_ERR=1
fi

# ============================================================
# Summary
# ============================================================
printf '\n%s----------------------------------------%s\n' "$DIM" "$NC"
printf 'captured screens (left on disk for review):\n'
for f in "$OUT_PREFIX"-*.txt; do [ -e "$f" ] && printf '  %s\n' "$f"; done
printf '%s----------------------------------------%s\n' "$DIM" "$NC"

if [ "$HARNESS_ERR" = "1" ]; then
  printf '%sHARNESS ERROR - at least one run produced no fresh capture (empty, stale, or the installer failed under the pty). Nothing was proven for it; see the harness lines above.%s\n\n' "$RED" "$NC"
  exit 2
fi
if [ "$TIMED_OUT" = "1" ]; then
  printf '%sWATCHDOG - a driven run hung; its assertions are not trustworthy.%s\n\n' "$RED" "$NC"
  exit 3
fi
if [ "$FAIL" -gt 0 ]; then
  printf '%s%d passed, %d FAILED%s\n\n' "$RED" "$PASS" "$FAIL" "$NC"
  exit 1
fi
printf '%sALL %d RENDER CHECKS PASSED%s\n\n' "$GREEN" "$PASS" "$NC"
exit 0
