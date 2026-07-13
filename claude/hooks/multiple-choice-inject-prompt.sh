#!/bin/bash
# Hook: UserPromptSubmit injector for multiple-choice violations.
# Reads ~/.claude/.multiple-choice-violation if present (written by the Stop-event
# detector when the previous assistant turn used plain-text options without
# AskUserQuestion). Emits a hookSpecificOutput.additionalContext block with the
# violation details so the next assistant turn sees a loud reminder before
# generating any text.
#
# Why this is wired here: Claude Code's hook taxonomy has no PreResponse event,
# so blocking the bad response is impossible. The recovery loop is:
#   1. Bad response shown to user (one-time cost per session)
#   2. Stop hook detects violation, writes flag
#   3. User submits next prompt
#   4. THIS hook reads the flag, injects loud reminder into context, clears flag
#   5. Next assistant turn sees the reminder and uses AskUserQuestion

# Read stdin so we can key the flag to THIS session. Previously this hook read a
# single global flag and rm -f'd it, so it consumed whichever session's violation
# happened to be pending - showing one agent another agent's words, and destroying
# the real violator's reminder before it was ever delivered. See the note in
# multiple-choice-detect-stop.sh.
STDIN_JSON=$(cat 2>/dev/null || true)
SESSION_ID=$(printf '%s' "$STDIN_JSON" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('session_id', '') or '')
except Exception:
    pass
" 2>/dev/null)
SESSION_KEY=$(printf '%s' "$SESSION_ID" | tr -cd 'A-Za-z0-9._-')
case "$SESSION_KEY" in
  ""|"."|"..") SESSION_KEY="" ;;
esac

if [[ -n "$SESSION_KEY" ]]; then
  VIOLATION_FLAG="$HOME/.claude/.multiple-choice-violation.$SESSION_KEY"
else
  VIOLATION_FLAG="$HOME/.claude/.multiple-choice-violation"
fi

# No flag for THIS session - pass through silently. Never touch another session's.
[[ ! -f "$VIOLATION_FLAG" ]] && exit 0

# Read the flag contents.
REASON=$(grep '^reason=' "$VIOLATION_FLAG" 2>/dev/null | head -1 | cut -d= -f2-)
TIMESTAMP=$(grep '^timestamp=' "$VIOLATION_FLAG" 2>/dev/null | head -1 | cut -d= -f2-)
MATCHED=$(awk '/^matched_lines<<MATCHEOF$/{flag=1; next} /^MATCHEOF$/{flag=0} flag' "$VIOLATION_FLAG" 2>/dev/null | head -10)

# Compose the injection. Loud, specific, with the actual matched lines so the
# assistant cannot rationalize "I didn't really do that."
ADDITIONAL_CONTEXT=$(cat <<EOF
MULTIPLE-CHOICE VIOLATION DETECTED IN PREVIOUS RESPONSE ($TIMESTAMP):

You posed a question to the user in plain text, or presented options in plain-text
form (labeled paragraphs, bold-prefixed approaches, numbered alternatives, or
similar), WITHOUT invoking the AskUserQuestion tool. This is a hard violation of the
global mandate documented in CLAUDE.md and MEMORY.md.

Detected signal: $REASON

Matched lines (the actual text from your last response):
$MATCHED

REQUIRED ACTION on this turn:
1. Acknowledge the violation explicitly (one sentence).
2. Re-issue the question using the AskUserQuestion tool with concrete options.
   A yes/no is a TWO-option AskUserQuestion - it is not exempt.
3. Mark the recommended option with "(Recommended)".
4. Do NOT continue with the work you were doing until the user answers via the tool.

MANDATE (revised 2026-07-12): EVERY question to the user goes through
AskUserQuestion. The old binary/plain-text carve-out is REVOKED. If this fired on a
binary yes/no or a simple "X or Y?", that is INTENDED - not a false positive. See:
- .claude/memory/feedback_multiple_choice_2026-05-24_third_failure_root_cause.md
- .claude/memory/feedback_multiple_choice_2026-05-24_double_failure.md
- .claude/memory/feedback_options_use_multiple_choice.md

The only genuine false positives left are a factual ENUMERATION with no question
attached, and a rhetorical question inside prose. If you believe you hit one of
those, say so plainly and explain why - but the default assumption is that the
detection is correct, because the historical failure rate is high.
EOF
)

# Emit the JSON hook response. Claude Code reads stdout from UserPromptSubmit
# hooks; the additionalContext field gets injected into the next turn.
# Pass the text via the environment. Interpolating it into a python triple-quoted
# literal broke the JSON (or injected python) on any response containing a triple
# quote or a backslash.
MC_CONTEXT="$ADDITIONAL_CONTEXT" python3 <<'PYEOF'
import json, os
payload = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": os.environ.get("MC_CONTEXT", ""),
    }
}
print(json.dumps(payload))
PYEOF

# Clear the flag so it does not re-fire on subsequent prompts.
rm -f "$VIOLATION_FLAG"

exit 0
