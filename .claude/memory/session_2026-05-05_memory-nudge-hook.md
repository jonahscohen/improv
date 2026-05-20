---
name: Memory nudge PostToolUse hook
description: Built Option B from discipline enforcement plan - PostToolUse hook that nudges memory writes after code edits
type: project
supersedes: project_discipline_enforcement_plan.md
---

## What

Built `memory-nudge.sh` - a PostToolUse hook that fires after every Write/Edit/MultiEdit to a non-memory file. Outputs a "dirty state" nudge reminding the assistant to write session memory before responding.

## Implementation

- Hook reads stdin JSON, extracts `tool_input.file_path`
- Checks if path contains `.claude/memory/` or ends with `MEMORY.md` - if so, stays silent
- Otherwise outputs additionalContext nudge: "PROJECT FILE CHANGED. You are in dirty state."
- Registered in `~/.claude/settings.json` under PostToolUse with matcher `Write|Edit|MultiEdit`
- Placed in dotfiles repo at `claude/hooks/memory-nudge.sh`, symlinked to `~/.claude/hooks/`

## Why

Option B from `project_discipline_enforcement_plan.md`. Feedback documents (Options A, prior attempts) failed across three sessions. Mechanical enforcement at the exact moment of failure is more reliable than principles read once at session start.

## Bugfix (2026-05-06)

First version checked for `.claude/memory/` as a substring, which missed global project memory paths like `~/.claude/projects/.../memory/` (where `projects` sits between `.claude/` and `memory/`). Fixed to check for `.claude/` AND `/memory/` independently - covers both local and global memory directories.

## Files touched

- `claude/hooks/memory-nudge.sh` (new, then patched)
- `claude/settings.json` (PostToolUse registration added)
