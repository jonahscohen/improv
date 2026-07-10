---
name: the timer purge - no clock may stop Justify
description: Deleted every timer that could stop, give up, mark failed, or drop a prompt; prompts now go through a durable forever-retrying outbox with server-side idempotency
type: session
relates_to: [session_2026-07-09_justify-retry-send-lie.md, session_2026-07-09_justify-watch-consent-guards.md]
supersedes: session_2026-07-09_justify-retry-send-lie.md
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: 175 unit tests (40 new, was 135), build green, server tsc clean, every new guard falsified before trusting, Codex review folded, live browser: pill held Working 2m30s past the old 60s deadline
confidence: high
---

Jonah, verbatim: "i dont want any FUCKING timer on anything inside of justify. i
want it to always fucking watch [...] justify is ON at ALL TIMES WATCHING until
THE USER stands it down. Not you. Not a fucking timeout. Not a timer. Not Codex.
Not your momma. Not anybody but the user."

## The law, operationally

**No state transition may be caused by the passage of time.**

- A timer that makes Justify try AGAIN or SOONER is legal. It only ever moves
  toward doing the work: transport reconnect backoff, dispatcher tick, outbox
  retry backoff, claim TTL re-dispatch.
- A timer that STOPS, GIVES UP, MARKS FAILED, or DROPS A PROMPT is illegal.

## What was removed

1. **`_claudeTimeout` / `_armRetryWatchdog` / `_daemonIsBusy`** (`core/index.ts`).
   The 60s "Retry Send" stopwatch, and yesterday's smarter version that asked the
   daemon whether it was busy before giving up. Both gone. Guarding a stopping
   timer is not the same as not having one.

2. **`setTimeout(() => this._claudeToRetry(), 100)`** in the state-restore path.
   I had reasoned this one was fine (state-driven, 100ms is a cosmetic mount
   defer) and was going to keep it. The guard test caught it. `_showClaudeBar`
   mounts the pill synchronously, so the call is now direct. **The guard was right
   and my reasoning was wrong** - which is the entire argument for having it.

3. **The `.catch()` in `_startWatchMonitor` that counted a failed fetch as a
   watch-inactive "miss."** Three unlucky polls - fifteen seconds of a flaky
   socket - tore down a live watch and, mid-`sending`, threw the user's pill away.
   **Silence is not a disarm.** Only a reachable daemon answering `active: false`
   may disconnect us now.

4. **The 30-second `recentActivity` window** in `GET /watch-status`. On the
   legacy (un-owned daemon) path, `active` was ANDed with "MCP activity in the
   last 30s", so a session that had been quietly waiting for 31 seconds reported
   as not watching. A watcher that is waiting IS watching, and it may wait for
   hours.

## What replaced the prompt path (the real bug)

Every `push_prompt` went through `transport.request()`, which rejects **two**
ways that have nothing to do with the daemon's health:

- instantly, if the WebSocket is mid-reconnect (`Not connected`)
- after a flat 10s, on its own stopwatch (`Request timeout`)

...and every caller answered a rejection with `_claudeToRetry()`. So a one-second
socket blip during a Send-All **silently threw the user's work away** and offered
them a Retry button that would double-queue it.

**`core/outbox.ts` (new).** Prompts are enqueued, not sent. The outbox:
- assigns a stable `clientId` at enqueue time
- persists to `localStorage`, so a reload cannot lose a prompt
- drains forever: capped backoff, **no attempt limit, no deadline**
- removes an entry **only** on an ack for that exact `clientId`
- never rejects to the caller - `Transport.sendPrompt()` returns the clientId
  synchronously (delivery is the outbox's problem from that point on)

**Why:** a prompt is the user's work. The only honest thing to do with work you
cannot deliver yet is to keep it and keep trying.

**How the forever-retry is made safe:** `push_prompt` in `server/mcp-tools.ts` is
now idempotent on `clientId`, against a `served-clients.json` ledger that outlives
the queue entry. Two lost-ack cases are covered: the prompt is still queued, and
the worker already applied it and cleared it. Without the second, a retry would
re-apply a change the user already had. The ledger is capped by **size (500)**,
never by age - an age cap would be a clock deciding when a duplicate is allowed
to become a double-apply.

`Transport` kicks `outbox.onConnected()` on first connect and on every reconnect,
so a prompt queued while the daemon was down lands the instant it returns.

## What was KEPT, and why it is legal

- **Dispatcher backoff** - capped at 60s, retries forever, no attempt ceiling.
- **Claim TTL (2400s)** - only ever re-dispatches an abandoned claim.
- **`justify-worker.sh` `TIMEOUT_SECS` (1800s)** - reaps a hung `claude -p`
  PROCESS. Verified behaviorally (not by reading the code) that it cannot drop the
  PROMPT: the dispatcher's observed-effect gate sees the prompt still queued,
  releases the claim, backs off, and dispatches again, forever, without disarming.
- **Transport reconnect backoff**, **WS handshake timeout** (connection hygiene,
  touches no prompt), **UI cosmetics** (dot animation, highlight fade, the 3s
  "Connected" toast).

## The guard, and the lesson about guards

`__tests__/timer-law.test.ts` reads the real source and fails if any removed
construct returns. **I wrote it with a regex that could not fail.**
`/set(?:Timeout|Interval)\(([\s\S]*?)\),\s*\d+\)/` only matched bodies ending in
`)`, so a reintroduced `setTimeout(() => { this._claudeToRetry(); }, 60000)` -
block body, ends in `}` - passed clean.

I only found that because I falsified the guard before trusting it: reintroduced
the bug and checked the test went red. It didn't. Replaced with a paren-matching
scanner (`timerBodies`), then re-falsified against four shapes (block arrow,
expression arrow, `setInterval` with a nested call, a server-side timer calling
`.disarm()`). All four go red; clean tree goes green.

**A guard you have never seen fail is not a guard. Falsify it before you trust
it.** This is the same failure mode as "no error banner means the block is valid"
from the ppai hero work - absence of a complaint is not evidence of correctness.

## The Codex cross-model review found two P0s I had shipped

Both were real, and both were invisible to my own tests.

1. **`push_prompt` acked a prompt it had not durably written.** `writePrompts()`
   swallowed its error and the handler still answered `{accepted: 1}`. The outbox
   deletes its only copy on an ack. So a full disk silently ate the user's prompt.
   Fixed: `writePrompts` writes atomically (tmp + rename) and THROWS; the ws layer
   turns the throw into a JSON-RPC error; the outbox keeps its copy and retries.

2. **A persisted outbox never drained after a reload.** `Transport` created the
   Outbox lazily on the first `sendPrompt`, and the connect paths used
   `this.outbox?.onConnected()` - an optional chain that does nothing when the
   outbox does not exist yet. A prompt saved to localStorage sat there until the
   user happened to send another. My "survives a page reload" test constructed the
   Outbox directly, so it could not see the bug. Fixed: both connect paths call
   `getOutbox().onConnected()`, which constructs (and therefore loads) it.

Also folded:

3. **The Retry pill minted a NEW clientId**, so it re-queued work that had already
   landed - the exact double-queue the ledger was supposed to prevent.
   `sendPrompt` now returns the clientId and Retry re-sends with the original.
4. **`justify_watch` / `justify_get_prompts` DELETED the prompts they read.** If
   that session died before answering, the work was gone. They now LEASE
   (`claimedBy: interactive:<pid>`), so justify-done clears on success and an
   abandoned claim goes stale and is re-dispatched. A read that deletes work is a
   dropped prompt with extra steps.
5. **`persist()` clobbered other tabs.** A blind `setItem(this.queue)` erased a
   prompt queued by another tab. Now read-modify-write, preserving entries this
   instance does not own.

**Codex was wrong about one thing** and I checked before acting: it cited
`src/core/prompt/index.ts:663`. There is no `src/` directory. Discarded.

**Codex was also right for the wrong reason on the ledger.** It wanted the ledger
write to throw. That is backwards: the prompt is already durably queued at that
point, so denying the ack forces a retry, and a retry after the worker clears the
prompt double-applies. The ledger is best-effort and loud; only the QUEUE write
may deny an ack.

## Two guards that could not fail (the real lesson)

**The timer-law regex.** `/set(?:Timeout|Interval)\(([\s\S]*?)\),\s*\d+\)/` only
matched timer bodies ending in `)`. A reintroduced
`setTimeout(() => { this._claudeToRetry(); }, 60000)` - block body, ends in `}` -
passed clean. Found only because I reintroduced the bug on purpose and the test
stayed green. Replaced with a paren-matching scanner; re-falsified against four
timer shapes.

**The ledger eviction guard.** I wrote "never evict an id whose prompt is still
queued," and a test for it. Deleting the guard left the test GREEN - because a
still-queued prompt is deduped by the QUEUE lookup, which runs first. The guard
protected nothing and implied coverage it did not have. Deleted it, and replaced
the test with two that pin what is actually true: the queue lookup covers queued
ids, and the ledger covers served-and-cleared ids for a 500-entry window (that one
goes red when the cap is shrunk to 10).

**So: falsify every guard before trusting it.** Both of these would have shipped
as reassuring green checkmarks over nothing. Same family as "no error banner means
the block is valid" from the ppai hero work: absence of a complaint is not
evidence of correctness. The new discipline is mechanical - reintroduce the bug,
watch the test go red, restore, watch it go green. Every time.

## Known, documented boundaries (not fixed, deliberately)

- **Ledger window.** An ack lost for longer than 500 subsequent prompts could
  double-apply. The outbox retries every <=15s, so the window is bounded by ack
  latency, not prompt volume. Pinned by test.
- **No browser-visible "daemon is dead" state.** Codex is right that ignoring
  failed `/watch-status` fetches leaves the user blind: `toolbar.setConnected()`
  stores a boolean and renders nothing. Fixing that means inventing UI, which is
  not mine to invent unprompted. It does NOT violate the law (nothing stops, fails,
  or drops), but it is the honest next task. Flagged for Jonah.

## Verification

- **175 tests / 23 files, all green** (was 135 / 18). 40 new:
  `core/outbox.test.ts` (12), `server/push-prompt-idempotency.test.ts` (9),
  `timer-law.test.ts` (11), `server/worker-reap-never-drops.test.ts` (4),
  `server/mcp-read-is-a-lease.test.ts` (4).
- `node build.js` green; `tsc -p tsconfig.server.json --noEmit` clean.
  (`npx tsc --noEmit` over the whole repo has PRE-EXISTING errors in
  `core/prompt/index.ts` - it is not a usable gate here, and I did not pretend it
  was.)
- The worker-reap test drives the real `Dispatcher` with `JUSTIFY_WORKER_CMD`
  exiting 5, and observes actual re-dispatch: spawn -> `exit=5` -> back off ->
  spawn -> ... with `isArmed()` true throughout.

## Live verification

Forced the daemon into `state: working` via `POST /working` with the watch armed,
NO worker running and an empty queue - the exact condition where the old
`_daemonIsBusy()` would have returned false and the watchdog would have fired.
**2 minutes 30 seconds later the pill still read "Working..."** with its dots
animating. The old core showed "Retry Send" at 60 seconds. Reset the state to
`none` afterwards so the pill did not linger.

Served bundle on both cores (:9223 http, :9224 https) greps clean for
`_claudeTimeout`, `_armRetryWatchdog`, `_daemonIsBusy`, and
`this.outbox?.onConnected`; carries `justify.outbox.v1`, `getOutbox`,
`_lastPromptClientId`. Watch resumed ARMED for ppai after each restart.

Note the raw grep proof shows two matches that are COMMENTS, not code
(`outbox.ts:8`, `dispatcher.ts:18`). The test strips comments; grep cannot.

## Files touched

- `justify/core/outbox.ts` (new)
- `justify/core/transport.ts` (sendPrompt, outbox, drain-on-connect)
- `justify/core/index.ts` (watchdog deleted; 5 push_prompt sites repointed; catch fixed)
- `justify/core/prompt/index.ts` (3 push_prompt sites repointed)
- `justify/server/mcp-tools.ts` (clientId idempotency + served-clients ledger)
- `justify/server/ws-server.ts` (recentActivity window removed)
- `justify/__tests__/core/outbox.test.ts` (new)
- `justify/__tests__/server/push-prompt-idempotency.test.ts` (new)
- `justify/__tests__/server/worker-reap-never-drops.test.ts` (new)
- `justify/__tests__/timer-law.test.ts` (new)
- `justify/__tests__/server/mcp-read-is-a-lease.test.ts` (new)
