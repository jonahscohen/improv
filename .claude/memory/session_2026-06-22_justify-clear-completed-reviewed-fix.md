---
name: Fix - "Clear All Completed" now clears MARKED-DONE (reviewed), not status==='completed'
description: Clear All Completed did nothing when a needsInfo task was marked done, because it filtered by response status==='completed' instead of the user's reviewed (marked-done) flag. Changed to filter !reviewed. Verified via the real mark-done -> clear lifecycle.
type: project
relates_to: [session_2026-06-22_justify-clear-buttons-split.md]
---

Collaborator: Jonah Cohen

## Bug (Jonah reported)
"Marked a task done. Cleared completed. It disappeared. Tried again in same panel with different tasks marked done. Clear All Completed button does nothing."

Root cause: I implemented "Clear All Completed" to filter by the response `status === 'completed'`. But the user's mental model of "completed" == "the ones I marked done" (the `reviewed` flag). Mark Done sets `reviewed=true` and leaves `status` unchanged - so a `needsInfo` task marked done is still status `needsInfo`, and the status filter skipped it -> "does nothing." It worked the first time only because that task happened to be status `completed`.

## Fix
Filter by `!reviewed` (remove marked-done entries, keep un-reviewed) - which is also the legacy `clear-reviewed` semantics:
- justify/core/changes-panel.ts: button handler `this.entries.filter(e => !e.reviewed)`.
- justify/core/index.ts setOnClearCompleted: `this._changeHistory.filter(e => !e.reviewed)` + actionable check `filter(e => !e.reviewed)`; re-pushes survivors to /responses.
"Clear All Tasks" (full wipe) unchanged. Built + deployed core-only.

## Self-analysis (why the first verification missed it)
My isolated harness seeded entries with explicit statuses and clicked Clear WITHOUT first marking anything done - so it exercised the status-filter path and passed, never running the user's actual flow (mark done -> clear). False confidence from a harness that didn't mirror real usage. Lesson: when a label is ambiguous ("Completed"), verify against how the user OPERATES (they mark done, then clear), not just the literal code path; drive the full lifecycle.

## Verification (lifecycle harness, real clicks + screenshots)
Seeded A(needsInfo) + B(completed), both un-reviewed.
- Mark A (needsInfo) done -> Clear All Completed -> A REMOVED, B (un-reviewed completed) REMAINS. (h_3 screenshot) - this is the exact previously-broken scenario.
- Mark B done -> Clear All Completed -> panel EMPTY. (h_4 screenshot) - second consecutive clear works.
No page errors. Confirms: clears marked-done regardless of status; leaves un-reviewed regardless of status.
Caveat (unchanged): server re-push verified by code; full live overlay not click-tested by me (headless can't open it) - Jonah can confirm in his connected browser after reload.

## Files touched
- justify/core/changes-panel.ts
- justify/core/index.ts
