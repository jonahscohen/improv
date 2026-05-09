#!/usr/bin/env bash
# UserPromptSubmit hook: catches "verified" or "looks good" to clear verification flag.
# Also clears on any user message if they interrupted to manually verify.

FLAG="$HOME/.claude/.needs-verification"

prompt="$(cat)"
msg="$(echo "$prompt" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt','').strip().lower())" 2>/dev/null)"

output() {
    printf '%s\n' "{\"systemMessage\":\"$1\",\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"$1\"}}"
}

case "$msg" in
    "verified"|"looks good"|"it works"|"lgtm"|"all good"|"bypass verification")
        if [ -f "$FLAG" ]; then
            rm -f "$FLAG"
            output "Verification flag cleared. You may now commit."
        fi
        ;;
esac
