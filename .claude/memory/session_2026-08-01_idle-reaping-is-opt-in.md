---
name: Standing agents down no longer destroys the team - idle reaping is opt-in
description: A torn-down team is maximally idle by design, so the idle rule deleted teams precisely when they were managed well. Idle reaping now requires TEAM_REAP_IDLE=1; age-gc, the config-less orphan sweep and the live-member guard are untouched.
type: decision
relates_to: [session_2026-08-01_team-file-reaped-under-a-live-lead.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: suite 56 passed 0 failed with 6 new default-off cases; mutation re-enabling idle by default turns the reported-bug case red; run live against the real teams dir with an unrelated session id and both real teams survived; two earlier fixes measured, rejected on their own test evidence, and reverted
confidence: high
---

# Quiet is not death (2026-08-01)

Commit stamp at authoring: 08f4b6e7.

Jonah: "I don't want entire teams capabilities reaped when a task is done and agents are meant to
be stood down. We can stand down agents without destroying our ability to reproduce a team."

## The mechanism

`session-start` mode reaped a team when `newest_inbox_mtime` exceeded `IDLE_MINUTES` (240 by
default). Inbox mtime measures TEAMMATE CHATTER. The teardown rule in CLAUDE.md requires standing
every teammate down once its unit is accepted, and that stops all inbox writes by design.

**So a team looked maximally idle exactly when it had been managed well.**

Two guards should have caught it and could not:

- `team_has_live_process` scans argv for the team name. MEASURED: once teammates are gone, no live
  process carries the team name in argv OR environment. A lead between waves is invisible to it.
- `lead_session_is_live` needs a resolvable `leadSessionId`. Team `session-55c0bc13` was named for
  an id with no transcript anywhere on the machine - the compaction/resume case - so both its
  signals returned false.

With both blind, the idle rule deleted a live session's team. The lead found out only when it next
tried to spawn, and by then BOTH paths were closed: a named spawn fails "team file not found", an
unnamed one is refused by `agent-teams-guard`. No parallel work at all, with nothing announcing it.

## The fix

`IDLE_REAP_ENABLED = os.environ.get("TEAM_REAP_IDLE", "") == "1"` - off by default. The window
tunable is still honoured when an operator opts in.

Untouched, because they signal abandonment rather than quiet: **age-gc** (12h), the
**config-less orphan sweep**, and the **live-member guard**. Each has a case asserting it still
works with idle disabled.

## TWO FIXES I TRIED FIRST AND THE TESTS REJECTED

Recorded because both looked right and were not.

**1. Gate idle, first attempt.** Broke 17 tests. They use idle as the TRIGGER to exercise other
protections (symlink safety, malformed config, substring matching), so disabling it invalidated
their setup rather than their assertions. The suite now opts in with one `export TEAM_REAP_IDLE=1`
at the top, and the default-off behaviour gets its own cases.

**2. Treat a missing transcript as "unknown, therefore alive".** Defensible on its face - the file
biases to not-reap everywhere else. It failed 8 cases including "ancient team should be gone",
which taught me something I had not worked out: **age-gc runs through the same lead check**, so
that change disabled far more than intended, and the 12h bound I claimed in my own reasoning did
not exist. Reverted.

An intermediate version also had `seen_any` set AFTER the symlink filters, so a planted symlink
would have left it false and pinned the team forever - defeating those guards by absence instead
of by freshness. The symlink cases caught it immediately.

## Verification

    suite                                    56 passed, 0 failed
    mutation: IDLE_REAP_ENABLED = True       reported-bug case goes red
    live run, unrelated session id           both real teams survived

The live run is the one that matters: `session-55c0bc13` and the justify-watch daemon's
`session-4fde9995` both survived a simulated foreign session start.

## Files touched

- `claude/hooks/team-reaper.sh` (opt-in gate + the reasoning)
- `claude/hooks/test-team-reaper.sh` (suite opts in; 6 default-off cases)
