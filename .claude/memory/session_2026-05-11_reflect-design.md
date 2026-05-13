---
name: Reflect skill design session
description: Designed multi-agent memory corpus analysis skill; brainstormed, scoped, and spec'd
type: project
relates_to: [session_2026-05-10_memory-graph-design.md]
---

## What

Designed a `/reflect` skill that spawns 5 parallel analysis agents against the accumulated `.claude/memory/` corpus to surface patterns, tensions, and gaps.

## Key decisions

- **Multi-agent over single-pass** - 5 specialized lens agents (Pattern Hunter, Tension Detector, Gap Analyst, Drift Tracker, Decision Archaeologist) + 1 synthesis agent. Approach B chosen over simpler single-prompt (A) and scheduled engine (C).
- **Conversational trigger over slash command** - user wanted natural entry ("what patterns are you seeing?") rather than `/reflect` breaking flow. Skill description carries broad NLP triggers. `/reflect` still works as fallback.
- **SessionStart lifecycle nudge** - `reflect-nudge.sh` hook counts new memories since last reflection via `find -newer ~/.claude/last-reflect-timestamp`. Threshold default 15, configurable via `REFLECT_THRESHOLD` env var.
- **No /activity dashboard** - user rejected it as too surveillance-oriented for a small team.
- **Unified narrative output** - synthesis agent weaves all five lens findings into one coherent reflection, not five separate lists. Output includes narrative, ranked findings, open questions, recommended actions.
- **Token budget safeguard** - 80k token cap, prunes superseded file bodies and oldest memories first, never truncates recent or decision-type memories.
- **New installer component** - `reflect` key, included in minimal preset.

## Current status

- Design spec written and approved: `docs/superpowers/specs/2026-05-11-reflect-design.md`
- Implementation plan written: `docs/superpowers/plans/2026-05-11-reflect.md`
- Task 1 DONE: `claude/skills/reflect/SKILL.md` created (313 lines, commit 57e3254)
- Task 2 DONE: `claude/hooks/reflect-nudge.sh` created (commit 3e5ac76)
- Task 3 DONE: settings.json SessionStart hook registered (commit 8a3d1ae)
- Task 4 DONE: installer component added - arrays, detect, deactivate, install block, minimal preset, help (commit d2cd6e1)
- Task 5 DONE: e2e test passed - installer ran clean, all 3 files installed, nudge hook fires correctly (53 new memories detected with old timestamp)
- Task 6 DONE: CLAUDE.md docs - Reflect section added before Voice Output (commit d18e37e)
- ALL 6 TASKS COMPLETE
- Sanitized all external attribution references from spec and memory files

## Files touched

- `claude/skills/reflect/SKILL.md` (new - skill file, 313 lines)
- `claude/hooks/reflect-nudge.sh` (new - SessionStart nudge hook)
- `claude/settings.json` (modified - added SessionStart hook entry)
- `install.sh` (modified - reflect as 12th component)
- `claude/CLAUDE.md` (modified - Reflect section added)
- `docs/superpowers/specs/2026-05-11-reflect-design.md` (new - design spec)
- `docs/superpowers/plans/2026-05-11-reflect.md` (new - implementation plan)

## Files touched

- `docs/superpowers/specs/2026-05-11-reflect-design.md` (new - design spec)
