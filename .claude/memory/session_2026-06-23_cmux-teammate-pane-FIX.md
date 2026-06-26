---
name: FIX - cmux agent-teams panes - shim script-wraps the harness respawn command (ROOT CAUSE FOUND)
description: Claude Code 2.1.186 spawns a teammate by respawn-pane'ing a cmux pane with a COMPOUND shell command (cd ... && env ... claude.exe --flags). cmux 0.64.16 __tmux-compat runs respawn/split/new-window commands via execvp on the whitespace-split string (NO shell), so the first token `cd` fails to exec, the pane dies, and the teammate never appears or runs. Fix - the user-owned tmux shim rewrites such compound commands into a one-token launch script. Proven to launch claude.exe in a persistent pane.
type: project
relates_to: [session_2026-06-23_cmux-teammate-pane-never-confirmed.md, session_2026-06-23_sidecoach-reference-integration-plan.md]
supersedes: session_2026-06-23_cmux-teammate-pane-never-confirmed.md
---

Collaborator: Jonah Cohen

## The ask
After two failed teammate spawns + diagnosis (the prior beat concluded "harness bug, work inline"), Jonah rejected inline: "Figure out a way to make agent teams work with splitting into new cmux panes. Priority. I don't wanna hear no." Refs he gave: https://code.claude.com/docs/en/agent-teams + https://cmux.com/docs/agent-integrations/claude-code-teams.

## How teammate panes are supposed to work (from the docs)
- `cmux claude-teams` launches claude with `--teammate-mode auto`, sets a fake tmux env (TMUX, TMUX_PANE), prepends a private tmux shim (`~/.cmuxterm/claude-teams-bin/tmux` -> `exec cmux __tmux-compat "$@"`) to PATH. The harness, detecting "inside tmux", uses the tmux backend and drives splits via tmux commands the shim translates to cmux splits.
- Claude Code display modes: in-process (default since v2.1.179) vs split-panes (needs tmux or iTerm2; explicitly NOT supported in Ghostty - and cmux is Ghostty-based, which is exactly why the shim fakes tmux). `auto` = split when inside tmux, else in-process. This session: v2.1.186, mode `auto`, detected tmux -> backendType:"tmux" in the team config. Detection worked; pane realization failed.

## ROOT CAUSE (traced, not theorized)
Instrumented the shim to log every tmux call during a real spawn. The harness's spawn sequence for a teammate:
1. `split-window -d -t <activePane> -v -P -F '#{pane_id}' -- cat`  (creates pane running `cat` placeholder)
2. set-option styles (yellow border), `select-pane -T <name>`, `select-layout main-vertical`, `resize-pane -t <lead> -x 30%`
3. `set-option -p -t <newpane> remain-on-exit failed`
4. `respawn-pane -k -t <newpane> -- cd <dir> && env CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 <path>/claude.exe --agent-id <n>@<team> --agent-name <n> --team-name <team> --agent-color <c> --parent-session-id <sid> --agent-type general-purpose --dangerously-skip-permissions --effort xhigh --model claude-opus-4-8`

Step 4's command is a COMPOUND shell string. cmux `__tmux-compat respawn-pane` does NOT run it through a shell - it splits on whitespace and execvp's it. First token `cd` is a shell builtin, not an executable -> exec fails -> the pane's command dies immediately -> pane closes (remain-on-exit=failed but it is gone) -> the teammate process never starts. Hence: registered in config.json with backendType:tmux + a tmuxPaneId, but no pane, unread inbox, no process. This also explains the 2026-06-22 "black box" and both of today's failed spawns.

Token-count tests on `respawn-pane -- <cmd>` (each into a fresh split pane, checked #{pane_dead}):
- `sleep 60` (2 tokens) -> ALIVE
- `/bin/sh` (1 token) -> ALIVE
- `/bin/sh -c 'exec sleep 60'` (3 tokens) -> DEAD
- single string `'sleep 60'` -> ALIVE (cmux splits to [sleep,60])
- compound `cd /tmp && sleep 60` -> DEAD
So cmux respawn/split exec breaks at 3+ tokens or any shell operator. Every component works in isolation: split-window persists, respawn-pane persists+swaps command (Part A), and claude.exe launches + renders its TUI and stays alive in a PTY (ran it via `script`, saw "Claude Code v2.1.186 / Opus 4.8 xhigh / @diag-direct / bypass permissions on"). Only the COMBINATION (compound respawn command through cmux) fails.

## THE FIX (proven)
Wrap the compound command in a one-token launch script. PROOF, into a real cmux pane via the harness's exact split+respawn:
- script body `cd /tmp && exec sleep 60` -> pane PERSISTS (cmd=tw-proof.sh).
- script body = the REAL teammate `env ... claude.exe --agent-id wrap-test ...` -> pane PERSISTS (cmd=tw-claude.sh) AND `ps` shows a live `claude.exe --agent-id wrap-test@session-14672cde` (pid 3876). 
The shim (`~/.cmuxterm/claude-teams-bin/tmux`, a user-owned file, symlinked-from nothing - it is cmux-generated but editable) is rewritten so that for respawn-pane/split-window/new-window, if the command after `--` has a shell operator or >2 whitespace tokens, it is written to `${TMPDIR}/cmux-teammate-launch/launch-<pid>-<rand>.sh` (`#!/bin/bash` + the command) and the command is replaced by that single script path. All other tmux calls pass through untouched. Stock shim backed up at `tmux.orig`; restore by copying it back.

## Why this is the right layer
The bug is cmux's, not Claude Code's (Claude emits a legit tmux respawn command; real tmux would shell-run it). cmux's tmux-compat is incomplete. We cannot patch the cmux binary, but the shim sits between the harness and `cmux __tmux-compat` and is the intended extension point (it already exists solely to translate). Wrapping is transparent and only triggers on the exact failing shape.

## SECOND BUG found during end-to-end test (the fix-gate caught it)
First production shim still failed end-to-end: no pane, no process. Re-added trace logging and saw the harness calls `tmux -S <socket> respawn-pane ...` - the `-S <socket>` PREFIX. My is_spawn detector scanned for "the first non-flag token" and treated the socket-path VALUE (after `-S`) as a foreign subcommand, bailing BEFORE reaching `respawn-pane`, so it never rewrote. Unit tests passed only because they omitted the `-S <socket>` prefix the real harness always sends (classic fix-#2 trap). Fix: detect by scanning ALL args for the keyword (respawn-pane|split-window|new-window), ignoring position/flags entirely.

## VERIFIED END-TO-END (pane-verify3, 03:05)
Spawned a verification teammate via the Agent tool with the corrected shim live. All signals green:
- Shim rewrote the respawn -> launch-<pid>-<rand>.sh containing the real `cd ... && env ... claude.exe ...`.
- NEW cmux pane `%7676...` running the launch script, AND a NEW cmux SURFACE `surface:39 "general-purpose"` appeared and was FOCUSED (visible split for the teammate).
- Teammate process ALIVE: `claude.exe --agent-id pane-verify3@session-14672cde` (pid 11310).
- `capture-pane` of the teammate pane shows a full Claude Code TUI (@pane-verify3, status bar "project sidecoach branch main +95 -168", token meters, "Sautéed for 26s · 41659 tokens") - it actually ran and did work.
- Teammate EXECUTED its assigned task: wrote /tmp/teammate-pane-proof3.txt. 
So a teammate now spawns into a real visible cmux pane AND runs AND does work. PRIORITY task #5 DONE.

## Production shim final form
- Logging is opt-in via `CMUX_SHIM_TRACE=/path/to/log` (off by default; no per-call /tmp litter).
- Detection scans all args for the keyword; `--` separator found by scan; compound/multi-token `-- command` (shell op or >2 whitespace tokens) is written to `${TMPDIR}/cmux-teammate-launch/launch-<pid>-<rand>.sh` and replaced by that path; opportunistic cleanup of launchers older than 120 min; everything else passes through.

## PATH fix (node/npm) - DONE
cmux spawns the teammate pane with a MINIMAL PATH (cmux shims + system dirs only): no node/npm/brew. Verified via a node-check probe: `node=MISSING npm=MISSING`. This breaks any teammate that builds/tests (e.g. the sidecoach `npm run build` deliverable) and was the cause of the teammate Stop-hook `node: command not found`. Fix: the shim now bakes the LEAD's full PATH into the generated launch script (`printf 'export PATH=%q\n' "$PATH"` - the shim runs in the lead's env, which includes nvm node). Verified end-to-end: a fresh teammate reports `node=/Users/spare3/.nvm/versions/node/v20.19.6/bin/node npm=.../npm nodever=v20.19.6`. Teammates now have the same toolchain as the lead.

## DURABLE INSTALL - DONE (2026-06-23)
The fix lives in `~/.cmuxterm/claude-teams-bin/tmux`, which cmux REGENERATES (stock = tmux.orig) on each `cmux claude-teams` launch, so it must be re-planted every session. Made durable, modeled on node-shim-heal.sh:
- Canonical fixed shim committed to the repo: `claude/cmux/teammate-tmux-shim` (symlinked at `~/.claude/cmux`).
- SessionStart hook `claude/hooks/cmux-teammate-shim-heal.sh`: if inside cmux-teams and the live shim lacks the `cmux-teammate-launch` marker, backs up stock to tmux.orig (once) and copies the canonical over it. Idempotent + non-blocking. TESTED: revert live shim to stock -> heal reinstalls the fix -> second run is a no-op.
- Wired into both `~/.claude/settings.json` and repo `claude/settings.json` SessionStart group 0 (after node-shim-heal); install.sh adds the hook to CONFIG_HOOKS and symlinks `~/.claude/cmux`. Verified: install.sh `bash -n` clean, full chain state all YES.
Long-term, upstream the real bug to cmux (its __tmux-compat respawn-pane/split-window should run the pane command via a shell like real tmux, instead of execvp on the whitespace-split string).

## Files
- ~/.cmuxterm/claude-teams-bin/tmux (production fix; tmux.orig = stock backup) - NOTE: regenerated by cmux per session; not yet durably installed
- claude/hooks/agent-teams-guard.sh (notice reverted: panes work again)
- .claude/memory/session_2026-06-23_cmux-teammate-pane-FIX.md (this)
