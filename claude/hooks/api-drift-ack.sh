#!/bin/bash
# UserPromptSubmit: clear the api-drift pending flag on a dismiss phrase (false
# positive, or drift already accommodated by hand).
FLAG="$HOME/.claude/.api-drift-pending"
prompt="$(cat)"
msg="$(printf '%s' "$prompt" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt','').strip().lower())" 2>/dev/null)"
case "$msg" in
  "drift handled"|"drift ok"|"false drift"|"ignore drift"|"drift cleared")
    if [ -f "$FLAG" ]; then
      rm -f "$FLAG"
      printf '%s\n' '{"systemMessage":"API-drift flag cleared.","hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"API-drift pending flag cleared by user dismiss."}}'
    fi
    ;;
esac
