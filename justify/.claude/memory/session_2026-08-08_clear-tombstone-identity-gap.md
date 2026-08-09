---
name: Cleared tasks resurrected inconsistently because the tombstone key was per-emission, not per-task
description: The 2026-07-31 tombstone fixed lost-writes but keyed on promptId|timestamp. emitResponse mints a fresh promptId (`${orig}-${Date.now()}`) and timestamp each answer, so the same task answered twice got two keys - a clear tombstoned only the emission on screen and a later/in-flight emission slipped past. Fixed by tombstoning at the TASK (base prompt id) level, derived at read time so it retroactively cleans live installs, plus a client in-session guard against live re-broadcasts.
type: project
relates_to: [session_2026-07-31_cleared-tasks-resurrecting.md, reference_browser_change_dependency_chain.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 6 net-new server tests plus mutation controls (base-match neutered -> exactly the 4 task-level tests fail and prompt-9-<newepoch> resurrects; broadcast-guard + maxClearedSeq neutered -> exactly those 2 fail); full suite 306 passed / 35 files all green; server typecheck 0 errors; core typecheck 170 before and after (zero delta, proven by stash); Codex (High/Medium/Medium) AND independent Claude reviewer both run, all findings folded and re-verified
confidence: high
---

# Clear inconsistency: the tombstone identity gap (2026-08-08)

Commit stamp at authoring: f5caf674.

Jonah: the two clear operations in the Changes panel ("Clear All Tasks", "Clear All
Completed") do not work consistently - cleared things come back.

## The 2026-07-31 fix was correct but its identity was too fine-grained

That session made a clear a SERVER-AUTHORITATIVE TOMBSTONE keyed on
`promptId|timestamp`, and filtered it on GET, POST, and headless append. That
closed the lost-write resurrection. It did NOT close this one.

`emitResponse` (ws-server.ts) builds every answer as:

    promptId: input.promptId + '-' + Date.now(),   // e.g. prompt-115-<epochA>
    timestamp: Date.now(),                          // <epochA'>

So a response's identity carries a fresh `Date.now()` EVERY emission. The SAME
logical task answered more than once - a retry, a reconnect re-emit, or an
in-flight answer that lands AFTER a clear - produces a DIFFERENT precise key each
time. A clear tombstones only the emission that was on screen; the next emission
of that same task arrives with a new key, slips past `dropCleared`, and the
"cleared" task reappears. That is the inconsistency: it only bites when the same
task is answered again.

**Live proof (not theory):** `~/.claude/justify/responses-cleared.json` held
`prompt-115-1786202789649|1786202789649`, while `responses.json` held a live
`prompt-115-1786202900478|1786202900478` - same base task `prompt-115`, cleared at
one epoch, sitting resurrected under another 110s later.

Both panel buttons route through `/responses/clear` (via `_persistCleared` ->
same path), so this one root cause explains BOTH operations. `/prompts/clear`
(the toolbar Clear / justify-done queue wipe) is a separate mechanism, is already
idempotent (writes `[]`), and is NOT what the panel buttons hit - no prompts
resurrection bug was found there.

## Fix: tombstone the TASK, not the emission

**Base id** = the original prompt id = the response promptId with its trailing
`-<epoch>` (10+ digits) stripped. Original ids are `prompt-<seq>` (small integer),
so a real prompt id is never touched; only the `Date.now()` stamp is removed.

Server (`server/ws-server.ts`):
- `baseId()`, `entryBaseId()`, and `clearedSets()` (returns stored precise `keys`
  PLUS the `bases` they imply). `isCleared`/`dropCleared` now drop an entry if its
  precise key OR its base id is tombstoned.
- Base ids are DERIVED AT READ TIME from the stored precise keys, so an install
  whose tombstone file predates this fix (only precise keys on disk) gets
  task-level protection retroactively - the live `prompt-115` resurrection is
  swept with no data write. New clears also store the base id explicitly.
- Storage: precise keys (`promptId|timestamp`) are tail-bounded to 5000, but base
  ids (one per cleared task, no `|`) are kept in FULL. Bounding bases alongside
  precise keys could evict a base while a newer precise key for a different task
  survived, resurrecting the earliest cleared tasks after ~2500 clears.
- Why read-time derivation over rewriting data: never mutate Jonah's live files.

Client (`core/index.ts`):
- `_clearedBaseIds` (in-session Set) records the base ids of everything cleared.
  The `justify_response` broadcast handler drops any answer whose base id was
  cleared this session, closing the pre-reload window where a live in-flight
  answer could re-enter the panel before the server's GET reconciles it. The
  GET-restore is also filtered as defense in depth. A new task can never collide
  (prompt ids are monotonic, a cleared base id is never reused).

## Why this cannot over-clear a legitimately-new task

Base ids are unique per original prompt (`prompt-115`, `prompt-116`, ...). A new
task - even a resend - gets a new monotonic id, so its base is never a cleared
base. `dropCleared` only ever suppresses answers for the EXACT original prompt
that was cleared. Suppressing a late/in-flight answer to an already-cleared task
is the REQUIRED behavior ("they STAY gone, no exceptions"), not over-clearing.

## The one test that had to change

`distinguishes two entries sharing a promptId by timestamp` asserted that two
entries with an identical base id were independently clearable by timestamp. That
capability is exactly what let the bug through, and it does not match real
emitResponse output (real duplicates differ by epoch, i.e. differ in the base-id
model only within the stripped suffix). It was replaced by tests that encode the
stronger, correct contract: clearing one emission of a task clears every emission
of that task, and a later/in-flight re-emit stays gone. This STRENGTHENS
cleared-stays-cleared; it does not weaken it.

## Cross-model review and folds (Codex + independent Claude)

Codex `codex exec` (ran directly; the wrapper is broken on this machine) and an
independent Claude reviewer (fresh context, not the producer) BOTH converged on
the same top finding, plus Codex raised two more. All folded:

1. **(both, High/Medium) `emitResponse` broadcast was not tombstone-guarded.**
   `broadcastToClients('justify_response', ...)` and the headless append ran
   BEFORE any `isCleared` check. A client in another tab, or the same client after
   a hot-refresh reload, has an empty in-session `_clearedBaseIds`, so a
   re-emitted cleared task would re-render there. Fix: wrap broadcast + headless
   append in `if (!this.isCleared(responseObj))`; `stampResponded` still runs so
   the prompt lifecycle is unaffected. The server is now authoritative for ALL
   clients; the client set is defense-in-depth for the same-session pre-persist
   window.
2. **(Codex, Medium) the `slice(-5000)` cap could evict base ids.** Redesigned
   `addTombstones` to keep base ids unbounded and bound only precise keys.
3. **(Codex, Medium) task tombstones outlive their responses.json entry, so a
   lost `prompt-seq.json` could reissue a `prompt-N` that a stale base tombstone
   would wrongly drop.** Added `maxClearedSeq()` in mcp-tools.ts so the id
   allocator high-waters the tombstone file too.
4. **(Claude, Low) empty-base over-clear vector.** Added `if (b)` guards so a
   malformed `|<ts>` id never tombstones the empty base (server clearedSets +
   addTombstones, client _persistCleared).

Regex `/-\d{10,}$/`: both confirmed no current issue (real ids are `prompt-<seq>`
/ `prompt-<seq>-<epoch>`); only a hypothetical 10+ digit sequence would over-strip
- impossible at realistic prompt volumes. Left as-is.

Each fold carries a mutation-controlled test (broadcast guard neutered and
maxClearedSeq removed -> exactly those 2 new tests fail).

## Verification

- 6 net-new server tests: 5 in cleared-tasks (task-level clear; stale-array
  re-emit; headless `emitResponse` in-flight answer after clear; Clear-All-Completed
  re-emit stays gone while not-done survives; broadcast-not-sent for a cleared
  task) + 1 in push-prompt-idempotency (task tombstone raises id high-water).
  cleared-tasks file 17 passed, push-prompt file 10 passed.
- **Mutation controls (3):** base-id match neutered -> exactly the 4 task-level
  tests fail and `prompt-9-<newepoch>` resurrects; broadcast guard neutered ->
  the broadcast test fails; `maxClearedSeq` removed -> the high-water test fails.
  Restored -> all pass. The tests are instruments, not tautologies.
- Full suite: 306 passed / 35 files, all green. (A `disarm-endpoint.test.ts`
  EADDRINUSE port-collision flake - base port 49400 + async HTTPS close race -
  intermittently fails 1-2 tests independent of this change; it did not recur on
  the final run and is unrelated to clear logic.)
- Server typecheck 0 errors. Core typecheck 170 with AND without my edits (proven
  by stash) - zero delta; the 170 is pre-existing baseline drift since 2026-07-31.
- Browser: the live armed :9223 daemon serves another project and was NOT touched
  or restarted. The server half of this fix needs a Claude Code restart to reach
  the live daemon (dist/server is copied, spawned once per session); the read-time
  base derivation means the existing live `prompt-115` resurrection is swept on the
  next clear/GET after that restart. Deterministic tests + the live-data trace are
  the proof of record for this consistency bug.

## Files touched

- `justify/server/ws-server.ts` (base-id tombstone helpers; isCleared/dropCleared;
  emitResponse broadcast guard; addTombstones bases-unbounded redesign)
- `justify/server/mcp-tools.ts` (maxClearedSeq high-water in the id allocator)
- `justify/core/index.ts` (_clearedBaseIds, _baseId, broadcast + restore guards)
- `justify/__tests__/server/cleared-tasks-stay-cleared.test.ts` (1 test revised, 5 added)
- `justify/__tests__/server/push-prompt-idempotency.test.ts` (1 test added, beforeEach reset)
