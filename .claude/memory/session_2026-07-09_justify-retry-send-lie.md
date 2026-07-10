---
name: the "Retry Send" lie
description: The claudebar flipped to "Retry Send" after a flat 60s while the daemon was still applying the batch; hitting Retry would have double-queued the change
type: session
relates_to: [session_2026-07-09_justify-watch-consent-guards.md]
superseded_by: session_2026-07-09_justify-timer-purge.md
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: 135 unit tests (5 new), live throwaway daemon past the 60s deadline, live browser shows Review Changes
confidence: high
---

Jonah, mid-build: "Where the fuck is my watch on Justify? Why is Justify failing?"
He was looking at a "Retry Send" pill in the browser.

## The watch was never off

`/status` at the moment he asked: `watching: true`, `armed: true`,
`armedBy: Jonah`, `dispatcherRunning: true`, `workerRunning: true`,
`pendingCount: 1`. His `prompt-14` ("margin ABOVE the footer on the homepage
specifically. no margin below the footer ever.") had arrived 369s earlier and a
worker spawned 0.5s after it. The worker was alive: 6m09s wall, 4.1s CPU, 1.8%.
That is a healthy `claude -p` waiting on the API, not a wedge. It finished on its
own, applied the change, wrote its beat, and drained the queue.

## The bug: a 60-second stopwatch calling a healthy apply a failure

`core/index.ts` armed a flat watchdog on every send:

    setTimeout(() => {
      if (state === 'sending' || 'working' || 'retrying') this._claudeToRetry();
    }, 60000);

A daemon worker routinely runs for MINUTES. So one minute after any Send-All the
pill said "Retry Send" over a perfectly healthy apply. **Pressing Retry re-sends
`push_prompt`, which queues the same change a second time.** The UI was inviting
the user to corrupt their own work.

This is the same class of defect as the `watchArmed` vs `watching` fix: a
session-era signal rendered as truth after the watch moved into the daemon.

## The fix - ask the daemon, never a stopwatch

`server/ws-server.ts`, `GET /watch-status` now also returns:

- `workerRunning` - a worker is applying right now
- `busy` = `armed && (workerRunning || pendingCount > 0)` - the daemon is holding
  the user's work

`core/index.ts`: both watchdog sites now go through `_armRetryWatchdog(states)`,
which on expiry calls `_daemonIsBusy()` and **re-arms instead of failing** while
the daemon is busy. It only falls through to `_claudeToRetry()` once the daemon
confirms it is armed-and-idle - which is the honest case: the send never landed.
`_daemonIsBusy()` fails OPEN (returns false) so a dead daemon still surfaces as
Retry, and it falls back to `workerRunning || pendingCount > 0` when talking to an
older daemon that does not send `busy`.

## Verification

- `__tests__/server/watch-status-busy.test.ts` (5 new): busy TRUE while a worker
  runs; TRUE while a prompt is queued unclaimed; FALSE when armed and idle (Retry
  is correct there); FALSE when disarmed even with a queued prompt; FALSE with no
  dispatcher attached.
- Full suite: **135 tests / 18 files, all green** (was 130 / 17).
- Live, throwaway daemon on :18231 with `JUSTIFY_WORKER_CMD="sleep 90"`:
  armed+idle -> `busy:false`; batch arrives -> `busy:true`; **65 seconds later,
  past the old deadline -> `busy:true, workerRunning:true`**. The old core would
  have shown "Retry Send" at that exact moment.
- Deployed core, then `justify-serve --restart` (it refuses while a worker is
  applying; the worker had finished). Watch resumed ARMED for the ppai repo.
- Live browser: served bundle contains `_daemonIsBusy`, pill reads
  "Review Changes".

## Lesson

When the architecture moved the watch into the daemon, every UI signal that used
to mean "a session heard me" had to be re-derived from the daemon. I fixed
`/status` for that reason and did not go looking for the other places. `push_prompt`
acknowledgement and this 60s watchdog were both left behind. **After changing where
the truth lives, grep for every consumer of the old truth** - do not fix only the
one that was reported.

## Files touched

- `justify/server/ws-server.ts` (watch-status: workerRunning, busy)
- `justify/core/index.ts` (`_daemonIsBusy`, `_armRetryWatchdog`; two call sites)
- `justify/__tests__/server/watch-status-busy.test.ts` (new)
