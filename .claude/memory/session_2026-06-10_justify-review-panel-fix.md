---
name: Justify Review Changes panel fix + Validating state
description: The Review Changes bar/panel never surfaces because it depends on a transient pill; fix to derive from persisted history + add a Validating state
type: project
relates_to: [session_2026-05-19_queue-panel-persistence.md]
---

Collaborator: Jonah. 2026-06-10. Justify source: ~/Documents/Github/improv/justify (daemon serves justify-core.js live from build; server changes need justify-serve restart).

**User report:** Changes panel "broken, haven't seen shit." Flow: send -> "Working" -> I validate -> "Connected" (visual interruption) -> no confirmation, no Changes panel.

**Diagnosis (grounded in core/index.ts):**
- Data path is FINE: justify-done -> POST /respond -> server stores + broadcasts `justify_response`; core pushes to `_changeHistory` + persists to /responses. Confirmed /responses has all 5 entries.
- BUG: the "Review Changes" claudebar (the ONLY affordance to open the panel) is a transient in-memory pill. `_claudeToReview()` (core/index.ts:1434) early-returns `if (!this._claudePill) return` - it only UPDATES an existing pill, never CREATES one. `_loadClaudeState` only restores the Review bar if the server's transient claude-state==='review' AND watch active. The persisted truth (`_changeHistory` from /responses) is never used to surface the bar.
- So any event that kills the transient pill orphans the data: the "Connected" flash (`_onWatchConnected` shows "Connected" when state==='none', auto-removes after 3s), a disconnect during my validation, a reload, or multi-client desync. Data present, no way to open it.
- "Connected" interruption cause: I stop polling /prompts to screenshot-validate -> watch flag expires -> browser watch-monitor (`_onWatchDisconnected`/`_onWatchConnected`) churns the bar; with no "validating" signal it drifts to Connected.

**How I validate (answer to user Q1):** outside Justify - edit source, then load the page in a separate tab + screenshot (my visual-verify mandate). The daemon doesn't know, hence the Connected drift.

**Fix plan:**
- A (priority, client-only core/index.ts): A1 `_claudeToReview()` CREATES the bar if missing (via `_showClaudeBar('Review Changes','waiting',false)`) instead of early-returning. A2 add `_surfaceReviewIfPending()` - after /responses load, if there are unreviewed entries and no active job, show the Review bar (retry until `_barTray` exists). Makes the panel reachable after ANY reload/interruption.
- B (Validating state): B1 add 'validating' to `_claudeState` union. B2 `_claudeToValidating()` (ensure pill, label "Validating", shimmer). B3 transport handler `justify_validating`. B4 server ws-server.ts POST /validating broadcasts `justify_validating` + persists. B5 I curl /validating before screenshotting. Fills Working->Review gap, kills the Connected flash.
- Build: A needs `npm run build` in justify/ (daemon serves core live -> browser reload picks up). B also needs server rebuild + `justify-serve` restart.

## FIX A DONE + VERIFIED (the priority)
- A1: `_claudeToReview()` now creates the bar if missing (was early-returning on null pill). A2: `_surfaceReviewIfPending()` shows the Review bar on load whenever there are unreviewed changes + no active job (retries until `_barTray` exists).
- Build: `node build.js` in justify/ rebuilds dist/justify-core.js, BUT the daemon serves from the INSTALLED copy `~/.claude/justify/dist/justify-core.js` - must `cp dist/justify-core.js ~/.claude/justify/dist/justify-core.js` after building (else the served core is stale). Gotcha logged.
- VERIFIED (Chrome, reload): "Review Changes" bar appears bottom-left (derives from the 5 persisted /responses entries); clicking it opens the Changes panel showing all entries with +/- diffs and Mark Done / Revert / Reply controls. The exact thing that was broken now works after a reload/interruption.

## FIX B DONE + VERIFIED (Validating state)
- Client (core/index.ts): added 'validating' to `_claudeState` union; `_claudeToValidating()` (creates pill if missing, label "Validating" + shimmer + dots, clears retry timeout); transport handler `justify_validating`.
- Server (ws-server.ts): POST /validating endpoint -> keeps watch-status fresh + broadcasts `justify_validating`.
- Deploy: `node build.js --core-only` + `npx tsc -p tsconfig.server.json` in repo justify/, then `bash deploy.sh` (syncs core + dist/server to ~/.claude/justify). SERVER change needs a DAEMON RESTART (running node has old code): `kill $(lsof -tiTCP:9223 -sTCP:LISTEN); justify-serve`. Responses are file-backed -> PRESERVED across restart (verified 5->5).
- VERIFIED: after daemon restart, `POST /validating` -> 200; browser (reloaded for new core) shows the bottom-left bar flip to "Validating". Flow is now Working -> Validating -> Review Changes (no "Connected" drift).

## WORKFLOW CHANGE (mine, going forward)
In the justify loop, after applying edits and BEFORE screenshot-verifying: `curl -s -X POST http://localhost:9223/validating`. Then verify, then `justify-done`. This shows the user "Validating" during my verification instead of letting the bar drift to "Connected". (Follow-up: bake this into the /justify SKILL listen-loop step.)

## SIDE BUG FOUND (flag to user)
The bash-guard hook's "deployed Justify" message still references the OLD repo path `~/Documents/Github/claude-dotfiles/justify/` - stale after the claude-dotfiles->improv rename. Source of truth is now `~/Documents/Github/improv/justify/`. The guard still fired correctly (blocked building against ~/.claude/justify), just the path in its message is outdated. Worth grepping hooks for `claude-dotfiles` and updating to `improv`.

Status: BOTH FIXES DONE + VERIFIED. Daemon restarted. Justify watch loop NOT currently running (was doing the fix) - offer to resume.

Files: justify/core/index.ts (A+B client), justify/server/ws-server.ts (B server); rebuild justify core (+server for B).
