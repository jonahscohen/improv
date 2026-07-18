#!/usr/bin/env bash
# UserPromptSubmit hook: catches "verified" or "looks good" to clear verification flag.
# Also clears on any user message if they interrupted to manually verify.

prompt="$(cat)"

# Session-scoped (2026-07-18): "verified" clears THIS session's flag, not a global one that
# would absolve a different concurrent session mid-commit. Key derivation is byte-identical
# to bash-guard / verify-before-done so the clear targets the exact file the arm created.
SESSION_KEY="$(printf '%s' "$prompt" | python3 -c 'import json,re,sys; s=str(json.load(sys.stdin).get("session_id","") or ""); print(re.sub(r"[^A-Za-z0-9._-]","_",s) or "global")' 2>/dev/null)"
[ -z "$SESSION_KEY" ] && SESSION_KEY=global
FLAG="$HOME/.claude/.needs-verification.$SESSION_KEY"

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
