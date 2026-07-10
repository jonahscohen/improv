#!/usr/bin/env bash
# beats-reflect-weekly.sh - scheduled entrypoint that re-activates the dormant
# `reflect` skill as an unattended weekly routine (stage 3 of the beats
# next-evolution roadmap: proposal_beats_next_evolution.md, "Continuous
# reflection as a scheduled routine" - schedule the EXISTING skill, zero new
# analysis architecture).
#
# WHAT IT DOES
#   Once a week (driven by com.yesand.beats-reflect-weekly.plist), this script:
#     1. Counts beats newer than ~/.claude/last-reflect-timestamp EXACTLY the
#        way reflect-nudge.sh counts them (same find + same MEMORY.md exclusion).
#     2. If that count is below REFLECT_THRESHOLD (default 15) it logs a skip and
#        exits 0 - a quiet week must never burn a 6-agent reflect run.
#     3. If at/above threshold it runs the reflect skill headlessly via
#        `claude -p "/reflect"` with cwd = the beats repo root.
#     4. On success (a new reflection_*.md appeared in the corpus) it touches
#        ~/.claude/last-reflect-timestamp so the SessionStart nudge resets. This
#        is the second half of the no-double-fire contract: the scheduled run and
#        the interactive nudge share ONE timestamp, so whichever fires first
#        resets the counter and the other stays quiet.
#     5. On failure it does NOT touch the timestamp and logs loudly, so the next
#        scheduled pass retries and the nudge still fires interactively.
#
# NO-DOUBLE-FIRE CONTRACT (two sides, one timestamp)
#   - reflect-nudge.sh (SessionStart) counts beats newer than the timestamp and
#     nudges when count >= REFLECT_THRESHOLD.
#   - THIS script gates on the SAME count + threshold and only runs when the
#     nudge would also have fired, then resets the SAME timestamp on success.
#   Result: a successful scheduled run silences the interactive nudge until the
#   corpus accrues another THRESHOLD beats, and vice versa.
#
# FAIL-LOUD EXIT CODES (never a silent success)
#   0  success (complete run + timestamp reset) OR clean skip (below threshold)
#      OR a DRY_RUN preview
#   2  configuration error (repo root / memory dir unresolvable, or a non-numeric
#      REFLECT_THRESHOLD / BEATS_REFLECT_TIMEOUT_SECS / BEATS_REFLECT_POLL_SECS /
#      BEATS_REFLECT_GRACE_SECS)
#   3  claude binary not found on the resolved PATH
#   4  reflect ran but did not complete: exited non-zero, or produced no new
#      reflection_*.md (timestamp left untouched)
#   5  reflect run exceeded the watchdog timeout (timestamp left untouched)
#   6  a reflection was produced but the timestamp could not be written - the
#      no-double-fire reset did NOT happen (surfaced, never silently swallowed)
#
# ENV OVERRIDES (production + testability)
#   REFLECT_THRESHOLD          min new beats to run          (default 15)
#   TIMESTAMP_FILE             the shared reflect timestamp  (default ~/.claude/last-reflect-timestamp)
#   MEMORY_DIR                 the beats corpus dir          (default <repo>/.claude/memory)
#   BEATS_REPO_ROOT            repo root (cwd for the run)   (default: resolved; see below)
#   LOG_FILE                   run log                       (default ~/.claude/logs/beats-reflect-weekly.log)
#   DRY_RUN=1                  do everything EXCEPT invoke claude; print the command
#   BEATS_REFLECT_CMD          replace the claude invocation with this command (tests)
#   BEATS_REFLECT_TIMEOUT_SECS watchdog kill after N seconds (default 1800)
#   BEATS_REFLECT_POLL_SECS    watchdog poll interval        (default 5)
#   BEATS_REFLECT_GRACE_SECS   TERM->KILL grace on timeout   (default 5)
#   BEATS_REFLECT_EXTRA_ARGS   extra flags appended to the claude invocation
#                              (the lead's tuning knob for the first live run,
#                               e.g. "--model <newest> --verbose")
#   CLAUDE_BIN                 explicit claude binary path   (default: resolved)
set -uo pipefail

# --- minimal-env resolution (launchd hands us an almost-empty environment) ----
# Set an explicit PATH so node + claude + coreutils resolve. brew installs both
# claude and node under /opt/homebrew/bin; keep the standard system dirs too.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

_realpath() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }

# --- config / defaults --------------------------------------------------------
THRESHOLD="${REFLECT_THRESHOLD:-15}"
TIMESTAMP_FILE="${TIMESTAMP_FILE:-$HOME/.claude/last-reflect-timestamp}"
LOG_FILE="${LOG_FILE:-$HOME/.claude/logs/beats-reflect-weekly.log}"
TIMEOUT_SECS="${BEATS_REFLECT_TIMEOUT_SECS:-1800}"
POLL_SECS="${BEATS_REFLECT_POLL_SECS:-5}"
GRACE_SECS="${BEATS_REFLECT_GRACE_SECS:-5}"
LOG_MAX_LINES=500

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log_note() { printf '%s beats-reflect-weekly: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >> "$LOG_FILE" 2>/dev/null || true; }

trim_log() {
  [ -f "$LOG_FILE" ] || return 0
  local lines
  lines="$(wc -l < "$LOG_FILE" 2>/dev/null | tr -d ' ')"
  if [ -n "$lines" ] && [ "$lines" -gt "$LOG_MAX_LINES" ]; then
    tail -n "$LOG_MAX_LINES" "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && mv "$LOG_FILE.tmp" "$LOG_FILE" 2>/dev/null || true
  fi
}

die() { # $1=exit-code, $2=message
  log_note "FAIL($1): $2"
  exit "$1"
}

# --- resolve the repo root robustly -------------------------------------------
# The script is COPIED into ~/.claude/hooks by install.sh (not symlinked), so it
# cannot find the repo from its own path in production. Resolution order:
#   1. BEATS_REPO_ROOT env (the plist sets this; tests set this).
#   2. Derive from an explicit MEMORY_DIR env (repo = two levels up).
#   3. Self-path if this file happens to be symlinked into the repo (future-proof).
#   4. Known dotfiles-checkout locations, verified by a marker file.
resolve_default_repo_root() {
  local self repo cand
  self="$(_realpath "$0")"
  repo="$(cd "$(dirname "$self")/../.." 2>/dev/null && pwd || true)"
  if [ -n "$repo" ] && [ -d "$repo/.claude/memory" ] && [ -f "$repo/claude/hooks/beats-reflect-weekly.sh" ]; then
    printf '%s' "$repo"; return 0
  fi
  for cand in \
    "$HOME/Documents/Github/improv" \
    "$HOME/Documents/GitHub/improv" \
    "$HOME/improv" \
    "$HOME/code/improv" \
    "$HOME/dev/improv"
  do
    if [ -d "$cand/.claude/memory" ] && [ -f "$cand/claude/hooks/beats-reflect-weekly.sh" ]; then
      printf '%s' "$cand"; return 0
    fi
  done
  return 1
}

if [ -n "${BEATS_REPO_ROOT:-}" ]; then
  REPO_ROOT="$BEATS_REPO_ROOT"
elif [ -n "${MEMORY_DIR:-}" ]; then
  REPO_ROOT="$(dirname "$(dirname "$MEMORY_DIR")")"
else
  REPO_ROOT="$(resolve_default_repo_root || true)"
fi

MEMORY_DIR="${MEMORY_DIR:-$REPO_ROOT/.claude/memory}"

trim_log

# --- config validation (fail loud, distinct code) -----------------------------
if [ -z "${REPO_ROOT:-}" ]; then
  die 2 "could not resolve the beats repo root (set BEATS_REPO_ROOT or MEMORY_DIR)"
fi
if [ ! -d "$MEMORY_DIR" ]; then
  die 2 "memory dir does not exist: $MEMORY_DIR"
fi

# Numeric env vars must be positive integers - a bad value under launchd must
# fail as a config error, never silently change gating or watchdog behaviour.
_is_pos_int() { case "$1" in ''|*[!0-9]*) return 1 ;; *) [ "$1" -gt 0 ] ;; esac; }
_is_nonneg_int() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }
_is_nonneg_int "$THRESHOLD"    || die 2 "REFLECT_THRESHOLD must be a non-negative integer, got: $THRESHOLD"
_is_pos_int    "$TIMEOUT_SECS" || die 2 "BEATS_REFLECT_TIMEOUT_SECS must be a positive integer, got: $TIMEOUT_SECS"
_is_pos_int    "$POLL_SECS"    || die 2 "BEATS_REFLECT_POLL_SECS must be a positive integer, got: $POLL_SECS"
_is_pos_int    "$GRACE_SECS"   || die 2 "BEATS_REFLECT_GRACE_SECS must be a positive integer, got: $GRACE_SECS"

# --- threshold gate (side one of the no-double-fire contract) -----------------
# First run with no timestamp: mirror reflect-nudge.sh - create it and skip.
# A touch that silently failed here would desync the two sides of the contract,
# so the write is checked and a failure is fatal (not best-effort).
if [ ! -f "$TIMESTAMP_FILE" ]; then
  mkdir -p "$(dirname "$TIMESTAMP_FILE")" 2>/dev/null || true
  if touch "$TIMESTAMP_FILE" 2>/dev/null; then
    log_note "skip: no timestamp file at $TIMESTAMP_FILE - created it, no reflection this pass"
    exit 0
  fi
  die 6 "no timestamp file and could not create it: $TIMESTAMP_FILE"
fi

# Count beats newer than the last reflection EXACTLY as reflect-nudge.sh does:
# flat *.md under the corpus, newer than the timestamp, excluding only MEMORY.md.
NEW_COUNT="$(find "$MEMORY_DIR" -name '*.md' -newer "$TIMESTAMP_FILE" ! -name 'MEMORY.md' 2>/dev/null | wc -l | tr -d ' ')"
NEW_COUNT="${NEW_COUNT:-0}"

if [ "$NEW_COUNT" -lt "$THRESHOLD" ]; then
  log_note "skip: $NEW_COUNT below threshold $THRESHOLD (corpus=$MEMORY_DIR)"
  exit 0
fi

log_note "run: $NEW_COUNT at/above threshold $THRESHOLD - invoking reflect (repo=$REPO_ROOT)"

# --- build the reflect invocation ---------------------------------------------
CLAUDE_BIN="${CLAUDE_BIN:-}"
if [ -z "$CLAUDE_BIN" ]; then
  if [ -x "/opt/homebrew/bin/claude" ]; then
    CLAUDE_BIN="/opt/homebrew/bin/claude"
  else
    CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"
  fi
fi

# Human-readable preview of the command (used by DRY_RUN and the log).
# Flags chosen (justified in claude/docs/beats-scheduled-reflect.md):
#   -p "/reflect"                 : print/non-interactive; invokes the reflect skill.
#   --permission-mode bypassPermissions : unattended - no human to approve the
#                                   skill's agent spawns, file writes, or bash touch.
#   --add-dir "$REPO_ROOT"        : belt-and-suspenders tool access to the corpus
#                                   under launchd (cwd is already the repo root).
# No --max-turns (not a flag in this claude build; the print run self-terminates);
# no --model (inherit the newest configured default; never pin a version).
CMD_PREVIEW="cd $REPO_ROOT && $CLAUDE_BIN -p /reflect --permission-mode bypassPermissions --add-dir $REPO_ROOT ${BEATS_REFLECT_EXTRA_ARGS:-}"

# --- DRY_RUN: everything except the actual invocation --------------------------
if [ "${DRY_RUN:-}" = "1" ]; then
  log_note "DRY_RUN would run: $CMD_PREVIEW"
  printf 'DRY_RUN would run: %s\n' "$CMD_PREVIEW"
  exit 0
fi

# claude is required for a real run (a test injecting BEATS_REFLECT_CMD skips it).
if [ -z "${BEATS_REFLECT_CMD:-}" ] && [ -z "$CLAUDE_BIN" ]; then
  die 3 "claude binary not found on PATH ($PATH)"
fi

# --- run with a wall-clock watchdog (no timeout(1) on stock macOS) -------------
# A marker file carries "did the watchdog fire" out of the backgrounded subshell.
RUN_TMP="$(mktemp -d "${TMPDIR:-/tmp}/beats-reflect.XXXXXX" 2>/dev/null || echo "${TMPDIR:-/tmp}/beats-reflect.$$")"
mkdir -p "$RUN_TMP" 2>/dev/null || true
START_MARKER="$RUN_TMP/start"
TIMEOUT_MARKER="$RUN_TMP/timedout"
touch "$START_MARKER" 2>/dev/null || true

# Split BEATS_REFLECT_EXTRA_ARGS into an array (bash 3.2 compatible). The
# ${arr[@]+...} guard below keeps an EMPTY array from tripping `set -u`.
EXTRA_ARR=()
if [ -n "${BEATS_REFLECT_EXTRA_ARGS:-}" ]; then
  read -r -a EXTRA_ARR <<< "$BEATS_REFLECT_EXTRA_ARGS"
fi

# Is perl available to make the child a process-group leader? (macOS ships it.)
_HAVE_PERL=0
command -v perl >/dev/null 2>&1 && _HAVE_PERL=1

# kill_target SIGNAL PID: kill the child's whole process GROUP when we launched it
# as a group leader (perl setpgrp), else fall back to the single PID. Killing the
# group bounds descendants (claude spawns node + sub-agents) that a bare child
# kill would orphan.
kill_target() {
  local sig="$1" pid="$2"
  if [ "$_HAVE_PERL" = "1" ]; then
    kill "-$sig" "-$pid" 2>/dev/null || kill "-$sig" "$pid" 2>/dev/null || true
  else
    kill "-$sig" "$pid" 2>/dev/null || true
  fi
}

run_with_watchdog() {
  # $@ = the command to run; its stdout+stderr are appended to the log. When perl
  # is present the command runs as its own process-group leader (pgid == pid) so
  # the watchdog can signal the whole group.
  if [ "$_HAVE_PERL" = "1" ]; then
    perl -e 'setpgrp 0,0; exec @ARGV or exit 127' -- "$@" >> "$LOG_FILE" 2>&1 &
  else
    "$@" >> "$LOG_FILE" 2>&1 &
  fi
  local pid=$!
  (
    # Poll instead of one long sleep so a fast run is not held open. Plain vars
    # (not `local`) inside this subshell for bash 3.2 safety.
    _wd_waited=0
    while [ "$_wd_waited" -lt "$TIMEOUT_SECS" ]; do
      kill -0 "$pid" 2>/dev/null || exit 0   # child already exited cleanly
      sleep "$POLL_SECS"
      _wd_waited=$((_wd_waited + POLL_SECS))
    done
    # Only reached after the full timeout, i.e. the child is genuinely still
    # running. The parent reaps a normally-finished child and TERMs this watchdog
    # before this block runs, so a reaped/reused PID is not signalled here.
    if kill -0 "$pid" 2>/dev/null; then
      touch "$TIMEOUT_MARKER" 2>/dev/null || true
      kill_target TERM "$pid"
      sleep "$GRACE_SECS"
      kill_target KILL "$pid"
    fi
  ) &
  local watch=$!
  wait "$pid" 2>/dev/null
  local rc=$?
  if [ -f "$TIMEOUT_MARKER" ]; then
    # Watchdog fired and is mid TERM -> grace -> group-KILL. The group LEADER can
    # die on TERM and be reaped by the wait above BEFORE the watchdog's KILL
    # sweep runs; tearing the watchdog down here would orphan a TERM-ignoring
    # descendant that keeps mutating the corpus. So let the watchdog finish its
    # own sweep (the TIMEOUT_MARKER is written before TERM is sent, so it is
    # reliably visible here).
    wait "$watch" 2>/dev/null || true
  else
    # Clean completion: stop the otherwise-idle watchdog.
    kill -TERM "$watch" 2>/dev/null || true
    wait "$watch" 2>/dev/null || true
  fi
  return "$rc"
}

log_note "reflect start (timeout=${TIMEOUT_SECS}s)"
if [ -n "${BEATS_REFLECT_CMD:-}" ]; then
  # Test / override path: run the injected command in place of claude.
  run_with_watchdog bash -c "$BEATS_REFLECT_CMD"
  RUN_RC=$?
else
  # Production path: cwd = repo root so /reflect resolves this project's corpus.
  # Absolute MEMORY_DIR/TIMESTAMP_FILE/LOG_FILE mean the cd is harmless afterward.
  cd "$REPO_ROOT" 2>/dev/null || die 2 "cannot cd to repo root: $REPO_ROOT"
  run_with_watchdog "$CLAUDE_BIN" -p "/reflect" \
    --permission-mode bypassPermissions \
    --add-dir "$REPO_ROOT" \
    ${EXTRA_ARR[@]+"${EXTRA_ARR[@]}"}
  RUN_RC=$?
fi
log_note "reflect end (rc=$RUN_RC)"

# --- outcome: only a clean, COMPLETE run resets the timestamp -----------------
# Order matters. A partial reflection_*.md written just before a hang or a
# non-zero exit is NOT success: the skill may not have finished the MEMORY.md
# update / timestamp touch / cleanup, so we must retry next pass and keep the
# interactive nudge live. Precedence:
#   1. watchdog fired         -> exit 5 (timed out), even if a partial file exists
#   2. run exited non-zero    -> exit 4 (incomplete)
#   3. no new reflection_*.md -> exit 4 (nothing produced)
#   4. otherwise              -> reset the timestamp; a FAILED reset is fatal (6)
PRODUCED="$(find "$MEMORY_DIR" -name 'reflection_*.md' -newer "$START_MARKER" 2>/dev/null | head -n 1)"
TIMED_OUT=0
[ -f "$TIMEOUT_MARKER" ] && TIMED_OUT=1
rm -rf "$RUN_TMP" 2>/dev/null || true

if [ "$TIMED_OUT" = "1" ]; then
  die 5 "reflect timed out after ${TIMEOUT_SECS}s (rc=$RUN_RC, produced='${PRODUCED:-none}'); timestamp untouched"
fi
if [ "$RUN_RC" -ne 0 ]; then
  die 4 "reflect exited non-zero (rc=$RUN_RC, produced='${PRODUCED:-none}'); timestamp untouched"
fi
if [ -z "$PRODUCED" ]; then
  die 4 "reflect exited 0 but produced no new reflection_*.md; timestamp untouched"
fi

mkdir -p "$(dirname "$TIMESTAMP_FILE")" 2>/dev/null || true
if touch "$TIMESTAMP_FILE" 2>/dev/null; then
  log_note "success: produced $(basename "$PRODUCED") (rc=$RUN_RC); reset $TIMESTAMP_FILE"
  exit 0
fi
die 6 "produced $(basename "$PRODUCED") but FAILED to reset $TIMESTAMP_FILE - the nudge may double-fire"
