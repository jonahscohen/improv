---
name: the daemon owns the queue, the owner owns the work
description: Headless detached workers are off by default; the session or named agent that armed the watch claims, narrates, and applies, so the user can SEE the work
type: decision
relates_to: [session_2026-07-09_stale-server-deploy.md, session_2026-07-09_justify-timer-purge.md, feedback_2026-07-09_never-disarm-the-watch.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: 185 tests; each guard falsified independently; deployed dispatcher.js greps clean; daemon restarted in owner mode
confidence: high
---

Jonah: "I also don't want a silent worker clanging away in private. I want the
session that I called the watch from to own the thread and the process, and if I
tell you I want you to spawn an agent to do it, then the agent handles it. I want
to be able to see the work getting done even if I'm not actively using the command
line myself."

And, when I proposed streaming worker output to the browser instead: "I just want
whatever Claude session that I asked to watch Justify to show the work being done.
I don't want a hidden session. I don't want the browser to stream anything. I want
you to fucking show me in Claude that you got the prompt from Justify, that you're
working on it, and to do the work. I want Justify to receive the updates it's
supposed to: Sending, Working, etc. Review Changes should appear when it's really
done."

## The decision

**The daemon owns the QUEUE. It does not own the WORK.**

`dispatcher.headless` defaults to FALSE. The daemon no longer spawns a detached
`claude -p` worker. Prompts sit in the queue, durable and unclaimed, until the
attached owner - the session or the named agent that armed the watch - claims them
via `POST /prompts/claim`, drives the pill with `POST /working` and
`POST /validating`, applies the change in its own visible pane, and finishes with
`justify-done`, which is what raises "Review Changes".

`JUSTIFY_HEADLESS=1` is an explicit opt-in for an unattended machine.

**Alternatives considered:**
- Keep headless, stream its stdout to the browser Changes panel: rejected by Jonah
  outright. He does not want the browser to stream anything, and a hidden session
  is still a hidden session.
- Owner-first with a headless fallback when no owner is attached: rejected. That
  fallback IS the silent worker, just rarer and therefore harder to notice.

**Why this one:** the work being *visible in Claude* is the product. A prompt that
is applied correctly but invisibly is indistinguishable from a prompt that was
dropped - which is exactly why Justify felt broken all day while every single
prompt was in fact landing and being applied.

**Revisit when:** someone genuinely needs unattended application on a machine with
no Claude session (CI, a server). That is what `JUSTIFY_HEADLESS=1` is for.

## What made it invisible (the three lines)

- `server/dispatcher.ts` spawned with `detached: true, stdio: 'ignore'` - the
  worker's stdout and stderr were DISCARDED.
- `cli/justify-worker.sh` wrote its transcript to `~/.claude/justify/worker.log`,
  a private file nobody tails.
- `watch-state.json` records `armedBy: "Jonah"` - a STRING. Not a session, not a
  pane, not a process. The daemon had no concept of an owner, so it could not hand
  work to one. It could only fork something invisible.

## A guarantee I nearly disabled to make my own test pass

I first special-cased `stalled()` so that an unclaimed prompt in owner mode would
report `stalled: false`, because my new test wanted a calm status line. That would
have silently gutted the guarantee `__tests__/server/watch-guards.test.ts` exists
to protect: *an armed watch never silently stops receiving.*

Reverted. `stalled` keeps its meaning in both modes: armed, work queued, nothing
holding it. With an owner alive that clears within one poll. With no owner it stays
true, which is precisely what the user must see.

**Never weaken an existing guard to make new code look green.** The guard was
written by a past self who understood the failure better than the present self who
finds it inconvenient.

## Falsification

Every guard was reintroduced-as-bug and watched go red, individually:
- remove the owner-mode early return -> "no worker is ever spawned" goes RED
- remove the `stalled()` gate -> the stall assertion goes RED
- remove the dispatcher broadcast -> the real-socket e2e goes RED

And 11 pre-existing tests broke when owner mode landed, all of them tests of the
headless spawn path. They now pass `headless: true` explicitly, which names the
behaviour under test instead of relying on a default that changed.

## Files touched

- `justify/server/dispatcher.ts` (headless opt-in; owner-mode early return)
- `justify/__tests__/server/no-silent-worker.test.ts` (new)
- `justify/__tests__/server/{dispatcher-broadcasts-working,e2e-prompt-lands-and-announces,worker-reap-never-drops}.test.ts` (opt into headless)
