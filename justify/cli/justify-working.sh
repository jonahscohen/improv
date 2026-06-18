#!/usr/bin/env bash
# justify-working - flip the claudebar to "Working..." the moment Claude claims a
# task, BEFORE applying it. First step of the loop: watch -> WORKING -> apply ->
# validating -> done.
#
# The daemon auto-fires Working on a /prompts poll, but only advances a browser
# still in 'sending'; a disconnect/reconnect (browser falls back to 'connected')
# swallows it and the bar drifts to "Connected". This POSTs /working, an explicit
# UNGATED force, so "Working..." always shows. Symmetric with justify-validating.
#
# Usage:  justify-working [note]
# Env:    JUSTIFY_PORT  daemon port (default 9223);  NO_COLOR disables color
set -uo pipefail

NOTE="${1:-applying the change}"
PORT="${JUSTIFY_PORT:-9223}"

if [ -z "${NO_COLOR:-}" ]; then
  O=$'\033[38;5;209m'; D=$'\033[38;5;245m'; B=$'\033[1m'; X=$'\033[0m'
else
  O='' ; D='' ; B='' ; X=''
fi
DOT=$'·'; BL=$'└'

if curl -s -X POST "http://localhost:${PORT}/working" -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1; then
  printf '  %s%s%s justify  %s%s  working%s\n' "$O" "$DOT" "$X" "$B" "$DOT" "$X"
  printf '  %s%s%s %s%s%s\n' "$O" "$BL" "$X" "$D" "$NOTE" "$X"
else
  printf '  %s%s%s justify  %s%s  working POST FAILED (daemon down?)%s\n' "$O" "$DOT" "$X" "$B" "$DOT" "$X"
  exit 1
fi
