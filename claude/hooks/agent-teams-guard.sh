#!/bin/bash
# PreToolUse hook for Agent. When running inside cmux with the agent-teams
# shim active, require Agent calls to spawn as named teammates so each agent
# appears as its own cmux split (with sidebar metadata and notifications)
# rather than as an in-process subagent that runs silently inside this pane.
#
# Detection: CMUX_SOCKET_PATH set AND CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
# Outside that combination (e.g. regular shell, claude run without the cmux
# claude-teams wrapper), the hook is a no-op.
#
# Block condition: Agent call missing `name`.
# Pass condition: `name` present in tool_input.
#
# NOTE (2026-06-22): updated for the CURRENT Agent API. `team_name` is DEPRECATED
# - the Agent schema says "Deprecated; ignored. The session has a single implicit
# team" - and there is NO TeamCreate/TeamDelete tool in this harness anymore. The
# old guard required `team_name`; but passing it now triggers a harness error
# ("team file for session-<id> not found - the session team should have been
# initialized at startup"), because team_name routes to a legacy named-team
# lookup. So the guard must NOT require team_name. `name` is the real requirement:
# it is what makes a teammate appear as a visible cmux split with sidebar metadata.
#
# Per CLAUDE.md user preference (2026-05-27): hard block with no exemptions.
# Every Agent dispatch inside cmux-teams must be a NAMED teammate so the user
# can see the work happening in real cmux splits.

set -euo pipefail

# Skip when not in cmux-teams mode. Empty stdout signals no decision -> allow.
if [ -z "${CMUX_SOCKET_PATH:-}" ] || [ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-0}" != "1" ]; then
  echo '{}'
  exit 0
fi

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print(d.get("tool_name","") or "")' 2>/dev/null)

# Workflow spawns silent in-process subagents that can never appear as cmux
# splits. In cmux-teams mode that defeats the team flow, so it is hard-blocked
# with no pass form. Only reached when the env gate above confirmed cmux-teams.
if [ "$TOOL_NAME" = "Workflow" ]; then
  WF_REASON="BLOCKED: the Workflow tool spawns silent in-process subagents that cannot appear as cmux splits. This session is inside cmux with agent-teams enabled (CMUX_SOCKET_PATH set, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1), where every agent must be a visible named teammate. Do NOT use Workflow here. Spawn a named teammate instead: Agent({subagent_type, name, prompt}) - the name is what makes it a visible cmux split. Do NOT pass team_name (deprecated; the session has one implicit team). Coordinate via SendMessage and a shared TaskList; for background work add run_in_background only when the user asked for background."
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$WF_REASON"
  exit 0
fi

NAME=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print((d.get("tool_input") or {}).get("name","") or "")' 2>/dev/null)

# Pass as long as the teammate is NAMED - that is what makes it a visible cmux
# split. team_name is intentionally NOT required (it is deprecated and passing
# it breaks spawning in the current harness).
if [ -n "$NAME" ]; then
  echo '{}'
  exit 0
fi

REASON="BLOCKED: this session is inside cmux with agent-teams enabled (CMUX_SOCKET_PATH set, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1). In this mode, every Agent call must spawn as a NAMED teammate so it gets its own cmux split with sidebar metadata - not a silent in-process subagent. Re-issue with a name: Agent({subagent_type: \"...\", name: \"...\", prompt: \"...\"}). Do NOT pass team_name - it is deprecated (the session has one implicit team) and passing it triggers a 'session team not found' error; omit it. There is no TeamCreate/TeamDelete - the implicit session team is managed for you, and team-reaper.sh cleans up on session end. Coordinate via SendMessage + a shared TaskList. No exemptions - even a single Explore or Plan agent is a named teammate inside cmux. (If you truly need a silent background subagent, the user must explicitly ask for a background agent.)"

python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
