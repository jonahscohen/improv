---
name: launcher-subcommand-passthrough
description: Fixed discord and teams launcher scripts to pass through claude subcommands (agents, attach, logs, etc.) directly without prompting
type: project
relates_to: [session_2026-05-11_teams-launcher-reset.md]
---

## Problem

`claude agents` (and other subcommands like `attach`, `logs`, `stop`) don't work because the shell function wrappers intercept them. The Discord launcher (`discord-chat-launcher.sh`) and Teams launcher (`claude-teams-launcher.sh`) both define a `claude()` function that prompts about Discord/Teams before passing through to `command claude`. The `read` calls for those prompts consume stdin and/or the `--channels` flag interferes with the TUI, so `claude agents` just prints a static list and exits instead of launching the dashboard.

## Fix

Added early loop at the top of both `claude()` functions that skips flags (args starting with `-`) and checks the first positional arg against known subcommands: agents, attach, logs, stop, kill, respawn, rm. On match, passes through directly to `command claude "$@"` with no prompting.

First attempt used `case "$1"` which failed because the zsh alias `claude="claude --dangerously-skip-permissions"` expands before the function runs, making `$1 = --dangerously-skip-permissions` instead of `agents`. The loop-with-flag-skip approach handles this correctly.

## Deeper issue: cmux wrapper

The cmux app installs a claude wrapper at `/Applications/cmux.app/Contents/Resources/bin/claude` that's first in PATH. It injects `--session-id` and `--settings` flags for session tracking. It has its own passthrough list for subcommands (mcp, config, api-key, rc, remote-control) but does NOT include `agents`. When inside cmux, this causes `agents` to receive injected flags that break the TUI. Outside cmux, the wrapper's early passthrough (line 142, IN_CMUX=0 check) should forward cleanly, but need to verify.

Two `claude` binaries:
- `/Applications/cmux.app/Contents/Resources/bin/claude` - bash wrapper script (first in PATH)
- `/Users/spare3/.nvm/versions/node/v20.19.6/bin/claude` - real Mach-O binary

## Final fix (third iteration)

Two problems broke `claude agents`:
1. cmux wrapper at `/Applications/cmux.app/Contents/Resources/bin/claude` (first in PATH) injects `--session-id`/`--settings` flags
2. zsh alias `claude="claude --dangerously-skip-permissions"` prepends a flag that disables the TUI

Launcher functions now: skip flags (`-*`) to find the subcommand, iterate PATH with `${(s.:.)PATH}` to find the real binary (skipping cmux.app entries), strip `--dangerously-skip-permissions` from args, then call the real binary with clean args.

Verified: user screenshot confirmed TUI dashboard renders correctly.

Collaborator: Jonah

## Files touched

- `claude/discord-chat-launcher.sh` (symlinked to `~/.claude/discord-chat-launcher.sh`)
- `bin/claude-teams-launcher.sh` (symlinked to `~/.claude/claude-teams-launcher.sh`)

Collaborator: Jonah
