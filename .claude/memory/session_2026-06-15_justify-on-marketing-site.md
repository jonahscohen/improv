---
name: Justify started + verified live on the marketing site (via /justify)
description: brought up the justify daemon + verified the in-browser editor is live on the marketing site (localhost:4830); daemon on 9223, core injected from the daemon, activated, connection confirmed (connections:2 with a page open) + toolbar mounts; the 9225-9228 ws console errors are unrelated non-fatal noise, NOT the justify connection
type: project
relates_to: [reference_browser_validation_tool_precedence.md]
---

Ran /justify on the marketing site (static site served by serve.py on
localhost:4830).

**State (verified):**
- Daemon: `justify-serve` -> up, pid 80090, :9223 (ws+http) / :9224 (https).
  `curl :9223/status` answers.
- Injection: already present (no re-init needed) - index.html:28 has
  `<script src="http://localhost:9223/justify-core.js?v=5">`; .justify marker
  initialized 2026-06-09, loads core FROM the daemon (no local copy).
- Activated: `POST :9223/activate` -> {ok:true}.
- CONNECTION VERIFIED: held a headless page open and `:9223/status` showed
  connections:2 while open; the daemon's served core references ONLY 9223 (14x,
  zero 922[4-8]); toolbar mounts (screenshot: "Review Changes" pill bottom-left +
  "&" toggle bottom-right).

**Red-herring documented (debugging):** the browser logs ws errors to 9225/9226/
9227/9228 (ERR_CONNECTION_REFUSED). These are NOT the justify daemon connection
(that is 9223 and works). Source not pinned - likely the tilt-runtime.js effect
bundle or a stale secondary probe; NON-FATAL, does not affect justify or the site.
Do not chase it as a justify failure. Earlier "connections:0" was a measurement
artifact (checked after the headless browser closed), not a real failure.

**For the USER to actually use it:** open http://localhost:4830 in a real browser
-> toolbar (& bottom-right) + Review Changes (bottom-left) appear -> Manipulate
(scrub CSS) / Prompt (p, click+type) / Annotate -> hit Send All. The persistent
connection needs the user's open tab (the headless verify connection dropped on
close). This session then runs the LISTEN+APPLY loop (justify-watch -> apply ->
justify-done) per the /justify skill.

Collaborator: Jonah.
