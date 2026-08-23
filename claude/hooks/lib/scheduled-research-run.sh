#!/usr/bin/env bash
# scheduled-research-run.sh - the SHARED spine every scheduled learning-researcher
# reuses (the taste miner, the Claude Code feature-tracker, the cmux feature-tracker).
# It is a PARAMETERIZED generalization of claude/hooks/beats-reflect-weekly.sh: the same
# minimal-env launchd contract, the same perl-setpgrp wall-clock watchdog, the same
# fail-loud distinct exit codes, the same "advance the cursor ONLY on complete success"
# guarantee - with the job-specific ends (the source gate, the flow, the success test)
# handed in as parameters instead of hard-coded to /reflect.
#
# FULLY GATED, DISCOVER-AND-PROPOSE ONLY. This runner NEVER edits the repo. Its only
# writes are: its own log (~/.claude/logs), its cursor file, and a throwaway temp dir for
# the run markers. Everything that lands in the working tree is written by the headless
# flow it invokes (which stages inert proposals a human reviews). The runner cannot and
# does not promote, enforce, or apply anything.
#
# PATHS ARE NOT FORCED OUT OF THE REPO. The runner writes ONLY its log, its cursor, and a
# throwaway temp dir - but it does NOT rewrite SRR_CURSOR_FILE / SRR_LOG_FILE to live outside
# the working tree; it writes wherever they point. A job wrapper MUST therefore set
# SRR_CURSOR_FILE and SRR_LOG_FILE under $HOME/.claude (never inside the repo tree), so a
# scheduled, unattended run never dirties the checkout it is proposing against.
#
# HOW A JOB INSTANTIATES IT (thin wrapper pattern)
#   A per-job hook (e.g. claude/hooks/cc-tracker-daily.sh) is a THIN wrapper that exports
#   the SRR_* parameters and execs this lib. The launchd plist points at that wrapper (or
#   at this lib directly with the SRR_* vars set in EnvironmentVariables). Example:
#
#     export SRR_JOB_NAME="cc-tracker-daily"
#     export SRR_CURSOR_FILE="$HOME/.claude/.cc-tracker-last-seen-version"
#     export SRR_PRECHECK_CMD='v=$(curl -fsS https://registry.npmjs.org/@anthropic-ai/claude-code/latest | ...) || exit 2; \
#                              [ "$v" = "$(cat "$SRR_CURSOR_FILE" 2>/dev/null)" ] && echo skip || echo run'
#     export SRR_PROMPT="/cc-track"
#     export SRR_SUCCESS_CMD='find "$SRR_REPO_ROOT/claude/proposals/cc-tracker" -name "*.md" -newer "$SRR_START_MARKER" | grep -q .'
#     export SRR_ADVANCE_CMD='printf %s "$NEW_VERSION" > "$SRR_CURSOR_FILE"'   # optional
#     exec /bin/bash "$HOME/.claude/hooks/lib/scheduled-research-run.sh"
#
# PARAMETERS (all via the SRR_* environment - launchd sets env, wrappers export env)
#   REQUIRED
#     SRR_JOB_NAME     job identifier; names the log + run markers. [A-Za-z0-9._-] only.
#     SRR_CURSOR_FILE  the "last-seen" cursor. Touched (mtime advanced) on complete
#                      success; exported to every sub-command as $SRR_CURSOR_FILE.
#     SRR_PRECHECK_CMD (c) the has-new-signal gate. Run via `bash -c`; its STDOUT carries an
#                        explicit decision and it MUST exit 0. Contract:
#                          exit 0 + prints "run"  -> NEW signal, run the flow
#                          exit 0 + prints "skip" -> no new signal, clean skip (runner exits 0)
#                          ANY non-zero exit      -> the pre-check itself BROKE; the runner
#                                                    FAILS LOUD (exit 2), never a silent
#                                                    forever-skip.
#                        The decision is the LAST non-blank stdout line ("run"/"skip");
#                        diagnostics may precede it. exit 0 with NO run/skip decision is
#                        itself an error (exit 2) - an ambiguous gate is never read as a skip.
#                        A masked internal failure (e.g. a missing command inside a pipeline)
#                        MUST surface as a non-zero exit, so write the gate defensively: guard
#                        the fallible step (`... || exit 2`, `set -o pipefail`) so a broken
#                        gate can never masquerade as "skip" and no-op forever. The taste
#                        (find-newer count) and CC/cmux (version-diff) pre-checks follow this:
#                        they print run/skip on success and `|| exit 2` their fetch/find.
#     SRR_SUCCESS_CMD  (e) the success predicate, run via `bash -c` AFTER the flow with
#                      $SRR_START_MARKER exported. exit 0 => a fresh proposal artifact
#                      newer than the start marker exists (COMPLETE run); non-zero => the
#                      flow produced nothing => incomplete (runner dies 4, cursor untouched).
#     one of:
#     SRR_PROMPT       (d) the slash command / prompt; the runner builds the standard
#                      `claude -p "<prompt>" --permission-mode bypassPermissions --add-dir <repo>`.
#     SRR_FLOW_CMD     (d) full flow-command override run via `bash -c` (tests, or a job
#                      that needs a non-standard invocation). Takes precedence over SRR_PROMPT.
#   OPTIONAL
#     SRR_ADVANCE_CMD  extra cursor write-back run via `bash -c` on success BEFORE the
#                      touch (e.g. write the new version string into a content cursor). A
#                      failure here is fatal (6): the flow produced but the cursor could
#                      not advance. Omit for pure mtime cursors (find -newer jobs).
#     SRR_REPO_ROOT    repo root (cwd + --add-dir). Default: resolved from this file's path
#                      or known checkout locations.
#     SRR_EXTRA_ARGS   extra flags appended to the built claude invocation.
#     SRR_LOG_FILE     run log. Default ~/.claude/logs/<job>.log
#     SRR_TIMEOUT_SECS watchdog wall-clock kill after N seconds (default 1800).
#     SRR_POLL_SECS    watchdog poll interval (default 5).
#     SRR_GRACE_SECS   TERM->KILL grace on timeout (default 5).
#     CLAUDE_BIN       explicit claude binary (default: resolved).
#     DRY_RUN=1        run the gate (the pre-check DOES run - its own side effects and its
#                      log line are NOT suppressed), then, if the gate opens, print the flow
#                      command and exit 0 WITHOUT invoking the flow or advancing the cursor.
#                      Only the flow and the cursor advance are skipped, not the pre-check.
#
# FAIL-LOUD EXIT CODES (never a silent success; mirror beats-reflect-weekly)
#   0  complete success (flow produced + cursor advanced) OR clean skip (pre-check prints
#      "skip" and exits 0) OR a DRY_RUN preview
#   2  configuration / pre-check error: a missing or malformed required parameter, an
#      unresolvable repo root, a non-numeric watchdog knob, OR the pre-check exiting NON-ZERO
#      (a broken gate), OR the pre-check exiting 0 without a run/skip decision (ambiguous gate)
#   3  claude binary not found (a real run with SRR_PROMPT and no SRR_FLOW_CMD override)
#   4  the flow ran but did NOT complete: it exited non-zero, or the success predicate
#      found no fresh proposal artifact (cursor rolled back to its pre-run state, next retries)
#   5  the flow exceeded the watchdog timeout (cursor rolled back to its pre-run state)
#   6  the flow produced an artifact but the cursor could NOT be advanced - a failed
#      SRR_ADVANCE_CMD, an un-touchable cursor, or (before anything mutable runs) a cursor that
#      could not be snapshotted. Surfaced, never silently swallowed - a stuck cursor would make
#      the job re-run forever. On any of these the cursor is rolled back to its pre-run state.
#
# CURSOR-INTEGRITY GUARANTEE: the cursor is snapshotted BEFORE the flow and advances ONLY on a
# complete success. ANY other outcome (timeout, flow failure, no artifact, a failed/partial
# SRR_ADVANCE_CMD, or even a misbehaving flow that writes the cursor itself) rolls it back to
# the exact pre-run content+mtime (or to absent). Concurrency note: this assumes ONE instance
# of a given job runs at a time (launchd coalesces same-label runs); the runner does not lock,
# so do not run two instances of the same job against one cursor concurrently.
set -uo pipefail

# --- minimal-env resolution (launchd hands us an almost-empty environment) ----
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

_realpath() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }

# --- parameters (from the SRR_* environment) ----------------------------------
JOB_NAME="${SRR_JOB_NAME:-}"
CURSOR_FILE="${SRR_CURSOR_FILE:-}"
PRECHECK_CMD="${SRR_PRECHECK_CMD:-}"
SUCCESS_CMD="${SRR_SUCCESS_CMD:-}"
PROMPT="${SRR_PROMPT:-}"
FLOW_CMD="${SRR_FLOW_CMD:-}"
ADVANCE_CMD="${SRR_ADVANCE_CMD:-}"
EXTRA_ARGS="${SRR_EXTRA_ARGS:-}"
TIMEOUT_SECS="${SRR_TIMEOUT_SECS:-1800}"
POLL_SECS="${SRR_POLL_SECS:-5}"
GRACE_SECS="${SRR_GRACE_SECS:-5}"
LOG_MAX_LINES=500

# Log path needs the job name; fall back to a generic name for pre-validation errors so a
# config failure is still recorded somewhere rather than lost.
LOG_FILE="${SRR_LOG_FILE:-$HOME/.claude/logs/${JOB_NAME:-scheduled-research}.log}"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log_note() { printf '%s %s: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "${JOB_NAME:-scheduled-research}" "$*" >> "$LOG_FILE" 2>/dev/null || true; }

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
  printf '%s: FAIL(%s): %s\n' "${JOB_NAME:-scheduled-research}" "$1" "$2" >&2
  exit "$1"
}

# --- cursor snapshot / rollback (the "advance ONLY on complete success" guarantee) ----------
# The cursor is snapshotted BEFORE the flow. Advance survives ONLY on a complete success; ANY
# other outcome rolls the cursor back to its exact pre-run state (content+mtime), or to absent.
# This closes two holes: (1) a partial-writing SRR_ADVANCE_CMD that then fails, and (2) a
# misbehaving flow that writes the cursor itself and then fails/times out. The snapshot is not
# best-effort: it is verified (cmp), it falls back to a sibling of the cursor when the temp dir
# is unusable, and if a present cursor cannot be snapshotted anywhere the runner FAILS LOUD
# BEFORE anything mutable runs (so the cursor can never be left silently corrupted).
CUR_EXISTED=0
CUR_SNAP=""
snapshot_cursor() {
  if [ -e "$CURSOR_FILE" ]; then
    CUR_EXISTED=1
    CUR_SNAP="$(mktemp "${TMPDIR:-/tmp}/${JOB_NAME}.cursnap.XXXXXX" 2>/dev/null || true)"
    if [ -n "$CUR_SNAP" ] && cp -p "$CURSOR_FILE" "$CUR_SNAP" 2>/dev/null && cmp -s "$CURSOR_FILE" "$CUR_SNAP" 2>/dev/null; then
      return 0
    fi
    # temp dir unusable - drop any partial temp we created, then fall back to a sibling of the
    # cursor (same, writable filesystem). Never leave an intermediate snapshot file behind.
    [ -n "$CUR_SNAP" ] && rm -f "$CUR_SNAP" 2>/dev/null
    CUR_SNAP="${CURSOR_FILE}.srrsnap.$$"
    if cp -p "$CURSOR_FILE" "$CUR_SNAP" 2>/dev/null && cmp -s "$CURSOR_FILE" "$CUR_SNAP" 2>/dev/null; then
      return 0
    fi
    rm -f "$CUR_SNAP" 2>/dev/null
    CUR_SNAP=""
    die 6 "could not snapshot the cursor before the run; refusing to proceed so it cannot be left corrupted: $CURSOR_FILE"
  fi
  CUR_EXISTED=0
  CUR_SNAP=""
  return 0
}
discard_cursor_snapshot() {
  [ -n "$CUR_SNAP" ] && rm -f "$CUR_SNAP" 2>/dev/null
  CUR_SNAP=""
}
restore_cursor() { # roll the cursor back to its exact pre-run state (content+mtime), or absence
  if [ "$CUR_EXISTED" = "1" ]; then
    if [ -n "$CUR_SNAP" ] && [ -e "$CUR_SNAP" ]; then
      cp -p "$CUR_SNAP" "$CURSOR_FILE" 2>/dev/null || cp "$CUR_SNAP" "$CURSOR_FILE" 2>/dev/null
      touch -r "$CUR_SNAP" "$CURSOR_FILE" 2>/dev/null
      cmp -s "$CUR_SNAP" "$CURSOR_FILE" 2>/dev/null || log_note "WARN: cursor rollback could not be verified: $CURSOR_FILE"
    fi
  else
    rm -f "$CURSOR_FILE" 2>/dev/null
  fi
  discard_cursor_snapshot
}

# --- resolve the repo root (same strategy as the reflect runner) --------------
# The lib is COPIED to ~/.claude/hooks/lib by install.sh, so it cannot self-locate the
# repo in production - hence the SRR_REPO_ROOT env (set by the plist/wrapper) as primary.
resolve_default_repo_root() {
  local self repo cand
  self="$(_realpath "$0")"
  repo="$(cd "$(dirname "$self")/../../.." 2>/dev/null && pwd || true)"
  if [ -n "$repo" ] && [ -d "$repo/.claude/memory" ] && [ -f "$repo/claude/hooks/lib/scheduled-research-run.sh" ]; then
    printf '%s' "$repo"; return 0
  fi
  for cand in \
    "$HOME/Documents/Github/improv" \
    "$HOME/Documents/GitHub/improv" \
    "$HOME/improv" \
    "$HOME/code/improv" \
    "$HOME/dev/improv"
  do
    if [ -d "$cand/.claude/memory" ] && [ -f "$cand/claude/hooks/lib/scheduled-research-run.sh" ]; then
      printf '%s' "$cand"; return 0
    fi
  done
  return 1
}

if [ -n "${SRR_REPO_ROOT:-}" ]; then
  REPO_ROOT="$SRR_REPO_ROOT"
else
  REPO_ROOT="$(resolve_default_repo_root || true)"
fi

trim_log

# --- config validation (fail loud, distinct code 2) ---------------------------
_is_pos_int() { case "$1" in ''|*[!0-9]*) return 1 ;; *) [ "$1" -gt 0 ] ;; esac; }

case "$JOB_NAME" in
  '' ) die 2 "SRR_JOB_NAME is required" ;;
  *[!A-Za-z0-9._-]* ) die 2 "SRR_JOB_NAME must match [A-Za-z0-9._-] (got: $JOB_NAME)" ;;
esac
[ -n "$CURSOR_FILE" ]   || die 2 "SRR_CURSOR_FILE is required"
[ -n "$PRECHECK_CMD" ]  || die 2 "SRR_PRECHECK_CMD is required"
[ -n "$SUCCESS_CMD" ]   || die 2 "SRR_SUCCESS_CMD is required"
if [ -z "$FLOW_CMD" ] && [ -z "$PROMPT" ]; then
  die 2 "one of SRR_FLOW_CMD or SRR_PROMPT is required"
fi
_is_pos_int "$TIMEOUT_SECS" || die 2 "SRR_TIMEOUT_SECS must be a positive integer, got: $TIMEOUT_SECS"
_is_pos_int "$POLL_SECS"    || die 2 "SRR_POLL_SECS must be a positive integer, got: $POLL_SECS"
_is_pos_int "$GRACE_SECS"   || die 2 "SRR_GRACE_SECS must be a positive integer, got: $GRACE_SECS"
if [ -z "${REPO_ROOT:-}" ] || [ ! -d "$REPO_ROOT" ]; then
  die 2 "could not resolve a repo root (set SRR_REPO_ROOT); got: '${REPO_ROOT:-}'"
fi

# Export the resolved helper vars so every sub-command (pre-check, flow, success, advance)
# sees the same cursor path, repo root, and job name.
export SRR_JOB_NAME="$JOB_NAME"
export SRR_CURSOR_FILE="$CURSOR_FILE"
export SRR_REPO_ROOT="$REPO_ROOT"

# --- the has-new-signal gate (side one of the run contract) -------------------
# The pre-check owns ALL gating logic including the no-cursor first-run case; the runner is
# signal-agnostic. Its STDOUT carries the decision and it MUST exit 0: "run" => run the flow,
# "skip" => clean skip (exit 0). ANY non-zero exit means the pre-check itself broke - the
# runner FAILS LOUD (exit 2) rather than letting a masked failure (e.g. a missing command in
# a pipeline) masquerade as a skip and no-op forever. exit 0 with no run/skip decision is an
# error too: an ambiguous gate is never silently treated as a skip.
PC_OUT="$(bash -c "$PRECHECK_CMD" 2>>"$LOG_FILE")"; PC_RC=$?
if [ "$PC_RC" -ne 0 ]; then
  die 2 "pre-check FAILED (exit $PC_RC) - treated as an error, not a skip; a broken gate must never masquerade as a clean skip; cursor=$CURSOR_FILE"
fi
# The decision is the LAST non-blank stdout line (diagnostics may precede it).
PC_DECISION="$(printf '%s\n' "$PC_OUT" | grep -v '^[[:space:]]*$' | tail -n 1 | tr -d '[:space:]')"
case "$PC_DECISION" in
  run)
    log_note "run: pre-check decided 'run' (exit 0); repo=$REPO_ROOT cursor=$CURSOR_FILE"
    ;;
  skip)
    log_note "skip: pre-check decided 'skip' (exit 0); cursor=$CURSOR_FILE"
    exit 0
    ;;
  *)
    die 2 "pre-check exited 0 but printed no run/skip decision (stdout: '$PC_OUT') - an ambiguous gate is treated as an error, never a skip; cursor=$CURSOR_FILE"
    ;;
esac

# --- build the flow invocation ------------------------------------------------
CLAUDE_BIN="${CLAUDE_BIN:-}"
if [ -z "$CLAUDE_BIN" ]; then
  if [ -x "/opt/homebrew/bin/claude" ]; then
    CLAUDE_BIN="/opt/homebrew/bin/claude"
  else
    CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"
  fi
fi

if [ -n "$FLOW_CMD" ]; then
  CMD_PREVIEW="cd $REPO_ROOT && $FLOW_CMD"
else
  CMD_PREVIEW="cd $REPO_ROOT && $CLAUDE_BIN -p $PROMPT --permission-mode bypassPermissions --add-dir $REPO_ROOT ${EXTRA_ARGS:-}"
fi

# --- DRY_RUN: gate ran; print the flow command; NO side effects ---------------
if [ "${DRY_RUN:-}" = "1" ]; then
  log_note "DRY_RUN would run: $CMD_PREVIEW"
  printf 'DRY_RUN would run: %s\n' "$CMD_PREVIEW"
  exit 0
fi

# A built (non-override) invocation needs the claude binary.
if [ -z "$FLOW_CMD" ] && [ -z "$CLAUDE_BIN" ]; then
  die 3 "claude binary not found on PATH ($PATH)"
fi

# cd to the repo ONCE so the snapshot, flow, success predicate, advance, and cursor touch all
# resolve the cursor path from the same cwd. Then snapshot the cursor BEFORE anything mutable
# (and before the run temp dir exists) so any incomplete outcome - including a misbehaving flow
# that writes the cursor itself - rolls back to the exact pre-run state, and neither of these
# early die paths can orphan a temp dir.
cd "$REPO_ROOT" 2>/dev/null || die 2 "cannot cd to repo root: $REPO_ROOT"
snapshot_cursor

# --- run with a wall-clock watchdog (no timeout(1) on stock macOS) -------------
# Cloned verbatim from beats-reflect-weekly.sh: a marker file carries "did the watchdog
# fire" out of the backgrounded subshell; the child runs as a process-group leader (perl
# setpgrp) so the watchdog can TERM->grace->KILL the WHOLE group (claude spawns node +
# sub-agents that a bare child-kill would orphan).
RUN_TMP="$(mktemp -d "${TMPDIR:-/tmp}/${JOB_NAME}.XXXXXX" 2>/dev/null || echo "${TMPDIR:-/tmp}/${JOB_NAME}.$$")"
mkdir -p "$RUN_TMP" 2>/dev/null || true
START_MARKER="$RUN_TMP/start"
TIMEOUT_MARKER="$RUN_TMP/timedout"
touch "$START_MARKER" 2>/dev/null || true
export SRR_START_MARKER="$START_MARKER"

# Split SRR_EXTRA_ARGS into an array (bash 3.2 compatible). The ${arr[@]+...} guard keeps
# an EMPTY array from tripping `set -u`.
EXTRA_ARR=()
if [ -n "$EXTRA_ARGS" ]; then
  read -r -a EXTRA_ARR <<< "$EXTRA_ARGS"
fi

_HAVE_PERL=0
command -v perl >/dev/null 2>&1 && _HAVE_PERL=1

kill_target() { # $1=SIGNAL $2=PID - kill the whole group when launched as a group leader.
  local sig="$1" pid="$2"
  if [ "$_HAVE_PERL" = "1" ]; then
    kill "-$sig" "-$pid" 2>/dev/null || kill "-$sig" "$pid" 2>/dev/null || true
  else
    kill "-$sig" "$pid" 2>/dev/null || true
  fi
}

reap_group() { # $1=leader-PID - sweep any backgrounded stragglers left in the flow's process
  # group after the flow leader itself has exited (the NORMAL completion path; the watchdog
  # only cleans up on the TIMEOUT path, so a descendant that outlives an exit-0 leader would
  # otherwise be orphaned). Without perl the flow never became its own group leader, so its
  # "group" is the runner's own - signalling that would be suicide; skip entirely.
  local pid="$1" waited=0 max
  [ "$_HAVE_PERL" = "1" ] || return 0
  kill -TERM "-$pid" 2>/dev/null || true
  # poll every 0.2s up to GRACE_SECS, exiting early once the group empties; a TERM-ignoring
  # straggler is then force-killed (a single-pid kill could never reach it).
  max=$((GRACE_SECS * 5))
  while [ "$waited" -lt "$max" ]; do
    kill -0 "-$pid" 2>/dev/null || return 0   # group empty - nothing left to reap
    sleep 0.2
    waited=$((waited + 1))
  done
  kill -KILL "-$pid" 2>/dev/null || true
}

run_with_watchdog() {
  # $@ = the command to run; stdout+stderr appended to the log. With perl the command runs
  # as its own process-group leader (pgid == pid) so the watchdog can signal the group.
  if [ "$_HAVE_PERL" = "1" ]; then
    perl -e 'setpgrp 0,0; exec @ARGV or exit 127' -- "$@" >> "$LOG_FILE" 2>&1 &
  else
    "$@" >> "$LOG_FILE" 2>&1 &
  fi
  local pid=$!
  (
    _wd_waited=0
    while [ "$_wd_waited" -lt "$TIMEOUT_SECS" ]; do
      kill -0 "$pid" 2>/dev/null || exit 0   # child already exited cleanly
      sleep "$POLL_SECS"
      _wd_waited=$((_wd_waited + POLL_SECS))
    done
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
    # Watchdog fired and is mid TERM -> grace -> group-KILL. The group leader can die on
    # TERM and be reaped by the wait above BEFORE the KILL sweep runs; let the watchdog
    # finish its sweep so a TERM-ignoring descendant is still reached.
    wait "$watch" 2>/dev/null || true
  else
    # Normal completion: stop the (now-idle) watchdog, then sweep the flow's process group so
    # a backgrounded, TERM-ignoring descendant that outlived the exit-0 leader is reaped
    # BEFORE we decide success - the watchdog reaps only on the TIMEOUT path.
    kill -TERM "$watch" 2>/dev/null || true
    wait "$watch" 2>/dev/null || true
    reap_group "$pid"
  fi
  return "$rc"
}

log_note "flow start (timeout=${TIMEOUT_SECS}s)"
if [ -n "$FLOW_CMD" ]; then
  run_with_watchdog bash -c "$FLOW_CMD"
  RUN_RC=$?
else
  run_with_watchdog "$CLAUDE_BIN" -p "$PROMPT" \
    --permission-mode bypassPermissions \
    --add-dir "$REPO_ROOT" \
    ${EXTRA_ARR[@]+"${EXTRA_ARR[@]}"}
  RUN_RC=$?
fi
log_note "flow end (rc=$RUN_RC)"

# --- outcome: only a clean, COMPLETE run advances the cursor ------------------
# Precedence (identical to the reflect runner). On EVERY non-success outcome the cursor is
# rolled back to its exact pre-run state (see snapshot_cursor), so neither a partial advance
# NOR a misbehaving flow that wrote the cursor itself can leave it advanced:
#   1. watchdog fired          -> exit 5 (timed out)
#   2. flow exited non-zero     -> exit 4 (incomplete)
#   3. success predicate false  -> exit 4 (nothing produced)
#   4. SRR_ADVANCE_CMD failed   -> exit 6
#   5. cursor touch failed      -> exit 6
#   6. otherwise                -> advance survives; discard the snapshot; exit 0
TIMED_OUT=0
[ -f "$TIMEOUT_MARKER" ] && TIMED_OUT=1

if [ "$TIMED_OUT" = "1" ]; then
  rm -rf "$RUN_TMP" 2>/dev/null || true
  restore_cursor
  die 5 "flow timed out after ${TIMEOUT_SECS}s (rc=$RUN_RC); cursor left at its pre-run state"
fi
if [ "$RUN_RC" -ne 0 ]; then
  rm -rf "$RUN_TMP" 2>/dev/null || true
  restore_cursor
  die 4 "flow exited non-zero (rc=$RUN_RC); cursor left at its pre-run state"
fi

# Success predicate runs while START_MARKER still exists (it references $SRR_START_MARKER).
bash -c "$SUCCESS_CMD"; SUCCESS_RC=$?
rm -rf "$RUN_TMP" 2>/dev/null || true
if [ "$SUCCESS_RC" -ne 0 ]; then
  restore_cursor
  die 4 "flow exited 0 but the success predicate found no fresh proposal artifact (rc=$SUCCESS_RC); cursor left at its pre-run state"
fi

# Advance the cursor - optional content write-back first, then always touch the mtime. A FAILED
# advance rolls the cursor back to its pre-run snapshot (never a partial advance).
if [ -n "$ADVANCE_CMD" ]; then
  bash -c "$ADVANCE_CMD"; ADV_RC=$?
  if [ "$ADV_RC" -ne 0 ]; then
    restore_cursor
    die 6 "flow produced an artifact but SRR_ADVANCE_CMD failed (rc=$ADV_RC); cursor rolled back to its pre-run state - job will re-run"
  fi
fi
mkdir -p "$(dirname "$CURSOR_FILE")" 2>/dev/null || true
if touch "$CURSOR_FILE" 2>/dev/null; then
  discard_cursor_snapshot
  log_note "success: flow produced a fresh artifact; advanced cursor $CURSOR_FILE"
  exit 0
fi
restore_cursor
die 6 "flow produced an artifact but the cursor could not be touched: $CURSOR_FILE - cursor NOT advanced"
