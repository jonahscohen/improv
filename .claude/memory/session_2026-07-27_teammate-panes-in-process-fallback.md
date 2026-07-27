---
name: teammate panes silently fell back to in-process
description: Named teammates spawned with no cmux pane because TMUX was unset in a background-job session; agent-teams-guard.sh asserts a tmux backend it never verifies
type: project
relates_to: [feedback_cmux_teardown_dead_subagents.md]
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: team config.json backendType inspected across four sessions, TMUX/TMUX_PANE confirmed unset, shim confirmed present and on PATH
confidence: high
---

Jonah caught it immediately: two named teammates were spawned and no cmux panes appeared.

## What actually happened

Both teammates registered in `~/.claude/teams/session-c3ca5a31/config.json` as:

    "backendType": "in-process",  "tmuxPaneId": "in-process"

Not a failed tmux pane - the tmux backend was never selected at all.

**Root cause: `TMUX` and `TMUX_PANE` are unset in this session.** It runs as a background
job, so it has no tmux pane context to split from. Claude Code's agent-teams picks the
tmux backend only when it is inside a tmux session; otherwise every spawn silently becomes
an in-process subagent. Confirmed across all four of today's team sessions: `team-lead`
itself is `backendType: in-process` in every one, so this session was never pane-capable.

**Ruled out, with evidence:** the 2026-06-23 tmux-shim fix. `~/.cmuxterm/claude-teams-bin/tmux`
is present, is the FIXED variant (its header comment carries the launch-command fix), was
rebuilt today at 05:03, and its directory IS on PATH. It was simply never reached, because
Claude Code never decided to shell out to tmux.

## The hook bug this exposed

`agent-teams-guard.sh` treats `CMUX_SOCKET_PATH` + `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
as proof that the tmux backend is live. It never checks whether the backend actually
resolved to tmux. Two consequences, both seen live:

1. It DENIED `Agent(run_in_background: true)` with "Re-issue WITHOUT run_in_background for
   a visible teammate that renders as its own cmux pane" - advice that could not be honoured
   in this session.
2. It then permitted the named spawn with the notice "renders as its own visible cmux pane",
   which the runtime did not deliver.

The gate is correct in principle and wrong in this session type. The fix is for it to detect
the in-process fallback (no `TMUX`/`TMUX_PANE`, or the lead's own `backendType` in the team
config) and either stay quiet or say plainly that named spawns will be invisible here.
NOT YET FIXED - recorded for the next session.

## What `cmux claude-teams` actually does

Per `cmux claude-teams --help`: defaults teammate mode to auto, **sets a tmux-like
environment so Claude auto mode uses cmux splits**, sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`,
and prepends the private tmux shim to PATH. That first item is the one that was missing -
a session launched any other way has no tmux env, so panes are impossible regardless of
how the spawn is written.

## Disposition

Jonah ruled: kill both and relaunch under `cmux claude-teams` rather than let them finish
invisibly. Both teammates were sent `shutdown_request`, both terminated, and `git status`
confirmed they left ZERO edits in the working tree - nothing partial to clean up or
reconcile. The two briefs (ampersand self-heal; installer component coverage) are unstarted
and will be re-dispatched in the relaunched session.

## Resolution (same day, relaunched session)

Confirmed fixed by relaunching under `cmux claude-teams`. In the new session `TMUX` and
`TMUX_PANE` are both set, and the two re-dispatched teammates registered in
`~/.claude/teams/session-d883bc0d/config.json` with real pane ids
(`tmuxPaneId: "%3758217172824774125"` and a sibling) instead of `"in-process"`.
`tmux list-panes -a` shows three panes: the lead plus both teammates.

Note for the hook fix that is still outstanding: `team-lead` itself remains
`backendType: in-process` even in a working session, so the lead's own backendType is NOT
a usable signal for detecting the fallback. The reliable precondition is `TMUX`/`TMUX_PANE`
being set, plus a spawned member's `tmuxPaneId` not being the literal string `in-process`.

Both briefs (ampersand self-heal; installer coverage closure) were re-dispatched from the
prior beats rather than restated, so no investigation was repeated.

## Files touched

- none (diagnosis only)
