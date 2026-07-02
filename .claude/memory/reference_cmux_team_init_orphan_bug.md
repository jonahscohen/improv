---
name: reference_cmux_team_init_orphan_bug
description: cmux named-teammate spawns fail mid-session when the team dir ~/.claude/teams/session-<teamId>/ is missing/orphaned (compaction-continued sessions get a NEW teamId the harness never init'd). FIX without restart - manually create a valid config.json + inboxes/team-lead.json there; verified 2026-06-29 (the old "restart required" conclusion was WRONG).
type: reference
relates_to: [reference_codex_exec_hang_sigkill.md]
---

## CORRECTION 2026-06-29 (Jonah) - there IS a mid-session repair; restart is NOT required.
The 2026-06-24 conclusion below ("you cannot fix it in-session, restart") was wrong - it only ever tested `rm`-ing the orphan, never CREATING a valid config. Today: every named spawn failed with `team file for "session-661f86a6" not found`. Key clue: `CLAUDE_CODE_SESSION_ID` was `e47ce907...` but the team system wanted `session-661f86a6` - a compaction-CONTINUED session gets a NEW teamId that startup never initialized, and there was NO team dir for it at all.
REPAIR (no restart): create the team dir the harness expects, mirroring a healthy one:
  mkdir -p ~/.claude/teams/session-<TEAMID>/inboxes
  # config.json: {name:"session-<TEAMID>", createdAt:<now ms>, leadAgentId:"team-lead@session-<TEAMID>",
  #   leadSessionId:"<TEAMID>-0000-0000-0000-000000000000", members:[{agentId:"team-lead@session-<TEAMID>",
  #   name:"team-lead", agentType:"team-lead", joinedAt:<now ms>, tmuxPaneId:"leader", cwd:"<repo>",
  #   subscriptions:[], backendType:"in-process"}]}
  echo "[]" > ~/.claude/teams/session-<TEAMID>/inboxes/team-lead.json
<TEAMID> = the SHORT id from the spawn error (NOT CLAUDE_CODE_SESSION_ID - they differ on continuation). A placeholder leadSessionId UUID works. VERIFIED: after creating it, a test spawn succeeded immediately, then all 3 real teammates spawned. No restart.

---

Diagnosed 2026-06-24 (Jonah) when every `Agent(named teammate)` spawn failed during a compaction-continued session, blocking the Codex cross-model review via the agent path.

## Symptom
- Named-teammate spawn errors: `Team config file unreadable (lock acquired, read failed)`.
- The cmux agent-teams guard REQUIRES a name (unnamed Agent calls error with "must spawn as a NAMED teammate"), but even named spawns then hit the config error.

## Root cause (verified)
- The harness keeps per-session team state at `~/.claude/teams/session-<sessionId>/` with a top-level `config.json` (fields incl. `leadSessionId`, `createdAt` ms) + an `inboxes/` dir (one `<member>.json` per member, content `[]` when empty).
- The broken session had `inboxes/` (team-lead.json + the prior teammate, both `[]`) but NO `config.json`. Spawning tries to read config.json to append the new member -> "lock acquired, read failed".
- `~/.claude/hooks/team-reaper.sh` is the only cleanup, and it does `if not os.path.isfile(cfg_path): continue` (line ~120) - it SKIPS any team dir missing config.json. So a config-less orphan is NEVER reaped; it persists and keeps breaking spawns.
- Likely origin: a partial reap (config.json deleted, inboxes left) or a compaction-continuation that didn't re-run startup team-init.

## The decisive fact (why there is NO mid-session repair)
After `rm -rf`-ing the orphan dir, the spawn error CHANGED to: `team file for "session-<id>" not found. The session team should have been initialized at startup.` => the harness initializes the session team ONLY at startup; it never lazily recreates it mid-session. So neither restoring the orphan nor removing it makes spawns work in the SAME running session. Both on-disk states fail.

## Workaround
- In-session: you cannot fix it. Run the work that needed a teammate WITHOUT the agent path - e.g. for a Codex review, call the `codex` CLI directly (`codex exec "<prompt>"`, positional not stdin - see [[reference_codex_exec_hang_sigkill]]).
- Definitive fix: RESTART the session / Claude Code so the harness re-initializes a clean team at startup.
- Cleanup done this session: removed the config-less orphan `~/.claude/teams/session-14672cde/` (backed up to scratchpad). Removing the orphan is strictly better than leaving it (the reaper would skip it forever); a fresh startup can then init cleanly.

## If reproducing / fixing the harness
The proper harness fix is one of: (a) lazily re-init the session team on first spawn when the dir/config is missing, or (b) make team-reaper also remove config-LESS orphan dirs (currently it only handles dirs WITH a config.json). Flagged to Jonah.
