---
name: Remote Control prompt bypassed in cmux (teams launcher shadows the RC-bearing claude function)
description: RC y/N prompt only lives in the Discord launcher's claude() function; claude-teams-launcher.sh redefines claude() and routes cmux sessions to `cmux claude-teams`, which skips the RC passthrough. App-spawned cmux agents bypass zsh entirely.
type: project
relates_to: [session_2026-06-21_remote-control-launch-prompt.md]
---

Collaborator: Jonah Cohen

Jonah reported: "startup script for remote control works in terminal, not in cmux." Diagnosed below. RESOLVED same day - see [[session_2026-06-22_remote-control-cmux-fix.md]] (RC prompt now asked after the Teams prompt in the cmux/Teams launcher).

Root cause (evidence-backed, not theory):
- `~/.zshrc` sources `discord-chat-launcher.sh` (line 35) then `claude-teams-launcher.sh` (line 60). The RC prompt (the `[y/N, or 'never']` block) lives ONLY in the Discord launcher's `claude()`.
- The teams launcher's `_claude_teams_wrap` saves the Discord `claude()` as `_claude_teams_prev` and REDEFINES `claude()`. The new function:
  - Not inside cmux -> `_claude_teams_passthrough` -> `_claude_teams_prev` -> Discord/RC `claude()` -> RC prompt fires. THIS is the working terminal path.
  - Inside cmux (CMUX_WORKSPACE_ID set + cmux binary present) -> routes to `cmux claude-teams "$@"` (via `.teams-default-on` marker, or after the "Enable Claude Code Teams?" y/n/a/x prompt). That branch NEVER calls the RC passthrough, so the RC prompt is skipped.
- Separately, cmux app-launched agent sessions exec `cmux claude-teams --teammate-mode auto --dangerously-skip-permissions` directly (decoded from `CMUX_AGENT_LAUNCH_ARGV_B64`, kind=claudeTeams). That path never sources/runs `~/.zshrc`'s `claude()` at all.

Net: RC is structurally bypassed on every cmux entry path EXCEPT the narrow case of typing `claude` in an interactive cmux pane and then declining Teams.

Feasibility facts confirmed this session:
- `cmux claude-teams --help`: "forwards all remaining arguments to claude" -> appending `--remote-control` to `cmux claude-teams` WILL reach the real claude binary. Fix is feasible on the teams-launcher path.
- All markers absent at diagnosis time: `.teams-default-on`, `.skip-teams-launcher`, `.skip-remote-control`, discord `.skip-launcher`.
- cmux binary lives at `/Applications/cmux.app/Contents/Resources/bin/cmux`; not on the non-interactive PATH (resolved via ghostty/zsh integration in interactive panes only). The cmux `claude` shim (`$CMUX_CLAUDE_WRAPPER_SHIM`) execs `cmux-claude-wrapper`.

Fix scope to remember when implementing:
- A teams-launcher fix (prompt for RC / honor `.skip-remote-control` / forward `--remote-control` before `cmux claude-teams`) only covers the interactive-pane path.
- App-spawned cmux agent sessions can't be fixed from dotfiles - that needs cmux's own launch config to include `--remote-control`.

Files implicated:
- claude/discord-chat-launcher.sh (RC prompt block, lines 82-99)
- claude/claude-teams-launcher.sh (redefines claude(), routes cmux -> `cmux claude-teams`)
