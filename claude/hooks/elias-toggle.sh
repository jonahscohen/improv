#!/usr/bin/env bash
# UserPromptSubmit hook: toggles ELIAS mode via the ~/.claude/.elias-enabled marker.
#
# Marker polarity is INVERTED from concise-toggle.sh: PRESENT = ELIAS ON, ABSENT = OFF
# (default). Commands match the WHOLE message (like concise-toggle.sh and voice-toggle.sh),
# so they never fire mid-prose:
#   elias on | elias mode on | stakeholder mode | stakeholder mode on
#     | explain like i'm a stakeholder | explain like im a stakeholder -> ON  (creates marker, injects ruleset)
#   elias off | elias mode off | stakeholder mode off | technical mode | back to technical -> OFF (removes marker, off note)
#   elias toggle | stakeholder mode toggle                                    -> flip
#   elias status | elias? | stakeholder status | stakeholder mode status      -> report current state
#
# A bare "elias" is deliberately NOT a command: it is a common human first name, so a
# message that is exactly that word is more likely about a person than about this mode.
#
# The ON path re-injects the ruleset by calling `elias-mandate.sh --emit-body`, so the rules
# text is single-sourced in the mandate hook (co-deployed by the grounding cluster). Marker
# writes are checked, so a failed create/remove reports the real state, not a lie.
#
# Normalization before matching, in this order: JSON-decode the prompt, replace the curly
# apostrophes U+2019 and U+02BC with a straight apostrophe, collapse runs of whitespace to
# one space, strip, lowercase, then strip trailing "." and "!" characters. Trailing "?" is
# NOT stripped, because "elias?" is a significant status command. The curly-apostrophe
# replacement is load-bearing: most keyboards and every phone produce U+2019 in "i'm", so
# without it the most natural spelling of the ON command silently does nothing.

MARKER="$HOME/.claude/.elias-enabled"
MANDATE="$HOME/.claude/hooks/elias-mandate.sh"
OFF_NOTE='ELIAS MODE IS OFF. The user turned off stakeholder framing. Resume normal technical depth: code, file paths, command names, and engineering vocabulary are welcome again. Say "elias on" to re-enable stakeholder framing.'

msg="$(cat | python3 -c '
import sys, json, re
try:
    p = json.load(sys.stdin).get("prompt", "") or ""
except Exception:
    p = ""
p = p.replace("’", chr(39)).replace("ʼ", chr(39))
p = re.sub(r"\s+", " ", p).strip().lower()
p = re.sub(r"[.!]+$", "", p).strip()
print(p)
' 2>/dev/null)"

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
# can drop elias-mandate.sh while keeping this toggle), say so honestly in the systemMessage
# instead of claiming stakeholder framing is active with no rules injected.
emit_on() {  # $1 = systemMessage
    local body
    if [ -x "$MANDATE" ] && body="$("$MANDATE" --emit-body 2>/dev/null)" && [ -n "$body" ]; then
        emit "$1" "$body"
    else
        emit "$1 (warning: ruleset could not be loaded from $MANDATE - stakeholder framing may not apply until it is restored)" \
             "ELIAS MODE ENABLED, but its ruleset could not be loaded from $MANDATE, so stakeholder framing may not be in effect. Check that elias-mandate.sh is deployed and executable."
    fi
}

# turn ELIAS ON: create the enable marker; return non-zero if it was not created
enable_elias()  { mkdir -p "$HOME/.claude" 2>/dev/null; touch "$MARKER" 2>/dev/null; [ -f "$MARKER" ]; }
# turn ELIAS OFF: remove the enable marker; return non-zero if it is still there
disable_elias() { rm -f "$MARKER" 2>/dev/null; [ ! -f "$MARKER" ]; }

case "$msg" in
    "elias on"|"elias mode on"|"stakeholder mode"|"stakeholder mode on"|"explain like i'm a stakeholder"|"explain like im a stakeholder")
        if enable_elias; then
            emit_on "ELIAS mode is now ON."
        else
            emit "Could not enable ELIAS mode: $MARKER could not be created." "Could not enable ELIAS mode: $MARKER could not be created."
        fi
        ;;
    "elias off"|"elias mode off"|"stakeholder mode off"|"technical mode"|"back to technical")
        if disable_elias; then
            emit "ELIAS mode is now OFF. Normal technical depth resumed." "$OFF_NOTE"
        else
            emit "Could not disable ELIAS mode: $MARKER could not be removed." "Could not disable ELIAS mode: $MARKER could not be removed."
        fi
        ;;
    "elias toggle"|"stakeholder mode toggle")
        if [ -f "$MARKER" ]; then
            if disable_elias; then
                emit "ELIAS mode toggled OFF. Normal technical depth resumed." "$OFF_NOTE"
            else
                emit "Could not disable ELIAS mode: $MARKER could not be removed." "Could not disable ELIAS mode: $MARKER could not be removed."
            fi
        else
            if enable_elias; then
                emit_on "ELIAS mode toggled ON."
            else
                emit "Could not enable ELIAS mode: $MARKER could not be created." "Could not enable ELIAS mode: $MARKER could not be created."
            fi
        fi
        ;;
    "elias status"|"elias?"|"stakeholder status"|"stakeholder mode status")
        if [ -f "$MARKER" ]; then
            emit "ELIAS mode is currently ON." "ELIAS mode is currently ON."
        else
            emit "ELIAS mode is currently OFF." "ELIAS mode is currently OFF."
        fi
        ;;
esac
