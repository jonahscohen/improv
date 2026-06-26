---
name: ROOT CAUSE - Teams/Remote-Control/Discord startup prompts all dead because cmux APP-launched sessions exec the bare claude binary and never source ~/.zshrc (the claude() wrapper that hosts all three prompts never runs)
description: Jonah reported "startup hooks for teams, remote control and discord not working." Traced to a single structural cause - this session's CMUX_AGENT_LAUNCH_KIND=claude and CMUX_AGENT_LAUNCH_ARGV_B64 decode to the bare `claude` binary path with NO flags. cmux app-spawned agent sessions exec claude directly without a login/interactive shell, so ~/.zshrc is never sourced, so the claude() wrapper functions (Teams prompt in claude-teams-launcher.sh, RC + Discord prompts in discord-chat-launcher.sh) never execute. Nothing in the dotfiles is broken; the entry point skips all of it. Fix must live in cmux's launch config (automation.claudeBinaryPath wrapper, or launch via a login shell, or launch as the claudeTeams kind), not the dotfiles. Plus a secondary bug: ~/.config/cmux/settings.json is a dangling symlink to the renamed-away claude-dotfiles repo.
type: project
relates_to: [session_2026-06-22_remote-control-cmux-bypass-diagnosis.md, session_2026-06-22_remote-control-cmux-fix.md, session_2026-06-23_cmux-teammate-pane-FIX.md]
---

Collaborator: Jonah Cohen

## The report
"claude startup hooks for teams, remote control and discord not working." Three subsystems, all dark at once - which pointed at a single common dependency rather than three separate failures.

## What was ruled OUT (evidence, not theory)
- SessionStart hooks all exit 0: startup-check.sh, team-reaper.sh, cmux-teammate-shim-heal.sh, node-shim-heal.sh, and `node ~/.nyx/hook-bridge.cjs claude-code session-start`. None crash. So the breakage is functional, not a failing hook. (nyx is a separate GUI agent-runner per [[reference_what_nyx_is.md]], not the teams/RC/discord backbone - confirmed unrelated.)
- Both launcher files parse clean (`zsh -n` OK) and are sourced from ~/.zshrc (discord line 35, teams line 60). Their symlinks resolve into improv/.
- No skip-markers present: .skip-teams-launcher, .teams-default-on, .skip-remote-control, channels/discord/.skip-launcher all ABSENT.
- The `alias claude="claude --dangerously-skip-permissions"` (zshrc line 30) is a RED HERRING - empirically tested (`zsh -f` stub): with the alias present, the `claude()` FUNCTION still runs. zsh expands the alias once, then the de-aliased word resolves to the function. `whence -w` reporting "alias" does not mean the function is bypassed.
- Discord is actually WARM, not cold: bot token present in Keychain, access.json allowFrom count = 1. So Discord WOULD prompt if the wrapper ran. Not a setup problem.

## ROOT CAUSE (confirmed from this session's own env)
All three prompts live ONLY inside the `claude()` shell wrapper functions:
- Teams "Enable Claude Code Teams?" prompt -> bin/claude-teams-launcher.sh
- Remote Control "Start with Remote Control enabled?" prompt -> discord-chat-launcher.sh (and mirrored in the teams launcher)
- Discord "Connect to Discord Chat Agent?" prompt -> discord-chat-launcher.sh

This session was launched by the cmux APP exec'ing the bare binary directly:
- `CMUX_AGENT_LAUNCH_KIND=claude`
- `CMUX_AGENT_LAUNCH_ARGV_B64` decodes to exactly `/Users/spare3/.nvm/versions/node/v20.19.6/bin/claude` (no `--remote-control`, no `--channels`, no `--teammate-mode`)
- `CMUX_AGENT_LAUNCH_EXECUTABLE` = the same bare claude path
- live session JSON contains plain `claude` with none of the teams/RC/channels flags

An app-spawned exec of the binary does NOT go through a login/interactive zsh, so ~/.zshrc is never sourced, so the `claude()` wrapper never exists in that process, so all three prompts/flags are skipped. This is the same bypass diagnosed for RC alone on 2026-06-22 ([[session_2026-06-22_remote-control-cmux-bypass-diagnosis.md]] - "App-spawned cmux agent sessions ... never source/run ~/.zshrc's claude() at all"), now generalized: it kills Teams and Discord identically. The 2026-06-22 RC fix only covered the typed-`claude`-in-a-pane path, explicitly NOT the app-spawn path.

## The fix lever
cmux's `automation.claudeBinaryPath` (in ~/.config/cmux/cmux.json, currently commented out / app-default) is documented in the app bundle as "claude binary executable path / cli command (custom)". Pointing it at a wrapper script is a supported way to change what cmux execs as "claude". Candidate fixes (decision pending Jonah):
1. Wrapper script at automation.claudeBinaryPath that injects flags / re-runs the prompt logic, then execs real claude (dotfiles-owned, restores all three at the app layer). Caveat: Teams pane mode re-invokes `cmux claude-teams`, recursive from inside a launch; and y/N prompts in an agent pane may need non-interactive defaults.
2. Launch via the "Claude Teams" agent kind (gives real panes per [[session_2026-06-23_cmux-teammate-pane-FIX.md]]) and forward --remote-control / --channels through `cmux claude-teams`.
3. Point the launch at an interactive login shell (`zsh -ic claude`) so the existing tested wrapper + prompts run unchanged.

## FIX IMPLEMENTED (Jonah chose the wrapper-script option, 2026-06-24)
Approach: a committed wrapper becomes what cmux execs as "claude", reusing the EXACT tested launcher logic (no duplicated prompt code = single source of truth).

- `claude/cmux/cmux-claude-launch.sh` (live at ~/.claude/cmux/cmux-claude-launch.sh via the existing dir symlink). It: resolves the real non-cmux claude (PATH scan skipping *cmux*, with fallbacks); passes straight through (exec real claude) when re-entered (`_CMUX_CLAUDE_WRAP_ACTIVE`), when it's a teams/teammate launch (`--teammate-mode`/`--agent-id`/... args or `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env), or when not an interactive TTY (headless/-p/--version probes); otherwise sanitizes PATH (drops cmux-cli-shims so the launchers' `command claude` hits the real binary, keeps cmux.app bin), sources the same two launchers ~/.zshrc uses, and calls their `claude()`. Recursion via `cmux claude-teams` (Teams=y) is caught by the guard on re-entry. `_CCL_ASSUME_TTY=1` is a documented test-only override of the TTY gate.
- cmux config: `~/.config/cmux/cmux.json` is the PRIMARY config (`cmux config` confirms; settings.json is "legacy"). Added a live `automation.claudeBinaryPath` -> the wrapper. Backed up cmux.json first (cmux's own guidance), `cmux config doctor` = valid JSONC, `cmux reload-config` = OK. `cmux config set` only does font sizes, so this had to be a direct JSONC edit.

Verification:
- Hermetic test `claude/cmux/test-cmux-claude-launch.sh` (stubs claude/cmux/security): 7/7 PASS - recursion guard, teammate-flag passthrough (flags intact), teams-env passthrough, non-tty bypass, resolution skips cmux-cli-shims, interactive decline-all -> plain real claude, Teams=y -> `cmux claude-teams`. (Found+fixed a harness bug: `((pass++))` returns false on first call, firing both && and || branches.)
- REAL PTY test (no override): all three prompts RENDER in order Teams -> Remote Control -> Discord; decline-all launches real claude; cmux not called; shim never ran. Proves the `[ -t 0 ] && [ -t 1 ]` gate passes and prompts display under a genuine terminal.
- NOT yet confirmed by me (honest gap): that cmux, on a fresh agent launch, actually execs the wrapper and gives it a PTY. Config is set+valid+reloaded and the wrapper is proven correct when exec'd with a tty - but the end-to-end "open a new cmux Claude session and see the prompts" is Jonah's to confirm. On his machine Discord is WARM so the 3rd prompt is "Connect to Discord Chat Agent? (y/n)", not the COLD setup shown in the stubbed test.

Codex cross-model review (mandate #8) - findings FOLDED + re-verified:
- HIGH: bare-name `claude` fallback could recurse into the cmux shim + `${var:h}` -> `.` PATH prepend. FIXED: fail hard (exit 127) unless an ABSOLUTE non-cmux claude resolves.
- MED: `-p/--print/--version/--help` would pass the tty gate and block on prompts. FIXED: explicit probe-flag passthrough.
- MED: teammate detection missed `--flag=value` form. FIXED: match both space and =value forms.
- LOW: PATH skip on substring "cmux" too broad. FIXED: skip only cmux-cli-shims/cmux.app/.cmuxterm dirs.
- TEST GAPS: made the suite fully hermetic (sandbox HOME + symlinked launchers; no dependence on real markers/token) and added REAL PTY cases (Teams=y -> RC -> `cmux claude-teams [--remote-control]`). Suite now 11/11.
- LOW (KEPT by choice): non-exec leaf (wrapper stays a thin parent). Rationale documented in the wrapper: reuse-over-duplication; foreground claude owns the pty so SIGWINCH/SIGINT reach it.

## Secondary bug (repo rename fallout)
`~/.config/cmux/settings.json` is a DANGLING symlink -> `/Users/spare3/Documents/Github/claude-dotfiles/cmux/settings.json`. That repo was renamed to `improv` (git remote = jonahscohen/improv.git). The correct target `improv/cmux/settings.json` EXISTS (6120 bytes). cmux treats the dangling link as "missing" and falls back to its Application Support settings. Re-pointing it would swap the effective cmux settings (sidebar/shortcuts/notifications) to the repo's version - a behavior change, so surfaced for Jonah's call rather than auto-applied. Only this one dangling claude-dotfiles symlink was found under ~/.claude and ~/.config.

## Files inspected (no edits yet)
- ~/.zshrc (lines 30/35/60), bin/claude-teams-launcher.sh, claude/discord-chat-launcher.sh
- ~/.config/cmux/cmux.json, the dangling ~/.config/cmux/settings.json
- SessionStart hook config in settings.json; all SessionStart hooks run manually
