---
name: Cleared review tasks came back because every history write was an unawaited fetch and a completed task reloads the page
description: Root cause was lost writes, not clear logic. window.location.reload() 1200ms after each completion discarded any in-flight persistence request, so a clear reverted itself and the stale server file was restored on load. Fixed with keepalive plus server-side tombstones that make resurrection structurally impossible.
type: project
relates_to: [session_2026-07-31_prompt-horizontal-viewport-clamp.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: 13 new server tests plus 6 new clamp tests; TWO mutation controls (tombstone filter neutered -> 6 fail; clamp neutered -> 5 fail); full suite 261 passed / 31 files; typecheck baseline 169 errors before and after, unchanged; the DEPLOYED build exercised end to end and the stale-array repost produced no resurrection
confidence: high
---

# Cleared tasks resurrecting (2026-07-31)

Commit stamp at authoring: 03538a4d.

Jonah: "When I click 'Clear All Completed' on tasks marked done, or when I click 'Clear All
Tasks' - they are removed from the review queue. When I submit a new task and it is completed,
the old items come back."

## The clear logic was correct. The writes were being thrown away.

Both handlers already reset `_changeHistory` and posted the survivors, and the panel holds the
SAME objects as `_changeHistory` by reference (`this.entries = entries`, no clone), so Mark Done
mutating `entry.reviewed` really does reach the persisted array. None of that was broken.

What was broken: **all 7 persistence writes were `fetch(...).catch(()=>{})`, unawaited, with no
`keepalive`** - and `_scheduleHotRefresh()` calls `window.location.reload()` 1200ms after every
completed task. A request still in flight when the document unloads is discarded. So:

1. Clear fires, POST goes out unawaited
2. The page reloads (its own completion, or the next one)
3. The write is dropped
4. On load, `_changeHistory` is replaced by `GET /responses` - the stale file
5. Every cleared task is back

**The evidence that settled it:** all 7 entries in `~/.claude/justify/responses.json` read
`reviewed=false` despite having been marked done. That is the same lost write seen from the other
side - Mark Done persisted through the identical unawaited fetch. If the clear logic were at
fault, the reviewed flags would have been correct.

## Two layers, because a timing fix alone is not a fix

**1. `keepalive: true` on every history write.** That flag exists precisely for "finish this even
if the document is unloading." All 7 raw call sites now route through `_persistHistory()`.

**2. Server-side tombstones, which is the durable half.** A clear used to be a client
read-modify-write: "here is the array I kept." Lose that write and the old array wins. Now a clear
POSTs to `/responses/clear` with the ids it removed, the server records them in
`responses-cleared.json`, and `dropCleared()` filters them on GET, on POST, and inside
`appendResponseFile`. **A cleared entry can never be served or appended again regardless of what a
later stale write claims.** That property holds even when a write is lost, which is what keepalive
alone cannot promise.

`appendResponseFile` mattered more than it looks: it reads the file and writes it back, so without
filtering the BASE array a single headless append re-persisted every stale entry. Its old comment
claimed "a connected client's later full-array write is a clean superset" - true before a clear,
false after one.

Entry identity is `promptId|timestamp`, not promptId. The live file held `prompt-54` twice and
`prompt-57` three times, so promptId alone would have cleared unrelated entries.

## Verification

- 13 new tests in `__tests__/server/cleared-tasks-stay-cleared.test.ts`, including the reported
  sequence end to end and a stale client reposting its pre-clear array
- **Mutation control:** `dropCleared` neutered to a passthrough -> 6 tests fail, including the
  reported-bug case. Restored -> 13 pass. The tests are instruments, not tautologies.
- 6 new tests for the previous task's `clampPromptLeft`, which I had shipped without any, plus its
  own mutation control -> 5 fail when neutered
- Full suite **261 passed, 31 files**. Typecheck **169 errors before and after, identical
  per-file** - a large pre-existing baseline, nothing added.
- The DEPLOYED build exercised directly: 3 entries, clear 2, then repost the pre-clear array ->
  still only the survivor. No resurrection.

## Two operational facts

1. **The server half needs a Claude Code restart.** `deploy.sh` says "active on next Claude Code
   restart". The browser bundle is live on a tab reload; the daemon is not.
2. **The 7 stale entries are still in the live file.** They are all `reviewed=false`, so "Clear
   All Completed" will not touch them - "Clear All Tasks" will, and now it holds. They were left
   in place rather than deleted, because they are Jonah's data.

## Files touched

- `justify/server/ws-server.ts` (clear endpoint, tombstones, filtered GET/POST/append)
- `justify/core/index.ts` (`_persistHistory`, `_persistCleared`, keepalive, 7 sites converted)
- `justify/__tests__/server/cleared-tasks-stay-cleared.test.ts` (new)
- `justify/__tests__/core/inline-prompt-position.test.ts` (clamp coverage owed from the prior task)
