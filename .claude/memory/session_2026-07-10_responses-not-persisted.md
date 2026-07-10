---
name: a completed result is persisted NOWHERE while a browser tab is connected
description: The core pushes justify_response into memory and never writes it; the daemon only appends when zero clients are connected. Reload the tab and the record is gone.
type: session
relates_to: [decision_2026-07-09_owner-owns-the-work.md, session_2026-07-09_stale-server-deploy.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: read both code paths; observed responses.json = [] (2 bytes) immediately after prompt-16 completed with 2 clients connected
confidence: high
---

Found while verifying `prompt-16`. NOT fixed - it needs a daemon restart and the
watch had just worked for the first time all night. Reported to Jonah, left alone.

## The bug

`server/ws-server.ts`, POST `/respond`:

    this.broadcastToClients('justify_response', responseObj);
    // "When a client IS connected it owns the write, so we skip to avoid double-appends."
    if (this.manager.size() === 0) {
      this.appendResponseFile({ ...responseObj, reviewed: false });
    }

`core/index.ts`, on receiving that broadcast:

    this._changeHistory.push(response);
    this._updateClaudeBadge();

**The client does NOT own the write. It never writes.** It only POSTs
`/responses` on USER actions: mark done, undo done, clear all, clear completed,
clear reviewed. Nothing persists on receipt.

So with any tab connected, a completed result lives only in that tab's memory.
Reload -> the core fetches `/responses` -> empty -> the entry is gone, silently.
The applied CSS is safe on disk; only the record of it is lost.

Observed: `responses.json` was 2 bytes (`[]`) at 00:24, immediately after
`prompt-16` completed with `connections: 2`.

## A second, related hazard

POST `/responses` does `writeFileSync(respFile, body)` - a blind overwrite with
whatever a client sends. Two tabs are connected (the user's, and the watch owner's
verification tab). Whichever posts last wins, and one tab's "Clear All" erases the
history for everyone. There is no merge and no per-entry identity check.

## The fix (not applied)

The daemon is the source of truth for the queue; it should be for results too.
Drop the `manager.size() === 0` condition and ALWAYS `appendResponseFile` on
`/respond`. A client that later POSTs its full history will simply overwrite with a
superset, so always-appending does not double-count. Then make `/responses` merge
on `promptId` rather than blind-overwrite, so a stale tab cannot delete another
tab's entries.

The comment "the connected client owns the write" states an ownership that the
client never implements. **A comment asserting a contract is not the contract.**

## Why it was invisible

The badge and the pill are driven by the tab's in-memory `_changeHistory`, so the
UI looks perfect. Everything the user can see says the result was recorded. The
only way to notice is to ask the DAEMON what it has, which is the same lesson as
grepping `dist/server` instead of the browser bundle: check the thing that
survives, not the thing in front of you.
