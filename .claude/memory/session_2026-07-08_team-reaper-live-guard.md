---
name: team-reaper live-member guard (durable fix for recurring team-dir orphan)
description: Patched team-reaper.sh to never reap a team while any member process is alive, killing the recurring config.json-orphan bug that blocked teammate spawns
type: session
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
relates_to: [reference_cmux_team_init_orphan_bug.md, session_2026-07-06_uncommitted-backlog-commit-sequence.md]
superseded_by: session_2026-07-28_team-reaper-liveness.md
---

The session team dir ~/.claude/teams/session-4bb2aafe/ kept losing its
config.json (three occurrences), each time breaking the lead's ability to spawn
teammates. Repairing the dir by hand fixed it only until the next reap.

**Root cause (Debugging Protocol - what changed):** our own
claude/hooks/team-reaper.sh reaps idle team dirs on SessionStart. A teammate's
OWN SessionStart runs the reaper with ITS session_id, which is not the lead's
leadSessionId, so `lead == session_id` is False and the ACTIVE lead team looks
like an unowned idle orphan. Once a long-parked executor pushed the newest inbox
mtime past IDLE_MINUTES, the reaper rmtree'd the live lead team; the rmtree then
partially failed on an inbox file held open by a live process, leaving a
config-LESS dir. The reaper skips config-less dirs (line ~122), so the orphan
persisted and broke every subsequent spawn. The 2026-07-04 IDLE_MINUTES bump
30 -> 240 only widened the window; it did not remove the reap-the-living defect.

**Fix (durable, in dotfiles):** before reaping ANY team (every mode/reason), the
reaper now scans the process list once (`ps -Axww -o args=`) and skips a team
whose dir name appears as a live member marker: cmux launches each member as
claude.exe with `--team-name <name>` and `--agent-id <agent>@<name>` in its
args. Match is anchored to those concrete markers plus `/teams/<name>` so a
short name cannot collide with unrelated args. Bias is to NOT reap: a failed
scan or a stray match only delays cleanup, whereas a false reap wedges the live
team. Skips are logged to stderr. A test-only env `TEAM_REAP_PS_OVERRIDE=<file>`
stands in for the ps scan so the guard is deterministically testable.

**Why this direction:** a team with a live member is not an orphan - it is
active. The reaper's whole purpose is cleaning up records left after members
TERMINATE, so gating every reap on member liveness matches its intent and is
safe in all modes (idle reap, age-GC, owned-by-ending-session).

**Verified:**
- claude/hooks/test-team-reaper.sh extended (live-team-guard section: idle team
  with a live member kept, dead idle team still reaped, age-GC also spares a
  live team). Full suite 13/13 pass. Also fixed the stale suite: it assumed the
  old IDLE default and its 60m fixtures no longer crossed the 240m default, so
  the test now pins TEAM_REAP_IDLE_MINUTES=30 to test the logic, not the default.
- Real-ps check: the guard reports session-4bb2aafe (my own live team) as live
  and a fake name as not-live.
- bash -n clean; zero apostrophes inside the single-quoted embedded-python block
  (an apostrophe there breaks the whole hook - same trap content-guard documents).

**Live immediately:** ~/.claude/hooks/team-reaper.sh is a symlink to the repo
copy, so the fix is active with no restart. Rides in the harness commit of the
in-progress backlog commit sequence when Jonah unfreezes it.

Files touched: claude/hooks/team-reaper.sh, claude/hooks/test-team-reaper.sh.
