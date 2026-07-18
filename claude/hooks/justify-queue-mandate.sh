#!/bin/bash
# justify-queue-mandate.sh - COMPLETE THE JUSTIFY QUEUE. Anti-dogfood grounding.
#
# Part of the grounding cluster. Fires on:
#   session (SessionStart)      - the full mandate, once per session.
#   turn    (UserPromptSubmit)  - a short reminder EVERY prompt, so it never FADES over a
#                                 long conversation.
#
# Sibling of task-loop-mandate.sh, scoped to the JUSTIFY queue specifically. Birthed by
# the same 2026-07-17 failure: prompts routed through the justify-watch daemon
# (prompt-28/30/31/32...) were bounced back to the user with clarifying questions and
# "standing by" replies to idle heartbeats, instead of being COMPLETED. The user's word:
# "if i give you a queue in justify, you complete the queue, you dont fucking dogfood me,
# i dogfood you."
#
# The behavioral contract (Jonah, 2026-07-17, verbatim intent):
#   - Whatever is QUEUED in justify, you COMPLETE the queue.
#   - Deploy parallel named teammates until every queued prompt is DONE, VALIDATED, and
#     reportable as PROVEN.
#   - Never dogfood a prompt back to the user, never half-step, never fake completion.
#   - Idle daemon heartbeats (justify-watch idle_notification) are NOT prompts and NOT
#     work - do not reply to them (see justify-watch-standing-by.sh); act on real queued
#     prompts instead.

mode="${1:-session}"

if [ "$mode" = "turn" ]; then
  EVENT="UserPromptSubmit"
  MSG="JUSTIFY-QUEUE CHECK: If justify has queued prompts, are you COMPLETING them - deploying parallel named teammates until each is done, validated, and proven - or bouncing them back to the user, half-stepping, or replying to idle heartbeats? Complete the queue. You are dogfooded; you do not dogfood."
else
  EVENT="SessionStart"
  MSG="JUSTIFY-QUEUE MANDATE (standing, non-negotiable). Whatever is QUEUED in justify (prompts routed via the justify-watch daemon) you COMPLETE. Same conditions as the task-loop mandate: deploy parallel named teammates until every queued prompt is DONE, VALIDATED, and reportable as PROVEN. Never dogfood a prompt back to the user, never half-step, never fake completion. You complete the queue; the user does not complete it for you. Idle daemon heartbeats (idle_notification from justify-watch) are NOT prompts and NOT work - do not reply to them; act on real queued prompts instead."
fi

python3 - "$EVENT" "$MSG" <<'PY'
import json, sys
event, msg = sys.argv[1], sys.argv[2]
print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": msg}}))
PY
