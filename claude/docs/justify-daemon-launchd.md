# Justify daemon durability (launchd KeepAlive)

The Justify watch lives in the persistent :9223 daemon (`justify/server/`): armed
state on disk, daemon-spawned headless workers. The last mile is making that
daemon itself durable so a crash or a reboot brings it back. That is the job of
the `com.yesand.justify-serve` launchd user agent.

## What it does

`ProgramArguments` runs `node ~/.claude/justify/dist/server/index.js` directly in
the foreground as the job's main process, with `KeepAlive=true`. launchd
supervises the actual daemon process and restarts it if it ever exits.

Why node directly and NOT `justify-serve`: launchd tears down a job's process
group when the job's main process exits. `justify-serve` nohups node and returns,
so launchd reaped the backgrounded daemon every cycle - it flapped
(start -> reap -> restart every ~10s, daemons dying immediately). Running the
long-lived node process in the foreground is the correct KeepAlive pattern.

No port fight: justify is NOT registered as an MCP server, so nothing else
auto-spawns a competing daemon; and the daemon's own boot probe defers to a
healthy incumbent, so a manual `justify-serve` or a session can never fight this
one for the port.

On boot the daemon reads `~/.claude/justify/watch-state.json` and RESUMES armed
if it was armed - so "the watch never stops" holds across daemon restarts and
reboots.

## Install

`justify/install.sh` (and the top-level installer) place a templated copy at
`~/Library/LaunchAgents/com.yesand.justify-serve.plist`. Placement only -
activation is your choice.

## Activate / deactivate

```bash
# activate (load + start now)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yesand.justify-serve.plist

# check it is loaded
launchctl print gui/$(id -u)/com.yesand.justify-serve | head -20

# deactivate
launchctl bootout gui/$(id -u)/com.yesand.justify-serve
```

## Verify

```bash
# daemon answers, and reports watch state
curl -s http://localhost:9223/status
curl -s http://localhost:9223/watch/state

# kill the daemon; within ~10s the agent restarts it (armed state resumes)
kill "$(lsof -ti :9223)"; sleep 12; curl -s http://localhost:9223/status
```

Logs: `~/.claude/logs/justify-serve.launchd.log`.

## If you do NOT activate the agent

The daemon still starts the usual ways (the `justify` MCP server registration, or
`justify-serve` from a session / `/justify`). The launchd agent only adds
crash/reboot resilience; the watch-in-the-daemon behavior does not depend on it.
