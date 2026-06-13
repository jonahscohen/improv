---
name: Justify watch runs as a background task + lede max-width via panel Reply
description: Per user, the Justify listen loop now runs as a detached background poller (out of chat); first task applied via the fixed Reply button
type: project
relates_to: [session_2026-06-10_justify-review-panel-fix.md, session_2026-06-10_hero-lede-rewrite.md]
superseded_by: session_2026-06-10_justify-watch-forever-loop.md
---

Collaborator: Jonah. 2026-06-10.

**Arrangement (user request):** "keep watch justify running as a background task and out of this chat." -> Justify listen loop now runs as a DETACHED background Bash poller (run_in_background:true): polls GET /prompts every 2s (keeps the watch flag fresh + "Send All" available), silent while idle, exits the moment a real prompt arrives (writes it to /tmp/justify-inbox.json + prints JUSTIFY_TASK_RECEIVED) so the harness re-invokes me to handle it. ~50min safety cap (1500*2s) then exits JUSTIFY_WATCH_IDLE_CAP and I relaunch. No idle chatter in chat.

**First background task (validated the panel fix end-to-end):** a Changes-panel **Reply** arrived (context "Reply to prompt-1-...: max-width: 42ch;") - confirming the Reply button works now that the panel is fixed. Applied: `.hero__lede` max-width 52ch -> 42ch (tighter measure under the bumped 2rem font). Used the NEW flow: apply -> POST /validating (user sees "Validating") -> screenshot-verify -> justify-done. VERIFIED (Chrome): lede wraps tighter, legible, no clipping; "Review Changes" bar present bottom-left.

Status: background watch relaunched after this task. Marketing-site working tree on main, uncommitted.

Files: marketing-site/styles.css (.hero__lede max-width).
