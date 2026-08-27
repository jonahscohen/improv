#!/usr/bin/env bash

# --- per-project sidecoach opt-out (Jonah 2026-08-27) -------------------------
# A repo carrying a `.sidecoach-off` file at its root disables sidecoach hooks for
# that project only. cwd is the project working dir when Claude runs a hook; fall
# back to $PWD outside a git tree. Other projects (no marker) are unaffected.
_sc_off_root="$(git rev-parse --show-toplevel 2>/dev/null || printf %s "$PWD")"
if [ -n "$_sc_off_root" ] && [ -f "$_sc_off_root/.sidecoach-off" ]; then exit 0; fi
# -----------------------------------------------------------------------------
# Sidecoach PostUserPromptSubmit hook - sends utterance to daemon

STATE_FILE="$HOME/.claude/.sidecoach-state"

if [[ ! -f "$STATE_FILE" ]]; then exit 0; fi
source "$STATE_FILE"
if [[ "$ACTIVE" != "1" ]]; then exit 0; fi

UTTERANCE=$(cat)
if [[ -z "$UTTERANCE" ]]; then exit 0; fi

PAYLOAD=$(node -e "process.stdout.write(JSON.stringify({utterance: process.argv[1], userId: process.env.USER || 'unknown', projectPath: process.cwd()}))" "$UTTERANCE" 2>/dev/null)
timeout 1 bash -c "echo '$PAYLOAD' > '$PIPE_PATH'" 2>/dev/null

exit 0
