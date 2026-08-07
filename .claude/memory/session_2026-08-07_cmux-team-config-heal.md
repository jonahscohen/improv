---
name: cmux-team-config-heal - durable fix for the recurring team-init orphan deadlock
description: New SessionStart+PostToolUse hook that recreates the missing ~/.claude/teams/session-<SHORTID>/ dir on a compaction-continued cmux session; the continuation SHORTID is NOT reliably derivable at SessionStart, so the guaranteed close is reactive on the not-found error, with an opportunistic env-var pre-create at SessionStart.
type: project
relates_to: [reference_cmux_team_init_orphan_bug.md, session_2026-07-23_unmanaged-hooks-packaged.md, session_2026-07-28_team-reaper-liveness.md, session_2026-07-26_teammate-spawn-hook-contradiction-fix.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests (20/20 new suite + mutation red + 56/94 reaper/registry green) + shellcheck-clean + hook-registry-audit=0 + GUI-manifest + codex-review
confidence: high
---

# cmux team-config heal shipped (2026-08-07, Jonah)

Replaces the recurring MANUAL repair for the 4th-occurrence team-init orphan deadlock
(reference_cmux_team_init_orphan_bug.md: 2026-06-24 / 06-29 / 07-23 / 08-07) with a durable,
installer-managed hook. NOT committed - staged for the lead.

## STEP 1 investigation - is the continuation SHORTID derivable at SessionStart? NO (with evidence).

Decoded the live claude.exe binary (277MB compiled bundle at
`~/.nvm/.../@anthropic-ai/claude-code/bin/claude.exe`) plus live disk/env:

- **Team name = `session-` + first 8 hex of a session UUID.** Confirmed verbatim in the binary:
  `function IEh(e){return`+"`"+`${kOv}-${e.slice(0,8)}`+"`"+`}` with `kOv="session"`. This confirms
  the lead's clue exactly (session-bdaa99a6 <- bdaa99a6-..., session-85f4055f <- 85f4055f-...).
- **Team init `POv(e)`:** name = `existingTeamName ?? IEh(currentSessionId)`; config written with
  `leadSessionId = currentSessionId`. So on a FRESH session name and leadSessionId share the
  first-8 (matches the two healthy dirs); on a CONTINUATION name = the INHERITED existingTeamName
  (first-8 of the ORIGINAL session id) while leadSessionId = the NEW current id -> they DIVERGE.
  Matches the repaired live dir exactly: `session-820f1580` had `leadSessionId a3a6e79a-...`.
- **`existingTeamName` is sourced ONLY from env `CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME`**, which the
  harness sets when it relaunches itself for a "Switching to latest Claude Code / reconnecting"
  continuation (a version upgrade; claude.exe was rebuilt Aug 7 06:18, the day of the 4th recur),
  then `xOv()` reads it and `delete`s it from process.env. It is absent entirely on fresh sessions.
- **The continuation team's full UUID never lands on disk** (`grep -r 820f1580-<uuid> ~/.claude`
  found ZERO matches), and the continuation transcript does NOT carry the team name until the
  failed spawn is recorded (first mention at record 29619 of 32008, in the spawn tool inputs +
  the error). No CMUX_* var carries it (CMUX_AGENT_LAUNCH_ARGV_B64 was unset).

**Conclusion:** a pure "predict the id at SessionStart" hook cannot be relied on. The ONE
SessionStart signal (the env var) is (a) absent on fresh sessions and (b) read-and-deleted by the
harness during its own startup, so whether it survives to a SessionStart hook is init-ordering
dependent and unverifiable without reproducing a version-switch continuation. This confirms the
blocker the reference beat named.

## STEP 2 approach chosen - option (b) reactive, with opportunistic option (a). WHY.

Shipped `claude/hooks/cmux-team-config-heal.sh`, wired to BOTH events:

- **PostToolUse(Agent) arm - GUARANTEED backstop (option b).** The `team file for "session-XXXX"
  not found` error ALWAYS carries the exact name. On that error the hook creates the dir from the
  canonical schema and injects additionalContext telling the model to re-issue the spawn. The
  retry then lands - no restart, no hand-authored config. This is the mechanism that actually
  closes the deadlock in every case.
- **SessionStart arm - OPPORTUNISTIC front-line (option a, applied to the one derivable signal).**
  If `CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME` is still present, pre-create that dir. When it survives
  it eliminates even the first failed spawn; when it does not, it is a silent no-op and the
  reactive arm does the work. It can only help, never hurt.

**Why:** the lead's preferred option (a) SessionStart-only fix is impossible as a sole mechanism
because step 1 proved the id is not reliably knowable at SessionStart. Option (c) - a true lazy
re-init on the harness read path - is the real fix but lives in claude.exe, not our dotfiles. So
this is the best partial: guaranteed reactive close + opportunistic proactive close.

**Alternatives rejected:**
- SessionStart-only heal keyed on `session-<first8 of CLAUDE_CODE_SESSION_ID>`: wrong id on a
  continuation (the harness wants the OLD name, not the current one); and on a fresh session the
  harness overwrites it anyway (`POv` writes unconditionally for a fresh session). Pointless/racy.
- PreToolUse-on-Agent create-before-spawn: the PreToolUse payload carries the teammate `name` but
  NOT the team name; the harness computes the team name internally, so PreToolUse cannot know it
  any better than SessionStart can. A deny-and-instruct there is strictly worse than a reactive heal.
- Duplicating team-reaper's config-less-orphan handling: reaper REAPS those (delete -> restart to
  re-init); this hook HEALS the named dir (write-only-if-absent) instead, and does not sweep, so
  the two do not fight.

## RESIDUAL GAP (documented, honest)

When the env var did NOT survive to SessionStart, the FIRST spawn on a continuation still returns
the not-found error once; the hook heals on that error and the retry succeeds automatically. Fully
eliminating that single failed call requires a harness change (option c). Everything downstream of
that first error is now automatic - the manual mkdir + hand-authored config.json is gone.

## Constraints honored (all)

Guard on CMUX_SOCKET_PATH (no-op outside cmux); idempotent write-only-if-absent (never clobbers a
healthy config or an inbox holding real queued messages); atomic temp+os.replace with a re-check
before rename; strict name charset `^session-[A-Za-z0-9._-]+$` plus a realpath direct-child-of-teams
guard (no traversal/symlink escape); writes config.json + inboxes/team-lead.json(`[]`) +
inboxes/descriptions.json(`[]`); one informative stderr line + additionalContext when it heals; exit
0 always; canonical schema baked in (mirrors a live healthy team, verified byte-shape against
session-85f4055f). Payload travels by temp file + QUOTED heredoc (like codex-failure-watcher.sh) so
apostrophes in the python cannot terminate it and large tool_response cannot hit ARG_MAX.

## STEP 3-5 verification evidence

- `bash claude/hooks/test-cmux-team-config-heal.sh` -> **20 passed, 0 failed** (ARM 1 env-var heal,
  ARM 2 error heal, idempotent-healthy-untouched, config-less-orphan-gets-config + inbox preserved,
  fresh-session no-op, outside-cmux no-op, non-Agent no-op, successful-spawn no-op, traversal/`..`
  rejected, placeholder leadSessionId, mangled-payload crash tripwire, sandbox confinement).
- **Mutation-proven load-bearing:** neutering the config write (`os.replace` -> `pass`) turns the
  suite RED (4 failures across both arms + config-less-orphan + leadSessionId). Green means something.
- shellcheck 0.11.0 CLEAN on both hook and test.
- No regressions: test-team-reaper 56/0, test-hook-registry 94/0, test-app-hook-offlist pass,
  test-install-hook-deploy pass. Two suites red (test-component-browser 146/1, test-settings-deploy-
  parity) were confirmed PRE-EXISTING on a pristine HEAD worktree - failures name
  `frontier-confirm-arm`/`sidecoach-craft-floor.sh`, never this hook (flagged to lead, out of scope).
- Installer wiring (STEP 4): `cmux-team-config-heal` present in install.sh (deactivate loop, NAMES
  strip, install_app_hooks cmux, 2 comment blocks), app-wirings.json (SessionStart + PostToolUse/Agent),
  browser-tree.json (hooks list + hook_desc + hook_owner=cmux). `hook-registry-guard.sh --audit`
  exit 0 (zero unmanaged); `--check cmux-team-config-heal` exit 0 (managed). `install.sh --manifest`
  (the GUI derives from the tree) carries it as a member of the cmux Hooks node.
- STEP 5 Codex cross-model review: codex-cli 0.142.5 (a different MODEL). Round 1 returned 4 findings,
  ALL folded and re-verified (suite grew 20 -> 23, still green; mutation still red):
  - HIGH (TOCTOU/clobber): the old exists-check + `os.replace` overwrote unconditionally in the race
    window. Replaced with `tempfile.mkstemp(dir=team_dir)` -> write -> `os.link(tmp, cfg_path)`, where
    `os.link` raises FileExistsError if a real config appeared, so a genuine config is NEVER clobbered.
  - HIGH (symlink): the temp file and `inboxes/` could be followed through a symlink to write outside
    teams. Now: reject a symlinked `team_dir` or `inbox_dir` (os.path.islink), mkstemp gives a fresh
    non-symlink temp, and inbox files are created `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW`.
  - MEDIUM (regex): tightened to require the exact error shape `team file for "session-<hex>" not found`
    (hex-only names, trailing "not found"), so arbitrary text can no longer mint a spurious team dir.
  - MEDIUM (fail-open): the whole python body is now a `build_output()` called under try/except that
    prints exactly one `{}` on any exception; `os.getcwd()` is guarded.
  Round 2 (verification of the folded fixes): confirmed os.link is sound on macOS + fails with
  FileExistsError (no-clobber holds), O_NOFOLLOW degrades safely (O_EXCL already fails on a final
  symlink), the tightened regex is correct, and the fail-open refactor prints {} on any exception -
  "I did not find a new functional bug there." ONE new MEDIUM: the islink checks are path-based, so a
  concurrent swap of team_dir/inbox_dir to a symlink AFTER the check is still followed (parent-dir
  TOCTOU). ACCEPTED + documented in the hook header, NOT rewritten to openat/dir_fd: winning the race
  needs write access to ~/.claude/teams which only the single user's own code has (and that code can
  write anywhere as the user anyway); os.link already blocks the only real damage (clobbering a real
  config); and it matches the exact bar of the sibling team-reaper.sh (same realpath/path-based team
  handling). This is a reasoned risk-acceptance on a single-user workstation, flagged here for the lead.

## LIVE-DEPLOY NOTE (flag for lead)

The repo is staged/uncommitted as instructed, BUT the fix is ALSO already deployed LIVE on this
machine: `~/.claude/hooks/cmux-team-config-heal.sh` is symlinked to the hardened repo file and
`~/.claude/settings.json` wires it on SessionStart + PostToolUse(Agent) (valid JSON, matches
app-wirings.json exactly). I did NOT run a full install; `install.sh --manifest` (which I ran for the
GUI-derivation check) is read-only. The live deploy came from a concurrent full `install.sh` in
another session on this shared checkout at 06:56, which picked up my app-wirings.json edit. Net: the
durable fix is ACTIVE for NEW sessions now (this running session and the lead loaded settings.json
before the wiring, so they are unaffected until relaunch). Nothing to undo - the live wiring is
correct - but the lead should know it is live, not merely staged.

## Files touched

- claude/hooks/cmux-team-config-heal.sh (new)
- claude/hooks/test-cmux-team-config-heal.sh (new)
- claude/hooks/app-wirings.json (SessionStart + PostToolUse/Agent entries)
- install.sh (deactivate loop, settings-strip NAMES, install_app_hooks cmux, 2 comment blocks)
- claude/hooks/browser-tree.json (hooks list + hook_desc + hook_owner)
- .claude/memory/reference_cmux_team_init_orphan_bug.md (status: durable fix SHIPPED)
- .claude/memory/session_2026-08-07_cmux-team-config-heal.md (this beat)
- .claude/memory/MEMORY.md (index pointer)

Not committed, per instruction.
