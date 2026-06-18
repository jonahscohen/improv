---
name: Justify panel - scroll-on-send, Clear All, watch heartbeat
description: changes now auto-scroll to their object on arrival (survives hot-refresh); always-visible Clear All; heartbeat keeps watch connected while Claude works
type: project
relates_to: [session_2026-06-18_justify-tasks-headless-select.md, session_2026-06-11_justify-hot-refresh.md, feedback_justify_be_authoritative_decisive.md]
---

Collaborator: Jonah

Three live-reported defects, fixed decisively.

## Scroll-to-object on send (issue #2 of this round)
"A change was just sent up that did not scroll up and select the object changed."
Root cause: the arrival handler (`justify_response` completed) called
`_highlightChangedElements` (a transient flash, NO scroll), and `_scheduleHotRefresh`
reloads the page ~1.2s later - wiping any scroll/highlight. So a sent-up change never
visibly scrolled to its object.
Fix:
- Extracted the click-path select+scroll logic into a reusable `_locateAndSelect(selectors)`
  (resolveTarget with deleted-ancestor fallback + persistent tracked highlight + scrollIntoView).
- Added `_changeSelectors(response)` = per-change selectors UNION prompt targetSelectors.
- On arrival (completed): call `_locateAndSelect(sels)` AND stash sels in
  `sessionStorage['justify:locate']` BEFORE the hot-refresh; on load (after /responses)
  re-locate from the stash (800ms settle) so the scroll SURVIVES the reload.
- The Changes-panel click handler reuses the same `_locateAndSelect`.
- Confirmed the site does NOT use Lenis (ruled out as a cause).

## Clear All button (issue: "where is the clear completed tasks button?")
The old "Clear Completed Tasks" only appeared once something was marked done and only
cleared reviewed entries - with a long entry it scrolled off-screen and felt missing.
Fix: renamed to "Clear All", ALWAYS visible while the panel has entries
(`_updateClearBtn` gates on filteredEntries.length, not on hasReviewed), clears the
ENTIRE list in one click via new `setOnClearAll` -> empties _changeHistory + persists +
removes the review bar. Per-item Mark Done (dim + Undo) kept - no capability removed.
VERIFIED in-browser: "Clear All" pinned at panel bottom with two entries, no prior mark-done.

## Watch heartbeat (issue: "Claude is not connected" while I was working)
Root cause: the wake poller (justify-watch.sh) EXITS the moment it catches a task, so
while Claude is heads-down applying tasks nothing refreshes the daemon's lastMcpActivity;
after the 30s window watch-status.active flips false and the browser blocks queuing.
Fix: `~/.claude/justify-heartbeat.sh` - a persistent loop that GETs /prompts (read-only,
never clears) every 8s, started in the background for the session. Keeps watch-status
active:true during long applies so the user can keep firing tasks. Verified active:true
after restart with the heartbeat running.

## Observation: a SECOND Justify operative appears to be active
The Changes panel shows competent responses to the earlier .setup-summary (heading
centering) and .feature-row (heading-gap grid-stretch) tasks that THIS session did NOT
write, and the queue keeps renumbering. Strong sign Jonah has another Claude session
watching the same daemon. The id-scoped clear makes concurrent clears safe (no-op on an
already-cleared id), but two operatives can produce duplicate /respond panel entries.
Flagged to Jonah before processing prompt-3/prompt-4 to avoid collision.

Files: justify/core/index.ts (_locateAndSelect, _changeSelectors, arrival auto-locate +
sessionStorage relay, setOnClearAll wiring), justify/core/changes-panel.ts (Clear All,
always-visible bottom bar, onClearAllCallback), ~/.claude/justify-heartbeat.sh (new).
Rebuilt dist + public/justify-core.js; daemon restarted.
