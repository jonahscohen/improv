---
name: codex-rescue-teammate-no-relay
description: A named codex:codex-rescue teammate (cmux teams pane) spawns fine and does its work but does NOT relay its final findings back via SendMessage - it just goes idle. Don't loop on pinging it; run codex directly via the CLI instead (still satisfies cross-model produce-and-verify).
type: reference
relates_to: [reference_cmux_team_init_orphan_bug.md, reference_codex_exec_hang_sigkill.md, feedback_multiagent_verified_implementation_mandate.md]
---

Collaborator: Jonah Cohen. Observed 2026-06-25 during the Stage 2 convergence closure review.

## SYMPTOM
Spawned a `codex:codex-rescue` agent AS A NAMED TEAMMATE (required in cmux teams mode - unnamed Agent calls are BLOCKED with "every Agent call must spawn as a NAMED teammate"). It spawned cleanly (team session-2d560d93 healthy: config.json + inboxes present, NOT the orphan bug). It ran, then sent only `{"type":"idle_notification","idleReason":"available"}` - NO findings. I SendMessage'd it asking for the review; it consumed the message (its inbox emptied) but went idle AGAIN with no reply. My team-lead inbox stayed `[]`. No findings file written to scratchpad.

## ROOT CAUSE (working theory)
The codex-rescue agent treats its review as its "final message," which for an in-process subagent returns as the Agent tool result - but for a NAMED teammate that final message does NOT auto-route to the lead; teammates must explicitly SendMessage to communicate, and codex-rescue doesn't. So its result is stranded in its own transcript.

## FIX / WORKAROUND (what to do instead)
Don't ping the teammate a third time (that's the loop to avoid). Run codex YOURSELF directly via the CLI - this still satisfies the produce-and-verify mandate ([[feedback_multiagent_verified_implementation_mandate]]) because codex (GPT-5.4) is a DIFFERENT MODEL checking the work; a different *agent* is not required, a different *model* is. Pattern:
- `export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"`
- `timeout -s KILL 300 codex exec -C <repo> -s read-only "$(cat prompt.txt)" < change.diff` (stdin is appended as a `<stdin>` block; read-only sandbox lets codex grep/cat to cross-check call sites). Mind [[reference_codex_exec_hang_sigkill]].
- There is also `codex exec review` (built-in repo code review) if you don't need a custom scope.

## DIAGNOSIS COMMANDS (how I confirmed the relay failure)
- `ps aux | grep [c]odex` -> no active codex exec (not wedged, just idle).
- `cat ~/.claude/teams/session-<id>/inboxes/team-lead.json` -> `[]` (no reply received).
- `cat ~/.claude/teams/session-<id>/inboxes/<teammate>.json` -> `[]` (my message consumed).
