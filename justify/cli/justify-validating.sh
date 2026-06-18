#!/usr/bin/env bash
# justify-validating - flip the claudebar to "Validating..." while Claude verifies
# an applied change IN THE CONNECTED BROWSER, before reporting back with justify-done.
#
# This is the middle step of the loop: watch -> apply -> VALIDATING -> verify in the
# live browser -> done. POSTs /validating (daemon broadcasts justify_validating ->
# core _claudeToValidating()), so the user sees verification happening as a real
# justify stage instead of the bar drifting to "Connected".
#
# Usage:  justify-validating [note]
# Env:    JUSTIFY_PORT  daemon port (default 9223);  NO_COLOR disables color
set -uo pipefail

NOTE="${1:-verifying in browser}"
PORT="${JUSTIFY_PORT:-9223}"

if [ -z "${NO_COLOR:-}" ]; then
  O=$'\033[38;5;209m'; D=$'\033[38;5;245m'; B=$'\033[1m'; X=$'\033[0m'
else
  O='' ; D='' ; B='' ; X=''
fi
DOT=$'·'; TL=$'┌'; BL=$'└'

if curl -s -X POST "http://localhost:${PORT}/validating" -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1; then
  printf '  %s%s%s justify  %s%s  validating%s\n' "$O" "$DOT" "$X" "$B" "$DOT" "$X"
  printf '  %s%s%s %s%s%s\n' "$O" "$BL" "$X" "$D" "$NOTE" "$X"
else
  printf '  %s%s%s justify  %s%s  validating POST FAILED (daemon down?)%s\n' "$O" "$DOT" "$X" "$B" "$DOT" "$X"
  exit 1
fi
