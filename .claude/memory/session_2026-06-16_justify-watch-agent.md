---
name: Justify watch delegated to a background teammate agent
description: Spun up agent justify-watcher to own the justify watch loop for the marketing site; resolved a double-poller race; single agent-owned poller is the steady state
type: project
relates_to: [reference_dev_servers_ports.md, session_2026-06-15_justify-on-marketing-site.md]
---

Jonah asked to spin up the marketing site, then spin up an agent tasked with justify watch.

What was done:
- Marketing site served at http://localhost:4830 via `marketing-site/serve.py` (no-cache). Verified HTTP 200.
- Justify daemon was already up on 9223 (node PID 56577), queue empty, `~/.claude/.justify-watch-on` flag ON, `justify-watch-guard.sh` Stop hook present.
- Found a STRAY `justify-watch.sh` poller from a prior session (foreground-blocked, different tmp prefix claude-0e50 vs my claude-502). Killed it to avoid two pollers double-catching the same browser prompt.
- Spawned background teammate agent `justify-watcher` (agent_id justify-watcher@session-fdc569b7) to own the full watch loop: wait on /tmp/justify-inbox.json -> working -> apply tweak to marketing-site source -> validating + curl-grep verify -> justify-done with an ISOLATED per-file diff (git diff --no-index against a /tmp pre-image snapshot, because marketing-site already has unrelated uncommitted edits) -> clear + relaunch poller. One poller alive at all times.

Race I hit and fixed:
- I seeded a main-owned poller AND the agent launched its own at startup -> 2 pollers (58391 + 59403). Converged to single ownership by killing my main seed (58391, SIGTERM -> exit 143, expected), leaving the agent-owned poller (59403). Stop-hook guard (pgrep -f justify-watch.sh) still satisfied by the remaining one.

Mechanics worth remembering:
- cmux agent-teams mode (CMUX_SOCKET_PATH + CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1) BLOCKS silent in-process Agent calls. Must pass both `name` AND `team_name` to Agent so the teammate gets a visible cmux split. There is a single implicit team - no separate TeamCreate tool is loadable.
- Justify prompt object schema (server/mcp-tools.ts): { id: "prompt-N", context, prompt, elementCount, timestamp }. Inbox /tmp/justify-inbox.json is the raw /prompts array. `id` is the promptId passed back to justify-done.
- Browser stage loop: watch -> POST /working (justify-working.sh) -> apply -> POST /validating (justify-validating.sh) -> verify -> justify-done.sh (POST /respond + /prompts/clear). Stage helpers live in justify/cli/, not ~/.claude.
- justify-done.sh JUSTIFY_DIFF env takes raw git-diff text, parsed into per-file hunks for the browser Review Changes panel.

Limitation: a single Agent invocation has a finite budget. If justify-watcher exits, its last-relaunched poller stays alive but no handler is attached; the next prompt would write the inbox unhandled. On the agent's completion notification, re-spawn it or take over handling from main.

To stop the watch for real: remove ~/.claude/.justify-watch-on AND kill the poller (pkill -f justify-watch.sh) - requires explicit user consent per the guard hook.

Collaborator: Jonah.
