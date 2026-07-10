#!/usr/bin/env bash
# justify-worker - the headless apply worker the Justify DAEMON spawns when the
# watch is armed and a Send-All batch arrives. It is NOT session-owned: the
# persistent :9223 daemon owns its lifecycle, so the watch survives every session
# teardown and harness turn boundary.
#
# Mirrors the beats-reflect-weekly.sh spawn discipline:
#   - absolute claude binary resolution + explicit minimal-env PATH (the daemon
#     may run under launchd with an almost-empty environment)
#   - a wall-clock watchdog that group-kills claude's whole process tree on
#     timeout (claude spawns node + sub-agents a bare kill would orphan)
#   - success is the OBSERVED EFFECT (the daemon checks that the claimed prompt
#     ids were cleared from the queue), never the exit code alone.
#
# The daemon passes the batch + context via env:
#   JUSTIFY_PROJECT_ROOT  project to apply changes in (cwd + --add-dir)
#   JUSTIFY_PORT          daemon port (justify-done posts back here)
#   JUSTIFY_CLAIM_IDS     comma-separated prompt ids this worker owns
#   JUSTIFY_BATCH         JSON array [{id,prompt,context,selectors}]
#   JUSTIFY_RUN_ID        the daemon's claim id (for logs)
#
# FAIL-LOUD EXIT CODES
#   0  claude ran to completion
#   2  config error (missing project root / batch)
#   3  claude binary not found
#   5  run exceeded the watchdog timeout
set -uo pipefail

# Include every dir install.sh may have chosen as BIN_DIR (/usr/local/bin,
# /opt/homebrew/bin, or ~/.local/bin) plus the install root, so `justify-done`
# always resolves - otherwise a worker applies the change but cannot report/clear
# it, and the batch retries forever.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.claude/justify:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

LOG="${JUSTIFY_WORKER_LOG:-$HOME/.claude/justify/worker.log}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
log_note() { printf '%s justify-worker: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >> "$LOG" 2>/dev/null || true; }

ROOT="${JUSTIFY_PROJECT_ROOT:-}"
PORT="${JUSTIFY_PORT:-9223}"
BATCH="${JUSTIFY_BATCH:-}"
RUN_ID="${JUSTIFY_RUN_ID:-unknown}"
TIMEOUT_SECS="${JUSTIFY_WORKER_TIMEOUT_SECS:-1800}"
GRACE_SECS="${JUSTIFY_WORKER_GRACE_SECS:-5}"
POLL_SECS="${JUSTIFY_WORKER_POLL_SECS:-5}"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  log_note "FAIL(2): JUSTIFY_PROJECT_ROOT missing or not a dir: '$ROOT' (run=$RUN_ID)"
  exit 2
fi
if [ -z "$BATCH" ]; then
  log_note "FAIL(2): JUSTIFY_BATCH empty (run=$RUN_ID)"
  exit 2
fi

# Build the human-readable task list from the JSON batch.
TASKS="$(BATCH="$BATCH" python3 <<'PY'
import os, json
try:
    batch = json.loads(os.environ.get("BATCH") or "[]")
except Exception:
    batch = []
lines = []
for p in batch:
    pid = p.get("id", "?")
    prompt = (p.get("prompt") or "").strip()
    context = (p.get("context") or "").strip()
    sels = p.get("selectors") or []
    lines.append(f"### Task {pid}")
    lines.append(f"Request: {prompt}")
    if sels:
        lines.append("Target selector(s): " + ", ".join(str(s) for s in sels))
    if context:
        lines.append("Context:\n" + context)
    lines.append("")
print("\n".join(lines))
PY
)"

CLAUDE_BIN="${JUSTIFY_WORKER_CLAUDE_BIN:-}"
if [ -z "$CLAUDE_BIN" ]; then
  if [ -x "/opt/homebrew/bin/claude" ]; then
    CLAUDE_BIN="/opt/homebrew/bin/claude"
  else
    CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"
  fi
fi
if [ -z "$CLAUDE_BIN" ]; then
  log_note "FAIL(3): claude binary not found on PATH ($PATH) (run=$RUN_ID)"
  exit 3
fi

read -r -d '' PROMPT <<PROMPTEOF
You are the Justify headless apply worker for the project at ${ROOT}.

The Justify daemon received design-change requests from the browser and
dispatched you to apply them. This is a non-interactive apply run: do the work,
report each result, then exit. Do NOT arm or disarm the watch, do NOT start a
listen/poll loop, and do NOT spawn sub-workers.

Handle EVERY task below, one at a time, in order. For each task:
1. Apply the requested change to THIS project's SOURCE files. Be authoritative
   and decisive: take the request at face value and make the obvious-best edit.
   If the requested style/state already holds, lock it explicitly. Reserve a
   needsInfo response for genuine ambiguity, never for tentativeness.
2. Report it back with the justify-done CLI, which posts the result to the
   Changes panel and clears that one task from the queue by id. JUSTIFY_PORT is
   already exported so it reaches the right daemon:
     justify-done "<id>" "<one plain sentence of what changed>" "file1,file2"
   When you can express the edit as selector/property before/after rows, pass
   them for the panel diff:
     JUSTIFY_CHANGES='[{"selector":"<sel>","property":"<prop>","oldValue":"<old>","newValue":"<new>"}]' justify-done "<id>" "<summary>" "<files>"
   For a genuine question use: JUSTIFY_STATUS=needsInfo justify-done "<id>" "<question>" ""

Answer every task id exactly once. The dev server hot-reloads on source save, so
applying the edit is what makes the change appear in the browser.

TASKS:
${TASKS}
PROMPTEOF

log_note "start run=$RUN_ID root=$ROOT ids=${JUSTIFY_CLAIM_IDS:-} timeout=${TIMEOUT_SECS}s"

# --- run claude with a wall-clock watchdog (process-group kill) ----------------
_HAVE_PERL=0
command -v perl >/dev/null 2>&1 && _HAVE_PERL=1

kill_target() {
  local sig="$1" pid="$2"
  if [ "$_HAVE_PERL" = "1" ]; then
    kill "-$sig" "-$pid" 2>/dev/null || kill "-$sig" "$pid" 2>/dev/null || true
  else
    kill "-$sig" "$pid" 2>/dev/null || true
  fi
}

TIMEOUT_MARKER="$(mktemp "${TMPDIR:-/tmp}/justify-worker.XXXXXX" 2>/dev/null || echo "${TMPDIR:-/tmp}/justify-worker.$$")"
rm -f "$TIMEOUT_MARKER" 2>/dev/null || true

cd "$ROOT" 2>/dev/null || { log_note "FAIL(2): cannot cd to $ROOT (run=$RUN_ID)"; exit 2; }

if [ "$_HAVE_PERL" = "1" ]; then
  perl -e 'setpgrp 0,0; exec @ARGV or exit 127' -- \
    "$CLAUDE_BIN" -p "$PROMPT" --permission-mode bypassPermissions --add-dir "$ROOT" >> "$LOG" 2>&1 &
else
  "$CLAUDE_BIN" -p "$PROMPT" --permission-mode bypassPermissions --add-dir "$ROOT" >> "$LOG" 2>&1 &
fi
CLAUDE_PID=$!

(
  _waited=0
  while [ "$_waited" -lt "$TIMEOUT_SECS" ]; do
    kill -0 "$CLAUDE_PID" 2>/dev/null || exit 0
    sleep "$POLL_SECS"
    _waited=$((_waited + POLL_SECS))
  done
  if kill -0 "$CLAUDE_PID" 2>/dev/null; then
    touch "$TIMEOUT_MARKER" 2>/dev/null || true
    kill_target TERM "$CLAUDE_PID"
    sleep "$GRACE_SECS"
    kill_target KILL "$CLAUDE_PID"
  fi
) &
WATCH_PID=$!

wait "$CLAUDE_PID" 2>/dev/null
RC=$?
if [ -f "$TIMEOUT_MARKER" ]; then
  wait "$WATCH_PID" 2>/dev/null || true
  rm -f "$TIMEOUT_MARKER" 2>/dev/null || true
  log_note "FAIL(5): run=$RUN_ID timed out after ${TIMEOUT_SECS}s (rc=$RC)"
  exit 5
fi
kill -TERM "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
rm -f "$TIMEOUT_MARKER" 2>/dev/null || true

log_note "end run=$RUN_ID rc=$RC"
exit "$RC"
