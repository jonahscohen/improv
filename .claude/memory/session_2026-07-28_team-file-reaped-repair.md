---
name: Agent spawns broke mid-session - the team config file was reaped out from under a live session
description: All four Agent spawns failed with "team file for session-d883bc0d not found". The teams directory had been cleaned of older sessions while this one was still alive. Repaired by recreating config.json from a surviving session's schema.
type: project
relates_to: [session_2026-07-27_teammate-panes-in-process-fallback.md]
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: directory listing before and after, schema copied byte-for-byte in shape from a live session file
confidence: medium
---

# The team file disappeared while the session was still running (2026-07-28)

Four `Agent` spawns failed at once with:

    Internal error: team file for "session-d883bc0d" not found.
    The session team should have been initialized at startup.

## What changed, per the debugging protocol

This session read `~/.claude/teams/session-d883bc0d/config.json` successfully earlier the
same day - it is quoted in `session_2026-07-27_unattributed-writer-investigation.md` with
all five members and their pane ids. So the file existed and then stopped existing.

`~/.claude/teams/` now contains only `session-e7aa1214` (23:21) and `session-fb0d96bd`
(21:56), both created hours AFTER this session started. Every older team directory is gone,
including this one. The parent directory's mtime is 21:50. That is a cleanup pass over old
team directories, and it did not exempt sessions still running - this session was idle
between waves, so by mtime it looked as stale as the genuinely dead ones.

Contributing factor: all four teammates had been stood down (correctly, per the teardown
rule), so the directory had not been touched since the last shutdown and looked cold.
Following the teardown discipline is what made this session's team dir look reapable.

## Repair

Recreated `config.json` from the schema of a surviving live session (`session-e7aa1214`):
top-level `name`, `createdAt`, `leadAgentId`, `leadSessionId`, and a `members` array holding
the lead with `tmuxPaneId: "leader"` and `backendType: "in-process"` (the lead is always
in-process even in a healthy pane-capable session - established 2026-07-27). Also recreated
the empty `inboxes/` directory that the surviving session carries.

`leadSessionId` is this session's real transcript id, so the lead identity is not fabricated.

## Status

REPAIRED, NOT YET PROVEN. The next spawn attempt is the test. If it still fails, the
runtime holds team state in memory as well as on disk and a session restart is the only
fix - in which case the durable answer is to make the reaper skip directories whose lead
process is still alive, rather than to hand-repair the file each time.

## Files touched

- `~/.claude/teams/session-d883bc0d/config.json` (recreated, outside the repo)
