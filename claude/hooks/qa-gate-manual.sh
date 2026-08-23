#!/usr/bin/env bash
# UserPromptSubmit hook: clears the sidecoach QA-gate flag on an explicit override
# from the user. Mirrors verify-manual.sh. ONLY the exact phrases in the case list
# below clear it, and only as the WHOLE message - an ordinary message does not, and
# neither does one of these phrases used mid-sentence.
#
# Pairs with sidecoach-qa-gate-stop.sh: the Stop gate blocks reporting a substantive
# design change done until the sidecoach QA gate (audit -> critique -> polish)
# provably ran; this is the human escape hatch when the review genuinely does not
# apply (not a real UI change, an intentional skip).

prompt="$(cat)"

# Session-scoped: clear THIS session's flag, not a global one that would absolve a
# different concurrent session. Key derivation is byte-identical to the arm site and
# the gate so the clear targets the exact file the arm created.
SESSION_KEY="$(printf '%s' "$prompt" | python3 -c 'import json,re,sys; s=str(json.load(sys.stdin).get("session_id","") or ""); print(re.sub(r"[^A-Za-z0-9._-]","_",s) or "global")' 2>/dev/null)"
[ -z "$SESSION_KEY" ] && SESSION_KEY=global
FLAG="$HOME/.claude/.needs-qa-gate.$SESSION_KEY"
BLOCKED_FLAG="$HOME/.claude/.qa-gate-blocked.$SESSION_KEY"

msg="$(echo "$prompt" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt','').strip().lower())" 2>/dev/null)"

output() {
    printf '%s\n' "{\"systemMessage\":\"$1\",\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"$1\"}}"
}

case "$msg" in
    "qa done"|"qa gate done"|"skip qa"|"qa override"|"gate override"|"looks good"|"verified")
        if [ -f "$FLAG" ]; then
            rm -f "$FLAG" "$BLOCKED_FLAG"
            output "Sidecoach QA-gate flag cleared. You may now report the UI change done."
        fi
        ;;
esac
