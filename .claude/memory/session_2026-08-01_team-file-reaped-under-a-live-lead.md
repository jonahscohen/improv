---
name: The team file was reaped under a live lead, leaving the session unable to spawn ANY agent
description: Killing the last teammate left session-55c0bc13 with zero live processes carrying its name; the team dir was then removed while the lead session kept running. Named spawns fail with "team file not found" and unnamed spawns are refused by the cmux guard, so both paths are closed.
type: project
relates_to: [session_2026-08-01_justify-preset.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: spawn attempted both ways and both refused with their exact errors; ~/.claude/teams enumerated; process table searched for the team name and the session id; team config schema read from the surviving daemon team; rebuilt config re-read and validated
confidence: high
---

# A live session that could not spawn anything (2026-08-01)

Commit stamp at authoring: 08f4b6e7.

Jonah asked for a simple test: spawn an agent on Sonnet 5. It surfaced a defect instead.

    Agent(name: "sonnet-probe", model: "sonnet", ...)
      -> Internal error: team file for "session-55c0bc13" not found.
    Agent(model: "sonnet", ...)            # unnamed
      -> BLOCKED: inside cmux with agent-teams enabled, every Agent call must
         spawn as a NAMED teammate

**Both paths closed at once.** Named spawns need the team file; unnamed spawns are refused by
`agent-teams-guard.sh`. A session in this state can do no parallel work at all, and nothing
announces it - the failure only appears when you try to spawn.

## What happened

`~/.claude/teams/` held exactly one directory, `session-4fde9995`, which belongs to the
justify-watch daemon (`justify-watch@session-4fde9995` is live). Mine was gone.

The trigger is almost certainly the teardown earlier in this session: I killed all five remaining
teammates, which left ZERO live processes carrying `session-55c0bc13`. `team-reaper.sh`'s own
comments describe exactly this hazard and the protection for it - a team is never reaped while its
LEAD SESSION is alive, established from `config.json`'s `leadSessionId` by two OR'd signals, a
`--session-id` match on the lead process or a live transcript at
`~/.claude/projects/*/<leadSessionId>.jsonl`.

**Why that protection did not hold cannot be established, because the evidence was the file that
was deleted.** Without `config.json` there is no `leadSessionId` to test either signal against.
Worth stating plainly rather than constructing a story: the reaper is documented to protect this
case, it did not, and the artifact needed to explain it is gone.

One concrete oddity that may be the thread: **the team name and the lead session id do not share a
prefix.** The surviving daemon team is `session-4fde9995` with `leadSessionId`
`4fde9995-cb13-...` - name is `session-` plus the first 8 characters. Mine was named
`session-55c0bc13` while this session's transcript is `5b305128-2ba0-...`. No file anywhere on
disk contains a full UUID beginning `55c0bc13`. If the reaper derives or matches liveness on that
prefix relationship, a team whose name does not match its lead's id would fail both signals by
construction.

## Recovery, chosen by Jonah

Rebuilt `~/.claude/teams/session-55c0bc13/config.json` from the surviving team's schema:

    name          session-55c0bc13     the name the harness asks for, observed in the error
    leadSessionId 5b305128-2ba0-...    THIS session's real, live transcript

Both values are true rather than invented, which matters: the reaper's transcript signal will now
find a file being written every turn, so the team should not be reaped a second time. A fabricated
`leadSessionId` would have failed both signals and been reaped again within minutes.

## Worth doing later, not guessed at now

The reaper should probably refuse to reap a team whose `config.json` it cannot read a
`leadSessionId` from, rather than treating an unreadable or absent one as "no lead". That is a
hypothesis about a file I no longer have, so it belongs to a session that can reproduce it.

## Files touched

- `~/.claude/teams/session-55c0bc13/config.json` (recreated; live state, outside the repo)
