---
name: reference_cmux_agent_teams_flag_unset
description: Agents run IN-PROCESS (no cmux panes) when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is unset, even inside cmux with the shim fix installed. The flag is a LAUNCH-TIME decision; cannot be enabled mid-session. Distinct from the orphan-config bug.
type: reference
relates_to: [reference_cmux_team_init_orphan_bug.md]
---

Diagnosed 2026-06-24 (Jonah) when spawned Agents (2x Explore + 1 Codex review) did NOT open as cmux panes - they ran as standard in-process Claude Code subagents and returned results INLINE.

## Root cause (proven, not guessed)
`agent-teams-guard.sh` engages teams mode ONLY when BOTH are true:
`[ -n CMUX_SOCKET_PATH ] && [ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS == 1 ]`.
This session had `CMUX_SOCKET_PATH` set but **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` UNSET**. So the guard no-ops (`echo '{}'`), Agent calls fall through to in-process subagents, and `~/.claude/teams/` stays EMPTY (no team initialized).

## This is NOT "the fix broken"
The tmux-shim fix (commit d6232b3e, [[reference_cmux_team_init_orphan_bug]] sibling) is INTACT: `~/.cmuxterm/claude-teams-bin/tmux` has the `cmux-teammate-launch` marker (fixed copy + `.orig` backup). The shim only matters once the harness is ROUTING spawns to panes; with the experimental flag off, the harness never routes to teams at all. The shim is downstream of the flag.

## The decisive tells (how to recognize this fast)
1. `~/.claude/teams/` is EMPTY (no `session-<id>/` dir) - no team was initialized.
2. `Agent(...)` calls RETURN RESULTS INLINE (in-process behavior). A real teammate pane does NOT return inline; you coordinate via SendMessage/inboxes.
3. `echo "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"` prints empty.
4. `CLAUDE_CODE_CHILD_SESSION=1` was also set - this looked like a resumed/child session that came up WITHOUT the teams launch env (likely how the flag got dropped).

## Cannot fix mid-session
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is read by the Claude Code harness (the running `claude` PID) at STARTUP to decide Agent routing. `export`ing it in a Bash subshell does NOT change the already-running harness. Same constraint class as the orphan-bug ([[reference_cmux_team_init_orphan_bug]]): teams init is launch-time only. To get panes: RELAUNCH the session in cmux agent-teams mode so the flag is present at startup.

## VERIFY-BEFORE-RELY rule (the failure that triggered this)
The lead earlier saw the empty teams dir, flagged uncertainty, then declared "spawning works" because the Agent calls RETURNED. Conflated "tool returned a result" with "teammate opened in a pane." FIX: in cmux, before relying on pane-based teammates, confirm `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` AND a populated `~/.claude/teams/session-<id>/`. Treat an INLINE Agent return as proof of IN-PROCESS execution, never of pane spawning.
