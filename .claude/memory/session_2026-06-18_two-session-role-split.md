---
name: Two-session role split - Justify-tool worker vs website watch session
description: this session works on Justify itself; the other session is the sole Justify watcher doing website design tasks
type: project
relates_to: [session_2026-06-18_justify-scroll-clearall-heartbeat.md, session_2026-06-10_justify-watch-forever-loop.md]
---

Collaborator: Jonah

Jonah is running TWO Claude sessions against one Justify daemon (port 9223):
- THIS session (id c0c7e311): the MAIN WORKER on **Justify itself** (daemon, core, panel, CLI,
  hooks). NOT the watcher.
- OTHER session (id 085eaad8): the **watch session**, owns the Justify watch loop and does the
  **website** design tasks fired into the queue (it restored the stepper component, did the
  heading-centering + heading-gap fixes, etc.).

This explains the whole "another operative / renumbering queue / responses I didn't write"
confusion earlier: two watchers were briefly racing the one queue. Now divided cleanly.

## Watch ownership mechanics (important)
- `~/.claude/.justify-watch-on` is a SINGLE GLOBAL flag (not per-session).
- `justify-watch-guard.sh` (Stop hook) checks `pgrep -f justify-watch.sh` GLOBALLY: if the flag
  is on and ANY poller is alive, it does NOT block/relaunch. So while the website session's
  poller is alive, THIS session's Stop hook is satisfied and will not pull me into watching.
- I briefly removed the flag when Jonah picked "this session stands down", then RESTORED it once
  he clarified the other session is the watcher (it needs the flag to keep relaunching its poller).
- Residual race CLOSED (2026-06-18): added a per-session opt-out to justify-watch-guard.sh. The
  guard now reads `session_id` from the hook input and, if it appears in
  `~/.claude/.justify-watch-optout`, exits 0 (never forces that session to watch). This worker
  session's id (c0c7e311-...) is in the optout file; the website watch session (085eaad8-...) is
  NOT, so its guard still relaunches its poller. No optout file => unchanged single-session
  behavior. Verified: mock Stop with my id -> no block; mock Stop with the website id + no poller
  -> block (as intended). This is what actually fired this turn - the website poller had exited
  and the global pgrep pulled me in; the optout fixes it for good.

## Heartbeat
`~/.claude/justify-heartbeat.sh` (GET /prompts every 8s) is running in THIS session to keep the
daemon's watch-status active during long applies (fixes "Claude is not connected" while working).
It benefits the WATCH (website) session. It is tied to this session though - if this session ends
the website session loses it. Durable fix options (my lane): (a) daemon-side - extend the
watch-status grace window once a task is claimed (needs a daemon restart, do when website session
is idle); (b) fold a detached heartbeat into justify-watch.sh so the watching session owns it (no
daemon restart). Offered to Jonah; not done yet to avoid disrupting the website session mid-work.

## My lane this session (Justify-the-tool) - shipped + verified
content-guard spinner allowlist; id-scoped /prompts/clear (no dropped tasks); headless /respond
persistence; prompt->response targetSelectors join; scroll-to-object on click AND on send
(sessionStorage relay across the hot-refresh); always-visible "Clear All"; watch heartbeat.
