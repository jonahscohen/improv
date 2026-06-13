---
name: Justify hot refresh - completed tasks reload EVERY project tab (mandatory)
description: Jonah's mandate - a completed task must hot-refresh the page in every browser tab/instance running the project; justify-core now schedules a debounced location.reload() on every completed justify_response broadcast
type: feedback
relates_to: [session_2026-06-10_changes-panel-accuracy-fix.md]
---

Collaborator: Jonah. 2026-06-11. "The hot refresh from a completed task should happen in every browser tab/instance that the designated project exists in. Mandatory. Fix Justify to respect that."

**Why:** the live page must always reflect the latest code after a task completes - no manual reload ritual, no stale tabs (the stale-document class of confusion from earlier today).

**Mechanism (core/index.ts):** the ws-server already broadcasts justify_response to ALL connected clients (manager.broadcast); each client's justify_response handler now calls _scheduleHotRefresh() when status === 'completed' - a 1200ms debounced window.location.reload(), so a multi-response batch lands as ONE reload per tab. needsInfo/failed responses do NOT reload. Panel state survives reloads (history is server-persisted; review bar re-surfaces via _surfaceReviewIfPending). Built and synced from REPO source via npm run deploy:core (per the source-of-truth rule); marketing-site core import bumped to ?v=5.

**VERIFIED live:** synthetic completed response POSTed to /respond -> the MCP tab (a PASSIVE client that originated nothing) reloaded itself within ~3s - caught at page top with the hero entrance fade replaying. Probe entry removed from history afterward (backup/restore via /responses).

**How to apply:** nothing extra per-task - every normal /respond with status completed now triggers the refresh everywhere. When testing changes that should NOT reload user tabs, use status needsInfo or test against a scratch daemon.

Files: justify/core/index.ts (_scheduleHotRefresh + handler call), built bundle synced to the live install and public/justify-core.js, marketing-site/index.html (core ?v=5).
