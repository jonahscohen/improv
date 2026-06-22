---
name: Justify Changes panel - "Clear All" split into "Clear All Completed" + red "Clear All Tasks"
description: Replaced the single "Clear All" button in the Changes panel with two - "Clear All Completed" (neutral, removes only status==='completed') and "Clear All Tasks" (red/destructive, wipes everything). Verified visually + behaviorally via a standalone Playwright harness.
type: project
relates_to: [session_2026-06-08_justify-bundle-clobber-incident.md, session_2026-06-22_verify-hook-hardening.md]
---

Collaborator: Jonah Cohen

Jonah wanted the Changes panel's single "Clear All" replaced with two buttons that behave exactly as captioned: "Clear All Completed" (completed only) and "Clear All Tasks" (everything, red delete tones).

## What changed
- justify/core/changes-panel.ts:
  - New field `onClearCompletedCallback` + setter `setOnClearCompleted`; new `_clearAllTasksBtn` field.
  - Replaced the single `_clearReviewedBtn` ("Clear All") with an inner flex row holding two buttons:
    - "Clear All Completed" (neutral, clay #D97757 hover) - click: `this.entries = this.entries.filter(e => e.status !== 'completed')`, fire `onClearCompletedCallback`, re-filter, re-render (or hide if nothing left).
    - "Clear All Tasks" (red: border rgba(239,68,68,.55), text #ef4444, hover fill #ef4444 - the same destructive red as the remove-task confirm dialog) - click: clear all entries, fire `onClearAllCallback`, hide.
  - Kept `_clearReviewedBtn` as the Completed button so the existing `_updateClearBtn()` bottomBar-visibility logic still works.
- justify/core/index.ts: added `setOnClearCompleted(...)` wiring - filters `_changeHistory` to drop completed, re-pushes the SURVIVORS to the server (`POST /responses` with the filtered array) so they do not repopulate. Mirrors the existing `setOnClearReviewed` persistence pattern. `setOnClearAll` (full wipe -> POST empty) unchanged and wired to "Clear All Tasks".

## Build + deploy
`node build.js --core-only` then `bash deploy.sh --core-only` (per the contract; never build the deployed copy). Synced to the served bundle. Users must reload their justify tab to pick it up.

## Verification (visual + behavioral)
Could NOT drive the LIVE overlay headlessly: the Changes panel only opens via the 'c' key, which is gated behind an expanded toolbar; under headless Chromium the toolbar stayed collapsed and 4 open attempts ('c', clicking the "Review Changes" pill, bbox mouse-click, spark-expand+'c') all failed. Per the browser-automation rule (stop after 2-3 failed attempts), pivoted to an isolated harness.
- Built a temp standalone bundle (esbuild of an entry importing ChangesPanel, mounting it in an open shadow root with mock entries: one completed, one needsInfo), loaded it in Playwright on this host, and drove REAL mouse clicks.
- Screenshots (read + examined):
  - harness_1: both buttons render - "Clear All Completed" neutral left, "Clear All Tasks" red right - with the completed + needsInfo entries above.
  - harness_2 (after clicking Clear All Completed): completed entry GONE, needsInfo entry REMAINS. Callback fired.
  - harness_3 (after clicking Clear All Tasks): panel EMPTY. Callback fired. No page errors.
- Caveat: the harness exercises the PANEL's click behavior (the visible filter/clear). The server-side re-push (so cleared completed do not repopulate) is wired in index.ts and verified by code (mirrors setOnClearReviewed) but not exercised daemon-less. Full live-overlay integration (open via the claudebar in the real toolbar) was not click-tested by me - Jonah can confirm by reloading his connected browser and opening the Changes panel.

## Files touched
- justify/core/changes-panel.ts
- justify/core/index.ts
- (built dist/justify-core.js + deployed; temp _harness_entry.ts removed)
