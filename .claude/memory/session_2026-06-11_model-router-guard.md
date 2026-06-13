---
name: model-router-guard - non-negotiable ban on model routing and fable-router
description: Jonah's standing order - Claude is forbidden from automatically routing to another model or using fable-router, ever; PreToolUse hook enforces it on Bash, Agent, and Workflow; 15/15 tests pass, plus one live in-session block
type: feedback
relates_to: [session_2026-06-10_justify-watch-guard-hook.md]
---

Collaborator: Jonah. 2026-06-11. "pause, we're gonna write a hook that's a non-negotiable. you will not and are forbidden from ever automatically routing to another model or using 'fable-router'"

**Why:** model choice belongs to the user alone. The session model is never Claude's to switch, downgrade, upgrade, or "route" - not via a router binary, not via CLI flags, not via subagent/workflow overrides. There is NO override flag on this hook by design; if a task ever seems to need a different model, the only correct move is to stop and ask Jonah.

**How to apply:** never pass `model` to the Agent tool or in Workflow agent() opts/phase meta; never invoke fable-router (any casing/separator), model-router, or llm-router; never use `claude --model`/`--fallback-model` or set ANTHROPIC_MODEL. The hook makes violations mechanically impossible, but the rule binds judgment too: do not look for unguarded routes around it.

**Mechanism:** `claude/hooks/model-router-guard.sh` (symlinked ~/.claude/hooks/), registered in settings.json PreToolUse under BOTH the Bash group and the Agent|Workflow group. Per-surface checks:
- Bash: fable[-_]router (case-insensitive), `claude ... --model|--fallback-model`, `ANTHROPIC_MODEL=`, model[-_]router/llm[-_]router binaries.
- Agent: any non-empty tool_input.model -> deny; fable-router in the prompt -> deny.
- Workflow: fable-router anywhere in script/args/name; `model: "sonnet|opus|haiku|fable|claude-"` overrides in script (agent opts or phase meta).
Emits the standard permissionDecision deny JSON (bash-guard house style).

**Verified:** 15/15 payload tests pass (deny: all routing forms; allow: clean git/grep/claude -p, "data model" prose, schema-only workflows) via /tmp/test-model-router-guard.py. Bonus live proof: the hook blocked my own first test command in-session because the command text contained the forbidden string - registration and the Bash deny path confirmed against a REAL PreToolUse event, not just simulation.

Files: claude/hooks/model-router-guard.sh (new), claude/settings.json (two PreToolUse registrations), ~/.claude/hooks/model-router-guard.sh (symlink).
