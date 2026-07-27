---
name: model-router-guard live registrations removed (surgical, repo side deferred)
description: The guard blocked the SDD dispatch building its own replacement. Removed only the two live settings.json registrations plus the ~/.claude symlink; the eight-site installer refactor stays deferred to Task 8. detect-session-model.sh retained.
type: project
relates_to: [session_2026-07-26_agent-routing-execution.md, session_2026-07-26_agent-routing-plan.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: settings.json re-parses; 0 live model-router-guard refs; detect-session-model.sh symlink intact
confidence: high
---

# model-router-guard live removal (partial)

Collaborator: Jonah.

## What happened

Dispatching the Task 1 implementer with `model: sonnet` was BLOCKED by
`model-router-guard.sh`. The guard rejects the Agent tool's `model` parameter
outside the Fable-orchestrator exception, and this session is Opus, so no
exception applied.

The guard blocked the build of its own replacement.

**Important scope note:** this did NOT affect the artifact being built. The
guard blocks the Agent tool's `model` PARAMETER; it never sees `model:` in an
agent's frontmatter. The routing layer under construction dispatches by agent
NAME, so it was always legal. Only the SDD controller's own cheap-model
dispatch was blocked.

## Decision (Jonah)

Pull forward the smallest unblocking slice rather than reordering the plan or
paying Opus rates for every implementer.

Removed now:
- The two `model-router-guard.sh` registrations in `~/.claude/settings.json`
  (a timestamped `.bak` was written first, per repo convention)
- The `~/.claude/hooks/model-router-guard.sh` symlink

Still deferred to Task 8:
- `claude/hooks/model-router-guard.sh` (repo file)
- `claude/hooks/cluster-wirings.json:293-310`
- The `model-routing` installer cluster in `install.sh` (eight sites, five
  index-aligned parallel arrays)
- Stale comments in `sidecoach_lanes.py`, `sidecoach-keyword.sh`, and
  `fable-orchestrator-guard.sh`

Retained deliberately: `detect-session-model.sh`, still symlinked and still
called by `fable-orchestrator-guard.sh:26`.

## Verification

`settings.json` re-parses as valid JSON, `grep -c model-router-guard` on it
returns 0, and `~/.claude/hooks/detect-session-model.sh` still resolves into
the repo.

**Open question at write time:** whether Claude Code reads PreToolUse hooks at
session start or per call. If hooks are cached at startup, this removal will
not take effect until the session restarts. The next Agent dispatch is the
test; if it is still blocked, a restart is required.

## Files touched
- `~/.claude/settings.json` (2 registrations removed; backup written)
- `~/.claude/hooks/model-router-guard.sh` (symlink removed)
- `.claude/memory/session_2026-07-26_model-router-guard-live-removal.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
