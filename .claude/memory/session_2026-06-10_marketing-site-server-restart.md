---
name: Marketing-site server restarted on 4830 (stale rename-orphaned process)
description: The python http.server on 4830 404'd everything because its captured directory path predated the claude-dotfiles -> improv folder rename; killed and relaunched in marketing-site
type: project
relates_to: [session_2026-06-10_justify-background-watch.md]
---

Collaborator: Jonah. 2026-06-10.

User: "spin the marketing site back up."

**Why it was down:** the existing `python3 -m http.server 4830` (PID 85548) returned 404 for every path, including files that exist. `lsof` showed its cwd resolving to marketing-site, but `http.server` captures the serving directory as a path STRING at startup - that string still pointed at the old `claude-dotfiles` folder name from before the repo rename, so every lookup missed. Classic rename-orphan: the process survives the rename, the path string does not.

**How:** killed 85548, relaunched `python3 -m http.server 4830` from `marketing-site/` (nohup, log at /tmp/marketing-site-server.log). Kept the SAME port so existing browser tabs and the .justify config stay valid.

Verified via curl: index.html / styles.css / tilt-runtime.js all 200 on 4830; justify core still 200 on the daemon at 9223 (daemon node PID 91631, ports 9223/9224, was never down).

Site URL: http://localhost:4830/ - serve command `python3 -m http.server 4830` from marketing-site/.

**Visual verification (Chrome, fresh tab):** hero renders fully - Improv headline, the rewritten "A toolkit for Claude Code" lede, dithered red 3D ampersand (bayer grain visible, transparent bg) in the right quadrant, install command + Read the source CTA, nav intact. Justify toolbar is LIVE on the page: "Review Changes" pill bottom-left + ampersand launcher bottom-right, so the core injected from the 9223 daemon without re-setup.

**Watch relaunched:** the detached background Justify poller (per the standing arrangement in [[session_2026-06-10_justify-background-watch.md]]) is running again - GET /prompts every 2s, writes /tmp/justify-inbox.json + prints JUSTIFY_TASK_RECEIVED on a real prompt, ~50min idle cap (JUSTIFY_WATCH_IDLE_CAP) then needs relaunch.

Files: none in repo (process-only); /tmp/marketing-site-server.log.
