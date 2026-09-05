---
name: Paseo split spawning from inside a Paseo agent
description: How to spawn visible Paseo splits via the bundled CLI, the --background=headless gotcha, and the self-screenshot permission blocks
type: reference
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (CLI ran, logs confirmed); browser-verify blocked by macOS perms
confidence: high
---

This session runs INSIDE the Paseo desktop app as a Paseo agent. Env exposes it:
`PASEO_CLI=/Applications/Paseo.app/Contents/Resources/bin/paseo`, `PASEO_AGENT_ID`, `PASEO_AGENT_CWD`.
Daemon on 127.0.0.1:6767 (desktopManaged). App/docs: app.paseo.sh, paseo.sh/docs.

**Spawning a split (sibling agent) = the bundled CLI, not the Agent tool.** No `mcp__paseo__*`
tools were exposed to this session ("Enable Paseo tools" off), so `$PASEO_CLI run` is the path.

- `paseo run --provider <p> "<task>"` spawns a sibling agent in the caller's workspace (improv).
- `--provider` is REQUIRED (else `MISSING_PROVIDER`). Available: claude, codex, opencode (copilot/pi/omp unavailable).
- Provider can carry a model: `--provider codex/gpt-5.4`.
- `--new-workspace local|worktree` isolates the split; default is same workspace/branch.
- CLI version 0.6.1.

**GOTCHA - `--background` (-d) runs the agent HEADLESS: no visible split pane in the desktop UI.**
First greeting agent (1c68974e) was spawned with `--background` and ran fine (logs showed
"Hey Jonah, good to see you. Ready when you are.") but Jonah observed NO visual split - because
background = no pane. To get a VISIBLE split, OMIT `--background`.

**Self-screenshot from inside the Paseo agent is blocked by macOS TCC:**
- `screencapture -x` (full display) -> "could not create image from display" (Screen Recording denied to this process).
- `osascript`/System Events window targeting -> "not allowed assistive access" (-1719) (Accessibility denied).
- A bare `screencapture -l<wid>` with a malformed wid captured the wrong window (an empty "Applications"
  panel), not the agent view. So I cannot reliably self-verify the Paseo UI visually from here; visual
  confirmation of a split has to come from Jonah's eyes or a granted Screen-Recording perm.

**Other-agent boundary:** an icon-system agent is actively building in improv (icon-cascade-guard.sh,
PENDING-icon-cascade beat). Do not touch icon-cascade-guard.sh / browser-tree.json / install.sh /
app-wirings.json - that packaging is theirs. The Stop hook that blocks on the unpackaged
icon-cascade-guard was answered "deliberately unpackaged, belongs to another agent".

Collaborator: Jonah.

Files touched: none (spawned Paseo agents via CLI; wrote this beat).
