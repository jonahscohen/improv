#!/usr/bin/env bash
# UserPromptSubmit hook: toggles concise mode via the ~/.claude/.concise-disabled marker.
#
# Default (marker ABSENT) = concise ON. Marker PRESENT = concise OFF.
# Commands match the WHOLE message (like voice-toggle.sh), so they never fire mid-prose:
#   concise on      | be concise   | concise mode on   -> ON  (removes marker, re-injects ruleset)
#   concise off     | verbose      | be verbose | concise mode off -> OFF (creates marker, off note)
#   concise toggle                                     -> flip
#   concise status  | concise?                         -> report current state
#
# The ON path re-injects the ruleset by calling `concise-mandate.sh --emit-body`, so the
# rules text is single-sourced in the mandate hook (co-deployed by the grounding cluster).
# Marker writes are checked, so a failed create/remove reports the real state, not a lie.
# Ruleset adapted from the i-have-adhd skill by ayghri (MIT, github.com/ayghri/i-have-adhd).

MARKER="$HOME/.claude/.concise-disabled"
MANDATE="$HOME/.claude/hooks/concise-mandate.sh"
OFF_NOTE='CONCISE MODE IS OFF. The user turned off concise mode. Resume your normal response depth - full explanations, context, and detail are welcome again. Say "concise on" to re-enable brevity.'

msg="$(cat | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt','').strip().lower())" 2>/dev/null)"

# $1 = systemMessage (shown to user), $2 = additionalContext (fed to the model)
emit() {
    SYS="$1" CTX="$2" python3 -c '
import json, os
print(json.dumps({"systemMessage": os.environ["SYS"],
                  "hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
                                         "additionalContext": os.environ["CTX"]}}))
'
}

# Emit the ON confirmation. Prefer the mandate's ruleset (single-sourced); if it cannot be
# loaded (mandate missing, non-executable, or off-listed on its own - the per-hook off-list
# can drop concise-mandate.sh while keeping this toggle), say so honestly in the
# systemMessage instead of claiming brevity is active with no rules injected.
emit_on() {  # $1 = systemMessage
    local body
    if [ -x "$MANDATE" ] && body="$("$MANDATE" --emit-body 2>/dev/null)" && [ -n "$body" ]; then
        emit "$1" "$body"
    else
        emit "$1 (warning: ruleset could not be loaded from $MANDATE - brevity may not apply until it is restored)" \
             "CONCISE MODE ENABLED, but its ruleset could not be loaded from $MANDATE, so concise formatting may not be in effect. Check that concise-mandate.sh is deployed and executable."
    fi
}

# turn concise ON: remove the disable marker; return non-zero if it is still there
enable_concise() { rm -f "$MARKER" 2>/dev/null; [ ! -f "$MARKER" ]; }
# turn concise OFF: create the disable marker; return non-zero if it was not created
disable_concise() { touch "$MARKER" 2>/dev/null; [ -f "$MARKER" ]; }

case "$msg" in
    "concise on"|"be concise"|"concise mode on")
        if enable_concise; then
            emit_on "Concise mode is now ON."
        else
            emit "Could not enable concise mode: $MARKER could not be removed." "Could not enable concise mode: $MARKER could not be removed."
        fi
        ;;
    "concise off"|"verbose"|"be verbose"|"concise mode off")
        if disable_concise; then
            emit "Concise mode is now OFF. Normal response depth resumed." "$OFF_NOTE"
        else
            emit "Could not disable concise mode: $MARKER could not be created." "Could not disable concise mode: $MARKER could not be created."
        fi
        ;;
    "concise toggle")
        if [ -f "$MARKER" ]; then
            if enable_concise; then
                emit_on "Concise mode toggled ON."
            else
                emit "Could not enable concise mode: $MARKER could not be removed." "Could not enable concise mode: $MARKER could not be removed."
            fi
        else
            if disable_concise; then
                emit "Concise mode toggled OFF. Normal response depth resumed." "$OFF_NOTE"
            else
                emit "Could not disable concise mode: $MARKER could not be created." "Could not disable concise mode: $MARKER could not be created."
            fi
        fi
        ;;
    "concise status"|"concise?")
        if [ -f "$MARKER" ]; then
            emit "Concise mode is currently OFF." "Concise mode is currently OFF."
        else
            emit "Concise mode is currently ON." "Concise mode is currently ON."
        fi
        ;;
esac
