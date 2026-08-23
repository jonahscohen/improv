---
name: tilt-lab dev server - launch DETACHED (run_in_background gets reaped at a turn boundary)
description: A tilt-lab Vite server started via Bash run_in_background was killed at the turn boundary; nohup+disown detached launch survives for a multi-turn exploration session.
type: reference
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: browser
confidence: high
---

Launching tilt-lab (`/tilt-lab` skill) with the Bash tool's `run_in_background: true` started Vite cleanly on 5180 (verified HTTP 200 + screenshot), then the job was reported `killed` at the end of that response's turn - NOT a crash (log showed "VITE ready" then "[killed]", no NODE_OPTIONS/MODULE_NOT_FOUND error). A harness-tracked background job is the wrong shape for a dev server the user explores across many turns: it can be reaped at a turn boundary.

FIX (works, verified live): launch it fully DETACHED so it is independent of the harness background-job lifecycle -
`cd tilt-lab && nohup npm run dev > /tmp/tiltlab-5180.log 2>&1 < /dev/null & disown`
Then verify without a foreground sleep (blocked): `curl --retry 10 --retry-delay 1 --retry-connrefused http://localhost:5180`. The vite process persists (its parent is the disowned nohup shell, not a tracked job). Reload the browser tab after a restart - the old tab's tabId is dead once the group turns over; just navigate a fresh tab to localhost:5180 and screenshot.

PORTS (the "watch the ports" concern): tilt-lab's dev script PINS the port (`vite app --port 5180`). 5180 was free; 3000 (ethos), 9223/9224 (justify daemon) are the other live listeners and do not collide. Confirm the server actually BOUND 5180 (lsof) rather than assuming - a pinned vite port with a conflict would otherwise hop.

Files: none (operational). Skill: tilt-lab.
