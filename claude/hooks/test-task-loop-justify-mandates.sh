#!/bin/bash
# test-task-loop-justify-mandates.sh
#
# Covers task-loop-mandate.sh and justify-queue-mandate.sh: both must emit valid
# JSON with the correct hookEventName and the core phrasing, in BOTH session
# (SessionStart) and turn (UserPromptSubmit) modes.
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
fail=0

check() { # desc, hook-output, expected-event, expected-phrase
  local desc="$1" out="$2" event="$3" phrase="$4" got_event got_ctx
  got_event=$(printf '%s' "$out" | python3 -c "import json,sys;print(json.load(sys.stdin)['hookSpecificOutput']['hookEventName'])" 2>/dev/null) \
    || { echo "FAIL [$desc]: output is not valid JSON"; fail=1; return; }
  got_ctx=$(printf '%s' "$out" | python3 -c "import json,sys;print(json.load(sys.stdin)['hookSpecificOutput']['additionalContext'])" 2>/dev/null)
  [ "$got_event" = "$event" ] || { echo "FAIL [$desc]: event '$got_event' != '$event'"; fail=1; return; }
  printf '%s' "$got_ctx" | grep -q "$phrase" || { echo "FAIL [$desc]: additionalContext missing '$phrase'"; fail=1; return; }
  echo "PASS [$desc]"
}

check "task-loop session" "$("$HOOK_DIR/task-loop-mandate.sh" session)"      "SessionStart"     "COMPLETE THE LIST"
check "task-loop turn"    "$("$HOOK_DIR/task-loop-mandate.sh" turn)"         "UserPromptSubmit" "TASK-LOOP CHECK"
check "task-loop default" "$("$HOOK_DIR/task-loop-mandate.sh")"              "SessionStart"     "TASK-LOOP MANDATE"
check "justify session"   "$("$HOOK_DIR/justify-queue-mandate.sh" session)" "SessionStart"     "QUEUED in justify"
check "justify turn"      "$("$HOOK_DIR/justify-queue-mandate.sh" turn)"    "UserPromptSubmit" "JUSTIFY-QUEUE CHECK"
check "justify default"   "$("$HOOK_DIR/justify-queue-mandate.sh")"         "SessionStart"     "JUSTIFY-QUEUE MANDATE"

if [ "$fail" = 0 ]; then echo "ALL PASS"; else echo "FAILURES ABOVE"; exit 1; fi
