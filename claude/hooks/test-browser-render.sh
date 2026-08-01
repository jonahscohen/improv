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
raw = re.sub(r"^.*: printf: write error: Interrupted system call\r?\n", "", raw, flags=re.M)
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
  local name="$1" use_gum="$2" keyscript="$3" cols="${4:-$COLS}"
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
  #
  # BR_LAUNCH_DWELL=0 removes the launch banner's minimum dwell, NOT the banner. This is
  # a timing seam, not a coverage hole, and the distinction matters:
  #   - The banner still DRAWS on every driven run, so the width assertions below still
  #     measure it (they are what caught the 64-column art overflowing a 60-col terminal).
  #   - Only the padding is dropped. The dwell exists so a human SEES the beat; a pty
  #     that reads bytes does not need to be shown anything. Worse, it actively breaks
  #     these runs: keys are sent on a fixed schedule, and gum LOSES anything typed
  #     before it enters raw mode (see _keys_gum), so a 2s pause ahead of gum silently
  #     ate the first keystroke and every gum assertion failed.
  # The dwell is proven separately, against the real default entry with the real default
  # dwell, by killing the pty mid-beat and asserting the banner is on screen while the
  # root screen is not. That is a visibility claim, and it cannot be made from here.
  eval "$keyscript" | /usr/bin/script -q "$raw" /bin/bash -c "
    printf '%s\n' '$nonce'
    stty cols $cols rows $ROWS 2>/dev/null
    export TERM=xterm-256color
    export PATH='$path_env'
    export GIT_TERMINAL_PROMPT=0
    export GIT_SSH_COMMAND='ssh -o BatchMode=yes'
    export BR_LAUNCH_DWELL=0
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

# assert_in_flow <file> <needle> <label> - presence of <needle> as CONTIGUOUS TEXT with
# whitespace normalized, so a phrase still counts when the renderer legitimately WRAPS it
# across lines (which is exactly what narrow widths do to a description). Without this a
# wrapped-but-fully-readable description would fail for the wrong reason.
_flow_has() {
  python3 - "$1" "$2" <<'PYX'
import re, sys
d = open(sys.argv[1]).read()
flow = re.sub(r"\s+", " ", d)
sys.exit(0 if re.sub(r"\s+", " ", sys.argv[2]) in flow else 1)
PYX
}

assert_in_flow() {
  local f="$1" needle="$2" label="$3"
  if _flow_has "$f" "$needle"; then pass "$label"; else
    fail "$label  (not present even across line wraps in $f)"
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

# assert_row_flow_has <file> <rowkey> <needle> <label> - the row naming <rowkey> TOGETHER
# WITH its continuation lines (everything up to the next numbered row) carries <needle>,
# whitespace-normalized.
#
# WHY THIS EXISTS (2026-08-01): hook descriptions became TWO SENTENCES, ~220 chars. They no
# longer fit the row's ~52-col description column, so the renderer wraps them onto their own
# lines beneath the row. assert_row_has is same-LINE only and can no longer see them - it
# went red on all 7 Beats hooks for a layout that is in fact correct.
#
# The naive fix would be assert_in_flow on the whole capture, but that discards the PER-ROW
# binding, which is the entire distinction assert_row_has exists to make ("this row says X"
# vs "X is somewhere on screen"). This keeps the binding and only widens it from one line to
# one row BLOCK. A row block ends at the next `N)` line, so a needle cannot leak in from a
# neighbouring hook.
_row_flow_has() {
  python3 - "$1" "$2" "$3" <<'PYX'
import re, sys
path, rowkey, needle = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().split("\n")
row_re = re.compile(r"^\s*\d+\)")          # the numbered-menu row shape
want = re.sub(r"\s+", " ", needle)
# A screen can be captured more than once in a run (before and after a toggle), so every
# matching row block is tried; one hit is enough.
for i, line in enumerate(lines):
    if row_re.match(line) and rowkey in line:
        block = [line]
        for nxt in lines[i + 1:]:
            if row_re.match(nxt):
                break
            block.append(nxt)
        if want in re.sub(r"\s+", " ", " ".join(block)):
            sys.exit(0)
sys.exit(1)
PYX
}

assert_row_flow_has() {
  local f="$1" rowkey="$2" needle="$3" label="$4"
  if _row_flow_has "$f" "$rowkey" "$needle"; then pass "$label"; else
    fail "$label  (row '$rowkey' and its wrap lines lack '$needle' in $f)"
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
#
# WHY THE LEAD IS 12s AND NOT 3.5s. It has to outlast everything before the first gum:
# the banner AND the browser's REAL update check (_browser_update_refresh runs an actual
# `git fetch`). BR_LAUNCH_DWELL=0 removes the banner's dwell but nothing removes the
# fetch, and its duration is not ours to predict - it is a network call, and on a loaded
# machine the whole startup regularly ran past 3.5s.
#
# The failure it caused was SILENT and total, not a nudge: the escape landed while
# "Checking for updates..." was still on screen, sat in the pty buffer, and the instant
# gum started it consumed the buffered escape and aborted - so the browser quit having
# never drawn a single row, and all 13 gum-root assertions failed with "missing:
# Foundation / CORE COMPONENTS / navigate". Read as a real regression, that is a
# spectacular false alarm; it was reproduced identically on UNMODIFIED code (git stash),
# which is what proved it environmental.
#
# 12s is measured headroom (startup was ~2-4s at idle, past 9s at load), not a
# guess, and it costs 8.5s on each of two gum runs. A readiness GATE - polling the
# capture for gum's footer before sending - would be strictly better than any constant;
# left alone here because it means threading the capture path into the key script, and
# this file's job today was the frame-height hole.
# The per-key gap: a key that CHANGES SCREEN needs a wider one after it, because every
# screen change starts a BRAND NEW gum and the next key needs the same grace the first
# key does or it lands during startup and is lost.
#
# Both enter AND escape change screen - escape navigates UP a level, which re-renders
# exactly like entering does. Widening only enter was not enough: gum-nav's second escape
# still arrived while the root's fresh gum was starting, was swallowed, and left the
# browser parked with nothing to quit it (90s watchdog, reported as a hang). An arrow
# only moves gum's cursor within a live process, so it keeps the short gap.
_keys_gum() {
  local k gap
  printf 'sleep 12; '
  for k in "$@"; do
    case "$k" in
      '\r'|'\033') gap=1.6 ;;
      *)           gap=0.55 ;;
    esac
    printf "printf '%%b' '%s'; sleep %s; " "$k" "$gap"
  done
  printf 'sleep 1.5'
}

# HARNESS SELF-CHECK: assert_in_flow is what proves "the description is readable", so a
# broken matcher would turn the whole width matrix green while proving nothing. Prove it
# matches text the renderer WRAPPED across lines, and prove it can still FAIL.
_selfchk="/tmp/.browser-render-selfcheck.$$"
printf 'Recompiles the beats search index in the\n      background.\n' > "$_selfchk"
if _flow_has "$_selfchk" "Recompiles the beats search index in the background." \
   && ! _flow_has "$_selfchk" "a sentence that is definitely not present"; then
  :
else
  printf '%sharness: assert_in_flow is broken (it cannot match across wraps, or cannot fail) - its verdicts are worthless%s\n' "$RED" "$NC"
  rm -f "$_selfchk"
  exit 2
fi
rm -f "$_selfchk"

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
  assert_not_in "$F" "Apply 0 changes" "root hides the Apply row at zero pending (matches sub-screens)"
  assert_in "$F" "Quit" "Quit row"
  assert_in "$F" "Open a group to drill in" "footer / detail bar"
  assert_in "$F" "Enter a number" "numbered-menu prompt"
  assert_in "$F" "Quit activated." "quit confirms activation"
  assert_in "$F" "Session closed." "quit prints one formal sign-off line"
  assert_not_in "$F" "[ok]    Done." "quit does not print the old Done summary"
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

  # All 7 Beats hooks, each WITH its description bound to its own row block. Descriptions are
  # two sentences now and wrap beneath the row rather than sharing it, so this uses
  # assert_row_flow_has (row + its continuation lines) instead of assert_row_has (same line).
  #
  # The needle is deliberately each description's SECOND sentence. A first-sentence needle
  # would still pass on a row that lost its second sentence to truncation, which is the exact
  # regression worth catching now that every description carries two.
  assert_row_flow_has "$F" "memory-approve"        "It only ever grants permission: the write-time content checks still run and can still reject the file." "hook+desc: memory-approve"
  assert_row_flow_has "$F" "memory-nudge"          "Read-only commands like git status leave the flag alone; sed -i sets it." "hook+desc: memory-nudge"
  assert_row_flow_has "$F" "memory-compact"        "It ignores every other file and rewrites only when something actually changed." "hook+desc: memory-compact"
  assert_row_flow_has "$F" "consolidate-nudge"     "Advisory only: it never edits or deletes a note, and it waits before raising the same group again." "hook+desc: consolidate-nudge"
  assert_row_flow_has "$F" "beats-rebuild"         "It runs detached and swallows every error, so it can never block or slow your session." "hook+desc: beats-rebuild"
  assert_row_flow_has "$F" "beats-staleness-guard" "Silent when it is fresh, and it never fails the session start." "hook+desc: beats-staleness-guard"
  assert_row_flow_has "$F" "reflect-nudge"         "The first run only records the timestamp, so a fresh machine is never nagged on day one." "hook+desc: reflect-nudge"

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
  assert_in "$F" "Quit activated." "discard-and-quit confirms activation"
  assert_in "$F" "Session closed." "discard-and-quit prints one formal sign-off line"
  assert_not_in "$F" "[ok]    Done." "discard-and-quit does not print the old Done summary"
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
    assert_not_in "$F" "Apply 0 changes" "root hides the Apply row at zero pending"
    assert_in "$F" "Quit" "Quit row"
    assert_in "$F" "Quit activated." "gum quit confirms activation"
    assert_in "$F" "Session closed." "gum quit prints one formal sign-off line"
    assert_not_in "$F" "[ok]    Done." "gum quit does not print the old Done summary"
    # Defect 2 regression: the lead and the orientation line were adjacent above the
    # rows saying the same thing twice. gum now gets only non-redundant text.
    assert_not_in "$F" "Open a group to drill in" "gum path does not restate the lead as a second instruction line"
    # Omitting --header entirely makes gum print its own default "Choose:" under our
    # lead. We pass an explicit (possibly empty) header to suppress it.
    assert_not_in "$F" "Choose:" "gum default header suppressed"
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
# 7. WIDTH MATRIX - the description column must survive narrow terminals
# ============================================================
# The tag column carries the hook DESCRIPTIONS, which are the whole point of the
# drill-in. 80 columns is the classic default and what a teammate on a fresh machine
# gets, and name(29) + desc(52) + status can never share an 80-col line - so at narrow
# widths the description wraps to its own continuation line rather than being amputated.
# These captures prove a user can READ every description at each width, and that nothing
# is ever cut mid-word.
printf '\n%s[7] width matrix: descriptions readable at 60 / 80 / 100 / 120%s\n' "$YELLOW" "$NC"
LONGEST_DESC="Auto-approves Write, Edit and MultiEdit into any .claude/memory directory, so saving a session note never stalls on a permission prompt. It only ever grants permission: the write-time content checks still run and can still reject the file."
for width in 60 80 100 120; do
  # 3=Beats, 6=Hooks, 4=TOGGLE memory-approve, 0=back, 0=root, 0=quit->warn, 2=discard.
  #
  # The toggle is LOAD-BEARING for the overflow check, not incidental. _br_rtrim strips
  # trailing spaces, so a row whose pending column is empty gets trimmed back and a
  # too-wide layout hides. Staging one item fills the pending column on the hooks row AND
  # puts a rollup marker on the root row, which is the widest the layout ever gets - the
  # only state in which an overflow is actually observable.
  if _drive "text-w$width" 0 "$(_keys_text 3 6 4 0 0 0 2)" "$width"; then
    F="$OUT_PREFIX-text-w$width.txt"
    # THE REQUIREMENT: a user can READ what each hook does at this width. Flow-normalized,
    # because at the narrowest widths a description correctly wraps across lines.
    assert_in_flow "$F" "$LONGEST_DESC" "w$width: longest hook description readable in full"
    assert_in_flow "$F" "Auto-approves Write, Edit and MultiEdit into any .claude/memory directory, so saving a session note never stalls on a permission prompt. It only ever grants permission: the write-time content checks still run and can still reject the file." "w$width: memory-approve description readable"
    assert_in_flow "$F" "Counts the session notes written since your last review and suggests running one when the count passes REFLECT_THRESHOLD, default 15. The first run only records the timestamp, so a fresh machine is never nagged on day one." "w$width: reflect-nudge description readable"
    assert_in_flow "$F" "Checks the session-notes index at startup and acts on the result: a stale index is rebuilt on the spot rather than trusted, a corrupt one raises a loud warning. Silent when it is fresh, and it never fails the session start." "w$width: beats-staleness-guard description readable"
    assert_row_has "$F" "beats-rebuild" "always on" "w$width: pinned still reads always-on"
    # POSITIVE: a bare assert_not_in "rules, settin " passes vacuously if the tag never
    # rendered at all. At >=80 the root name column shrinks to fit "Design Tools" (12),
    # which leaves room for the whole bucket tag on one line.
    if [ "$width" -ge 80 ]; then
      assert_in "$F" "rules, settings, shell" "w$width: bucket tag renders in FULL (name column reclaimed)"
    fi
    # The regression this replaced: "rules, settings, shell" sheared to "rules, settin".
    assert_not_in "$F" "rules, settin " "w$width: bucket tag not sheared mid-word"
    # No rendered line may exceed the terminal. 60 is below the renderer's 60-col floor,
    # so it is the true worst case.
    # Prove the widest state was actually exercised (see the toggle note above).
    assert_re "$F" '(\+ install|- uninstall)' "w$width: pending column populated (widest layout exercised)"
    # Count DISPLAY COLUMNS, not bytes. awk's length() counts BYTES in this locale, and
    # the status glyphs (● ◐ ○) are 3-byte UTF-8 sequences that occupy ONE column each -
    # so a byte count reports every full-width row as ~2 columns over and invents an
    # overflow that is not there. (Measured: a correct 120-column row is 122 bytes.)
    overflow="$(python3 - "$F" "$width" <<'PYX'
import sys
w = int(sys.argv[2])
n = 0
for line in open(sys.argv[1]):
    if len(line.rstrip("\n")) > w:
        n += 1
print(n)
PYX
)"
    if [ "$overflow" = "0" ]; then
      pass "w$width: no line overflows $width columns"
    else
      fail "w$width: $overflow line(s) exceed $width columns ($F)"
    fi
  else
    fail "text-w$width: the driven run did not produce a fresh capture (see harness error above)"
  fi
done

# ============================================================
# Frame height - THE WHOLE FRAME MUST FIT THE TERMINAL
# ============================================================
# WHY THIS SECTION EXISTS, AND WHY THE 110 CHECKS ABOVE MISSED THE BUG IT COVERS.
#
# A shipped tear (root screen: "Up to date" twice, "Quit" twice, a stale cursor on a row
# the cursor was not on) went straight through this harness. Two independent blind spots
# let it, and BOTH had to be fixed or this section would be theatre:
#
#   1. BYTE-STREAM BLINDNESS. Every assertion above matches text in a pty CAPTURE. When
#      a frame is taller than the window, the emitted bytes are still individually
#      CORRECT - the tear is created by the TERMINAL reflowing them, and a capture file
#      has no screen, no cursor and no scrollback. There is no string to grep for. The
#      duplicate "Up to date" the user sees does not exist anywhere in the byte stream.
#   2. GEOMETRY. This harness drives at 130x60 (COLS/ROWS above). A 60-row window
#      absorbs a 28-row frame without scrolling, so even a screen model would have seen
#      nothing. The bug only exists at ~24 rows, which is the DEFAULT Terminal size.
#
# So the check cannot look at the pixels and cannot use the default geometry. It reads
# the renderer's own viewport ARITHMETIC (via BR_FRAME_LOG) at REAL terminal heights and
# asserts the frame fits. Height is the property that was wrong; height is what we test.
#
# NEGATIVE-CONTROLLED: restoring the old `height=$((rows+1)); cap 22` makes the fit
# assertions below go RED at 24 rows (Guardrails/verification 28 > 24, Beats/Hooks
# 28 > 24, Guardrails 26 > 24). An assertion that cannot fail proves nothing, so that
# was verified by hand rather than assumed.

# _drive_frames <name> <cols> <rows> <dwell> <keyscript> - like _drive, but at an
# ARBITRARY terminal height, with the renderer's frame arithmetic logged to a file, and
# ENDED BY A KILL rather than by quitting.
#
# The kill is deliberate. These runs need one thing - the frame log - and it is complete
# the moment the last screen renders. Quitting cleanly would mean steering the browser
# all the way back out to the root, and that is exactly what made an earlier cut of this
# flaky: keys are sent on a fixed schedule, gum LOSES anything typed before it enters raw
# mode, and every screen change restarts gum. Under load a single swallowed key left the
# browser parked one level from where it belonged, with nothing left to quit it - so the
# run sat until the 90s watchdog and reported a hang instead of a measurement. Six runs
# doing that is a ten-minute suite that proves nothing.
#
# So: drive, let it render, kill it. Reaching the screen IS the proof the run worked, and
# that is asserted directly (_frames_saw) rather than inferred from an exit code. A
# non-zero exit here carries no information and is not read as one.

# _frames_no_browser - leave NO browser process running, and PROVE it before returning.
#
# This is not hygiene, it is correctness. `script` and the browser are different
# processes: killing the pty leaves the browser ALIVE, still rendering, still appending
# to whatever BR_FRAME_LOG it was started with. A single `pkill` is fire-and-forget - it
# returns before the signal is delivered - so the next run could start while the last
# one's browser was still writing.
#
# That is not hypothetical. MEASURED: frames-beats-24's log contained Guardrails (a
# screen its OWN keystrokes cannot reach - the beats descent sends 9 downs and Guardrails
# is row 10) and its log was written SEVEN SECONDS after its own capture stopped. A log
# inconsistent with its own raw capture is an orphan writing into it, and the assertion
# was then reading another run's navigation.
_frames_no_browser() {
  local i
  for (( i = 0; i < 25; i++ )); do
    pkill -9 -f 'install.sh --browser' 2>/dev/null
    pgrep -f 'install.sh --browser' >/dev/null 2>&1 || return 0
    sleep 0.2
  done
  printf '%sharness: a browser process survived SIGKILL - refusing to run, its output would contaminate the next frame log%s\n' \
    "$RED" "$NC"
  return 1
}

_drive_frames() {
  local name="$1" cols="$2" rows="$3" dwell="$4" keyscript="$5"
  local raw="$OUT_PREFIX-$name.raw" log="$OUT_PREFIX-$name.frames"
  local spid

  # A clean slate is part of the freshness contract: an orphan from a previous run holds
  # an open handle to ITS log, but it also competes for the machine and it must not be
  # mistaken for this run's process later.
  _frames_no_browser || { HARNESS_ERR=1; return 2; }

  rm -f "$raw" "$log"
  # Do not trust rm's silence - asserting against a previous run's log is the same trap
  # _drive's nonce exists to close.
  if [ -e "$log" ]; then
    printf '%sharness: could not clear a previous frame log (%s) - refusing to run %s against a possibly stale file%s\n' \
      "$RED" "$log" "$name" "$NC"
    HARNESS_ERR=1
    return 2
  fi

  eval "$keyscript" | /usr/bin/script -q "$raw" /bin/bash -c "
    stty cols $cols rows $rows 2>/dev/null
    export TERM=xterm-256color
    export PATH='$GUM_DIR:$TEXT_PATH'
    export GIT_TERMINAL_PROMPT=0
    export GIT_SSH_COMMAND='ssh -o BatchMode=yes'
    export BR_LAUNCH_DWELL=0
    export BR_FRAME_LOG='$log'
    cd '$REPO_DIR'
    /bin/bash '$INSTALLER' --browser
  " >/dev/null 2>&1 &
  spid=$!

  sleep "$dwell"
  # The BROWSER first, and confirmed dead, THEN the pty. Reversing these is what let an
  # orphan outlive its own capture and keep writing frames (see _frames_no_browser).
  _frames_no_browser || { HARNESS_ERR=1; return 2; }
  # Braces + 2>/dev/null: bash announces a SIGKILLed background pipeline on ITS OWN
  # stderr ("Killed: 9 <the whole command>"), which dumps the pty invocation into the
  # middle of the results. The redirect is on the shell's report, not on the job.
  { kill -9 "$spid"; wait "$spid"; } 2>/dev/null

  # The log is its own freshness proof: nothing but THIS run's render_screen writes it.
  if [ ! -s "$log" ]; then
    printf '%sharness: frame run %s wrote no frame log - the gum renderer never ran, so nothing was measured%s\n' \
      "$RED" "$name" "$NC"
    HARNESS_ERR=1
    return 2
  fi
  return 0
}

# _frames_fit <log> <rows> <label> - no frame may be taller than the window.
_frames_fit() {
  local log="$1" rows="$2" label="$3" over
  over="$(awk -v r="$rows" '
    { t = -1
      for (i = 1; i <= NF; i++) { split($i, a, "="); if (a[1] == "total") t = a[2] + 0 }
      if (t > r) print "        " $0 }' "$log")"
  if [ -z "$over" ]; then
    pass "$label: every frame fits $rows rows"
  else
    fail "$label: frame(s) TALLER than the $rows-row window - the terminal scrolls, gum's screen model desyncs, and the top line orphans (the shipped tear):"
    printf '%s%s%s\n' "$RED" "$over" "$NC"
  fi
}

# _frames_run <name> <cols> <rows> <dwell> <keyscript> <nav>... - drive, and RETRY ONCE if
# the descent did not reach every screen it was aimed at.
#
# The retry is for the DRIVER, not the assertion. Steering gum is timing-based (keys are
# paced with sleeps because gum drops anything typed before it enters raw mode), and a
# loaded machine widens that window - measured on this box at load ~11, where a descent
# that passes at idle drops a keystroke and lands one screen short. What is under test is
# the frame HEIGHT; "did the keystroke arrive" is the harness's own plumbing, and
# retrying plumbing is legitimate where retrying an assertion would not be.
#
# It never converts a red into a green: if the second attempt also misses, the log still
# lacks the nav and _frames_saw still fails. Only the flake is absorbed.
_frames_run() {
  local name="$1" cols="$2" rows="$3" dwell="$4" keys="$5"
  shift 5
  local attempt nav ok
  for attempt in 1 2; do
    _drive_frames "$name" "$cols" "$rows" "$dwell" "$keys" || return 1
    ok=1
    for nav in "$@"; do
      grep -q "nav=$nav " "$OUT_PREFIX-$name.frames" || ok=0
    done
    if [ "$ok" = "1" ]; then return 0; fi
    if [ "$attempt" = "1" ]; then
      note "retry $name: the descent missed a screen (a keystroke was lost before gum entered raw mode)"
    fi
  done
  # Deliberately 0: the assertions below report exactly WHICH screen is missing, which is
  # a better message than a bare non-zero here.
  return 0
}

# _frames_saw <log> <nav> <label> - prove the screen was actually reached. Without this
# a broken key sequence would leave a log holding only the root screen, every fit check
# would pass, and the deep screens - the ones that actually overflowed - would go
# untested while the suite went green.
_frames_saw() {
  local log="$1" nav="$2" label="$3"
  if grep -q "nav=$nav " "$log"; then
    pass "$label: reached $nav (its height was measured)"
  else
    fail "$label: never reached $nav - that screen's height was NOT exercised, so the fit checks prove nothing for it"
  fi
}

printf '\n%sFrame height (the frame must fit the terminal, not just the row count)%s\n' "$YELLOW" "$NC"

# --- independent oracle for the header count ------------------------------------
# The fit checks below read `total`, which the renderer computes from BR_HDR_LINES -
# so renderer and oracle SHARE that term. A header measurement that undercounts would
# make both agree while the real terminal scrolled, and every check would pass. (Raised
# by the cross-model review of this change, and it is a fair hit.)
#
# So the shared term is pinned HERE, against hand-computed expectations, independently
# of any render: _br_display_rows is evaluated directly on known inputs. The real
# function is extracted from install.sh rather than copied - a copy would be a second
# implementation that can agree with itself while both are wrong.
#
# The trailing-blank case is the one that matters. The header ENDS in a blank line, and
# `$(...)` strips trailing newlines - so without _br_print_header's X sentinel this
# returns 1 where it must return 2, BR_HDR_LINES lands one short, and the frame silently
# overflows by a row. That is a real measured failure, not a hypothetical.
eval "$(sed -n '/^_br_display_rows() {/,/^}/p' "$INSTALLER")"
if ! type _br_display_rows >/dev/null 2>&1; then
  printf '%sharness: could not extract _br_display_rows from install.sh - the header oracle is unproven%s\n' "$RED" "$NC"
  HARNESS_ERR=1
else
  _rows_is() {
    local label="$1" text="$2" want="$3" got
    got="$(_br_display_rows "$text" 80)"
    if [ "$got" = "$want" ]; then
      pass "display_rows: $label -> $want"
    else
      fail "display_rows: $label -> got $got, want $want (BR_HDR_LINES is derived from this, so the frame budget would be off by $((want - got)) rows)"
    fi
  }
  _rows_is "single line, no trailing newline" $'a' 1
  _rows_is "single line" $'a\n' 1
  _rows_is "line + trailing BLANK line" $'a\n\n' 2
  _rows_is "one blank line" $'\n' 1
  _rows_is "two blank lines" $'\n\n' 2
  _rows_is "the header's shape (blank/text/text/blank)" $'\nampersand\nlead one\nlead two\n\n' 5
  # Width-dependence is the whole reason this is measured instead of hardcoded: the real
  # lead is 90 characters and wraps at 80.
  _rows_is "90 chars wraps to 2 rows at 80 cols" "$(python3 -c 'print("A"*90)')" 2
  _rows_is "exactly 80 chars stays 1 row (deferred wrap)" "$(python3 -c 'print("A"*80)')" 1
  _rows_is "81 chars is 2 rows" "$(python3 -c 'print("A"*81)')" 2
  # ANSI has bytes but no width; the header is colored throughout.
  _rows_is "ANSI escapes have zero display width" $'\033[2mampersand\033[0m\n' 1
fi

if [ -z "$GUM_BIN" ]; then
  printf '%sharness: gum not found - the gum viewport math cannot be measured, so the frame-height checks are unproven%s\n' "$RED" "$NC"
  HARNESS_ERR=1
else
  # Two direct descents rather than one Esc-heavy tour: feeding ESC immediately before an
  # arrow key is ambiguous (an arrow IS an ESC-prefixed sequence), so gum intermittently
  # swallowed the pair and the run silently ended up on the wrong screen. Descending and
  # letting stdin close is deterministic.
  _dn='\033[B'

  # A DESCENT ONLY - no keys to walk back out, because _drive_frames ends these runs with
  # a kill (see there for why).
  #
  # The gaps are measured, not padded. A key sent while gum is still starting is LOST
  # (the _drive note above says so for the launch dwell; it applies to EVERY screen
  # change, since each render spawns a fresh gum). An ENTER is always a screen
  # transition, and the screen it opens may be heavy - Guardrails recomputes counts for
  # 12 members - so an enter gets a wider gap than an arrow. At _keys_gum's uniform 0.55s
  # the enters were being swallowed and the runs landed on the wrong screen.
  _keys_frames() {
    local k gap
    printf 'sleep 3.5; '
    for k in "$@"; do
      if [ "$k" = '\r' ]; then gap=1.6; else gap=0.7; fi
      printf "printf '%%b' '%s'; sleep %s; " "$k" "$gap"
    done
    printf 'sleep 2.0'
  }

  # root -> Guardrails (row 10) -> verification (row 5). The deepest gum screens: 16 and
  # 20 rows against a 24-row window.
  _keys_deep="$(_keys_frames "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" '\r' \
                             "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" '\r')"
  # root -> Beats (row 3) -> Hooks (row 6). 18 rows.
  _keys_beats="$(_keys_frames "$_dn" "$_dn" "$_dn" '\r' \
                              "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" "$_dn" '\r')"

  # 24 is the default macOS Terminal, and the size the bug shipped at. 20 is tighter than
  # anything the old cap could have coped with. 30 confirms the budget GROWS with the
  # window instead of staying pinned to a hardcoded 22.
  # A run that hits the watchdog returns EARLY and LEAVES ITS LOG ON DISK - partially
  # written, from a browser that was killed mid-navigation. The cross-run checks below
  # must not read those: doing so is the same stale-capture trap _drive's nonce exists to
  # close, and it was live here for real (a hung sweep still "passed" the pagination
  # check off a dead run's leftovers). So track which runs actually succeeded and refuse
  # to conclude anything from the rest.
  # Dwells: the descent's own length plus a margin for the last screen to paint. The
  # deep descent is 16 keys (3.5 + 10*0.7 + 1.6 + 5*0.7 + 1.6 + 2.0 ~= 19s); the beats
  # descent is 10 (~13s).
  _DWELL_DEEP=24
  _DWELL_BEATS=18

  _deep_ok_24=0; _deep_ok_20=0; _deep_ok_30=0
  for _fh in 24 20 30; do
    if _frames_run "frames-deep-$_fh" 80 "$_fh" "$_DWELL_DEEP" "$_keys_deep" \
                   "Guardrails" "Guardrails/verification"; then
      _flog="$OUT_PREFIX-frames-deep-$_fh.frames"
      _frames_fit "$_flog" "$_fh" "h$_fh deep"
      _frames_saw "$_flog" "Guardrails" "h$_fh deep"
      _frames_saw "$_flog" "Guardrails/verification" "h$_fh deep"
      eval "_deep_ok_$_fh=1"
    else
      fail "h$_fh deep: the driven run produced no trustworthy frame log (see harness error above)"
    fi

    if _frames_run "frames-beats-$_fh" 80 "$_fh" "$_DWELL_BEATS" "$_keys_beats" \
                   "Beats/Hooks"; then
      _flog="$OUT_PREFIX-frames-beats-$_fh.frames"
      _frames_fit "$_flog" "$_fh" "h$_fh beats"
      _frames_saw "$_flog" "Beats/Hooks" "h$_fh beats"
    else
      fail "h$_fh beats: the driven run produced no trustworthy frame log (see harness error above)"
    fi
  done

  # The height must actually TRACK the window rather than being a constant that happens
  # to fit. A 30-row window must give the 20-row verification screen more list than a
  # 20-row window does, otherwise the "budget" is just a differently-spelled hardcode.
  _h20=""; _h30=""
  [ "$_deep_ok_20" = "1" ] && _h20="$(awk '/nav=Guardrails\/verification /{ for(i=1;i<=NF;i++){split($i,a,"="); if(a[1]=="height") print a[2]} }' "$OUT_PREFIX-frames-deep-20.frames" 2>/dev/null | head -1)"
  [ "$_deep_ok_30" = "1" ] && _h30="$(awk '/nav=Guardrails\/verification /{ for(i=1;i<=NF;i++){split($i,a,"="); if(a[1]=="height") print a[2]} }' "$OUT_PREFIX-frames-deep-30.frames" 2>/dev/null | head -1)"
  # Numeric, not merely non-empty: `[ x -gt y ]` on a non-numeric operand exits 2 with a
  # bash error, which reads as a harness crash rather than a clean fail.
  case "$_h20" in ''|*[!0-9]*) _h20="" ;; esac
  case "$_h30" in ''|*[!0-9]*) _h30="" ;; esac
  if [ -n "$_h20" ] && [ -n "$_h30" ]; then
    if [ "$_h30" -gt "$_h20" ]; then
      pass "viewport grows with the window (verification: height $_h20 at 20 rows -> $_h30 at 30 rows)"
    else
      fail "viewport does NOT grow with the window (verification: height $_h20 at 20 rows, $_h30 at 30 rows) - the height is ignoring the terminal"
    fi
  else
    fail "could not read the verification screen's height at both 20 and 30 rows - the growth check proved nothing"
  fi

  # rows > height is gum SCROLLING inside its viewport. That is the intended outcome of a
  # too-tall screen; if height ever equalled rows here, the screen would be overflowing
  # the window instead of paginating.
  _r=""; _h=""
  if [ "$_deep_ok_24" = "1" ]; then
    _r="$(awk '/nav=Guardrails\/verification /{ for(i=1;i<=NF;i++){split($i,a,"="); if(a[1]=="rows") print a[2]} }' "$OUT_PREFIX-frames-deep-24.frames" 2>/dev/null | head -1)"
    _h="$(awk '/nav=Guardrails\/verification /{ for(i=1;i<=NF;i++){split($i,a,"="); if(a[1]=="height") print a[2]} }' "$OUT_PREFIX-frames-deep-24.frames" 2>/dev/null | head -1)"
  fi
  case "$_r" in ''|*[!0-9]*) _r="" ;; esac
  case "$_h" in ''|*[!0-9]*) _h="" ;; esac
  if [ -z "$_r" ] || [ -z "$_h" ]; then
    fail "no trustworthy 24-row measurement of the verification screen - the pagination check proved nothing"
  elif [ "$_r" -gt "$_h" ]; then
    pass "deep screen scrolls INSIDE gum's viewport at 24 rows ($_r rows shown $_h at a time)"
  else
    fail "deep screen is not paginating at 24 rows (rows=$_r height=$_h) - a screen taller than the budget must scroll, not overflow"
  fi
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
