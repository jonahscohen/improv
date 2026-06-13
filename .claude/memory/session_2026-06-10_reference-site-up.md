---
name: Reference site spun up on 8766
description: The in-repo reference docs microsite (reference/) served via python http.server on its canonical port 8766; verified 200
type: project
relates_to: [session_2026-05-20_reference-site-pipeline.md, session_2026-06-10_marketing-site-server-restart.md]
---

Collaborator: Jonah. 2026-06-10. "Spin up the reference site."

Disambiguation (from beats): "the reference site" = the in-depth docs microsite at <repo>/reference/ (built 2026-05-20 via /design-build, canonical port 8766) - NOT the yesand Lando site (that one is "the yesandagency local project").

- Port 8766 was free; served via `python3 -m http.server 8766` from /Users/spare3/Documents/Github/improv/reference/ (nohup, log /tmp/reference-site-server.log). Post-rename path used directly - no rename-orphan risk (cf. the 4830 stale-server incident this morning).
- curl verified: HTTP 200 at http://localhost:8766/.
- Browser verification next (same protocol as marketing site).

Servers now running for this project: marketing-site :4830, reference :8766, justify daemon :9223/9224, tilt-lab dev :5180.

Files: none in repo (process only); /tmp/reference-site-server.log.
