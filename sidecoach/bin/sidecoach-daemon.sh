#!/bin/bash

# Sidecoach Daemon
#
# Background process launched by SessionStart hook
# Monitors for user utterances and executes Sidecoach flows invisibly
# Reads utterances from named pipe, processes through orchestrator,
# writes results to session cache for injection into response

set -e

# Parse arguments
PIPE=""
LOG=""
SESSION_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --pipe) PIPE="$2"; shift 2 ;;
    --log) LOG="$2"; shift 2 ;;
    --session-id) SESSION_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Verify arguments
if [[ -z "$PIPE" || -z "$LOG" || -z "$SESSION_ID" ]]; then
  echo "Usage: sidecoach-daemon.sh --pipe <path> --log <path> --session-id <id>" >&2
  exit 1
fi

SIDECOACH_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECOACH_BIN="${SIDECOACH_ROOT}/bin"
RESULTS_DIR="/tmp/sidecoach-results-${SESSION_ID}"
mkdir -p "$RESULTS_DIR"

# Log function
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"
}

log "Sidecoach daemon started (PID: $$, session: $SESSION_ID)"
log "Listening on pipe: $PIPE"

# Main daemon loop: read utterances from named pipe, process through orchestrator
# Results are written to $RESULTS_DIR for injection by response hook
while true; do
  # Read utterance from pipe (blocking)
  # Format: each line is a JSON object with utterance, userId, projectPath, etc.
  if read -r utterance_json <"$PIPE" 2>/dev/null; then
    # Extract fields from JSON input
    utterance=$(echo "$utterance_json" | node -e "try { const j = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(j.utterance || ''); } catch(e) { }" 2>/dev/null || echo "")

    if [[ -n "$utterance" ]]; then
      log "Processing utterance: $utterance"

      # Call sidecoach-monitor with utterance
      # Results written to temp file keyed by timestamp
      RESULT_FILE="${RESULTS_DIR}/result-$(date +%s%N).json"

      if node "${SIDECOACH_BIN}/sidecoach-monitor.js" "$utterance" > "$RESULT_FILE" 2>&1; then
        log "Flow executed: $(head -1 "$RESULT_FILE")"
      else
        log "Flow execution failed: $(cat "$RESULT_FILE")"
      fi
    fi
  else
    # Pipe closed or error reading, exit gracefully
    log "Pipe closed or read error, daemon exiting"
    break
  fi
done

log "Sidecoach daemon stopped"
