#!/usr/bin/env bash
# beats-staleness-guard.sh - SessionStart hook (stage 5 of the beats
# next-evolution plan) for the improv beats corpus.
#
# WHAT IT DOES
#   At session start it runs `beats.py verify` (fast, no network) under a short
#   timeout and reacts to the exit code:
#     0 (fresh)   -> silent (no context noise) - except while the beats parallel
#                    run is open (today <= BEATS_PARALLEL_RUN_END), when it emits
#                    a one-line reminder to exercise `beats.py search` beside the
#                    canonical beat reads so misses become benchmark cases
#                    (feedback_memory_first_zero_failure_execution.md steps 6-7).
#                    Auto-expires after the end date; cutover removes it.
#     6 (stale)   -> FAIL-CLOSED: compile SYNCHRONOUSLY now (bounded) and react to
#                    the result instead of trusting the stale index. Safety rules:
#                    a dirty index worktree is REFUSED (never auto-mutate tracked
#                    files); a single-compiler lock prevents two concurrent starts
#                    from compiling at once; the compile lands in a temp build dir
#                    and is atomically moved into place (never a half-written index);
#                    a failed/timed-out compile leaves the stale index in place and
#                    warns LOUDLY (do not trust it). See compile_on_drift().
#     4 (broken)  -> a LOUD context line: the retrieval index is broken; run
#                    `python3 beats/beats.py compile`. No auto-rebuild.
#     2/3         -> a LOUD one-liner (corpus missing / unreadable). No rebuild.
#     timeout/other -> silent + a logged note (never fail the session).
#
# HARD CONTRACT: this hook must NEVER fail the session start. Every path exits 0;
# internal errors are swallowed and noted in compile.log.
#
# ENV OVERRIDES (so tests never touch the real corpus/build)
#   BEATS_CORPUS          corpus dir     (default <repo>/.claude/memory)
#   BEATS_BUILD           build dir      (default <repo>/beats/.build)
#   BEATS_PY              beats.py path  (default <repo>/beats/beats.py)
#   BEATS_VERIFY_TIMEOUT  seconds        (default 15)
#   BEATS_COMPILE_TIMEOUT seconds        (default 90; bounds the fail-closed compile)
#   BEATS_COMPILE_CMD     compile cmd    (override the compile; tests inject a stub
#                                         or a forced failure)
#   BEATS_GUARD_FORCE_DIRTY 1|0          (force/skip the dirty-worktree refusal;
#                                         deterministic test seam / kill-switch)
#   BEATS_PARALLEL_RUN_END YYYY-MM-DD    (default 2026-07-16; a past date
#                                         disables the parallel-run reminder)
set -u

_realpath() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }
SELF="$(_realpath "$0")"
HOOK_DIR="$(cd "$(dirname "$SELF")" 2>/dev/null && pwd || printf '%s' "$(dirname "$SELF")")"
REPO_ROOT="$(cd "$HOOK_DIR/../.." 2>/dev/null && pwd || printf '%s' "$HOOK_DIR/../..")"

BEATS_PY="${BEATS_PY:-$REPO_ROOT/beats/beats.py}"
CORPUS_DIR="${BEATS_CORPUS:-$REPO_ROOT/.claude/memory}"
BUILD_DIR="${BEATS_BUILD:-$REPO_ROOT/beats/.build}"
LOG="$BUILD_DIR/compile.log"
# SHARED compile lock: this guard and beats-rebuild.sh acquire the SAME mkdir lock
# before compiling, so only ONE compiler ever mutates the live index (no cross-hook
# race). The name MUST match LOCK in beats-rebuild.sh.
COMPILE_LOCK="$BUILD_DIR/.compile.lock"
# beats-rebuild.sh + its pending-work marker: after our synchronous compile we hand any
# writes that were DEFERRED during it (they set .dirty but could not grab the shared lock)
# to the background rebuild, so they are not stranded. Paths MUST match beats-rebuild.sh.
REBUILD_HOOK="$HOOK_DIR/beats-rebuild.sh"
DIRTY_MARK="$BUILD_DIR/.dirty"
# Sanitize the timeout to a positive integer BEFORE it reaches arithmetic: under
# `set -u` a non-integer value would abort the script before the final exit 0,
# which would fail the session start (the one thing this guard must never do).
TIMEOUT_SECS="${BEATS_VERIFY_TIMEOUT:-15}"
TIMEOUT_MAX="${BEATS_VERIFY_TIMEOUT_MAX:-60}"
case "$TIMEOUT_MAX" in ''|*[!0-9]*) TIMEOUT_MAX=60 ;; esac
[ "$TIMEOUT_MAX" -gt 0 ] 2>/dev/null || TIMEOUT_MAX=60
case "$TIMEOUT_SECS" in
  ''|*[!0-9]*) TIMEOUT_SECS=15 ;;
esac
[ "$TIMEOUT_SECS" -gt 0 ] 2>/dev/null || TIMEOUT_SECS=15
# Clamp to a sane max so a huge value + a hung verify cannot block session start.
[ "$TIMEOUT_SECS" -gt "$TIMEOUT_MAX" ] && TIMEOUT_SECS="$TIMEOUT_MAX"

# Fail-closed compile-on-drift budget: bound the SYNCHRONOUS recompile so a slow or
# hung embedder can never block session start beyond this. Same sanitize+clamp
# discipline as the verify timeout above (set -u safe; never abort before exit 0).
COMPILE_TIMEOUT="${BEATS_COMPILE_TIMEOUT:-90}"
COMPILE_TIMEOUT_MAX="${BEATS_COMPILE_TIMEOUT_MAX:-300}"
case "$COMPILE_TIMEOUT_MAX" in ''|*[!0-9]*) COMPILE_TIMEOUT_MAX=300 ;; esac
[ "$COMPILE_TIMEOUT_MAX" -gt 0 ] 2>/dev/null || COMPILE_TIMEOUT_MAX=300
case "$COMPILE_TIMEOUT" in ''|*[!0-9]*) COMPILE_TIMEOUT=90 ;; esac
[ "$COMPILE_TIMEOUT" -gt 0 ] 2>/dev/null || COMPILE_TIMEOUT=90
[ "$COMPILE_TIMEOUT" -gt "$COMPILE_TIMEOUT_MAX" ] && COMPILE_TIMEOUT="$COMPILE_TIMEOUT_MAX"

# Parallel-run window (beats evolution cutover plan): while open, fresh sessions
# get a one-line search mandate instead of silence. Lexicographic compare is
# date-correct for YYYY-MM-DD; a malformed end value errs toward reminding,
# which is harmless. The whole check can never abort the guard (set -u safe).
PARALLEL_RUN_END="${BEATS_PARALLEL_RUN_END:-2026-07-16}"
parallel_run_active() {
  local today
  today="$(date +%Y-%m-%d 2>/dev/null)" || return 1
  [ -n "$today" ] || return 1
  [ ! "$today" \> "$PARALLEL_RUN_END" ]
}

log_note() { printf '%s beats-staleness-guard: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >> "$LOG" 2>/dev/null || true; }
emit_silent() { printf '{}\n'; }
emit_context() {
  python3 -c 'import json,sys; print(json.dumps({"additionalContext": sys.argv[1]}))' "$1" 2>/dev/null \
    || printf '{}\n'
}

# Run verify bounded by TIMEOUT_SECS. stderr -> $1. Returns verify's exit code,
# or 124 if the timeout fired (a pathological hang never blocks session start).
run_verify() {
  local errf="$1"
  python3 "$BEATS_PY" verify --quiet-provenance --corpus "$CORPUS_DIR" --build "$BUILD_DIR" >/dev/null 2>"$errf" &
  local pid=$!
  local max_ticks=$(( TIMEOUT_SECS * 5 )) ticks=0   # 0.2s ticks
  while kill -0 "$pid" 2>/dev/null; do
    sleep 0.2 2>/dev/null || sleep 1
    ticks=$((ticks + 1))
    if [ "$ticks" -ge "$max_ticks" ]; then
      kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; return 124
    fi
  done
  wait "$pid"; return $?
}

# --- fail-closed compile-on-drift helpers ------------------------------------

# True (0) when the guard must NOT auto-mutate the tracked index: an explicit
# override, or the tracked index artifacts have uncommitted changes. Scoped to the
# BUILD/index dir on purpose - the corpus itself is expected to carry uncommitted
# beats (that IS the drift we compile), so a whole-worktree check would wrongly
# refuse almost every session. When the index is gitignored (current default) git
# reports nothing here -> not dirty -> the compile proceeds. BEATS_GUARD_FORCE_DIRTY
# is the deterministic test seam / operator kill-switch.
worktree_dirty() {
  case "${BEATS_GUARD_FORCE_DIRTY:-}" in
    1|true|yes|on|TRUE|YES|ON)     return 0 ;;
    0|false|no|off|FALSE|NO|OFF|'') : ;;
  esac
  local top st
  top="$(git -C "$CORPUS_DIR" rev-parse --show-toplevel 2>/dev/null)" || return 1
  [ -n "$top" ] || return 1
  st="$(git -C "$top" status --porcelain -- "$BUILD_DIR" 2>/dev/null)" || return 1
  [ -n "$st" ]
}

# Compile into $1 (a temp build dir), bounded by COMPILE_TIMEOUT. Honors the
# BEATS_COMPILE_CMD override (tests inject a fast stub / a forced failure), else
# runs beats.py compile. Returns the compile exit code, or 124 if the timeout fired.
#
# The compile runs as the leader of a NEW process group (python os.setsid) with its
# stdout/stderr sent to /dev/null, NOT inherited from this hook. That buys two things:
#   - on timeout we kill the WHOLE group (kill -SIG -pgid), so a backgrounded
#     grandchild cannot outlive the budget - killing only the wrapper pid leaves
#     detached children running (the old bug);
#   - a slow/surviving child can never hold this SessionStart hook's stdout pipe open
#     and stall the session even after the guard has returned.
# python3 is guaranteed present (checked in main). setsid makes the wrapper its own
# group leader (pgid == pid), so `kill -- -pid` targets the whole group. The wrapper
# exits with the compile's own exit code, so it propagates through `wait`.
run_compile_bounded() {
  local out_build="$1" compile_cmd pid max_ticks ticks
  mkdir -p "$out_build" 2>/dev/null || true
  if [ -n "${BEATS_COMPILE_CMD:-}" ]; then
    compile_cmd="$BEATS_COMPILE_CMD"
  else
    compile_cmd="python3 \"$BEATS_PY\" compile --corpus \"$CORPUS_DIR\" --build \"$out_build\" >/dev/null 2>&1"
  fi
  BEATS_BUILD="$out_build" BEATS_CORPUS="$CORPUS_DIR" \
    python3 -c 'import os,subprocess,sys; os.setsid(); sys.exit(subprocess.call(["bash","-c",sys.argv[1]]))' \
    "$compile_cmd" >/dev/null 2>&1 &
  pid=$!
  max_ticks=$(( COMPILE_TIMEOUT * 5 )); ticks=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 0.2 2>/dev/null || sleep 1
    ticks=$((ticks + 1))
    if [ "$ticks" -ge "$max_ticks" ]; then
      kill -KILL -"$pid" 2>/dev/null || true   # kill the whole process group
      kill -KILL "$pid"  2>/dev/null || true   # fallback: the group leader itself
      wait "$pid" 2>/dev/null
      return 124
    fi
  done
  wait "$pid"; return $?
}

# Fail-closed reaction to a STALE index. Compiles NOW (bounded) and reacts to the
# RESULT; emits exactly one context line. Safety rules (all enforced here):
#   1. dirty worktree -> refuse; never auto-mutate tracked index files.
#   2. single-compiler lock (race-free mkdir, NO steal) -> a held lock fails CLOSED
#      (warn, do not trust stale), it does not wait or trust or steal.
#   3. temp build dir + atomic move-into-place -> never a half-written live index.
#   4. compile fail/timeout -> do NOT trust stale; warn loudly.
compile_on_drift() {
  local detail="$1" tmp_build crc
  mkdir -p "$BUILD_DIR" 2>/dev/null || true

  if worktree_dirty; then
    emit_context "beats index is STALE ($detail) but the index worktree has uncommitted changes - REFUSING to auto-recompile (an auto-compile would clobber tracked local work). Retrieval is unreliable until you run: python3 beats/beats.py compile"
    return 0
  fi

  # Single-compiler lock: a RACE-FREE mkdir, NO stealing. If we cannot get it, another
  # session is already compiling this stale index. We do NOT proceed trusting the stale
  # index and we do NOT steal the lock - a steal has a TOCTOU hole (two waiters both
  # judge it stale; one re-creates a fresh lock, the other's already-decided rm then
  # deletes that fresh lock -> two compilers). Instead we fail CLOSED with the same loud
  # warning as a compile failure. A lock left by a CRASHED compiler (SIGKILL before its
  # trap released it) will keep this warning firing EVERY session until a human runs
  # `beats.py compile` or removes the lock dir - the simplest correct, race-free
  # behavior. The lock path is named in the message so a human can clear it.
  if ! mkdir "$COMPILE_LOCK" 2>/dev/null; then
    emit_context "beats index is STALE ($detail) and is being refreshed by another session - retrieval is UNRELIABLE until that completes; do NOT trust it. If no compile is actually running (a crashed compile left the lock), run: python3 beats/beats.py compile  (or remove the lock dir: $COMPILE_LOCK)"
    return 0
  fi

  tmp_build="$BUILD_DIR/.guard-compile.$$"
  # Clean up the temp dir + lock even if the guard is signalled mid-compile.
  trap 'rm -rf "$tmp_build" 2>/dev/null || true; rmdir "$COMPILE_LOCK" 2>/dev/null || true' EXIT
  rm -rf "$tmp_build" 2>/dev/null || true
  mkdir -p "$tmp_build" 2>/dev/null || true
  # Seed the temp db so incremental vector reuse avoids a full re-embed.
  [ -f "$BUILD_DIR/beats.db" ] && cp "$BUILD_DIR/beats.db" "$tmp_build/beats.db" 2>/dev/null || true

  run_compile_bounded "$tmp_build"; crc=$?

  if [ "$crc" -eq 0 ] && [ -f "$tmp_build/beats.db" ] && [ -f "$tmp_build/beats.jsonl" ]; then
    # Install into the live build dir. POSIX cannot rename two files in one atomic op.
    # The DB move is the EFFECTIVE COMMIT POINT: every consumer (hybrid/lexical search
    # AND verify) keys off beats.db, so the index is "fresh" exactly when the db lands.
    # So the db is moved LAST - the worst interleaving (new jsonl + old db, from a crash
    # between the two moves) reads as STALE on the next verify and self-heals, never a
    # silent-fresh mismatch. A single-directory atomic rename of the whole index is NOT
    # used because the build dir also holds live state (compile.log, the lock dir) that a
    # wholesale dir swap would clobber; db-last is the accepted design. This mirrors
    # beats.py's own installer. We then PROVE the installed pair verifies before claiming
    # FRESH, so a mismatched/failed install can never be reported as a fresh index.
    if mv -f "$tmp_build/beats.jsonl" "$BUILD_DIR/beats.jsonl" 2>/dev/null \
       && mv -f "$tmp_build/beats.db" "$BUILD_DIR/beats.db" 2>/dev/null; then
      local verrf vrc
      verrf="$(mktemp 2>/dev/null || printf '%s/beats-guard.%s.verr' "${TMPDIR:-/tmp}" "$$")"
      run_verify "$verrf"; vrc=$?
      rm -f "$verrf" 2>/dev/null || true
      if [ "$vrc" -eq 0 ]; then
        emit_context "beats index was STALE ($detail) - auto-recompiled to a FRESH index this session."
      else
        log_note "compile-on-drift: post-install verify not fresh (rc=$vrc)"
        emit_context "beats index was STALE ($detail) - recompiled but the installed index did NOT verify fresh (verify exit $vrc); retrieval is unreliable this session, do not trust it. Run: python3 beats/beats.py compile"
      fi
    else
      log_note "compile-on-drift: install (atomic move) failed"
      emit_context "beats index is STALE ($detail) - a recompile succeeded but installing it FAILED; retrieval is unreliable this session. Run: python3 beats/beats.py compile"
    fi
  else
    log_note "compile-on-drift: compile failed (rc=$crc); stale index left in place, warning loudly"
    emit_context "beats index is STALE ($detail) and an auto-recompile FAILED (exit $crc) - retrieval is UNRELIABLE this session; do NOT trust it. Run: python3 beats/beats.py compile"
  fi

  rm -rf "$tmp_build" 2>/dev/null || true
  rmdir "$COMPILE_LOCK" 2>/dev/null || true
  trap - EXIT

  # Drain deferred work: a PostToolUse write that landed DURING our compile could not grab
  # the shared lock, so it set .dirty with NO runner (the guard, unlike a rebuild runner,
  # does not loop on .dirty). Now that the lock is released, hand it to the background
  # rebuild so it is not stranded until a future write/session. enqueue is idempotent and
  # non-blocking; if another compiler already re-grabbed the lock it drains .dirty itself.
  # Best-effort, never fails the session.
  if [ -f "$DIRTY_MARK" ] && [ -f "$REBUILD_HOOK" ]; then
    bash "$REBUILD_HOOK" --enqueue >/dev/null 2>&1 || true
  fi
  return 0
}

main() {
  # A missing beats.py or python3 means nothing to check -> stay silent.
  if [ ! -f "$BEATS_PY" ] || ! command -v python3 >/dev/null 2>&1; then
    emit_silent; return 0
  fi
  local errf rc detail
  errf="$(mktemp 2>/dev/null || printf '%s/beats-guard.%s.err' "${TMPDIR:-/tmp}" "$$")"
  run_verify "$errf"; rc=$?
  case "$rc" in
    0)
      if parallel_run_active; then
        emit_context "beats index fresh. PARALLEL RUN through $PARALLEL_RUN_END: for any recall/prior-work question, ALSO run python3 beats/beats.py search \"<question>\" beside the canonical beat reads, and record any miss as a benchmark case (zero-failure mandate steps 6-7)."
      else
        emit_silent
      fi ;;
    6)
      detail="$(grep -oE '[0-9]+ added, [0-9]+ removed, [0-9]+ changed' "$errf" 2>/dev/null | head -1)"
      [ -n "$detail" ] || detail="corpus changed"
      compile_on_drift "$detail" ;;
    4)
      emit_context "beats retrieval index is BROKEN (verify exit 4) - hybrid/lexical search is unreliable this session. Rebuild it: python3 beats/beats.py compile" ;;
    2)
      emit_context "beats corpus dir is MISSING (verify exit 2) - retrieval cannot be checked. Confirm .claude/memory exists, then run: python3 beats/beats.py compile" ;;
    3)
      emit_context "beats corpus has UNREADABLE file(s) (verify exit 3) - fix the file(s), then run: python3 beats/beats.py compile" ;;
    124)
      log_note "verify timed out after ${TIMEOUT_SECS}s; skipping staleness check this session"
      emit_silent ;;
    *)
      log_note "verify returned unexpected exit $rc; skipping staleness check this session"
      emit_silent ;;
  esac
  rm -f "$errf" 2>/dev/null || true
  return 0
}

main
exit 0
