---
name: Agent routing Task 1 complete (global roster shipped)
description: quick-answer (haiku, read-only), sonnet-impl (sonnet, edit-capable), and a global opus-executor copy created in claude/agents/ and symlinked to ~/.claude/agents/. Test harness test-route-intent.sh created, 4/4 green. Commit 71dbd72f.
type: project
relates_to: [session_2026-07-26_agent-routing-execution.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller independently confirmed 3 repo files, 3 live symlinks, and bash claude/hooks/test-route-intent.sh 4 passed 0 failed
confidence: high
---

# Task 1: agent roster

Collaborator: Jonah. Implemented by the `task1-roster` teammate (sonnet),
commit `71dbd72f`, on branch `agent-routing`.

## What shipped

`claude/agents/` created with three roster tiers, each pinning its model in
YAML frontmatter:

- `quick-answer.md` - `model: haiku`, `tools: Read, Grep, Glob` (read-only).
  Answers one narrow factual question, cites `path:line`, stops at ~3 reads.
- `sonnet-impl.md` - `model: sonnet`, all tools. One fully specified change
  unit; stops rather than improvising a design decision.
- `opus-executor.md` - `model: opus`, copied up from `.claude/agents/`. The
  project-local original was left in place deliberately.

All three symlinked into `~/.claude/agents/` (the directory did not previously
exist).

`claude/hooks/test-route-intent.sh` created as the harness that Tasks 2-7
extend. Helpers: `pass`, `fail`, `assert_agent_model`, `assert_agent_tools`.
The RESULTS summary block stays last in the file so later tasks append
assertions above it.

## Why frontmatter matters here

The model id lives in a file the user wrote, so the session model dispatches by
agent NAME and never selects a model itself. This is what made the routing
design legal under the model-router guard even before the guard was removed.

## Verification

TDD honored: RED 0/4 with "missing .../quick-answer.md" before the agent files
existed, GREEN 4/4 after. The controller independently re-ran the suite
(4 passed, 0 failed) and confirmed the three symlinks resolve into the repo
rather than trusting the teammate's report.

## Note

The teammate reported that `memory-compact.sh` archived its MEMORY.md index
entry immediately, because the index is near its byte budget and several
teammates write to it concurrently. The beat file itself is intact. Flagging it
as expected mechanical behavior, not a defect, but the index churn is worth
watching if entries start disappearing that should not.

## Files touched
- `claude/agents/quick-answer.md`, `sonnet-impl.md`, `opus-executor.md` (new)
- `claude/hooks/test-route-intent.sh` (new)
- `~/.claude/agents/` (new dir, 3 symlinks)
- `.claude/memory/session_2026-07-26_agent-routing-task1.md` (this beat)
