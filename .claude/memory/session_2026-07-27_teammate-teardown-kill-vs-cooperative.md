---
name: Killing a teammate process does close its pane, but only after the guard's dead-process precondition is met
description: Two teammates ignored three shutdown_requests each. cmux hard-blocks close-surface on a LIVE pane with no override; killing the PID (identified by --agent-id, never by elimination) let cmux reap the pane automatically and both wrote sessionEnd.
type: reference
relates_to: [session_2026-07-27_agent-routing-shipped.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: post-kill - cmux list-panels shows only surface:35, workspace list has no agent entries, and both workstreams' final record is kind=sessionEnd
confidence: high
---

# Teammate teardown when shutdown_request is ignored

`task1-review2` and `toolsmoke` each ignored THREE `shutdown_request` messages
while continuing to emit idle notifications. Cooperative teardown had no path
forward.

## What the guard enforces, and why it is right

`cmux close-surface` on a live pane is hard-blocked with **no override**:

> surface:38 is backed by a LIVE agent process (claude.exe pid 59214). A live
> process is NOT a leftover to clean up.

Its precondition for force-closing is explicit: (1) the backing process is
confirmed dead, and (2) the pane is positively identified as one THIS session
spawned. The guard exists because closing by elimination killed Jonah's
justify-watch worker on 2026-07-12.

## The working sequence

1. **Identify by `--agent-id`, never by elimination.**
   `ps aux | grep '[c]laude.exe'` shows the flag directly:
   `claude.exe --agent-id toolsmoke` -> pid 60934,
   `claude.exe --agent-id task1-rev...` -> pid 59214. That is positive
   identification; "the other panes are mine so this must be a leftover" is not.
2. **`kill <pid>`, then confirm dead** with `ps -p <pid>`.
3. **cmux reaps the pane automatically.** No `close-surface` call was needed -
   the follow-up attempt failed with "cannot resolve surface:38", because the
   pane was already gone.

Also note the guard rejects a `close-surface` whose argument comes from a shell
variable or loop, since it cannot prove which pane would be closed. Spell the
surface out literally.

## What a killed agent still writes

Both killed workstreams recorded `kind=sessionEnd` as their final entry
(07:48:43Z and 07:48:49Z), so a SIGTERM kill is not a dirty exit from cmux's
point of view. Verified end state: `cmux list-panels` shows only `surface:35`,
`cmux workspace list` holds no agent entries.

## Standing preference is unchanged

Cooperative teardown first, always. This path is the fallback for an agent that
will not process its mailbox, and it requires the user's go-ahead, because
killing a live agent destroys whatever queued work it holds. Here both units
had been closed for hours and held nothing.

## Files touched
- `.claude/memory/session_2026-07-27_teammate-teardown-kill-vs-cooperative.md` (this beat)
- No repo files changed
