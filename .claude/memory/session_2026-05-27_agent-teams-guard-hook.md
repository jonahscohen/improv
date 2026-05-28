---
name: agent-teams-guard hook (2026-05-27)
description: PreToolUse hook blocks bare Agent calls when running inside cmux-teams; forces team_name+name teammate spawns so each agent gets a cmux split
type: project
relates_to: [decision_hook_layer_as_enforcement.md, decision_hook_system_architecture.md]
---

Collaborator: Jonah

## What

Wrote `claude/hooks/agent-teams-guard.sh` and wired it as a `PreToolUse` matcher `"Agent"` in `claude/settings.json`. When `CMUX_SOCKET_PATH` is set AND `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, every Agent call must include both `team_name` and `name` in `tool_input` - otherwise the hook returns `permissionDecision: "deny"` with a reason that names the required flow (TeamCreate -> Agent with team_name+name -> SendMessage -> TeamDelete).

Outside cmux-teams mode (regular shell, claude run without `cmux claude-teams`), the hook is a no-op (echoes `{}` and exits 0).

## Why

Verified earlier in the same session that the cmux claude-teams shim wires up `TMUX`, `TMUX_PANE`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, and `CMUX_SOCKET_PATH`, and that teammate agents (Agent + team_name + name) appear as native cmux splits with sidebar metadata - but bare `Agent` calls (subagent_type only, no team) still run silently in the parent pane. Demo: spawned alice/bob/carol into `split-test` team, each appeared as a colored split, coordinated via SendMessage, shut down via shutdown_request -> TeamDelete.

Jonah's preferred default when working inside cmux is the visible-split flow. Per AskUserQuestion answers (2026-05-27): hard block, no exemptions (every subagent type, including Explore/Plan, goes through the team flow).

## How

Hook script:
1. Skip when `CMUX_SOCKET_PATH` empty or `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS != 1` (no-op for non-cmux sessions).
2. Read tool_input from stdin via python3 `json.load`.
3. Pass when both `team_name` and `name` are non-empty.
4. Deny otherwise with a long-form reason that prescribes the four-step team flow.

Wiring: added a `{"matcher": "Agent", "hooks": [{"type": "command", "command": "~/.claude/hooks/agent-teams-guard.sh", "timeout": 5}]}` entry under `hooks.PreToolUse` in `claude/settings.json`.

Detection signal: requires BOTH `team_name` and `name` because team_name auto-inference from session context is documented but undocumented behavior; over-blocking the auto-fill case is preferable to letting bare subagents slip through. Claude can always re-issue with team_name explicit.

## Files touched

- `claude/hooks/agent-teams-guard.sh` (created)
- `claude/settings.json` (added PreToolUse entry for Agent)
