#!/bin/bash
# task-loop-mandate.sh - COMPLETE THE TASK LIST. Anti-stall / anti-half-step grounding.
#
# Part of the grounding cluster. Fires on:
#   session (SessionStart)      - the full mandate, once per session.
#   turn    (UserPromptSubmit)  - a short reminder EVERY prompt, so the mandate never
#                                 FADES over a long conversation. Fade is the exact
#                                 failure that birthed this hook (2026-07-17): across a
#                                 day-long session the lead stalled, asked permission for
#                                 work the user had already authorized ("when done: ..."),
#                                 and answered daemon heartbeats instead of executing the
#                                 queued build. The user's word: "you dont know how to act."
#
# Why a hook and not only CLAUDE.md: a shell hook re-injects the mandate into the LIVE
# turn context, which is what actually reaches the model each prompt. CLAUDE.md is read
# once and fades; a per-turn re-inject does not. Same mechanism as claude-surface.sh's
# turn mode.
#
# The behavioral contract (Jonah, 2026-07-17, verbatim intent):
#   - If you hold a list of tasks the user personally gave you (this chat, a TASKS file,
#     or carried in beats), you COMPLETE that list. Loop it; spawn parallel named
#     teammates to tackle tasks concurrently until every one is DONE and VALIDATED.
#   - Do NOT stall, ask permission to begin work already authorized, half-step, or
#     hallucinate completion.
#   - If a task seems underspecified, be PROACTIVE: mine the provided context + beats to
#     find what you need and finish it. The user never hands empty context and expects
#     magic - the missing piece is findable. Never bounce a task back for information you
#     can dig out yourself.
#   - "Done" = validated and reportable as PROVEN, not "should work."

mode="${1:-session}"

if [ "$mode" = "turn" ]; then
  EVENT="UserPromptSubmit"
  MSG="TASK-LOOP CHECK: If you are holding tasks the user gave you, are you EXECUTING them right now - looping the list, spawning parallel named teammates until each is done AND validated - or are you stalling, asking permission you already have, half-stepping, or answering daemon heartbeats instead of working? Execute. Completion is proven, not claimed."
else
  EVENT="SessionStart"
  MSG="TASK-LOOP MANDATE (standing, non-negotiable). When you hold a list of tasks the user PERSONALLY gave you - in this conversation, a TASKS file, or beats - you COMPLETE THE LIST. Loop over it and spawn parallel named teammates to tackle tasks CONCURRENTLY until every task is DONE and VALIDATED (reportable as proven, not 'should work'). You do NOT: stall, ask permission to start work already authorized, half-step, or hallucinate completion. If a task reads as underspecified, be PROACTIVE - mine the provided context and beats to find what you need and finish it; the user never gives empty context and the missing piece is findable, so never bounce a task back for information you can dig out yourself. The user dogfoods you; you do not dogfood the user."
fi

python3 - "$EVENT" "$MSG" <<'PY'
import json, sys
event, msg = sys.argv[1], sys.argv[2]
print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": msg}}))
PY
