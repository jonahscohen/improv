#!/bin/bash
# UserPromptSubmit hook. Arms the one-shot frontier confirm token when the USER
# types a bare "confirm" (optionally "confirm <model>"), lifting the NEXT frontier
# gate for FRONTIER_CONFIRM_TTL seconds (default 120).
#
# This is the ONLY sanctioned writer of ~/.claude/.frontier-confirm. The model
# never writes it, so frontier-model choice stays the user's call: the assistant
# states the need and asks the user to confirm; the user's typed "confirm" is what
# arms the lift. See frontier-confirm.sh for the consume side.
#
# Arms ONLY when the whole prompt is exactly "confirm" or "confirm <one-token>";
# a longer sentence containing the word "confirm" does nothing, so an unrelated
# "confirm the deletion" cannot accidentally unlock a frontier action. Emits no
# context; exits 0 either way.

INPUT=$(cat)
PROMPT=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("prompt","") or "")' 2>/dev/null)

# Trim outer whitespace / CRs.
TRIMMED=$(printf '%s' "$PROMPT" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
WORDS=$(printf '%s' "$TRIMMED" | wc -w | tr -d ' ')
FIRST=$(printf '%s' "$TRIMMED" | awk '{print tolower($1)}')

MODEL=""
if [ "$FIRST" = "confirm" ]; then
  if [ "$WORDS" = "1" ]; then
    MODEL="*"                                   # bare "confirm" -> blanket, one action
  elif [ "$WORDS" = "2" ]; then
    # "confirm <model>": accept ONLY a recognized frontier family/id so a partial
    # like "op" cannot arm a loose substring token. Anything else -> blanket "*".
    SECOND=$(printf '%s' "$TRIMMED" | awk '{print tolower($2)}')
    if printf '%s' "$SECOND" | grep -qE '^(fable|opus|sonnet|opus-?5|sonnet-?5|fable-?5|claude-(fable|opus|sonnet)-5[a-z0-9.-]*)$'; then
      MODEL="$SECOND"
    else
      MODEL="*"
    fi
  fi
fi

if [ -n "$MODEL" ]; then
  FILE="${FRONTIER_CONFIRM_FILE:-$HOME/.claude/.frontier-confirm}"
  mkdir -p "$(dirname "$FILE")" 2>/dev/null
  printf '%s %s\n' "$MODEL" "$(date +%s)" > "$FILE" 2>/dev/null
fi
exit 0
