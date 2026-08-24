#!/usr/bin/env bash
# UserPromptSubmit hook: the GLOBAL master toggle for live taste blocking. Detects
# "taste blocking on" / "taste blocking off" / "taste blocking toggle" / "taste blocking status"
# in the user's whole message and flips the ~/.claude/.taste-blocking-enabled flag file.
#
# Modeled byte-for-byte on voice-toggle.sh. FLAG PRESENT = blocking ON (a certified enforced mined
# rule blocks); FLAG ABSENT = blocking OFF = ADVISORY (the same rule warns, never blocks). DEFAULT is
# OFF, so the user is never surprised by a machine-learned rule blocking a faithful implementation of
# an approved design.
#
# SECURITY (Codex HIGH #1): TASTE_BLOCKING_FLAG_FILE is honored ONLY under a test root
# (SIDECOACH_ENFORCE_TEST_ROOT), matching the TS reader; in production the flag is the fixed home path,
# so an env override cannot relocate (and thereby forge) the toggle state.

if [ -n "$SIDECOACH_ENFORCE_TEST_ROOT" ] && [ -n "$TASTE_BLOCKING_FLAG_FILE" ]; then
  FLAG="$TASTE_BLOCKING_FLAG_FILE"
else
  FLAG="$HOME/.claude/.taste-blocking-enabled"
fi

prompt="$(cat)"
msg="$(echo "$prompt" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt','').strip().lower())" 2>/dev/null)"

output() {
    printf '%s\n' "{\"systemMessage\":\"$1\",\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"$1\"}}"
}

case "$msg" in
    "taste blocking on")
        mkdir -p "$(dirname "$FLAG")" 2>/dev/null
        touch "$FLAG"
        output "Taste blocking is now ON. A certified enforced mined rule will BLOCK the build/gate when it fires."
        ;;
    "taste blocking off")
        rm -f "$FLAG"
        output "Taste blocking is now OFF (advisory). Certified mined rules warn but never block - safe while implementing an approved design."
        ;;
    "taste blocking toggle")
        if [[ -f "$FLAG" ]]; then
            rm -f "$FLAG"
            output "Taste blocking toggled OFF (advisory). Certified mined rules warn but never block."
        else
            mkdir -p "$(dirname "$FLAG")" 2>/dev/null
            touch "$FLAG"
            output "Taste blocking toggled ON. A certified enforced mined rule will BLOCK when it fires."
        fi
        ;;
    "taste blocking status")
        if [[ -f "$FLAG" ]]; then
            output "Taste blocking is currently ON (certified mined rules block)."
        else
            output "Taste blocking is currently OFF (advisory - the default; certified mined rules warn but never block)."
        fi
        ;;
esac
exit 0
