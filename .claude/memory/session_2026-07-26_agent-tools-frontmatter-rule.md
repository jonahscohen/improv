---
name: Granting an agent all tools means OMITTING the tools key, never writing "All tools"
description: There is no all-tools sentinel value in agent frontmatter. The harness DISPLAYS "All tools" for an absent key; writing that string yields the two bogus tool names "All" and "tools" and a toolless agent. Confirmed by surveying ~20 agent definitions.
type: reference
relates_to: [session_2026-07-26_agent-routing-task1-review.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: surveyed every agent .md under ~/.claude and the improv repo; zero use "All tools" as a value; opus-executor (the working all-tools agent) omits the key
confidence: high
---

# Agent `tools:` frontmatter rule

**To grant a subagent every tool, omit the `tools:` key entirely.** There is no
sentinel value that means "all tools."

## The trap

The agent-type roster DISPLAYS `(Tools: All tools)` for an agent whose
frontmatter has no `tools:` key. That display string reads like a value you
should write into the file. It is not. Writing `tools: All tools` makes the
parser split on the space or comma and read two invalid tool names, `All` and
`tools`, leaving the agent with nothing.

The tell is in the roster display: an agent with the key omitted shows
`(Tools: All tools)`, while one that literally sets `tools: All tools` shows
`(Tools: All, tools)`. The inserted comma is the parser exposing its list.

## Evidence

Surveyed every agent `.md` under `~/.claude` and the improv repo. Roughly 20
files declare a `tools:` key, and every value is a list of real tool names,
either comma-separated (`Read, Grep, Glob`) or a JSON array (`["Bash"]`).
**None uses "All tools" as a value.** `opus-executor`, which demonstrably has
all tools, omits the key.

## How to lock it

A positive assertion cannot catch this, because the file is syntactically fine.
Use a negative assertion that the key is ABSENT:

```bash
assert_agent_no_tools() {
  local label="$1" file="$2"
  if [ ! -f "$AGENTS_DIR/$file" ]; then
    fail "$label" "missing $AGENTS_DIR/$file"; return
  fi
  if awk '/^---$/{n++; next} n==1 && /^tools:/{found=1} END{exit !found}' "$AGENTS_DIR/$file"; then
    fail "$label" "has a tools: key; omit it to grant all tools"
  else
    pass "$label"
  fi
}
```

## How it was caught, and the process lesson

The Task 1 reviewer flagged it from the roster display and correctly marked it
"cannot verify from diff." The plan's own self-review had passed it, because
that review checked placeholders, internal consistency, scope, and ambiguity -
never whether the config values it specified were VALID in the target harness.

**Lesson: when a plan hands an implementer verbatim config, validate that
config against its real consumer, not just against the plan's own internal
logic.** A plan is self-consistent right up until it confidently specifies
something the system does not accept.

## Files touched
- `docs/superpowers/plans/2026-07-26-agent-routing.md` (corrected: `tools:` line
  dropped from the sonnet-impl block, `assert_agent_no_tools` added, file guard
  added to `assert_agent_tools`, cumulative counts shifted +2)
- `.claude/memory/session_2026-07-26_agent-tools-frontmatter-rule.md` (this beat)
