#!/usr/bin/env bash
# SessionStart hook: announce the GLOBAL taste-blocking mode each session, so the current state is
# always in context (mirrors voice-mandate.sh). Reads the ~/.claude/.taste-blocking-enabled flag the
# taste-blocking-toggle.sh UserPromptSubmit hook writes. Emits a single additionalContext line; never
# blocks. TASTE_BLOCKING_FLAG_FILE is honored ONLY under a test root (SIDECOACH_ENFORCE_TEST_ROOT),
# matching the TS reader + the toggle hook (Codex HIGH #1); production uses the fixed home path.

if [ -n "$SIDECOACH_ENFORCE_TEST_ROOT" ] && [ -n "$TASTE_BLOCKING_FLAG_FILE" ]; then
  FLAG="$TASTE_BLOCKING_FLAG_FILE"
else
  FLAG="$HOME/.claude/.taste-blocking-enabled"
fi

if [ -f "$FLAG" ]; then
  LINE='TASTE BLOCKING IS ON. Certified enforced mined-taste rules BLOCK the build/gate when they fire (the user flipped the global master toggle on). Type "taste blocking off" to return to advisory.'
else
  LINE='TASTE BLOCKING IS OFF (advisory - the default). Certified enforced mined-taste rules still RUN and REPORT but never BLOCK, so a machine-learned rule can never block a faithful implementation of an approved design. Type "taste blocking on" to enforce; "taste blocking status" to check.'
fi

python3 -c '
import json, sys
print(json.dumps({"additionalContext": sys.argv[1]}))
' "$LINE"
exit 0
