---
name: Justify watch runs FOREVER - no idle cap
description: Jonah - the background Justify watch must loop forever as a background process; removed the ~50min idle cap (JUSTIFY_WATCH_IDLE_CAP retired)
type: feedback
relates_to: [session_2026-06-10_justify-background-watch.md]
supersedes: session_2026-06-10_justify-background-watch.md
superseded_by: session_2026-06-10_justify-watch-guard-hook.md
---

Collaborator: Jonah. 2026-06-10.

The first poller design (1500 iterations x 2s = ~50min safety cap, then exit JUSTIFY_WATCH_IDLE_CAP and relaunch) hit its cap and died silently mid-session. Jonah: "watch justify needs to run in a loop forever as a background process forever."

**New standing arrangement:** the detached background poller is an UNBOUNDED `while true` loop - polls GET http://localhost:9223/prompts every 2s, silent while idle, no cap. Its ONLY exit is a real prompt arriving (writes /tmp/justify-inbox.json, prints JUSTIFY_TASK_RECEIVED, exit 0), which re-invokes the session to handle the task. After handling, relaunch the same loop immediately. Never let the watch lapse on an idle timer.

**Why the cap existed and why it was wrong:** I added it as a safety valve against a zombie poller. But the cap converts "always watching" into "watching for 50 minutes," and nobody is around to relaunch when it lapses - exactly what happened. A 2s curl loop is cheap; the harness tracks the background task; the daemon endpoint is local. Forever is the correct lifetime.

Launch command (Bash run_in_background:true):
`while true; do R=$(curl -s -m 3 http://localhost:9223/prompts); if [ -n "$R" ] && [ "$R" != "[]" ]; then printf '%s' "$R" > /tmp/justify-inbox.json; echo "JUSTIFY_TASK_RECEIVED"; exit 0; fi; sleep 2; done`

Current poller: task bqecw20s5, running.

Files: none in repo (process arrangement only).
