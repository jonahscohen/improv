#!/usr/bin/env bash
# beats-rebuild.sh - PostToolUse(Write|Edit|MultiEdit) hook for the improv beats
# corpus (stage 4 of the beats next-evolution plan).
#
# WHAT IT DOES
#   When a Write/Edit/MultiEdit touches a beat under THIS repo's
#   .claude/memory/*.md, it kicks a DEBOUNCED, BACKGROUND `beats.py compile` so
#   the retrieval index stays fresh within the same session. Incremental vector
#   reuse (beats.py --reembed-all's inverse; the default path) makes a single-beat
#   recompile cost ~one embedding call instead of a full ~155s re-embed.
#
# HARD CONTRACTS
#   - NEVER blocks the session: the compile is detached (nohup + `&`); the hook
#     returns immediately.
#   - NEVER fails the session: every internal error is swallowed and the hook
#     exits 0. Failures surface through the existing safety net (search's STALE
#     warning, the stage-5 SessionStart guard, and compile.log).
#   - DEBOUNCE: a mkdir-based lock plus a `.dirty` marker. A burst of writes
#     within the settle window coalesces into ONE compile; a write that lands
#     mid-compile requeues exactly one more pass.
#   - Log rotation: compile.log is truncated when it grows past ~1MB.
#
# MODES
#   (no arg)        hook mode: read PostToolUse JSON on stdin, path-match, enqueue
#   --enqueue       just kick the debounced background compile (used by the
#                   stage-5 SessionStart staleness guard)
#   --run-compile   the detached background runner (spawned by enqueue)
#
# ENV OVERRIDES (so tests never touch the real corpus/build)
#   BEATS_CORPUS         corpus dir      (default <repo>/.claude/memory)
#   BEATS_BUILD          build dir       (default <repo>/beats/.build)
#   BEATS_PY             beats.py path   (default <repo>/beats/beats.py)
#   BEATS_COMPILE_CMD    override the compile command (tests inject a counter)
#   BEATS_DEBOUNCE_SECS  settle window seconds before the first compile (default 2)
set -u

# --- resolve paths independent of CWD (realpath through the hook symlink) -----
_realpath() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }
SELF="$(_realpath "$0")"
HOOK_DIR="$(cd "$(dirname "$SELF")" 2>/dev/null && pwd || printf '%s' "$(dirname "$SELF")")"
REPO_ROOT="$(cd "$HOOK_DIR/../.." 2>/dev/null && pwd || printf '%s' "$HOOK_DIR/../..")"

BEATS_PY="${BEATS_PY:-$REPO_ROOT/beats/beats.py}"
CORPUS_DIR="$(_realpath "${BEATS_CORPUS:-$REPO_ROOT/.claude/memory}")"
BUILD_DIR="${BEATS_BUILD:-$REPO_ROOT/beats/.build}"
LOG="$BUILD_DIR/compile.log"
LOCK="$BUILD_DIR/.lock"
DIRTY="$BUILD_DIR/.dirty"
DEBOUNCE_SECS="${BEATS_DEBOUNCE_SECS:-2}"
LOG_MAX_BYTES=1048576

log_note() { printf '%s beats-rebuild: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >> "$LOG" 2>/dev/null || true; }

# --- the detached background runner ------------------------------------------
run_compile_once() {
  # Log rotation guard: truncate an oversized log before appending.
  if [ -f "$LOG" ]; then
    local sz
    sz="$(wc -c < "$LOG" 2>/dev/null | tr -d ' ')"
    if [ -n "$sz" ] && [ "$sz" -gt "$LOG_MAX_BYTES" ]; then : > "$LOG" 2>/dev/null || true; fi
  fi
  if [ -n "${BEATS_COMPILE_CMD:-}" ]; then
    bash -c "$BEATS_COMPILE_CMD" >> "$LOG" 2>&1
  else
    python3 "$BEATS_PY" compile --corpus "$CORPUS_DIR" --build "$BUILD_DIR" >> "$LOG" 2>&1
  fi
}

run_compile_loop() {
  mkdir -p "$BUILD_DIR" 2>/dev/null || true
  # Settle window: coalesce a burst of rapid writes into a single compile.
  sleep "$DEBOUNCE_SECS" 2>/dev/null || true
  while : ; do
    rm -f "$DIRTY" 2>/dev/null || true      # consume the pending-work signal
    log_note "compile start"
    run_compile_once
    log_note "compile end"
    # A write that landed during the compile re-set DIRTY -> requeue one pass.
    if [ -f "$DIRTY" ]; then continue; fi
    rmdir "$LOCK" 2>/dev/null || true
    # Post-release recheck closes the race where a writer set DIRTY and failed to
    # grab the lock in the window between the dirty-check and the rmdir above.
    if [ -f "$DIRTY" ] && mkdir "$LOCK" 2>/dev/null; then continue; fi
    break
  done
}

# --- debounced enqueue (shared by the hook and the stage-5 guard) -------------
enqueue() {
  mkdir -p "$BUILD_DIR" 2>/dev/null || true
  touch "$DIRTY" 2>/dev/null || true         # mark work pending BEFORE the lock
  if mkdir "$LOCK" 2>/dev/null; then
    # We own the lock -> spawn the detached runner. nohup + `&` + fd redirection
    # fully detaches so the hook returns immediately and never blocks the session.
    nohup bash "$SELF" --run-compile >/dev/null 2>&1 &
  fi
  # else: a runner is already active; DIRTY is set and its post-release recheck
  # picks up this write. Nothing more to do.
  return 0
}

# --- hook mode: read stdin JSON, path-match, enqueue --------------------------
hook_main() {
  local input file_path norm
  input="$(cat 2>/dev/null || true)"
  file_path="$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("file_path", ""))
except Exception:
    pass
' 2>/dev/null || true)"
  [ -n "$file_path" ] || return 0
  norm="$(_realpath "$file_path")"
  # A *.md DIRECTLY under THIS repo's corpus dir - matching beats.py compile's
  # flat glob("*.md"). A nested subdir .md (which compile never indexes) is
  # ignored, so the hook never triggers on a non-corpus path.
  case "$norm" in
    "$CORPUS_DIR"/*.md)
      local rel="${norm#"$CORPUS_DIR"/}"
      case "$rel" in
        */*) : ;;        # nested subdir -> not a top-level corpus beat
        *)   enqueue ;;
      esac ;;
    *) : ;;
  esac
  return 0
}

# Everything is wrapped so no internal failure can ever fail the session start /
# tool call: the outer dispatch always exits 0.
case "${1:-}" in
  --run-compile) run_compile_loop ;;
  --enqueue)     enqueue ;;
  *)             hook_main ;;
esac
exit 0
