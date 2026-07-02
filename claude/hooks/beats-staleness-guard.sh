#!/usr/bin/env bash
# beats-staleness-guard.sh - SessionStart hook (stage 5 of the beats
# next-evolution plan) for the improv beats corpus.
#
# WHAT IT DOES
#   At session start it runs `beats.py verify` (fast, no network) under a short
#   timeout and reacts to the exit code:
#     0 (fresh)   -> silent (no context noise).
#     6 (stale)   -> one context line + kick the SAME debounced background compile
#                    as the stage-4 rebuild hook (beats-rebuild.sh --enqueue).
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
set -u

_realpath() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }
SELF="$(_realpath "$0")"
HOOK_DIR="$(cd "$(dirname "$SELF")" 2>/dev/null && pwd || printf '%s' "$(dirname "$SELF")")"
REPO_ROOT="$(cd "$HOOK_DIR/../.." 2>/dev/null && pwd || printf '%s' "$HOOK_DIR/../..")"

BEATS_PY="${BEATS_PY:-$REPO_ROOT/beats/beats.py}"
CORPUS_DIR="${BEATS_CORPUS:-$REPO_ROOT/.claude/memory}"
BUILD_DIR="${BEATS_BUILD:-$REPO_ROOT/beats/.build}"
REBUILD_HOOK="$HOOK_DIR/beats-rebuild.sh"
LOG="$BUILD_DIR/compile.log"
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
  python3 "$BEATS_PY" verify --corpus "$CORPUS_DIR" --build "$BUILD_DIR" >/dev/null 2>"$errf" &
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
      emit_silent ;;
    6)
      detail="$(grep -oE '[0-9]+ added, [0-9]+ removed, [0-9]+ changed' "$errf" 2>/dev/null | head -1)"
      [ -n "$detail" ] || detail="corpus changed"
      bash "$REBUILD_HOOK" --enqueue >/dev/null 2>&1 || true
      emit_context "beats index STALE ($detail) - rebuilding in background. Retrieval still serves the current index; it refreshes shortly." ;;
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
