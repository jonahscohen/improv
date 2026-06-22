---
name: Remote Control prompt wired into the cmux/Teams launcher (asked after the Teams prompt)
description: claude-teams-launcher.sh now asks the RC y/N question after the Teams prompt, honors .skip-remote-control, and forwards --remote-control to `cmux claude-teams`. RC takes precedence over Discord (matches terminal launcher). Verified with a hermetic 4-case behavioral test.
type: project
relates_to: [session_2026-06-22_remote-control-cmux-bypass-diagnosis.md, session_2026-06-21_remote-control-launch-prompt.md]
---

Collaborator: Jonah Cohen

Fixes the diagnosed bug ([[session_2026-06-22_remote-control-cmux-bypass-diagnosis.md]]): RC prompt never fired on the cmux path. Jonah's chosen behavior (via AskUserQuestion "Other"): "In cmux, the prompt for remote control should come after the prompt about teams."

What changed in `bin/claude-teams-launcher.sh` (the canonical source; `~/.claude/claude-teams-launcher.sh` symlinks to it, so the edit is live for any NEW shell - current already-sourced sessions won't see it):
- Added `_claude_teams_maybe_rc`: mirrors the terminal RC block from discord-chat-launcher.sh - prints `Start with Remote Control enabled? [y/N, or 'never' to stop asking]`, honors the same opt-out marker (`${RC_SKIP_FILE:-$HOME/.claude/.skip-remote-control}`), and on `never` writes that marker. Sets `_CLAUDE_TEAMS_RC=1` on yes.
- Reworked `_claude_teams_launch`: calls `_claude_teams_maybe_rc` FIRST (which is after the Teams y/n/a/x prompt, since that prompt runs in `claude()` before `_claude_teams_launch` is invoked). If RC=yes -> `cmux claude-teams --remote-control "$@"` and return, SKIPPING the Discord question. Else falls through to the existing Discord branch.
- Ordering achieved: Teams prompt -> RC prompt -> (Discord prompt only if RC declined). RC-before-Discord and RC-short-circuits-Discord both match the terminal launcher's documented precedence ([[session_2026-06-21_remote-control-launch-prompt.md]]).

Why RC short-circuits Discord on this path too: keeps the two launchers semantically aligned with the original RC decision (opting into RC means "no Discord question"). If Jonah later wants RC + Discord simultaneously inside Teams, that branch is a one-line change.

Feasibility confirmed earlier: `cmux claude-teams --help` says it "forwards all remaining arguments to claude", so `--remote-control` reaches the real binary.

Verification (hermetic zsh test, stub `cmux` recording argv, forced-COLD Discord, simulated inside-cmux via CMUX_WORKSPACE_ID): 4/4 PASS.
- T1 Teams=y/RC=y -> `claude-teams --remote-control`
- T2 Teams=y/RC=n -> `claude-teams`
- T3 Teams=y/RC=never -> marker created + `claude-teams`
- T4 Teams=y (marker present) -> RC prompt skipped + `claude-teams`
`zsh -n` clean.

Scope NOT covered (unchanged, still true): cmux app-spawned agent sessions exec `cmux claude-teams --teammate-mode auto ...` directly, bypassing `~/.zshrc`'s `claude()` entirely. Getting RC there requires a cmux launch-config change, outside the dotfiles. This fix covers typing `claude` in an interactive cmux pane.

Files touched:
- bin/claude-teams-launcher.sh (added _claude_teams_maybe_rc; RC branch + short-circuit in _claude_teams_launch; header comment)
