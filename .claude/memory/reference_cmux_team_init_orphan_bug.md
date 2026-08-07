---
name: reference_cmux_team_init_orphan_bug
description: cmux named-teammate spawns fail mid-session when the team dir ~/.claude/teams/session-<teamId>/ is missing/orphaned (compaction-continued sessions get a NEW teamId the harness never init'd). RECURRED 2026-06-24/06-29/07-23/08-07. DURABLE FIX SHIPPED 2026-08-07: cmux-team-config-heal.sh (staged, not committed) auto-recreates the missing dir - guaranteed reactive heal on the "team file not found" error (PostToolUse/Agent) + opportunistic SessionStart env-var pre-create. Residual: the FIRST spawn on a continuation may still error once, then the hook heals and the retry lands (full elimination needs a harness-side lazy re-init). The manual repair below is now the fallback, not the routine.
type: reference
relates_to: [reference_codex_exec_hang_sigkill.md, session_2026-08-07_cmux-team-config-heal.md]
---

## DURABLE FIX SHIPPED 2026-08-07 (Jonah) - see session_2026-08-07_cmux-team-config-heal.md.
`claude/hooks/cmux-team-config-heal.sh` (staged for lead review, not committed). Wired to
SessionStart + PostToolUse(Agent) via app-wirings.json, install.sh, browser-tree.json (audit=0,
in the GUI manifest). STEP-1 INVESTIGATION RESULT: the continuation SHORTID is NOT reliably
derivable at SessionStart. Binary-decoded proof: team name = `session-` + first 8 hex of a session
UUID (`IEh(e)=session-${e.slice(0,8)}`); on a continuation the name is INHERITED from env var
`CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME` (first-8 of the ORIGINAL session id), which the harness
read-and-deletes during its own startup and which is absent on fresh sessions; the full UUID never
lands on disk and the transcript does not carry the name until the failed spawn. So the fix is
REACTIVE (guaranteed): on the not-found error the hook creates the dir from the canonical schema
and nudges a re-issue; the retry lands with no restart. A SessionStart arm ALSO reads the env var
opportunistically (pre-creates when it survived, no-op otherwise). Verified: 20/20 test suite +
mutation-red + shellcheck-clean + no reaper/registry regressions + Codex review.


## RECURRED + REPAIRED AGAIN 2026-08-07 (Jonah) - 4th occurrence, durable fix STILL unshipped; escalating to "fix at hook/config level RIGHT AWAY."
Compaction-continued session in the ppai repo. CLAUDE_CODE_SESSION_ID was a3a6e79a-998b-4506-b989-da15e05d64e4 but the team system wanted `session-820f1580` (never init'd; dir absent). Exact same hard deadlock: named spawns -> `team file for "session-820f1580" not found`; unnamed fallback -> agent-teams-guard's "must spawn as a NAMED teammate". Cost the user real time mid-task (they had to insist twice). The tmux SHIM was already healthy (cmux-teammate-shim-heal.sh had re-planted the pane-fix), so this is purely the team-CONFIG layer, a different failure than the shim - do not conflate.
REPAIR (no restart, same as below): `mkdir -p ~/.claude/teams/session-820f1580/inboxes`; wrote config.json mirroring a healthy team (name/createdAt/leadAgentId/leadSessionId=the real CLAUDE_CODE_SESSION_ID/single team-lead member, backendType in-process, cwd the repo); `inboxes/team-lead.json` and `inboxes/descriptions.json` = `[]`. Re-issued the named spawn -> "Spawned successfully"; teammate ran in its own pane. Verified.

ACTION NEEDED (Jonah asked for this note): RESOLVED 2026-08-07 - the durable fix shipped (see the SHIPPED banner at the top and session_2026-08-07_cmux-team-config-heal.md). Investigation settled the blocker: the SHORT teamId (820f1580 etc.) is NOT derivable from any stable on-disk artifact or a reliable env var at SessionStart - its only carrier, CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME, is read-and-deleted by the harness during its own startup and is absent on fresh sessions. So of the three options originally listed, (a) a pure SessionStart predict-the-id hook is not viable alone; the shipped fix is (b) reactive - watch for the "team file for session-XXXX not found" error and auto-create the dir - which is guaranteed because the error always carries the exact name, PLUS an opportunistic SessionStart env-var pre-create for the case where the var survives. (c) a harness-side lazy re-init on first spawn remains the only way to eliminate the single first-spawn error, and is not in our dotfiles. The manual repair below is now a fallback, not the routine.

## RECURRED + REPAIRED AGAIN 2026-07-23 (Jonah). Compaction-continued session: CLAUDE_CODE_SESSION_ID was 8554d33e... but the team system wanted session-1f1549bf (never init'd - the dir did not exist at all). Both named spawns ("team file ... not found") AND unnamed spawns ("must spawn as a NAMED teammate") were blocked - a hard deadlock. The 2026-06-29 repair below fixed it cleanly: mirrored the healthy session-7fba8147/config.json schema into ~/.claude/teams/session-1f1549bf/ (config.json + inboxes/team-lead.json="[]", cwd=the repo, leadSessionId placeholder). All 4 named teammates then spawned immediately. Durable harness fix (lazy re-init OR reaper handling config-less/absent orphans) still unshipped - flagged to Jonah again.

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
