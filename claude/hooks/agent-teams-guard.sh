#!/bin/bash
# PreToolUse hook for Agent (and a hard block on Workflow) inside cmux-teams.
# When running inside cmux with the agent-teams shim active, gate Agent calls so
# they take the correct teammate form, and reject the spawn shapes that are
# guaranteed NOT to produce a visible teammate.
#
# Detection: CMUX_SOCKET_PATH set AND CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
# Outside that combination (regular shell, or claude run without the cmux
# claude-teams wrapper), the hook is a no-op.
#
# Decisions in cmux-teams mode:
#   - Workflow tool            -> DENY  (silent in-process subagents, never a split)
#   - Agent missing `name`     -> DENY  (an unnamed agent is not a teammate)
#   - Agent run_in_background  -> DENY  (background = in-process = INVISIBLE; can
#                                        never be a pane. Exception: the user
#                                        explicitly asked for a background agent.)
#   - Named foreground Agent   -> ALLOW + attach a KNOWN-ISSUE notice (below)
#
# HISTORY (2026-06-23, Jonah): an earlier version asserted "name is what makes a
# teammate a visible cmux split" and passed any named spawn. Named spawns were in
# fact NOT rendering as panes. Root cause was traced and FIXED
# (session_2026-06-23_cmux-teammate-pane-FIX.md): the harness spawns a teammate by
# `respawn-pane`'ing a cmux pane with a COMPOUND command (cd ... && env ...
# claude.exe ...); cmux's __tmux-compat runs respawn/split commands via execvp on
# the whitespace-split string (no shell), so the first token `cd` (a builtin)
# fails and the pane dies. The user-owned tmux shim
# (~/.cmuxterm/claude-teams-bin/tmux) now wraps such compound commands in a
# one-token launch script, and teammates render + run correctly (verified: a
# spawned teammate appeared as cmux surface:39 with a live claude.exe process that
# executed its task). So: `name` is required AND now sufficient for a visible
# pane, PROVIDED the shim fix is in place (cmux regenerates the stock shim per
# session). The pass-path notice points the spawner at that dependency.
# team-reaper.sh cleans up the per-session team/task dirs on session end.

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

emit_deny() {
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$1"
  exit 0
}

emit_allow_with_notice() {
  # No permissionDecision -> the tool proceeds via the normal permission flow;
  # additionalContext surfaces the notice without ever blocking the call.
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','additionalContext':sys.argv[1]}}))" "$1"
  exit 0
}

# Workflow spawns silent in-process subagents that can never appear as cmux
# splits. In cmux-teams mode that defeats the team flow, so it is hard-blocked.
if [ "$TOOL_NAME" = "Workflow" ]; then
  emit_deny "BLOCKED: the Workflow tool spawns silent in-process subagents that cannot appear as cmux splits. This session is inside cmux with agent-teams enabled (CMUX_SOCKET_PATH set, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1). Do NOT use Workflow here. Spawn a named teammate instead: Agent({subagent_type, name, prompt}) - and do NOT pass team_name (deprecated; the session has one implicit team). Coordinate via SendMessage and a shared TaskList."
fi

# Only gate the Agent tool from here. Anything else passes through.
if [ "$TOOL_NAME" != "Agent" ]; then
  echo '{}'
  exit 0
fi

NAME=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print((d.get("tool_input") or {}).get("name","") or "")' 2>/dev/null)

RUN_BG=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
v=(d.get("tool_input") or {}).get("run_in_background", False)
print("1" if v in (True,"true","True",1) else "0")' 2>/dev/null)

# Missing name: not a teammate. Block.
if [ -z "$NAME" ]; then
  emit_deny "BLOCKED: inside cmux with agent-teams enabled, every Agent call must spawn as a NAMED teammate so it gets its own visible cmux pane. Re-issue with a name: Agent({subagent_type, name, prompt}). Do NOT pass team_name (deprecated; passing it triggers a 'session team not found' error). Coordinate via SendMessage + a shared TaskList."
fi

# Background = invisible. A background subagent runs in-process and can NEVER be a
# cmux split/pane. Block unless the user explicitly asked for a background agent.
if [ "$RUN_BG" = "1" ]; then
  emit_deny "BLOCKED: run_in_background:true makes an INVISIBLE in-process subagent - it can never appear as a cmux pane/split. You named the agent to make it a visible teammate, then set run_in_background, which defeats that. Re-issue WITHOUT run_in_background for a visible (foreground) teammate that renders as its own cmux pane. Use run_in_background ONLY if the user EXPLICITLY asked for a background/invisible agent."
fi

# Named foreground Agent - the correct teammate form. Allow, with a note about
# the shim dependency that makes panes actually render here.
emit_allow_with_notice "Named teammate spawn permitted - it renders as its own visible cmux pane. This depends on the tmux-shim fix at ~/.cmuxterm/claude-teams-bin/tmux: cmux's __tmux-compat cannot run the harness's compound respawn command (cd ... && env ... claude.exe ...) so the shim wraps it in a one-token launch script (see session_2026-06-23_cmux-teammate-pane-FIX.md). cmux REGENERATES the stock shim per 'cmux claude-teams' launch, so if a teammate ever fails to appear or run, re-apply that shim fix (stock backup: tmux.orig). Verify with 'tmux list-panes -a' / 'cmux list-panels' / 'ps aux | grep claude.exe'."
